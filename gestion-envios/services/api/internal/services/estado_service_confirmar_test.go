package services

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
	_ "movii/api/internal/testenv"
)

// Tests con DB de Task 2 (HU-08): ConfirmarEntrega — feliz desde en_camino
// (1 evento) y desde asignado (2 eventos), guards, validaciones y 409s.

// firmaPNGDeTest y fotoJPEGDeTest son evidencias mínimas válidas: solo se
// validan los magic bytes (PNG para la firma, JPEG para la foto), no el
// contenido completo de la imagen.
var (
	firmaPNGDeTest  = []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01}
	fotoJPEGDeTest  = []byte{0xFF, 0xD8, 0xFF, 0x00, 0x01}
	firmaJPEGDeTest = []byte{0xFF, 0xD8, 0xFF, 0x00, 0x01} // JPEG donde va PNG
	fotoPNGDeTest   = []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00}
)

// ponerEnCaminoDeTest mueve un envío asignado a en_camino.
func ponerEnCaminoDeTest(t *testing.T, svc *EstadoService, envioID, repartidorID string) {
	t.Helper()
	_, err := svc.CambiarEstado(context.Background(), envioID, domain.EstadoEnvioEnCamino, repartidorID, domain.RolRepartidor)
	require.NoError(t, err)
}

func TestEstadoService_ConfirmarEntregaFelizDesdeEnCamino(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()
	eventos := repository.NewEventoRepo(pool)
	confirmaciones := repository.NewConfirmacionRepo(pool)

	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
	ponerEnCaminoDeTest(t, svc, envioID, repartidorID)

	entregado, err := svc.ConfirmarEntrega(ctx, envioID, "Juan Pérez", domain.RelacionDestinatario, firmaPNGDeTest, fotoJPEGDeTest, repartidorID, domain.RolRepartidor)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioEntregado, entregado.Estado)
	require.Equal(t, envioID, entregado.ID)

	// UN solo evento: en_camino → entregado.
	historial, err := eventos.ListarPorEnvio(ctx, envioID)
	require.NoError(t, err)
	require.Len(t, historial, 2) // 1 del pase a en_camino + 1 de la confirmación
	ultimo := historial[len(historial)-1]
	require.Equal(t, domain.EstadoEnvioEntregado, ultimo.EstadoNuevo)
	require.NotNil(t, ultimo.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioEnCamino, *ultimo.EstadoAnterior)

	// La evidencia quedó persistida byte-idéntica.
	guardada, err := confirmaciones.Obtener(ctx, envioID)
	require.NoError(t, err)
	require.Equal(t, "Juan Pérez", guardada.ReceptorNombre)
	require.Equal(t, domain.RelacionDestinatario, guardada.ReceptorRelacion)
	require.Equal(t, firmaPNGDeTest, guardada.Firma)
	require.Equal(t, fotoJPEGDeTest, guardada.Foto)
	require.NotNil(t, guardada.ConfirmadaPor)
	require.Equal(t, repartidorID, *guardada.ConfirmadaPor)
}

func TestEstadoService_ConfirmarEntregaFelizDesdeAsignadoDosEventos(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()
	eventos := repository.NewEventoRepo(pool)

	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)

	entregado, err := svc.ConfirmarEntrega(ctx, envioID, "María Gómez", domain.RelacionFamiliar, firmaPNGDeTest, fotoJPEGDeTest, repartidorID, domain.RolRepartidor)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioEntregado, entregado.Estado)

	// DOS eventos: asignado → en_camino (paso intermedio) + en_camino → entregado.
	// (Sin orden posicional: ambos se insertan en la misma tx, comparten
	// created_at y el id es UUID aleatorio, así que el ORDER BY empata.)
	historial, err := eventos.ListarPorEnvio(ctx, envioID)
	require.NoError(t, err)
	require.Len(t, historial, 2)
	porNuevo := make(map[string]domain.EventoEnvio, 2)
	for _, e := range historial {
		porNuevo[e.EstadoNuevo] = e
	}
	intermedio, ok := porNuevo[domain.EstadoEnvioEnCamino]
	require.True(t, ok, "falta el evento asignado→en_camino")
	require.NotNil(t, intermedio.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioAsignado, *intermedio.EstadoAnterior)
	require.NotNil(t, intermedio.Comentario)
	require.Equal(t, "paso por en_camino (confirmación directa)", *intermedio.Comentario)
	final, ok := porNuevo[domain.EstadoEnvioEntregado]
	require.True(t, ok, "falta el evento en_camino→entregado")
	require.NotNil(t, final.EstadoAnterior)
	require.Equal(t, domain.EstadoEnvioEnCamino, *final.EstadoAnterior)
}

func TestEstadoService_ConfirmarEntregaOperadorSobreEnvioAjenoOK(t *testing.T) {
	svc, pool, repartidorID, operadorID := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)

	entregado, err := svc.ConfirmarEntrega(ctx, envioID, "Vecino Amable", domain.RelacionVecino, firmaPNGDeTest, fotoJPEGDeTest, operadorID, domain.RolOperador)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoEnvioEntregado, entregado.Estado)
}

