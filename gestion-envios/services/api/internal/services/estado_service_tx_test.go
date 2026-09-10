package services

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
	_ "movii/api/internal/testenv"
)

// Helpers y tests con DB de Task 3 (HU-06/HU-07): CambiarEstado y
// RegistrarIncidencia con transacción estado+evento.

func nuevoEstadoServiceDeTest(t *testing.T) (*EstadoService, *pgxpool.Pool, string, string) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	ctx := context.Background()
	var repartidorID, operadorID string
	err = pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)
	err = pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'operador@movii.demo'").Scan(&operadorID)
	require.NoError(t, err)

	envios := repository.NewEnvioRepo(pool)
	eventos := repository.NewEventoRepo(pool)
	return NewEstadoService(pool, envios, eventos), pool, repartidorID, operadorID
}

// crearEnvioAsignadoDeTest crea un envío en estado asignado en una ruta del
// repartidor dado y devuelve su ID. Limpia todo al final del test.
func crearEnvioAsignadoDeTest(t *testing.T, pool *pgxpool.Pool, repartidorID string) string {
	t.Helper()
	ctx := context.Background()

	rem, err := repository.CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem Estado"})
	require.NoError(t, err)
	dest, err := repository.CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest Estado", Calle: "Calle", Numero: "1", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)

	envios := repository.NewEnvioRepo(pool)
	envio, err := envios.Create(ctx, pool, domain.Envio{
		CodigoGuia: fmt.Sprintf("MOV-%d", time.Now().UnixNano()%100000000),
		Peso:       1, Tamano: domain.TamanoChico,
		RemitenteID: rem.ID, DestinatarioID: dest.ID,
	})
	require.NoError(t, err)

	var rutaID string
	err = pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id) VALUES ('Ruta Estado Test', 'Zona Test', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID)
	require.NoError(t, err)

	asignados, err := envios.AsignarEnvios(ctx, []string{envio.ID}, rutaID)
	require.NoError(t, err)
	require.Equal(t, 1, asignados)

	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})
	return envio.ID
}

// crearEnvioPendienteDeEstado crea un envío sin asignar (estado pendiente).
func crearEnvioPendienteDeEstado(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()

	rem, err := repository.CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem Estado Pend"})
	require.NoError(t, err)
	dest, err := repository.CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest Estado Pend", Calle: "Calle", Numero: "1", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)

	envios := repository.NewEnvioRepo(pool)
	envio, err := envios.Create(ctx, pool, domain.Envio{
		CodigoGuia: fmt.Sprintf("MOV-%d", time.Now().UnixNano()%100000000),
		Peso:       1, Tamano: domain.TamanoChico,
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

func estadoActualDeTest(t *testing.T, pool *pgxpool.Pool, envioID string) string {
	t.Helper()
	var estado string
	err := pool.QueryRow(context.Background(), "SELECT estado FROM envios WHERE id = $1", envioID).Scan(&estado)
	require.NoError(t, err)
	return estado
}

func TestEstadoService_CambiarEstadoFelizAmbasDirecciones(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()
	eventos := repository.NewEventoRepo(pool)

	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)

	actualizado, err := svc.CambiarEstado(ctx, envioID, domain.EstadoEnvioEnCamino, repartidorID, domain.RolRepartidor)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioEnCamino, actualizado.Estado)
	require.Equal(t, envioID, actualizado.ID)

	deVuelta, err := svc.CambiarEstado(ctx, envioID, domain.EstadoEnvioAsignado, repartidorID, domain.RolRepartidor)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioAsignado, deVuelta.Estado)

	// Dos eventos registrados, uno por cambio.
	historial, err := eventos.ListarPorEnvio(ctx, envioID)
	require.NoError(t, err)
	require.Len(t, historial, 2)
	require.Equal(t, domain.EstadoEnvioEnCamino, historial[0].EstadoNuevo)
	require.Equal(t, domain.EstadoEnvioAsignado, historial[1].EstadoNuevo)
	require.NotNil(t, historial[0].EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioAsignado, *historial[0].EstadoAnterior)
}

func TestEstadoService_CambiarEstadoOperadorSobreEnvioAjenoOK(t *testing.T) {
	svc, pool, repartidorID, operadorID := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)

	actualizado, err := svc.CambiarEstado(ctx, envioID, domain.EstadoEnvioEnCamino, operadorID, domain.RolOperador)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioEnCamino, actualizado.Estado)
}

