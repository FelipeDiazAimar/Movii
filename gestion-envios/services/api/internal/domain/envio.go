package domain

// Remitente es quien origina un envío.
type Remitente struct {
	ID        string
	Nombre    string
	Telefono  string
	Direccion string
}

// Destinatario es quien recibe un envío.
type Destinatario struct {
	ID           string
	Nombre       string
	Telefono     string
	Calle        string
	Numero       string
	PisoDepto    string
	Localidad    string
	CodigoPostal string
}

// Envio representa un paquete a entregar.
type Envio struct {
	ID             string
	CodigoGuia     string
	Estado         string
	Peso           float64
	Tamano         string
	TipoContenido  string
	Fragil         bool
	Urgente        bool
	RemitenteID    string
	DestinatarioID string
	RutaID         *string // nil si el envío todavía no fue asignado a una ruta
}

// EnvioConDetalle agrega los datos del destinatario, usados en listados y detalle.
type EnvioConDetalle struct {
	Envio
	Destinatario Destinatario
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
