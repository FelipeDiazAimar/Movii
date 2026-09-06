package domain

// Ruta es un recorrido de reparto diario asignado a un repartidor.
type Ruta struct {
	ID           string
	Nombre       string
	Zona         string
	Fecha        string // formato "YYYY-MM-DD"
	Estado       string
	RepartidorID string
}

// RutaConConteo agrega la cantidad de envíos asignados, usada en el listado.
type RutaConConteo struct {
	Ruta
	CantidadEnvios int
}

const (
	EstadoRutaPlanificada = "planificada"
	EstadoRutaEnCurso     = "en_curso"
	EstadoRutaCompletada  = "completada"
)
