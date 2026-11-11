package services

import (
	"context"
	"log"
	"math"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
)

// Tiempo que se estima por cada parada que el vehículo tiene antes que esta.
const minutosPorParada = 7

// Radio alrededor del destino que el tracking público no dibuja (privacidad).
const radioPrivadoM = 150

// TrackingService resuelve el tracking público por código de guía (HU-10):
// estado actual, localidad e historial con descripciones legibles. Solo
// maneja columnas blancas (las del TrackingRepo): jamás toca teléfonos,
// emails, dirección exacta, repartidor, comentarios ni actor.
type TrackingService struct {
	tracking *repository.TrackingRepo
	flota    *FlotaService
	ahora    func() time.Time
}

// NewTrackingService crea un TrackingService.
func NewTrackingService(tracking *repository.TrackingRepo) *TrackingService {
	return &TrackingService{tracking: tracking, ahora: time.Now}
}

// ConFlota habilita el seguimiento en vivo (vehículo, recorrido y hora estimada).
func (s *TrackingService) ConFlota(f *FlotaService) *TrackingService {
	s.flota = f
	return s
}

// describirEvento mapea un evento del historial a su descripción legible
// para el cliente final (función pura, sin DB). Textos exactos del plan de
// HU-10 (Task 2): anterior==nil es el evento raíz ("Envío registrado").
// Usa las consts de estado/motivo del domain, no strings hardcodeados.
func describirEvento(anterior *string, nuevo string, motivo *string) string {
	if anterior == nil {
		return "Envío registrado"
	}
	switch nuevo {
	case domain.EstadoEnvioAsignado:
		return "Asignado a ruta de reparto"
	case domain.EstadoEnvioEnCamino:
		return "En camino"
	case domain.EstadoEnvioEntregado:
		return "Entregado"
	case domain.EstadoEnvioNoEntregado:
		if motivo == nil {
			return "No se pudo entregar: motivo no especificado"
		}
		return "No se pudo entregar: " + motivoLegible(*motivo)
	case domain.EstadoEnvioPendiente:
		switch *anterior {
		case domain.EstadoEnvioNoEntregado:
			return "Reprogramado para un nuevo intento"
		case domain.EstadoEnvioAsignado:
			return "Desasignado de la ruta de reparto"
		default:
			return "Actualización de estado"
		}
	default:
		return "Actualización de estado"
	}
}

// motivoLegible traduce un motivo de fallo de entrega a texto para el
// cliente final (textos exactos del plan de HU-10, Task 2, con tildes).
func motivoLegible(m string) string {
	switch m {
	case domain.MotivoClienteAusente:
		return "cliente ausente"
	case domain.MotivoDireccionIncorrecta:
		return "dirección incorrecta"
	case domain.MotivoRechazado:
		return "rechazado por el destinatario"
	case domain.MotivoZonaInsegura:
		return "zona insegura"
	case domain.MotivoOtro:
		return "otro motivo"
	default:
		return m
	}
}

// PorCodigo devuelve el tracking público del envío con ese código EXACTO
// (match exacto, sin normalizar). actualizado_en es la fecha del ÚLTIMO
// evento, o la creación si todavía no hay eventos. El motivo viaja tal
// cual (puede ser nil → se omite en el JSON por omitempty). Código
// inexistente → repository.ErrNoEncontrado (el handler lo mapea al 404
// genérico del openapi). El historial nunca es nil: serializa como [].
func (s *TrackingService) PorCodigo(ctx context.Context, codigo string) (domain.TrackingResponse, error) {
	envioID, codigoGuia, estado, localidad, creadoEn, err := s.tracking.PorCodigo(ctx, codigo)
	if err != nil {
		return domain.TrackingResponse{}, err
	}
	eventos, err := s.tracking.EventosBlancos(ctx, envioID)
	if err != nil {
		return domain.TrackingResponse{}, err
	}

	historial := make([]domain.TrackingEvento, 0, len(eventos))
	for _, e := range eventos {
		historial = append(historial, domain.TrackingEvento{
			Fecha:       e.Fecha,
			Descripcion: describirEvento(e.EstadoAnterior, e.EstadoNuevo, e.Motivo),
			Motivo:      e.Motivo,
		})
	}

	actualizadoEn := creadoEn
	if len(eventos) > 0 {
		actualizadoEn = eventos[len(eventos)-1].Fecha
	}

	resp := domain.TrackingResponse{
		CodigoGuia:    codigoGuia,
		Estado:        estado,
		Localidad:     localidad,
		ActualizadoEn: actualizadoEn,
		Historial:     historial,
	}
	for _, e := range eventos {
		if e.EstadoNuevo == domain.EstadoEnvioEntregado {
			resp.EntregadoEn = e.Fecha
		}
	}

	datos, err := s.tracking.DatosPublicos(ctx, envioID)
	if err != nil {
		return domain.TrackingResponse{}, err
	}
	resp.FechaEntrega, resp.Franja = datos.FechaEntrega, datos.Franja
	resp.Paquete = &domain.TrackingPaquete{Peso: datos.Peso, Tamano: datos.Tamano, Fragil: datos.Fragil, Urgente: datos.Urgente}

	enReparto := estado == domain.EstadoEnvioAsignado || estado == domain.EstadoEnvioEnCamino
	if s.flota != nil && enReparto && datos.FechaEntrega <= FechaAR(s.ahora()) {
		vivo, err := s.enVivo(ctx, envioID)
		if err != nil {
			// El seguimiento es un extra: si falla, el tracking igual responde.
			log.Printf("tracking %s: sin seguimiento en vivo: %v", codigoGuia, err)
		}
		resp.EnVivo = vivo
	}
	return resp, nil
}

