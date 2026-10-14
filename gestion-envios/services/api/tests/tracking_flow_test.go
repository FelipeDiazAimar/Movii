package tests

// E2E de HU-10 (Task 4 del plan 2026-09-10-api-hu10-tracking):
// ciclo completo contra el tracking PÚBLICO (sin Authorization):
// crear envío (operador) → asignar a ruta → en_camino → incidencia con
// motivo → reprogramar → asignar → en_camino → confirmar. Tras cada hito
// se consulta GET /tracking/{codigo} y se verifica: estado actual,
// localidad, timeline con las descripciones esperadas (como CONJUNTO, sin
// asumir orden entre eventos de la misma tx), actualizado_en no-vacío y
// no-retrocedente, y ausencia permanente de keys sensibles.
//
// Reutiliza los helpers de seguimiento_flow_test.go (mismo paquete tests).

import (
	"context"
	"encoding/base64"
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

var clavesSensiblesTrackingE2E = []string{
	`"telefono"`, `"email"`, `"calle"`, `"numero"`, `"actor_nombre"`,
	`"comentario"`, `"repartidor"`, `"direccion"`, `"actor"`, `"foto"`,
}

// trackingDeTest consulta GET /tracking/{codigo} SIN Authorization (ruta
// pública) y devuelve el status, el cuerpo parseado y el crudo.
func trackingDeTest(t *testing.T, router http.Handler, codigo string) (int, map[string]any, string) {
	t.Helper()
	rec := pedidoSeguimientoDeTest(t, router, http.MethodGet, "/tracking/"+codigo, "", nil)
	var raw map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &raw))
	return rec.Code, raw, rec.Body.String()
}

// descripcionesTrackingDeTest extrae el conjunto de descripciones del
// historial (sin orden: no se asume posición entre eventos de la misma tx).
func descripcionesTrackingDeTest(t *testing.T, raw map[string]any) map[string]bool {
	t.Helper()
	historial, ok := raw["historial"].([]any)
	require.True(t, ok, "el tracking debe traer historial como array: %v", raw)
	set := map[string]bool{}
	for _, evAny := range historial {
		ev, ok := evAny.(map[string]any)
		require.True(t, ok)
		desc, _ := ev["descripcion"].(string)
		require.NotEmpty(t, desc, "cada item debe traer descripcion: %v", ev)
		require.Contains(t, ev, "fecha")
		require.NotEmpty(t, ev["fecha"])
		set[desc] = true
	}
	return set
}

// afirmarTrackingSanoDeTest verifica invariantes en cada hito: localidad,
// actualizado_en no-vacío, y ausencia de keys sensibles en todo el JSON.
func afirmarTrackingSanoDeTest(t *testing.T, crudo string, raw map[string]any) {
	t.Helper()
	require.Equal(t, "San Francisco", raw["localidad"])
	require.Contains(t, raw, "actualizado_en")
	require.NotEmpty(t, raw["actualizado_en"])
	for _, key := range clavesSensiblesTrackingE2E {
		require.NotContains(t, crudo, key, "el tracking público no debe exponer %s", key)
	}
}

// actualizadoEnTrackingDeTest parsea actualizado_en (formato UTC
// YYYY-MM-DDTHH:MM:SSZ del TrackingRepo).
func actualizadoEnTrackingDeTest(t *testing.T, raw map[string]any) time.Time {
	t.Helper()
	ts, _ := raw["actualizado_en"].(string)
	require.NotEmpty(t, ts)
	parsed, err := time.Parse("2006-01-02T15:04:05Z", ts)
	require.NoError(t, err, "actualizado_en con formato inesperado: %q", ts)
	return parsed
}

