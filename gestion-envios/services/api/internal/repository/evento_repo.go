package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
)

// EventoRepo accede a la tabla eventos_envio (migración 0003; HU-06/HU-07).
type EventoRepo struct {
	pool *pgxpool.Pool
}

// NewEventoRepo crea un EventoRepo sobre el pool dado.
func NewEventoRepo(pool *pgxpool.Pool) *EventoRepo {
	return &EventoRepo{pool: pool}
}

// Registrar inserta un evento del historial de un envío. Los parámetros
// nil se guardan como NULL (evento raíz con anterior NULL, sistema o
// backfill con actor NULL, transición sin motivo/comentario/foto). q puede
// ser el pool o una transacción (las operaciones de HU-06/HU-07 registran
// el evento dentro de la misma tx que el UPDATE de estado). La foto (BYTEA,
// migración 0005, HU-07) solo se usa en incidencias: nil → NULL = sin foto.
func (r *EventoRepo) Registrar(ctx context.Context, q Querier, envioID string, anterior *string, nuevo string, motivo *string, comentario *string, actorID *string, foto []byte) error {
	_, err := q.Exec(ctx, `
		INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, motivo, comentario, actor_id, foto)
		VALUES ($1, $2::estado_envio, $3::estado_envio, $4::motivo_fallo, $5, $6::uuid, $7)
	`, envioID, anterior, nuevo, motivo, comentario, actorID, foto)
	return err
}

// ListarPorEnvio devuelve el historial de un envío ordenado de más viejo a
// más nuevo, con el nombre del actor (NULL si el evento no tiene actor) y
// el flag tiene_foto (foto IS NOT NULL: false en eventos viejos o sin
// foto, nunca null). Devuelve un slice inicializado: sin eventos es [] y
// no nil, para que serialice como `"historial": []` y no como null.
func (r *EventoRepo) ListarPorEnvio(ctx context.Context, envioID string) ([]domain.EventoEnvio, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT ev.id, to_char(ev.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
		       u.nombre, ev.estado_anterior, ev.estado_nuevo, ev.motivo, ev.comentario,
		       (ev.foto IS NOT NULL) AS tiene_foto
		FROM eventos_envio ev
		LEFT JOIN usuarios u ON u.id = ev.actor_id
		WHERE ev.envio_id = $1
		ORDER BY ev.created_at, ev.id
	`, envioID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	historial := make([]domain.EventoEnvio, 0)
	for rows.Next() {
		var e domain.EventoEnvio
		var actorNombre, anterior, motivo, comentario sql.NullString
		if err := rows.Scan(&e.ID, &e.Fecha, &actorNombre, &anterior, &e.EstadoNuevo, &motivo, &comentario, &e.TieneFoto); err != nil {
			return nil, err
		}
		if actorNombre.Valid {
			e.ActorNombre = &actorNombre.String
		}
		if anterior.Valid {
			e.EstadoAnterior = &anterior.String
		}
		if motivo.Valid {
			e.Motivo = &motivo.String
		}
		if comentario.Valid {
			e.Comentario = &comentario.String
		}
		historial = append(historial, e)
	}
	return historial, rows.Err()
}

// ObtenerFoto devuelve la foto de un evento de incidencia (columna foto,
// migración 0005, HU-07) junto al ID del envío al que pertenece (para que
// el service verifique que el evento es de ese envío). Sin fila o con foto
// NULL/vacía devuelve ErrNoEncontrado: sirve al binario
// GET /envios/{id}/eventos/{eventoId}/foto.
func (r *EventoRepo) ObtenerFoto(ctx context.Context, eventoID string) (foto []byte, envioID string, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT foto, envio_id
		FROM eventos_envio
		WHERE id = $1
	`, eventoID).Scan(&foto, &envioID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", ErrNoEncontrado
		}
		return nil, "", err
	}
	if len(foto) == 0 {
		return nil, "", ErrNoEncontrado
	}
	return foto, envioID, nil
}

// EsDelRepartidor indica si el envío pertenece a CUALQUIERA de las rutas de
// repartidorID (sin filtro de fecha, por decisión del plan de HU-06/HU-07:
// el "del día" lo gobierna el listado de HU-05; acá el guard es no tocar
// envíos ajenos). Un envío sin ruta o de otro repartidor devuelve false.
func (r *EventoRepo) EsDelRepartidor(ctx context.Context, envioID, repartidorID string) (bool, error) {
	var pertenece bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM envios e
			JOIN rutas r ON r.id = e.ruta_id
			WHERE e.id = $1 AND r.repartidor_id = $2
		)
	`, envioID, repartidorID).Scan(&pertenece)
	return pertenece, err
}
