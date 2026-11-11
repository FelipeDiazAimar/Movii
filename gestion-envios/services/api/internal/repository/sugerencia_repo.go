package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SugerenciaRepo lee lo necesario para sugerir con qué ruta o repartidor
// conviene asignar: cargas, vehículos y coordenadas de las paradas.
type SugerenciaRepo struct {
	pool *pgxpool.Pool
}

// NewSugerenciaRepo crea un SugerenciaRepo.
func NewSugerenciaRepo(pool *pgxpool.Pool) *SugerenciaRepo {
	return &SugerenciaRepo{pool: pool}
}

// EnvioParaSugerir son los datos del envío que importan para elegir ruta.
// Lat/Lng son nil si el destino todavía no se geocodificó.
type EnvioParaSugerir struct {
	Peso         float64
	FechaEntrega string
	Localidad    string
	Lat, Lng     *float64
}

// RutaPlanificada es una ruta abierta con su carga, vehículo y el centro de
// sus paradas (nil si no tiene paradas ubicadas).
type RutaPlanificada struct {
	ID, Nombre, Zona, Fecha string
	RepartidorNombre        string
	Vehiculo                string
	CapacidadPeso           float64 // 0 = sin vehículo
	Paradas                 int
	PesoActual              float64
	CentroLat, CentroLng    *float64
}

// ParadaDeRepartidor es un destino de otra ruta del mismo día.
type ParadaDeRepartidor struct {
	RepartidorID string
	RutaID       string
	RutaEstado   string
	TieneEnvio   bool // false = ruta sin envíos (fila solo para contar rutas)
	Peso         float64
	Lat, Lng     *float64
}

// RutaParaSugerir son los datos de la ruta a la que se busca repartidor.
type RutaParaSugerir struct {
	Fecha, Zona          string
	RepartidorID         string
	CentroLat, CentroLng *float64
}

// RepartidorActivo es un repartidor habilitado para recibir rutas.
type RepartidorActivo struct{ ID, Nombre string }

// EnvioParaSugerir devuelve los datos del envío. ErrNoEncontrado si no existe.
func (r *SugerenciaRepo) EnvioParaSugerir(ctx context.Context, envioID string) (EnvioParaSugerir, error) {
	var e EnvioParaSugerir
	err := r.pool.QueryRow(ctx, `
		SELECT e.peso::float8, to_char(e.fecha_entrega, 'YYYY-MM-DD'), d.localidad, d.latitud::float8, d.longitud::float8
		FROM envios e JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE e.id::text = $1
	`, envioID).Scan(&e.Peso, &e.FechaEntrega, &e.Localidad, &e.Lat, &e.Lng)
	if errors.Is(err, pgx.ErrNoRows) {
		return EnvioParaSugerir{}, ErrNoEncontrado
	}
	return e, err
}

// RutasPlanificadas devuelve las rutas abiertas con carga, vehículo y centro de paradas.
func (r *SugerenciaRepo) RutasPlanificadas(ctx context.Context) ([]RutaPlanificada, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT r.id::text, r.nombre, r.zona, to_char(r.fecha, 'YYYY-MM-DD'), u.nombre,
		       COALESCE(v.patente, ''), COALESCE(v.capacidad_peso::float8, 0),
		       count(e.id), COALESCE(sum(e.peso), 0)::float8, avg(d.latitud)::float8, avg(d.longitud)::float8
		FROM rutas r
		JOIN usuarios u ON u.id = r.repartidor_id
		LEFT JOIN vehiculos v ON v.id = r.vehiculo_id
		LEFT JOIN envios e ON e.ruta_id = r.id
		LEFT JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE r.estado = 'planificada'
		GROUP BY r.id, u.nombre, v.patente, v.capacidad_peso
		ORDER BY r.fecha, r.nombre
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]RutaPlanificada, 0)
	for rows.Next() {
		var x RutaPlanificada
		if err := rows.Scan(&x.ID, &x.Nombre, &x.Zona, &x.Fecha, &x.RepartidorNombre, &x.Vehiculo, &x.CapacidadPeso,
			&x.Paradas, &x.PesoActual, &x.CentroLat, &x.CentroLng); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

// RutaParaSugerir devuelve fecha, zona, repartidor actual y centro de paradas de la ruta.
func (r *SugerenciaRepo) RutaParaSugerir(ctx context.Context, rutaID string) (RutaParaSugerir, error) {
	var x RutaParaSugerir
	err := r.pool.QueryRow(ctx, `
		SELECT to_char(r.fecha, 'YYYY-MM-DD'), r.zona, r.repartidor_id::text, avg(d.latitud)::float8, avg(d.longitud)::float8
		FROM rutas r
		LEFT JOIN envios e ON e.ruta_id = r.id
		LEFT JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE r.id::text = $1
		GROUP BY r.id
	`, rutaID).Scan(&x.Fecha, &x.Zona, &x.RepartidorID, &x.CentroLat, &x.CentroLng)
	if errors.Is(err, pgx.ErrNoRows) {
		return RutaParaSugerir{}, ErrNoEncontrado
	}
	return x, err
}

// RepartidoresActivos devuelve los repartidores habilitados.
func (r *SugerenciaRepo) RepartidoresActivos(ctx context.Context) ([]RepartidorActivo, error) {
	rows, err := r.pool.Query(ctx, `SELECT id::text, nombre FROM usuarios WHERE rol = 'repartidor' AND activo ORDER BY nombre`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]RepartidorActivo, 0)
	for rows.Next() {
		var x RepartidorActivo
		if err := rows.Scan(&x.ID, &x.Nombre); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

// ParadasDelDia devuelve una fila por envío de las rutas de la fecha (sin la
// ruta excluida) y una fila vacía por ruta sin envíos, para contar rutas por repartidor.
func (r *SugerenciaRepo) ParadasDelDia(ctx context.Context, fecha, excluirRutaID string) ([]ParadaDeRepartidor, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT r.repartidor_id::text, r.id::text, r.estado::text, e.id IS NOT NULL, COALESCE(e.peso, 0)::float8, d.latitud::float8, d.longitud::float8
		FROM rutas r
		LEFT JOIN envios e ON e.ruta_id = r.id
		LEFT JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE r.fecha = $1::date AND r.id::text <> $2
	`, fecha, excluirRutaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ParadaDeRepartidor, 0)
	for rows.Next() {
		var x ParadaDeRepartidor
		if err := rows.Scan(&x.RepartidorID, &x.RutaID, &x.RutaEstado, &x.TieneEnvio, &x.Peso, &x.Lat, &x.Lng); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
