package services

import (
	"bytes"
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
	// ErrFechaInvalida indica que la nueva fecha de reprogramación (HU-09)
	// tiene mal formato o es pasada (solo valen hoy o futuras).
	ErrFechaInvalida = errors.New("fecha de reprogramación inválida")
	// ErrFranjaInvalida indica que la franja no está en {manana, tarde, noche}.
	ErrFranjaInvalida = errors.New("franja horaria inválida")
	// ErrEvidenciaIncompleta indica que falta el nombre del receptor o alguna
	// de las imágenes (firma/foto) en la confirmación de entrega (HU-08).
	ErrEvidenciaIncompleta = errors.New("evidencia de entrega incompleta")
	// ErrRelacionInvalida indica que la relación del receptor no está en la
	// lista cerrada {destinatario, familiar, vecino, encargado} (HU-08).
	ErrRelacionInvalida = errors.New("relación del receptor inválida")
	// ErrImagenInvalida indica que una imagen no decodifica o sus magic bytes
	// no corresponden (firma PNG, foto JPEG). La reutiliza la foto de
	// incidencia de HU-07 (Task 5 del plan de HU-08).
	ErrImagenInvalida = errors.New("imagen inválida")
	// ErrImagenMuyGrande indica que una imagen decodificada supera
	// MaxImagenBytes (5 MB). La reutiliza la foto de incidencia (Task 5).
	ErrImagenMuyGrande = errors.New("imagen demasiado grande")
)

