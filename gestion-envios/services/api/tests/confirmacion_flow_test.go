package tests

// E2E de HU-08 (Task 6 del plan 2026-09-10-api-hu08-confirmacion):
// repartidor en_camino → confirmar (200 entregado, metadata en detalle,
// firma/foto descargables byte-idénticos) → reconfirmar 409 → confirmar
// directo desde asignado (2 eventos) → operador OK → incidencia con foto
// (Task 5) roundtrip.
//
// Los datos son propios del test (no se muta el seed): cuatro envíos
// asignados en rutas de dos repartidores. Reutiliza los helpers de
// seguimiento_flow_test.go (mismo paquete tests). Los bytes mínimos son los
// de confirmacion_repo_test.go (PNG de 1px y JPEG mínimo).
//
// OJO: no se asume ORDEN entre eventos de la misma tx en el historial
// (created_at empata + UUIDs random): se matchea por EstadoNuevo.

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/repository"
	"movii/api/internal/services"
	_ "movii/api/internal/testenv"
)

var (
	firmaE2EConfirmacion = []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52}
	fotoE2EConfirmacion  = []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00}
)

func cuerpoConfirmacionE2EDeTest(receptor, relacion string, firma, foto []byte) map[string]string {
	return map[string]string{
		"receptor_nombre":   receptor,
		"receptor_relacion": relacion,
		"firma_base64":      base64.StdEncoding.EncodeToString(firma),
		"foto_base64":       base64.StdEncoding.EncodeToString(foto),
	}
}

