package domain

// Periodo es el rango de fechas (YYYY-MM-DD, ambos inclusive, en UTC) de un reporte.
type Periodo struct {
	Desde string `json:"desde"`
	Hasta string `json:"hasta"`
}

// FilaReporteEnvio es una fila del reporte de envíos (HU-13).
type FilaReporteEnvio struct {
	CodigoGuia          string  `json:"codigo_guia"`
	FechaCreacion       string  `json:"fecha_creacion"`
	Remitente           string  `json:"remitente"`
	Destinatario        string  `json:"destinatario"`
	Direccion           string  `json:"direccion"`
	Localidad           string  `json:"localidad"`
	Estado              string  `json:"estado"`
	UltimaActualizacion string  `json:"ultima_actualizacion"`
	MotivoFallo         *string `json:"motivo_fallo"` // última incidencia, nil si nunca falló
}

// ReporteEnvios es la respuesta JSON de GET /reportes/envios (HU-13).
type ReporteEnvios struct {
	Periodo Periodo            `json:"periodo"`
	Total   int                `json:"total"`
	Envios  []FilaReporteEnvio `json:"envios"`
}

// DesempenoRepartidor es una fila del ranking (HU-14).
type DesempenoRepartidor struct {
	Posicion     int    `json:"posicion"`
	RepartidorID string `json:"repartidor_id"`
	Nombre       string `json:"nombre"`
	// Asignados = entregados + fallidos + envíos que todavía tiene en curso.
	Asignados       int     `json:"asignados"`
	Entregados      int     `json:"entregados"`
	Fallidos        int     `json:"fallidos"`
	TasaEfectividad float64 `json:"tasa_efectividad"`
	// Minutos promedio entre "en camino" y "entregado"; nil si no hay entregas medibles.
	PromedioMinutosEntrega *float64 `json:"promedio_minutos_entrega"`
}

// RankingRepartidores es la respuesta de GET /reportes/repartidores (HU-14).
type RankingRepartidores struct {
	Periodo Periodo               `json:"periodo"`
	Ranking []DesempenoRepartidor `json:"ranking"`
}

// MotivoIncidencia es una barra del Pareto de incidencias (HU-15).
type MotivoIncidencia struct {
	Motivo     string  `json:"motivo"`
	Etiqueta   string  `json:"etiqueta"`
	Cantidad   int     `json:"cantidad"`
	Porcentaje float64 `json:"porcentaje"`
}

// ReporteIncidencias es la respuesta de GET /reportes/incidencias (HU-15).
type ReporteIncidencias struct {
	Periodo          Periodo            `json:"periodo"`
	TotalIncidencias int                `json:"total_incidencias"`
	Distribucion     []MotivoIncidencia `json:"distribucion"`
}

// EtiquetasMotivo traduce el motivo de fallo para reportes y alertas.
var EtiquetasMotivo = map[string]string{
	MotivoClienteAusente:      "Destinatario ausente",
	MotivoDireccionIncorrecta: "Dirección incorrecta",
	MotivoRechazado:           "Rechazado por destinatario",
	MotivoZonaInsegura:        "Zona insegura",
	MotivoOtro:                "Otro motivo",
}

// MotivosFallo es el orden canónico de los motivos (lista cerrada de HU-07).
var MotivosFallo = []string{MotivoClienteAusente, MotivoDireccionIncorrecta, MotivoRechazado, MotivoZonaInsegura, MotivoOtro}
