// Package main: generador de datos ficticios para la presentación (cmd/demo).
//
// plan.go concentra la lógica pura del plan de datos: qué nombres, calles,
// motivos y horarios se generan, sin tocar la base. Todo lo que depende de
// azar recibe un *rand.Rand ya sembrado, así dos corridas del mismo día
// producen lo mismo y los tests pueden fijar la semilla.
package demo

import (
	"fmt"
	"hash/fnv"
	"math"
	"math/rand/v2"
	"strings"
	"time"
)

// Centro de San Francisco (Córdoba) y radio del historial en metros.
const (
	centroLat       = -31.4279718
	centroLng       = -62.0826608
	radioHistorialM = 2500.0
)

// Zonas estables por repartidor (hasta 4).
var zonasDemo = []string{"Centro", "Barrio Catedral", "Barrio Parque", "Barrio Iturraspe"}

// Nombres y apellidos argentinos variados para destinatarios y receptores.
var nombresPila = []string{
	"Lucía", "Martín", "Sofía", "Carlos", "Ana", "Jorge", "Valentina", "Diego",
	"Camila", "Federico", "Florencia", "Gonzalo", "Paula", "Nicolás", "Agustina",
	"Matías", "Carolina", "Emiliano", "Daniela", "Facundo", "Julieta", "Ignacio",
	"Milagros", "Tomás", "Bianca", "Santiago", "Antonella", "Ramiro", "Candela",
	"Franco", "Micaela", "Bruno", "Delfina", "Joaquín", "Morena", "Thiago",
}

var apellidosAR = []string{
	"Fernández", "Gómez", "Pérez", "Rodríguez", "López", "Martínez", "Sánchez",
	"Ramírez", "Torres", "Flores", "Acosta", "Medina", "Vargas", "Castillo",
	"Moreno", "Roldán", "Peralta", "Cabrera", "Mansilla", "Aguirre", "Bustos",
	"Correa", "Godoy", "Ojeda", "Quintero", "Villarreal", "Paredes", "Olivera",
	"Campos", "Ríos", "Giménez", "Herrera", "Maldonado", "Sosa", "Villalba",
}

// Calles reales de San Francisco para la operación de hoy y pendientes.
var callesSF = []string{
	"Bv. 25 de Mayo", "Bv. Roca", "Belgrano", "Iturraspe", "Pellegrini",
	"Mitre", "Rivadavia", "Av. del Libertador Norte", "Av. del Libertador Sur",
	"Dante Alighieri", "Juan B. Justo", "López y Planes", "Av. Rosario de Santa Fe",
	"Sáenz Peña", "Independencia", "Colón", "General Paz", "Corrientes",
	"9 de Julio", "Brasil", "Perú", "Garibaldi", "San Martín", "Sarmiento",
	"Alberdi", "Moreno", "Urquiza", "Echeverría",
}

// Remitentes creíbles (comercios ficticios de la zona).
var remitentesDemo = []struct{ nombre, direccion string }{
	{"Distribuidora del Este", "Bv. 25 de Mayo 1800, San Francisco"},
	{"Farmacia Rivadavia", "Rivadavia 550, San Francisco"},
	{"Librería Cervantes", "Belgrano 1920, San Francisco"},
	{"Ferretería El Tornillo", "Juan B. Justo 2050, San Francisco"},
	{"Panificadora La Espiga", "Mitre 840, San Francisco"},
	{"Veterinaria San Roque", "Bv. Roca 1180, San Francisco"},
	{"Electro Hogar Centro", "Iturraspe 1620, San Francisco"},
	{"Indumentaria Punto Sur", "Pellegrini 310, San Francisco"},
	{"Dietética Natural Vida", "Sáenz Peña 720, San Francisco"},
	{"Juguetería Arco Iris", "9 de Julio 430, San Francisco"},
	{"Óptica Visión", "General Paz 610, San Francisco"},
	{"Casa de Deportes El Campeón", "Colón 890, San Francisco"},
}

