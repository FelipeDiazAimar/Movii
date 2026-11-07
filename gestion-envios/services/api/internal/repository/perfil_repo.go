package repository

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PerfilRepartidor es lo que la app del repartidor muestra en su perfil.
type PerfilRepartidor struct {
	Nombre       string `json:"nombre"`
	Email        string `json:"email"`
	Telefono     string `json:"telefono"` // enmascarado: ••••45
	Rol          string `json:"rol"`
	MiembroDesde string `json:"miembro_desde"` // YYYY-MM-DD
	ConGoogle    bool   `json:"con_google"`

	Historico      HistoricoRepartidor `json:"historico"`
	UltimosDias    []DiaRepartidor     `json:"ultimos_dias"` // 7 días, del más viejo a hoy
	MotivosFallo   []MotivoCantidad    `json:"motivos_fallo"`
	VehiculoDeHoy  *VehiculoPerfil     `json:"vehiculo_hoy"`
	RutasDeHoy     int                 `json:"rutas_hoy"`
	PrimeraEntrega string              `json:"primera_entrega_hoy,omitempty"` // RFC 3339
	UltimaEntrega  string              `json:"ultima_entrega_hoy,omitempty"`
}

// HistoricoRepartidor resume todo lo que repartió.
type HistoricoRepartidor struct {
	Entregados         int     `json:"entregados"`
	NoEntregados       int     `json:"no_entregados"`
	Efectividad        float64 `json:"efectividad"` // % sobre los cerrados
	KgEntregados       float64 `json:"kg_entregados"`
	RutasCompletadas   int     `json:"rutas_completadas"`
	DiasTrabajados     int     `json:"dias_trabajados"`
	PromedioPorDia     float64 `json:"promedio_por_dia"`
	MejorDia           int     `json:"mejor_dia"`
	FragilesEntregados int     `json:"fragiles_entregados"`
}

// DiaRepartidor es un día del gráfico de la última semana.
type DiaRepartidor struct {
	Fecha        string `json:"fecha"`
	Entregados   int    `json:"entregados"`
	NoEntregados int    `json:"no_entregados"`
}

// MotivoCantidad cuenta los fallos por motivo.
type MotivoCantidad struct {
	Motivo   string `json:"motivo"`
	Cantidad int    `json:"cantidad"`
}

// VehiculoPerfil es el vehículo de la ruta de hoy.
type VehiculoPerfil struct {
	Patente             string  `json:"patente"`
	Modelo              string  `json:"modelo"`
	Tipo                string  `json:"tipo"`
	Color               string  `json:"color"`
	CapacidadPeso       float64 `json:"capacidad_peso"`
	CargaActualPeso     float64 `json:"carga_actual_peso"`
	CapacidadPorcentaje float64 `json:"capacidad_porcentaje"`
	Velocidad           float64 `json:"velocidad"`
	Temperatura         float64 `json:"temperatura"`
}

// PerfilRepo arma el perfil del repartidor.
type PerfilRepo struct {
	pool *pgxpool.Pool
}

// NewPerfilRepo crea un PerfilRepo.
func NewPerfilRepo(pool *pgxpool.Pool) *PerfilRepo {
	return &PerfilRepo{pool: pool}
}

// enmascararTelefono deja ver los dos últimos dígitos.
func enmascararTelefono(t string) string {
	if len(t) < 2 {
		return ""
	}
	return "••••" + t[len(t)-2:]
}

