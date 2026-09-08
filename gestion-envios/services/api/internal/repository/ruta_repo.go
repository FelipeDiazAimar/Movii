package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
)

// ErrRutaNoEditable indica que la ruta no está en estado "planificada" y por
// lo tanto no se puede editar ni desasignar envíos de ella.
var ErrRutaNoEditable = errors.New("la ruta no se puede editar en su estado actual")

// RutaRepo accede a la tabla rutas.
type RutaRepo struct {
	pool *pgxpool.Pool
}

// NewRutaRepo crea un RutaRepo sobre el pool dado.
func NewRutaRepo(pool *pgxpool.Pool) *RutaRepo {
	return &RutaRepo{pool: pool}
}

// Create inserta una ruta nueva en estado "planificada".
func (r *RutaRepo) Create(ctx context.Context, ruta domain.Ruta) (domain.Ruta, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id)
		VALUES ($1, $2, $3::date, $4)
		RETURNING id, nombre, zona, to_char(fecha, 'YYYY-MM-DD'), estado, repartidor_id
	`, ruta.Nombre, ruta.Zona, ruta.Fecha, ruta.RepartidorID)

	var creada domain.Ruta
	if err := row.Scan(&creada.ID, &creada.Nombre, &creada.Zona, &creada.Fecha, &creada.Estado, &creada.RepartidorID); err != nil {
		return domain.Ruta{}, err
	}
	return creada, nil
}

// List devuelve las rutas (filtradas por fecha si no está vacía) con la
// cantidad de envíos asignados a cada una.
func (r *RutaRepo) List(ctx context.Context, fecha string) ([]domain.RutaConConteo, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT r.id, r.nombre, r.zona, to_char(r.fecha, 'YYYY-MM-DD'), r.estado, r.repartidor_id, COUNT(e.id)
		FROM rutas r
		LEFT JOIN envios e ON e.ruta_id = r.id
		WHERE ($1 = '' OR r.fecha = $1::date)
		GROUP BY r.id
		ORDER BY r.fecha
	`, fecha)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// make(...,0) y no `var`: un resultado vacío debe serializarse como [] y
	// no como null, para que el cliente pueda recorrerlo sin chequear nil.
	lista := make([]domain.RutaConConteo, 0)
	for rows.Next() {
		var rc domain.RutaConConteo
		if err := rows.Scan(&rc.ID, &rc.Nombre, &rc.Zona, &rc.Fecha, &rc.Estado, &rc.RepartidorID, &rc.CantidadEnvios); err != nil {
			return nil, err
		}
		lista = append(lista, rc)
	}
	return lista, rows.Err()
}

// GetByID devuelve una ruta por id. Devuelve ErrNoEncontrado si no existe.
func (r *RutaRepo) GetByID(ctx context.Context, id string) (domain.Ruta, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, nombre, zona, to_char(fecha, 'YYYY-MM-DD'), estado, repartidor_id
		FROM rutas WHERE id = $1
	`, id)

	var ruta domain.Ruta
	err := row.Scan(&ruta.ID, &ruta.Nombre, &ruta.Zona, &ruta.Fecha, &ruta.Estado, &ruta.RepartidorID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Ruta{}, ErrNoEncontrado
	}
	if err != nil {
		return domain.Ruta{}, err
	}
	return ruta, nil
}

// Update edita nombre/zona/fecha/repartidor de una ruta, solo si está en
// estado "planificada" (CA-03 de HU-03). Devuelve ErrNoEncontrado si la ruta
// no existe, o ErrRutaNoEditable si no está planificada.
func (r *RutaRepo) Update(ctx context.Context, id string, ruta domain.Ruta) (domain.Ruta, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE rutas SET nombre = $1, zona = $2, fecha = $3::date, repartidor_id = $4
		WHERE id = $5 AND estado = 'planificada'
		RETURNING id, nombre, zona, to_char(fecha, 'YYYY-MM-DD'), estado, repartidor_id
	`, ruta.Nombre, ruta.Zona, ruta.Fecha, ruta.RepartidorID, id)

	var actualizada domain.Ruta
	err := row.Scan(&actualizada.ID, &actualizada.Nombre, &actualizada.Zona, &actualizada.Fecha, &actualizada.Estado, &actualizada.RepartidorID)
	if errors.Is(err, pgx.ErrNoRows) {
		// El UPDATE no afectó filas: puede ser que la ruta no exista, o que
		// exista pero no esté planificada. Distinguimos con un SELECT.
		if _, errGet := r.GetByID(ctx, id); errors.Is(errGet, ErrNoEncontrado) {
			return domain.Ruta{}, ErrNoEncontrado
		}
		return domain.Ruta{}, ErrRutaNoEditable
	}
	if err != nil {
		return domain.Ruta{}, err
	}
	return actualizada, nil
}

// EnviosDeRuta devuelve los envíos asignados a una ruta.
func (r *RutaRepo) EnviosDeRuta(ctx context.Context, rutaID string) ([]domain.Envio, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, codigo_guia, estado, peso, tamano, tipo_contenido, fragil, urgente, remitente_id, destinatario_id
		FROM envios WHERE ruta_id = $1
	`, rutaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	lista := make([]domain.Envio, 0)
	for rows.Next() {
		var e domain.Envio
		if err := rows.Scan(&e.ID, &e.CodigoGuia, &e.Estado, &e.Peso, &e.Tamano, &e.TipoContenido, &e.Fragil, &e.Urgente, &e.RemitenteID, &e.DestinatarioID); err != nil {
			return nil, err
		}
		rutaIDCopia := rutaID
		e.RutaID = &rutaIDCopia
		lista = append(lista, e)
	}
	return lista, rows.Err()
}
