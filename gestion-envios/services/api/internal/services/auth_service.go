package services

import (
	"context"
	"errors"
	"net/mail"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

var (
	ErrEmailInvalido         = errors.New("email invalido")
	ErrRolInvalido           = errors.New("rol invalido")
	ErrEmailEnUso            = errors.New("el email ya esta registrado")
	ErrCredencialesInvalidas = errors.New("credenciales invalidas")
)

// usuarioRepo es lo mínimo que AuthService necesita de un repositorio de
// usuarios. UsuarioRepo (repository.UsuarioRepo) lo implementa; los tests
// usan un fake.
type usuarioRepo interface {
	Create(ctx context.Context, u domain.Usuario) (domain.Usuario, error)
	GetByEmail(ctx context.Context, email string) (domain.Usuario, error)
}

// AuthService contiene la lógica de negocio de HU-01 (registro y login).
type AuthService struct {
	repo      usuarioRepo
	jwtSecret string
}

// NewAuthService crea un AuthService.
func NewAuthService(repo usuarioRepo, jwtSecret string) *AuthService {
	return &AuthService{repo: repo, jwtSecret: jwtSecret}
}

var rolesValidos = map[string]bool{
	domain.RolOperador:   true,
	domain.RolRepartidor: true,
	domain.RolSupervisor: true,
}

// Register valida y crea un usuario nuevo con la contraseña hasheada.
func (s *AuthService) Register(ctx context.Context, nombre, email, password, rol string) (domain.Usuario, error) {
	if _, err := mail.ParseAddress(email); err != nil {
		return domain.Usuario{}, ErrEmailInvalido
	}
	if !rolesValidos[rol] {
		return domain.Usuario{}, ErrRolInvalido
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		return domain.Usuario{}, err
	}

	creado, err := s.repo.Create(ctx, domain.Usuario{
		Nombre:       nombre,
		Email:        email,
		PasswordHash: string(hash),
		Rol:          rol,
	})
	if errors.Is(err, repository.ErrDuplicado) {
		return domain.Usuario{}, ErrEmailEnUso
	}
	return creado, err
}

// Login valida las credenciales y devuelve un JWT firmado si son correctas.
// No distingue entre "email no existe" y "password incorrecta" en el error
// devuelto, para no filtrar información (CA-04 de HU-01).
func (s *AuthService) Login(ctx context.Context, email, password string) (string, error) {
	u, err := s.repo.GetByEmail(ctx, email)
	if errors.Is(err, repository.ErrNoEncontrado) {
		return "", ErrCredencialesInvalidas
	}
	if err != nil {
		return "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return "", ErrCredencialesInvalidas
	}

	claims := jwt.MapClaims{
		"sub": u.ID,
		"rol": u.Rol,
		"exp": time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}