// Contenidos típicos con peso base sugerido.
var contenidosDemo = []struct {
	contenido string
	pesoMin   float64
	pesoMax   float64
	tamano    string
	fragil    bool
}{
	{"Indumentaria", 0.5, 4, "mediano", false},
	{"Medicamentos", 0.3, 2, "chico", true},
	{"Documentación", 0.2, 1, "chico", false},
	{"Electrónica", 1, 8, "mediano", true},
	{"Insumos", 2, 12, "grande", false},
	{"Libros", 1, 6, "mediano", false},
	{"Herramientas", 2, 15, "grande", false},
	{"Repuestos", 0.5, 10, "mediano", false},
	{"Cosmética", 0.3, 3, "chico", true},
	{"Indumentaria deportiva", 0.5, 5, "mediano", false},
	{"Electrodoméstico", 15, 65, "grande", true},
	{"Muebles en kit", 20, 80, "grande", false},
	{"Materiales de construcción", 25, 90, "grande", false},
	{"Bebidas (cajas)", 12, 45, "grande", false},
	{"Neumáticos", 9, 40, "grande", false},
	{"Alimento balanceado", 5, 25, "grande", false},
	{"Calzado", 0.8, 4, "mediano", false},
	{"Juguetes", 0.5, 5, "mediano", false},
	{"Vidriería", 1, 6, "mediano", true},
	{"Repostería", 1, 8, "mediano", false},
}

// Comentarios de incidencia cortos, como los escribiría un repartidor real.
var comentariosIncidencia = map[string][]string{
	"cliente_ausente": {
		"golpeé dos veces y no atendió nadie",
		"no había nadie en el domicilio",
		"timbre y golpes sin respuesta",
		"vecina dice que salieron",
		"no atiende, vuelvo mañana",
		"portón cerrado, sin respuesta",
	},
	"direccion_incorrecta": {
		"la altura no existe en esa cuadra",
		"el número no coincide con la calle",
		"dirección incompleta, falta referencia",
		"esa numeración es de la otra mano",
		"no encontré el domicilio",
	},
	"rechazado": {
		"dice que no pidió nada",
		"rechaza por faltante en el pedido",
		"no quiere recibirlo hoy",
		"pide devolver al remitente",
	},
	"zona_insegura": {
		"calle sin luz, no pude ingresar",
		"me avisaron que no entre de noche",
		"zona complicada a esta hora",
	},
	"otro": {
		"perro suelto, no pude bajarme",
		"lluvia fuerte, imposible entregar",
		"portero sin llave del edificio",
		"cliente pidió pasar mañana",
	},
}

// Dominios comunes para los mails ficticios.
var dominiosMail = []string{"gmail.com", "hotmail.com", "yahoo.com.ar", "outlook.com"}

// SemillaPara produce una semilla reproducible por fecha y uso (salt).
// Dos corridas del mismo día producen los mismos datos.
func SemillaPara(fecha string, salt uint64) (uint64, uint64) {
	h := fnv.New64a()
	_, _ = h.Write([]byte(fecha))
	base := h.Sum64()
	// Mezcla simple para el segundo valor del PCG.
	return base ^ 0x9e3779b97f4a7c15 ^ salt, base + salt*0xbf58476d1ce4e5b9
}

// NuevoRandPara crea un azar reproducible para una fecha y un propósito.
func NuevoRandPara(fecha string, salt uint64) *rand.Rand {
	s1, s2 := SemillaPara(fecha, salt)
	return rand.New(rand.NewPCG(s1, s2))
}

// EsDomingo indica si fecha (YYYY-MM-DD) cae domingo.
func EsDomingo(fecha string) bool {
	t, err := time.Parse("2006-01-02", fecha)
	if err != nil {
		return false
	}
	return t.Weekday() == time.Sunday
}

// EsSabado indica si fecha (YYYY-MM-DD) cae sábado.
func EsSabado(fecha string) bool {
	t, err := time.Parse("2006-01-02", fecha)
	if err != nil {
		return false
	}
	return t.Weekday() == time.Saturday
}

// SumarDias suma n días a una fecha YYYY-MM-DD (n puede ser negativo).
func SumarDias(fecha string, n int) string {
	t, err := time.Parse("2006-01-02", fecha)
	if err != nil {
		return fecha
	}
	return t.AddDate(0, 0, n).Format("2006-01-02")
}

