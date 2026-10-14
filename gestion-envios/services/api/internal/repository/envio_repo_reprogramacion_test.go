package repository

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	_ "movii/api/internal/testenv"
)

// Tests con DB de HU-09 (Task 1): EnvioRepo.Reprogramar/ReprogramacionDe,
// limpieza de reprogramación en AsignarEnvios y filtro fecha de List.

func crearEnvioNoEntregadoDeTest(t *testing.T, repo *EnvioRepo, codigoGuia string) string {
	t.Helper()
	ctx := context.Background()
	pool := nuevoPoolDeTestEnvio(t)
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	creado, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: codigoGuia, Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", creado.ID) })

	require.NoError(t, repo.ActualizarEstado(ctx, pool, creado.ID, domain.EstadoEnvioNoEntregado))
	return creado.ID
}

func TestEnvioRepo_ReprogramarFeliz(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()

	envioID := crearEnvioNoEntregadoDeTest(t, repo, fmt.Sprintf("MOV-%d-9301", time.Now().UnixNano()%100000000))

	// Asignar primero a una ruta para verificar que Reprogramar limpia ruta_id:
	// un pendiente no pertenece a ninguna ruta.
	var repartidorID string
	require.NoError(t, pool.QueryRow(ctx,
		"SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))
	var rutaID string
	require.NoError(t, pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id)
		VALUES ('Ruta Reprog Feliz', 'Zona', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID))
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "UPDATE envios SET ruta_id = NULL WHERE ruta_id = $1", rutaID)
		_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID)
	})
	_, _ = pool.Exec(ctx, "UPDATE envios SET ruta_id = $1 WHERE id = $2", rutaID, envioID)

	require.NoError(t, repo.Reprogramar(ctx, pool, envioID, "2100-05-15", domain.FranjaTarde))

	detalle, err := repo.GetByID(ctx, envioID)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioPendiente, detalle.Estado)
	require.Nil(t, detalle.RutaID, "reprogramar debe limpiar la ruta")

	para, franja, err := repo.ReprogramacionDe(ctx, envioID)
	require.NoError(t, err)
	require.NotNil(t, para)
	require.Equal(t, "2100-05-15", *para)
	require.NotNil(t, franja)
	require.Equal(t, domain.FranjaTarde, *franja)
}

func TestEnvioRepo_ReprogramarInexistente(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)

	err := repo.Reprogramar(context.Background(), pool, "00000000-0000-0000-0000-000000000000", "2100-05-15", domain.FranjaManana)
	require.ErrorIs(t, err, ErrNoEncontrado)
}

func TestEnvioRepo_ReprogramacionDe(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()

	// Sin datos → nil, nil.
	envioID := crearEnvioNoEntregadoDeTest(t, repo, fmt.Sprintf("MOV-%d-9302", time.Now().UnixNano()%100000000))
	para, franja, err := repo.ReprogramacionDe(ctx, envioID)
	require.NoError(t, err)
	require.Nil(t, para)
	require.Nil(t, franja)

	// Con datos.
	require.NoError(t, repo.Reprogramar(ctx, pool, envioID, "2100-06-20", domain.FranjaNoche))
	para, franja, err = repo.ReprogramacionDe(ctx, envioID)
	require.NoError(t, err)
	require.NotNil(t, para)
	require.Equal(t, "2100-06-20", *para)
	require.NotNil(t, franja)
	require.Equal(t, domain.FranjaNoche, *franja)

	// Inexistente.
	_, _, err = repo.ReprogramacionDe(ctx, "00000000-0000-0000-0000-000000000000")
	require.ErrorIs(t, err, ErrNoEncontrado)
}

func TestEnvioRepo_AsignarLimpiaReprogramacion(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()

	envioID := crearEnvioNoEntregadoDeTest(t, repo, fmt.Sprintf("MOV-%d-9303", time.Now().UnixNano()%100000000))
	require.NoError(t, repo.Reprogramar(ctx, pool, envioID, "2100-07-10", domain.FranjaManana))

	var repartidorID string
	require.NoError(t, pool.QueryRow(ctx,
		"SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))
	var rutaID string
	require.NoError(t, pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id)
		VALUES ('Ruta Limpia Reprog', 'Zona', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID))
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "UPDATE envios SET ruta_id = NULL WHERE ruta_id = $1", rutaID)
		_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID)
	})

	// Al asignarse a una ruta, la fecha de la ruta manda y las columnas de
	// reprogramación se limpian (lo exige el comentario de la 0004).
	n, err := repo.AsignarEnvios(ctx, []string{envioID}, rutaID)
	require.NoError(t, err)
	require.Equal(t, 1, n)

	para, franja, err := repo.ReprogramacionDe(ctx, envioID)
	require.NoError(t, err)
	require.Nil(t, para, "asignar debe limpiar reprogramado_para")
	require.Nil(t, franja, "asignar debe limpiar franja")
}

func TestEnvioRepo_ListIncluyeReprogramadosEnNuevaFecha(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()

	envioID := crearEnvioNoEntregadoDeTest(t, repo, fmt.Sprintf("MOV-%d-9304", time.Now().UnixNano()%100000000))
	require.NoError(t, repo.Reprogramar(ctx, pool, envioID, "2100-08-25", domain.FranjaTarde))

	// El envío se creó hoy, así que solo puede aparecer en la fecha futura
	// por el OR de reprogramado_para.
	lista, err := repo.List(ctx, "", "2100-08-25")
	require.NoError(t, err)
	require.NotNil(t, lista)
	var encontrado bool
	for _, e := range lista {
		if e.ID == envioID {
			encontrado = true
		}
	}
	require.True(t, encontrado, "el envío reprogramado debe aparecer en su nueva fecha")

	// Y no debe aparecer en una fecha sin nada.
	vacia, err := repo.List(ctx, "", "1900-02-02")
	require.NoError(t, err)
	require.NotNil(t, vacia)
	for _, e := range vacia {
		require.NotEqual(t, envioID, e.ID)
	}
}
