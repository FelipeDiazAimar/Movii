package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// Errores centinela de HU-06/HU-07/HU-09. Los handlers los mapean a los códigos
// del openapi: ErrTransicionInvalida → 409 transicion_invalida,
// ErrMotivoInvalido → 400 motivo_invalido, ErrComentarioObligatorio → 400
// comentario_obligatorio, ErrFechaInvalida → 400 fecha_invalida,
// ErrFranjaInvalida → 400 franja_invalida.
var (
	ErrTransicionInvalida    = errors.New("transición de estado inválida")
	ErrMotivoInvalido        = errors.New("motivo de fallo inválido")
	ErrComentarioObligatorio = errors.New("el motivo 'otro' requiere un comentario")
	// ErrImagenNoSoportada indica que se adjuntó una foto a la incidencia.
	// La foto de incidencia (CA-03 HU-07, opcional) queda pendiente del
	// mecanismo de imágenes de HU-08/09; este plan la rechaza con
	// imagen_no_soportada (400) en vez de aceptarla en silencio.
	ErrImagenNoSoportada = errors.New("la incidencia con foto aún no está soportada")
	// ErrFechaInvalida indica que la nueva fecha de reprogramación (HU-09)
	// tiene mal formato o es pasada (solo valen hoy o futuras).
	ErrFechaInvalida = errors.New("fecha de reprogramación inválida")
	// ErrFranjaInvalida indica que la franja no está en {manana, tarde, noche}.
	ErrFranjaInvalida = errors.New("franja horaria inválida")
)

// transicionesValidas es la matriz de transiciones de HU-06: el repartidor
// alterna entre asignado y en_camino. HU-09 agrega la salida de
// no_entregado a pendiente (reprogramación, endpoint propio
// POST /envios/{id}/reprogramacion: PUT /envios/{id}/estado la rechaza
// por su vocabulario con estado_invalido antes de llegar a la matriz).
var transicionesValidas = map[string][]string{
	domain.EstadoEnvioAsignado:    {domain.EstadoEnvioEnCamino},
	domain.EstadoEnvioEnCamino:    {domain.EstadoEnvioAsignado},
	domain.EstadoEnvioNoEntregado: {domain.EstadoEnvioPendiente},
}

// transicionValida indica si se puede pasar del estado origen al destino
// según la matriz de HU-06.
func transicionValida(origen, destino string) bool {
	for _, d := range transicionesValidas[origen] {
		if d == destino {
			return true
		}
	}
	return false
}

// EstadoService contiene la lógica de negocio de HU-06/HU-07: cambios de
// estado (asignado ⇄ en_camino) e incidencias (→ no_entregado con motivo).
// Cada operación actualiza el estado y registra el evento en una misma
// transacción (todo o nada, como la asignación de HU-04).
type EstadoService struct {
	pool    *pgxpool.Pool
	envios  *repository.EnvioRepo
	eventos *repository.EventoRepo
}

// NewEstadoService crea un EstadoService.
func NewEstadoService(pool *pgxpool.Pool, envios *repository.EnvioRepo, eventos *repository.EventoRepo) *EstadoService {
	return &EstadoService{pool: pool, envios: envios, eventos: eventos}
}

// actorIDPtr convierte el actorID (string con UUID del usuario) al *string
// nullable de la columna actor_id: vacío equivale a NULL.
func actorIDPtr(actorID string) *string {
	if actorID == "" {
		return nil
	}
	return &actorID
}

// errorTransicionHU06 envuelve ErrTransicionInvalida con un mensaje que
// indica el endpoint correcto cuando el destino es un estado final: a
// entregado solo se llega por confirmación (HU-08) y a no_entregado solo
// por incidencia (HU-07). El %w mantiene errors.Is funcionando en el handler.
func errorTransicionHU06(nuevo string) error {
	switch nuevo {
	case domain.EstadoEnvioEntregado:
		return fmt.Errorf("el estado entregado solo se registra por confirmación de entrega (POST /envios/{id}/confirmacion, HU-08): %w", ErrTransicionInvalida)
	case domain.EstadoEnvioNoEntregado:
		return fmt.Errorf("el estado no_entregado solo se registra por incidencia (POST /envios/{id}/incidencia, HU-07): %w", ErrTransicionInvalida)
	default:
		return fmt.Errorf("transición de estado inválida hacia %q: %w", nuevo, ErrTransicionInvalida)
	}
}