func TestEstadoService_CambiarEstadoRepartidorAjenoDaNoEncontrado(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)

	otroRepartidor := "00000000-0000-0000-0000-000000000000"
	_, err := svc.CambiarEstado(ctx, envioID, domain.EstadoEnvioEnCamino, otroRepartidor, domain.RolRepartidor)
	require.ErrorIs(t, err, repository.ErrNoEncontrado)
	require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
}

func TestEstadoService_CambiarEstadoEnvioInexistente(t *testing.T) {
	svc, _, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	_, err := svc.CambiarEstado(ctx, "00000000-0000-0000-0000-000000000000", domain.EstadoEnvioEnCamino, repartidorID, domain.RolRepartidor)
	require.ErrorIs(t, err, repository.ErrNoEncontrado)
}

func TestEstadoService_CambiarEstadoTransicionInvalidaIndicaEndpoint(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)

	_, err := svc.CambiarEstado(ctx, envioID, domain.EstadoEnvioEntregado, repartidorID, domain.RolRepartidor)
	require.ErrorIs(t, err, ErrTransicionInvalida)
	require.Contains(t, err.Error(), "confirmacion")

	_, err = svc.CambiarEstado(ctx, envioID, domain.EstadoEnvioNoEntregado, repartidorID, domain.RolRepartidor)
	require.ErrorIs(t, err, ErrTransicionInvalida)
	require.Contains(t, err.Error(), "incidencia")

	// El estado no cambió.
	require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
}

func TestEstadoService_RegistrarIncidenciaFeliz(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()
	eventos := repository.NewEventoRepo(pool)

	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)

	actualizado, err := svc.RegistrarIncidencia(ctx, envioID, domain.MotivoClienteAusente, "nadie atendió", nil, repartidorID, domain.RolRepartidor)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioNoEntregado, actualizado.Estado)

	historial, err := eventos.ListarPorEnvio(ctx, envioID)
	require.NoError(t, err)
	require.NotEmpty(t, historial)
	ultimo := historial[len(historial)-1]
	require.Equal(t, domain.EstadoEnvioNoEntregado, ultimo.EstadoNuevo)
	require.NotNil(t, ultimo.Motivo)
	require.Equal(t, domain.MotivoClienteAusente, *ultimo.Motivo)
	require.NotNil(t, ultimo.Comentario)
	require.Equal(t, "nadie atendió", *ultimo.Comentario)
}

func TestEstadoService_RegistrarIncidenciaErrores(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	t.Run("motivo invalido", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.RegistrarIncidencia(ctx, envioID, "llueve_mucho", "comentario", nil, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrMotivoInvalido)
		require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("otro sin comentario", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.RegistrarIncidencia(ctx, envioID, domain.MotivoOtro, "", nil, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrComentarioObligatorio)
	})

	t.Run("otro con comentario solo espacios", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.RegistrarIncidencia(ctx, envioID, domain.MotivoOtro, "   ", nil, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrComentarioObligatorio)
	})

	t.Run("otro con comentario OK", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		actualizado, err := svc.RegistrarIncidencia(ctx, envioID, domain.MotivoOtro, "portón cerrado con candado", nil, repartidorID, domain.RolRepartidor)
		require.NoError(t, err)
		require.Equal(t, domain.EstadoEnvioNoEntregado, actualizado.Estado)
	})

	t.Run("estado pendiente rechaza incidencia", func(t *testing.T) {
		envioID := crearEnvioPendienteDeEstado(t, pool)
		_, err := svc.RegistrarIncidencia(ctx, envioID, domain.MotivoRechazado, "", nil, repartidorID, domain.RolOperador)
		require.ErrorIs(t, err, ErrTransicionInvalida)
		require.Equal(t, domain.EstadoEnvioPendiente, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("con foto se rechaza", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.RegistrarIncidencia(ctx, envioID, domain.MotivoZonaInsegura, "comentario", []byte{0xFF, 0xD8, 0xFF}, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrImagenNoSoportada)
		require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("repartidor ajeno da no encontrado", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.RegistrarIncidencia(ctx, envioID, domain.MotivoRechazado, "", nil, "00000000-0000-0000-0000-000000000000", domain.RolRepartidor)
		require.ErrorIs(t, err, repository.ErrNoEncontrado)
	})
}
