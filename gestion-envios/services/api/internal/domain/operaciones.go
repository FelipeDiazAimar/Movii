package domain

// MetricasDia son los contadores del panel de operaciones (HU-11).
type MetricasDia struct {
	TotalEnvios  int `json:"total_envios"`
	Pendientes   int `json:"pendientes"`
	Asignados    int `json:"asignados"`
	EnCamino     int `json:"en_camino"`
	Entregados   int `json:"entregados"`
	NoEntregados int `json:"no_entregados"`
	// Entregados sobre intentos resueltos (entregados + no entregados), en %.
	PorcentajeEfectividad float64 `json:"porcentaje_efectividad"`
}

// RutaActiva es el avance de una ruta del día en el panel (HU-11).
type RutaActiva struct {
	RutaID           string  `json:"ruta_id"`
	Nombre           string  `json:"nombre"`
	RepartidorNombre string  `json:"repartidor_nombre"`
	TotalParadas     int     `json:"total_paradas"`
	Completadas      int     `json:"completadas"` // entregadas + no entregadas
	PorcentajeAvance float64 `json:"porcentaje_avance"`
	EstadoRuta       string  `json:"estado_ruta"`
}

// Alerta es una incidencia reciente del día (HU-11).
type Alerta struct {
	EnvioID     string `json:"envio_id"`
	CodigoGuia  string `json:"codigo_guia"`
	Tipo        string `json:"tipo"`
	Descripcion string `json:"descripcion"`
	Fecha       string `json:"fecha"`
}

// DashboardOperaciones es la respuesta de GET /operaciones/dashboard (HU-11).
type DashboardOperaciones struct {
	Fecha          string       `json:"fecha"`
	Metricas       MetricasDia  `json:"metricas"`
	RutasActivas   []RutaActiva `json:"rutas_activas"`
	UltimasAlertas []Alerta     `json:"ultimas_alertas"`
}

// Coordenadas de un destino (HU-12).
type Coordenadas struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// ParadaMapa es un envío de la ruta ubicado en el mapa (HU-12). Coordenadas
// es nil si el destino todavía no está geolocalizado.
type ParadaMapa struct {
	Orden              int          `json:"orden"`
	EnvioID            string       `json:"envio_id"`
	CodigoGuia         string       `json:"codigo_guia"`
	Estado             string       `json:"estado"`
	DestinatarioNombre string       `json:"destinatario_nombre"`
	Direccion          string       `json:"direccion"`
	Localidad          string       `json:"localidad"`
	Coordenadas        *Coordenadas `json:"coordenadas"`
}

// RepartidorRef identifica al repartidor de una ruta.
type RepartidorRef struct {
	ID     string `json:"id"`
	Nombre string `json:"nombre"`
}

// RutaMapa es la respuesta de GET /rutas/{id}/mapa (HU-12).
type RutaMapa struct {
	RutaID     string        `json:"ruta_id"`
	Nombre     string        `json:"nombre"`
	Fecha      string        `json:"fecha"`
	Repartidor RepartidorRef `json:"repartidor"`
	Paradas    []ParadaMapa  `json:"paradas"`
}
