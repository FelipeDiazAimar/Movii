package domain

// Usuario representa a un usuario del sistema (operador, repartidor o supervisor).
type Usuario struct {
	ID           string
	Nombre       string
	Email        string
	PasswordHash string
	Rol          string
	Activo       bool
}

const (
	RolOperador   = "operador"
	RolRepartidor = "repartidor"
	RolSupervisor = "supervisor"
)
