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
	Historial        []EventoEnvio         `json:"historial"`
	ReprogramadoPara *string               `json:"reprogramado_para"`
	Franja           *string               `json:"franja"`
	Confirmacion     *ConfirmacionMetadata `json:"confirmacion"`
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

// Relación del receptor con el destinatario (HU-08). Lista cerrada: coincide
// con el enum relacion_receptor de la migración 0004 y con RelacionReceptor
// del openapi.
const (
	RelacionDestinatario = "destinatario"
	RelacionFamiliar     = "familiar"
	RelacionVecino       = "vecino"
	RelacionEncargado    = "encargado"
)

// MaxImagenBytes es el tamaño máximo por imagen de evidencia (HU-08):
// 5 MB para la firma y 5 MB para la foto, por separado.
const MaxImagenBytes = 5 * 1024 * 1024

// Confirmacion es la evidencia de entrega de un envío (tabla
// confirmaciones_entrega, migración 0004; HU-08). Una fila por envío
// entregado (PK = envio_id: no hay doble confirmación). ConfirmadaAt usa
// el mismo formato UTC que los eventos (to_char ... "Z").
type Confirmacion struct {
	EnvioID          string
	ReceptorNombre   string
	ReceptorRelacion string
	Firma            []byte
	Foto             []byte
	ConfirmadaPor    *string
	ConfirmadaAt     string
}

// ConfirmacionMetadata es la evidencia sin bytes para el detalle del envío
// (schema ConfirmacionMetadata del openapi; HU-08 Task 4 la expone en
// EnvioDetalle con las URLs binarias /confirmacion/firma y /foto).
type ConfirmacionMetadata struct {
	ReceptorNombre   string `json:"receptor_nombre"`
	ReceptorRelacion string `json:"receptor_relacion"`
	ConfirmadaAt     string `json:"confirmada_at"`
	FirmaURL         string `json:"firma_url"`
	FotoURL          string `json:"foto_url"`
}

const (
	TamanoChico   = "chico"
	TamanoMediano = "mediano"
	TamanoGrande  = "grande"
)
