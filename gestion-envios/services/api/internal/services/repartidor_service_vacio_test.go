package services

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

// Un repartidor sin envíos asignados para hoy es el caso normal al empezar el
// día, no un error. La respuesta tiene que serializar "rutas" como [] y no
// como null: el cliente móvil recorre esa lista directamente y con null
// rompía, mostrando "no se pudo cargar la ruta del día" (error de conexión)
// en lugar del estado vacío "no tenés envíos asignados para hoy" (HU-05).
func TestAgruparPorRuta_SinEnviosDevuelveSliceVacioNoNil(t *testing.T) {
	grupos := agruparPorRuta(nil)

	require.NotNil(t, grupos)
	require.Empty(t, grupos)

	serializado, err := json.Marshal(domain.ResumenDelDia{Rutas: grupos})
	require.NoError(t, err)
	require.Contains(t, string(serializado), `"rutas":[]`)
	require.NotContains(t, string(serializado), `"rutas":null`)
}

func TestRepartidorService_EnviosDelDiaSinAsignacionesDevuelveRutasVacias(t *testing.T) {
	svc, pool, _ := nuevoRepartidorServiceDeTest(t)
	ctx := context.Background()

	// Un repartidor recién creado, sin ninguna ruta ni envío del día.
	var repartidorSinRutasID string
	err := pool.QueryRow(ctx, `
		INSERT INTO usuarios (nombre, email, password_hash, rol)
		VALUES ('Repartidor Sin Rutas', 'sin-rutas@movii.test', 'x', 'repartidor')
		RETURNING id
	`).Scan(&repartidorSinRutasID)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM usuarios WHERE id = $1", repartidorSinRutasID) })

	resumen, err := svc.EnviosDelDia(ctx, repartidorSinRutasID, "")
	require.NoError(t, err)

	require.Equal(t, 0, resumen.Total)
	require.NotNil(t, resumen.Rutas, "rutas no debe ser nil: el JSON tiene que decir [] y no null")
	require.Empty(t, resumen.Rutas)
}
