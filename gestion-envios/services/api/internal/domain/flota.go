package domain

import "time"

// Estados y tipos de vehículo (CHECK de la tabla vehiculos, migración 0007).
const (
	EstadoVehiculoActivo        = "activo"
	EstadoVehiculoEnBase        = "en_base"
	EstadoVehiculoMantenimiento = "mantenimiento"
)

// TiposVehiculo es la lista cerrada de tipos de vehículo.
var TiposVehiculo = []string{"camion", "furgon", "utilitario", "moto", "camioneta", "auto"}

// EstadosVehiculo es la lista cerrada de estados de vehículo.
var EstadosVehiculo = []string{EstadoVehiculoActivo, EstadoVehiculoEnBase, EstadoVehiculoMantenimiento}

// Vehiculo es una unidad de la flota con su telemetría y la carga de la ruta
// que tiene asignada en el día consultado (HU-18).
type Vehiculo struct {
	ID               string    `json:"id"`
	Patente          string    `json:"patente"`
	Modelo           string    `json:"modelo"`
	Tipo             string    `json:"tipo"`
	CapacidadPeso    float64   `json:"capacidad_peso"`
	CapacidadVolumen float64   `json:"capacidad_volumen"`
	Estado           string    `json:"estado"`
	Color            string    `json:"color"` // #RRGGBB; vacío = automático
	Latitud          float64   `json:"latitud"`
	Longitud         float64   `json:"longitud"`
	Velocidad        float64   `json:"velocidad"`
	Rumbo            float64   `json:"rumbo"`
	Temperatura      float64   `json:"temperatura"`
	PosicionAt       time.Time `json:"posicion_at"`

	// Ruta del día (nil si el vehículo no tiene ruta asignada ese día).
	RutaID           *string `json:"ruta_id"`
	RutaNombre       string  `json:"ruta_nombre"`
	RutaZona         string  `json:"ruta_zona"`
	RutaEstado       string  `json:"ruta_estado"`
	RepartidorID     *string `json:"repartidor_id"`
	RepartidorNombre string  `json:"repartidor_nombre"`

	// Carga = peso de los paquetes que todavía están arriba (asignados o en camino).
	CargaActualPeso     float64 `json:"carga_actual_peso"`
	CapacidadPorcentaje float64 `json:"capacidad_porcentaje"`
	TotalPaquetes       int     `json:"total_paquetes"`
	PaquetesEntregados  int     `json:"paquetes_entregados"`
	PaquetesFallidos    int     `json:"paquetes_fallidos"`
}

// PaqueteVehiculo es un envío que viaja (o viajó) en el vehículo.
type PaqueteVehiculo struct {
	Orden              int     `json:"orden"`
	EnvioID            string  `json:"envio_id"`
	CodigoGuia         string  `json:"codigo_guia"`
	Estado             string  `json:"estado"`
	Peso               float64 `json:"peso"`
	Tamano             string  `json:"tamano"`
	TipoContenido      string  `json:"tipo_contenido"`
	Fragil             bool    `json:"fragil"`
	Urgente            bool    `json:"urgente"`
	DestinatarioNombre string  `json:"destinatario_nombre"`
	Direccion          string  `json:"direccion"`
	Localidad          string  `json:"localidad"`
	// Coordenadas del destino (nil si todavía no se geocodificó).
	Coordenadas *Coordenadas `json:"coordenadas"`
}

// VehiculoDetalle es la vista completa de un vehículo: datos, paquetes a bordo
// y el recorrido por calles de su ruta del día.
type VehiculoDetalle struct {
	Vehiculo
	Paquetes  []PaqueteVehiculo `json:"paquetes"`
	Recorrido *RecorridoMapa    `json:"recorrido"`
}

// RecorridoMapa es una polilínea por calles lista para dibujar.
type RecorridoMapa struct {
	Geometria  [][2]float64 `json:"geometria"` // [[lat, lng], ...]
	DistanciaM float64      `json:"distancia_m"`
	DuracionS  float64      `json:"duracion_s"`
}

// PosicionVehiculo es la posición en vivo de un vehículo (evento SSE).
type PosicionVehiculo struct {
	VehiculoID string    `json:"vehiculo_id"`
	Patente    string    `json:"patente"`
	RutaID     *string   `json:"ruta_id"`
	Lat        float64   `json:"lat"`
	Lng        float64   `json:"lng"`
	Velocidad  float64   `json:"velocidad"`
	Rumbo      float64   `json:"rumbo"`
	En         time.Time `json:"en"`
}

// TrayectoEnvio es el camino por calles desde el vehículo hasta el destino de un envío.
type TrayectoEnvio struct {
	EnvioID    string            `json:"envio_id"`
	CodigoGuia string            `json:"codigo_guia"`
	Estado     string            `json:"estado"`
	Destino    *Coordenadas      `json:"destino"`
	Direccion  string            `json:"direccion"`
	Vehiculo   *PosicionVehiculo `json:"vehiculo"`
	Recorrido  *RecorridoMapa    `json:"recorrido"`
	// ParadasAntes es cuántas entregas pendientes tiene el vehículo antes de esta.
	ParadasAntes int `json:"paradas_antes"`
}
