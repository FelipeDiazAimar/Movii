package repository

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func nuevoPoolDeTestEnvio(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return pool
}

// crearRemitenteYDestinatarioDeTest crea los contactos que un envío necesita y
// devuelve una función para limpiarlos al final del test.
func crearRemitenteYDestinatarioDeTest(t *testing.T, pool *pgxpool.Pool) (remitenteID, destinatarioID string) {
	t.Helper()
	ctx := context.Background()

	rem, err := CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem Test", Direccion: "Calle 1"})
	require.NoError(t, err)
	dest, err := CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest Test", Calle: "Calle 2", Numero: "100", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})
	return rem.ID, dest.ID
}

func TestEnvioRepo_CreateYGetByID(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	creado, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9001", Peso: 3.5, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	require.NotEmpty(t, creado.ID)
	require.Equal(t, domain.EstadoEnvioPendiente, creado.Estado)

	detalle, err := repo.GetByID(ctx, creado.ID)
	require.NoError(t, err)
	require.Equal(t, "Dest Test", detalle.Destinatario.Nombre)

	_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", creado.ID)
}

func TestEnvioRepo_CreateCodigoGuiaDuplicado(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	primero, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9002", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)

	_, err = repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9002", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.ErrorIs(t, err, ErrDuplicado)

	_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", primero.ID)
}

func TestEnvioRepo_ListFiltraPorEstado(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	creado, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9003", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", creado.ID) })

	lista, err := repo.List(ctx, domain.EstadoEnvioPendiente, "")
	require.NoError(t, err)

	var encontrado bool
	for _, e := range lista {
		if e.ID == creado.ID {
			encontrado = true
		}
	}
	require.True(t, encontrado, "el envío creado debería aparecer en el listado filtrado por pendiente")
}

func TestEnvioRepo_AsignarYDesasignar(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	envio, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9004", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })

	// repartidor de demo (seed de HU-01) para usar como dueño de la ruta de test
	var repartidorID string
	err = pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	var rutaID string
	err = pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id) VALUES ('Ruta Test', 'Zona Test', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID) })

	_, err = repo.AsignarEnvios(ctx, []string{envio.ID}, rutaID)
	require.NoError(t, err)

	asignado, err := repo.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioAsignado, asignado.Estado)
	require.NotNil(t, asignado.RutaID)
	require.Equal(t, rutaID, *asignado.RutaID)

	err = repo.DesasignarEnvio(ctx, envio.ID, rutaID)
	require.NoError(t, err)

	desasignado, err := repo.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioPendiente, desasignado.Estado)
	require.Nil(t, desasignado.RutaID)
}

func TestEnvioRepo_AsignarEnvioNoDisponibleDevuelveError(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()

	_, err := repo.AsignarEnvios(ctx, []string{"00000000-0000-0000-0000-000000000000"}, "11111111-1111-1111-1111-111111111111")
	require.ErrorIs(t, err, ErrEnvioNoDisponible)
}
