package repository

import (
	"context"
	"errors"
	"math"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
)

// ErrVehiculoOcupado indica que el vehículo ya tiene otra ruta en esa fecha.
var ErrVehiculoOcupado = errors.New("el vehiculo ya tiene una ruta asignada ese dia")

// FlotaRepo accede a la tabla vehiculos y a la carga de la ruta del día (HU-18).
type FlotaRepo struct {
	pool *pgxpool.Pool
}

// NewFlotaRepo crea un FlotaRepo.
func NewFlotaRepo(pool *pgxpool.Pool) *FlotaRepo {
	return &FlotaRepo{pool: pool}
}

// selectVehiculos une cada vehículo con su ruta de la fecha $1 (a lo sumo una,
// por el índice único uq_rutas_vehiculo_fecha) y agrega la carga de esa ruta.
const selectVehiculos = `
	SELECT v.id, v.patente, v.modelo, v.tipo, v.capacidad_peso::float8, v.capacidad_volumen::float8, v.estado, v.color,
	       v.latitud::float8, v.longitud::float8, v.velocidad::float8, v.rumbo::float8, v.temperatura::float8, v.posicion_at,
	       r.id::text, COALESCE(r.nombre, ''), COALESCE(r.zona, ''), COALESCE(r.estado::text, ''), r.repartidor_id::text, COALESCE(u.nombre, ''),
	       COALESCE(sum(e.peso) FILTER (WHERE e.estado IN ('asignado', 'en_camino')), 0)::float8,
	       count(e.id),
	       count(e.id) FILTER (WHERE e.estado = 'entregado'),
	       count(e.id) FILTER (WHERE e.estado = 'no_entregado')
	FROM vehiculos v
	LEFT JOIN rutas r ON r.vehiculo_id = v.id AND r.fecha = $1::date
	LEFT JOIN usuarios u ON u.id = r.repartidor_id
	LEFT JOIN envios e ON e.ruta_id = r.id
`

func scanVehiculo(row pgx.Row) (domain.Vehiculo, error) {
	var v domain.Vehiculo
	err := row.Scan(&v.ID, &v.Patente, &v.Modelo, &v.Tipo, &v.CapacidadPeso, &v.CapacidadVolumen, &v.Estado, &v.Color,
		&v.Latitud, &v.Longitud, &v.Velocidad, &v.Rumbo, &v.Temperatura, &v.PosicionAt,
		&v.RutaID, &v.RutaNombre, &v.RutaZona, &v.RutaEstado, &v.RepartidorID, &v.RepartidorNombre,
		&v.CargaActualPeso, &v.TotalPaquetes, &v.PaquetesEntregados, &v.PaquetesFallidos)
	if err != nil {
		return domain.Vehiculo{}, err
	}
	v.CargaActualPeso = math.Round(v.CargaActualPeso*100) / 100
	if v.CapacidadPeso > 0 {
		v.CapacidadPorcentaje = math.Round(v.CargaActualPeso/v.CapacidadPeso*1000) / 10
	}
	return v, nil
}

