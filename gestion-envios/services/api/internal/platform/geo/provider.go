package geo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ConfianzaMinima es el piso para dar una dirección por válida (T4).
const ConfianzaMinima = 0.6

// Matriz son las distancias (km) y tiempos (min) entre todos los pares de puntos.
type Matriz struct {
	KM  [][]float64
	Min [][]float64
}

// GeoProvider es el proveedor de mapas enchufable que usa la recomendación de
// asignación: geocodifica con una confianza 0..1 y calcula la matriz de
// distancias. Implementaciones: OSM (Nominatim + OSRM, gratis) y Google.
type GeoProvider interface {
	Geocodificar(ctx context.Context, calle, numero, localidad, codigoPostal string) (Punto, float64, error)
	Matriz(ctx context.Context, puntos []Punto) (Matriz, error)
}

// OSM combina un Geocoder (Nominatim) con la API /table de OSRM.
type OSM struct {
	Geocoder Geocoder
	BaseURL  string
	HTTP     *http.Client
}

// NewOSM crea el proveedor gratuito. osrmURL vacío = servidor público.
func NewOSM(g Geocoder, osrmURL string) *OSM {
	if osrmURL == "" {
		osrmURL = "https://router.project-osrm.org"
	}
	return &OSM{Geocoder: g, BaseURL: strings.TrimRight(osrmURL, "/"), HTTP: &http.Client{Timeout: 12 * time.Second}}
}

// Geocodificar: dirección exacta = 0.9; solo la calle (sin altura) = 0.65.
func (o *OSM) Geocodificar(ctx context.Context, calle, numero, localidad, cp string) (Punto, float64, error) {
	if strings.TrimSpace(calle) == "" {
		return Punto{}, 0, ErrSinResultados
	}
	if numero != "" {
		p, err := o.Geocoder.Geocodificar(ctx, calle, numero, localidad, cp)
		if err == nil {
			return p, 0.9, nil
		}
		if !errors.Is(err, ErrSinResultados) {
			return Punto{}, 0, err
		}
	}
	p, err := o.Geocoder.Geocodificar(ctx, calle, "", localidad, cp)
	if err != nil {
		return Punto{}, 0, err
	}
	return p, 0.65, nil
}

func coordsLngLat(ps []Punto) string {
	partes := make([]string, len(ps))
	for i, p := range ps {
		partes[i] = strconv.FormatFloat(p.Lng, 'f', 5, 64) + "," + strconv.FormatFloat(p.Lat, 'f', 5, 64)
	}
	return strings.Join(partes, ";")
}

// Matriz consulta /table/v1/driving de OSRM.
func (o *OSM) Matriz(ctx context.Context, puntos []Punto) (Matriz, error) {
	var body struct {
		Code      string      `json:"code"`
		Distances [][]float64 `json:"distances"`
		Durations [][]float64 `json:"durations"`
	}
	u := o.BaseURL + "/table/v1/driving/" + coordsLngLat(puntos) + "?annotations=distance,duration"
	if err := getJSON(ctx, o.HTTP, u, &body); err != nil {
		return Matriz{}, fmt.Errorf("osrm: %w", err)
	}
	if body.Code != "Ok" || len(body.Distances) != len(puntos) {
		return Matriz{}, ErrSinResultados
	}
	return aMatriz(body.Distances, body.Durations), nil
}

// aMatriz pasa metros/segundos a km/min.
func aMatriz(m, s [][]float64) Matriz {
	out := Matriz{KM: make([][]float64, len(m)), Min: make([][]float64, len(m))}
	for i := range m {
		out.KM[i] = make([]float64, len(m[i]))
		out.Min[i] = make([]float64, len(m[i]))
		for j := range m[i] {
			out.KM[i][j] = m[i][j] / 1000
			if i < len(s) && j < len(s[i]) {
				out.Min[i][j] = s[i][j] / 60
			}
		}
	}
	return out
}

func getJSON(ctx context.Context, c *http.Client, u string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", userAgent)
	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(dst)
}

// Google usa Geocoding + Distance Matrix (requiere GOOGLE_MAPS_KEY).
type Google struct {
	Key  string
	HTTP *http.Client
}

// NewGoogle crea el proveedor de Google.
func NewGoogle(key string) *Google {
	return &Google{Key: key, HTTP: &http.Client{Timeout: 12 * time.Second}}
}

// maxGoogle: la Distance Matrix admite 100 elementos por pedido (10x10).
// shortcut: rutas con más de 10 puntos degradan a "sin recomendación"; paginar si hace falta.
const maxGoogle = 10

// confianzaGoogle traduce location_type de Google a confianza.
var confianzaGoogle = map[string]float64{"ROOFTOP": 1, "RANGE_INTERPOLATED": 0.9, "GEOMETRIC_CENTER": 0.65, "APPROXIMATE": 0.4}

