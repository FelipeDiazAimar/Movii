package demo

import (
	"context"
	"log"
	"math/rand/v2"

	"github.com/jackc/pgx/v5/pgxpool"
)

// direccion es un domicilio real con su coordenada ya geocodificada.
type direccion struct {
	calle, numero string
	lat, lng      float64
}

// direccionSF elige un domicilio del catálogo.
func direccionSF(rnd *rand.Rand) direccion {
	return direccionesSF[rnd.IntN(len(direccionesSF))]
}

// ubicar deja el destinatario en la coordenada del catálogo (sin pasar por el geocodificador).
func ubicar(ctx context.Context, pool *pgxpool.Pool, destinatarioID string, d direccion) {
	if _, err := pool.Exec(ctx, `
		UPDATE destinatarios SET latitud = $2, longitud = $3, geo_fuente = 'catalogo' WHERE id = $1
	`, destinatarioID, d.lat, d.lng); err != nil {
		log.Printf("  ubicar %s %s: %v", d.calle, d.numero, err)
	}
}
