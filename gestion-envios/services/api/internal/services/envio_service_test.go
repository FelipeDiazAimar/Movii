package services

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

func TestValidarCrearEnvioInput_RechazaSinDestinatario(t *testing.T) {
	err := validarCrearEnvioInput(CrearEnvioInput{Calle: "Calle 1", Localidad: "San Francisco", Peso: 1})
	require.ErrorIs(t, err, ErrCamposObligatorios)
}

func TestValidarCrearEnvioInput_RechazaSinDireccion(t *testing.T) {
	err := validarCrearEnvioInput(CrearEnvioInput{DestinatarioNombre: "Juan", Localidad: "San Francisco", Peso: 1})
	require.ErrorIs(t, err, ErrCamposObligatorios)
}

func TestValidarCrearEnvioInput_RechazaPesoInvalido(t *testing.T) {
	err := validarCrearEnvioInput(CrearEnvioInput{
		DestinatarioNombre: "Juan", Calle: "Calle 1", Localidad: "San Francisco", Peso: 0,
	})
	require.ErrorIs(t, err, ErrCamposObligatorios)
}

func TestValidarCrearEnvioInput_AceptaInputCompleto(t *testing.T) {
	err := validarCrearEnvioInput(CrearEnvioInput{
		DestinatarioNombre: "Juan", Calle: "Calle 1", Localidad: "San Francisco", Peso: 2.5,
	})
	require.NoError(t, err)
}

func nuevoEnvioServiceDeTest(t *testing.T) (*EnvioService, *pgxpool.Pool) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return NewEnvioService(pool, repository.NewEnvioRepo(pool)), pool
}

func TestEnvioService_CreateGeneraCodigoYPersiste(t *testing.T) {
	svc, pool := nuevoEnvioServiceDeTest(t)
	ctx := context.Background()

	envio, err := svc.Create(ctx, CrearEnvioInput{
		RemitenteNombre: "Dep. Central", DestinatarioNombre: "Cliente Test",
		Calle: "Belgrano", Numero: "500", Localidad: "San Francisco", CodigoPostal: "X2400",
		Peso: 4.2, Tamano: domain.TamanoMediano,
	})
	require.NoError(t, err)
	require.Contains(t, envio.CodigoGuia, "MOV-")
	require.Equal(t, domain.EstadoEnvioPendiente, envio.Estado)

	detalle, err := svc.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.Equal(t, "Cliente Test", detalle.Destinatario.Nombre)

	lista, err := svc.List(ctx, domain.EstadoEnvioPendiente, "")
	require.NoError(t, err)
	var encontrado bool
	for _, e := range lista {
		if e.ID == envio.ID {
			encontrado = true
		}
	}
	require.True(t, encontrado)

	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", envio.RemitenteID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", envio.DestinatarioID)
	})
}

func TestEnvioService_CreateRechazaInputInvalido(t *testing.T) {
	svc, _ := nuevoEnvioServiceDeTest(t)

	_, err := svc.Create(context.Background(), CrearEnvioInput{})
	require.ErrorIs(t, err, ErrCamposObligatorios)
}
