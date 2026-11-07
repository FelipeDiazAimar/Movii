package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
)

// OperacionesRepo lee los datos del panel en vivo (HU-11) y del mapa de ruta (HU-12).
type OperacionesRepo struct {
	pool *pgxpool.Pool
}

// NewOperacionesRepo crea un OperacionesRepo.
func NewOperacionesRepo(pool *pgxpool.Pool) *OperacionesRepo {
	return &OperacionesRepo{pool: pool}
}

// ContadoresDelDia cuenta por estado los envíos del día operativo `fecha`
// (YYYY-MM-DD): los que están en rutas de esa fecha más los pendientes sin
// ruta creados o reprogramados para ese día.
func (r *OperacionesRepo) ContadoresDelDia(ctx context.Context, fecha string) (domain.MetricasDia, error) {
	var m domain.MetricasDia
	err := r.pool.QueryRow(ctx, `
		WITH del_dia AS (
			SELECT e.estado FROM envios e JOIN rutas r ON r.id = e.ruta_id WHERE r.fecha = $1::date
			UNION ALL
			SELECT e.estado FROM envios e
			WHERE e.ruta_id IS NULL AND e.estado = 'pendiente'
			  AND (e.reprogramado_para = $1::date OR (e.reprogramado_para IS NULL AND (e.created_at AT TIME ZONE 'UTC')::date = $1::date))
		)
		SELECT count(*),
		       count(*) FILTER (WHERE estado = 'pendiente'),
		       count(*) FILTER (WHERE estado = 'asignado'),
		       count(*) FILTER (WHERE estado = 'en_camino'),
		       count(*) FILTER (WHERE estado = 'entregado'),
		       count(*) FILTER (WHERE estado = 'no_entregado')
		FROM del_dia
	`, fecha).Scan(&m.TotalEnvios, &m.Pendientes, &m.Asignados, &m.EnCamino, &m.Entregados, &m.NoEntregados)
	return m, err
}

// RutasDelDia devuelve las rutas de la fecha con su avance (paradas resueltas
// = entregadas + no entregadas). Nunca nil.
func (r *OperacionesRepo) RutasDelDia(ctx context.Context, fecha string) ([]domain.RutaActiva, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT r.id, r.nombre, u.nombre, r.estado::text,
		       count(e.id),
		       count(e.id) FILTER (WHERE e.estado IN ('entregado', 'no_entregado'))
		FROM rutas r
		JOIN usuarios u ON u.id = r.repartidor_id
		LEFT JOIN envios e ON e.ruta_id = r.id
		WHERE r.fecha = $1::date
		GROUP BY r.id, r.nombre, u.nombre, r.estado
		ORDER BY r.nombre
	`, fecha)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rutas := make([]domain.RutaActiva, 0)
	for rows.Next() {
		var ra domain.RutaActiva
		if err := rows.Scan(&ra.RutaID, &ra.Nombre, &ra.RepartidorNombre, &ra.EstadoRuta, &ra.TotalParadas, &ra.Completadas); err != nil {
			return nil, err
		}
		rutas = append(rutas, ra)
	}
	return rutas, rows.Err()
}

// IncidenciasDelDia devuelve las últimas `limite` incidencias (eventos que
// pasaron a no_entregado) registradas en la fecha, más nuevas primero. El
// motivo viaja crudo: el service lo traduce. Nunca nil.
func (r *OperacionesRepo) IncidenciasDelDia(ctx context.Context, fecha string, limite int) ([]domain.Alerta, []string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT e.id, e.codigo_guia, COALESCE(ev.motivo::text, ''),
		       to_char(ev.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM eventos_envio ev
		JOIN envios e ON e.id = ev.envio_id
		WHERE ev.estado_nuevo = 'no_entregado' AND (ev.created_at AT TIME ZONE 'UTC')::date = $1::date
		ORDER BY ev.created_at DESC
		LIMIT $2
	`, fecha, limite)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	alertas := make([]domain.Alerta, 0)
	motivos := make([]string, 0)
	for rows.Next() {
		var a domain.Alerta
		var motivo string
		if err := rows.Scan(&a.EnvioID, &a.CodigoGuia, &motivo, &a.Fecha); err != nil {
			return nil, nil, err
		}
		a.Tipo = "incidencia"
		alertas = append(alertas, a)
		motivos = append(motivos, motivo)
	}
	return alertas, motivos, rows.Err()
}

// RutaParaMapa devuelve la cabecera de la ruta (con su repartidor). Devuelve
// ErrNoEncontrado si no existe o el id está mal formado.
func (r *OperacionesRepo) RutaParaMapa(ctx context.Context, rutaID string) (domain.RutaMapa, error) {
	var m domain.RutaMapa
	err := r.pool.QueryRow(ctx, `
		SELECT r.id, r.nombre, to_char(r.fecha, 'YYYY-MM-DD'), u.id, u.nombre
		FROM rutas r JOIN usuarios u ON u.id = r.repartidor_id
		WHERE r.id::text = $1
	`, rutaID).Scan(&m.RutaID, &m.Nombre, &m.Fecha, &m.Repartidor.ID, &m.Repartidor.Nombre)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RutaMapa{}, ErrNoEncontrado
	}
	return m, err
}

// ParadasDeRuta devuelve los envíos de la ruta en orden de reparto (el mismo
// que usa la vista del día del repartidor). Nunca nil.
func (r *OperacionesRepo) ParadasDeRuta(ctx context.Context, rutaID string) ([]domain.ParadaMapa, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT e.id, e.codigo_guia, e.estado::text, d.nombre,
		       trim(d.calle || ' ' || d.numero), d.localidad, d.latitud::float8, d.longitud::float8
		FROM envios e JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE e.ruta_id = $1
		ORDER BY e.created_at, e.id
	`, rutaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	paradas := make([]domain.ParadaMapa, 0)
	for rows.Next() {
		var p domain.ParadaMapa
		var lat, lng *float64
		if err := rows.Scan(&p.EnvioID, &p.CodigoGuia, &p.Estado, &p.DestinatarioNombre, &p.Direccion, &p.Localidad, &lat, &lng); err != nil {
			return nil, err
		}
		if lat != nil && lng != nil {
			p.Coordenadas = &domain.Coordenadas{Lat: *lat, Lng: *lng}
		}
		p.Orden = len(paradas) + 1
		paradas = append(paradas, p)
	}
	return paradas, rows.Err()
}