// Geocodificar implementa GeoProvider.
func (g *Google) Geocodificar(ctx context.Context, calle, numero, localidad, cp string) (Punto, float64, error) {
	if strings.TrimSpace(calle) == "" {
		return Punto{}, 0, ErrSinResultados
	}
	q := url.Values{"address": {strings.TrimSpace(calle + " " + numero + ", " + localidad + " " + cp)}, "region": {"ar"}, "key": {g.Key}}
	var body struct {
		Status  string `json:"status"`
		Results []struct {
			Geometry struct {
				Location     Punto  `json:"location"`
				LocationType string `json:"location_type"`
			} `json:"geometry"`
		} `json:"results"`
	}
	if err := getJSON(ctx, g.HTTP, "https://maps.googleapis.com/maps/api/geocode/json?"+q.Encode(), &body); err != nil {
		return Punto{}, 0, fmt.Errorf("google geocode: %w", err)
	}
	if body.Status == "ZERO_RESULTS" || (body.Status == "OK" && len(body.Results) == 0) {
		return Punto{}, 0, ErrSinResultados
	}
	if body.Status != "OK" {
		return Punto{}, 0, fmt.Errorf("google geocode: %s", body.Status)
	}
	r := body.Results[0].Geometry
	return r.Location, confianzaGoogle[r.LocationType], nil
}

// Matriz implementa GeoProvider.
func (g *Google) Matriz(ctx context.Context, puntos []Punto) (Matriz, error) {
	if len(puntos) > maxGoogle {
		return Matriz{}, fmt.Errorf("google: más de %d puntos", maxGoogle)
	}
	ps := make([]string, len(puntos))
	for i, p := range puntos {
		ps[i] = strconv.FormatFloat(p.Lat, 'f', 5, 64) + "," + strconv.FormatFloat(p.Lng, 'f', 5, 64)
	}
	todos := strings.Join(ps, "|")
	q := url.Values{"origins": {todos}, "destinations": {todos}, "mode": {"driving"}, "key": {g.Key}}
	var body struct {
		Status string `json:"status"`
		Rows   []struct {
			Elements []struct {
				Status   string `json:"status"`
				Distance struct {
					Value float64 `json:"value"`
				} `json:"distance"`
				Duration struct {
					Value float64 `json:"value"`
				} `json:"duration"`
			} `json:"elements"`
		} `json:"rows"`
	}
	if err := getJSON(ctx, g.HTTP, "https://maps.googleapis.com/maps/api/distancematrix/json?"+q.Encode(), &body); err != nil {
		return Matriz{}, fmt.Errorf("google matrix: %w", err)
	}
	if body.Status != "OK" || len(body.Rows) != len(puntos) {
		return Matriz{}, fmt.Errorf("google matrix: %s", body.Status)
	}
	m, s := make([][]float64, len(puntos)), make([][]float64, len(puntos))
	for i, row := range body.Rows {
		m[i], s[i] = make([]float64, len(row.Elements)), make([]float64, len(row.Elements))
		for j, e := range row.Elements {
			if e.Status != "OK" {
				return Matriz{}, ErrSinResultados
			}
			m[i][j], s[i][j] = e.Distance.Value, e.Duration.Value
		}
	}
	return aMatriz(m, s), nil
}

type entradaGeo struct {
	p     Punto
	conf  float64
	vence time.Time
}

type geoCacheado struct {
	GeoProvider
	mu    sync.Mutex
	ttl   time.Duration
	datos map[string]entradaGeo
}

// ConCache decora un GeoProvider con una caché en memoria de geocodificaciones
// (solo aciertos) durante ttl.
// shortcut: sin tope de tamaño; alcanza para una API de una sola instancia.
func ConCache(p GeoProvider, ttl time.Duration) GeoProvider {
	return &geoCacheado{GeoProvider: p, ttl: ttl, datos: map[string]entradaGeo{}}
}

// Geocodificar implementa GeoProvider.
func (c *geoCacheado) Geocodificar(ctx context.Context, calle, numero, localidad, cp string) (Punto, float64, error) {
	clave := strings.ToLower(strings.Join([]string{calle, numero, localidad, cp}, "|"))
	c.mu.Lock()
	e, ok := c.datos[clave]
	c.mu.Unlock()
	if ok && time.Now().Before(e.vence) {
		return e.p, e.conf, nil
	}
	p, conf, err := c.GeoProvider.Geocodificar(ctx, calle, numero, localidad, cp)
	if err == nil {
		c.mu.Lock()
		c.datos[clave] = entradaGeo{p, conf, time.Now().Add(c.ttl)}
		c.mu.Unlock()
	}
	return p, conf, err
}