// List devuelve todos los vehículos con su ruta de la fecha (YYYY-MM-DD). Nunca nil.
func (r *FlotaRepo) List(ctx context.Context, fecha string) ([]domain.Vehiculo, error) {
	rows, err := r.pool.Query(ctx, selectVehiculos+` GROUP BY v.id, r.id, u.nombre ORDER BY v.patente`, fecha)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Vehiculo, 0)
	for rows.Next() {
		v, err := scanVehiculo(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// Get devuelve un vehículo con su ruta de la fecha. ErrNoEncontrado si no existe.
func (r *FlotaRepo) Get(ctx context.Context, id, fecha string) (domain.Vehiculo, error) {
	v, err := scanVehiculo(r.pool.QueryRow(ctx, selectVehiculos+` WHERE v.id::text = $2 GROUP BY v.id, r.id, u.nombre`, fecha, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Vehiculo{}, ErrNoEncontrado
	}
	return v, err
}

// Paquetes devuelve los envíos de la ruta en orden de reparto (el mismo orden
// que ParadasDeRuta y la vista del repartidor). Nunca nil.
func (r *FlotaRepo) Paquetes(ctx context.Context, rutaID string) ([]domain.PaqueteVehiculo, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT e.id, e.codigo_guia, e.estado::text, e.peso::float8, e.tamano::text, COALESCE(e.tipo_contenido, ''),
		       e.fragil, e.urgente, d.nombre, trim(d.calle || ' ' || d.numero), d.localidad,
		       d.latitud::float8, d.longitud::float8
		FROM envios e JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE e.ruta_id = $1
		ORDER BY e.created_at, e.id
	`, rutaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.PaqueteVehiculo, 0)
	for rows.Next() {
		var p domain.PaqueteVehiculo
		var lat, lng *float64
		if err := rows.Scan(&p.EnvioID, &p.CodigoGuia, &p.Estado, &p.Peso, &p.Tamano, &p.TipoContenido,
			&p.Fragil, &p.Urgente, &p.DestinatarioNombre, &p.Direccion, &p.Localidad, &lat, &lng); err != nil {
			return nil, err
		}
		if lat != nil && lng != nil {
			p.Coordenadas = &domain.Coordenadas{Lat: *lat, Lng: *lng}
		}
		p.Orden = len(out) + 1
		out = append(out, p)
	}
	return out, rows.Err()
}

// Create inserta un vehículo nuevo. ErrDuplicado si la patente ya existe.
func (r *FlotaRepo) Create(ctx context.Context, v domain.Vehiculo) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO vehiculos (patente, modelo, tipo, capacidad_peso, capacidad_volumen, estado, color)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
	`, v.Patente, v.Modelo, v.Tipo, v.CapacidadPeso, v.CapacidadVolumen, v.Estado, v.Color).Scan(&id)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
		return "", ErrDuplicado
	}
	return id, err
}

// Update modifica los datos editables de un vehículo. ErrNoEncontrado si no existe.
func (r *FlotaRepo) Update(ctx context.Context, id string, v domain.Vehiculo) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE vehiculos SET modelo = $2, tipo = $3, capacidad_peso = $4, capacidad_volumen = $5, estado = $6, color = $7
		WHERE id::text = $1
	`, id, v.Modelo, v.Tipo, v.CapacidadPeso, v.CapacidadVolumen, v.Estado, v.Color)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNoEncontrado
	}
	return nil
}

// AsignarARuta pone (o quita, con vehiculoID nil) el vehículo de una ruta.
// ErrNoEncontrado si la ruta no existe; ErrVehiculoOcupado si el vehículo ya
// tiene otra ruta ese día.
func (r *FlotaRepo) AsignarARuta(ctx context.Context, rutaID string, vehiculoID *string) error {
	tag, err := r.pool.Exec(ctx, `UPDATE rutas SET vehiculo_id = $2 WHERE id::text = $1`, rutaID, vehiculoID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case pgUniqueViolation:
			return ErrVehiculoOcupado
		case "23503": // foreign_key_violation: el vehículo no existe
			return ErrNoEncontrado
		}
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNoEncontrado
	}
	return nil
}

// EstadoYPesoRuta devuelve el estado de la ruta y el peso total de sus envíos.
// ErrNoEncontrado si la ruta no existe.
func (r *FlotaRepo) EstadoYPesoRuta(ctx context.Context, rutaID string) (string, float64, error) {
	var estado string
	var peso float64
	err := r.pool.QueryRow(ctx, `
		SELECT r.estado::text, COALESCE(sum(e.peso), 0)::float8
		FROM rutas r LEFT JOIN envios e ON e.ruta_id = r.id
		WHERE r.id::text = $1 GROUP BY r.id
	`, rutaID).Scan(&estado, &peso)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", 0, ErrNoEncontrado
	}
	return estado, peso, err
}

// ActualizarPosicion guarda la telemetría del vehículo.
func (r *FlotaRepo) ActualizarPosicion(ctx context.Context, p domain.PosicionVehiculo) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE vehiculos SET latitud = $2, longitud = $3, velocidad = $4, rumbo = $5, posicion_at = $6
		WHERE id = $1
	`, p.VehiculoID, p.Lat, p.Lng, p.Velocidad, p.Rumbo, p.En)
	return err
}

