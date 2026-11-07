// Package geo agrupa los servicios cartográficos externos: geocodificación de
// direcciones (Nominatim/OpenStreetMap) y trazado de recorridos por calles
// (OSRM). Ambos se usan detrás de interfaces para que los tests no salgan a la
// red y para poder cambiar de proveedor sin tocar los servicios.
package geo

import (
	"context"
	"errors"
	"math"
)

// Punto es una coordenada WGS84.
type Punto struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// Recorrido es un trazado por calles entre varios puntos.
type Recorrido struct {
	// Geometria es la polilínea del recorrido, punto por punto.
	Geometria  []Punto `json:"geometria"`
	DistanciaM float64 `json:"distancia_m"`
	DuracionS  float64 `json:"duracion_s"`
}

// ErrSinResultados indica que el proveedor no encontró la dirección o el recorrido.
var ErrSinResultados = errors.New("geo: sin resultados")

// Geocoder convierte una dirección postal en coordenadas.
type Geocoder interface {
	Geocodificar(ctx context.Context, calle, numero, localidad, codigoPostal string) (Punto, error)
}

// Router calcula el recorrido por calles que pasa por los puntos en orden.
type Router interface {
	Recorrido(ctx context.Context, puntos []Punto) (Recorrido, error)
}

// CentroSanFrancisco es el centro de San Francisco (Córdoba), la ciudad de la demo;
// también es la posición del depósito central.
var CentroSanFrancisco = Punto{Lat: -31.4279718, Lng: -62.0826608}

const radioTierraM = 6371000.0

// DistanciaM devuelve la distancia en metros entre dos puntos (fórmula de haversine).
func DistanciaM(a, b Punto) float64 {
	rad := math.Pi / 180
	dLat := (b.Lat - a.Lat) * rad
	dLng := (b.Lng - a.Lng) * rad
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(a.Lat*rad)*math.Cos(b.Lat*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * radioTierraM * math.Asin(math.Sqrt(h))
}

// Rumbo devuelve el rumbo en grados (0 = norte, sentido horario) para ir de a hacia b.
func Rumbo(a, b Punto) float64 {
	rad := math.Pi / 180
	y := math.Sin((b.Lng-a.Lng)*rad) * math.Cos(b.Lat*rad)
	x := math.Cos(a.Lat*rad)*math.Sin(b.Lat*rad) - math.Sin(a.Lat*rad)*math.Cos(b.Lat*rad)*math.Cos((b.Lng-a.Lng)*rad)
	g := math.Atan2(y, x) / rad
	return math.Mod(g+360, 360)
}

// Interpolar devuelve el punto a la distancia `metros` desde el inicio de la
// polilínea, el índice del tramo en el que cae y el rumbo de ese tramo. Si la
// distancia supera el largo total devuelve el último punto.
func Interpolar(linea []Punto, metros float64) (Punto, int, float64) {
	if len(linea) == 0 {
		return Punto{}, 0, 0
	}
	if len(linea) == 1 || metros <= 0 {
		rumbo := 0.0
		if len(linea) > 1 {
			rumbo = Rumbo(linea[0], linea[1])
		}
		return linea[0], 0, rumbo
	}
	recorrido := 0.0
	for i := 0; i < len(linea)-1; i++ {
		tramo := DistanciaM(linea[i], linea[i+1])
		if recorrido+tramo >= metros && tramo > 0 {
			f := (metros - recorrido) / tramo
			p := Punto{
				Lat: linea[i].Lat + (linea[i+1].Lat-linea[i].Lat)*f,
				Lng: linea[i].Lng + (linea[i+1].Lng-linea[i].Lng)*f,
			}
			return p, i, Rumbo(linea[i], linea[i+1])
		}
		recorrido += tramo
	}
	n := len(linea)
	return linea[n-1], n - 2, Rumbo(linea[n-2], linea[n-1])
}

// Largo devuelve el largo total de la polilínea en metros.
func Largo(linea []Punto) float64 {
	total := 0.0
	for i := 0; i < len(linea)-1; i++ {
		total += DistanciaM(linea[i], linea[i+1])
	}
	return total
}

// Recta es un Router sin red: une los puntos en línea recta. Se usa como
// respaldo cuando OSRM no responde, y en los tests.
type Recta struct{}

// Recorrido implementa Router.
func (Recta) Recorrido(_ context.Context, puntos []Punto) (Recorrido, error) {
	if len(puntos) < 2 {
		return Recorrido{}, ErrSinResultados
	}
	largo := Largo(puntos)
	return Recorrido{Geometria: append([]Punto(nil), puntos...), DistanciaM: largo, DuracionS: largo / 8.3}, nil
}
