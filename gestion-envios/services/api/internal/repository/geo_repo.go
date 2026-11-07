package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DireccionDestinatario es la dirección postal de un destinatario a geocodificar.
type DireccionDestinatario struct {
	ID           string
	Calle        string
	Numero       string
	Localidad    string
	CodigoPostal string
}

// GeoRepo lee y guarda las coordenadas de los destinatarios (HU-12).
type GeoRepo struct {
	pool *pgxpool.Pool
}

// NewGeoRepo crea un GeoRepo.
func NewGeoRepo(pool *pgxpool.Pool) *GeoRepo {
	return &GeoRepo{pool: pool}
}

// Direccion devuelve la dirección de un destinatario. ErrNoEncontrado si no existe.
func (r *GeoRepo) Direccion(ctx context.Context, destinatarioID string) (DireccionDestinatario, error) {
	var d DireccionDestinatario
	err := r.pool.QueryRow(ctx, `
		SELECT id, calle, numero, localidad, codigo_postal FROM destinatarios WHERE id::text = $1
	`, destinatarioID).Scan(&d.ID, &d.Calle, &d.Numero, &d.Localidad, &d.CodigoPostal)
	if errors.Is(err, pgx.ErrNoRows) {
		return DireccionDestinatario{}, ErrNoEncontrado
	}
	return d, err
}

// DestinatarioDeEnvio devuelve el id del destinatario de un envío.
func (r *GeoRepo) DestinatarioDeEnvio(ctx context.Context, envioID string) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `SELECT destinatario_id FROM envios WHERE id::text = $1`, envioID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNoEncontrado
	}
	return id, err
}

// SinGeocodificar devuelve hasta `limite` destinatarios sin coordenadas o con
// coordenadas de demo (backfill aleatorio de la migración 0006).
func (r *GeoRepo) SinGeocodificar(ctx context.Context, limite int) ([]DireccionDestinatario, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, calle, numero, localidad, codigo_postal FROM destinatarios
		WHERE latitud IS NULL OR geo_fuente IS NULL OR geo_fuente IN ('demo', 'aproximada')
		ORDER BY created_at DESC
		LIMIT $1
	`, limite)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]DireccionDestinatario, 0)
	for rows.Next() {
		var d DireccionDestinatario
		if err := rows.Scan(&d.ID, &d.Calle, &d.Numero, &d.Localidad, &d.CodigoPostal); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// GuardarCoordenadas fija las coordenadas del destinatario y su fuente.
func (r *GeoRepo) GuardarCoordenadas(ctx context.Context, destinatarioID string, lat, lng float64, fuente string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE destinatarios SET latitud = $2, longitud = $3, geo_fuente = $4 WHERE id::text = $1
	`, destinatarioID, lat, lng, fuente)
	return err
}
