package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EventoBlanco es una fila de eventos_envio con SOLO columnas blancas
// (HU-10): fecha, estado_anterior, estado_nuevo y motivo. SIN actor, SIN
// comentario, SIN foto: el struct ni siquiera tiene esos campos, así el
// tracking público no puede filtrarlos ni por accidente (garantía en
// tiempo de compilación, doble barrera junto con el SELECT explícito).
//
// NOTA sobre el plan (Task 2): lo nombra `eventoBlanco` en minúscula, pero
// el TrackingService vive en otro package (internal/services) y un tipo no
// exportado no cruza packages — se exporta el tipo y sus campos.
type EventoBlanco struct {
	Fecha          string
	EstadoAnterior *string
	EstadoNuevo    string
	Motivo         *string
}

// TrackingRepo accede a los datos del tracking público (HU-10). Solo lee
// columnas blancas: jamás teléfonos, emails, dirección exacta, repartidor,
// comentarios internos, actor ni fotos.
type TrackingRepo struct {
	pool *pgxpool.Pool
}

// NewTrackingRepo crea un TrackingRepo sobre el pool dado.
func NewTrackingRepo(pool *pgxpool.Pool) *TrackingRepo {
	return &TrackingRepo{pool: pool}
}

// PorCodigo devuelve el id, código de guía, estado, localidad y fecha de
// creación (UTC) del envío con ese código EXACTO (sin normalizar, sin
// sugerencias). Devuelve ErrNoEncontrado si no existe.
//
// NOTA sobre el plan (Task 2): la firma del plan devuelve solo las 4
// columnas blancas, pero el service necesita el id del envío para pedir
// los eventos (EventosBlancos recibe envioID) — se agrega envioID como
// primer retorno en vez de una segunda query por código.
func (r *TrackingRepo) PorCodigo(ctx context.Context, codigo string) (envioID, codigoGuia, estado, localidad, creadoEn string, err error) {
	err = r.pool.QueryRow(ctx, `
		SELECT e.id, e.codigo_guia, e.estado, d.localidad,
		       to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM envios e
		JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE e.codigo_guia = $1
	`, codigo).Scan(&envioID, &codigoGuia, &estado, &localidad, &creadoEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", "", "", ErrNoEncontrado
	}
	if err != nil {
		return "", "", "", "", "", err
	}
	return envioID, codigoGuia, estado, localidad, creadoEn, nil
}

// EventosBlancos devuelve el historial del envío con solo columnas blancas
// (fecha UTC, estado_anterior, estado_nuevo, motivo), ordenado de más viejo
// a más nuevo. Devuelve un slice inicializado: sin eventos es [] y no nil,
// para que serialice como `"historial": []` y no como null.
func (r *TrackingRepo) EventosBlancos(ctx context.Context, envioID string) ([]EventoBlanco, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
		       estado_anterior, estado_nuevo, motivo
		FROM eventos_envio
		WHERE envio_id = $1
		ORDER BY created_at, id
	`, envioID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	eventos := make([]EventoBlanco, 0)
	for rows.Next() {
		var e EventoBlanco
		var anterior, motivo sql.NullString
		if err := rows.Scan(&e.Fecha, &anterior, &e.EstadoNuevo, &motivo); err != nil {
			return nil, err
		}
		if anterior.Valid {
			e.EstadoAnterior = &anterior.String
		}
		if motivo.Valid {
			e.Motivo = &motivo.String
		}
		eventos = append(eventos, e)
	}
	return eventos, rows.Err()
}
