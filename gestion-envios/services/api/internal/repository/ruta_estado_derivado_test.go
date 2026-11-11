package repository

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	_ "movii/api/internal/testenv"
)

// El estado de la ruta se deriva de sus envíos: planificada → en_curso (sale el
// primero) → completada (todos entregados o no entregados). Reprogramar un
// envío lo saca de la ruta y recalcula.
func TestEnvioRepo_EstadoDeRutaSeDerivaDeSusEnvios(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	var repartidorID, rutaID string
	require.NoError(t, pool.QueryRow(ctx, `SELECT id FROM usuarios WHERE rol = 'repartidor' LIMIT 1`).Scan(&repartidorID))
	require.NoError(t, pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id) VALUES ('Ruta Estado Derivado', 'Zona', CURRENT_DATE, $1) RETURNING id
	`, repartidorID).Scan(&rutaID))
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE ruta_id = $1", rutaID)
		_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID)
	})

	ids := make([]string, 2)
	for i := range ids {
		e, err := repo.Create(ctx, pool, domain.Envio{
			CodigoGuia: fmt.Sprintf("MOV-%d", (time.Now().UnixNano()+int64(i))%100000000),
			Peso:       1, Tamano: domain.TamanoChico, RemitenteID: remitenteID, DestinatarioID: destinatarioID,
		})
		require.NoError(t, err)
		ids[i] = e.ID
		t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", e.ID) })
	}
	n, err := repo.AsignarEnvios(ctx, ids, rutaID)
	require.NoError(t, err)
	require.Equal(t, 2, n)

	estadoRuta := func() string {
		var s string
		require.NoError(t, pool.QueryRow(ctx, `SELECT estado::text FROM rutas WHERE id = $1`, rutaID).Scan(&s))
		return s
	}
	cambiar := func(id, nuevo string) { require.NoError(t, repo.ActualizarEstado(ctx, pool, id, nuevo)) }

	require.Equal(t, domain.EstadoRutaPlanificada, estadoRuta())

	cambiar(ids[0], domain.EstadoEnvioEnCamino)
	require.Equal(t, domain.EstadoRutaEnCurso, estadoRuta())

	cambiar(ids[0], domain.EstadoEnvioEntregado)
	require.Equal(t, domain.EstadoRutaEnCurso, estadoRuta(), "queda un envío asignado: sigue en curso")

	cambiar(ids[1], domain.EstadoEnvioEnCamino)
	cambiar(ids[1], domain.EstadoEnvioNoEntregado)
	require.Equal(t, domain.EstadoRutaCompletada, estadoRuta())

	// Reprogramar el fallido lo saca de la ruta; los demás siguen cerrados: sigue completada.
	require.NoError(t, repo.Reprogramar(ctx, pool, ids[1], time.Now().AddDate(0, 0, 1).Format("2006-01-02"), "manana"))
	require.Equal(t, domain.EstadoRutaCompletada, estadoRuta())
}
