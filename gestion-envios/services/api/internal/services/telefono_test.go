package services

import (
	"errors"
	"testing"
)

func TestNormalizarTelefonoAR(t *testing.T) {
	casos := map[string]string{
		"3564-412345":        "5493564412345",
		"3564 15 412345":     "5493564412345",
		"03564-15-412345":    "5493564412345",
		"+54 9 3564 412345":  "5493564412345",
		"+54 3564 412345":    "5493564412345",
		"5493564412345":      "5493564412345",
		"15 412345":          "5493564412345",
		"412345":             "5493564412345",
		"11 2345-6789":       "5491123456789",
		"011 15 2345-6789":   "5491123456789",
		"(0351) 15-555-1234": "5493515551234",
		"+54 9 351 555 1234": "5493515551234",
	}
	for entrada, want := range casos {
		got, err := NormalizarTelefonoAR(entrada)
		if err != nil || got != want {
			t.Errorf("NormalizarTelefonoAR(%q) = %q, %v; se esperaba %q", entrada, got, err, want)
		}
	}
}

func TestNormalizarTelefonoAR_Invalidos(t *testing.T) {
	for _, entrada := range []string{"", "abc", "123", "35641234567890", "0000000000"} {
		if _, err := NormalizarTelefonoAR(entrada); !errors.Is(err, ErrTelefonoInvalido) {
			t.Errorf("NormalizarTelefonoAR(%q) debía fallar, err=%v", entrada, err)
		}
	}
}
