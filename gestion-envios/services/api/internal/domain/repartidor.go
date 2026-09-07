package domain

// EnvioDelDia es un envío en el contexto del listado del repartidor: incluye
// los datos del destinatario y el nombre de la ruta a la que pertenece.
type EnvioDelDia struct {
	Envio
	Destinatario Destinatario `json:"destinatario"`
	RutaNombre   string       `json:"ruta_nombre"`
}

// RutaConEnviosDelDia agrupa los envíos del día de un repartidor por ruta
// (HU-05, CA-03).
type RutaConEnviosDelDia struct {
	RutaID     string        `json:"ruta_id"`
	RutaNombre string        `json:"ruta_nombre"`
	Envios     []EnvioDelDia `json:"envios"`
}

// ResumenDelDia es la respuesta completa de HU-05: los envíos del repartidor
// agrupados por ruta más los contadores por estado (CA-05).
type ResumenDelDia struct {
	Fecha        string                `json:"fecha"`
	Rutas        []RutaConEnviosDelDia `json:"rutas"`
	Total        int                   `json:"total"`
	Pendientes   int                   `json:"pendientes"`
	Asignados    int                   `json:"asignados"`
	EnCamino     int                   `json:"en_camino"`
	Entregados   int                   `json:"entregados"`
	NoEntregados int                   `json:"no_entregados"`
}
