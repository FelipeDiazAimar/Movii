// Package fecha centraliza el "hoy" del negocio: hora de Argentina (UTC-3,
// sin horario de verano), no la del servidor ni UTC.
package fecha

import "time"

// Argentina es UTC-3 fijo; evita depender de la base de zonas horarias del SO.
var Argentina = time.FixedZone("ART", -3*60*60)

// Ahora devuelve la hora actual en Argentina.
func Ahora() time.Time { return time.Now().In(Argentina) }

// Hoy devuelve la fecha de hoy en Argentina, formato "YYYY-MM-DD".
func Hoy() string { return Ahora().Format("2006-01-02") }

// InicioDeHoy devuelve hoy a las 00:00 (como UTC, para comparar fechas
// parseadas con time.Parse("2006-01-02", ...)).
func InicioDeHoy() time.Time {
	t, _ := time.Parse("2006-01-02", Hoy())
	return t
}
