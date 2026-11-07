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
	ErrTelefonoEnUso         = errors.New("el telefono ya esta registrado")
)

// dummyPasswordHash es un hash bcrypt (costo 10) válido de una contraseña
// arbitraria que nunca se usa para autenticar a nadie. Login lo compara
// contra la contraseña recibida cuando el email no existe, únicamente para
// que esa rama pague el mismo costo de CPU (~150-300ms) que la comparación
// real. NO simplificar quitando esta llamada: sin ella, un email inexistente
// responde mucho más rápido que una contraseña incorrecta, y esa diferencia
// de tiempo es un oráculo que permite enumerar emails registrados — justo lo
// que CA-04 de HU-01 exige no revelar.
const dummyPasswordHash = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8N5g3.YoGjRSY6HZjhV9jGYVwtY9Wm"

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
	return s.RegisterConTelefono(ctx, nombre, email, password, rol, "")
}

// RegisterConTelefono es Register con el celular del usuario (para el acceso
// y los avisos por WhatsApp, HU-16/HU-17). telefono vacío = sin teléfono.
func (s *AuthService) RegisterConTelefono(ctx context.Context, nombre, email, password, rol, telefono string) (domain.Usuario, error) {
	if telefono != "" {
		var err error
		if telefono, err = NormalizarTelefonoAR(telefono); err != nil {
			return domain.Usuario{}, err
		}
	}
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
		Telefono:     telefono,
	})
	if errors.Is(err, repository.ErrDuplicado) {
		return domain.Usuario{}, ErrEmailEnUso
	}
	if errors.Is(err, repository.ErrTelefonoDuplicado) {
		return domain.Usuario{}, ErrTelefonoEnUso
	}
	return creado, err
}

// Login valida las credenciales y devuelve un JWT firmado si son correctas.
// No distingue entre "email no existe" y "password incorrecta" en el error
// devuelto, para no filtrar información (CA-04 de HU-01).
func (s *AuthService) Login(ctx context.Context, email, password string) (string, error) {
	u, err := s.VerificarCredenciales(ctx, email, password)
	if err != nil {
		return "", err
	}
	return s.EmitirToken(u)
}

// VerificarCredenciales valida email y contraseña y devuelve el usuario, sin
// emitir el token: el login en dos pasos (HU-16) lo emite recién después del
// código de WhatsApp.
func (s *AuthService) VerificarCredenciales(ctx context.Context, email, password string) (domain.Usuario, error) {
	u, err := s.repo.GetByEmail(ctx, email)
	if errors.Is(err, repository.ErrNoEncontrado) {
		// Comparación "dummy" para igualar el tiempo de respuesta con el
		// caso de contraseña incorrecta (ver comentario de dummyPasswordHash).
		_ = bcrypt.CompareHashAndPassword([]byte(dummyPasswordHash), []byte(password))
		return domain.Usuario{}, ErrCredencialesInvalidas
	}
	if err != nil {
		return domain.Usuario{}, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return domain.Usuario{}, ErrCredencialesInvalidas
	}

	// Un usuario dado de baja no puede iniciar sesión. Se chequea DESPUÉS de
	// validar la contraseña y con el mismo error genérico, para no convertir
	// la respuesta en un oráculo que revele qué cuentas existen (CA-04).
	if !u.Activo {
		return domain.Usuario{}, ErrCredencialesInvalidas
	}

	return u, nil
}

// EmitirToken firma el JWT de sesión del usuario (24 h). Lo usan el login con
// contraseña y el acceso con código por WhatsApp (HU-16).
func (s *AuthService) EmitirToken(u domain.Usuario) (string, error) {
	claims := jwt.MapClaims{
		"sub":    u.ID,
		"rol":    u.Rol,
		"nombre": u.Nombre,
		"exp":    time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}
