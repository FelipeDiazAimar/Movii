// Flota demo: lleva la flota a 7–8 vehículos si faltan, por patente.
package demo

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// VehiculoDemo describe un vehículo a crear (nunca los 3 de la migración).
type VehiculoDemo struct {
	Patente          string
	Modelo           string
	Tipo             string
	CapacidadPeso    float64
	CapacidadVolumen float64
	Estado           string
	Color            string
	Temperatura      float64
}

// Patentes de la migración 0007: jamás se borran ni se recrean.
var patentesMigracion = map[string]bool{
	"TRK-318": true,
	"FUR-102": true,
	"CAM-205": true,
}

// Vehículos propios del demo (5 nuevos + 3 de la migración = 8 en total).
// Modelos reales del mercado argentino, patentes Mercosur o vieja.
var vehiculosDemo = []VehiculoDemo{
	{"AA874KP", "Mercedes-Benz Sprinter 515", "furgon", 3550, 11, "en_base", "#2563EB", 5},
	{"AB512TR", "Iveco Tector 170E28", "camion", 10000, 36, "en_base", "#059669", 6},
	{"AC238UY", "Renault Kangoo II", "utilitario", 800, 4.5, "en_base", "#F59E0B", 19},
	{"KLM412", "Fiat Fiorino 1.4", "utilitario", 650, 3.2, "en_base", "#EF4444", 20},
	{"AD671QZ", "Honda CG 150 Cargo", "moto", 150, 0.8, "mantenimiento", "#06B6D4", 22},
}

// PatentesDemo devuelve las patentes que creó el demo (para -limpiar).
func PatentesDemo() []string {
	out := make([]string, 0, len(vehiculosDemo))
	for _, v := range vehiculosDemo {
		out = append(out, v.Patente)
	}
	return out
}

// TemperaturaDemo devuelve la temperatura de carga por patente demo.
func TemperaturaDemo(patente string) float64 {
	for _, v := range vehiculosDemo {
		if v.Patente == patente {
			return v.Temperatura
		}
	}
	return 18
}

// AsegurarFlota crea los vehículos demo que falten (por patente) y devuelve
// cuántos creó. No toca los 3 de la migración.
func AsegurarFlota(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	creados := 0
	for _, v := range vehiculosDemo {
		var existe string
		err := pool.QueryRow(ctx, `SELECT id FROM vehiculos WHERE patente = $1`, v.Patente).Scan(&existe)
		if err == nil {
			continue
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO vehiculos (patente, modelo, tipo, capacidad_peso, capacidad_volumen, estado, color, temperatura)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (patente) DO NOTHING
		`, v.Patente, v.Modelo, v.Tipo, v.CapacidadPeso, v.CapacidadVolumen, v.Estado, v.Color, v.Temperatura); err != nil {
			return creados, err
		}
		creados++
		log.Printf("  vehículo creado: %s %s (%s)", v.Patente, v.Modelo, v.Tipo)
	}
	return creados, nil
}
