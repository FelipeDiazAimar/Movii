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
	// Email opcional: respaldo de los avisos cuando no hay WhatsApp.
	Email string `json:"email"`
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
	FechaEntrega   string  `json:"fecha_entrega"` // "YYYY-MM-DD": día en que se entrega
	RutaID         *string `json:"ruta_id"`       // nil si el envío todavía no fue asignado a una ruta
}

// EnvioConDetalle agrega los datos del destinatario y la fecha de alta,
// usados en listados y detalle (CA-05 de HU-02 pide mostrar la fecha de
// creación junto al código de guía, destinatario, dirección y estado).
type EnvioConDetalle struct {
	Envio
	Destinatario  Destinatario `json:"destinatario"`
	FechaCreacion string       `json:"fecha_creacion"`
	// Ruta y repartidor asignados (vacíos si el envío no tiene ruta): envío → ruta → repartidor.
	RutaNombre       string `json:"ruta_nombre,omitempty"`
	RepartidorNombre string `json:"repartidor_nombre,omitempty"`
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
	ID             string  `json:"id"`
	Fecha          string  `json:"fecha"`
	ActorNombre    *string `json:"actor_nombre"`
	EstadoAnterior *string `json:"estado_anterior"`
	EstadoNuevo    string  `json:"estado_nuevo"`
	Motivo         *string `json:"motivo"`
	Comentario     *string `json:"comentario"`
	// TieneFoto indica si el evento tiene foto (incidencias HU-07,
	// columna foto de la migración 0005). Nunca es null: false en
	// eventos viejos o sin foto. La foto en sí se descarga por el
	// binario GET /envios/{id}/eventos/{eventoId}/foto.
	TieneFoto bool `json:"tiene_foto"`
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

// TrackingEvento es un evento legible para el cliente final (HU-10,
// schema TrackingEvento del openapi). Solo lleva fecha, descripción y
// motivo opcional: NUNCA actor, comentarios internos, fotos, teléfonos,
// emails ni dirección exacta (el repo ni siquiera selecciona esas
// columnas — garantía en tiempo de compilación). Motivo se omite cuando
// es nil (omitempty, como el ejemplo del openapi).
type TrackingEvento struct {
	Fecha       string  `json:"fecha"`
	Descripcion string  `json:"descripcion"`
	Motivo      *string `json:"motivo,omitempty"`
}

// TrackingResponse es la respuesta de GET /tracking/{codigo} (HU-10,
// schema TrackingResponse del openapi). Solo columnas blancas:
// codigo_guia, estado, localidad, actualizado_en e historial.
// Historial nunca es nil: serializa como [] cuando está vacío.
type TrackingResponse struct {
	CodigoGuia    string           `json:"codigo_guia"`
	Estado        string           `json:"estado"`
	Localidad     string           `json:"localidad"`
	ActualizadoEn string           `json:"actualizado_en"`
	Historial     []TrackingEvento `json:"historial"`

	// Datos extra para el cliente (todos opcionales): fecha y franja de
	// entrega, el paquete y, mientras el envío está en reparto, el vehículo en
	// vivo con el recorrido y la hora estimada de llegada.
	FechaEntrega string           `json:"fecha_entrega,omitempty"`
	Franja       string           `json:"franja,omitempty"`
	EntregadoEn  string           `json:"entregado_en,omitempty"`
	Paquete      *TrackingPaquete `json:"paquete,omitempty"`
	EnVivo       *TrackingEnVivo  `json:"en_vivo,omitempty"`
}

// TrackingPaquete describe el paquete sin datos de personas.
type TrackingPaquete struct {
	Peso    float64 `json:"peso"`
	Tamano  string  `json:"tamano"`
	Fragil  bool    `json:"fragil"`
	Urgente bool    `json:"urgente"`
}

// TrackingVehiculo es el vehículo que lleva el envío: tipo, modelo, color,
// patente parcial y su última posición. Nunca el repartidor.
type TrackingVehiculo struct {
	Tipo      string  `json:"tipo"`
	Modelo    string  `json:"modelo"`
	Color     string  `json:"color"`
	Patente   string  `json:"patente"` // parcial: AB•••CD
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	Rumbo     float64 `json:"rumbo"`
	Velocidad float64 `json:"velocidad"`
	En        string  `json:"en"`
}

// TrackingEnVivo es el seguimiento mientras el envío está en reparto. El
// destino va redondeado (~100 m) y el recorrido se corta antes de llegar,
// para no revelar la dirección exacta.
type TrackingEnVivo struct {
	Vehiculo     TrackingVehiculo `json:"vehiculo"`
	Destino      *Coordenadas     `json:"destino"`
	Recorrido    *RecorridoMapa   `json:"recorrido"`
	ParadasAntes int              `json:"paradas_antes"`
	// Ventana estimada de llegada (RFC 3339, UTC) y minutos hasta el centro de la ventana.
	EtaDesde   string `json:"eta_desde,omitempty"`
	EtaHasta   string `json:"eta_hasta,omitempty"`
	EtaMinutos int    `json:"eta_minutos,omitempty"`
}

const (
	TamanoChico   = "chico"
	TamanoMediano = "mediano"
	TamanoGrande  = "grande"
)
