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
		INSERT INTO usuarios (nombre, email, password_hash, rol)
		VALUES ($1, $2, $3, $4)
		RETURNING id, nombre, email, password_hash, rol, activo
	`, u.Nombre, u.Email, u.PasswordHash, u.Rol)

	var creado domain.Usuario
	err := row.Scan(&creado.ID, &creado.Nombre, &creado.Email, &creado.PasswordHash, &creado.Rol, &creado.Activo)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return domain.Usuario{}, ErrDuplicado
		}
		return domain.Usuario{}, err
	}
	return creado, nil
}

// GetByEmail busca un usuario por email. Devuelve ErrNoEncontrado si no existe.
func (r *UsuarioRepo) GetByEmail(ctx context.Context, email string) (domain.Usuario, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, nombre, email, password_hash, rol, activo
		FROM usuarios WHERE email = $1
	`, email)

	var u domain.Usuario
	err := row.Scan(&u.ID, &u.Nombre, &u.Email, &u.PasswordHash, &u.Rol, &u.Activo)
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
		SELECT id, nombre, email, password_hash, rol, activo
		FROM usuarios ORDER BY nombre
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var usuarios []domain.Usuario
	for rows.Next() {
		var u domain.Usuario
		if err := rows.Scan(&u.ID, &u.Nombre, &u.Email, &u.PasswordHash, &u.Rol, &u.Activo); err != nil {
			return nil, err
		}
		usuarios = append(usuarios, u)
	}
	return usuarios, rows.Err()
}
