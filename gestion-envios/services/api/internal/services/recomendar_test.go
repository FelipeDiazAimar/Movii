package services

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
)

// fakeReco hace de repos y de GeoProvider: sin red ni base. La "calle" de cada
// destinatario es la clave de su ubicación.
type fakeReco struct {
	puntos   map[string]geo.Punto
	conf     map[string]float64
	paradas  []domain.Envio
	sinMapas bool
}

func (f *fakeReco) GetByID(context.Context, string) (domain.Ruta, error) { return domain.Ruta{}, nil }
func (f *fakeReco) EnviosDeRuta(context.Context, string) ([]domain.Envio, error) {
	return f.paradas, nil
}
func (f *fakeReco) DestinatarioDeEnvio(_ context.Context, envioID string) (string, error) {
	return envioID, nil
}
func (f *fakeReco) Direccion(_ context.Context, id string) (repository.DireccionDestinatario, error) {
	return repository.DireccionDestinatario{ID: id, Calle: id, Localidad: "SF"}, nil
}
func (f *fakeReco) Geocodificar(_ context.Context, calle, _, _, _ string) (geo.Punto, float64, error) {
	p, ok := f.puntos[calle]
	if !ok {
		return geo.Punto{}, 0, geo.ErrSinResultados
	}
	return p, f.conf[calle], nil
}
func (f *fakeReco) Matriz(_ context.Context, ps []geo.Punto) (geo.Matriz, error) {
	if f.sinMapas {
		return geo.Matriz{}, errors.New("osrm caído")
	}
	m := geo.Matriz{KM: make([][]float64, len(ps))}
	for i := range ps {
		m.KM[i] = make([]float64, len(ps))
		for j := range ps {
			m.KM[i][j] = geo.DistanciaM(ps[i], ps[j]) / 1000
		}
	}
	return m, nil
}

func nuevoReco() (*fakeReco, *RecomendacionService) {
	c := geo.CentroSanFrancisco
	f := &fakeReco{
		// 0,009° de latitud ≈ 1 km al norte del depósito.
		puntos: map[string]geo.Punto{
			"parada": {Lat: c.Lat + 0.027, Lng: c.Lng},
			"cerca":  {Lat: c.Lat + 0.036, Lng: c.Lng},
			"lejos":  {Lat: c.Lat + 0.18, Lng: c.Lng},
			"dudosa": {Lat: c.Lat + 0.03, Lng: c.Lng},
		},
		conf:    map[string]float64{"parada": 0.9, "cerca": 0.9, "lejos": 0.9, "dudosa": 0.3},
		paradas: []domain.Envio{{ID: "p1", DestinatarioID: "parada"}},
	}
	return f, NewRecomendacionService(f, f, f, 2, 5)
}

func TestRecomendar_Cerca(t *testing.T) {
	_, s := nuevoReco()
	r, err := s.Recomendar(context.Background(), "r1", "cerca")
	require.NoError(t, err)
	require.Equal(t, RecomConviene, r.Recomendacion)
	require.InDelta(t, 1.0, r.ExtraKm, 0.2)
}

func TestRecomendar_Lejos(t *testing.T) {
	_, s := nuevoReco()
	r, err := s.Recomendar(context.Background(), "r1", "lejos")
	require.NoError(t, err)
	require.Equal(t, RecomNoConviene, r.Recomendacion)
	require.Greater(t, r.ExtraKm, 5.0)
}

func TestRecomendar_DireccionInvalida(t *testing.T) {
	_, s := nuevoReco()
	// confianza baja y dirección inexistente
	for _, envio := range []string{"dudosa", "inexistente"} {
		_, err := s.Recomendar(context.Background(), "r1", envio)
		require.ErrorIs(t, err, ErrDireccionInvalida)
	}
}

func TestRecomendar_SinProveedorPermiteAsignar(t *testing.T) {
	f, s := nuevoReco()
	f.sinMapas = true
	r, err := s.Recomendar(context.Background(), "r1", "cerca")
	require.NoError(t, err)
	require.Equal(t, RecomSinRecomienda, r.Recomendacion)
}
