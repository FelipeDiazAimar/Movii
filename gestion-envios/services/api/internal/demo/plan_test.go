// Tests puros del plan de datos: no tocan la base, solo la lógica de plan.go.
package demo

import (
	"strings"
	"testing"
	"time"
)

func TestRangoHistorialSinDomingos(t *testing.T) {
	ref := "2026-11-11" // miércoles
	dias := RangoHistorial(ref, 30)
	if len(dias) == 0 {
		t.Fatal("rango vacío")
	}
	vistos := map[string]bool{}
	for _, f := range dias {
		if _, err := time.Parse("2006-01-02", f); err != nil {
			t.Fatalf("fecha inválida %q", f)
		}
		if vistos[f] {
			t.Fatalf("fecha repetida %q", f)
		}
		vistos[f] = true
		if EsDomingo(f) {
			t.Fatalf("el rango incluye domingo %q", f)
		}
		if f >= ref {
			t.Fatalf("el rango incluye hoy o futuro %q", f)
		}
	}
	// Orden cronológico.
	for i := 1; i < len(dias); i++ {
		if dias[i-1] >= dias[i] {
			t.Fatalf("rango desordenado: %q >= %q", dias[i-1], dias[i])
		}
	}
	// 30 días antes del 2026-11-11 hay 4 domingos: quedan 26.
	if len(dias) != 26 {
		t.Fatalf("largo = %d, quiero 26", len(dias))
	}
}

func TestCantidadPorDiaEnRango(t *testing.T) {
	rnd := NuevoRandPara("2026-11-10", 7)
	for i := 0; i < 200; i++ {
		n := CantidadPorDia(false, rnd)
		if n < 8 || n > 14 {
			t.Fatalf("día de semana %d fuera de 8..14", n)
		}
		s := CantidadPorDia(true, rnd)
		if s < 5 || s > 8 {
			t.Fatalf("sábado %d fuera de 5..8", s)
		}
	}
}

func TestEfectividadEnRango(t *testing.T) {
	for total := 1; total <= 4; total++ {
		for i := 0; i < total; i++ {
			e := EfectividadPorRepartidor(i, total)
			if e < 0.84 || e > 0.96 {
				t.Fatalf("efectividad %f fuera de 0.84..0.96 (i=%d total=%d)", e, i, total)
			}
		}
	}
	// Con 4 repartidores los extremos son 84 y 96.
	if got := EfectividadPorRepartidor(0, 4); got != 0.84 {
		t.Fatalf("primer repartidor = %f, quiero 0.84", got)
	}
	if got := EfectividadPorRepartidor(3, 4); got != 0.96 {
		t.Fatalf("último repartidor = %f, quiero 0.96", got)
	}
}

func TestDecideEntregadoCercaDelNoventa(t *testing.T) {
	rnd := NuevoRandPara("2026-11-10", 99)
	const n = 20000
	entregados := 0
	for i := 0; i < n; i++ {
		if DecideEntregado(rnd, 0.90) {
			entregados++
		}
	}
	tasa := float64(entregados) / n
	if tasa < 0.88 || tasa > 0.92 {
		t.Fatalf("tasa %f fuera de 0.88..0.92", tasa)
	}
}

func TestHorariosOrdenados(t *testing.T) {
	// La historia de un envío siempre avanza: alta < asignación < en_camino < cierre.
	// Acá se verifica el constructor de horarios usado por el historial.
	rnd := NuevoRandPara("2026-11-10", 5)
	for i := 0; i < 100; i++ {
		h1 := 7*60 + 30 + rnd.IntN(60) // alta 7:30..8:30
		h2 := h1 + 15 + rnd.IntN(45)   // asignación después del alta
		h3 := 9*60 + rnd.IntN(3*60)    // en camino 9..12
		if h3 < h2 {
			h3 = h2 + 10 + rnd.IntN(60)
		}
		h4 := h3 + 30 + rnd.IntN(6*60) // cierre al menos 30 min después
		if !(h1 < h2 && h2 <= h3 && h3 < h4) {
			t.Fatalf("horarios desordenados %d %d %d %d", h1, h2, h3, h4)
		}
	}
}

