package services

import (
	"context"
	"testing"

	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
)

type geoRepoFalso struct {
	dir      repository.DireccionDestinatario
	guardado *struct {
		lat, lng float64
		fuente   string
	}
}

func (f *geoRepoFalso) Direccion(context.Context, string) (repository.DireccionDestinatario, error) {
	return f.dir, nil
}
func (f *geoRepoFalso) DestinatarioDeEnvio(context.Context, string) (string, error) {
	return f.dir.ID, nil
}
func (f *geoRepoFalso) SinGeocodificar(context.Context, int) ([]repository.DireccionDestinatario, error) {
	return []repository.DireccionDestinatario{f.dir}, nil
}
func (f *geoRepoFalso) GuardarCoordenadas(_ context.Context, _ string, lat, lng float64, fuente string) error {
	f.guardado = &struct {
		lat, lng float64
		fuente   string
	}{lat, lng, fuente}
	return nil
}

// geocoderFalso responde solo a las consultas que conoce.
type geocoderFalso struct {
	conocidas map[string]geo.Punto
	consultas []string
}

func (g *geocoderFalso) Geocodificar(_ context.Context, calle, numero, localidad, _ string) (geo.Punto, error) {
	clave := calle + "|" + numero + "|" + localidad
	g.consultas = append(g.consultas, clave)
	if p, ok := g.conocidas[clave]; ok {
		return p, nil
	}
	return geo.Punto{}, geo.ErrSinResultados
}

func TestExpandirCalle(t *testing.T) {
	casos := map[string]string{
		"Bv. 25 de Mayo":     "Bulevar 25 de Mayo",
		"Av. del Libertador": "Avenida del Libertador",
		"Gral. Paz":          "General Paz",
		"Belgrano":           "Belgrano",
	}
	for in, want := range casos {
		if got := ExpandirCalle(in); got != want {
			t.Errorf("ExpandirCalle(%q) = %q, se esperaba %q", in, got, want)
		}
	}
}

func TestGeocodificar_DireccionExacta(t *testing.T) {
	repo := &geoRepoFalso{dir: repository.DireccionDestinatario{ID: "d1", Calle: "Bv. Roca", Numero: "1200", Localidad: "San Francisco"}}
	g := &geocoderFalso{conocidas: map[string]geo.Punto{"Bulevar Roca|1200|San Francisco": {Lat: -31.43, Lng: -62.09}}}
	if err := NewGeoService(repo, g).GeocodificarDestinatario(context.Background(), "d1"); err != nil {
		t.Fatal(err)
	}
	if repo.guardado == nil || repo.guardado.fuente != GeoFuenteNominatim || repo.guardado.lat != -31.43 {
		t.Fatalf("guardado = %+v", repo.guardado)
	}
}

func TestGeocodificar_SinAlturaUsaLaCalle(t *testing.T) {
	repo := &geoRepoFalso{dir: repository.DireccionDestinatario{ID: "d1", Calle: "Iturraspe", Numero: "9999", Localidad: "San Francisco"}}
	g := &geocoderFalso{conocidas: map[string]geo.Punto{"Iturraspe||San Francisco": {Lat: -31.42, Lng: -62.08}}}
	if err := NewGeoService(repo, g).GeocodificarDestinatario(context.Background(), "d1"); err != nil {
		t.Fatal(err)
	}
	if repo.guardado == nil || repo.guardado.fuente != GeoFuenteNominatim {
		t.Fatalf("debía ubicar la calle sin altura, guardado = %+v (consultas %v)", repo.guardado, g.consultas)
	}
}

func TestGeocodificar_SinResultadosQuedaAproximada(t *testing.T) {
	repo := &geoRepoFalso{dir: repository.DireccionDestinatario{ID: "d1", Calle: "Inexistente", Numero: "1", Localidad: "Nada"}}
	g := &geocoderFalso{conocidas: map[string]geo.Punto{}}
	if err := NewGeoService(repo, g).GeocodificarDestinatario(context.Background(), "d1"); err != nil {
		t.Fatal(err)
	}
	if repo.guardado == nil || repo.guardado.fuente != GeoFuenteAproximada || repo.guardado.lat != geo.CentroSanFrancisco.Lat {
		t.Fatalf("guardado = %+v", repo.guardado)
	}
}
