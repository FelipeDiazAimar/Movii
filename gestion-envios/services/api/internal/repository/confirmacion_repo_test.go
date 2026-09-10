package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

// firmaPNGMinima es un PNG de 1px (magic bytes 89 50 4E 47 0D 0A 1A 0A +
// resto) y fotoJPEGMinima un JPEG mínimo (magic bytes FF D8 FF + resto),
// como bytes reales mínimos para el roundtrip de HU-08.
var (
	firmaPNGMinima = []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52}
	fotoJPEGMinima = []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00}
)

func TestConfirmacionRepo_GuardarYObtener(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	envios := NewEnvioRepo(pool)
	confirmaciones := NewConfirmacionRepo(pool)
	ctx := context.Background()

	var repartidorID string
	err := pool.QueryRow(ctx, "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	remitenteID, destinatarioID := crearRemitenteYDestinatarioDeTest(t, pool)

	envio, err := envios.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-19000101-9301", Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: remitenteID, DestinatarioID: destinatarioID,
	})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID) })

	guardada := domain.Confirmacion{
		EnvioID:          envio.ID,
		ReceptorNombre:   "Juan Pérez",
		ReceptorRelacion: domain.RelacionDestinatario,
		Firma:            firmaPNGMinima,
		Foto:             fotoJPEGMinima,
		ConfirmadaPor:    &repartidorID,
	}
	require.NoError(t, confirmaciones.Guardar(ctx, pool, guardada))

	obtenida, err := confirmaciones.Obtener(ctx, envio.ID)
	require.NoError(t, err)
	require.Equal(t, envio.ID, obtenida.EnvioID)
	require.Equal(t, "Juan Pérez", obtenida.ReceptorNombre)
	require.Equal(t, domain.RelacionDestinatario, obtenida.ReceptorRelacion)
	require.Equal(t, firmaPNGMinima, obtenida.Firma)
	require.Equal(t, fotoJPEGMinima, obtenida.Foto)
	require.NotNil(t, obtenida.ConfirmadaPor)
	require.Equal(t, repartidorID, *obtenida.ConfirmadaPor)
	require.NotEmpty(t, obtenida.ConfirmadaAt)
}

func TestConfirmacionRepo_ObtenerInexistente(t *testing.T) {
	pool := nuevoPoolDeTestEnvio(t)
	confirmaciones := NewConfirmacionRepo(pool)
	ctx := context.Background()

	_, err := confirmaciones.Obtener(ctx, "00000000-0000-0000-0000-000000000000")
	require.ErrorIs(t, err, ErrNoEncontrado)
}
