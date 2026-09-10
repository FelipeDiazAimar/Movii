package tests

// E2E de HU-06 + HU-07 (Task 6 del plan 2026-09-10-api-hu06-hu07):
// login repartidor → en_camino → incidencia con motivo (no_entregado) →
// reintento de cambio 409 → login operador → en_camino sobre envío de otro
// repartidor OK. Cierra verificando que GET /envios/{id} trae el historial
// con los eventos generados.
//
// Los datos son propios del test (no se muta el seed): dos envíos asignados,
// cada uno en una ruta de un repartidor distinto.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/repository"
	"movii/api/internal/services"
	_ "movii/api/internal/testenv"
)

// hashSemilla es el password_hash del seed (clave "Movii2026!" para los tres
// usuarios demo): permite crear un segundo repartidor sin hashear de nuevo.
const hashSemilla = "$2a$10$X5OtxtXJ/IAxmM7DGNo.C.usc7NHAE9svUkLpyEzUMv4DUhXi/vja"

func loginSeguimientoDeTest(t *testing.T, router http.Handler, email, password string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code, "login de %s: %s", email, rec.Body.String())
	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.NotEmpty(t, resp["token"])
	return resp["token"]
}

func pedidoSeguimientoDeTest(t *testing.T, router http.Handler, metodo, url, token string, cuerpo any) *httptest.ResponseRecorder {
	t.Helper()
	var lector *bytes.Reader
	if cuerpo == nil {
		lector = bytes.NewReader(nil)
	} else {
		raw, err := json.Marshal(cuerpo)
		require.NoError(t, err)
		lector = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(metodo, url, lector)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func codigoErrorSeguimientoDeTest(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var cuerpo map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cuerpo))
	errObj, ok := cuerpo["error"].(map[string]any)
	require.True(t, ok, "el cuerpo debe tener envelope error: %s", rec.Body.String())
	code, ok := errObj["code"].(string)
	require.True(t, ok)
	return code
}

