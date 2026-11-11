package services

import (
	"context"
	"log"
	"math"
	"math/rand/v2"
	"strings"
	"sync"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/platform/geo"
	"movii/api/internal/platform/imagenes"
	"movii/api/internal/repository"
)

// simuladorRepo es lo que el simulador necesita de la base (repository.FlotaRepo lo implementa).
type simuladorRepo interface {
	EnRuta(ctx context.Context, fecha string) ([]repository.VehiculoEnRuta, error)
	ActualizarPosicion(ctx context.Context, p domain.PosicionVehiculo) error
}

// EntregadorSimulado resuelve las entregas como lo haría el repartidor desde
// la app (EstadoService lo implementa): así el historial, los avisos, los
// reportes y el tracking se actualizan igual que con una entrega real.
type EntregadorSimulado interface {
	CambiarEstado(ctx context.Context, envioID, nuevo, actorID, rol string) (domain.Envio, error)
	ConfirmarEntrega(ctx context.Context, envioID, receptorNombre, receptorRelacion string, firma, foto []byte, actorID, rol string) (domain.Envio, error)
	RegistrarIncidencia(ctx context.Context, envioID, motivo, comentario string, foto []byte, actorID, rol string) (domain.Envio, error)
}

// SimuladorGPS mueve los vehículos por las calles mientras su ruta del día
// esté en curso (iniciada) y tenga entregas pendientes, como si mandaran su GPS (en la demo no hay
// dispositivos reales en la calle). Cada vehículo sigue el recorrido OSRM que
// va desde su posición actual por las paradas pendientes, en orden; cuando se
// resuelve una parada el recorrido se recalcula desde donde está.
//
// Con ConEntregas, además hace el trabajo del repartidor con los envíos de
// demostración (destinatario demo): al llegar a cada domicilio se queda un
// rato y la entrega (receptor, firma y foto) o, a veces, registra una
// incidencia. En un envío real espera en la puerta a que lo resuelva el
// repartidor desde la app. Al terminar la ruta vuelve al depósito.
type SimuladorGPS struct {
	repo     simuladorRepo
	router   geo.Router
	hub      *FlotaHub
	entregas EntregadorSimulado
	rnd      *rand.Rand

	// Tick es cada cuánto avanza la simulación.
	Tick time.Duration
	// VelocidadKmh es la velocidad crucero de un vehículo en la ciudad.
	VelocidadKmh float64
	// Factor acelera la simulación (3 = el camión avanza 3 veces más rápido que en la realidad).
	Factor float64
	// Ahora permite fijar el reloj en los tests.
	Ahora func() time.Time
	// Repetir: cuánto espera el vehículo al terminar sus paradas (si quedan
	// pendientes que nadie resolvió) antes de volver al depósito y repetir el
	// recorrido. 0 (por defecto) = se queda en la última parada esperando.
	Repetir time.Duration
	// Deposito es adonde vuelve el vehículo.
	Deposito geo.Punto
	// Parada es cuánto se queda el vehículo en cada domicilio al entregar (con entregas simuladas).
	Parada time.Duration
	// ProbFallo es la probabilidad de que una entrega simulada termine en incidencia.
	ProbFallo float64
	// EntregaManual: patentes cuyos envíos no se entregan solos aunque sean de
	// demostración. El camión llega a la puerta y espera a que el repartidor
	// confirme la entrega (o la incidencia) desde la app, como en la vida real.
	EntregaManual map[string]bool
	// VelocidadManualKmh es la velocidad crucero de esos camiones (0 = la normal):
	// van más rápido para no esperar tanto entre parada y parada en una presentación.
	VelocidadManualKmh float64

	mu     sync.Mutex
	planes map[string]*planSimulado
}

type planSimulado struct {
	clave  string
	linea  []geo.Punto
	largo  float64
	avance float64
	// regreso: tramo de vuelta al depósito.
	regreso bool
	// final: regreso después de terminar la ruta (el vehículo ya no está "en ruta").
	final bool
	// llegoEn: cuándo llegó al final de la línea (cero = todavía no).
	llegoEn time.Time

	// Para las entregas simuladas.
	vehiculo      repository.VehiculoEnRuta
	paradas       []repository.ParadaSimulada
	marcas        []float64 // distancia sobre la línea de cada parada
	proxima       int
	enParadaDesde time.Time
	rumbo         float64
}

