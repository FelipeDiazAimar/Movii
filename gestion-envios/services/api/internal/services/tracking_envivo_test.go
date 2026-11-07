package services

import (
	"testing"
	"time"

	"movii/api/internal/domain"
)

func TestVentanaLlegada(t *testing.T) {
	ahora := time.Date(2026, 11, 7, 15, 0, 0, 0, time.UTC)
	desde, hasta, min := VentanaLlegada(ahora, 600, 2) // 10 min de manejo + 2 paradas (14 min)
	if min != 24 {
		t.Fatalf("minutos = %d, quería 24", min)
	}
	// margen 16 min: ±8 alrededor de 15:24
	if desde.Format("15:04") != "15:16" || hasta.Format("15:04") != "15:32" {
		t.Fatalf("ventana %s-%s", desde.Format("15:04"), hasta.Format("15:04"))
	}
	// Muy cerca: la ventana no empieza antes de ahora.
	desde, _, min = VentanaLlegada(ahora, 30, 0)
	if desde.Before(ahora) || min != 1 {
		t.Fatalf("desde %v, min %d", desde, min)
	}
}

func TestPatenteParcial(t *testing.T) {
	casos := map[string]string{"AB123CD": "AB•••CD", "TRK-318": "TR•••18", "ABC": "ABC"}
	for in, want := range casos {
		if got := PatenteParcial(in); got != want {
			t.Errorf("PatenteParcial(%q) = %q, quería %q", in, got, want)
		}
	}
}

func TestRecortarRecorrido_NoLlegaALaCasa(t *testing.T) {
	destino := domain.Coordenadas{Lat: -31.42789, Lng: -62.08321}
	r := &domain.RecorridoMapa{
		Geometria:  [][2]float64{{-31.4400, -62.0900}, {-31.4320, -62.0860}, {-31.4282, -62.0835}, {destino.Lat, destino.Lng}},
		DistanciaM: 2000, DuracionS: 300,
	}
	got := RecortarRecorrido(r, destino, 150)
	ultimo := got.Geometria[len(got.Geometria)-1]
	if ultimo != [2]float64{-31.428, -62.083} {
		t.Fatalf("último punto %v: tiene que ser el destino redondeado", ultimo)
	}
	for _, p := range got.Geometria[:len(got.Geometria)-1] {
		if p == [2]float64{destino.Lat, destino.Lng} || p == [2]float64{-31.4282, -62.0835} {
			t.Fatalf("quedó un punto a menos de 150 m del destino: %v", p)
		}
	}
	if RecortarRecorrido(nil, destino, 150) != nil {
		t.Fatal("nil tiene que seguir siendo nil")
	}
}