// enVivo arma el seguimiento del envío: vehículo, recorrido recortado y ETA.
func (s *TrackingService) enVivo(ctx context.Context, envioID string) (*domain.TrackingEnVivo, error) {
	t, err := s.flota.Trayecto(ctx, envioID, "", domain.RolOperador)
	if err != nil || t.Vehiculo == nil {
		return nil, err
	}
	v, err := s.flota.Vehiculo(ctx, t.Vehiculo.VehiculoID)
	if err != nil {
		return nil, err
	}
	vivo := &domain.TrackingEnVivo{
		Vehiculo: domain.TrackingVehiculo{
			Tipo: v.Tipo, Modelo: v.Modelo, Color: v.Color, Patente: PatenteParcial(v.Patente),
			Lat: t.Vehiculo.Lat, Lng: t.Vehiculo.Lng, Rumbo: t.Vehiculo.Rumbo, Velocidad: t.Vehiculo.Velocidad,
			En: t.Vehiculo.En.UTC().Format(time.RFC3339),
		},
		ParadasAntes: t.ParadasAntes,
	}
	if t.Destino != nil {
		vivo.Destino = &domain.Coordenadas{Lat: redondear3(t.Destino.Lat), Lng: redondear3(t.Destino.Lng)}
		vivo.Recorrido = RecortarRecorrido(t.Recorrido, *t.Destino, radioPrivadoM)
	}
	if t.Recorrido != nil && PosicionVigente(s.ahora(), t.Vehiculo.En) {
		desde, hasta, minutos := VentanaLlegada(s.ahora(), t.Recorrido.DuracionS, t.ParadasAntes)
		vivo.EtaDesde, vivo.EtaHasta, vivo.EtaMinutos = desde.UTC().Format(time.RFC3339), hasta.UTC().Format(time.RFC3339), minutos
	}
	return vivo, nil
}

// VentanaLlegada estima cuándo llega el vehículo: manejo + un tiempo fijo por
// cada parada previa, con un margen que crece con las paradas (más paradas,
// más incertidumbre). Devuelve la ventana y los minutos hasta su centro.
func VentanaLlegada(ahora time.Time, duracionS float64, paradasAntes int) (time.Time, time.Time, int) {
	total := time.Duration(duracionS)*time.Second + time.Duration(paradasAntes*minutosPorParada)*time.Minute
	margen := time.Duration(10+3*paradasAntes) * time.Minute
	centro := ahora.Add(total)
	minutos := int(math.Ceil(total.Minutes()))
	if minutos < 1 {
		minutos = 1
	}
	desde := centro.Add(-margen / 2)
	if desde.Before(ahora) {
		desde = ahora
	}
	// Truncar al minuto puede dejar el inicio hasta 59 s antes de ahora (H27):
	// en ese caso se redondea al minuto siguiente.
	desde = desde.Truncate(time.Minute)
	if desde.Before(ahora) {
		desde = desde.Add(time.Minute)
	}
	return desde, centro.Add(margen / 2).Truncate(time.Minute), minutos
}

// maxAntiguedadPosicion es cuánto puede tener la última posición del vehículo
// para seguir estimando la llegada.
const maxAntiguedadPosicion = 15 * time.Minute

// PosicionVigente indica si la última posición del vehículo es lo bastante
// reciente para calcular una ETA (H37): con una posición vieja no se promete
// un horario de llegada.
func PosicionVigente(ahora, posicionEn time.Time) bool {
	if posicionEn.IsZero() {
		return false
	}
	return ahora.Sub(posicionEn) <= maxAntiguedadPosicion
}

// PatenteParcial deja ver el principio y el final de la patente: AB•••CD.
func PatenteParcial(p string) string {
	r := []rune(p)
	if len(r) <= 4 {
		return p
	}
	return string(r[:2]) + "•••" + string(r[len(r)-2:])
}

func redondear3(x float64) float64 { return math.Round(x*1000) / 1000 }

// RecortarRecorrido saca del final de la polilínea los puntos a menos de
// radioM del destino y la cierra en el destino redondeado: el mapa público
// muestra hacia dónde va el vehículo sin marcar la casa.
func RecortarRecorrido(r *domain.RecorridoMapa, destino domain.Coordenadas, radioM float64) *domain.RecorridoMapa {
	if r == nil {
		return nil
	}
	dest := geo.Punto{Lat: destino.Lat, Lng: destino.Lng}
	geom := make([][2]float64, 0, len(r.Geometria))
	for _, p := range r.Geometria {
		if geo.DistanciaM(geo.Punto{Lat: p[0], Lng: p[1]}, dest) >= radioM {
			geom = append(geom, p)
		}
	}
	geom = append(geom, [2]float64{redondear3(destino.Lat), redondear3(destino.Lng)})
	return &domain.RecorridoMapa{Geometria: geom, DistanciaM: r.DistanciaM, DuracionS: r.DuracionS}
}
