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

func TestAgruparPorRuta_AgrupaEnOrdenDeAparicion(t *testing.T) {
	rutaA, rutaB := "ruta-a", "ruta-b"
	envios := []domain.EnvioDelDia{
		{Envio: domain.Envio{ID: "e1", RutaID: &rutaA}, RutaNombre: "Ruta A"},
		{Envio: domain.Envio{ID: "e2", RutaID: &rutaB}, RutaNombre: "Ruta B"},
		{Envio: domain.Envio{ID: "e3", RutaID: &rutaA}, RutaNombre: "Ruta A"},
	}

	grupos := agruparPorRuta(envios)

	require.Len(t, grupos, 2)
	require.Equal(t, "Ruta A", grupos[0].RutaNombre)
	require.Len(t, grupos[0].Envios, 2)
	require.Equal(t, "Ruta B", grupos[1].RutaNombre)
	require.Len(t, grupos[1].Envios, 1)
}

func TestCalcularContadores(t *testing.T) {
	envios := []domain.EnvioDelDia{
		{Envio: domain.Envio{Estado: domain.EstadoEnvioPendiente}},
		{Envio: domain.Envio{Estado: domain.EstadoEnvioAsignado}},
		{Envio: domain.Envio{Estado: domain.EstadoEnvioAsignado}},
		{Envio: domain.Envio{Estado: domain.EstadoEnvioEnCamino}},
		{Envio: domain.Envio{Estado: domain.EstadoEnvioEntregado}},
		{Envio: domain.Envio{Estado: domain.EstadoEnvioNoEntregado}},
	}

	total, pendientes, asignados, enCamino, entregados, noEntregados := calcularContadores(envios)

	require.Equal(t, 6, total)
	require.Equal(t, 1, pendientes)
	require.Equal(t, 2, asignados)
	require.Equal(t, 1, enCamino)
	require.Equal(t, 1, entregados)
	require.Equal(t, 1, noEntregados)
}

func nuevoRepartidorServiceDeTest(t *testing.T) (*RepartidorService, *pgxpool.Pool, string) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	var repartidorID string
	err = pool.QueryRow(context.Background(), "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	return NewRepartidorService(repository.NewEnvioRepo(pool)), pool, repartidorID
}

func TestRepartidorService_EnviosDelDia(t *testing.T) {
	svc, pool, repartidorID := nuevoRepartidorServiceDeTest(t)
	ctx := context.Background()

	rem, err := repository.CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem"})
	require.NoError(t, err)
	dest, err := repository.CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest", Calle: "Calle", Numero: "1", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)
	envioRepo := repository.NewEnvioRepo(pool)
	envio, err := envioRepo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9102", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: rem.ID, DestinatarioID: dest.ID,
	})
	require.NoError(t, err)

	var rutaID string
	err = pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id) VALUES ('Ruta Service Dia', 'Zona', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID)
	require.NoError(t, err)

	// Un solo Cleanup con el orden correcto de borrado. Antes había dos
	// Cleanup separados y, como t.Cleanup corre en orden inverso al de
	// registro (LIFO), la ruta se intentaba borrar ANTES que el envío que
	// todavía la referenciaba: el DELETE fallaba por la foreign key, el
	// error se descartaba con "_, _ =" y la fila de rutas quedaba huérfana
	// en la base compartida en cada corrida del test.
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})
	_, err = envioRepo.AsignarEnvios(ctx, []string{envio.ID}, rutaID)
	require.NoError(t, err)

	resumen, err := svc.EnviosDelDia(ctx, repartidorID, "")
	require.NoError(t, err)
	require.GreaterOrEqual(t, resumen.Total, 1)
	require.GreaterOrEqual(t, resumen.Asignados, 1)

	var encontrado bool
	for _, grupo := range resumen.Rutas {
		if grupo.RutaID == rutaID {
			encontrado = true
			require.Equal(t, "Ruta Service Dia", grupo.RutaNombre)
		}
	}
	require.True(t, encontrado)
}
