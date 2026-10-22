package services

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

func nuevoAsignacionServiceDeTest(t *testing.T) (*AsignacionService, *pgxpool.Pool, string) {
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

	rutaRepo := repository.NewRutaRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	return NewAsignacionService(rutaRepo, envioRepo), pool, repartidorID
}

func crearEnvioPendienteDeTest(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	rem, err := repository.CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem"})
	require.NoError(t, err)
	dest, err := repository.CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest", Calle: "Calle", Numero: "1", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)
	envioRepo := repository.NewEnvioRepo(pool)
	envio, err := envioRepo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-TEST-" + time.Now().Format("150405.000"), Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: rem.ID, DestinatarioID: dest.ID,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})
	return envio.ID
}

func TestAsignacionService_AsignarYDesasignar(t *testing.T) {
	svc, pool, repartidorID := nuevoAsignacionServiceDeTest(t)
	ctx := context.Background()
	rutaRepo := repository.NewRutaRepo(pool)

	ruta, err := rutaRepo.Create(ctx, domain.Ruta{
		Nombre: "Ruta Asig Test", Zona: "Centro", Fecha: time.Now().UTC().Format("2006-01-02"), RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	envioID := crearEnvioPendienteDeTest(t, pool)

	_, err = svc.Asignar(ctx, ruta.ID, []string{envioID})
	require.NoError(t, err)

	err = svc.Desasignar(ctx, ruta.ID, envioID)
	require.NoError(t, err)
}

func TestAsignacionService_AsignarRechazaFechaVencida(t *testing.T) {
	svc, pool, repartidorID := nuevoAsignacionServiceDeTest(t)
	ctx := context.Background()
	rutaRepo := repository.NewRutaRepo(pool)

	ayer := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	ruta, err := rutaRepo.Create(ctx, domain.Ruta{
		Nombre: "Ruta Vencida Test", Zona: "Centro", Fecha: ayer, RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	envioID := crearEnvioPendienteDeTest(t, pool)

	_, err = svc.Asignar(ctx, ruta.ID, []string{envioID})
	require.ErrorIs(t, err, ErrFechaVencida)
}

func TestAsignacionService_DesasignarRechazaRutaNoPlanificada(t *testing.T) {
	svc, pool, repartidorID := nuevoAsignacionServiceDeTest(t)
	ctx := context.Background()
	rutaRepo := repository.NewRutaRepo(pool)

	ruta, err := rutaRepo.Create(ctx, domain.Ruta{
		Nombre: "Ruta EnCurso Test", Zona: "Centro", Fecha: time.Now().UTC().Format("2006-01-02"), RepartidorID: repartidorID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	envioID := crearEnvioPendienteDeTest(t, pool)
	_, err = svc.Asignar(ctx, ruta.ID, []string{envioID})
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "UPDATE rutas SET estado = 'en_curso' WHERE id = $1", ruta.ID)
	require.NoError(t, err)

	err = svc.Desasignar(ctx, ruta.ID, envioID)
	require.ErrorIs(t, err, repository.ErrRutaNoEditable)
}
