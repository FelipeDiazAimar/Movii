package geo

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

// userAgent identifica a la aplicación ante los servicios públicos de OSM,
// cuya política de uso exige un User-Agent propio (no el de la librería).
const userAgent = "Movii-GestionEnvios/1.0 (proyecto academico UTN FRSF)"

// Nominatim geocodifica con la API pública de OpenStreetMap. Respeta la
// política de uso: como máximo una consulta por segundo y resultados cacheados
// en memoria (las coordenadas además quedan guardadas en la base).
type Nominatim struct {
	BaseURL string
	HTTP    *http.Client

	mu     sync.Mutex
	ultima time.Time
	cache  map[string]Punto
}

// NewNominatim crea un geocodificador contra baseURL (vacío = servidor público).
func NewNominatim(baseURL string) *Nominatim {
	if baseURL == "" {
		baseURL = "https://nominatim.openstreetmap.org"
	}
	return &Nominatim{
		BaseURL: strings.TrimRight(baseURL, "/"),
		HTTP:    &http.Client{Timeout: 10 * time.Second},
		cache:   map[string]Punto{},
	}
}

// Geocodificar implementa Geocoder. Busca la dirección restringida a Argentina.
func (n *Nominatim) Geocodificar(ctx context.Context, calle, numero, localidad, codigoPostal string) (Punto, error) {
	clave := strings.ToLower(strings.Join([]string{calle, numero, localidad, codigoPostal}, "|"))

	n.mu.Lock()
	if p, ok := n.cache[clave]; ok {
		n.mu.Unlock()
		return p, nil
	}
	// Throttle: 1 consulta por segundo como máximo (política de Nominatim).
	if espera := time.Second - time.Since(n.ultima); espera > 0 {
		n.mu.Unlock()
		select {
		case <-ctx.Done():
			return Punto{}, ctx.Err()
		case <-time.After(espera):
		}
		n.mu.Lock()
	}
	n.ultima = time.Now()
	n.mu.Unlock()

	q := url.Values{}
	q.Set("format", "jsonv2")
	q.Set("limit", "1")
	q.Set("countrycodes", "ar")
	if calle := strings.TrimSpace(numero + " " + calle); calle != "" {
		q.Set("street", calle)
	}
	q.Set("city", localidad)
	if codigoPostal != "" {
		q.Set("postalcode", strings.TrimLeft(codigoPostal, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"))
	}

	var res []struct {
		Lat string `json:"lat"`
		Lon string `json:"lon"`
	}
	if err := n.getJSON(ctx, n.BaseURL+"/search?"+q.Encode(), &res); err != nil {
		return Punto{}, err
	}
	if len(res) == 0 {
		return Punto{}, ErrSinResultados
	}
	lat, err1 := strconv.ParseFloat(res[0].Lat, 64)
	lng, err2 := strconv.ParseFloat(res[0].Lon, 64)
	if err1 != nil || err2 != nil {
		return Punto{}, ErrSinResultados
	}
	p := Punto{Lat: lat, Lng: lng}

	n.mu.Lock()
	n.cache[clave] = p
	n.mu.Unlock()
	return p, nil
}

func (n *Nominatim) getJSON(ctx context.Context, u string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept-Language", "es")
	resp, err := n.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("nominatim: status %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(dst)
}

// OSRM calcula recorridos en auto por calles reales con un servidor OSRM
// (por defecto el servidor público de demostración del proyecto).
type OSRM struct {
	BaseURL string
	HTTP    *http.Client

	mu    sync.Mutex
	cache map[string]Recorrido
}

// NewOSRM crea un Router OSRM contra baseURL (vacío = servidor público).
func NewOSRM(baseURL string) *OSRM {
	if baseURL == "" {
		baseURL = "https://router.project-osrm.org"
	}
	return &OSRM{
		BaseURL: strings.TrimRight(baseURL, "/"),
		HTTP:    &http.Client{Timeout: 12 * time.Second},
		cache:   map[string]Recorrido{},
	}
}

// maxCacheOSRM acota la caché en memoria; al llenarse se vacía entera.
const maxCacheOSRM = 500

// Recorrido implementa Router. Las coordenadas se redondean a 5 decimales
// (~1 m) para que la caché acierte con posiciones casi iguales.
func (o *OSRM) Recorrido(ctx context.Context, puntos []Punto) (Recorrido, error) {
	if len(puntos) < 2 {
		return Recorrido{}, ErrSinResultados
	}
	partes := make([]string, len(puntos))
	for i, p := range puntos {
		partes[i] = strconv.FormatFloat(p.Lng, 'f', 5, 64) + "," + strconv.FormatFloat(p.Lat, 'f', 5, 64)
	}
	coords := strings.Join(partes, ";")

	o.mu.Lock()
	if r, ok := o.cache[coords]; ok {
		o.mu.Unlock()
		return r, nil
	}
	o.mu.Unlock()

	u := o.BaseURL + "/route/v1/driving/" + coords + "?overview=full&geometries=geojson"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return Recorrido{}, err
	}
	req.Header.Set("User-Agent", userAgent)
	resp, err := o.HTTP.Do(req)
	if err != nil {
		return Recorrido{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Recorrido{}, fmt.Errorf("osrm: status %d", resp.StatusCode)
	}
	var body struct {
		Code   string `json:"code"`
		Routes []struct {
			Distance float64 `json:"distance"`
			Duration float64 `json:"duration"`
			Geometry struct {
				Coordinates [][2]float64 `json:"coordinates"`
			} `json:"geometry"`
		} `json:"routes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return Recorrido{}, err
	}
	if body.Code != "Ok" || len(body.Routes) == 0 {
		return Recorrido{}, ErrSinResultados
	}
	ruta := body.Routes[0]
	r := Recorrido{DistanciaM: ruta.Distance, DuracionS: ruta.Duration, Geometria: make([]Punto, len(ruta.Geometry.Coordinates))}
	for i, c := range ruta.Geometry.Coordinates {
		r.Geometria[i] = Punto{Lat: c[1], Lng: c[0]}
	}

	o.mu.Lock()
	if len(o.cache) >= maxCacheOSRM {
		o.cache = map[string]Recorrido{}
	}
	o.cache[coords] = r
	o.mu.Unlock()
	return r, nil
}

// ConRespaldo devuelve un Router que usa principal y, si falla, una línea recta,
// para que el mapa nunca quede vacío por una caída del servicio externo.
func ConRespaldo(principal Router) Router { return respaldo{principal} }

type respaldo struct{ principal Router }

func (r respaldo) Recorrido(ctx context.Context, puntos []Punto) (Recorrido, error) {
	rec, err := r.principal.Recorrido(ctx, puntos)
	if err == nil {
		return rec, nil
	}
	return Recta{}.Recorrido(ctx, puntos)
}
