package services

import (
	"errors"
	"strings"
)

// ErrTelefonoInvalido indica un número que no se puede llevar a formato internacional.
var ErrTelefonoInvalido = errors.New("telefono invalido")

// codigoAreaPorDefecto es la característica de San Francisco (Córdoba), que se
// asume cuando el número se carga sin ella (ej. "15 412345" o "412345").
const codigoAreaPorDefecto = "3564"

// NormalizarTelefonoAR lleva un número argentino escrito como lo escribe la
// gente ("3564-15-412345", "+54 9 3564 412345", "03564 412345") al formato que
// usa WhatsApp para celulares: 549 + código de área + número, sin el 0 ni el 15.
// Devuelve ErrTelefonoInvalido si no queda un número de 10 dígitos nacionales.
func NormalizarTelefonoAR(entrada string) (string, error) {
	var b strings.Builder
	for _, r := range entrada {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	d := b.String()

	switch {
	case strings.HasPrefix(d, "549"):
		d = d[3:]
	case strings.HasPrefix(d, "54") && len(d) >= 12:
		d = d[2:]
	}
	d = strings.TrimPrefix(d, "0")

	// Sin código de área: número local de San Francisco, con o sin 15.
	if len(d) <= 8 {
		d = strings.TrimPrefix(d, "15")
		d = codigoAreaPorDefecto + d
	}

	// Quitar el "15" que va después del código de área (de 2, 3 o 4 dígitos).
	if len(d) == 12 {
		for _, largoArea := range []int{2, 3, 4} {
			if d[largoArea:largoArea+2] == "15" {
				d = d[:largoArea] + d[largoArea+2:]
				break
			}
		}
	}

	if len(d) != 10 || d[0] == '0' {
		return "", ErrTelefonoInvalido
	}
	return "549" + d, nil
}
