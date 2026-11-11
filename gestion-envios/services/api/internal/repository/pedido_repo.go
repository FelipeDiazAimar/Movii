package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"movii/api/internal/domain"
)

// Períodos de la vista "Mis pedidos" del repartidor, según la fecha de entrega.
const (
	PedidosViejos   = "viejos"
	PedidosHoy      = "hoy"
	PedidosProximos = "proximos"
)

// ConteoPedidos cuenta los pedidos del repartidor por período.
type ConteoPedidos struct {
	Viejos   int `json:"viejos"`
	Hoy      int `json:"hoy"`
	Proximos int `json:"proximos"`
}

// ContarPedidos cuenta los envíos del repartidor anteriores, de hoy y posteriores a `hoy`.
func (r *EnvioRepo) ContarPedidos(ctx context.Context, repartidorID, hoy string) (ConteoPedidos, error) {
	var c ConteoPedidos
	err := r.pool.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE e.fecha_entrega < $2::date),
		       count(*) FILTER (WHERE e.fecha_entrega = $2::date),
		       count(*) FILTER (WHERE e.fecha_entrega > $2::date)
		FROM envios e JOIN rutas r ON r.id = e.ruta_id
		WHERE r.repartidor_id::text = $1
	`, repartidorID, hoy).Scan(&c.Viejos, &c.Hoy, &c.Proximos)
	return c, err
}

// ListarPedidos devuelve los envíos del repartidor del período pedido
// ("viejos", "hoy", "proximos" o vacío = todos), con búsqueda opcional por
// código de guía, destinatario o dirección. Máximo 200: los más recientes
// primero (los próximos, los más cercanos primero).
func (r *EnvioRepo) ListarPedidos(ctx context.Context, repartidorID, hoy, periodo, q string) ([]domain.EnvioDelDia, error) {
	orden := "e.fecha_entrega DESC, e.created_at DESC"
	if periodo == PedidosProximos {
		orden = "e.fecha_entrega ASC, e.created_at"
	}
	rows, err := r.pool.Query(ctx, `
		SELECT e.id, e.codigo_guia, e.estado, e.peso, e.tamano, e.tipo_contenido, e.fragil, e.urgente,
		       e.remitente_id, e.destinatario_id, e.ruta_id, to_char(e.fecha_entrega, 'YYYY-MM-DD'),
		       d.id, d.nombre, d.telefono, d.calle, d.numero, COALESCE(d.piso_depto, ''), d.localidad, d.codigo_postal,
		       r.nombre
		FROM envios e
		JOIN rutas r ON r.id = e.ruta_id
		JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE r.repartidor_id::text = $1
		  AND ($3 = '' OR ($3 = 'viejos' AND e.fecha_entrega < $2::date)
		                OR ($3 = 'hoy' AND e.fecha_entrega = $2::date)
		                OR ($3 = 'proximos' AND e.fecha_entrega > $2::date))
		  AND ($4 = '' OR e.codigo_guia ILIKE '%' || $4 || '%' OR d.nombre ILIKE '%' || $4 || '%'
		                OR (d.calle || ' ' || d.numero) ILIKE '%' || $4 || '%')
		ORDER BY `+orden+`
		LIMIT 200
	`, repartidorID, hoy, periodo, strings.TrimSpace(q))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	lista := make([]domain.EnvioDelDia, 0)
	for rows.Next() {
		var e domain.EnvioDelDia
		var rutaID string
		if err := rows.Scan(&e.ID, &e.CodigoGuia, &e.Estado, &e.Peso, &e.Tamano, &e.TipoContenido, &e.Fragil, &e.Urgente,
			&e.RemitenteID, &e.DestinatarioID, &rutaID, &e.FechaEntrega,
			&e.Destinatario.ID, &e.Destinatario.Nombre, &e.Destinatario.Telefono, &e.Destinatario.Calle,
			&e.Destinatario.Numero, &e.Destinatario.PisoDepto, &e.Destinatario.Localidad, &e.Destinatario.CodigoPostal,
			&e.RutaNombre,
		); err != nil {
			return nil, err
		}
		e.Envio.RutaID = &rutaID
		lista = append(lista, e)
	}
	return lista, rows.Err()
}

// IDPedidoDeRepartidor busca un envío por código de guía (sin distinguir
// mayúsculas) y solo lo devuelve si es de una ruta del repartidor; si no,
// ErrNoEncontrado (no se revela si existe para otro).
func (r *EnvioRepo) IDPedidoDeRepartidor(ctx context.Context, repartidorID, codigo string) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		SELECT e.id::text FROM envios e JOIN rutas r ON r.id = e.ruta_id
		WHERE r.repartidor_id::text = $1 AND upper(e.codigo_guia) = upper($2)
	`, repartidorID, strings.TrimSpace(codigo)).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNoEncontrado
	}
	return id, err
}

// RemitenteDe devuelve el remitente de un envío.
func (r *EnvioRepo) RemitenteDe(ctx context.Context, envioID string) (domain.Remitente, error) {
	var x domain.Remitente
	err := r.pool.QueryRow(ctx, `
		SELECT m.id::text, m.nombre, COALESCE(m.telefono, ''), COALESCE(m.direccion, '')
		FROM remitentes m JOIN envios e ON e.remitente_id = m.id WHERE e.id::text = $1
	`, envioID).Scan(&x.ID, &x.Nombre, &x.Telefono, &x.Direccion)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Remitente{}, ErrNoEncontrado
	}
	return x, err
}
