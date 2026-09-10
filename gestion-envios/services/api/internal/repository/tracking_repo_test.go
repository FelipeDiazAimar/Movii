package repository

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	_ "movii/api/internal/testenv"
)

// crearContactosSensiblesDeTest crea remitente y destinatario con datos
// sensibles cargados (teléfonos, dirección exacta). El TrackingRepo solo
// selecciona columnas blancas: el struct ni siquiera tiene esos campos
// (garantía en tiempo de compilación, doble barrera de HU-10).
func crearContactosSensiblesDeTest(t *testing.T, pool *pgxpool.Pool, remitenteNombre string) (remitenteID, destinatarioID string) {
	t.Helper()
	ctx := context.Background()

	rem, err := CreateRemitente(ctx, pool, domain.Remitente{
		Nombre: remitenteNombre, Telefono: "3415000000", Direccion: "Calle Secreta 123",
	})
	require.NoError(t, err)
	dest, err := CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest Sensible", Telefono: "3415000001", Calle: "Calle Secreta",
		Numero: "123", Localidad: "Rosario", CodigoPostal: "S2000",
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})
	return rem.ID, dest.ID
}

func TestTrackingRepo_PorCodigo(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	envios := NewEnvioRepo(pool)
	repo := NewTrackingRepo(pool)
	ctx := context.Background()

	remitenteID, destinatarioID := crearContactosSensiblesDeTest(t, pool, "Rem Tracking 1")

	envio, err := envios.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9301", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })

	envioID, codigo, estado, localidad, creadoEn, err := repo.PorCodigo(ctx, "MOV-19000101-9301")
	require.NoError(t, err)
	require.Equal(t, envio.ID, envioID)
	require.Equal(t, "MOV-19000101-9301", codigo)
	require.Equal(t, domain.EstadoEnvioPendiente, estado)
	require.Equal(t, "Rosario", localidad)
	require.NotEmpty(t, creadoEn)

	// Match exacto: otro case no matchea.
	_, _, _, _, _, err = repo.PorCodigo(ctx, "mov-19000101-9301")
	require.ErrorIs(t, err, ErrNoEncontrado)

	// Código inexistente → ErrNoEncontrado (el handler lo mapea al 404
	// genérico del openapi, sin distinguir ni sugerir).
	_, _, _, _, _, err = repo.PorCodigo(ctx, "MOV-19000101-9999")
	require.ErrorIs(t, err, ErrNoEncontrado)
}

func TestTrackingRepo_EventosBlancos(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	envios := NewEnvioRepo(pool)
	eventos := NewEventoRepo(pool)
	repo := NewTrackingRepo(pool)
	ctx := context.Background()

	var repartidorID string
	err := pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	remitenteID, destinatarioID := crearContactosSensiblesDeTest(t, pool, "Rem Tracking 2")

	envio, err := envios.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9302", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })

	// Raíz (anterior NULL, sin actor) + asignación con actor y comentario
	// interno + incidencia con motivo: el repo blanco solo devuelve
	// fecha/anterior/nuevo/motivo de las tres.
	require.NoError(t, eventos.Registrar(ctx, pool, envio.ID, nil, domain.EstadoEnvioPendiente, nil, nil, nil, nil))
	pendiente := domain.EstadoEnvioPendiente
	comentarioInterno := "interno: no exponer en tracking"
	require.NoError(t, eventos.Registrar(ctx, pool, envio.ID, &pendiente, domain.EstadoEnvioAsignado, nil, &comentarioInterno, &repartidorID, nil))
	asignado := domain.EstadoEnvioAsignado
	motivo := domain.MotivoClienteAusente
	require.NoError(t, eventos.Registrar(ctx, pool, envio.ID, &asignado, domain.EstadoEnvioNoEntregado, &motivo, nil, &repartidorID, nil))

	blancos, err := repo.EventosBlancos(ctx, envio.ID)
	require.NoError(t, err)
	require.NotNil(t, blancos)
	require.Len(t, blancos, 3)

	require.NotEmpty(t, blancos[0].Fecha)
	require.Nil(t, blancos[0].EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioPendiente, blancos[0].EstadoNuevo)
	require.Nil(t, blancos[0].Motivo)

	require.NotNil(t, blancos[1].EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioPendiente, *blancos[1].EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioAsignado, blancos[1].EstadoNuevo)
	require.Nil(t, blancos[1].Motivo)

	require.NotNil(t, blancos[2].Motivo)
	require.Equal(t, domain.MotivoClienteAusente, *blancos[2].Motivo)
	require.Equal(t, domain.EstadoEnvioNoEntregado, blancos[2].EstadoNuevo)
}

func TestTrackingRepo_EventosBlancosVacioDevuelveSliceNoNil(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewTrackingRepo(pool)
	ctx := context.Background()

	blancos, err := repo.EventosBlancos(ctx, "00000000-0000-0000-0000-000000000000")
	require.NoError(t, err)
	require.NotNil(t, blancos)
	require.Empty(t, blancos)
}
