package services

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// Tests con DB de HU-08 (Task 4): EnvioService.GetByID puebla
// confirmacion vía ConfirmacionRepo.Obtener. Con confirmación → metadata
// con las URLs binarias; sin confirmación → nil (serializa como null).

func TestEnvioService_GetByIDSinConfirmacionDevuelveNull(t *testing.T) {
	svc, pool := nuevoEnvioServiceDeTest(t)
	ctx := context.Background()

	envio, err := svc.Create(ctx, CrearEnvioInput{
		RemitenteNombre: "Dep. Central", DestinatarioNombre: "Cliente Sin Confirmar",
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
	require.Nil(t, detalle.Confirmacion, "sin confirmación debe ser null")
}

func TestEnvioService_GetByIDConConfirmacionDevuelveMetadata(t *testing.T) {
	svc, pool := nuevoEnvioServiceDeTest(t)
	ctx := context.Background()
	confirmaciones := repository.NewConfirmacionRepo(pool)

	envio, err := svc.Create(ctx, CrearEnvioInput{
		RemitenteNombre: "Dep. Central", DestinatarioNombre: "Cliente Confirmado",
		Calle: "Mitre", Numero: "200", Localidad: "San Francisco", CodigoPostal: "X2400",
		Peso: 2.0, Tamano: domain.TamanoMediano,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", envio.RemitenteID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", envio.DestinatarioID)
	})

	firma := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01}
	foto := []byte{0xFF, 0xD8, 0xFF, 0x00, 0x01}
	require.NoError(t, confirmaciones.Guardar(ctx, pool, domain.Confirmacion{
		EnvioID:          envio.ID,
		ReceptorNombre:   "Juan Pérez",
		ReceptorRelacion: domain.RelacionDestinatario,
		Firma:            firma,
		Foto:             foto,
	}))

	detalle, err := svc.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.NotNil(t, detalle.Confirmacion)
	require.Equal(t, "Juan Pérez", detalle.Confirmacion.ReceptorNombre)
	require.Equal(t, domain.RelacionDestinatario, detalle.Confirmacion.ReceptorRelacion)
	require.NotEmpty(t, detalle.Confirmacion.ConfirmadaAt, "confirmada_at (UTC to_char) se pasa tal cual")
	require.Equal(t, "/envios/"+envio.ID+"/confirmacion/firma", detalle.Confirmacion.FirmaURL)
	require.Equal(t, "/envios/"+envio.ID+"/confirmacion/foto", detalle.Confirmacion.FotoURL)
}