// transicionesValidas es la matriz de transiciones de HU-06 (+ HU-08/HU-09):
// el repartidor alterna entre asignado y en_camino, y desde cualquiera de
// esos dos estados puede confirmar la entrega (→ entregado, endpoint propio
// POST /envios/{id}/confirmacion, HU-08). HU-09 agrega la salida de
// no_entregado a pendiente (reprogramación, endpoint propio
// POST /envios/{id}/reprogramacion: PUT /envios/{id}/estado la rechaza
// por su vocabulario con estado_invalido antes de llegar a la matriz).
var transicionesValidas = map[string][]string{
	domain.EstadoEnvioAsignado:    {domain.EstadoEnvioEnCamino, domain.EstadoEnvioEntregado},
	domain.EstadoEnvioEnCamino:    {domain.EstadoEnvioAsignado, domain.EstadoEnvioEntregado},
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

// EstadoService contiene la lógica de negocio de HU-06/HU-07/HU-08:
// cambios de estado (asignado ⇄ en_camino), incidencias (→ no_entregado
// con motivo) y confirmaciones de entrega (→ entregado con evidencia).
// Cada operación actualiza el estado y registra el evento en una misma
// transacción (todo o nada, como la asignación de HU-04).
type EstadoService struct {
	pool           *pgxpool.Pool
	envios         *repository.EnvioRepo
	eventos        *repository.EventoRepo
	confirmaciones *repository.ConfirmacionRepo
}

// NewEstadoService crea un EstadoService. confirmaciones es obligatorio
// (evidencia de entrega, HU-08); se inyecta por constructor.
func NewEstadoService(pool *pgxpool.Pool, envios *repository.EnvioRepo, eventos *repository.EventoRepo, confirmaciones *repository.ConfirmacionRepo) *EstadoService {
	return &EstadoService{pool: pool, envios: envios, eventos: eventos, confirmaciones: confirmaciones}
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
	if err := s.eventos.Registrar(ctx, tx, envioID, &anterior, nuevo, nil, nil, actorIDPtr(actorID), nil); err != nil {
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
// lista cerrada (HU-07) y registra el evento con motivo/comentario/foto, en
// una sola transacción. Solo vale sobre envíos asignados o en_camino. La
// foto es opcional (CA-03 HU-07, columna foto de la migración 0005): nil o
// vacía → NULL (sin foto); si viene, debe ser JPEG (magic bytes FF D8 FF)
// y no superar MaxImagenBytes (5 MB).
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
	if len(foto) > domain.MaxImagenBytes {
		return domain.Envio{}, ErrImagenMuyGrande
	}
	if len(foto) > 0 && !bytes.HasPrefix(foto, fotoJPEG) {
		return domain.Envio{}, ErrImagenInvalida
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
	if err := s.eventos.Registrar(ctx, tx, envioID, &anterior, domain.EstadoEnvioNoEntregado, motivoPtr, comentarioPtr, actorIDPtr(actorID), foto); err != nil {
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
	if err := s.eventos.Registrar(ctx, tx, envioID, &anterior, domain.EstadoEnvioPendiente, nil, &comentario, actorIDPtr(actorID), nil); err != nil {
		return domain.Envio{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Envio{}, err
	}

	detalle.Estado = domain.EstadoEnvioPendiente
	return detalle.Envio, nil
}

// relacionValida indica si la relación del receptor está en la lista
// cerrada de HU-08.
func relacionValida(relacion string) bool {
	switch relacion {
	case domain.RelacionDestinatario,
		domain.RelacionFamiliar,
		domain.RelacionVecino,
		domain.RelacionEncargado:
		return true
	default:
		return false
	}
}

// firmaPNG es el magic number PNG (la firma de HU-08 es image/png).
var firmaPNG = []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}

// fotoJPEG es el magic number JPEG (la foto de HU-08 es image/jpeg).
var fotoJPEG = []byte{0xFF, 0xD8, 0xFF}

// ConfirmarEntrega registra la entrega de un envío (HU-08): lo pasa a
// entregado con su evidencia (receptor + firma PNG + foto JPEG) y el/los
// evento(s) del historial, en una sola transacción (todo o nada, como las
// demás operaciones del service). Solo vale sobre envíos asignados o
// en_camino. Si el rol es repartidor, el envío debe pertenecer a una de
// sus rutas; si no (ajeno o inexistente) devuelve
// repository.ErrNoEncontrado.
//
// Los []byte YA vienen decodificados (el handler valida el base64 en
// Task 3): el service valida tamaño (MaxImagenBytes) y magic bytes.
// actorID vacío equivale a confirmada_por NULL (patrón actorIDPtr).
func (s *EstadoService) ConfirmarEntrega(ctx context.Context, envioID, receptorNombre, receptorRelacion string, firma, foto []byte, actorID, rol string) (domain.Envio, error) {
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
	if strings.TrimSpace(receptorNombre) == "" || len(firma) == 0 || len(foto) == 0 {
		return domain.Envio{}, ErrEvidenciaIncompleta
	}
	if !relacionValida(receptorRelacion) {
		return domain.Envio{}, ErrRelacionInvalida
	}
	if len(firma) > domain.MaxImagenBytes || len(foto) > domain.MaxImagenBytes {
		return domain.Envio{}, ErrImagenMuyGrande
	}
	if !bytes.HasPrefix(firma, firmaPNG) || !bytes.HasPrefix(foto, fotoJPEG) {
		return domain.Envio{}, ErrImagenInvalida
	}
	if detalle.Estado != domain.EstadoEnvioAsignado && detalle.Estado != domain.EstadoEnvioEnCamino {
		return domain.Envio{}, fmt.Errorf("no se puede confirmar la entrega de un envío en estado %q: %w", detalle.Estado, ErrTransicionInvalida)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Envio{}, err
	}
	defer tx.Rollback(ctx) // no-op si ya se hizo commit

	if err := s.envios.ActualizarEstado(ctx, tx, envioID, domain.EstadoEnvioEntregado); err != nil {
		return domain.Envio{}, err
	}
	repo := s.confirmaciones
	if err := repo.Guardar(ctx, tx, domain.Confirmacion{
		EnvioID:          envioID,
		ReceptorNombre:   receptorNombre,
		ReceptorRelacion: receptorRelacion,
		Firma:            firma,
		Foto:             foto,
		ConfirmadaPor:    actorIDPtr(actorID),
	}); err != nil {
		return domain.Envio{}, err
	}
	actor := actorIDPtr(actorID)
	if detalle.Estado == domain.EstadoEnvioAsignado {
		// Confirmación directa: el envío pasa por en_camino en el
		// historial (DOS eventos) aunque nunca estuvo en ese estado.
		asignado := domain.EstadoEnvioAsignado
		enCamino := domain.EstadoEnvioEnCamino
		comentario := "paso por en_camino (confirmación directa)"
		if err := s.eventos.Registrar(ctx, tx, envioID, &asignado, domain.EstadoEnvioEnCamino, nil, &comentario, actor, nil); err != nil {
			return domain.Envio{}, err
		}
		if err := s.eventos.Registrar(ctx, tx, envioID, &enCamino, domain.EstadoEnvioEntregado, nil, nil, actor, nil); err != nil {
			return domain.Envio{}, err
		}
	} else {
		anterior := detalle.Estado
		if err := s.eventos.Registrar(ctx, tx, envioID, &anterior, domain.EstadoEnvioEntregado, nil, nil, actor, nil); err != nil {
			return domain.Envio{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Envio{}, err
	}

	detalle.Estado = domain.EstadoEnvioEntregado
	return detalle.Envio, nil
}

// ObtenerConfirmacion devuelve la evidencia de entrega de un envío (HU-08:
// sirve a los binarios GET /envios/{id}/confirmacion/firma y /foto). Si el
// rol es repartidor, el envío debe pertenecer a una de sus rutas; si no
// (ajeno o inexistente) devuelve repository.ErrNoEncontrado. Sin
// confirmación (envío no entregado por esta vía) también devuelve
// repository.ErrNoEncontrado: el handler lo mapea a 404 no_encontrado
// (envelope JSON, nunca binario). El guard va primero para no filtrar la
// existencia de evidencia ajena.
func (s *EstadoService) ObtenerConfirmacion(ctx context.Context, envioID, actorID, rol string) (domain.Confirmacion, error) {
	if rol == domain.RolRepartidor {
		pertenece, err := s.eventos.EsDelRepartidor(ctx, envioID, actorID)
		if err != nil {
			return domain.Confirmacion{}, err
		}
		if !pertenece {
			return domain.Confirmacion{}, repository.ErrNoEncontrado
		}
	}
	return s.confirmaciones.Obtener(ctx, envioID)
}