// crearEnvioEnRutaDeTest crea remitente + destinatario + envío y lo asigna a
// una ruta nueva del repartidor dado (queda en estado asignado). Devuelve el
// ID del envío.
func crearEnvioEnRutaDeTest(t *testing.T, ctx context.Context, pool *pgxpool.Pool, envioRepo *repository.EnvioRepo, nombre, repartidorID string) string {
	t.Helper()

	rem, err := repository.CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem " + nombre})
	require.NoError(t, err)
	dest, err := repository.CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest " + nombre, Calle: "Mitre", Numero: "200", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)

	envio, err := envioRepo.Create(ctx, pool, domain.Envio{
		CodigoGuia:     fmt.Sprintf("MOV-E2E-%d", time.Now().UnixNano()%1000000000),
		Peso:           1,
		Tamano:         domain.TamanoChico,
		RemitenteID:    rem.ID,
		DestinatarioID: dest.ID,
	})
	require.NoError(t, err)

	var rutaID string
	require.NoError(t, pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id) VALUES ($1, 'E2E', CURRENT_DATE, $2)
		RETURNING id
	`, "Ruta "+nombre, repartidorID).Scan(&rutaID))

	asignados, err := envioRepo.AsignarEnvios(ctx, []string{envio.ID}, rutaID)
	require.NoError(t, err)
	require.Equal(t, 1, asignados)

	return envio.ID
}

func TestFlujoCompleto_SeguimientoTransicionesEIncidencia(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	pool, err := db.New(t.Context(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	ctx := t.Context()
	// Pre-limpieza idempotente: si una corrida anterior se interrumpió y dejó
	// filas con nuestros marcadores únicos, se borran para no chocar con
	// constraints (email único, etc.).
	_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE codigo_guia LIKE 'MOV-E2E-%'")
	_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE nombre LIKE 'Ruta E2E Seguimiento%'")
	_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE nombre LIKE 'Rem E2E Seguimiento%'")
	_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE nombre LIKE 'Dest E2E Seguimiento%'")
	_, _ = pool.Exec(ctx, "DELETE FROM usuarios WHERE email = 'e2e-otro-repartidor@movii.demo'")

	usuarioRepo := repository.NewUsuarioRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	eventoRepo := repository.NewEventoRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)
	authService := services.NewAuthService(usuarioRepo, "secreto-de-test")
	router := httprouter.New(httprouter.Deps{
		CORSOrigins:       []string{"*"},
		JWTSecret:         "secreto-de-test",
		AuthHandler:       handlers.NewAuthHandler(authService),
		UsuariosHandler:   handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:      handlers.NewEnvioHandler(services.NewEnvioService(pool, envioRepo, eventoRepo)),
		RutaHandler:       handlers.NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo)),
		RepartidorHandler: handlers.NewRepartidorHandler(services.NewRepartidorService(envioRepo)),
		EstadoHandler:     handlers.NewEstadoHandler(services.NewEstadoService(pool, envioRepo, eventoRepo)),
	})

	var repartidorID string
	require.NoError(t, pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))

	// Segundo repartidor propio del test (dueño del "envío ajeno").
	var otroRepartidorID string
	require.NoError(t, pool.QueryRow(ctx, `
		INSERT INTO usuarios (nombre, email, password_hash, rol)
		VALUES ('E2E Otro Repartidor', 'e2e-otro-repartidor@movii.demo', $1, 'repartidor')
		RETURNING id
	`, hashSemilla).Scan(&otroRepartidorID))

	// Envío 1 en ruta del repartidor demo, envío 2 en ruta del otro repartidor.
	envioID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Seguimiento 1", repartidorID)
	envioAjenoID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Seguimiento 2", otroRepartidorID)

	t.Cleanup(func() {
		ctxLimpieza := context.Background()
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM envios WHERE id IN ($1, $2)", envioID, envioAjenoID)
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM rutas WHERE nombre IN ('Ruta E2E Seguimiento 1', 'Ruta E2E Seguimiento 2')")
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM remitentes WHERE nombre IN ('Rem E2E Seguimiento 1', 'Rem E2E Seguimiento 2')")
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM destinatarios WHERE nombre IN ('Dest E2E Seguimiento 1', 'Dest E2E Seguimiento 2')")
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM usuarios WHERE email = 'e2e-otro-repartidor@movii.demo'")
	})

	// 1. Login repartidor → PUT en_camino (200).
	tokenRepartidor := loginSeguimientoDeTest(t, router, "repartidor@movii.demo", "Movii2026!")
	recEstado := pedidoSeguimientoDeTest(t, router, http.MethodPut, "/envios/"+envioID+"/estado", tokenRepartidor,
		map[string]string{"estado": domain.EstadoEnvioEnCamino})
	require.Equal(t, http.StatusOK, recEstado.Code, recEstado.Body.String())
	var respEstado map[string]any
	require.NoError(t, json.Unmarshal(recEstado.Body.Bytes(), &respEstado))
	require.Equal(t, domain.EstadoEnvioEnCamino, respEstado["estado"])

	// 2. POST incidencia con motivo (200, estado no_entregado).
	recInc := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioID+"/incidencia", tokenRepartidor,
		map[string]string{"motivo": domain.MotivoClienteAusente, "comentario": "nadie atiende, volver 18h"})
	require.Equal(t, http.StatusOK, recInc.Code, recInc.Body.String())
	var respInc map[string]any
	require.NoError(t, json.Unmarshal(recInc.Body.Bytes(), &respInc))
	require.Equal(t, domain.EstadoEnvioNoEntregado, respInc["estado"])

	// 3. Reintentar PUT estado sobre el envío finalizado → 409 transicion_invalida.
	recReintento := pedidoSeguimientoDeTest(t, router, http.MethodPut, "/envios/"+envioID+"/estado", tokenRepartidor,
		map[string]string{"estado": domain.EstadoEnvioEnCamino})
	require.Equal(t, http.StatusConflict, recReintento.Code, recReintento.Body.String())
	require.Equal(t, "transicion_invalida", codigoErrorSeguimientoDeTest(t, recReintento))

	// 4. GET detalle trae el historial con los eventos generados.
	recDetalle := pedidoSeguimientoDeTest(t, router, http.MethodGet, "/envios/"+envioID, tokenRepartidor, nil)
	require.Equal(t, http.StatusOK, recDetalle.Code, recDetalle.Body.String())
	var detalle map[string]any
	require.NoError(t, json.Unmarshal(recDetalle.Body.Bytes(), &detalle))
	require.Equal(t, domain.EstadoEnvioNoEntregado, detalle["estado"])
	historial, ok := detalle["historial"].([]any)
	require.True(t, ok, "el detalle debe traer historial: %s", recDetalle.Body.String())
	require.GreaterOrEqual(t, len(historial), 2, "historial: %s", recDetalle.Body.String())
	estadosNuevos := map[string]bool{}
	motivoVisto := false
	for _, evAny := range historial {
		ev, ok := evAny.(map[string]any)
		require.True(t, ok)
		if nuevo, _ := ev["estado_nuevo"].(string); nuevo != "" {
			estadosNuevos[nuevo] = true
		}
		if ev["estado_nuevo"] == domain.EstadoEnvioNoEntregado && ev["motivo"] == domain.MotivoClienteAusente {
			motivoVisto = true
		}
	}
	require.True(t, estadosNuevos[domain.EstadoEnvioEnCamino], "historial sin evento en_camino: %v", estadosNuevos)
	require.True(t, estadosNuevos[domain.EstadoEnvioNoEntregado], "historial sin evento no_entregado: %v", estadosNuevos)
	require.True(t, motivoVisto, "ningún evento guarda el motivo cliente_ausente")

	// 5. Login operador → PUT en_camino sobre el envío del otro repartidor
	// (200 OK: operador/supervisor no están atados a rutas propias).
	tokenOperador := loginSeguimientoDeTest(t, router, "operador@movii.demo", "Movii2026!")
	recOp := pedidoSeguimientoDeTest(t, router, http.MethodPut, "/envios/"+envioAjenoID+"/estado", tokenOperador,
		map[string]string{"estado": domain.EstadoEnvioEnCamino})
	require.Equal(t, http.StatusOK, recOp.Code, recOp.Body.String())
	var respOp map[string]any
	require.NoError(t, json.Unmarshal(recOp.Body.Bytes(), &respOp))
	require.Equal(t, domain.EstadoEnvioEnCamino, respOp["estado"])
}
