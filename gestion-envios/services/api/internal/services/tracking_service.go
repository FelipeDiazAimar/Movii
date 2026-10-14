package services

import (
	"context"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// TrackingService resuelve el tracking público por código de guía (HU-10):
// estado actual, localidad e historial con descripciones legibles. Solo
// maneja columnas blancas (las del TrackingRepo): jamás toca teléfonos,
// emails, dirección exacta, repartidor, comentarios ni actor.
type TrackingService struct {
	tracking *repository.TrackingRepo
}

// NewTrackingService crea un TrackingService.
func NewTrackingService(tracking *repository.TrackingRepo) *TrackingService {
	return &TrackingService{tracking: tracking}
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

	return domain.TrackingResponse{
		CodigoGuia:    codigoGuia,
		Estado:        estado,
		Localidad:     localidad,
		ActualizadoEn: actualizadoEn,
		Historial:     historial,
	}, nil
}
