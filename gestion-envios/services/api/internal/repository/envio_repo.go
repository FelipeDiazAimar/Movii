package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
)

// ErrEnvioNoDisponible indica que uno o más envíos no están en estado
// "pendiente" y por lo tanto no se pueden asignar a una ruta.
var ErrEnvioNoDisponible = errors.New("uno o mas envios no estan disponibles para asignar")

// EnvioRepo accede a la tabla envios (y datos de destinatario para el detalle).
type EnvioRepo struct {
	pool *pgxpool.Pool
}

// NewEnvioRepo crea un EnvioRepo sobre el pool dado.
func NewEnvioRepo(pool *pgxpool.Pool) *EnvioRepo {
	return &EnvioRepo{pool: pool}
}

// Create inserta un envío nuevo. q puede ser el pool o una transacción (se
// usa dentro de una transacción junto con CreateRemitente/CreateDestinatario).
func (r *EnvioRepo) Create(ctx context.Context, q Querier, e domain.Envio) (domain.Envio, error) {
	row := q.QueryRow(ctx, `
		INSERT INTO envios (codigo_guia, peso, tamano, tipo_contenido, fragil, urgente, remitente_id, destinatario_id)
		VALUES ($1, $2, $3::tamano_paquete, $4, $5, $6, $7, $8)
		RETURNING id, codigo_guia, estado, peso, tamano, tipo_contenido, fragil, urgente, remitente_id, destinatario_id
	`, e.CodigoGuia, e.Peso, e.Tamano, e.TipoContenido, e.Fragil, e.Urgente, e.RemitenteID, e.DestinatarioID)

	var creado domain.Envio
	err := row.Scan(&creado.ID, &creado.CodigoGuia, &creado.Estado, &creado.Peso, &creado.Tamano,
		&creado.TipoContenido, &creado.Fragil, &creado.Urgente, &creado.RemitenteID, &creado.DestinatarioID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return domain.Envio{}, ErrDuplicado
		}
		return domain.Envio{}, err
	}
	return creado, nil
}

// ContarPorPrefijoCodigo cuenta los envíos cuyo código de guía empieza con
// prefijo. Se usa para generar el siguiente número de secuencia diaria.
func (r *EnvioRepo) ContarPorPrefijoCodigo(ctx context.Context, q Querier, prefijo string) (int, error) {
	var count int
	err := q.QueryRow(ctx, `SELECT COUNT(*) FROM envios WHERE codigo_guia LIKE $1`, prefijo+"%").Scan(&count)
	return count, err
}

// List devuelve los envíos que matchean el filtro. estado o fecha vacíos
// ("") no filtran por ese campo. fecha tiene formato "YYYY-MM-DD".
func (r *EnvioRepo) List(ctx context.Context, estado, fecha string) ([]domain.EnvioConDetalle, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT e.id, e.codigo_guia, e.estado, e.peso, e.tamano, e.tipo_contenido, e.fragil, e.urgente,
		       e.remitente_id, e.destinatario_id, e.ruta_id,
		       d.id, d.nombre, d.telefono, d.calle, d.numero, COALESCE(d.piso_depto, ''), d.localidad, d.codigo_postal
		FROM envios e
		JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE ($1 = '' OR e.estado::text = $1)
		  AND ($2 = '' OR e.created_at::date = $2::date)
		ORDER BY e.created_at DESC
	`, estado, fecha)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lista []domain.EnvioConDetalle
	for rows.Next() {
		var e domain.EnvioConDetalle
		var rutaID sql.NullString
		if err := rows.Scan(&e.ID, &e.CodigoGuia, &e.Estado, &e.Peso, &e.Tamano, &e.TipoContenido, &e.Fragil, &e.Urgente,
			&e.RemitenteID, &e.DestinatarioID, &rutaID,
			&e.Destinatario.ID, &e.Destinatario.Nombre, &e.Destinatario.Telefono, &e.Destinatario.Calle,
			&e.Destinatario.Numero, &e.Destinatario.PisoDepto, &e.Destinatario.Localidad, &e.Destinatario.CodigoPostal,
		); err != nil {
			return nil, err
		}
		if rutaID.Valid {
			e.RutaID = &rutaID.String
		}
		lista = append(lista, e)
	}
	return lista, rows.Err()
}

// GetByID devuelve el detalle de un envío con los datos del destinatario.
// Devuelve ErrNoEncontrado si no existe.
func (r *EnvioRepo) GetByID(ctx context.Context, id string) (domain.EnvioConDetalle, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT e.id, e.codigo_guia, e.estado, e.peso, e.tamano, e.tipo_contenido, e.fragil, e.urgente,
		       e.remitente_id, e.destinatario_id, e.ruta_id,
		       d.id, d.nombre, d.telefono, d.calle, d.numero, COALESCE(d.piso_depto, ''), d.localidad, d.codigo_postal
		FROM envios e
		JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE e.id = $1
	`, id)

	var e domain.EnvioConDetalle
	var rutaID sql.NullString
	err := row.Scan(&e.ID, &e.CodigoGuia, &e.Estado, &e.Peso, &e.Tamano, &e.TipoContenido, &e.Fragil, &e.Urgente,
		&e.RemitenteID, &e.DestinatarioID, &rutaID,
		&e.Destinatario.ID, &e.Destinatario.Nombre, &e.Destinatario.Telefono, &e.Destinatario.Calle,
		&e.Destinatario.Numero, &e.Destinatario.PisoDepto, &e.Destinatario.Localidad, &e.Destinatario.CodigoPostal,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.EnvioConDetalle{}, ErrNoEncontrado
	}
	if err != nil {
		return domain.EnvioConDetalle{}, err
	}
	if rutaID.Valid {
		e.RutaID = &rutaID.String
	}
	return e, nil
}

