package services

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
)

type simRepoFalso struct {
	enRuta    []repository.VehiculoEnRuta
	guardadas []domain.PosicionVehiculo
}

func (r *simRepoFalso) EnRuta(context.Context, string) ([]repository.VehiculoEnRuta, error) {
	return r.enRuta, nil
}
func (r *simRepoFalso) ActualizarPosicion(_ context.Context, p domain.PosicionVehiculo) error {
	r.guardadas = append(r.guardadas, p)
	// el próximo tick parte de la posición guardada, como con la base real
	r.enRuta[0].Posicion.Lat, r.enRuta[0].Posicion.Lng = p.Lat, p.Lng
	return nil
}

func TestSimulador_AvanzaHastaLaUltimaParadaYSeDetiene(t *testing.T) {
	ruta := "r1"
	inicio := geo.Punto{Lat: -31.4280, Lng: -62.0830}
	// Una parada ~950 m al este por una recta (Router sin red).
	repo := &simRepoFalso{enRuta: []repository.VehiculoEnRuta{{
		Posicion: domain.PosicionVehiculo{VehiculoID: "v1", Patente: "TRK-318", RutaID: &ruta, Lat: inicio.Lat, Lng: inicio.Lng},
		Paradas:  []repository.ParadaSimulada{{EnvioID: "e1", Lat: inicio.Lat, Lng: inicio.Lng + 0.01}},
	}}}
	hub := NewFlotaHub()
	posiciones, cerrar := hub.Suscribir()
	defer cerrar()

	sim := NewSimuladorGPS(repo, geo.Recta{}, hub)
	sim.Tick, sim.VelocidadKmh, sim.Factor = 2*time.Second, 36, 1 // 10 m/s → 20 m por tick
	sim.Ahora = func() time.Time { return time.Date(2026, 11, 7, 10, 0, 0, 0, ZonaAR) }

	require.NoError(t, sim.Paso(context.Background()))
	p := <-posiciones
	require.InDelta(t, 20, geo.DistanciaM(inicio, geo.Punto{Lat: p.Lat, Lng: p.Lng}), 1, "un tick avanza velocidad × tiempo")
	require.InDelta(t, 90, p.Rumbo, 1, "va hacia el este")
	require.Greater(t, p.Velocidad, 0.0)

	for i := 0; i < 100; i++ {
		require.NoError(t, sim.Paso(context.Background()))
	}
	ultima := repo.guardadas[len(repo.guardadas)-1]
	require.InDelta(t, 0, geo.DistanciaM(geo.Punto{Lat: ultima.Lat, Lng: ultima.Lng}, geo.Punto{Lat: inicio.Lat, Lng: inicio.Lng + 0.01}), 1, "termina en la parada")
	require.Zero(t, ultima.Velocidad, "detenido al llegar")

	guardadasAlLlegar := len(repo.guardadas)
	require.NoError(t, sim.Paso(context.Background()))
	require.Len(t, repo.guardadas, guardadasAlLlegar, "detenido no reescribe la base en cada tick")
}

func TestSimulador_RecalculaCuandoCambianLasParadas(t *testing.T) {
	ruta := "r1"
	repo := &simRepoFalso{enRuta: []repository.VehiculoEnRuta{{
		Posicion: domain.PosicionVehiculo{VehiculoID: "v1", RutaID: &ruta, Lat: 0, Lng: 0},
		Paradas:  []repository.ParadaSimulada{{EnvioID: "e1", Lat: 0, Lng: 0.01}, {EnvioID: "e2", Lat: 0.01, Lng: 0.01}},
	}}}
	sim := NewSimuladorGPS(repo, geo.Recta{}, nil)
	sim.Ahora = time.Now
	require.NoError(t, sim.Paso(context.Background()))
	planAntes := sim.planes["v1"]

	repo.enRuta[0].Paradas = repo.enRuta[0].Paradas[1:] // se resolvió e1
	require.NoError(t, sim.Paso(context.Background()))
	require.NotSame(t, planAntes, sim.planes["v1"])

	repo.enRuta = nil // la ruta terminó
	require.NoError(t, sim.Paso(context.Background()))
	require.Empty(t, sim.planes)
}

func TestFlotaHub_UltimaPosicionParaQuienLlegaTarde(t *testing.T) {
	hub := NewFlotaHub()
	hub.Publicar(domain.PosicionVehiculo{VehiculoID: "v1", Lat: 1})
	hub.Publicar(domain.PosicionVehiculo{VehiculoID: "v1", Lat: 2})

	ch, cerrar := hub.Suscribir()
	p := <-ch
	require.Equal(t, 2.0, p.Lat, "recibe solo la última posición conocida")
	require.Equal(t, 1, hub.Suscriptos())
	cerrar()
	cerrar() // idempotente
	require.Equal(t, 0, hub.Suscriptos())
}
