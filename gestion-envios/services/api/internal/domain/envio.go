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

// EnvioConDetalle agrega los datos del destinatario y la fecha de alta,
// usados en listados y detalle (CA-05 de HU-02 pide mostrar la fecha de
// creación junto al código de guía, destinatario, dirección y estado).
type EnvioConDetalle struct {
	Envio
	Destinatario  Destinatario `json:"destinatario"`
	FechaCreacion string       `json:"fecha_creacion"`
}

// EnvioDetalle es el detalle extendido del Sprint 2 (Task 5, HU-06/HU-07):
// aditivo sobre EnvioConDetalle, suma el historial de eventos
// (schema EnvioDetalle del openapi; reprogramado_para/franja/confirmacion
// los agregan planes siguientes). Historial nunca es nil: serializa como []
// cuando está vacío.
type EnvioDetalle struct {
	EnvioConDetalle
	Historial        []EventoEnvio `json:"historial"`
	ReprogramadoPara *string       `json:"reprogramado_para"`
	Franja           *string       `json:"franja"`
}

const (
	EstadoEnvioPendiente   = "pendiente"
	EstadoEnvioAsignado    = "asignado"
	EstadoEnvioEnCamino    = "en_camino"
	EstadoEnvioEntregado   = "entregado"
	EstadoEnvioNoEntregado = "no_entregado"
)

// EventoEnvio es una fila del historial del envío (tabla eventos_envio,
// migración 0003; HU-06/HU-07). Los campos nullables de la base se
// representan con punteros: nil equivale a NULL.
type EventoEnvio struct {
	Fecha          string  `json:"fecha"`
	ActorNombre    *string `json:"actor_nombre"`
	EstadoAnterior *string `json:"estado_anterior"`
	EstadoNuevo    string  `json:"estado_nuevo"`
	Motivo         *string `json:"motivo"`
	Comentario     *string `json:"comentario"`
}

// Motivos de fallo de entrega (HU-07). Lista cerrada: coincide con el enum
// motivo_fallo de la migración 0003 y con MotivoFallo del openapi.
const (
	MotivoClienteAusente      = "cliente_ausente"
	MotivoDireccionIncorrecta = "direccion_incorrecta"
	MotivoRechazado           = "rechazado"
	MotivoZonaInsegura        = "zona_insegura"
	MotivoOtro                = "otro"
)

// Franjas horarias de reprogramación (HU-09). Coinciden con el enum
// franja_horaria de la migración 0004 y con FranjaHoraria del openapi.
const (
	FranjaManana = "manana"
	FranjaTarde  = "tarde"
	FranjaNoche  = "noche"
)

const (
	TamanoChico   = "chico"
	TamanoMediano = "mediano"
	TamanoGrande  = "grande"
)