// ProximoHabil devuelve la misma fecha si no es domingo, o el lunes siguiente.
func ProximoHabil(fecha string) string {
	for EsDomingo(fecha) {
		fecha = SumarDias(fecha, 1)
	}
	return fecha
}

// RangoHistorial devuelve los días hábiles (sin domingos) de los N días
// anteriores a ref, en orden cronológico. ref queda excluida: es la
// operación de hoy, que se arma por otro camino.
func RangoHistorial(ref string, dias int) []string {
	if dias <= 0 {
		return nil
	}
	out := make([]string, 0, dias)
	for i := dias; i >= 1; i-- {
		f := SumarDias(ref, -i)
		if EsDomingo(f) {
			continue
		}
		if _, err := time.Parse("2006-01-02", f); err != nil {
			continue
		}
		out = append(out, f)
	}
	return out
}

// CantidadPorDia decide cuántos envíos lleva una ruta histórica:
// 8–14 en días de semana, 5–8 los sábados (más livianos).
func CantidadPorDia(esSabado bool, rnd *rand.Rand) int {
	if esSabado {
		return 5 + rnd.IntN(4) // 5..8
	}
	return 8 + rnd.IntN(7) // 8..14
}

// EfectividadPorRepartidor reparte 84 %–96 % según el índice del repartidor.
// Con 4 repartidores da 84, 88, 92 y 96; con menos, los primeros de esa lista.
func EfectividadPorRepartidor(indice, total int) float64 {
	base := []float64{0.84, 0.88, 0.92, 0.96}
	if total <= 0 {
		return 0.90
	}
	if indice < len(base) && total <= len(base) {
		// Si hay menos de 4, se mantienen los extremos 84..96 escalados.
		if total == 1 {
			return 0.90
		}
		pos := float64(indice) / float64(total-1)
		return 0.84 + pos*(0.96-0.84)
	}
	return base[indice%len(base)]
}

// DecideEntregado tira el resultado de un envío según la efectividad.
func DecideEntregado(rnd *rand.Rand, efectividad float64) bool {
	return rnd.Float64() < efectividad
}

// PesosMotivo reparte las incidencias: ausente la más común, otro la rara.
func PesosMotivo() (motivos []string, pesos []float64) {
	return []string{
		"cliente_ausente",
		"direccion_incorrecta",
		"rechazado",
		"zona_insegura",
		"otro",
	}, []float64{
		0.45, 0.25, 0.12, 0.10, 0.08,
	}
}

// ElegirMotivo sortea un motivo de fallo con los pesos del Pareto.
func ElegirMotivo(rnd *rand.Rand) string {
	motivos, pesos := PesosMotivo()
	x := rnd.Float64()
	acum := 0.0
	for i, p := range pesos {
		acum += p
		if x < acum {
			return motivos[i]
		}
	}
	return motivos[0]
}

// ComentarioParaMotivo elige un comentario corto de repartidor.
// "otro" siempre trae comentario (obligatorio por negocio).
func ComentarioParaMotivo(motivo string, rnd *rand.Rand) string {
	lista, ok := comentariosIncidencia[motivo]
	if !ok || len(lista) == 0 {
		lista = comentariosIncidencia["otro"]
	}
	return lista[rnd.IntN(len(lista))]
}

// CodigoGuia arma MOV-AAAAMMDD-NNNN con el número dado.
func CodigoGuia(fechaAAAAMMDD string, n int) string {
	compacta := strings.ReplaceAll(fechaAAAAMMDD, "-", "")
	return fmt.Sprintf("MOV-%s-%04d", compacta, n)
}

// GenerarTelefono arma un fijo ficticio con característica 3564 y 6 dígitos.
// Usa el rango 412xxx–479xxx para no pisar los del seed original.
func GenerarTelefono(rnd *rand.Rand) string {
	n := 412000 + rnd.IntN(68000) // 412000..479999
	return fmt.Sprintf("3564 %d", n)
}

// NombreCompleto arma un nombre argentino variado.
func NombreCompleto(rnd *rand.Rand) string {
	return nombresPila[rnd.IntN(len(nombresPila))] + " " + apellidosAR[rnd.IntN(len(apellidosAR))]
}