func TestFlujoCompleto_TrackingPublico(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan")
	}

	pool, err := db.New(t.Context(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	ctx := t.Context()
	// Pre-limpieza idempotente por marcadores propios (el código de guía lo
	// genera la API, así que la limpieza de envíos es por id al final).
	_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE nombre LIKE 'Ruta E2E Track%'")
	_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE nombre LIKE 'Rem E2E Track%'")
	_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE nombre LIKE 'Dest E2E Track%'")

	usuarioRepo := repository.NewUsuarioRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	eventoRepo := repository.NewEventoRepo(pool)
	confirmacionRepo := repository.NewConfirmacionRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)
	authService := services.NewAuthService(usuarioRepo, "secreto-de-test")
	router := httprouter.New(httprouter.Deps{
		CORSOrigins:       []string{"*"},
		JWTSecret:         "secreto-de-test",
		AuthHandler:       handlers.NewAuthHandler(authService),
		UsuariosHandler:   handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:      handlers.NewEnvioHandler(services.NewEnvioService(pool, envioRepo, eventoRepo, confirmacionRepo)),
		RutaHandler:       handlers.NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo)),
		RepartidorHandler: handlers.NewRepartidorHandler(services.NewRepartidorService(envioRepo)),
		EstadoHandler:     handlers.NewEstadoHandler(services.NewEstadoService(pool, envioRepo, eventoRepo, confirmacionRepo)),
		TrackingHandler:   handlers.NewTrackingHandler(services.NewTrackingService(repository.NewTrackingRepo(pool))),
	})

	var repartidorID string
	require.NoError(t, pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))

	tokenOperador := loginSeguimientoDeTest(t, router, "operador@movii.demo", "Movii2026!")

	// Hito 0: el operador crea el envío (con teléfono cargado para que el
	// no-leak sea significativo).
	recCrea := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios", tokenOperador,
		map[string]any{
			"remitente": map[string]string{"nombre": "Rem E2E Track", "telefono": "3564-111111"},
			"destinatario": map[string]string{
				"nombre": "Dest E2E Track", "telefono": "3564-222222",
				"calle": "Mitre", "numero": "200", "localidad": "San Francisco", "codigo_postal": "X2400",
			},
			"paquete": map[string]any{"peso": 2.0, "tamano": "mediano"},
		})
	require.Equal(t, http.StatusCreated, recCrea.Code, recCrea.Body.String())
	var respCrea map[string]any
	require.NoError(t, json.Unmarshal(recCrea.Body.Bytes(), &respCrea))
	envioID, _ := respCrea["id"].(string)
	codigoGuia, _ := respCrea["codigo_guia"].(string)
	require.NotEmpty(t, envioID)
	require.NotEmpty(t, codigoGuia)

	t.Cleanup(func() {
		ctxLimpieza := context.Background()
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM eventos_envio WHERE envio_id = $1", envioID)
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM confirmaciones_entrega WHERE envio_id = $1", envioID)
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM envios WHERE id = $1", envioID)
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM rutas WHERE nombre LIKE 'Ruta E2E Track%'")
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM remitentes WHERE nombre LIKE 'Rem E2E Track%'")
		_, _ = pool.Exec(ctxLimpieza, "DELETE FROM destinatarios WHERE nombre LIKE 'Dest E2E Track%'")
	})

	// Hito 0: tracking recién creado → pendiente + "Envío registrado".
	code, raw, crudo := trackingDeTest(t, router, codigoGuia)
	require.Equal(t, http.StatusOK, code, crudo)
	require.Equal(t, codigoGuia, raw["codigo_guia"])
	require.Equal(t, domain.EstadoEnvioPendiente, raw["estado"])
	afirmarTrackingSanoDeTest(t, crudo, raw)
	require.Equal(t, map[string]bool{"Envío registrado": true}, descripcionesTrackingDeTest(t, raw))
	ultimoActualizado := actualizadoEnTrackingDeTest(t, raw)

	// Código inexistente → 404 genérico (sin distinguir, no enumerar).
	rec404 := pedidoSeguimientoDeTest(t, router, http.MethodGet, "/tracking/MOV-20990101-9999", "", nil)
	require.Equal(t, http.StatusNotFound, rec404.Code, rec404.Body.String())
	require.Equal(t, "no_encontrado", codigoErrorSeguimientoDeTest(t, rec404))
	var cuerpo404 map[string]any
	require.NoError(t, json.Unmarshal(rec404.Body.Bytes(), &cuerpo404))
	errObj, _ := cuerpo404["error"].(map[string]any)
	require.Equal(t, "no se encontró ningún envío con ese código", errObj["message"])

	// Hito 1: operador crea ruta y asigna → asignado.
	fechaRuta := time.Now().UTC().AddDate(0, 0, 1).Format("2006-01-02")
	recRuta := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/rutas", tokenOperador,
		map[string]string{"nombre": "Ruta E2E Track 1", "zona": "E2E", "fecha": fechaRuta, "repartidor_id": repartidorID})
	require.Equal(t, http.StatusCreated, recRuta.Code, recRuta.Body.String())
	var respRuta map[string]any
	require.NoError(t, json.Unmarshal(recRuta.Body.Bytes(), &respRuta))
	rutaID, _ := respRuta["id"].(string)
	require.NotEmpty(t, rutaID)
	recAsig := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/rutas/"+rutaID+"/envios", tokenOperador,
		map[string]any{"envio_ids": []string{envioID}})
	require.Equal(t, http.StatusOK, recAsig.Code, recAsig.Body.String())

	code, raw, crudo = trackingDeTest(t, router, codigoGuia)
	require.Equal(t, http.StatusOK, code, crudo)
	require.Equal(t, domain.EstadoEnvioAsignado, raw["estado"])
	afirmarTrackingSanoDeTest(t, crudo, raw)
	descs := descripcionesTrackingDeTest(t, raw)
	require.True(t, descs["Envío registrado"], "timeline sin registro: %v", descs)
	require.True(t, descs["Asignado a ruta de reparto"], "timeline sin asignación: %v", descs)
	require.False(t, actualizadoEnTrackingDeTest(t, raw).Before(ultimoActualizado), "actualizado_en retrocedió")
	ultimoActualizado = actualizadoEnTrackingDeTest(t, raw)

	tokenRepartidor := loginSeguimientoDeTest(t, router, "repartidor@movii.demo", "Movii2026!")

	// Hito 2: repartidor en_camino → "En camino".
	recCamino := pedidoSeguimientoDeTest(t, router, http.MethodPut, "/envios/"+envioID+"/estado", tokenRepartidor,
		map[string]string{"estado": domain.EstadoEnvioEnCamino})
	require.Equal(t, http.StatusOK, recCamino.Code, recCamino.Body.String())

	code, raw, crudo = trackingDeTest(t, router, codigoGuia)
	require.Equal(t, http.StatusOK, code, crudo)
	require.Equal(t, domain.EstadoEnvioEnCamino, raw["estado"])
	afirmarTrackingSanoDeTest(t, crudo, raw)
	descs = descripcionesTrackingDeTest(t, raw)
	require.True(t, descs["En camino"], "timeline sin en_camino: %v", descs)
	require.False(t, actualizadoEnTrackingDeTest(t, raw).Before(ultimoActualizado), "actualizado_en retrocedió")
	ultimoActualizado = actualizadoEnTrackingDeTest(t, raw)

	// Hito 3: incidencia con motivo → "No se pudo entregar: cliente ausente".
	recInc := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioID+"/incidencia", tokenRepartidor,
		map[string]string{"motivo": domain.MotivoClienteAusente, "comentario": "nadie atiende, comentario interno"})
	require.Equal(t, http.StatusOK, recInc.Code, recInc.Body.String())

	code, raw, crudo = trackingDeTest(t, router, codigoGuia)
	require.Equal(t, http.StatusOK, code, crudo)
	require.Equal(t, domain.EstadoEnvioNoEntregado, raw["estado"])
	afirmarTrackingSanoDeTest(t, crudo, raw)
	descs = descripcionesTrackingDeTest(t, raw)
	require.True(t, descs["No se pudo entregar: cliente ausente"], "timeline sin incidencia: %v", descs)
	// El motivo viaja tal cual en el item (y el comentario interno NO).
	motivoVisto := false
	historial, _ := raw["historial"].([]any)
	for _, evAny := range historial {
		ev, _ := evAny.(map[string]any)
		if ev["descripcion"] == "No se pudo entregar: cliente ausente" {
			require.Equal(t, domain.MotivoClienteAusente, ev["motivo"])
			motivoVisto = true
		}
	}
	require.True(t, motivoVisto, "ningún item trae el motivo cliente_ausente")
	require.NotContains(t, crudo, "nadie atiende")
	require.False(t, actualizadoEnTrackingDeTest(t, raw).Before(ultimoActualizado), "actualizado_en retrocedió")
	ultimoActualizado = actualizadoEnTrackingDeTest(t, raw)

	// Hito 4: reprogramar → pendiente + "Reprogramado para un nuevo intento".
	nuevaFecha := time.Now().UTC().AddDate(0, 0, 3).Format("2006-01-02")
	recReprog := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioID+"/reprogramacion", tokenRepartidor,
		map[string]string{"nueva_fecha": nuevaFecha, "franja": domain.FranjaTarde})
	require.Equal(t, http.StatusOK, recReprog.Code, recReprog.Body.String())

	code, raw, crudo = trackingDeTest(t, router, codigoGuia)
	require.Equal(t, http.StatusOK, code, crudo)
	require.Equal(t, domain.EstadoEnvioPendiente, raw["estado"])
	afirmarTrackingSanoDeTest(t, crudo, raw)
	descs = descripcionesTrackingDeTest(t, raw)
	require.True(t, descs["Reprogramado para un nuevo intento"], "timeline sin reprogramación: %v", descs)
	require.False(t, actualizadoEnTrackingDeTest(t, raw).Before(ultimoActualizado), "actualizado_en retrocedió")
	ultimoActualizado = actualizadoEnTrackingDeTest(t, raw)

	// Hito 5: operador asigna a una ruta nueva (limpia la reprogramación).
	recRuta2 := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/rutas", tokenOperador,
		map[string]string{"nombre": "Ruta E2E Track 2", "zona": "E2E", "fecha": nuevaFecha, "repartidor_id": repartidorID})
	require.Equal(t, http.StatusCreated, recRuta2.Code, recRuta2.Body.String())
	var respRuta2 map[string]any
	require.NoError(t, json.Unmarshal(recRuta2.Body.Bytes(), &respRuta2))
	ruta2ID, _ := respRuta2["id"].(string)
	require.NotEmpty(t, ruta2ID)
	recAsig2 := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/rutas/"+ruta2ID+"/envios", tokenOperador,
		map[string]any{"envio_ids": []string{envioID}})
	require.Equal(t, http.StatusOK, recAsig2.Code, recAsig2.Body.String())

	code, raw, crudo = trackingDeTest(t, router, codigoGuia)
	require.Equal(t, http.StatusOK, code, crudo)
	require.Equal(t, domain.EstadoEnvioAsignado, raw["estado"])
	afirmarTrackingSanoDeTest(t, crudo, raw)
	descs = descripcionesTrackingDeTest(t, raw)
	require.True(t, descs["Reprogramado para un nuevo intento"], "la reprogramación debe seguir en el historial: %v", descs)
	require.False(t, actualizadoEnTrackingDeTest(t, raw).Before(ultimoActualizado), "actualizado_en retrocedió")
	ultimoActualizado = actualizadoEnTrackingDeTest(t, raw)

	// Hito 6: en_camino → confirmar (firma+foto) → entregado.
	recCamino2 := pedidoSeguimientoDeTest(t, router, http.MethodPut, "/envios/"+envioID+"/estado", tokenRepartidor,
		map[string]string{"estado": domain.EstadoEnvioEnCamino})
	require.Equal(t, http.StatusOK, recCamino2.Code, recCamino2.Body.String())
	recConf := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+envioID+"/confirmacion", tokenRepartidor,
		map[string]string{
			"receptor_nombre":   "Cliente Final",
			"receptor_relacion": domain.RelacionDestinatario,
			"firma_base64":      base64.StdEncoding.EncodeToString(firmaE2EConfirmacion),
			"foto_base64":       base64.StdEncoding.EncodeToString(fotoE2EConfirmacion),
		})
	require.Equal(t, http.StatusOK, recConf.Code, recConf.Body.String())

	code, raw, crudo = trackingDeTest(t, router, codigoGuia)
	require.Equal(t, http.StatusOK, code, crudo)
	require.Equal(t, domain.EstadoEnvioEntregado, raw["estado"])
	afirmarTrackingSanoDeTest(t, crudo, raw)
	descs = descripcionesTrackingDeTest(t, raw)
	require.True(t, descs["Entregado"], "timeline sin entrega: %v", descs)
	for _, esperada := range []string{
		"Envío registrado",
		"Asignado a ruta de reparto",
		"En camino",
		"No se pudo entregar: cliente ausente",
		"Reprogramado para un nuevo intento",
		"Entregado",
	} {
		require.True(t, descs[esperada], "timeline final sin %q: %v", esperada, descs)
	}
	require.NotContains(t, crudo, "Cliente Final", "el nombre del receptor no debe exponerse")
	require.False(t, actualizadoEnTrackingDeTest(t, raw).Before(ultimoActualizado), "actualizado_en retrocedió")
}
