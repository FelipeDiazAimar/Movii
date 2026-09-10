package services

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

// HU-10 Task 1, Paso 1: crear un envío registra el evento raíz
// (anterior=nil, nuevo=pendiente, actor=nil) dentro de la misma tx.
func TestEnvioService_CreateRegistraEventoRaiz(t *testing.T) {
	svc, pool := nuevoEnvioServiceDeTest(t)
	ctx := context.Background()

	envio, err := svc.Create(ctx, CrearEnvioInput{
		RemitenteNombre: "Dep. Central", DestinatarioNombre: "Cliente Raiz",
		Calle: "Belgrano", Numero: "500", Localidad: "San Francisco", CodigoPostal: "X2400",
		Peso: 2.0, Tamano: domain.TamanoMediano,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", envio.RemitenteID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", envio.DestinatarioID)
	})

	historial, err := svc.eventoRepo.ListarPorEnvio(ctx, envio.ID)
	require.NoError(t, err)
	require.Len(t, historial, 1, "el detalle nuevo trae 1 evento raíz")
	raiz := historial[0]
	require.Nil(t, raiz.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioPendiente, raiz.EstadoNuevo)
	require.Nil(t, raiz.ActorNombre)
	require.Nil(t, raiz.Motivo)
	require.Nil(t, raiz.Comentario)
}
