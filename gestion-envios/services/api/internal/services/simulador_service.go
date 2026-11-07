package services

import (
	"context"
	"log"
	"math"
	"strings"
	"sync"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
)

// simuladorRepo es lo que el simulador necesita de la base (repository.FlotaRepo lo implementa).
type simuladorRepo interface {
	EnRuta(ctx context.Context, fecha string) ([]repository.VehiculoEnRuta, error)
	ActualizarPosicion(ctx context.Context, p domain.PosicionVehiculo) error
}

// SimuladorGPS mueve los vehículos por las calles mientras su ruta del día
// tenga entregas pendientes, como si mandaran su GPS (en la demo no hay
// dispositivos reales en la calle). Cada vehículo sigue el recorrido OSRM que
// va desde su posición actual por las paradas pendientes, en orden; cuando el
// repartidor resuelve una parada el recorrido se recalcula desde donde está.
type SimuladorGPS struct {
	repo   simuladorRepo
	router geo.Router
	hub    *FlotaHub

	// Tick es cada cuánto avanza la simulación.
	Tick time.Duration
	// VelocidadKmh es la velocidad crucero de un vehículo en la ciudad.
	VelocidadKmh float64
	// Factor acelera la simulación (3 = el camión avanza 3 veces más rápido que en la realidad).
	Factor float64
	// Ahora permite fijar el reloj en los tests.
	Ahora func() time.Time

	mu     sync.Mutex
	planes map[string]*planSimulado
}

type planSimulado struct {
	clave  string
	linea  []geo.Punto
	largo  float64
	avance float64
}

// NewSimuladorGPS crea un simulador con valores por defecto razonables para la demo.
func NewSimuladorGPS(repo simuladorRepo, router geo.Router, hub *FlotaHub) *SimuladorGPS {
	return &SimuladorGPS{
		repo: repo, router: router, hub: hub,
		Tick: 2 * time.Second, VelocidadKmh: 32, Factor: 3, Ahora: time.Now,
		planes: map[string]*planSimulado{},
	}
}

// Correr ejecuta la simulación hasta que se cancele ctx.
func (s *SimuladorGPS) Correr(ctx context.Context) {
	t := time.NewTicker(s.Tick)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := s.Paso(ctx); err != nil && ctx.Err() == nil {
				log.Printf("simulador: %v", err)
			}
		}
	}
}

// Paso avanza un tick a todos los vehículos en ruta y publica sus posiciones.
func (s *SimuladorGPS) Paso(ctx context.Context) error {
	ahora := s.Ahora()
	enRuta, err := s.repo.EnRuta(ctx, FechaAR(ahora))
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	vigentes := make(map[string]bool, len(enRuta))
	pasoM := s.VelocidadKmh / 3.6 * s.Tick.Seconds() * s.Factor

	for _, v := range enRuta {
		id := v.Posicion.VehiculoID
		vigentes[id] = true

		clave := claveParadas(v)
		plan := s.planes[id]
		if plan == nil || plan.clave != clave {
			nuevo, err := s.planificar(ctx, v, clave)
			if err != nil {
				log.Printf("simulador: no se pudo trazar el recorrido de %s: %v", v.Posicion.Patente, err)
				continue
			}
			plan = nuevo
			s.planes[id] = plan
		}

		llego := plan.avance >= plan.largo
		plan.avance = math.Min(plan.avance+pasoM, plan.largo)
		punto, _, rumbo := geo.Interpolar(plan.linea, plan.avance)

		p := v.Posicion
		p.Lat, p.Lng, p.En = punto.Lat, punto.Lng, ahora
		if plan.avance >= plan.largo {
			p.Velocidad, p.Rumbo = 0, v.Posicion.Rumbo
		} else {
			// Pequeña variación para que el velocímetro no quede fijo.
			p.Velocidad = math.Round(s.VelocidadKmh*(0.9+0.2*math.Abs(math.Sin(plan.avance/90)))*10) / 10
			p.Rumbo = math.Round(rumbo*10) / 10
		}

		if !llego { // detenido al final: no hace falta reescribir la base en cada tick
			if err := s.repo.ActualizarPosicion(ctx, p); err != nil {
				return err
			}
		}
		if s.hub != nil {
			s.hub.Publicar(p)
		}
	}

	for id := range s.planes {
		if !vigentes[id] {
			delete(s.planes, id)
		}
	}
	return nil
}

// planificar traza el recorrido por calles desde la posición actual del
// vehículo pasando por sus paradas pendientes.
func (s *SimuladorGPS) planificar(ctx context.Context, v repository.VehiculoEnRuta, clave string) (*planSimulado, error) {
	puntos := make([]geo.Punto, 0, len(v.Paradas)+1)
	puntos = append(puntos, geo.Punto{Lat: v.Posicion.Lat, Lng: v.Posicion.Lng})
	for _, p := range v.Paradas {
		puntos = append(puntos, geo.Punto{Lat: p.Lat, Lng: p.Lng})
	}
	rec, err := s.router.Recorrido(ctx, puntos)
	if err != nil {
		return nil, err
	}
	return &planSimulado{clave: clave, linea: rec.Geometria, largo: geo.Largo(rec.Geometria)}, nil
}

func claveParadas(v repository.VehiculoEnRuta) string {
	ids := make([]string, 0, len(v.Paradas)+1)
	if v.Posicion.RutaID != nil {
		ids = append(ids, *v.Posicion.RutaID)
	}
	for _, p := range v.Paradas {
		ids = append(ids, p.EnvioID)
	}
	return strings.Join(ids, "|")
}