// VehiculoDeRuta devuelve la posición del vehículo asignado a la ruta, o nil si no tiene.
func (r *FlotaRepo) VehiculoDeRuta(ctx context.Context, rutaID string) (*domain.PosicionVehiculo, error) {
	var p domain.PosicionVehiculo
	err := r.pool.QueryRow(ctx, `
		SELECT v.id, v.patente, r.id::text, v.latitud::float8, v.longitud::float8, v.velocidad::float8, v.rumbo::float8, v.posicion_at
		FROM rutas r JOIN vehiculos v ON v.id = r.vehiculo_id
		WHERE r.id::text = $1
	`, rutaID).Scan(&p.VehiculoID, &p.Patente, &p.RutaID, &p.Lat, &p.Lng, &p.Velocidad, &p.Rumbo, &p.En)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ParadaSimulada es una parada pendiente con coordenadas, para el simulador.
type ParadaSimulada struct {
	EnvioID string
	Lat     float64
	Lng     float64
}

// VehiculoEnRuta es un vehículo activo con ruta en la fecha y sus paradas pendientes.
type VehiculoEnRuta struct {
	Posicion domain.PosicionVehiculo
	Paradas  []ParadaSimulada
}

// EnRuta devuelve los vehículos activos con ruta en la fecha y, para cada uno,
// sus paradas todavía no resueltas (asignadas o en camino) con coordenadas,
// en orden de reparto.
func (r *FlotaRepo) EnRuta(ctx context.Context, fecha string) ([]VehiculoEnRuta, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT v.id, v.patente, r.id::text, v.latitud::float8, v.longitud::float8, v.rumbo::float8, v.posicion_at,
		       e.id, d.latitud::float8, d.longitud::float8
		FROM vehiculos v
		JOIN rutas r ON r.vehiculo_id = v.id AND r.fecha = $1::date
		JOIN envios e ON e.ruta_id = r.id AND e.estado IN ('asignado', 'en_camino')
		JOIN destinatarios d ON d.id = e.destinatario_id AND d.latitud IS NOT NULL
		WHERE v.estado = 'activo'
		ORDER BY v.patente, e.created_at, e.id
	`, fecha)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]VehiculoEnRuta, 0)
	for rows.Next() {
		var p domain.PosicionVehiculo
		var rutaID string
		var s ParadaSimulada
		if err := rows.Scan(&p.VehiculoID, &p.Patente, &rutaID, &p.Lat, &p.Lng, &p.Rumbo, &p.En, &s.EnvioID, &s.Lat, &s.Lng); err != nil {
			return nil, err
		}
		if n := len(out); n == 0 || out[n-1].Posicion.VehiculoID != p.VehiculoID {
			p.RutaID = &rutaID
			out = append(out, VehiculoEnRuta{Posicion: p})
		}
		out[len(out)-1].Paradas = append(out[len(out)-1].Paradas, s)
	}
	return out, rows.Err()
}

// DestinoDeEnvio es lo que hace falta para trazar el camino hasta un envío.
type DestinoDeEnvio struct {
	EnvioID    string
	CodigoGuia string
	Estado     string
	RutaID     *string
	Direccion  string
	Lat, Lng   *float64
}

// DestinoEnvio devuelve el destino de un envío. ErrNoEncontrado si no existe.
func (r *FlotaRepo) DestinoEnvio(ctx context.Context, envioID string) (DestinoDeEnvio, error) {
	var d DestinoDeEnvio
	err := r.pool.QueryRow(ctx, `
		SELECT e.id, e.codigo_guia, e.estado::text, e.ruta_id::text,
		       trim(dst.calle || ' ' || dst.numero) || ', ' || dst.localidad, dst.latitud::float8, dst.longitud::float8
		FROM envios e JOIN destinatarios dst ON dst.id = e.destinatario_id
		WHERE e.id::text = $1
	`, envioID).Scan(&d.EnvioID, &d.CodigoGuia, &d.Estado, &d.RutaID, &d.Direccion, &d.Lat, &d.Lng)
	if errors.Is(err, pgx.ErrNoRows) {
		return DestinoDeEnvio{}, ErrNoEncontrado
	}
	return d, err
}

// ParadasPendientesAntes cuenta las entregas pendientes de la ruta que van antes del envío.
func (r *FlotaRepo) ParadasPendientesAntes(ctx context.Context, rutaID, envioID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
		SELECT count(*) FROM envios e, envios obj
		WHERE obj.id::text = $2 AND e.ruta_id::text = $1 AND e.estado IN ('asignado', 'en_camino')
		  AND (e.created_at, e.id) < (obj.created_at, obj.id)
	`, rutaID, envioID).Scan(&n)
	return n, err
}
