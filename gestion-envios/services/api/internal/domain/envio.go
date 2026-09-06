package domain

// Remitente es quien origina un envío.
type Remitente struct {
	ID        string `json:"id"`
	Nombre    string `json:"nombre"`
	Telefono  string `json:"telefono"`
	Direccion string `json:"direccion"`
}

// Destinatario es quien recibe un envío.
type Destinatario struct {
	ID           string `json:"id"`
	Nombre       string `json:"nombre"`
	Telefono     string `json:"telefono"`
	Calle        string `json:"calle"`
	Numero       string `json:"numero"`
	PisoDepto    string `json:"piso_depto"`
	Localidad    string `json:"localidad"`
	CodigoPostal string `json:"codigo_postal"`
}

// Envio representa un paquete a entregar.
type Envio struct {
	ID             string  `json:"id"`
	CodigoGuia     string  `json:"codigo_guia"`
	Estado         string  `json:"estado"`
	Peso           float64 `json:"peso"`
	Tamano         string  `json:"tamano"`
	TipoContenido  string  `json:"tipo_contenido"`
	Fragil         bool    `json:"fragil"`
	Urgente        bool    `json:"urgente"`
	RemitenteID    string  `json:"remitente_id"`
	DestinatarioID string  `json:"destinatario_id"`
	RutaID         *string `json:"ruta_id"` // nil si el envío todavía no fue asignado a una ruta
}

// EnvioConDetalle agrega los datos del destinatario, usados en listados y detalle.
type EnvioConDetalle struct {
	Envio
	Destinatario Destinatario `json:"destinatario"`
}

const (
	EstadoEnvioPendiente   = "pendiente"
	EstadoEnvioAsignado    = "asignado"
	EstadoEnvioEnCamino    = "en_camino"
	EstadoEnvioEntregado   = "entregado"
	EstadoEnvioNoEntregado = "no_entregado"
)

const (
	TamanoChico   = "chico"
	TamanoMediano = "mediano"
	TamanoGrande  = "grande"
)
