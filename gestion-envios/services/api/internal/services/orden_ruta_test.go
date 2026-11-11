package services

import (
	"math"
	"math/rand/v2"
	"testing"

	"github.com/stretchr/testify/require"
)

// matrizDePuntos arma la matriz de distancias euclídeas entre puntos del plano.
func matrizDePuntos(ps [][2]float64) [][]float64 {
	m := make([][]float64, len(ps))
	for i := range ps {
		m[i] = make([]float64, len(ps))
		for j := range ps {
			m[i][j] = math.Hypot(ps[i][0]-ps[j][0], ps[i][1]-ps[j][1])
		}
	}
	return m
}

func largoRecorrido(m [][]float64, orden []int, conLlegada bool) float64 {
	t, prev := 0.0, 0
	for _, j := range orden {
		t += m[prev][j]
		prev = j
	}
	if conLlegada {
		t += m[prev][len(m)-1]
	}
	return t
}

func TestOrdenMasCorto_EvitaElZigzag(t *testing.T) {
	// Paradas sobre una recta, cargadas desordenadas: salida en 0, vuelta en 0.
	puntos := [][2]float64{{0, 0}, {3, 0}, {1, 0}, {4, 0}, {2, 0}, {0, 0}}
	m := matrizDePuntos(puntos)
	orden := OrdenMasCorto(m, true)
	require.Len(t, orden, 4)
	require.InDelta(t, 8, largoRecorrido(m, orden, true), 1e-9, "ir hasta el final y volver")
	require.InDelta(t, 3+2+3+2+2, largoRecorrido(m, []int{1, 2, 3, 4}, true), 1e-9, "el orden de carga zigzaguea")
}

func TestOrdenMasCorto_SinLlegadaTerminaEnLaMasLejana(t *testing.T) {
	puntos := [][2]float64{{0, 0}, {3, 0}, {1, 0}, {2, 0}}
	require.Equal(t, []int{2, 3, 1}, OrdenMasCorto(matrizDePuntos(puntos), false))
}

func TestOrdenMasCorto_ExactoEsElMejorPosible(t *testing.T) {
	rnd := rand.New(rand.NewPCG(1, 2))
	for caso := 0; caso < 5; caso++ {
		ps := [][2]float64{{0, 0}}
		for i := 0; i < 7; i++ {
			ps = append(ps, [2]float64{rnd.Float64() * 10, rnd.Float64() * 10})
		}
		ps = append(ps, [2]float64{0, 0})
		m := matrizDePuntos(ps)
		got := largoRecorrido(m, OrdenMasCorto(m, true), true)
		// Fuerza bruta sobre todas las permutaciones de 7 paradas.
		mejor := math.Inf(1)
		permutar([]int{1, 2, 3, 4, 5, 6, 7}, 0, func(p []int) {
			mejor = math.Min(mejor, largoRecorrido(m, p, true))
		})
		require.InDelta(t, mejor, got, 1e-9)
	}
}

func TestOrdenMasCorto_HeuristicaConMuchasParadas(t *testing.T) {
	rnd := rand.New(rand.NewPCG(3, 4))
	ps := [][2]float64{{5, 5}}
	for i := 0; i < 25; i++ {
		ps = append(ps, [2]float64{rnd.Float64() * 10, rnd.Float64() * 10})
	}
	ps = append(ps, [2]float64{5, 5})
	m := matrizDePuntos(ps)
	orden := OrdenMasCorto(m, true)
	require.Len(t, orden, 25)
	vistos := map[int]bool{}
	for _, j := range orden {
		require.False(t, vistos[j], "cada parada una sola vez")
		vistos[j] = true
	}
	natural := make([]int, 25)
	for i := range natural {
		natural[i] = i + 1
	}
	require.Less(t, largoRecorrido(m, orden, true), largoRecorrido(m, natural, true), "mejora el orden de carga")
}

func permutar(a []int, k int, f func([]int)) {
	if k == len(a) {
		f(a)
		return
	}
	for i := k; i < len(a); i++ {
		a[k], a[i] = a[i], a[k]
		permutar(a, k+1, f)
		a[k], a[i] = a[i], a[k]
	}
}
