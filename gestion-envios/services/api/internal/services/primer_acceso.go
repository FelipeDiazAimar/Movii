package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"
	"unicode"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// T1 (primer acceso con cambio de contraseña) y T2 (login con Google).

var (
	// ErrPasswordDebil: la contraseña nueva no cumple las reglas (8+ caracteres, una mayúscula y un número).
	ErrPasswordDebil = errors.New("password debil")
	// ErrPrimerAccesoInvalido: el token de primer acceso no es válido, venció o el primer acceso ya se completó.
	ErrPrimerAccesoInvalido = errors.New("primer acceso invalido")
	// ErrCuentaInactiva: el usuario está dado de baja.
	ErrCuentaInactiva = errors.New("cuenta inactiva")
	// ErrPasswordActualIncorrecta: al cambiar la contraseña, la actual no coincide.
	ErrPasswordActualIncorrecta = errors.New("password actual incorrecta")
	// ErrPasswordRepetida: la contraseña nueva es igual a la actual.
	ErrPasswordRepetida = errors.New("password repetida")
	// ErrGoogleOtraCuenta: el email ya está vinculado a otra cuenta de Google.
	ErrGoogleOtraCuenta = errors.New("email vinculado a otra cuenta de google")
)

const (
	scopePrimerAcceso    = "primer_acceso"
	vigenciaPrimerAcceso = 15 * time.Minute
)

// cuentasRepo es lo que el primer acceso y el login con Google necesitan de
// la base, además de usuarioRepo (repository.UsuarioRepo lo implementa).
type cuentasRepo interface {
	GetByID(ctx context.Context, id string) (domain.Usuario, error)
	ActualizarPassword(ctx context.Context, id, hash string) error
	BuscarParaGoogle(ctx context.Context, googleID, email string) (domain.Usuario, error)
	VincularGoogle(ctx context.Context, id, googleID string) error
}

var errSinCuentas = errors.New("auth: el repositorio no soporta primer acceso ni Google")

// ValidarPassword aplica las reglas de la contraseña elegida por el usuario.
func ValidarPassword(p string) error {
	var mayus, numero bool
	for _, r := range p {
		mayus = mayus || unicode.IsUpper(r)
		numero = numero || unicode.IsDigit(r)
	}
	// 72 bytes es el máximo que bcrypt acepta.
	if len([]rune(p)) < 8 || len(p) > 72 || !mayus || !numero {
		return ErrPasswordDebil
	}
	return nil
}

// EmitirTokenPrimerAcceso firma el token que devuelve el 428 del login: solo
// sirve para POST /auth/primer-acceso/cambiar-password (no lleva rol y
// RequireAuth rechaza cualquier token con "scope"), y vence a los 15 minutos.
func (s *AuthService) EmitirTokenPrimerAcceso(u domain.Usuario) (string, error) {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   u.ID,
		"scope": scopePrimerAcceso,
		"exp":   time.Now().Add(vigenciaPrimerAcceso).Unix(),
	}).SignedString([]byte(s.jwtSecret))
}

// CambiarPasswordPrimerAcceso valida el token del 428, que el usuario siga con
// el primer acceso pendiente y las reglas de la contraseña, y la guarda. El
// flag must_change_password sigue en true hasta que valide el código.
func (s *AuthService) CambiarPasswordPrimerAcceso(ctx context.Context, token, userID, nueva string) (domain.Usuario, error) {
	if s.cuentas == nil {
		return domain.Usuario{}, errSinCuentas
	}
	claims := jwt.MapClaims{}
	t, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (any, error) { return []byte(s.jwtSecret), nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithExpirationRequired())
	sub, _ := claims["sub"].(string)
	if err != nil || !t.Valid || claims["scope"] != scopePrimerAcceso || sub == "" || (userID != "" && userID != sub) {
		return domain.Usuario{}, ErrPrimerAccesoInvalido
	}
	u, err := s.cuentas.GetByID(ctx, sub)
	if errors.Is(err, repository.ErrNoEncontrado) {
		return domain.Usuario{}, ErrPrimerAccesoInvalido
	}
	if err != nil {
		return domain.Usuario{}, err
	}
	if !u.Activo || !u.MustChangePassword {
		return domain.Usuario{}, ErrPrimerAccesoInvalido
	}
	if err := ValidarPassword(nueva); err != nil {
		return domain.Usuario{}, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(nueva), 10)
	if err != nil {
		return domain.Usuario{}, err
	}
	if err := s.cuentas.ActualizarPassword(ctx, u.ID, string(hash)); err != nil {
		return domain.Usuario{}, err
	}
	u.PasswordHash = string(hash)
	return u, nil
}

