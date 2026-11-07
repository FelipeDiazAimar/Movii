package domain

// Usuario representa a un usuario del sistema (operador, repartidor o supervisor).
type Usuario struct {
	ID           string
	Nombre       string
	Email        string
	PasswordHash string
	Rol          string
	Activo       bool
	// Telefono en formato internacional sin "+" (ej. 5493564123456); vacío si no tiene.
	Telefono string
}

const (
	RolOperador   = "operador"
	RolRepartidor = "repartidor"
	RolSupervisor = "supervisor"
)
