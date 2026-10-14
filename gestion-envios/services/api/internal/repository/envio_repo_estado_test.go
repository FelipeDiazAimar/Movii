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

// Tests con DB de Task 3 (Paso 3): EnvioRepo.ActualizarEstado.

func TestEnvioRepo_ActualizarEstado(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	creado, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: fmt.Sprintf("MOV-%d", time.Now().UnixNano()%100000000),
		Peso:       1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", creado.ID) })

	require.NoError(t, repo.ActualizarEstado(ctx, pool, creado.ID, domain.EstadoEnvioAsignado))

	detalle, err := repo.GetByID(ctx, creado.ID)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioAsignado, detalle.Estado)
}

func TestEnvioRepo_ActualizarEstadoInexistente(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()

	err := repo.ActualizarEstado(ctx, pool, "00000000-0000-0000-0000-000000000000", domain.EstadoEnvioEnCamino)
	require.ErrorIs(t, err, ErrNoEncontrado)
}
