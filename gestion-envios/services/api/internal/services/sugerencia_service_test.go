package services

import (
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
)

func f(v float64) *float64 { return &v }

func TestRankearRutas_FechaLuegoCapacidadLuegoCercania(t *testing.T) {
	env := repository.EnvioParaSugerir{Peso: 20, FechaEntrega: "2026-11-12", Lat: f(-31.43), Lng: f(-62.08)}
	rutas := []repository.RutaPlanificada{
		{ID: "otra-fecha", Fecha: "2026-11-13", CentroLat: f(-31.43), CentroLng: f(-62.08)},
		{ID: "lejos", Fecha: "2026-11-12", CentroLat: f(-31.50), CentroLng: f(-62.20)},
		{ID: "no-cabe", Fecha: "2026-11-12", CapacidadPeso: 30, PesoActual: 25, CentroLat: f(-31.43), CentroLng: f(-62.08)},
		{ID: "cerca", Fecha: "2026-11-12", CentroLat: f(-31.431), CentroLng: f(-62.081)},
	}
	out := rankearRutas(env, rutas)
	ids := []string{out[0].RutaID, out[1].RutaID, out[2].RutaID, out[3].RutaID}
	require.Equal(t, []string{"cerca", "lejos", "no-cabe", "otra-fecha"}, ids)
	require.True(t, out[0].Recomendada)
	require.False(t, out[2].Cabe)
	require.Contains(t, out[2].Motivo, "no entra en el vehículo")
}

func TestRankearRutas_SinCoordenadasNoRompe(t *testing.T) {
	out := rankearRutas(repository.EnvioParaSugerir{FechaEntrega: "2026-11-12"},
		[]repository.RutaPlanificada{{ID: "a", Fecha: "2026-11-12"}})
	require.Len(t, out, 1)
	require.Nil(t, out[0].DistanciaKm)
}

func TestRankearRepartidores_CercaniaYOcupados(t *testing.T) {
	centro := geo.Punto{Lat: -31.43, Lng: -62.08}
	activos := []repository.RepartidorActivo{{ID: "libre", Nombre: "Libre"}, {ID: "cerca", Nombre: "Cerca"}, {ID: "saliendo", Nombre: "Saliendo"}}
	paradas := []repository.ParadaDeRepartidor{
		{RepartidorID: "cerca", RutaID: "r1", RutaEstado: "planificada", TieneEnvio: true, Peso: 5, Lat: f(-31.431), Lng: f(-62.081)},
		{RepartidorID: "saliendo", RutaID: "r2", RutaEstado: "en_curso", TieneEnvio: true, Peso: 9, Lat: f(-31.43), Lng: f(-62.08)},
	}
	out := rankearRepartidores(activos, paradas, &centro, "")
	require.Equal(t, "cerca", out[0].ID)
	require.True(t, out[0].Recomendado)
	require.Equal(t, "libre", out[1].ID)
	require.Equal(t, "saliendo", out[2].ID)
	require.True(t, out[2].EnCurso)
	require.Equal(t, 1, out[0].Rutas)
}