// GenerarEmail arma nombre.apellido@dominio para ~60 % de los casos.
// Devuelve "" cuando no corresponde mail (el 40 % restante).
func GenerarEmail(nombre string, rnd *rand.Rand) string {
	if rnd.Float64() > 0.60 {
		return ""
	}
	partes := strings.Fields(strings.ToLower(nombre))
	if len(partes) == 0 {
		return ""
	}
	// Saca tildes de forma simple para que el mail sea válido.
	sinTildes := func(s string) string {
		r := strings.NewReplacer("á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ñ", "n", "ü", "u")
		return r.Replace(s)
	}
	usuario := sinTildes(partes[0])
	if len(partes) > 1 {
		usuario += "." + sinTildes(partes[len(partes)-1])
	}
	usuario = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '.' {
			return r
		}
		return -1
	}, usuario)
	if usuario == "" {
		return ""
	}
	return usuario + "@" + dominiosMail[rnd.IntN(len(dominiosMail))]
}

// CalleNumero elige una calle real y una numeración plausible.
func CalleNumero(rnd *rand.Rand) (string, string) {
	calle := callesSF[rnd.IntN(len(callesSF))]
	num := 50 + rnd.IntN(2450) // 50..2499
	return calle, fmt.Sprintf("%d", num)
}

// GenerarCoordenadaDemo da un punto dentro del radio de 2,5 km del centro.
func GenerarCoordenadaDemo(rnd *rand.Rand) (float64, float64) {
	// Disco uniforme: r = R*sqrt(u), ángulo uniforme.
	r := radioHistorialM * math.Sqrt(rnd.Float64())
	ang := rnd.Float64() * 2 * math.Pi
	dLat := r * math.Cos(ang) / 111320.0
	dLng := r * math.Sin(ang) / (111320.0 * math.Cos(centroLat*math.Pi/180))
	return centroLat + dLat, centroLng + dLng
}

// HoraEntrega sortea una hora creíble entre las 9 y las 19 (hora argentina).
func HoraEntrega(rnd *rand.Rand) (hora, minuto int) {
	hora = 9 + rnd.IntN(10) // 9..18 (la entrega cae dentro de esa hora)
	minuto = rnd.IntN(60)
	return hora, minuto
}

// RelacionReceptor sortea destinatario (mayoría) o familiar/vecino/encargado.
func RelacionReceptor(rnd *rand.Rand) string {
	x := rnd.Float64()
	switch {
	case x < 0.70:
		return "destinatario"
	case x < 0.82:
		return "familiar"
	case x < 0.92:
		return "vecino"
	default:
		return "encargado"
	}
}

// ContenidoPaquete sortea contenido, peso, tamaño y flags frágil/urgente.
func ContenidoPaquete(rnd *rand.Rand) (contenido string, peso float64, tamano string, fragil, urgente bool) {
	c := contenidosDemo[rnd.IntN(len(contenidosDemo))]
	peso = c.pesoMin + rnd.Float64()*(c.pesoMax-c.pesoMin)
	peso = math.Round(peso*100) / 100
	if peso <= 0 {
		peso = 1
	}
	tamano = c.tamano
	// A veces el tamaño varía respecto del sugerido.
	if rnd.Float64() < 0.15 {
		tamano = []string{"chico", "mediano", "grande"}[rnd.IntN(3)]
	}
	fragil = c.fragil
	if rnd.Float64() < 0.10 {
		fragil = !fragil
	}
	urgente = rnd.Float64() < 0.12
	return c.contenido, peso, tamano, fragil, urgente
}

// RemitenteDemo sortea un comercio remitente ficticio.
func RemitenteDemo(rnd *rand.Rand) (string, string, string) {
	r := remitentesDemo[rnd.IntN(len(remitentesDemo))]
	tel := GenerarTelefono(rnd)
	return r.nombre, tel, r.direccion
}

// FranjaReprogramacion sortea mañana/tarde/noche para reprogramar.
func FranjaReprogramacion(rnd *rand.Rand) string {
	return []string{"manana", "tarde", "noche"}[rnd.IntN(3)]
}
