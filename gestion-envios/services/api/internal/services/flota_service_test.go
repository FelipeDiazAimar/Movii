package services

import (
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

// H20: un vehículo "en_base" asignado a una ruta pasa a "activo" para que el
// simulador lo mueva; uno en mantenimiento no puede salir.
func TestEstadoAlAsignarARuta(t *testing.T) {
	nuevo, err := estadoAlAsignarARuta(domain.EstadoVehiculoEnBase)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoVehiculoActivo, nuevo)

	nuevo, err = estadoAlAsignarARuta(domain.EstadoVehiculoActivo)
	require.NoError(t, err)
	require.Equal(t, domain.EstadoVehiculoActivo, nuevo)

	_, err = estadoAlAsignarARuta(domain.EstadoVehiculoMantenimiento)
	require.ErrorIs(t, err, ErrVehiculoNoDisponible)
}
