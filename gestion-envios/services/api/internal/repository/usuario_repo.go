package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
)

// ErrNoEncontrado indica que el registro buscado no existe.
var ErrNoEncontrado = errors.New("registro no encontrado")

// ErrDuplicado indica una violación de restricción UNIQUE (ej. email repetido).
var ErrDuplicado = errors.New("registro duplicado")

// ErrTelefonoDuplicado indica que otro usuario ya tiene ese teléfono.
var ErrTelefonoDuplicado = errors.New("telefono duplicado")

const pgUniqueViolation = "23505"

// UsuarioRepo accede a la tabla usuarios.
type UsuarioRepo struct {
	pool *pgxpool.Pool
}

// NewUsuarioRepo crea un UsuarioRepo sobre el pool dado.
func NewUsuarioRepo(pool *pgxpool.Pool) *UsuarioRepo {
	return &UsuarioRepo{pool: pool}
}

// Create inserta un usuario nuevo. Devuelve ErrDuplicado si el email ya existe.
func (r *UsuarioRepo) Create(ctx context.Context, u domain.Usuario) (domain.Usuario, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO usuarios (nombre, email, password_hash, rol, telefono)
		VALUES ($1, $2, $3, $4::rol_usuario, NULLIF($5, ''))
		RETURNING id, nombre, email, password_hash, rol, activo, COALESCE(telefono, '')
	`, u.Nombre, u.Email, u.PasswordHash, u.Rol, u.Telefono)

	var creado domain.Usuario
	err := row.Scan(&creado.ID, &creado.Nombre, &creado.Email, &creado.PasswordHash, &creado.Rol, &creado.Activo, &creado.Telefono)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			if pgErr.ConstraintName == "uq_usuarios_telefono" {
				return domain.Usuario{}, ErrTelefonoDuplicado
			}
			return domain.Usuario{}, ErrDuplicado
		}
		return domain.Usuario{}, err
	}
	return creado, nil
}

// GetByEmail busca un usuario por email. Devuelve ErrNoEncontrado si no existe.
func (r *UsuarioRepo) GetByEmail(ctx context.Context, email string) (domain.Usuario, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, nombre, email, password_hash, rol, activo, COALESCE(telefono, '')
		FROM usuarios WHERE email = $1
	`, email)

	var u domain.Usuario
	err := row.Scan(&u.ID, &u.Nombre, &u.Email, &u.PasswordHash, &u.Rol, &u.Activo, &u.Telefono)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Usuario{}, ErrNoEncontrado
	}
	if err != nil {
		return domain.Usuario{}, err
	}
	return u, nil
}

// List devuelve todos los usuarios ordenados por nombre.
func (r *UsuarioRepo) List(ctx context.Context) ([]domain.Usuario, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, nombre, email, password_hash, rol, activo, COALESCE(telefono, '')
		FROM usuarios ORDER BY nombre
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var usuarios []domain.Usuario
	for rows.Next() {
		var u domain.Usuario
		if err := rows.Scan(&u.ID, &u.Nombre, &u.Email, &u.PasswordHash, &u.Rol, &u.Activo, &u.Telefono); err != nil {
			return nil, err
		}
		usuarios = append(usuarios, u)
	}
	return usuarios, rows.Err()
}

// GetByID busca un usuario por id. Devuelve ErrNoEncontrado si no existe.
func (r *UsuarioRepo) GetByID(ctx context.Context, id string) (domain.Usuario, error) {
	return r.unoPor(ctx, "id::text", id)
}

// GetByTelefono busca un usuario por teléfono (formato internacional sin "+").
func (r *UsuarioRepo) GetByTelefono(ctx context.Context, telefono string) (domain.Usuario, error) {
	return r.unoPor(ctx, "telefono", telefono)
}

func (r *UsuarioRepo) unoPor(ctx context.Context, columna, valor string) (domain.Usuario, error) {
	var u domain.Usuario
	err := r.pool.QueryRow(ctx, `
		SELECT id, nombre, email, password_hash, rol, activo, COALESCE(telefono, '')
		FROM usuarios WHERE `+columna+` = $1
	`, valor).Scan(&u.ID, &u.Nombre, &u.Email, &u.PasswordHash, &u.Rol, &u.Activo, &u.Telefono)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Usuario{}, ErrNoEncontrado
	}
	return u, err
}

// ActualizarTelefono fija (o borra, con "") el teléfono del usuario.
// ErrNoEncontrado si no existe; ErrDuplicado si otro usuario ya lo tiene.
func (r *UsuarioRepo) ActualizarTelefono(ctx context.Context, id, telefono string) error {
	tag, err := r.pool.Exec(ctx, `UPDATE usuarios SET telefono = NULLIF($2, '') WHERE id::text = $1`, id, telefono)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
		return ErrTelefonoDuplicado
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNoEncontrado
	}
	return nil
}