// NewSimuladorGPS crea un simulador con valores por defecto razonables para la demo.
func NewSimuladorGPS(repo simuladorRepo, router geo.Router, hub *FlotaHub) *SimuladorGPS {
	return &SimuladorGPS{
		repo: repo, router: router, hub: hub,
		Tick: 2 * time.Second, VelocidadKmh: 32, Factor: 1, Ahora: time.Now,
		Deposito: geo.CentroSanFrancisco,
		Parada:   40 * time.Second, ProbFallo: 0.1,
		rnd:    rand.New(rand.NewPCG(uint64(time.Now().UnixNano()), 7)),
		planes: map[string]*planSimulado{},
	}
}

// ConEntregas hace que el simulador resuelva solo las entregas de los envíos de demostración.
func (s *SimuladorGPS) ConEntregas(e EntregadorSimulado) *SimuladorGPS {
	s.entregas = e
	return s
}

// Pausar frena la simulación (por ejemplo, mientras se rearma el día de
// demostración) hasta llamar a la función que devuelve, que además descarta
// los recorridos en curso para que se tracen de nuevo con los datos nuevos.
func (s *SimuladorGPS) Pausar() (reanudar func()) {
	s.mu.Lock()
	return func() {
		s.planes = map[string]*planSimulado{}
		s.mu.Unlock()
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
		plan.vehiculo = v

		if plan.avance >= plan.largo && s.Repetir > 0 && !s.atendiendoParada(plan) {
			if plan.llegoEn.IsZero() {
				plan.llegoEn = ahora
			} else if ahora.Sub(plan.llegoEn) >= s.Repetir {
				if siguiente, err := s.siguienteVuelta(ctx, v, plan); err != nil {
					log.Printf("simulador: %s no pudo seguir: %v", v.Posicion.Patente, err)
				} else {
					siguiente.vehiculo = v
					plan = siguiente
					s.planes[id] = plan
				}
			}
		}
		if err := s.avanzar(ctx, plan, v.Posicion, ahora); err != nil {
			return err
		}
	}

	for id, plan := range s.planes {
		if vigentes[id] {
			continue
		}
		// La ruta ya no tiene paradas pendientes (o terminó el día).
		if s.entregas == nil || (plan.final && plan.avance >= plan.largo) {
			delete(s.planes, id)
			continue
		}
		if !plan.final {
			// Terminó la ruta: vuelve al depósito.
			final, err := s.tramoAlDeposito(ctx, plan)
			if err != nil {
				log.Printf("simulador: %s no pudo volver al depósito: %v", plan.vehiculo.Posicion.Patente, err)
				delete(s.planes, id)
				continue
			}
			plan = final
			s.planes[id] = plan
		}
		if err := s.avanzar(ctx, plan, plan.vehiculo.Posicion, ahora); err != nil {
			return err
		}
	}
	return nil
}

// atendiendoParada indica si el vehículo tiene una parada por resolver adelante.
func (s *SimuladorGPS) atendiendoParada(plan *planSimulado) bool {
	return s.entregas != nil && !plan.regreso && plan.proxima < len(plan.paradas)
}

// velocidadDe es la velocidad crucero del vehículo (km/h).
func (s *SimuladorGPS) velocidadDe(patente string) float64 {
	if s.EntregaManual[patente] && s.VelocidadManualKmh > 0 {
		return s.VelocidadManualKmh
	}
	return s.VelocidadKmh
}