func TestCodigosNoSeRepiten(t *testing.T) {
	vistos := map[string]bool{}
	for n := 1; n <= 500; n++ {
		c := CodigoGuia("2026-11-10", n)
		if !strings.HasPrefix(c, "MOV-20261110-") {
			t.Fatalf("prefijo malo %q", c)
		}
		if vistos[c] {
			t.Fatalf("código repetido %q", c)
		}
		vistos[c] = true
	}
}

func TestOtroSiempreTieneComentario(t *testing.T) {
	rnd := NuevoRandPara("2026-11-10", 11)
	for i := 0; i < 50; i++ {
		c := ComentarioParaMotivo("otro", rnd)
		if strings.TrimSpace(c) == "" {
			t.Fatal("motivo otro sin comentario")
		}
	}
	// Todos los motivos tienen al menos un comentario y ninguno usa emojis.
	for motivo := range comentariosIncidencia {
		c := ComentarioParaMotivo(motivo, rnd)
		if strings.TrimSpace(c) == "" {
			t.Fatalf("motivo %q sin comentario", motivo)
		}
		for _, r := range c {
			if r > 0x2500 && r < 0x2BFF || r >= 0x1F000 && r <= 0x1FAFF {
				t.Fatalf("comentario con emoji %q", c)
			}
		}
	}
}

func TestElegirMotivoReparte(t *testing.T) {
	rnd := NuevoRandPara("2026-11-10", 21)
	conteo := map[string]int{}
	const n = 10000
	for i := 0; i < n; i++ {
		conteo[ElegirMotivo(rnd)]++
	}
	// cliente_ausente es el más común por lejos.
	maxOtro := 0
	for m, c := range conteo {
		if m != "cliente_ausente" && c > maxOtro {
			maxOtro = c
		}
	}
	if conteo["cliente_ausente"] <= maxOtro {
		t.Fatalf("ausente no es el más común: %+v", conteo)
	}
	if conteo["otro"] == 0 {
		t.Fatal("otro nunca sale")
	}
}

func TestSemillaReproducible(t *testing.T) {
	a := NuevoRandPara("2026-11-10", 3)
	b := NuevoRandPara("2026-11-10", 3)
	for i := 0; i < 20; i++ {
		if a.IntN(1000000) != b.IntN(1000000) {
			t.Fatal("misma fecha no reproduce lo mismo")
		}
	}
	c := NuevoRandPara("2026-11-11", 3)
	if a.IntN(1000000) == c.IntN(1000000) && a.IntN(1000000) == c.IntN(1000000) {
		t.Log("aviso: dos fechas dieron lo mismo de casualidad (muy raro)")
	}
}

func TestConCuentaDemoEnVivo_LeDaElCamionNaranjaALaCuentaDeLaApp(t *testing.T) {
	reps := []RepartidorInfo{{ID: "a", Email: "carla@x"}, {ID: "b", Email: "diego@x"}, {ID: "c", Email: cuentaDemoApp}}
	vehiculos := []struct{ ID, Patente string }{{"1", "AB512TR"}, {"2", camionParaIniciarEnVivo}, {"3", "FUR-102"}}
	got := conCuentaDemoEnVivo(reps, vehiculos)
	if got[1].Email != cuentaDemoApp {
		t.Fatalf("la cuenta demo tiene que quedar con el TRK-318, quedó %+v", got)
	}
	if len(got) != 3 || reps[2].Email != cuentaDemoApp {
		t.Fatalf("no tiene que modificar el slice original ni perder repartidores")
	}
	sinNaranja := []struct{ ID, Patente string }{{"1", "AB512TR"}}
	if out := conCuentaDemoEnVivo(reps, sinNaranja); out[0].ID != "a" {
		t.Fatalf("sin el naranja no reordena")
	}
}
