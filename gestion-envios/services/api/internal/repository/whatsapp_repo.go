package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// WhatsappRepo guarda los códigos de acceso (HU-16) y el registro de avisos (HU-17).
type WhatsappRepo struct {
	pool *pgxpool.Pool
}

// NewWhatsappRepo crea un WhatsappRepo.
func NewWhatsappRepo(pool *pgxpool.Pool) *WhatsappRepo {
	return &WhatsappRepo{pool: pool}
}

// CodigoOTP es un código de acceso emitido.
type CodigoOTP struct {
	ID         string
	Telefono   string
	UsuarioID  *string
	CodigoHash string
	Intentos   int
	Usado      bool
	ExpiraAt   time.Time
}

// CrearCodigo guarda un código nuevo (solo su hash) con el id de desafío dado.
func (r *WhatsappRepo) CrearCodigo(ctx context.Context, id, telefono string, usuarioID *string, hash string, expira time.Time) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO codigos_otp (id, telefono, usuario_id, codigo_hash, expira_at) VALUES ($1, $2, $3, $4, $5)
	`, id, telefono, usuarioID, hash, expira)
	return err
}

// ObtenerCodigo devuelve un desafío por id. ErrNoEncontrado si no existe o el id es inválido.
func (r *WhatsappRepo) ObtenerCodigo(ctx context.Context, id string) (CodigoOTP, error) {
	var c CodigoOTP
	err := r.pool.QueryRow(ctx, `
		SELECT id, telefono, usuario_id::text, codigo_hash, intentos, usado, expira_at FROM codigos_otp WHERE id::text = $1
	`, id).Scan(&c.ID, &c.Telefono, &c.UsuarioID, &c.CodigoHash, &c.Intentos, &c.Usado, &c.ExpiraAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return CodigoOTP{}, ErrNoEncontrado
	}
	return c, err
}

// ContarCodigosDesde cuenta los códigos pedidos para el teléfono desde `desde` (límite de pedidos).
func (r *WhatsappRepo) ContarCodigosDesde(ctx context.Context, telefono string, desde time.Time) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT count(*) FROM codigos_otp WHERE telefono = $1 AND created_at >= $2`, telefono, desde).Scan(&n)
	return n, err
}

