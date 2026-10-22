package tests

// E2E del Sprint 3 (HU-11 a HU-15): con datos propios del test (dos envíos
// del repartidor demo —uno entregado y uno fallido— y uno de otro
// repartidor) recorre el panel en vivo, el mapa de ruta, los reportes en
// JSON y CSV, el ranking y el Pareto de incidencias. Los otros datos de la
// base compartida pueden sumar, así que se afirma con >= y buscando las
// filas propias.

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
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

func TestFlujoCompleto_AnaliticaYMapa(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada")
	}
	pool, err := db.New(t.Context(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	ctx := t.Context()

	limpiar := func(c context.Context) {
		_, _ = pool.Exec(c, "DELETE FROM envios WHERE destinatario_id IN (SELECT id FROM destinatarios WHERE nombre LIKE 'Dest E2E Anal%')")
		_, _ = pool.Exec(c, "DELETE FROM rutas WHERE nombre LIKE 'Ruta E2E Anal%'")
		_, _ = pool.Exec(c, "DELETE FROM remitentes WHERE nombre LIKE 'Rem E2E Anal%'")
		_, _ = pool.Exec(c, "DELETE FROM destinatarios WHERE nombre LIKE 'Dest E2E Anal%'")
		_, _ = pool.Exec(c, "DELETE FROM usuarios WHERE email = 'e2e-anal-otro@movii.demo'")
	}
	limpiar(ctx)
	t.Cleanup(func() { limpiar(context.Background()) })

	usuarioRepo := repository.NewUsuarioRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	eventoRepo := repository.NewEventoRepo(pool)
	confRepo := repository.NewConfirmacionRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)
	router := httprouter.New(httprouter.Deps{
		CORSOrigins:        []string{"*"},
		JWTSecret:          "secreto-de-test",
		AuthHandler:        handlers.NewAuthHandler(services.NewAuthService(usuarioRepo, "secreto-de-test")),
		UsuariosHandler:    handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:       handlers.NewEnvioHandler(services.NewEnvioService(pool, envioRepo, eventoRepo, confRepo)),
		RutaHandler:        handlers.NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo)),
		RepartidorHandler:  handlers.NewRepartidorHandler(services.NewRepartidorService(envioRepo)),
		EstadoHandler:      handlers.NewEstadoHandler(services.NewEstadoService(pool, envioRepo, eventoRepo, confRepo)),
		TrackingHandler:    handlers.NewTrackingHandler(services.NewTrackingService(repository.NewTrackingRepo(pool))),
		OperacionesHandler: handlers.NewOperacionesHandler(services.NewOperacionesService(repository.NewOperacionesRepo(pool))),
		ReportesHandler:    handlers.NewReportesHandler(services.NewReportesService(repository.NewReportesRepo(pool))),
	})

	var repartidorID, otroID string
	require.NoError(t, pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))
	require.NoError(t, pool.QueryRow(ctx, `
		INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('E2E Anal Otro', 'e2e-anal-otro@movii.demo', $1, 'repartidor')
		RETURNING id`, hashSemilla).Scan(&otroID))

	entregadoID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Anal 1", repartidorID)
	fallidoID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Anal 2", repartidorID)
	ajenoID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Anal 3", otroID)

	var rutaPropia, rutaAjena, codigoFallido string
	require.NoError(t, pool.QueryRow(ctx, "SELECT ruta_id, codigo_guia FROM envios WHERE id = $1", fallidoID).Scan(&rutaPropia, &codigoFallido))
	require.NoError(t, pool.QueryRow(ctx, "SELECT ruta_id FROM envios WHERE id = $1", ajenoID).Scan(&rutaAjena))
	// El fallido también a la misma ruta que el entregado, para tener 2 paradas en una ruta.
	_, err = pool.Exec(ctx, "UPDATE envios SET ruta_id = $1 WHERE id = $2", rutaPropia, entregadoID)
	require.NoError(t, err)
	// Destinos creados después de la migración 0006: sin coordenadas. Le damos una a uno.
	_, err = pool.Exec(ctx, `UPDATE destinatarios SET latitud = -31.43, longitud = -62.08
		WHERE id = (SELECT destinatario_id FROM envios WHERE id = $1)`, entregadoID)
	require.NoError(t, err)

	tokRep := loginSeguimientoDeTest(t, router, "repartidor@movii.demo", "Movii2026!")
	tokOp := loginSeguimientoDeTest(t, router, "operador@movii.demo", "Movii2026!")

	// El repartidor entrega uno y falla el otro (los eventos quedan con él como actor).
	rec := pedidoSeguimientoDeTest(t, router, http.MethodPut, "/envios/"+entregadoID+"/estado", tokRep, map[string]string{"estado": "en_camino"})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+entregadoID+"/confirmacion", tokRep,
		cuerpoConfirmacionE2EDeTest("Receptor E2E", "familiar", firmaE2EConfirmacion, fotoE2EConfirmacion))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPost, "/envios/"+fallidoID+"/incidencia", tokRep, map[string]string{"motivo": "cliente_ausente"})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	hoy := time.Now().UTC().Format("2006-01-02")
	decodificar := func(rec interface{ Result() *http.Response }, v any) {
		require.NoError(t, json.NewDecoder(rec.Result().Body).Decode(v))
	}

	// --- HU-11: panel en vivo.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/operaciones/dashboard", tokOp, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var dash domain.DashboardOperaciones
	decodificar(rec, &dash)
	require.Equal(t, hoy, dash.Fecha)
	require.GreaterOrEqual(t, dash.Metricas.Entregados, 1)
	require.GreaterOrEqual(t, dash.Metricas.NoEntregados, 1)
	require.Greater(t, dash.Metricas.PorcentajeEfectividad, 0.0)
	var miRuta *domain.RutaActiva
	for i := range dash.RutasActivas {
		if dash.RutasActivas[i].RutaID == rutaPropia {
			miRuta = &dash.RutasActivas[i]
		}
	}
	require.NotNil(t, miRuta, "la ruta del test aparece en el panel")
	require.Equal(t, 2, miRuta.TotalParadas)
	require.Equal(t, 2, miRuta.Completadas)
	require.Equal(t, 100.0, miRuta.PorcentajeAvance)
	alertaPropia := false
	for _, a := range dash.UltimasAlertas {
		if a.CodigoGuia == codigoFallido {
			alertaPropia = a.Descripcion == "Destinatario ausente" && a.Tipo == "incidencia"
		}
	}
	require.True(t, alertaPropia, "la incidencia del test aparece como alerta")

	require.Equal(t, http.StatusForbidden, pedidoSeguimientoDeTest(t, router, http.MethodGet, "/operaciones/dashboard", tokRep, nil).Code)
	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/operaciones/dashboard?fecha=22-10-2026", tokOp, nil)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "fecha_invalida", codigoErrorSeguimientoDeTest(t, rec))

	// --- HU-12: mapa de ruta.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/rutas/"+rutaPropia+"/mapa", tokRep, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var mapa domain.RutaMapa
	decodificar(rec, &mapa)
	require.Equal(t, repartidorID, mapa.Repartidor.ID)
	require.Len(t, mapa.Paradas, 2)
	require.Equal(t, 1, mapa.Paradas[0].Orden)
	require.Equal(t, 2, mapa.Paradas[1].Orden)
	conCoords := 0
	for _, p := range mapa.Paradas {
		if p.Coordenadas != nil {
			conCoords++
			require.InDelta(t, -31.43, p.Coordenadas.Lat, 0.0001)
		}
	}
	require.Equal(t, 1, conCoords, "solo el destino geolocalizado trae coordenadas")

	require.Equal(t, http.StatusNotFound, pedidoSeguimientoDeTest(t, router, http.MethodGet, "/rutas/"+rutaAjena+"/mapa", tokRep, nil).Code, "ruta de otro repartidor")
	require.Equal(t, http.StatusOK, pedidoSeguimientoDeTest(t, router, http.MethodGet, "/rutas/"+rutaAjena+"/mapa", tokOp, nil).Code, "el operador ve cualquiera")
	require.Equal(t, http.StatusNotFound, pedidoSeguimientoDeTest(t, router, http.MethodGet, "/rutas/no-es-un-uuid/mapa", tokOp, nil).Code)

	// --- HU-13: reporte de envíos en JSON y CSV.
	periodo := "desde=" + hoy + "&hasta=" + hoy
	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/reportes/envios?"+periodo, tokOp, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var rep domain.ReporteEnvios
	decodificar(rec, &rep)
	motivoDelFallido := ""
	for _, f := range rep.Envios {
		if f.CodigoGuia == codigoFallido && f.MotivoFallo != nil {
			motivoDelFallido = *f.MotivoFallo
		}
	}
	require.Equal(t, "cliente_ausente", motivoDelFallido)
	require.Equal(t, len(rep.Envios), rep.Total)

	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/reportes/envios?"+periodo+"&estado=no_entregado&formato=csv", tokOp, nil)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "text/csv; charset=utf-8", rec.Header().Get("Content-Type"))
	nombreArchivo := strings.ReplaceAll(hoy, "-", "")
	require.Equal(t, `attachment; filename="reporte_envios_`+nombreArchivo+`_`+nombreArchivo+`.csv"`, rec.Header().Get("Content-Disposition"))
	csvTexto := rec.Body.String()
	require.True(t, strings.HasPrefix(csvTexto, "\xEF\xBB\xBFCodigo Guia,Fecha Creacion,Remitente"), "BOM + encabezado")
	require.Contains(t, csvTexto, codigoFallido)
	require.Contains(t, csvTexto, "Destinatario ausente")

	for _, q := range []string{"desde=" + hoy, "desde=2026-10-22&hasta=2026-10-01", "desde=2020-01-01&hasta=" + hoy} {
		rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/reportes/envios?"+q, tokOp, nil)
		require.Equal(t, http.StatusBadRequest, rec.Code, q)
		require.Equal(t, "periodo_invalido", codigoErrorSeguimientoDeTest(t, rec))
	}
	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/reportes/envios?"+periodo+"&formato=xlsx", tokOp, nil)
	require.Equal(t, "formato_invalido", codigoErrorSeguimientoDeTest(t, rec))
	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/reportes/envios?"+periodo+"&estado=perdido&formato=csv", tokOp, nil)
	require.Equal(t, http.StatusBadRequest, rec.Code, "el CSV valida antes de empezar a escribir")
	require.Equal(t, "estado_invalido", codigoErrorSeguimientoDeTest(t, rec))

	// --- HU-14: ranking de repartidores.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/reportes/repartidores?"+periodo, tokOp, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var ranking domain.RankingRepartidores
	decodificar(rec, &ranking)
	var demo *domain.DesempenoRepartidor
	for i := range ranking.Ranking {
		require.Equal(t, i+1, ranking.Ranking[i].Posicion)
		if ranking.Ranking[i].RepartidorID == repartidorID {
			demo = &ranking.Ranking[i]
		}
	}
	require.NotNil(t, demo)
	require.GreaterOrEqual(t, demo.Entregados, 1)
	require.GreaterOrEqual(t, demo.Fallidos, 1)
	require.GreaterOrEqual(t, demo.Asignados, demo.Entregados+demo.Fallidos)
	require.NotNil(t, demo.PromedioMinutosEntrega, "hubo una entrega con paso previo por en_camino")

	// --- HU-15: incidencias por motivo.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/reportes/incidencias?"+periodo, tokOp, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var inc domain.ReporteIncidencias
	decodificar(rec, &inc)
	require.GreaterOrEqual(t, inc.TotalIncidencias, 1)
	require.Len(t, inc.Distribucion, 5)
	suma := 0
	for _, m := range inc.Distribucion {
		suma += m.Cantidad
		if m.Motivo == "cliente_ausente" {
			require.GreaterOrEqual(t, m.Cantidad, 1)
		}
	}
	require.Equal(t, inc.TotalIncidencias, suma)

	require.Equal(t, http.StatusForbidden, pedidoSeguimientoDeTest(t, router, http.MethodGet, "/reportes/incidencias?"+periodo, tokRep, nil).Code)
}