// avanzar mueve el vehículo un tick sobre su plan, guarda la posición y la
// publica. En cada domicilio frena: si el envío es de demostración lo
// resuelve solo después de la parada; si es real (o el camión está en
// EntregaManual), espera en la puerta a que el repartidor lo resuelva desde la
// app (entonces EnRuta deja de traerlo y el recorrido se recalcula desde ahí).
func (s *SimuladorGPS) avanzar(ctx context.Context, plan *planSimulado, base domain.PosicionVehiculo, ahora time.Time) error {
	velocidad := s.velocidadDe(base.Patente)
	pasoM := velocidad / 3.6 * s.Tick.Seconds() * s.Factor
	detenido := false
	if s.atendiendoParada(plan) && plan.avance >= plan.marcas[plan.proxima] {
		par := plan.paradas[plan.proxima]
		detenido = true
		if plan.enParadaDesde.IsZero() {
			plan.enParadaDesde = ahora
		} else if par.Demo && !s.EntregaManual[base.Patente] && ahora.Sub(plan.enParadaDesde) >= s.Parada {
			s.resolver(ctx, plan.vehiculo, par)
			plan.proxima++
			plan.enParadaDesde = time.Time{}
		}
	}

	quieto := plan.avance >= plan.largo
	if !detenido {
		hasta := plan.largo
		if s.atendiendoParada(plan) {
			hasta = math.Min(hasta, plan.marcas[plan.proxima]) // frena en la puerta
		}
		plan.avance = math.Min(plan.avance+pasoM, hasta)
	}
	punto, _, rumbo := geo.Interpolar(plan.linea, plan.avance)

	p := base
	p.Lat, p.Lng, p.En = punto.Lat, punto.Lng, ahora
	if detenido || plan.avance >= plan.largo {
		p.Velocidad, p.Rumbo = 0, base.Rumbo
		if plan.rumbo != 0 {
			p.Rumbo = plan.rumbo
		}
	} else {
		// Pequeña variación para que el velocímetro no quede fijo.
		p.Velocidad = math.Round(velocidad*(0.9+0.2*math.Abs(math.Sin(plan.avance/90)))*10) / 10
		p.Rumbo = math.Round(rumbo*10) / 10
		plan.rumbo = p.Rumbo
	}
	plan.vehiculo.Posicion.Lat, plan.vehiculo.Posicion.Lng = p.Lat, p.Lng

	// Detenido no hace falta reescribir la base en cada tick (sí al llegar).
	if !quieto && !(detenido && !plan.enParadaDesde.Equal(ahora)) {
		if err := s.repo.ActualizarPosicion(ctx, p); err != nil {
			return err
		}
	}
	if s.hub != nil {
		s.hub.Publicar(p)
	}
	return nil
}

var (
	nombresReceptor     = []string{"María", "José", "Ana", "Carlos", "Laura", "Miguel", "Silvia", "Raúl", "Graciela", "Pablo"}
	relacionesReceptor  = []string{"familiar", "familiar", "vecino", "encargado"}
	motivosSimulados    = []string{domain.MotivoClienteAusente, domain.MotivoClienteAusente, domain.MotivoClienteAusente, domain.MotivoDireccionIncorrecta, domain.MotivoRechazado}
	comentariosSimulado = map[string][]string{
		domain.MotivoClienteAusente:      {"no atendió nadie, toqué timbre dos veces", "no había nadie en el domicilio", "portón cerrado, sin respuesta"},
		domain.MotivoDireccionIncorrecta: {"la numeración no existe en esa cuadra", "no encontré el domicilio"},
		domain.MotivoRechazado:           {"dice que no hizo el pedido", "no quiso recibirlo"},
	}
)

