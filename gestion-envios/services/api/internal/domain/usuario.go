package domain

// Usuario representa a un usuario del sistema (operador, repartidor o admin).
type Usuario struct {
	ID           string
	Nombre       string
	Email        string
	PasswordHash string
	Rol          string
	Activo       bool
	// Telefono en formato internacional sin "+" (ej. 5493564123456); vacío si no tiene.
	Telefono string
	// MustChangePassword: primer acceso pendiente (T1). Lo pone en true el alta
	// por admin/API; vuelve a false recién después del código de verificación.
	MustChangePassword bool
	// GoogleID es el "sub" de la cuenta de Google vinculada (T2); vacío si no tiene.
	GoogleID string
	// AuthProvider es "password" o "google" (cómo se creó la cuenta).
	AuthProvider string
}

const (
	RolOperador   = "operador"
	RolRepartidor = "repartidor"
	RolAdmin      = "admin"
)