func TestFlujoCompleto_ConfirmacionEntrega(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	pool, err := db.New(t.Context(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	ctx := t.Context()
	// Pre-limpieza idempotente (misma técnica que los otros E2E).
	_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE codigo_guia LIKE 'MOV-E2E-%'")
	_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE nombre LIKE 'Ruta E2E Conf%'")
	_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE nombre LIKE 'Rem E2E Conf%'")
	_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE nombre LIKE 'Dest E2E Conf%'")
	_, _ = pool.Exec(ctx, "DELETE FROM usuarios WHERE email = 'e2e-conf-otro@movii.demo'")

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
		EnvioHandler:      handlers.NewEnvioHandler(services.NewEnvioService(pool, envioRepo, eventoRepo, repository.NewConfirmacionRepo(pool))),
		RutaHandler:       handlers.NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo)),
		RepartidorHandler: handlers.NewRepartidorHandler(services.NewRepartidorService(envioRepo)),
		EstadoHandler:     handlers.NewEstadoHandler(services.NewEstadoService(pool, envioRepo, eventoRepo, repository.NewConfirmacionRepo(pool))),
	})

	var repartidorID string
	require.NoError(t, pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))

	var otroRepartidorID string
	require.NoError(t, pool.QueryRow(ctx, `
		INSERT INTO usuarios (nombre, email, password_hash, rol)
		VALUES ('E2E Conf Otro', 'e2e-conf-otro@movii.demo', $1, 'repartidor')
		RETURNING id
	`, hashSemilla).Scan(&otroRepartidorID))

	envioID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Conf 1", repartidorID)
	envioDirectoID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Conf 2", repartidorID)
	envioOperadorID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Conf 3", otroRepartidorID)
	envioIncidenciaID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Conf 4", repartidorID)

	t.Cleanup(func() {
		ctxLimpieza := context.Background()
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM eventos_envio WHERE envio_id IN ($1, $2, $3, $4)",
			envioID, envioDirectoID, envioOperadorID, envioIncidenciaID)
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM confirmaciones_entrega WHERE envio_id IN ($1, $2, $3, $4)",
			envioID, envioDirectoID, envioOperadorID, envioIncidenciaID)
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM envios WHERE id IN ($1, $2, $3, $4)",
			envioID, envioDirectoID, envioOperadorID, envioIncidenciaID)
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM rutas WHERE nombre LIKE 'Ruta E2E Conf%'")
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM remitentes WHERE nombre LIKE 'Rem E2E Conf%'")
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM destinatarios WHERE nombre LIKE 'Dest E2E Conf%'")
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM usuarios WHERE email = 'e2e-conf-otro@movii.demo'")
	})

	tokenRepartidor := loginSeguimientoDeTest(t, router, "repartidor@movii.demo", "Movii2026!")

	// 1. Repartidor en_camino → confirmar (200, entregado).
	recCamino := pedidoSeguimientoDeTest(t, router, http.MethodPut, "/envios/"+envioID+"/estado", tokenRepartidor,
		map[string]string{"estado": domain.EstadoEnvioEnCamino})
	require.Equal(t, http.StatusOK, recCamino.Code, recCamino.Body.String())

	recConf := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioID+"/confirmacion", tokenRepartidor,
		cuerpoConfirmacionE2EDeTest("Juan Pérez", domain.RelacionDestinatario, firmaE2EConfirmacion, fotoE2EConfirmacion))
	require.Equal(t, http.StatusOK, recConf.Code, recConf.Body.String())
	var respConf map[string]any
	require.NoError(t, json.Unmarshal(recConf.Body.Bytes(), &respConf))
	require.Equal(t, domain.EstadoEnvioEntregado, respConf["estado"])

	// 2. El detalle trae la metadata de confirmación con sus URLs.
	recDetalle := pedidoSeguimientoDeTest(t, router, http.MethodGet, "/envios/"+envioID, tokenRepartidor, nil)
	require.Equal(t, http.StatusOK, recDetalle.Code, recDetalle.Body.String())
	var detalle map[string]any
	require.NoError(t, json.Unmarshal(recDetalle.Body.Bytes(), &detalle))
	require.Equal(t, domain.EstadoEnvioEntregado, detalle["estado"])
	confirmacion, ok := detalle["confirmacion"].(map[string]any)
	require.True(t, ok, "el detalle debe traer confirmacion: %s", recDetalle.Body.String())
	require.Equal(t, "Juan Pérez", confirmacion["receptor_nombre"])
	require.Equal(t, domain.RelacionDestinatario, confirmacion["receptor_relacion"])
	require.NotEmpty(t, confirmacion["confirmada_at"])
	require.Equal(t, "/envios/"+envioID+"/confirmacion/firma", confirmacion["firma_url"])
	require.Equal(t, "/envios/"+envioID+"/confirmacion/foto", confirmacion["foto_url"])

	// 3. Firma y foto descargables, byte-idénticos a los guardados.
	recFirma := pedidoSeguimientoDeTest(t, router, http.MethodGet, "/envios/"+envioID+"/confirmacion/firma", tokenRepartidor, nil)
	require.Equal(t, http.StatusOK, recFirma.Code, recFirma.Body.String())
	require.Equal(t, "image/png", recFirma.Header().Get("Content-Type"))
	require.Equal(t, firmaE2EConfirmacion, recFirma.Body.Bytes())

	recFoto := pedidoSeguimientoDeTest(t, router, http.MethodGet, "/envios/"+envioID+"/confirmacion/foto", tokenRepartidor, nil)
	require.Equal(t, http.StatusOK, recFoto.Code, recFoto.Body.String())
	require.Equal(t, "image/jpeg", recFoto.Header().Get("Content-Type"))
	require.Equal(t, fotoE2EConfirmacion, recFoto.Body.Bytes())

	// 4. Reconfirmar un entregado → 409 transicion_invalida.
	recDoble := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioID+"/confirmacion", tokenRepartidor,
		cuerpoConfirmacionE2EDeTest("Otro", domain.RelacionVecino, firmaE2EConfirmacion, fotoE2EConfirmacion))
	require.Equal(t, http.StatusConflict, recDoble.Code, recDoble.Body.String())
	require.Equal(t, "transicion_invalida", codigoErrorSeguimientoDeTest(t, recDoble))

	// 5. Confirmación directa desde asignado: 200 + DOS eventos en el
	// historial (asignado→en_camino y en_camino→entregado). Sin asumir
	// orden: se matchea por estado_nuevo.
	recDirecta := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioDirectoID+"/confirmacion", tokenRepartidor,
		cuerpoConfirmacionE2EDeTest("María Gómez", domain.RelacionFamiliar, firmaE2EConfirmacion, fotoE2EConfirmacion))
	require.Equal(t, http.StatusOK, recDirecta.Code, recDirecta.Body.String())
	var respDirecta map[string]any
	require.NoError(t, json.Unmarshal(recDirecta.Body.Bytes(), &respDirecta))
	require.Equal(t, domain.EstadoEnvioEntregado, respDirecta["estado"])

	recDetalleDirecto := pedidoSeguimientoDeTest(t, router, http.MethodGet, "/envios/"+envioDirectoID, tokenRepartidor, nil)
	require.Equal(t, http.StatusOK, recDetalleDirecto.Code, recDetalleDirecto.Body.String())
	var detalleDirecto map[string]any
	require.NoError(t, json.Unmarshal(recDetalleDirecto.Body.Bytes(), &detalleDirecto))
	historial, ok := detalleDirecto["historial"].([]any)
	require.True(t, ok, "el detalle debe traer historial: %s", recDetalleDirecto.Body.String())
	estadosNuevos := map[string]bool{}
	for _, evAny := range historial {
		ev, ok := evAny.(map[string]any)
		require.True(t, ok)
		if nuevo, _ := ev["estado_nuevo"].(string); nuevo != "" {
			estadosNuevos[nuevo] = true
		}
	}
	require.True(t, estadosNuevos[domain.EstadoEnvioEnCamino], "historial sin paso por en_camino: %v", estadosNuevos)
	require.True(t, estadosNuevos[domain.EstadoEnvioEntregado], "historial sin entregado: %v", estadosNuevos)

	// 6. Operador confirma un envío ajeno OK (no atado a rutas propias).
	tokenOperador := loginSeguimientoDeTest(t, router, "operador@movii.demo", "Movii2026!")
	recOp := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioOperadorID+"/confirmacion", tokenOperador,
		cuerpoConfirmacionE2EDeTest("Encargado Portería", domain.RelacionEncargado, firmaE2EConfirmacion, fotoE2EConfirmacion))
	require.Equal(t, http.StatusOK, recOp.Code, recOp.Body.String())
	var respOp map[string]any
	require.NoError(t, json.Unmarshal(recOp.Body.Bytes(), &respOp))
	require.Equal(t, domain.EstadoEnvioEntregado, respOp["estado"])

	// 7. Incidencia CON foto (Task 5): se acepta (200, no_entregado). La
	// columna foto no se expone en el JSON, no se asserta acá.
	recCaminoInc := pedidoSeguimientoDeTest(t, router, http.MethodPut, "/envios/"+envioIncidenciaID+"/estado", tokenRepartidor,
		map[string]string{"estado": domain.EstadoEnvioEnCamino})
	require.Equal(t, http.StatusOK, recCaminoInc.Code, recCaminoInc.Body.String())
	recInc := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioIncidenciaID+"/incidencia", tokenRepartidor,
		map[string]string{
			"motivo":      domain.MotivoClienteAusente,
			"comentario":  "nadie atiende, hay foto del frente",
			"foto_base64": base64.StdEncoding.EncodeToString(fotoE2EConfirmacion),
		})
	require.Equal(t, http.StatusOK, recInc.Code, recInc.Body.String())
	var respInc map[string]any
	require.NoError(t, json.Unmarshal(recInc.Body.Bytes(), &respInc))
	require.Equal(t, domain.EstadoEnvioNoEntregado, respInc["estado"])
}
