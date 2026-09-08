package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

// crearEnvioPendienteParaAsignar crea un envío pendiente listo para asignar y
// se encarga de limpiarlo al final del test.
func crearEnvioPendienteParaAsignar(t *testing.T, repo *EnvioRepo, codigoGuia string) string {
	t.Helper()
	ctx := context.Background()
	pool := nuevoPoolDeTestEnvio(t)
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	envio, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: codigoGuia, Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })
	return envio.ID
}

// La asignación es todo-o-nada. Si el lote mezcla un envío pendiente con otro
// que ya está asignado, la API responde "no se asignó ninguno" (409), así que
// la base tiene que quedar igual que antes. Sin la transacción, el envío
// pendiente quedaba asignado igual y la respuesta mentía (CA-01 de HU-04).
func TestEnvioRepo_AsignarLoteMixtoNoAsignaNinguno(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()

	var repartidorID string
	require.NoError(t, pool.QueryRow(ctx,
		"SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))

	var rutaID string
	err := pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id)
		VALUES ('Ruta Lote Mixto', 'Zona', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID)
	require.NoError(t, err)

	pendiente := crearEnvioPendienteParaAsignar(t, repo, "MOV-19000101-9201")
	yaAsignado := crearEnvioPendienteParaAsignar(t, repo, "MOV-19000101-9202")

	// Los envíos referencian la ruta, así que hay que desvincularlos antes de
	// poder borrarla (t.Cleanup corre en orden inverso al de registro).
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "UPDATE envios SET ruta_id = NULL WHERE ruta_id = $1", rutaID)
		_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID)
	})

	asignados, err := repo.AsignarEnvios(ctx, []string{yaAsignado}, rutaID)
	require.NoError(t, err)
	require.Equal(t, 1, asignados)

	// Lote mixto: uno pendiente + uno que ya está asignado.
	asignados, err = repo.AsignarEnvios(ctx, []string{pendiente, yaAsignado}, rutaID)
	require.ErrorIs(t, err, ErrEnvioNoDisponible)
	require.Zero(t, asignados)

	detalle, err := repo.GetByID(ctx, pendiente)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioPendiente, detalle.Estado,
		"el envío pendiente del lote fallido no debe quedar asignado")
	require.Nil(t, detalle.RutaID, "el envío pendiente no debe quedar vinculado a la ruta")
}

// Un mismo id repetido en el body se asigna una sola vez y no debe hacer
// fallar la validación de "todos disponibles".
func TestEnvioRepo_AsignarIgnoraIDsRepetidos(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()

	var repartidorID string
	require.NoError(t, pool.QueryRow(ctx,
		"SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID))

	var rutaID string
	err := pool.QueryRow(ctx, `
		INSERT INTO rutas (nombre, zona, fecha, repartidor_id)
		VALUES ('Ruta IDs Repetidos', 'Zona', CURRENT_DATE, $1)
		RETURNING id
	`, repartidorID).Scan(&rutaID)
	require.NoError(t, err)

	envioID := crearEnvioPendienteParaAsignar(t, repo, "MOV-19000101-9203")

	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "UPDATE envios SET ruta_id = NULL WHERE ruta_id = $1", rutaID)
		_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", rutaID)
	})

	asignados, err := repo.AsignarEnvios(ctx, []string{envioID, envioID}, rutaID)
	require.NoError(t, err)
	require.Equal(t, 1, asignados, "el id repetido cuenta una sola vez")
}

// CA-05 de HU-02 pide que el listado muestre la fecha de creación del envío.
func TestEnvioRepo_ListIncluyeFechaCreacion(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)
	ctx := context.Background()
	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	envio, err := repo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9204", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })

	detalle, err := repo.GetByID(ctx, envio.ID)
	require.NoError(t, err)
	require.NotEmpty(t, detalle.FechaCreacion, "el detalle debe traer la fecha de creación")
	require.Regexp(t, `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}`, detalle.FechaCreacion)

	lista, err := repo.List(ctx, domain.EstadoEnvioPendiente, "")
	require.NoError(t, err)
	var encontrado bool
	for _, e := range lista {
		if e.ID == envio.ID {
			encontrado = true
			require.NotEmpty(t, e.FechaCreacion, "el listado debe traer la fecha de creación")
		}
	}
	require.True(t, encontrado)
}

// Un listado vacío tiene que serializarse como [] y no como null, para que el
// cliente pueda recorrerlo sin chequear nil.
func TestEnvioRepo_ListVaciaDevuelveSliceNoNil(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	repo := NewEnvioRepo(pool)

	lista, err := repo.List(context.Background(), "", "1900-01-01")
	require.NoError(t, err)
	require.NotNil(t, lista)
	require.Empty(t, lista)
}
