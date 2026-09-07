package domain

// Ruta es un recorrido de reparto diario asignado a un repartidor.
type Ruta struct {
	ID           string `json:"id"`
	Nombre       string `json:"nombre"`
	Zona         string `json:"zona"`
	Fecha        string `json:"fecha"` // formato "YYYY-MM-DD"
	Estado       string `json:"estado"`
	RepartidorID string `json:"repartidor_id"`
}

// RutaConConteo agrega la cantidad de envíos asignados, usada en el listado.
type RutaConConteo struct {
	Ruta
	CantidadEnvios int `json:"cantidad_envios"`
}

const (
	EstadoRutaPlanificada = "planificada"
	EstadoRutaEnCurso     = "en_curso"
	EstadoRutaCompletada  = "completada"
)