// resolver hace lo que haría el repartidor en la puerta: entrega con firma y
// foto (a veces la recibe otra persona) o registra una incidencia.
func (s *SimuladorGPS) resolver(ctx context.Context, v repository.VehiculoEnRuta, par repository.ParadaSimulada) {
	actor := v.RepartidorID
	if par.Estado == domain.EstadoEnvioAsignado {
		// La ruta se inició sin sacar este envío (por ejemplo, desde la app, de a uno): sale ahora.
		if _, err := s.entregas.CambiarEstado(ctx, par.EnvioID, domain.EstadoEnvioEnCamino, actor, domain.RolRepartidor); err != nil {
			log.Printf("simulador: en camino %s: %v", par.EnvioID, err)
			return
		}
	}
	if s.rnd.Float64() < s.ProbFallo {
		motivo := motivosSimulados[s.rnd.IntN(len(motivosSimulados))]
		lista := comentariosSimulado[motivo]
		comentario := lista[s.rnd.IntN(len(lista))]
		if _, err := s.entregas.RegistrarIncidencia(ctx, par.EnvioID, motivo, comentario, nil, actor, domain.RolRepartidor); err != nil {
			log.Printf("simulador: incidencia %s: %v", par.EnvioID, err)
			return
		}
		log.Printf("simulador: %s no pudo entregar %s (%s)", v.Posicion.Patente, par.EnvioID, motivo)
		return
	}
	receptor, relacion := par.Destinatario, "destinatario"
	if s.rnd.Float64() < 0.2 {
		relacion = relacionesReceptor[s.rnd.IntN(len(relacionesReceptor))]
		apellido := ""
		if partes := strings.Fields(par.Destinatario); len(partes) > 1 && relacion == "familiar" {
			apellido = " " + partes[len(partes)-1]
		} else {
			apellido = " " + []string{"Gómez", "Ferreyra", "Molina", "Suárez"}[s.rnd.IntN(4)]
		}
		receptor = nombresReceptor[s.rnd.IntN(len(nombresReceptor))] + apellido
	}
	if strings.TrimSpace(receptor) == "" {
		receptor = "Titular"
	}
	firma, foto := imagenes.Variante(s.rnd.IntN(imagenes.Variantes))
	if _, err := s.entregas.ConfirmarEntrega(ctx, par.EnvioID, receptor, relacion, firma, foto, actor, domain.RolRepartidor); err != nil {
		log.Printf("simulador: entrega %s: %v", par.EnvioID, err)
		return
	}
	log.Printf("simulador: %s entregó %s a %s", v.Posicion.Patente, par.EnvioID, receptor)
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
	paradas := append([]repository.ParadaSimulada(nil), v.Paradas...)
	return &planSimulado{
		clave: clave, linea: rec.Geometria, largo: geo.Largo(rec.Geometria),
		vehiculo: v, paradas: paradas, marcas: marcasParadas(rec.Geometria, paradas),
	}, nil
}

// marcasParadas ubica cada parada sobre la línea (distancia desde el
// inicio): el vértice más cercano, buscando hacia adelante desde la anterior.
func marcasParadas(linea []geo.Punto, paradas []repository.ParadaSimulada) []float64 {
	acum := make([]float64, len(linea))
	for i := 1; i < len(linea); i++ {
		acum[i] = acum[i-1] + geo.DistanciaM(linea[i-1], linea[i])
	}
	out := make([]float64, len(paradas))
	desde := 0
	for i, p := range paradas {
		destino := geo.Punto{Lat: p.Lat, Lng: p.Lng}
		mejor, min := desde, math.Inf(1)
		for j := desde; j < len(linea); j++ {
			if d := geo.DistanciaM(linea[j], destino); d < min {
				mejor, min = j, d
			}
		}
		if len(linea) > 0 {
			out[i] = acum[mejor]
		}
		desde = mejor
	}
	return out
}

// tramoAlDeposito arma la vuelta al depósito al terminar la ruta.
func (s *SimuladorGPS) tramoAlDeposito(ctx context.Context, plan *planSimulado) (*planSimulado, error) {
	desde := geo.Punto{Lat: plan.vehiculo.Posicion.Lat, Lng: plan.vehiculo.Posicion.Lng}
	rec, err := s.router.Recorrido(ctx, []geo.Punto{desde, s.Deposito})
	if err != nil {
		return nil, err
	}
	return &planSimulado{linea: rec.Geometria, largo: geo.Largo(rec.Geometria), regreso: true, final: true, vehiculo: plan.vehiculo, rumbo: plan.rumbo}, nil
}

// siguienteVuelta arma el próximo tramo cuando el vehículo terminó el
// actual: de la última parada vuelve al depósito y, desde el depósito, sale
// otra vez por las paradas pendientes.
func (s *SimuladorGPS) siguienteVuelta(ctx context.Context, v repository.VehiculoEnRuta, actual *planSimulado) (*planSimulado, error) {
	if actual.regreso {
		return s.planificar(ctx, v, actual.clave)
	}
	desde := geo.Punto{Lat: v.Posicion.Lat, Lng: v.Posicion.Lng}
	rec, err := s.router.Recorrido(ctx, []geo.Punto{desde, s.Deposito})
	if err != nil {
		return nil, err
	}
	return &planSimulado{clave: actual.clave, linea: rec.Geometria, largo: geo.Largo(rec.Geometria), regreso: true}, nil
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
