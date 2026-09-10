package services

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

// Tests con DB de HU-09 (Task 4): EnvioService.GetByID puebla
// reprogramado_para/franja vía ReprogramacionDe. Sin reprogramación →
// nil,nil (serializan como null); con reprogramación → valores presentes.

func TestEnvioService_GetByIDSinReprogramacionDevuelveNulls(t *testing.T) {
	svc, pool := nuevoEnvioServiceDeTest(t)
	ctx := context.Background()

	envio, err := svc.Create(ctx, CrearEnvioInput{
		RemitenteNombre: "Dep. Central", DestinatarioNombre: "Cliente Sin Reprog",
		Calle: "Belgrano", Numero: "500", Localidad: "San Francisco", CodigoPostal: "X2400",
		Peso: 1.5, Tamano: domain.TamanoChico,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", envio.RemitenteID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", envio.DestinatarioID)
	})

	detalle, err := svc.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.Nil(t, detalle.ReprogramadoPara, "sin reprogramación debe ser null")
	require.Nil(t, detalle.Franja, "sin reprogramación debe ser null")
}

func TestEnvioService_GetByIDConReprogramacionDevuelveValores(t *testing.T) {
	svc, pool := nuevoEnvioServiceDeTest(t)
	ctx := context.Background()
	envios := svc.envioRepo

	envio, err := svc.Create(ctx, CrearEnvioInput{
		RemitenteNombre: "Dep. Central", DestinatarioNombre: "Cliente Con Reprog",
		Calle: "Mitre", Numero: "200", Localidad: "San Francisco", CodigoPostal: "X2400",
		Peso: 2.0, Tamano: domain.TamanoMediano,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", envio.RemitenteID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", envio.DestinatarioID)
	})

	require.NoError(t, envios.Reprogramar(ctx, pool, envio.ID, "2030-05-20", domain.FranjaTarde))

	detalle, err := svc.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.NotNil(t, detalle.ReprogramadoPara)
	require.Equal(t, "2030-05-20", *detalle.ReprogramadoPara)
	require.NotNil(t, detalle.Franja)
	require.Equal(t, domain.FranjaTarde, *detalle.Franja)
}
