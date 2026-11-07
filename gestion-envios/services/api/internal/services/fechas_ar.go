package services

import "time"

// ZonaAR es la hora de Argentina (UTC-3, sin horario de verano). Las rutas se
// planifican por día local: usar UTC haría que después de las 21 h "hoy" pase
// a ser mañana.
var ZonaAR = time.FixedZone("ART", -3*60*60)

// FechaAR devuelve el día (YYYY-MM-DD) de t en hora argentina.
func FechaAR(t time.Time) string {
	return t.In(ZonaAR).Format("2006-01-02")
}