// CambiarEstado mueve un envío al estado nuevo (HU-06: asignado ⇄ en_camino)
// y registra el evento en el historial, en una sola transacción.
// Si el rol es repartidor, el envío debe pertenecer a una de sus rutas;
// si no (ajeno o inexistente) devuelve repository.ErrNoEncontrado.
func (s *EstadoService) CambiarEstado(ctx context.Context, envioID, nuevo, actorID, rol string) (domain.Envio, error) {
	detalle, err := s.envios.GetByID(ctx, envioID)
	if err != nil {
		return domain.Envio{}, err
	}
	if rol == domain.RolRepartidor {
		pertenece, err := s.eventos.EsDelRepartidor(ctx, envioID, actorID)
		if err != nil {
			return domain.Envio{}, err
		}
		if !pertenece {
			return domain.Envio{}, repository.ErrNoEncontrado
		}
	}
	if !transicionValida(detalle.Estado, nuevo) {
		return domain.Envio{}, errorTransicionHU06(nuevo)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Envio{}, err
	}
	defer tx.Rollback(ctx) // no-op si ya se hizo commit

	if err := s.envios.ActualizarEstado(ctx, tx, envioID, nuevo); err != nil {
		return domain.Envio{}, err
	}
	anterior := detalle.Estado
	if err := s.eventos.Registrar(ctx, tx, envioID, &anterior, nuevo, nil, nil, actorIDPtr(actorID)); err != nil {
		return domain.Envio{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Envio{}, err
	}

	detalle.Estado = nuevo
	return detalle.Envio, nil
}

// motivoValido indica si el motivo está en la lista cerrada de HU-07.
func motivoValido(motivo string) bool {
	switch motivo {
	case domain.MotivoClienteAusente,
		domain.MotivoDireccionIncorrecta,
		domain.MotivoRechazado,
		domain.MotivoZonaInsegura,
		domain.MotivoOtro:
		return true
	default:
		return false
	}
}

// RegistrarIncidencia marca un envío como no_entregado con un motivo de la
// lista cerrada (HU-07) y registra el evento con motivo/comentario, en una
// sola transacción. Solo vale sobre envíos asignados o en_camino. La foto
// queda pendiente del mecanismo de HU-08/09: si se adjunta se rechaza con
// ErrImagenNoSoportada.
func (s *EstadoService) RegistrarIncidencia(ctx context.Context, envioID, motivo, comentario string, foto []byte, actorID, rol string) (domain.Envio, error) {
	detalle, err := s.envios.GetByID(ctx, envioID)
	if err != nil {
		return domain.Envio{}, err
	}
	if rol == domain.RolRepartidor {
		pertenece, err := s.eventos.EsDelRepartidor(ctx, envioID, actorID)
		if err != nil {
			return domain.Envio{}, err
		}
		if !pertenece {
			return domain.Envio{}, repository.ErrNoEncontrado
		}
	}
	if !motivoValido(motivo) {
		return domain.Envio{}, ErrMotivoInvalido
	}
	if motivo == domain.MotivoOtro && strings.TrimSpace(comentario) == "" {
		return domain.Envio{}, ErrComentarioObligatorio
	}
	if detalle.Estado != domain.EstadoEnvioAsignado && detalle.Estado != domain.EstadoEnvioEnCamino {
		return domain.Envio{}, fmt.Errorf("no se puede registrar una incidencia sobre un envío en estado %q: %w", detalle.Estado, ErrTransicionInvalida)
	}
	if len(foto) > 0 {
		return domain.Envio{}, ErrImagenNoSoportada
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Envio{}, err
	}
	defer tx.Rollback(ctx) // no-op si ya se hizo commit

	if err := s.envios.ActualizarEstado(ctx, tx, envioID, domain.EstadoEnvioNoEntregado); err != nil {
		return domain.Envio{}, err
	}
	anterior := detalle.Estado
	motivoPtr := &motivo
	var comentarioPtr *string
	if comentario != "" {
		comentarioPtr = &comentario
	}
	if err := s.eventos.Registrar(ctx, tx, envioID, &anterior, domain.EstadoEnvioNoEntregado, motivoPtr, comentarioPtr, actorIDPtr(actorID)); err != nil {
		return domain.Envio{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Envio{}, err
	}

	detalle.Estado = domain.EstadoEnvioNoEntregado
	return detalle.Envio, nil
}

// franjaValida indica si la franja está en el vocabulario cerrado de HU-09.
func franjaValida(franja string) bool {
	switch franja {
	case domain.FranjaManana,
		domain.FranjaTarde,
		domain.FranjaNoche:
		return true
	default:
		return false
	}
}

// Reprogramar vuelve un envío en estado no_entregado a pendiente para una
// nueva fecha + franja (HU-09) y registra el evento en el historial, en una
// sola transacción. Solo vale sobre no_entregado (endpoint propio
// POST /envios/{id}/reprogramacion). Si el rol es repartidor, el envío debe
// pertenecer a una de sus rutas; si no (ajeno o inexistente) devuelve
// repository.ErrNoEncontrado.
func (s *EstadoService) Reprogramar(ctx context.Context, envioID, nuevaFecha, franja, actorID, rol string) (domain.Envio, error) {
	detalle, err := s.envios.GetByID(ctx, envioID)
	if err != nil {
		return domain.Envio{}, err
	}
	if rol == domain.RolRepartidor {
		pertenece, err := s.eventos.EsDelRepartidor(ctx, envioID, actorID)
		if err != nil {
			return domain.Envio{}, err
		}
		if !pertenece {
			return domain.Envio{}, repository.ErrNoEncontrado
		}
	}
	parsed, err := time.Parse("2006-01-02", nuevaFecha)
	if err != nil {
		return domain.Envio{}, fmt.Errorf("fecha de reprogramación %q inválida: %w", nuevaFecha, ErrFechaInvalida)
	}
	hoy, _ := time.Parse("2006-01-02", time.Now().UTC().Format("2006-01-02"))
	if parsed.Before(hoy) {
		return domain.Envio{}, fmt.Errorf("fecha de reprogramación %q es pasada (solo valen hoy o futuras): %w", nuevaFecha, ErrFechaInvalida)
	}
	if !franjaValida(franja) {
		return domain.Envio{}, fmt.Errorf("franja horaria %q inválida: %w", franja, ErrFranjaInvalida)
	}
	if !transicionValida(detalle.Estado, domain.EstadoEnvioPendiente) {
		return domain.Envio{}, fmt.Errorf("no se puede reprogramar un envío en estado %q: %w", detalle.Estado, ErrTransicionInvalida)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Envio{}, err
	}
	defer tx.Rollback(ctx) // no-op si ya se hizo commit

	if err := s.envios.Reprogramar(ctx, tx, envioID, nuevaFecha, franja); err != nil {
		return domain.Envio{}, err
	}
	anterior := detalle.Estado
	comentario := fmt.Sprintf("reprogramado para %s (%s)", nuevaFecha, franja)
	if err := s.eventos.Registrar(ctx, tx, envioID, &anterior, domain.EstadoEnvioPendiente, nil, &comentario, actorIDPtr(actorID)); err != nil {
		return domain.Envio{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Envio{}, err
	}

	detalle.Estado = domain.EstadoEnvioPendiente
	return detalle.Envio, nil
}
