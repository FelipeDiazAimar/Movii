package tests

// E2E del Sprint 3 (HU-18 flota, HU-12 trayecto, HU-16 teléfono): con datos
// propios del test da de alta un vehículo, lo asigna a una ruta de hoy, ve su
// carga en la flota y el trayecto por calles de un envío (Router sin red), y
// carga el teléfono de un usuario.

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/platform/geo"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
	"movii/api/internal/services"
	_ "movii/api/internal/testenv"
)

func TestFlujoCompleto_FlotaYTrayecto(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada")
	}
	pool, err := db.New(t.Context(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	ctx := t.Context()

	limpiar := func(c context.Context) {
		_, _ = pool.Exec(c, "DELETE FROM envios WHERE destinatario_id IN (SELECT id FROM destinatarios WHERE nombre LIKE 'Dest E2E Flota%')")
		_, _ = pool.Exec(c, "DELETE FROM rutas WHERE nombre LIKE 'Ruta E2E Flota%'")
		_, _ = pool.Exec(c, "DELETE FROM remitentes WHERE nombre LIKE 'Rem E2E Flota%'")
		_, _ = pool.Exec(c, "DELETE FROM destinatarios WHERE nombre LIKE 'Dest E2E Flota%'")
		_, _ = pool.Exec(c, "DELETE FROM vehiculos WHERE patente LIKE 'E2E%'")
		_, _ = pool.Exec(c, "UPDATE usuarios SET telefono = NULL WHERE telefono = '5493564999001'")
	}
	limpiar(ctx)
	t.Cleanup(func() { limpiar(context.Background()) })

	usuarioRepo := repository.NewUsuarioRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	eventoRepo := repository.NewEventoRepo(pool)
	confRepo := repository.NewConfirmacionRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)
	opsRepo := repository.NewOperacionesRepo(pool)
	flotaRepo := repository.NewFlotaRepo(pool)
	waRepo := repository.NewWhatsappRepo(pool)
	auth := services.NewAuthService(usuarioRepo, "secreto-de-test")
	router := httprouter.New(httprouter.Deps{
		CORSOrigins:        []string{"*"},
		JWTSecret:          "secreto-de-test",
		AuthHandler:        handlers.NewAuthHandler(auth),
		UsuariosHandler:    handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:       handlers.NewEnvioHandler(services.NewEnvioService(pool, envioRepo, eventoRepo, confRepo)),
		RutaHandler:        handlers.NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo)),
		RepartidorHandler:  handlers.NewRepartidorHandler(services.NewRepartidorService(envioRepo)),
		EstadoHandler:      handlers.NewEstadoHandler(services.NewEstadoService(pool, envioRepo, eventoRepo, confRepo)),
		TrackingHandler:    handlers.NewTrackingHandler(services.NewTrackingService(repository.NewTrackingRepo(pool))),
		OperacionesHandler: handlers.NewOperacionesHandler(services.NewOperacionesService(opsRepo).ConMapa(flotaRepo, geo.Recta{})),
		FlotaHandler:       handlers.NewFlotaHandler(services.NewFlotaService(flotaRepo, opsRepo, geo.Recta{}), services.NewFlotaHub()),
		WhatsappHandler:    handlers.NewWhatsappHandler(whatsapp.SoloLog{}, usuarioRepo, waRepo),
	})
	tokOp := loginSeguimientoDeTest(t, router, "operador@movii.demo", "Movii2026!")
	tokSup := loginSeguimientoDeTest(t, router, "supervisor@movii.demo", "Movii2026!")
	tokRep := loginSeguimientoDeTest(t, router, "repartidor@movii.demo", "Movii2026!")
	decodificar := func(rec interface{ Result() *http.Response }, v any) {
		require.NoError(t, json.NewDecoder(rec.Result().Body).Decode(v))
	}

	// --- Alta de vehículo (HU-18).
	rec := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/vehiculos", tokOp, map[string]any{
		"patente": "e2e 101", "modelo": "Furgón de test", "tipo": "furgon", "capacidad_peso": 1000, "capacidad_volumen": 10, "estado": "activo",
	})
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var v domain.Vehiculo
	decodificar(rec, &v)
	require.Equal(t, "E2E101", v.Patente, "la patente se normaliza")

	rec = pedidoSeguimientoDeTest(t, router, http.MethodPost, "/vehiculos", tokOp, map[string]any{
		"patente": "E2E101", "modelo": "Otro", "capacidad_peso": 1, "capacidad_volumen": 1,
	})
	require.Equal(t, http.StatusConflict, rec.Code)
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPost, "/vehiculos", tokOp, map[string]any{"patente": "E2E102", "modelo": "x", "capacidad_peso": 0, "capacidad_volumen": 1})
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, http.StatusForbidden, pedidoSeguimientoDeTest(t, router, http.MethodPost, "/vehiculos", tokRep, map[string]any{}).Code)

	// --- Ruta de hoy con un envío geolocalizado y el vehículo asignado.
	var repartidorID string
	require.NoError(t, pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))
	envioID := crearEnvioEnRutaDeTest(t, ctx, pool, envioRepo, "E2E Flota 1", repartidorID)
	var rutaID, fecha string
	require.NoError(t, pool.QueryRow(ctx, "SELECT ruta_id, to_char(r.fecha, 'YYYY-MM-DD') FROM envios e JOIN rutas r ON r.id = e.ruta_id WHERE e.id = $1", envioID).Scan(&rutaID, &fecha))
	_, err = pool.Exec(ctx, "UPDATE rutas SET nombre = 'Ruta E2E Flota' WHERE id = $1", rutaID)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `UPDATE destinatarios SET nombre = 'Dest E2E Flota', latitud = -31.43, longitud = -62.08
		WHERE id = (SELECT destinatario_id FROM envios WHERE id = $1)`, envioID)
	require.NoError(t, err)

	rec = pedidoSeguimientoDeTest(t, router, http.MethodPut, "/rutas/"+rutaID+"/vehiculo", tokOp, map[string]string{"vehiculo_id": v.ID})
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())

	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/operaciones/flota?fecha="+fecha, tokOp, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var flota []domain.Vehiculo
	decodificar(rec, &flota)
	var mio *domain.Vehiculo
	for i := range flota {
		if flota[i].ID == v.ID {
			mio = &flota[i]
		}
	}
	require.NotNil(t, mio)
	require.NotNil(t, mio.RutaID)
	require.Equal(t, rutaID, *mio.RutaID)
	require.Equal(t, 1, mio.TotalPaquetes)
	require.Greater(t, mio.CargaActualPeso, 0.0)

	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/operaciones/flota/"+v.ID+"?fecha="+fecha, tokOp, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var det domain.VehiculoDetalle
	decodificar(rec, &det)
	require.Len(t, det.Paquetes, 1)
	require.NotNil(t, det.Paquetes[0].Coordenadas)
	require.NotNil(t, det.Recorrido, "hay recorrido desde el vehículo a la parada pendiente")

	require.Equal(t, http.StatusNotFound, pedidoSeguimientoDeTest(t, router, http.MethodGet, "/operaciones/flota/00000000-0000-0000-0000-000000000000", tokOp, nil).Code)

	// --- Trayecto del envío (HU-12): el repartidor de la ruta lo ve; con vehículo y destino hay camino.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/envios/"+envioID+"/trayecto", tokRep, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var tr domain.TrayectoEnvio
	decodificar(rec, &tr)
	require.NotNil(t, tr.Vehiculo)
	require.Equal(t, "E2E101", tr.Vehiculo.Patente)
	require.NotNil(t, tr.Destino)
	require.NotNil(t, tr.Recorrido)

	// --- El mapa de la ruta trae el vehículo y el recorrido.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodGet, "/rutas/"+rutaID+"/mapa", tokRep, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var mapa domain.RutaMapa
	decodificar(rec, &mapa)
	require.NotNil(t, mapa.Vehiculo)
	require.NotNil(t, mapa.Recorrido)

	// --- Un vehículo en mantenimiento no puede salir a ruta.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPut, "/vehiculos/"+v.ID, tokOp, map[string]any{
		"modelo": "Furgón de test", "tipo": "furgon", "capacidad_peso": 1000, "capacidad_volumen": 10, "estado": "mantenimiento",
	})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPut, "/rutas/"+rutaID+"/vehiculo", tokOp, map[string]string{"vehiculo_id": v.ID})
	require.Equal(t, http.StatusConflict, rec.Code)

	// --- Teléfono del usuario (HU-16), solo admin; se normaliza.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPut, "/users/"+repartidorID+"/telefono", tokSup, map[string]string{"telefono": "03564 15 999001"})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var tel map[string]string
	decodificar(rec, &tel)
	require.Equal(t, "5493564999001", tel["telefono"])
	require.Equal(t, http.StatusForbidden, pedidoSeguimientoDeTest(t, router, http.MethodPut, "/users/"+repartidorID+"/telefono", tokOp, map[string]string{"telefono": "3564999001"}).Code)
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPut, "/users/"+repartidorID+"/telefono", tokSup, map[string]string{"telefono": "12"})
	require.Equal(t, http.StatusBadRequest, rec.Code)
}
