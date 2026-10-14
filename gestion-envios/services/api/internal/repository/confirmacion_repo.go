package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
)

// ConfirmacionRepo accede a la tabla confirmaciones_entrega (migración 0004;
// HU-08). Una fila por envío entregado (PK = envio_id).
type ConfirmacionRepo struct {
	pool *pgxpool.Pool
}

// NewConfirmacionRepo crea un ConfirmacionRepo sobre el pool dado.
func NewConfirmacionRepo(pool *pgxpool.Pool) *ConfirmacionRepo {
	return &ConfirmacionRepo{pool: pool}
}

// Guardar inserta la evidencia de entrega de un envío (firma PNG y foto JPEG
// como BYTEA). q puede ser el pool o una transacción (la confirmación de
// HU-08 guarda la evidencia dentro de la misma tx que el UPDATE de estado).
// La PK envio_id impide la doble confirmación: una segunda inserción falla
// por constraint (red de seguridad; el service chequea el estado antes).
func (r *ConfirmacionRepo) Guardar(ctx context.Context, q Querier, c domain.Confirmacion) error {
	_, err := q.Exec(ctx, `
		INSERT INTO confirmaciones_entrega (envio_id, receptor_nombre, receptor_relacion, firma, foto, confirmada_por)
		VALUES ($1, $2, $3::relacion_receptor, $4, $5, $6::uuid)
	`, c.EnvioID, c.ReceptorNombre, c.ReceptorRelacion, c.Firma, c.Foto, c.ConfirmadaPor)
	return err
}

// Obtener devuelve la evidencia de entrega de un envío, con confirmada_at en
// UTC (to_char ... "Z", como los eventos). Sin fila devuelve
// ErrNoEncontrado (sirve al detalle y a los binarios).
func (r *ConfirmacionRepo) Obtener(ctx context.Context, envioID string) (domain.Confirmacion, error) {
	var c domain.Confirmacion
	var confirmadaPor sql.NullString
	err := r.pool.QueryRow(ctx, `
		SELECT envio_id, receptor_nombre, receptor_relacion, firma, foto, confirmada_por,
		       to_char(confirmada_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM confirmaciones_entrega
		WHERE envio_id = $1
	`, envioID).Scan(&c.EnvioID, &c.ReceptorNombre, &c.ReceptorRelacion, &c.Firma, &c.Foto, &confirmadaPor, &c.ConfirmadaAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Confirmacion{}, ErrNoEncontrado
		}
		return domain.Confirmacion{}, err
	}
	if confirmadaPor.Valid {
		c.ConfirmadaPor = &confirmadaPor.String
	}
	return c, nil
}