// DeRepartidor devuelve el perfil del usuario; fecha es "hoy" (YYYY-MM-DD).
func (r *PerfilRepo) DeRepartidor(ctx context.Context, id, fecha string) (PerfilRepartidor, error) {
	var p PerfilRepartidor
	var tel string
	err := r.pool.QueryRow(ctx, `
		SELECT nombre, email, COALESCE(telefono, ''), rol::text, to_char(created_at, 'YYYY-MM-DD'), google_id IS NOT NULL
		FROM usuarios WHERE id::text = $1
	`, id).Scan(&p.Nombre, &p.Email, &tel, &p.Rol, &p.MiembroDesde, &p.ConGoogle)
	if errors.Is(err, pgx.ErrNoRows) {
		return PerfilRepartidor{}, ErrNoEncontrado
	}
	if err != nil {
		return PerfilRepartidor{}, err
	}
	p.Telefono = enmascararTelefono(tel)

	// Histórico sobre los envíos de sus rutas.
	h := &p.Historico
	err = r.pool.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE e.estado = 'entregado'),
		       count(*) FILTER (WHERE e.estado = 'no_entregado'),
		       COALESCE(sum(e.peso) FILTER (WHERE e.estado = 'entregado'), 0)::float8,
		       count(*) FILTER (WHERE e.estado = 'entregado' AND e.fragil),
		       count(DISTINCT r.id) FILTER (WHERE r.estado = 'completada'),
		       count(DISTINCT r.fecha)
		FROM rutas r LEFT JOIN envios e ON e.ruta_id = r.id
		WHERE r.repartidor_id::text = $1
	`, id).Scan(&h.Entregados, &h.NoEntregados, &h.KgEntregados, &h.FragilesEntregados, &h.RutasCompletadas, &h.DiasTrabajados)
	if err != nil {
		return PerfilRepartidor{}, err
	}
	if cerrados := h.Entregados + h.NoEntregados; cerrados > 0 {
		h.Efectividad = math.Round(float64(h.Entregados)/float64(cerrados)*1000) / 10
	}
	if h.DiasTrabajados > 0 {
		h.PromedioPorDia = math.Round(float64(h.Entregados)/float64(h.DiasTrabajados)*10) / 10
	}
	h.KgEntregados = math.Round(h.KgEntregados*10) / 10

	// Entregas por día (hora de Argentina) según el evento de cierre.
	const cierres = `
		FROM eventos_envio ev
		JOIN envios e ON e.id = ev.envio_id
		JOIN rutas r ON r.id = e.ruta_id
		WHERE r.repartidor_id::text = $1 AND ev.estado_nuevo IN ('entregado', 'no_entregado')`
	if err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(max(n), 0) FROM (
			SELECT count(*) AS n `+cierres+` AND ev.estado_nuevo = 'entregado'
			GROUP BY (ev.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
		) d`, id).Scan(&h.MejorDia); err != nil {
		return PerfilRepartidor{}, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT to_char(d, 'YYYY-MM-DD'),
		       count(c.envio_id) FILTER (WHERE c.estado_nuevo = 'entregado'),
		       count(c.envio_id) FILTER (WHERE c.estado_nuevo = 'no_entregado')
		FROM generate_series($2::date - 6, $2::date, interval '1 day') AS d
		LEFT JOIN (
			SELECT ev.envio_id, ev.estado_nuevo, (ev.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia `+cierres+`
		) c ON c.dia = d::date
		GROUP BY d ORDER BY d`, id, fecha)
	if err != nil {
		return PerfilRepartidor{}, err
	}
	p.UltimosDias = make([]DiaRepartidor, 0, 7)
	for rows.Next() {
		var d DiaRepartidor
		if err := rows.Scan(&d.Fecha, &d.Entregados, &d.NoEntregados); err != nil {
			rows.Close()
			return PerfilRepartidor{}, err
		}
		p.UltimosDias = append(p.UltimosDias, d)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return PerfilRepartidor{}, err
	}

	rows, err = r.pool.Query(ctx, `
		SELECT ev.motivo::text, count(*)
		FROM eventos_envio ev
		JOIN envios e ON e.id = ev.envio_id
		JOIN rutas r ON r.id = e.ruta_id
		WHERE r.repartidor_id::text = $1 AND ev.estado_nuevo = 'no_entregado' AND ev.motivo IS NOT NULL
		GROUP BY ev.motivo ORDER BY count(*) DESC`, id)
	if err != nil {
		return PerfilRepartidor{}, err
	}
	p.MotivosFallo = make([]MotivoCantidad, 0)
	for rows.Next() {
		var m MotivoCantidad
		if err := rows.Scan(&m.Motivo, &m.Cantidad); err != nil {
			rows.Close()
			return PerfilRepartidor{}, err
		}
		p.MotivosFallo = append(p.MotivosFallo, m)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return PerfilRepartidor{}, err
	}

	// Hoy: rutas, vehículo y horario de la primera y la última entrega.
	var primera, ultima *time.Time
	if err := r.pool.QueryRow(ctx, `
		SELECT (SELECT count(*) FROM rutas WHERE repartidor_id::text = $1 AND fecha = $2::date),
		       min(ev.created_at), max(ev.created_at)
		`+cierres+` AND ev.estado_nuevo = 'entregado'
		  AND (ev.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = $2::date`, id, fecha).Scan(&p.RutasDeHoy, &primera, &ultima); err != nil {
		return PerfilRepartidor{}, err
	}
	if primera != nil {
		p.PrimeraEntrega = primera.UTC().Format(time.RFC3339)
	}
	if ultima != nil {
		p.UltimaEntrega = ultima.UTC().Format(time.RFC3339)
	}

	var v VehiculoPerfil
	err = r.pool.QueryRow(ctx, `
		SELECT v.patente, v.modelo, v.tipo, v.color, v.capacidad_peso::float8,
		       COALESCE(sum(e.peso) FILTER (WHERE e.estado IN ('asignado', 'en_camino')), 0)::float8,
		       v.velocidad::float8, v.temperatura::float8
		FROM rutas r
		JOIN vehiculos v ON v.id = r.vehiculo_id
		LEFT JOIN envios e ON e.ruta_id = r.id
		WHERE r.repartidor_id::text = $1 AND r.fecha = $2::date
		GROUP BY v.id, r.created_at
		ORDER BY r.created_at
		LIMIT 1`, id, fecha).Scan(&v.Patente, &v.Modelo, &v.Tipo, &v.Color, &v.CapacidadPeso, &v.CargaActualPeso, &v.Velocidad, &v.Temperatura)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
	case err != nil:
		return PerfilRepartidor{}, err
	default:
		v.CargaActualPeso = math.Round(v.CargaActualPeso*10) / 10
		if v.CapacidadPeso > 0 {
			v.CapacidadPorcentaje = math.Round(v.CargaActualPeso/v.CapacidadPeso*1000) / 10
		}
		p.VehiculoDeHoy = &v
	}
	return p, nil
}
