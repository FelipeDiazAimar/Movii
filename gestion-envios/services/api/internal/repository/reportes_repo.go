package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
)

// ReportesRepo resuelve las consultas agregadas de los reportes (HU-13/14/15).
// Las fechas son YYYY-MM-DD en UTC, ambos extremos inclusive.
type ReportesRepo struct {
	pool *pgxpool.Pool
}

// NewReportesRepo crea un ReportesRepo.
func NewReportesRepo(pool *pgxpool.Pool) *ReportesRepo {
	return &ReportesRepo{pool: pool}
}

// RecorrerEnvios llama a fn por cada envío creado en el período (estado vacío
// = todos), en orden de alta. Recorre fila por fila para que el CSV salga en
// streaming sin cargar el reporte entero en memoria. Si fn devuelve error, corta.
func (r *ReportesRepo) RecorrerEnvios(ctx context.Context, desde, hasta, estado string, fn func(domain.FilaReporteEnvio) error) error {
	rows, err := r.pool.Query(ctx, `
		SELECT e.codigo_guia,
		       to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
		       rem.nombre, d.nombre, trim(d.calle || ' ' || d.numero), d.localidad, e.estado::text,
		       to_char(e.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
		       ult.motivo
		FROM envios e
		JOIN remitentes rem ON rem.id = e.remitente_id
		JOIN destinatarios d ON d.id = e.destinatario_id
		LEFT JOIN LATERAL (
			SELECT ev.motivo::text AS motivo FROM eventos_envio ev
			WHERE ev.envio_id = e.id AND ev.estado_nuevo = 'no_entregado'
			ORDER BY ev.created_at DESC LIMIT 1
		) ult ON true
		WHERE (e.created_at AT TIME ZONE 'UTC')::date BETWEEN $1::date AND $2::date
		  AND ($3 = '' OR e.estado::text = $3)
		ORDER BY e.created_at, e.id
	`, desde, hasta, estado)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var f domain.FilaReporteEnvio
		if err := rows.Scan(&f.CodigoGuia, &f.FechaCreacion, &f.Remitente, &f.Destinatario, &f.Direccion,
			&f.Localidad, &f.Estado, &f.UltimaActualizacion, &f.MotivoFallo); err != nil {
			return err
		}
		if err := fn(f); err != nil {
			return err
		}
	}
	return rows.Err()
}

// DesempenoRepartidores devuelve, por repartidor con actividad en el período,
// sus entregas y fallos (eventos que él mismo registró), los envíos que
// todavía tiene en curso en rutas del período y el promedio de minutos entre
// "en camino" y "entregado". Sin posición ni tasa: las calcula el service.
//
// Se cuenta por eventos y no por el ruta_id actual: al reprogramar, el envío
// se desvincula de la ruta y la entrega fallida desaparecería del ranking.
func (r *ReportesRepo) DesempenoRepartidores(ctx context.Context, desde, hasta string) ([]domain.DesempenoRepartidor, error) {
	rows, err := r.pool.Query(ctx, `
		WITH ev AS (
			SELECT actor_id, envio_id, estado_nuevo, created_at FROM eventos_envio
			WHERE actor_id IS NOT NULL AND estado_nuevo IN ('entregado', 'no_entregado')
			  AND (created_at AT TIME ZONE 'UTC')::date BETWEEN $1::date AND $2::date
		), tiempos AS (
			-- Excluye la confirmación directa desde "asignado": su paso por
			-- "en camino" se registra en la misma tx y no mide un viaje real.
			SELECT ev.actor_id, EXTRACT(EPOCH FROM ev.created_at - ec.created_at) / 60 AS minutos
			FROM ev
			JOIN LATERAL (
				SELECT x.created_at FROM eventos_envio x
				WHERE x.envio_id = ev.envio_id AND x.estado_nuevo = 'en_camino' AND x.created_at < ev.created_at
				ORDER BY x.created_at DESC LIMIT 1
			) ec ON true
			WHERE ev.estado_nuevo = 'entregado'
		), en_curso AS (
			SELECT r.repartidor_id, count(*) AS n FROM envios e JOIN rutas r ON r.id = e.ruta_id
			WHERE r.fecha BETWEEN $1::date AND $2::date AND e.estado IN ('asignado', 'en_camino')
			GROUP BY r.repartidor_id
		)
		SELECT u.id, u.nombre,
		       count(ev.envio_id) FILTER (WHERE ev.estado_nuevo = 'entregado'),
		       count(ev.envio_id) FILTER (WHERE ev.estado_nuevo = 'no_entregado'),
		       COALESCE(c.n, 0),
		       (SELECT avg(t.minutos)::float8 FROM tiempos t WHERE t.actor_id = u.id)
		FROM usuarios u
		LEFT JOIN ev ON ev.actor_id = u.id
		LEFT JOIN en_curso c ON c.repartidor_id = u.id
		WHERE u.rol = 'repartidor'
		GROUP BY u.id, u.nombre, c.n
		HAVING count(ev.envio_id) > 0 OR COALESCE(c.n, 0) > 0
	`, desde, hasta)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	lista := make([]domain.DesempenoRepartidor, 0)
	for rows.Next() {
		var d domain.DesempenoRepartidor
		var enCurso int
		if err := rows.Scan(&d.RepartidorID, &d.Nombre, &d.Entregados, &d.Fallidos, &enCurso, &d.PromedioMinutosEntrega); err != nil {
			return nil, err
		}
		d.Asignados = d.Entregados + d.Fallidos + enCurso
		lista = append(lista, d)
	}
	return lista, rows.Err()
}

// IncidenciasPorMotivo cuenta las incidencias (eventos a no_entregado)
// registradas en el período, por motivo.
func (r *ReportesRepo) IncidenciasPorMotivo(ctx context.Context, desde, hasta string) (map[string]int, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT motivo::text, count(*) FROM eventos_envio
		WHERE estado_nuevo = 'no_entregado' AND motivo IS NOT NULL
		  AND (created_at AT TIME ZONE 'UTC')::date BETWEEN $1::date AND $2::date
		GROUP BY motivo
	`, desde, hasta)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conteo := map[string]int{}
	for rows.Next() {
		var motivo string
		var n int
		if err := rows.Scan(&motivo, &n); err != nil {
			return nil, err
		}
		conteo[motivo] = n
	}
	return conteo, rows.Err()
}
