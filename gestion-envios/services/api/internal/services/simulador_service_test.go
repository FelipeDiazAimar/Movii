package services

import (
	"context"
	"errors"
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

func TestSimulador_VuelveAlDepositoYRepiteElRecorrido(t *testing.T) {
	ruta := "r1"
	deposito := geo.Punto{Lat: -31.4280, Lng: -62.0830}
	parada := geo.Punto{Lat: deposito.Lat, Lng: deposito.Lng + 0.002} // ~190 m
	repo := &simRepoFalso{enRuta: []repository.VehiculoEnRuta{{
		Posicion: domain.PosicionVehiculo{VehiculoID: "v1", RutaID: &ruta, Lat: deposito.Lat, Lng: deposito.Lng},
		Paradas:  []repository.ParadaSimulada{{EnvioID: "e1", Lat: parada.Lat, Lng: parada.Lng}},
	}}}
	reloj := time.Date(2026, 11, 7, 10, 0, 0, 0, ZonaAR)
	sim := NewSimuladorGPS(repo, geo.Recta{}, nil)
	sim.Tick, sim.VelocidadKmh, sim.Factor = 2*time.Second, 36, 1 // 20 m por tick
	sim.Repetir, sim.Deposito = 10*time.Second, deposito
	sim.Ahora = func() time.Time { return reloj }
	paso := func(n int) {
		for i := 0; i < n; i++ {
			reloj = reloj.Add(2 * time.Second)
			require.NoError(t, sim.Paso(context.Background()))
		}
	}
	donde := func() geo.Punto { return geo.Punto{Lat: repo.enRuta[0].Posicion.Lat, Lng: repo.enRuta[0].Posicion.Lng} }

	paso(12) // llega a la parada y espera
	require.InDelta(t, 0, geo.DistanciaM(donde(), parada), 1)
	require.False(t, sim.planes["v1"].regreso)

	paso(6) // pasó la espera: vuelve al depósito
	require.True(t, sim.planes["v1"].regreso)
	paso(12)
	require.InDelta(t, 0, geo.DistanciaM(donde(), deposito), 1, "llegó al depósito")

	paso(8) // y sale de nuevo hacia la parada
	require.False(t, sim.planes["v1"].regreso)
	require.Greater(t, geo.DistanciaM(donde(), deposito), 10.0)
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

// simEntregasRepo: como la base real, una parada resuelta deja de venir en EnRuta.
type simEntregasRepo struct {
	vehiculo  repository.VehiculoEnRuta
	resueltas map[string]bool
	pos       domain.PosicionVehiculo
}

func (r *simEntregasRepo) EnRuta(context.Context, string) ([]repository.VehiculoEnRuta, error) {
	v := r.vehiculo
	v.Posicion.Lat, v.Posicion.Lng = r.pos.Lat, r.pos.Lng
	v.Paradas = nil
	for _, p := range r.vehiculo.Paradas {
		if !r.resueltas[p.EnvioID] {
			v.Paradas = append(v.Paradas, p)
		}
	}
	if len(v.Paradas) == 0 {
		return nil, nil
	}
	return []repository.VehiculoEnRuta{v}, nil
}
func (r *simEntregasRepo) ActualizarPosicion(_ context.Context, p domain.PosicionVehiculo) error {
	r.pos = p
	return nil
}

type entregadorFalso struct {
	repo        *simEntregasRepo
	enCamino    []string
	entregados  []string
	incidencias []string
	actores     map[string]bool
}

func (e *entregadorFalso) CambiarEstado(_ context.Context, id, nuevo, actor, _ string) (domain.Envio, error) {
	e.actores[actor] = true
	if nuevo == domain.EstadoEnvioEnCamino {
		e.enCamino = append(e.enCamino, id)
	}
	return domain.Envio{}, nil
}
func (e *entregadorFalso) ConfirmarEntrega(_ context.Context, id, receptor, _ string, firma, foto []byte, actor, _ string) (domain.Envio, error) {
	e.actores[actor] = true
	if receptor == "" || len(firma) == 0 || len(foto) == 0 {
		return domain.Envio{}, errors.New("faltan datos")
	}
	e.entregados = append(e.entregados, id)
	e.repo.resueltas[id] = true
	return domain.Envio{}, nil
}
func (e *entregadorFalso) RegistrarIncidencia(_ context.Context, id, motivo, comentario string, _ []byte, actor, _ string) (domain.Envio, error) {
	e.actores[actor] = true
	if motivo == "" || comentario == "" {
		return domain.Envio{}, errors.New("faltan datos")
	}
	e.incidencias = append(e.incidencias, id)
	e.repo.resueltas[id] = true
	return domain.Envio{}, nil
}

func TestSimulador_EntregaLasParadasDemoYVuelveAlDeposito(t *testing.T) {
	ruta := "r1"
	deposito := geo.Punto{Lat: -31.4280, Lng: -62.0830}
	p1 := geo.Punto{Lat: deposito.Lat, Lng: deposito.Lng + 0.002}
	p2 := geo.Punto{Lat: deposito.Lat, Lng: deposito.Lng + 0.004}
	real := geo.Punto{Lat: deposito.Lat + 0.002, Lng: deposito.Lng + 0.004}
	repo := &simEntregasRepo{
		vehiculo: repository.VehiculoEnRuta{
			Posicion:     domain.PosicionVehiculo{VehiculoID: "v1", Patente: "TRK-318", RutaID: &ruta},
			RepartidorID: "rep-1",
			Paradas: []repository.ParadaSimulada{
				{EnvioID: "e1", Lat: p1.Lat, Lng: p1.Lng, Estado: domain.EstadoEnvioAsignado, Demo: true, Destinatario: "Ana Paz"},
				{EnvioID: "e2", Lat: p2.Lat, Lng: p2.Lng, Estado: domain.EstadoEnvioEnCamino, Demo: true, Destinatario: "Luis Sosa"},
				{EnvioID: "e3", Lat: real.Lat, Lng: real.Lng, Estado: domain.EstadoEnvioAsignado, Demo: false, Destinatario: "Cliente real"},
			},
		},
		resueltas: map[string]bool{},
		pos:       domain.PosicionVehiculo{Lat: deposito.Lat, Lng: deposito.Lng},
	}
	ent := &entregadorFalso{repo: repo, actores: map[string]bool{}}
	reloj := time.Date(2026, 11, 7, 10, 0, 0, 0, ZonaAR)
	sim := NewSimuladorGPS(repo, geo.Recta{}, nil).ConEntregas(ent)
	sim.Tick, sim.VelocidadKmh, sim.Factor = 2*time.Second, 36, 1 // 20 m por tick
	sim.Parada, sim.ProbFallo, sim.Deposito, sim.Repetir = 10*time.Second, 0, deposito, 0
	sim.Ahora = func() time.Time { return reloj }
	paso := func(n int) {
		for i := 0; i < n; i++ {
			reloj = reloj.Add(2 * time.Second)
			require.NoError(t, sim.Paso(context.Background()))
		}
	}

	paso(1)
	require.Empty(t, ent.enCamino, "el simulador no cambia estados al salir: eso lo hace iniciar la ruta")

	paso(11) // ~190 m: llega a la primera puerta y se queda
	require.InDelta(t, 0, geo.DistanciaM(geo.Punto{Lat: repo.pos.Lat, Lng: repo.pos.Lng}, p1), 1, "frena en la puerta")
	require.Zero(t, repo.pos.Velocidad)
	require.Empty(t, ent.entregados, "todavía está entregando")

	paso(6) // pasó el tiempo de parada: entrega y sigue
	require.Equal(t, []string{"e1"}, ent.entregados)
	require.Equal(t, []string{"e1"}, ent.enCamino, "e1 seguía asignado: sale justo antes de entregarse")

	paso(30)
	require.Equal(t, []string{"e1", "e2"}, ent.entregados, "entrega la segunda")
	require.NotContains(t, ent.entregados, "e3", "el envío real lo resuelve el repartidor")
	require.InDelta(t, 0, geo.DistanciaM(geo.Punto{Lat: repo.pos.Lat, Lng: repo.pos.Lng}, real), 1, "y el camión lo espera en la puerta")
	require.Zero(t, repo.pos.Velocidad)
	require.Equal(t, map[string]bool{"rep-1": true}, ent.actores, "actúa como el repartidor de la ruta")
}

func TestSimulador_TerminaLaRutaYVuelveAlDeposito(t *testing.T) {
	ruta := "r1"
	deposito := geo.Punto{Lat: -31.4280, Lng: -62.0830}
	p1 := geo.Punto{Lat: deposito.Lat, Lng: deposito.Lng + 0.002}
	repo := &simEntregasRepo{
		vehiculo: repository.VehiculoEnRuta{
			Posicion:     domain.PosicionVehiculo{VehiculoID: "v1", RutaID: &ruta},
			RepartidorID: "rep-1",
			Paradas:      []repository.ParadaSimulada{{EnvioID: "e1", Lat: p1.Lat, Lng: p1.Lng, Estado: domain.EstadoEnvioEnCamino, Demo: true, Destinatario: "Ana"}},
		},
		resueltas: map[string]bool{},
		pos:       domain.PosicionVehiculo{Lat: deposito.Lat, Lng: deposito.Lng},
	}
	ent := &entregadorFalso{repo: repo, actores: map[string]bool{}}
	reloj := time.Date(2026, 11, 7, 10, 0, 0, 0, ZonaAR)
	sim := NewSimuladorGPS(repo, geo.Recta{}, nil).ConEntregas(ent)
	sim.Tick, sim.VelocidadKmh, sim.Factor = 2*time.Second, 36, 1
	sim.Parada, sim.ProbFallo, sim.Deposito = 4*time.Second, 1, deposito // siempre falla: incidencia
	sim.Ahora = func() time.Time { return reloj }
	for i := 0; i < 40; i++ {
		reloj = reloj.Add(2 * time.Second)
		require.NoError(t, sim.Paso(context.Background()))
	}
	require.Equal(t, []string{"e1"}, ent.incidencias)
	require.InDelta(t, 0, geo.DistanciaM(geo.Punto{Lat: repo.pos.Lat, Lng: repo.pos.Lng}, deposito), 1, "volvió al depósito")
	require.Empty(t, sim.planes, "terminó el regreso")
}

func TestFlotaHub_AvisaLosCambiosDeEstado(t *testing.T) {
	hub := NewFlotaHub()
	cambios, cerrar := hub.SuscribirCambios()
	hub.CambioDeEstado("e1")
	hub.RutaAsignada("r1")
	require.Equal(t, "e1", <-cambios)
	require.Equal(t, "r1", <-cambios)
	cerrar()
	hub.CambioDeEstado("e2") // sin suscriptos no se bloquea
}

func TestSimulador_CamionConEntregaManualEsperaEnLaPuertaYVaMasRapido(t *testing.T) {
	ruta := "r1"
	deposito := geo.Punto{Lat: -31.4280, Lng: -62.0830}
	p1 := geo.Punto{Lat: deposito.Lat, Lng: deposito.Lng + 0.004} // ~380 m
	p2 := geo.Punto{Lat: deposito.Lat, Lng: deposito.Lng + 0.008}
	repo := &simEntregasRepo{
		vehiculo: repository.VehiculoEnRuta{
			Posicion:     domain.PosicionVehiculo{VehiculoID: "v1", Patente: "TRK-318", RutaID: &ruta},
			RepartidorID: "rep-1",
			Paradas: []repository.ParadaSimulada{
				{EnvioID: "e1", Lat: p1.Lat, Lng: p1.Lng, Estado: domain.EstadoEnvioEnCamino, Demo: true, Destinatario: "Ana"},
				{EnvioID: "e2", Lat: p2.Lat, Lng: p2.Lng, Estado: domain.EstadoEnvioEnCamino, Demo: true, Destinatario: "Luis"},
			},
		},
		resueltas: map[string]bool{},
		pos:       domain.PosicionVehiculo{Lat: deposito.Lat, Lng: deposito.Lng},
	}
	ent := &entregadorFalso{repo: repo, actores: map[string]bool{}}
	reloj := time.Date(2026, 11, 7, 10, 0, 0, 0, ZonaAR)
	sim := NewSimuladorGPS(repo, geo.Recta{}, nil).ConEntregas(ent)
	sim.Tick, sim.VelocidadKmh, sim.Factor, sim.Parada = 2*time.Second, 36, 1, 4*time.Second
	sim.EntregaManual, sim.VelocidadManualKmh = map[string]bool{"TRK-318": true}, 45
	sim.Ahora = func() time.Time { return reloj }
	paso := func(n int) {
		for i := 0; i < n; i++ {
			reloj = reloj.Add(2 * time.Second)
			require.NoError(t, sim.Paso(context.Background()))
		}
	}

	paso(1)
	require.InDelta(t, 25, geo.DistanciaM(deposito, geo.Punto{Lat: repo.pos.Lat, Lng: repo.pos.Lng}), 1, "a 45 km/h avanza 25 m por tick (no 20)")
	require.Greater(t, repo.pos.Velocidad, 40.0)

	paso(30) // llega a la puerta y se queda mucho más que la parada normal
	require.InDelta(t, 0, geo.DistanciaM(geo.Punto{Lat: repo.pos.Lat, Lng: repo.pos.Lng}, p1), 1)
	require.Empty(t, ent.entregados, "no entrega solo: espera a que lo hagan desde la app")
	require.Zero(t, repo.pos.Velocidad)

	repo.resueltas["e1"] = true // el repartidor confirmó la entrega en la app
	paso(10)
	require.Greater(t, geo.DistanciaM(geo.Punto{Lat: repo.pos.Lat, Lng: repo.pos.Lng}, p1), 100.0, "sigue hacia la próxima")
	require.Empty(t, ent.entregados)
}
