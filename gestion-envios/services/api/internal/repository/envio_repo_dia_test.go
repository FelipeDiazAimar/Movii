package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func TestEnvioRepo_ListDelDiaPorRepartidor(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()

	var repartidorID string
	err := pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	var rutaID string
	err = pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id) VALUES ('Ruta Dia Test', 'Zona Test', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID) })

	envio, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9101", Peso: 2, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })
	require.NoError(t, repo.AsignarEnvios(ctx, []string{envio.ID}, rutaID))

	hoy := currentDateUTC()
	lista, err := repo.ListDelDiaPorRepartidor(ctx, repartidorID, hoy, "")
	require.NoError(t, err)

	var encontrado bool
	for _, e := range lista {
		if e.ID == envio.ID {
			encontrado = true
			require.Equal(t, "Ruta Dia Test", e.RutaNombre)
			require.Equal(t, "Dest Test", e.Destinatario.Nombre)
		}
	}
	require.True(t, encontrado, "el envío asignado debería aparecer en el listado del día del repartidor")

	// Filtrado por estado que no matchea: no debería aparecer.
	listaFiltrada, err := repo.ListDelDiaPorRepartidor(ctx, repartidorID, hoy, domain.EstadoEnvioEntregado)
	require.NoError(t, err)
	for _, e := range listaFiltrada {
		require.NotEqual(t, envio.ID, e.ID)
	}
}
