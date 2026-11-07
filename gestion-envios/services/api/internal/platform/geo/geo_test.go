package geo

import (
	"context"
	"errors"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDistanciaM_UnaCuadraEnSanFrancisco(t *testing.T) {
	a := Punto{Lat: -31.4279718, Lng: -62.0826608}
	b := Punto{Lat: -31.4279718, Lng: -62.0816608} // 0.001° de longitud ≈ 95 m a esa latitud
	d := DistanciaM(a, b)
	if d < 90 || d > 100 {
		t.Fatalf("distancia = %.1f m, se esperaba ~95 m", d)
	}
}

func TestRumbo_PuntosCardinales(t *testing.T) {
	o := Punto{Lat: 0, Lng: 0}
	casos := map[string]struct {
		p    Punto
		want float64
	}{
		"norte": {Punto{Lat: 1, Lng: 0}, 0},
		"este":  {Punto{Lat: 0, Lng: 1}, 90},
		"sur":   {Punto{Lat: -1, Lng: 0}, 180},
		"oeste": {Punto{Lat: 0, Lng: -1}, 270},
	}
	for nombre, c := range casos {
		if got := Rumbo(o, c.p); math.Abs(got-c.want) > 0.01 {
			t.Errorf("%s: rumbo = %.2f, se esperaba %.0f", nombre, got, c.want)
		}
	}
}

func TestInterpolar_AvanzaSobreLaPolilinea(t *testing.T) {
	linea := []Punto{{0, 0}, {0, 0.001}, {0.001, 0.001}}
	tramo := DistanciaM(linea[0], linea[1])

	p, idx, _ := Interpolar(linea, tramo/2)
	if idx != 0 || math.Abs(p.Lng-0.0005) > 1e-6 {
		t.Fatalf("mitad del primer tramo: idx=%d p=%+v", idx, p)
	}
	p, idx, rumbo := Interpolar(linea, tramo+DistanciaM(linea[1], linea[2])/2)
	if idx != 1 || math.Abs(p.Lat-0.0005) > 1e-6 || math.Abs(rumbo) > 0.01 {
		t.Fatalf("mitad del segundo tramo: idx=%d p=%+v rumbo=%.2f", idx, p, rumbo)
	}
	p, _, _ = Interpolar(linea, 1e9)
	if p != linea[2] {
		t.Fatalf("más allá del final debe quedar en el último punto, got %+v", p)
	}
}

func TestNominatim_ParseaYCachea(t *testing.T) {
	llamadas := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		llamadas++
		if !strings.Contains(r.Header.Get("User-Agent"), "Movii") {
			t.Errorf("falta User-Agent propio: %q", r.Header.Get("User-Agent"))
		}
		if r.URL.Query().Get("countrycodes") != "ar" || r.URL.Query().Get("postalcode") != "2400" {
			t.Errorf("query inesperada: %s", r.URL.RawQuery)
		}
		_, _ = w.Write([]byte(`[{"lat":"-31.4301","lon":"-62.0850"}]`))
	}))
	defer srv.Close()

	n := NewNominatim(srv.URL)
	p, err := n.Geocodificar(context.Background(), "San Martín", "450", "San Francisco", "X2400")
	if err != nil || p.Lat != -31.4301 || p.Lng != -62.0850 {
		t.Fatalf("p=%+v err=%v", p, err)
	}
	_, _ = n.Geocodificar(context.Background(), "San Martín", "450", "San Francisco", "X2400")
	if llamadas != 1 {
		t.Fatalf("la segunda consulta debía salir de la caché, llamadas=%d", llamadas)
	}
}

func TestNominatim_SinResultados(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`[]`))
	}))
	defer srv.Close()
	_, err := NewNominatim(srv.URL).Geocodificar(context.Background(), "Inexistente", "1", "Nada", "")
	if !errors.Is(err, ErrSinResultados) {
		t.Fatalf("err = %v, se esperaba ErrSinResultados", err)
	}
}

func TestOSRM_ParseaGeoJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "/route/v1/driving/-62.08266,-31.42797;-62.08000,-31.43000") {
			t.Errorf("path inesperado: %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"code":"Ok","routes":[{"distance":420.5,"duration":61.2,"geometry":{"coordinates":[[-62.08266,-31.42797],[-62.081,-31.429],[-62.08,-31.43]]}}]}`))
	}))
	defer srv.Close()

	r, err := NewOSRM(srv.URL).Recorrido(context.Background(), []Punto{{-31.42797, -62.08266}, {-31.43, -62.08}})
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Geometria) != 3 || r.Geometria[1] != (Punto{Lat: -31.429, Lng: -62.081}) || r.DistanciaM != 420.5 {
		t.Fatalf("recorrido inesperado: %+v", r)
	}
}

func TestConRespaldo_UsaLineaRectaSiFalla(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	puntos := []Punto{{0, 0}, {0, 0.01}}
	r, err := ConRespaldo(NewOSRM(srv.URL)).Recorrido(context.Background(), puntos)
	if err != nil || len(r.Geometria) != 2 || r.DistanciaM <= 0 {
		t.Fatalf("respaldo: r=%+v err=%v", r, err)
	}
}
