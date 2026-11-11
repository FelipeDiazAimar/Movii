package imagenes

import (
	"bytes"
	"image/jpeg"
	"image/png"
	"math/rand/v2"
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

func TestImagenesDemoSonValidas(t *testing.T) {
	rnd := rand.New(rand.NewPCG(1, 2))
	for i := 0; i < 12; i++ {
		f := Firma(rnd)
		if _, err := png.Decode(bytes.NewReader(f)); err != nil {
			t.Fatalf("firma %d no es PNG: %v", i, err)
		}
		if len(f) > 64<<10 {
			t.Fatalf("firma %d muy grande: %d bytes", i, len(f))
		}
		fo := Foto(rnd)
		if _, err := jpeg.Decode(bytes.NewReader(fo)); err != nil {
			t.Fatalf("foto %d no es JPEG: %v", i, err)
		}
		if len(fo) > 128<<10 {
			t.Fatalf("foto %d muy grande: %d bytes", i, len(fo))
		}
	}
	// MOVII_DEMO_IMAGENES=<dir> guarda las variantes para mirarlas.
	if dir := os.Getenv("MOVII_DEMO_IMAGENES"); dir != "" {
		preparar()
		for i := range Variantes {
			_ = os.WriteFile(filepath.Join(dir, "firma"+strconv.Itoa(i)+".png"), firmas[i], 0o644)
			_ = os.WriteFile(filepath.Join(dir, "foto"+strconv.Itoa(i)+".jpg"), fotos[i], 0o644)
		}
	}
}