// SumarIntento registra un intento de verificación del código.
func (r *WhatsappRepo) SumarIntento(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE codigos_otp SET intentos = intentos + 1 WHERE id = $1`, id)
	return err
}

// MarcarUsado invalida el código (usado o con demasiados intentos). Devuelve
// false si ya estaba usado (dos verificaciones simultáneas del mismo código).
func (r *WhatsappRepo) MarcarUsado(ctx context.Context, id string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `UPDATE codigos_otp SET usado = true WHERE id = $1 AND NOT usado`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// DatosAvisoEnvio es lo necesario para redactar el aviso de un envío.
type DatosAvisoEnvio struct {
	EnvioID          string
	CodigoGuia       string
	Estado           string
	UltimoEventoID   string
	Destinatario     string
	Telefono         string
	Direccion        string
	Motivo           *string
	ReprogramadoPara *string
	Franja           *string
}

// DatosAvisoEnvio lee el envío, su destinatario y el último evento del historial.
func (r *WhatsappRepo) DatosAvisoEnvio(ctx context.Context, envioID string) (DatosAvisoEnvio, error) {
	var d DatosAvisoEnvio
	err := r.pool.QueryRow(ctx, `
		SELECT e.id, e.codigo_guia, e.estado::text, COALESCE(ev.id::text, ''), dst.nombre, COALESCE(dst.telefono, ''),
		       trim(dst.calle || ' ' || dst.numero) || ', ' || dst.localidad,
		       ev.motivo::text, to_char(e.reprogramado_para, 'DD/MM/YYYY'), e.franja::text
		FROM envios e
		JOIN destinatarios dst ON dst.id = e.destinatario_id
		LEFT JOIN LATERAL (
			SELECT id, motivo FROM eventos_envio WHERE envio_id = e.id ORDER BY created_at DESC, id DESC LIMIT 1
		) ev ON true
		WHERE e.id::text = $1
	`, envioID).Scan(&d.EnvioID, &d.CodigoGuia, &d.Estado, &d.UltimoEventoID, &d.Destinatario, &d.Telefono,
		&d.Direccion, &d.Motivo, &d.ReprogramadoPara, &d.Franja)
	if errors.Is(err, pgx.ErrNoRows) {
		return DatosAvisoEnvio{}, ErrNoEncontrado
	}
	return d, err
}

// DatosAvisoRuta es lo necesario para avisarle al repartidor de su ruta.
type DatosAvisoRuta struct {
	RutaID     string
	Nombre     string
	Zona       string
	Fecha      string
	Repartidor string
	Telefono   string
	Envios     int
	Patente    string
}

// DatosAvisoRuta lee la ruta, su repartidor, cuántos envíos tiene y el vehículo.
func (r *WhatsappRepo) DatosAvisoRuta(ctx context.Context, rutaID string) (DatosAvisoRuta, error) {
	var d DatosAvisoRuta
	err := r.pool.QueryRow(ctx, `
		SELECT r.id, r.nombre, r.zona, to_char(r.fecha, 'DD/MM/YYYY'), u.nombre, COALESCE(u.telefono, ''),
		       (SELECT count(*) FROM envios WHERE ruta_id = r.id), COALESCE(v.patente, '')
		FROM rutas r
		JOIN usuarios u ON u.id = r.repartidor_id
		LEFT JOIN vehiculos v ON v.id = r.vehiculo_id
		WHERE r.id::text = $1
	`, rutaID).Scan(&d.RutaID, &d.Nombre, &d.Zona, &d.Fecha, &d.Repartidor, &d.Telefono, &d.Envios, &d.Patente)
	if errors.Is(err, pgx.ErrNoRows) {
		return DatosAvisoRuta{}, ErrNoEncontrado
	}
	return d, err
}

// Notificacion es un aviso a registrar.
type Notificacion struct {
	Clave    string
	Telefono string
	Tipo     string
	EnvioID  *string
	RutaID   *string
	Mensaje  string
	Estado   string
	Error    string
}

// RegistrarNotificacion guarda el aviso si su clave es nueva. Devuelve el id y
// false si ya existía (el aviso ya se mandó o se está mandando).
func (r *WhatsappRepo) RegistrarNotificacion(ctx context.Context, n Notificacion) (string, bool, error) {
	if n.Estado == "" {
		n.Estado = "pendiente"
	}
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO notificaciones_whatsapp (clave, telefono, tipo, envio_id, ruta_id, mensaje, estado, error)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''))
		ON CONFLICT (clave) DO NOTHING
		RETURNING id
	`, n.Clave, n.Telefono, n.Tipo, n.EnvioID, n.RutaID, n.Mensaje, n.Estado, n.Error).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

// ResultadoNotificacion marca el aviso como enviado o fallido.
func (r *WhatsappRepo) ResultadoNotificacion(ctx context.Context, id string, envioErr error) error {
	if envioErr == nil {
		_, err := r.pool.Exec(ctx, `UPDATE notificaciones_whatsapp SET estado = 'enviado', enviado_at = now() WHERE id = $1`, id)
		return err
	}
	_, err := r.pool.Exec(ctx, `UPDATE notificaciones_whatsapp SET estado = 'fallido', error = $2 WHERE id = $1`, id, envioErr.Error())
	return err
}

// NotificacionEnvio es un aviso ya registrado, para mostrar en el detalle del envío.
type NotificacionEnvio struct {
	Tipo      string    `json:"tipo"`
	Estado    string    `json:"estado"`
	Mensaje   string    `json:"mensaje"`
	Error     *string   `json:"error"`
	CreatedAt time.Time `json:"created_at"`
}

// NotificacionesDeEnvio lista los avisos de un envío, más nuevos primero. Nunca nil.
func (r *WhatsappRepo) NotificacionesDeEnvio(ctx context.Context, envioID string) ([]NotificacionEnvio, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT tipo, estado, mensaje, error, created_at FROM notificaciones_whatsapp
		WHERE envio_id::text = $1 ORDER BY created_at DESC
	`, envioID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]NotificacionEnvio, 0)
	for rows.Next() {
		var n NotificacionEnvio
		if err := rows.Scan(&n.Tipo, &n.Estado, &n.Mensaje, &n.Error, &n.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}