func TestEstadoService_ConfirmarEntregaRepartidorAjenoDaNoEncontrado(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	t.Run("repartidor ajeno", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.ConfirmarEntrega(ctx, envioID, "Juan", domain.RelacionDestinatario, firmaPNGDeTest, fotoJPEGDeTest, "00000000-0000-0000-0000-000000000000", domain.RolRepartidor)
		require.ErrorIs(t, err, repository.ErrNoEncontrado)
		require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("envio inexistente", func(t *testing.T) {
		_, err := svc.ConfirmarEntrega(ctx, "00000000-0000-0000-0000-000000000000", "Juan", domain.RelacionDestinatario, firmaPNGDeTest, fotoJPEGDeTest, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, repository.ErrNoEncontrado)
	})
}

func TestEstadoService_ConfirmarEntregaEvidenciaIncompleta(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	casos := []struct {
		nombre   string
		receptor string
		firma    []byte
		foto     []byte
	}{
		{"nombre vacío", "", firmaPNGDeTest, fotoJPEGDeTest},
		{"nombre solo espacios", "   ", firmaPNGDeTest, fotoJPEGDeTest},
		{"firma vacía", "Juan", nil, fotoJPEGDeTest},
		{"foto vacía", "Juan", firmaPNGDeTest, nil},
	}
	for _, tc := range casos {
		t.Run(tc.nombre, func(t *testing.T) {
			envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
			_, err := svc.ConfirmarEntrega(ctx, envioID, tc.receptor, domain.RelacionDestinatario, tc.firma, tc.foto, repartidorID, domain.RolRepartidor)
			require.ErrorIs(t, err, ErrEvidenciaIncompleta)
			require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
		})
	}
}

func TestEstadoService_ConfirmarEntregaRelacionInvalida(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
	_, err := svc.ConfirmarEntrega(ctx, envioID, "Juan", "primo", firmaPNGDeTest, fotoJPEGDeTest, repartidorID, domain.RolRepartidor)
	require.ErrorIs(t, err, ErrRelacionInvalida)
	require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
}

func TestEstadoService_ConfirmarEntregaImagenInvalida(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	t.Run("firma con bytes JPEG", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.ConfirmarEntrega(ctx, envioID, "Juan", domain.RelacionDestinatario, firmaJPEGDeTest, fotoJPEGDeTest, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrImagenInvalida)
		require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("foto con bytes PNG", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.ConfirmarEntrega(ctx, envioID, "Juan", domain.RelacionDestinatario, firmaPNGDeTest, fotoPNGDeTest, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrImagenInvalida)
		require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("basura en ambas", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.ConfirmarEntrega(ctx, envioID, "Juan", domain.RelacionDestinatario, []byte("no-es-una-imagen"), []byte("tampoco"), repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrImagenInvalida)
		require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
	})
}

func TestEstadoService_ConfirmarEntregaImagenMuyGrande(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	// Slices en memoria (no archivos): 1 byte sobre el límite, con magic
	// válido para que el rechazo sea por tamaño y no por formato.
	firmaGrande := make([]byte, domain.MaxImagenBytes+1)
	copy(firmaGrande, firmaPNGDeTest)
	fotoGrande := make([]byte, domain.MaxImagenBytes+1)
	copy(fotoGrande, fotoJPEGDeTest)
	// En el límite exacto pasa el tamaño (fallaría solo si el magic no da;
	// acá el magic es válido, así que la única barrera es el tamaño).
	firmaLimite := make([]byte, domain.MaxImagenBytes)
	copy(firmaLimite, firmaPNGDeTest)

	t.Run("firma excedida", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.ConfirmarEntrega(ctx, envioID, "Juan", domain.RelacionDestinatario, firmaGrande, fotoJPEGDeTest, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrImagenMuyGrande)
		require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("foto excedida", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.ConfirmarEntrega(ctx, envioID, "Juan", domain.RelacionDestinatario, firmaPNGDeTest, fotoGrande, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrImagenMuyGrande)
		require.Equal(t, domain.EstadoEnvioAsignado, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("firma en el límite con magic válido no da tamaño", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.ConfirmarEntrega(ctx, envioID, "Juan", domain.RelacionDestinatario, firmaLimite, fotoJPEGDeTest, repartidorID, domain.RolRepartidor)
		require.NoError(t, err)
		require.Equal(t, domain.EstadoEnvioEntregado, estadoActualDeTest(t, pool, envioID))
	})
}

func TestEstadoService_ConfirmarEntregaTransicionInvalida(t *testing.T) {
	svc, pool, repartidorID, _ := nuevoEstadoServiceDeTest(t)
	ctx := context.Background()

	t.Run("pendiente", func(t *testing.T) {
		envioID := crearEnvioPendienteDeEstado(t, pool)
		_, err := svc.ConfirmarEntrega(ctx, envioID, "Juan", domain.RelacionDestinatario, firmaPNGDeTest, fotoJPEGDeTest, repartidorID, domain.RolOperador)
		require.ErrorIs(t, err, ErrTransicionInvalida)
		require.Equal(t, domain.EstadoEnvioPendiente, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("ya entregado (reconfirmar)", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.ConfirmarEntrega(ctx, envioID, "Juan", domain.RelacionDestinatario, firmaPNGDeTest, fotoJPEGDeTest, repartidorID, domain.RolRepartidor)
		require.NoError(t, err)
		_, err = svc.ConfirmarEntrega(ctx, envioID, "Juan", domain.RelacionEncargado, firmaPNGDeTest, fotoJPEGDeTest, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrTransicionInvalida)
		require.Equal(t, domain.EstadoEnvioEntregado, estadoActualDeTest(t, pool, envioID))
	})

	t.Run("no_entregado", func(t *testing.T) {
		envioID := crearEnvioAsignadoDeTest(t, pool, repartidorID)
		_, err := svc.RegistrarIncidencia(ctx, envioID, domain.MotivoClienteAusente, "", nil, repartidorID, domain.RolRepartidor)
		require.NoError(t, err)
		_, err = svc.ConfirmarEntrega(ctx, envioID, "Juan", domain.RelacionDestinatario, firmaPNGDeTest, fotoJPEGDeTest, repartidorID, domain.RolRepartidor)
		require.ErrorIs(t, err, ErrTransicionInvalida)
		require.Equal(t, domain.EstadoEnvioNoEntregado, estadoActualDeTest(t, pool, envioID))
	})
}