// CambiarPassword cambia la contraseña de un usuario con sesión: pide la
// actual (así un celular olvidado desbloqueado no alcanza para cambiarla) y
// aplica las mismas reglas que el primer acceso.
func (s *AuthService) CambiarPassword(ctx context.Context, userID, actual, nueva string) error {
	if s.cuentas == nil {
		return errSinCuentas
	}
	u, err := s.cuentas.GetByID(ctx, userID)
	if errors.Is(err, repository.ErrNoEncontrado) {
		return ErrPasswordActualIncorrecta
	}
	if err != nil {
		return err
	}
	if !u.Activo {
		return ErrCuentaInactiva
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(actual)) != nil {
		return ErrPasswordActualIncorrecta
	}
	if actual == nueva {
		return ErrPasswordRepetida
	}
	if err := ValidarPassword(nueva); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(nueva), 10)
	if err != nil {
		return err
	}
	return s.cuentas.ActualizarPassword(ctx, u.ID, string(hash))
}

// PerfilGoogle es lo que se usa del id_token de Google (ya validado).
type PerfilGoogle struct {
	Sub    string
	Email  string
	Nombre string
}

// LoginGoogle busca la cuenta del perfil (por google_id o por email) y la
// vincula si todavía no tenía Google; si no existe, crea un operador sin
// contraseña usable (T2). El llamador decide si hace falta el código (primer
// acceso pendiente) o emite el token.
func (s *AuthService) LoginGoogle(ctx context.Context, p PerfilGoogle) (domain.Usuario, error) {
	if s.cuentas == nil {
		return domain.Usuario{}, errSinCuentas
	}
	email := strings.ToLower(strings.TrimSpace(p.Email))
	u, err := s.cuentas.BuscarParaGoogle(ctx, p.Sub, email)
	if errors.Is(err, repository.ErrNoEncontrado) {
		// Contraseña aleatoria que nadie conoce: la cuenta entra solo con Google.
		b := make([]byte, 32)
		if _, err := rand.Read(b); err != nil {
			return domain.Usuario{}, err
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(hex.EncodeToString(b)), 10)
		if err != nil {
			return domain.Usuario{}, err
		}
		nombre := strings.TrimSpace(p.Nombre)
		if nombre == "" {
			nombre, _, _ = strings.Cut(email, "@")
		}
		return s.repo.Create(ctx, domain.Usuario{
			Nombre: nombre, Email: email, PasswordHash: string(hash), Rol: domain.RolOperador,
			GoogleID: p.Sub, AuthProvider: "google",
		})
	}
	if err != nil {
		return domain.Usuario{}, err
	}
	if !u.Activo {
		return domain.Usuario{}, ErrCuentaInactiva
	}
	if u.GoogleID != "" && u.GoogleID != p.Sub {
		return domain.Usuario{}, ErrGoogleOtraCuenta
	}
	if u.GoogleID == "" {
		if err := s.cuentas.VincularGoogle(ctx, u.ID, p.Sub); err != nil {
			return domain.Usuario{}, err
		}
		u.GoogleID = p.Sub
	}
	return u, nil
}
