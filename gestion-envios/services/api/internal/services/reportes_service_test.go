package services

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func TestPorcentaje(t *testing.T) {
	require.Equal(t, 84.0, porcentaje(42, 50))
	require.Equal(t, 33.33, porcentaje(1, 3))
	require.Equal(t, 66.67, porcentaje(2, 3))
	require.Equal(t, 0.0, porcentaje(0, 0), "sin intentos resueltos no divide por cero")
	require.Equal(t, 100.0, porcentaje(5, 5))
}

func TestFechaODefault(t *testing.T) {
	// 22/10 22:30 en Argentina ya es 23/10 en UTC: "hoy" se calcula en UTC.
	ahora := time.Date(2026, 10, 22, 22, 30, 0, 0, time.FixedZone("ART", -3*3600))
	f, err := fechaODefault("", ahora)
	require.NoError(t, err)
	require.Equal(t, "2026-10-23", f)

	f, err = fechaODefault("2026-10-01", ahora)
	require.NoError(t, err)
	require.Equal(t, "2026-10-01", f)

	for _, mala := range []string{"2026-10-1", "01/10/2026", "2026-13-01", "hoy"} {
		_, err = fechaODefault(mala, ahora)
		require.ErrorIs(t, err, ErrFechaReporteInvalida, mala)
	}
}

func TestValidarPeriodo(t *testing.T) {
	p, err := ValidarPeriodo("2026-10-01", "2026-10-22")
	require.NoError(t, err)
	require.Equal(t, domain.Periodo{Desde: "2026-10-01", Hasta: "2026-10-22"}, p)

	_, err = ValidarPeriodo("2026-10-22", "2026-10-22")
	require.NoError(t, err, "un solo día es válido")
	_, err = ValidarPeriodo("2025-10-22", "2026-10-22")
	require.NoError(t, err, "366 días es el máximo permitido")

	casos := [][2]string{
		{"", "2026-10-22"},           // falta desde
		{"2026-10-01", ""},           // falta hasta
		{"2026-10-22", "2026-10-01"}, // invertido
		{"2026-10-1", "2026-10-22"},  // formato
		{"2024-01-01", "2026-10-22"}, // más de un año
	}
	for _, c := range casos {
		_, err := ValidarPeriodo(c[0], c[1])
		require.ErrorIs(t, err, ErrPeriodoInvalido, "%v", c)
	}
}

func TestValidarEstadoReporte(t *testing.T) {
	require.NoError(t, ValidarEstadoReporte(""))
	require.NoError(t, ValidarEstadoReporte("no_entregado"))
	require.ErrorIs(t, ValidarEstadoReporte("perdido"), ErrEstadoReporteInvalido)
}

func TestCeldaSegura(t *testing.T) {
	require.Equal(t, "'=HYPERLINK(\"x\")", celdaSegura(`=HYPERLINK("x")`))
	require.Equal(t, "'+54 9", celdaSegura("+54 9"))
	require.Equal(t, "'-1", celdaSegura("-1"))
	require.Equal(t, "'@SUM(A1)", celdaSegura("@SUM(A1)"))
	require.Equal(t, "Juan Pérez", celdaSegura("Juan Pérez"))
	require.Equal(t, "", celdaSegura(""))
}

func TestOrdenarRanking(t *testing.T) {
	diez, siete := 10.04, 7.0
	lista := []domain.DesempenoRepartidor{
		{Nombre: "Bea", Entregados: 9, Fallidos: 1, PromedioMinutosEntrega: &diez},   // 90 %
		{Nombre: "Ana", Entregados: 18, Fallidos: 2, PromedioMinutosEntrega: &siete}, // 90 %, más entregas
		{Nombre: "Ceci", Entregados: 0, Fallidos: 0},                                 // sin intentos: 0 %
		{Nombre: "Dani", Entregados: 1, Fallidos: 0},                                 // 100 %
	}
	ordenarRanking(lista)

	require.Equal(t, []string{"Dani", "Ana", "Bea", "Ceci"}, []string{lista[0].Nombre, lista[1].Nombre, lista[2].Nombre, lista[3].Nombre})
	require.Equal(t, []int{1, 2, 3, 4}, []int{lista[0].Posicion, lista[1].Posicion, lista[2].Posicion, lista[3].Posicion})
	require.Equal(t, 100.0, lista[0].TasaEfectividad)
	require.Equal(t, 90.0, lista[1].TasaEfectividad)
	require.Equal(t, 10.0, *lista[2].PromedioMinutosEntrega, "redondeo a 1 decimal")
	require.Nil(t, lista[3].PromedioMinutosEntrega)
}

func TestDistribucionIncidencias(t *testing.T) {
	total, dist := distribucionIncidencias(map[string]int{"cliente_ausente": 3, "otro": 1})
	require.Equal(t, 4, total)
	require.Len(t, dist, 5, "los 5 motivos aparecen siempre, aunque tengan 0")
	require.Equal(t, "cliente_ausente", dist[0].Motivo)
	require.Equal(t, "Destinatario ausente", dist[0].Etiqueta)
	require.Equal(t, 75.0, dist[0].Porcentaje)
	require.Equal(t, "otro", dist[1].Motivo)
	require.Equal(t, 25.0, dist[1].Porcentaje)
	require.Equal(t, 0, dist[4].Cantidad)

	total, dist = distribucionIncidencias(map[string]int{})
	require.Equal(t, 0, total)
	require.Len(t, dist, 5)
	require.Equal(t, 0.0, dist[0].Porcentaje)
}
