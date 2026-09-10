package tests

// E2E de HU-09 (Task 4 del plan 2026-09-10-api-hu09-reprogramacion):
// login repartidor → en_camino → incidencia (no_entregado) → reprogramar
// (200, pendiente, reprogramado_para/franja en detalle) → aparece en
// GET /envios?fecha=<nueva> → asignar a ruta limpia las columnas → 409 al
// reprogramar un asignado → 400 con fecha pasada → login operador
// reprograma un envío ajeno OK.
//
// Los datos son propios del test (no se muta el seed): dos envíos asignados,
// cada uno en una ruta de un repartidor distinto. Reutiliza los helpers de
// seguimiento_flow_test.go (mismo paquete tests).

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/repository"
	"movii/api/internal/services"
	_ "movii/api/internal/testenv"
)

func TestFlujoCompleto_ReprogramacionEntregaFallida(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	pool, err := db.New(t.Context(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	ctx := t.Context()
	// Pre-limpieza idempotente (misma técnica que el E2E de seguimiento).
	_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE codigo_guia LIKE 'MOV-E2E-%'")
	_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE nombre LIKE 'Ruta E2E Reprog%'")
	_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE nombre LIKE 'Rem E2E Reprog%'")
	_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE nombre LIKE 'Dest E2E Reprog%'")
	_, _ = pool.Exec(ctx, "DELETE FROM usuarios WHERE email = 'e2e-reprog-otro@movii.demo'")

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

	var otroRepartidorID string
	require.NoError(t, pool.QueryRow(ctx, `
		INSERT INTO usuarios (nombre, email, password_hash, rol)
		VALUES ('E2E Reprog Otro', 'e2e-reprog-otro@movii.demo', $1, 'repartidor')
		RETURNING id
	`, hashSemilla).Scan(&otroRepartidorID))

	envioID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Reprog 1", repartidorID)
	envioAjenoID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Reprog 2", otroRepartidorID)

	t.Cleanup(func() {
		ctxLimpieza := context.Background()
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM eventos_envio WHERE envio_id IN ($1, $2)", envioID, envioAjenoID)
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM envios WHERE id IN ($1, $2)", envioID, envioAjenoID)
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM rutas WHERE nombre LIKE 'Ruta E2E Reprog%'")
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM remitentes WHERE nombre LIKE 'Rem E2E Reprog%'")
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM destinatarios WHERE nombre LIKE 'Dest E2E Reprog%'")
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM usuarios WHERE email = 'e2e-reprog-otro@movii.demo'")
	})

	nuevaFecha := time.Now().UTC().AddDate(0, 0, 2).Format("2006-01-02")

	// 1. Login repartidor → en_camino → incidencia (no_entregado).
	tokenRepartidor := loginSeguimientoDeTest(t, router, "repartidor@movii.demo", "Movii2026!")
	recCamino := pedidoSeguimientoDeTest(t, router, http.MethodPut, "/envios/"+envioID+"/estado", tokenRepartidor,
		map[string]string{"estado": domain.EstadoEnvioEnCamino})
	require.Equal(t, http.StatusOK, recCamino.Code, recCamino.Body.String())
	recInc := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioID+"/incidencia", tokenRepartidor,
		map[string]string{"motivo": domain.MotivoClienteAusente})
	require.Equal(t, http.StatusOK, recInc.Code, recInc.Body.String())

	// 2. Reprogramar → 200, vuelve a pendiente.
	recReprog := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioID+"/reprogramacion", tokenRepartidor,
		map[string]string{"nueva_fecha": nuevaFecha, "franja": domain.FranjaTarde})
	require.Equal(t, http.StatusOK, recReprog.Code, recReprog.Body.String())
	var respReprog map[string]any
	require.NoError(t, json.Unmarshal(recReprog.Body.Bytes(), &respReprog))
	require.Equal(t, domain.EstadoEnvioPendiente, respReprog["estado"])

	// 3. El detalle trae reprogramado_para + franja.
	recDetalle := pedidoSeguimientoDeTest(t, router, http.MethodGet, "/envios/"+envioID, tokenRepartidor, nil)
	require.Equal(t, http.StatusOK, recDetalle.Code, recDetalle.Body.String())
	var detalle map[string]any
	require.NoError(t, json.Unmarshal(recDetalle.Body.Bytes(), &detalle))
	require.Equal(t, nuevaFecha, detalle["reprogramado_para"])
	require.Equal(t, domain.FranjaTarde, detalle["franja"])

	// 4. Aparece en GET /envios?fecha=<nueva>.
	recLista := pedidoSeguimientoDeTest(t, router, http.MethodGet, "/envios?fecha="+nuevaFecha, tokenRepartidor, nil)
	require.Equal(t, http.StatusOK, recLista.Code, recLista.Body.String())
	var lista []map[string]any
	require.NoError(t, json.Unmarshal(recLista.Body.Bytes(), &lista))
	encontrado := false
	for _, item := range lista {
		if item["id"] == envioID {
			encontrado = true
		}
	}
	require.True(t, encontrado, "el envío reprogramado debe aparecer en su nueva fecha: %s", recLista.Body.String())

	// 5. Asignar a una ruta limpia las columnas (operador).
	tokenOperador := loginSeguimientoDeTest(t, router, "operador@movii.demo", "Movii2026!")
	recRuta := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/rutas", tokenOperador,
		map[string]string{"nombre": "Ruta E2E Reprog Nueva", "zona": "E2E", "fecha": nuevaFecha, "repartidor_id": repartidorID})
	require.Equal(t, http.StatusCreated, recRuta.Code, recRuta.Body.String())
	var respRuta map[string]any
	require.NoError(t, json.Unmarshal(recRuta.Body.Bytes(), &respRuta))
	rutaID, _ := respRuta["id"].(string)
	require.NotEmpty(t, rutaID)
	recAsig := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/rutas/"+rutaID+"/envios", tokenOperador,
		map[string]any{"envio_ids": []string{envioID}})
	require.Equal(t, http.StatusOK, recAsig.Code, recAsig.Body.String())

	recDetalle2 := pedidoSeguimientoDeTest(t, router, http.MethodGet, "/envios/"+envioID, tokenOperador, nil)
	require.Equal(t, http.StatusOK, recDetalle2.Code, recDetalle2.Body.String())
	var detalle2 map[string]any
	require.NoError(t, json.Unmarshal(recDetalle2.Body.Bytes(), &detalle2))
	require.Equal(t, domain.EstadoEnvioAsignado, detalle2["estado"])
	require.Nil(t, detalle2["reprogramado_para"], "asignar debe limpiar reprogramado_para: %s", recDetalle2.Body.String())
	require.Nil(t, detalle2["franja"], "asignar debe limpiar franja: %s", recDetalle2.Body.String())

	// 6. Reprogramar un envío asignado → 409 transicion_invalida.
	rec409 := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioID+"/reprogramacion", tokenOperador,
		map[string]string{"nueva_fecha": nuevaFecha, "franja": domain.FranjaManana})
	require.Equal(t, http.StatusConflict, rec409.Code, rec409.Body.String())
	require.Equal(t, "transicion_invalida", codigoErrorSeguimientoDeTest(t, rec409))

	// 7. Envío ajeno: operador lo lleva a no_entregado y la fecha pasada
	// da 400 fecha_invalida.
	recCamino2 := pedidoSeguimientoDeTest(t, router, http.MethodPut, "/envios/"+envioAjenoID+"/estado", tokenOperador,
		map[string]string{"estado": domain.EstadoEnvioEnCamino})
	require.Equal(t, http.StatusOK, recCamino2.Code, recCamino2.Body.String())
	recInc2 := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioAjenoID+"/incidencia", tokenOperador,
		map[string]string{"motivo": domain.MotivoZonaInsegura})
	require.Equal(t, http.StatusOK, recInc2.Code, recInc2.Body.String())
	ayer := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	rec400 := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioAjenoID+"/reprogramacion", tokenOperador,
		map[string]string{"nueva_fecha": ayer, "franja": domain.FranjaNoche})
	require.Equal(t, http.StatusBadRequest, rec400.Code, rec400.Body.String())
	require.Equal(t, "fecha_invalida", codigoErrorSeguimientoDeTest(t, rec400))

	// 8. Operador reprograma el envío ajeno OK (los roles no repartidor no
	// están atados a rutas propias).
	recReprog2 := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioAjenoID+"/reprogramacion", tokenOperador,
		map[string]string{"nueva_fecha": nuevaFecha, "franja": domain.FranjaNoche})
	require.Equal(t, http.StatusOK, recReprog2.Code, recReprog2.Body.String())
	var respReprog2 map[string]any
	require.NoError(t, json.Unmarshal(recReprog2.Body.Bytes(), &respReprog2))
	require.Equal(t, domain.EstadoEnvioPendiente, respReprog2["estado"])
}