// AsignarEnvios asigna los envíos dados (deben estar "pendiente" y sin ruta)
// a rutaID, y los pasa a estado "asignado". Devuelve ErrEnvioNoDisponible si
// alguno no estaba pendiente (o no existe).
func (r *EnvioRepo) AsignarEnvios(ctx context.Context, envioIDs []string, rutaID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE envios SET ruta_id = $1, estado = 'asignado'
		WHERE id = ANY($2) AND estado = 'pendiente'
	`, rutaID, envioIDs)
	if err != nil {
		return err
	}
	if int(tag.RowsAffected()) != len(envioIDs) {
		return ErrEnvioNoDisponible
	}
	return nil
}

// DesasignarEnvio quita un envío de una ruta y lo vuelve a "pendiente".
// Devuelve ErrNoEncontrado si el envío no existe o no pertenece a esa ruta.
func (r *EnvioRepo) DesasignarEnvio(ctx context.Context, envioID, rutaID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE envios SET ruta_id = NULL, estado = 'pendiente'
		WHERE id = $1 AND ruta_id = $2
	`, envioID, rutaID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNoEncontrado
	}
	return nil
}

// currentDateUTC devuelve la fecha de hoy en UTC, formato "YYYY-MM-DD". Se
// usa en vez de time.Now().Format en horario local para no repetir el bug
// de huso horario ya corregido en AsignacionService (una fecha calculada en
// el huso local de la máquina puede diferir de la fecha real en UTC cerca
// de la medianoche).
func currentDateUTC() string {
	return time.Now().UTC().Format("2006-01-02")
}

// ListDelDiaPorRepartidor devuelve los envíos de las rutas de repartidorID
// con fecha == fecha, con el nombre de la ruta para poder agruparlos.
// estado vacío ("") no filtra por estado.
func (r *EnvioRepo) ListDelDiaPorRepartidor(ctx context.Context, repartidorID, fecha, estado string) ([]domain.EnvioDelDia, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT e.id, e.codigo_guia, e.estado, e.peso, e.tamano, e.tipo_contenido, e.fragil, e.urgente,
		       e.remitente_id, e.destinatario_id, e.ruta_id,
		       d.id, d.nombre, d.telefono, d.calle, d.numero, COALESCE(d.piso_depto, ''), d.localidad, d.codigo_postal,
		       r.nombre
		FROM envios e
		JOIN rutas r ON r.id = e.ruta_id
		JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE r.repartidor_id = $1 AND r.fecha = $2::date
		  AND ($3 = '' OR e.estado::text = $3)
		ORDER BY r.nombre, e.created_at
	`, repartidorID, fecha, estado)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lista []domain.EnvioDelDia
	for rows.Next() {
		var e domain.EnvioDelDia
		var rutaID sql.NullString
		// Orden exacto de columnas del SELECT (20 en total):
		// 1-10: e.id, codigo_guia, estado, peso, tamano, tipo_contenido, fragil, urgente, remitente_id, destinatario_id
		// 11: e.ruta_id
		// 12-19: d.id, nombre, telefono, calle, numero, piso_depto, localidad, codigo_postal
		// 20: r.nombre
		if err := rows.Scan(&e.ID, &e.CodigoGuia, &e.Estado, &e.Peso, &e.Tamano, &e.TipoContenido, &e.Fragil, &e.Urgente,
			&e.RemitenteID, &e.DestinatarioID, &rutaID,
			&e.Destinatario.ID, &e.Destinatario.Nombre, &e.Destinatario.Telefono, &e.Destinatario.Calle,
			&e.Destinatario.Numero, &e.Destinatario.PisoDepto, &e.Destinatario.Localidad, &e.Destinatario.CodigoPostal,
			&e.RutaNombre,
		); err != nil {
			return nil, err
		}
		if rutaID.Valid {
			e.Envio.RutaID = &rutaID.String
		}
		lista = append(lista, e)
	}
	return lista, rows.Err()
}
