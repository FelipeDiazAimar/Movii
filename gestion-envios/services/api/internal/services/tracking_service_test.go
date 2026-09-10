package services

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
	_ "movii/api/internal/testenv"
)

func strptrDeTest(s string) *string { return &s }

// TestDescribirEvento cubre todos los casos del mapeo puro (Task 2,
// Paso 2) SIN DB. Textos exactos del plan de HU-10.
func TestDescribirEvento(t *testing.T) {
	pendiente := domain.EstadoEnvioPendiente
	asignado := domain.EstadoEnvioAsignado
	noEntregado := domain.EstadoEnvioNoEntregado
	motivo := domain.MotivoClienteAusente

	casos := []struct {
		nombre   string
		anterior *string
		nuevo    string
		motivo   *string
		esperado string
	}{
		{"raíz (anterior nil)", nil, domain.EstadoEnvioPendiente, nil, "Envío registrado"},
		{"raíz asignado directo", nil, domain.EstadoEnvioAsignado, nil, "Envío registrado"},
		{"asignado", &pendiente, domain.EstadoEnvioAsignado, nil, "Asignado a ruta de reparto"},
		{"en camino", &asignado, domain.EstadoEnvioEnCamino, nil, "En camino"},
		{"entregado", &asignado, domain.EstadoEnvioEntregado, nil, "Entregado"},
		{"no entregado con motivo", &asignado, domain.EstadoEnvioNoEntregado, &motivo, "No se pudo entregar: cliente ausente"},
		{"no entregado sin motivo", &asignado, domain.EstadoEnvioNoEntregado, nil, "No se pudo entregar: motivo no especificado"},
		{"reprogramado (no_entregado→pendiente)", &noEntregado, domain.EstadoEnvioPendiente, nil, "Reprogramado para un nuevo intento"},
		{"desasignado (asignado→pendiente)", &asignado, domain.EstadoEnvioPendiente, nil, "Desasignado de la ruta de reparto"},
		{"pendiente desde otro origen", &pendiente, domain.EstadoEnvioPendiente, nil, "Actualización de estado"},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			require.Equal(t, c.esperado, describirEvento(c.anterior, c.nuevo, c.motivo))
		})
	}
}

// TestMotivoLegible cubre la traducción de motivos (Task 2, Paso 2) SIN DB.
func TestMotivoLegible(t *testing.T) {
	require.Equal(t, "cliente ausente", motivoLegible(domain.MotivoClienteAusente))
	require.Equal(t, "dirección incorrecta", motivoLegible(domain.MotivoDireccionIncorrecta))
	require.Equal(t, "rechazado por el destinatario", motivoLegible(domain.MotivoRechazado))
	require.Equal(t, "zona insegura", motivoLegible(domain.MotivoZonaInsegura))
	require.Equal(t, "otro motivo", motivoLegible(domain.MotivoOtro))
}

func nuevoTrackingServiceDeTest(t *testing.T) (*TrackingService, *pgxpool.Pool) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return NewTrackingService(repository.NewTrackingRepo(pool)), pool
}

func crearEnvioTrackingDeTest(t *testing.T, pool *pgxpool.Pool, codigo string) string {
	t.Helper()
	ctx := context.Background()

	rem, err := repository.CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem Tracking Svc", Direccion: "Calle 1"})
	require.NoError(t, err)
	dest, err := repository.CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest Tracking Svc", Calle: "Calle 2", Numero: "100",
		Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})

	envios := repository.NewEnvioRepo(pool)
	envio, err := envios.Create(ctx, pool, domain.Envio{
		CodigoGuia: codigo, Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: rem.ID, DestinatarioID: dest.ID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })
	return envio.ID
}

// TestTrackingService_PorCodigoConEventos: con historial, actualizado_en es
// la fecha del ÚLTIMO evento y el motivo viaja tal cual (puede ser nil).
func TestTrackingService_PorCodigoConEventos(t *testing.T) {
	svc, pool := nuevoTrackingServiceDeTest(t)
	ctx := context.Background()
	eventos := repository.NewEventoRepo(pool)

	envioID := crearEnvioTrackingDeTest(t, pool, "MOV-19000101-9401")

	require.NoError(t, eventos.Registrar(ctx, pool, envioID, nil, domain.EstadoEnvioPendiente, nil, nil, nil, nil))
	pendiente := domain.EstadoEnvioPendiente
	require.NoError(t, eventos.Registrar(ctx, pool, envioID, &pendiente, domain.EstadoEnvioAsignado, nil, nil, nil, nil))

	resp, err := svc.PorCodigo(ctx, "MOV-19000101-9401")
	require.NoError(t, err)
	require.Equal(t, "MOV-19000101-9401", resp.CodigoGuia)
	require.Equal(t, domain.EstadoEnvioPendiente, resp.Estado)
	require.Equal(t, "San Francisco", resp.Localidad)
	require.NotNil(t, resp.Historial)
	require.Len(t, resp.Historial, 2)
	require.Equal(t, "Envío registrado", resp.Historial[0].Descripcion)
	require.Nil(t, resp.Historial[0].Motivo)
	require.Equal(t, "Asignado a ruta de reparto", resp.Historial[1].Descripcion)
	require.Equal(t, resp.Historial[1].Fecha, resp.ActualizadoEn)
}

// TestTrackingService_PorCodigoSinEventos: sin historial, actualizado_en es
// la creación y el historial es [] (no nil).
func TestTrackingService_PorCodigoSinEventos(t *testing.T) {
	svc, pool := nuevoTrackingServiceDeTest(t)
	ctx := context.Background()

	envioID := crearEnvioTrackingDeTest(t, pool, "MOV-19000101-9402")

	_, _, _, _, creadoEn, err := repository.NewTrackingRepo(pool).PorCodigo(ctx, "MOV-19000101-9402")
	require.NoError(t, err)
	require.NotEmpty(t, envioID)

	resp, err := svc.PorCodigo(ctx, "MOV-19000101-9402")
	require.NoError(t, err)
	require.Equal(t, "MOV-19000101-9402", resp.CodigoGuia)
	require.Equal(t, creadoEn, resp.ActualizadoEn)
	require.NotNil(t, resp.Historial)
	require.Empty(t, resp.Historial)
}

// TestTrackingService_PorCodigoInexistente: código desconocido →
// repository.ErrNoEncontrado (el handler lo mapea al 404 genérico).
func TestTrackingService_PorCodigoInexistente(t *testing.T) {
	svc, _ := nuevoTrackingServiceDeTest(t)
	ctx := context.Background()

	_, err := svc.PorCodigo(ctx, "MOV-19000101-9499")
	require.ErrorIs(t, err, repository.ErrNoEncontrado)
}
