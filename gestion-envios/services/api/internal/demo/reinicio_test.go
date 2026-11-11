package demo

import (
	"context"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"movii/api/internal/platform/db"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// Solo contra una base local descartable: escribe datos de demostración.
func baseLocal(t *testing.T) string {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	u, err := url.Parse(dsn)
	if dsn == "" || err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") {
		t.Skip("necesita DATABASE_URL de una base local descartable")
	}
	return dsn
}

func TestReiniciar_EstadoInicialRepetibleSinTocarDatosAjenos(t *testing.T) {
	ctx := context.Background()
	pool, err := db.New(ctx, baseLocal(t))
	require.NoError(t, err)
	// Se cierra al final de todo: las limpiezas de t.Cleanup corren después de la función y la necesitan.
	t.Cleanup(pool.Close)

	envioRepo := repository.NewEnvioRepo(pool)
	eventoRepo := repository.NewEventoRepo(pool)
	confRepo := repository.NewConfirmacionRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)
	svc := Servicios{
		Pool:       pool,
		Envios:     services.NewEnvioService(pool, envioRepo, eventoRepo, confRepo),
		Asignacion: services.NewAsignacionService(rutaRepo, envioRepo).ConOrden(services.NewOrdenadorRutas(pool, nil)),
		Estados:    services.NewEstadoService(pool, envioRepo, eventoRepo, confRepo),
		Rutas:      services.NewRutaService(rutaRepo),
		Flota:      repository.NewFlotaRepo(pool),
		Geo:        repository.NewGeoRepo(pool),
	}
	hoy := services.FechaAR(time.Now())

	// Datos "ajenos" al demo: un vehículo agregado a mano y un envío real. La
	// limpieza se registra antes de crearlos: si algo falla a mitad, no quedan.
	const patentePropia = "TEST-PROPIO"
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM vehiculos WHERE patente = $1`, patentePropia) })
	_, err = pool.Exec(ctx, `INSERT INTO vehiculos (patente, modelo, tipo, estado) VALUES ($1, 'Propio', 'furgon', 'activo') ON CONFLICT (patente) DO NOTHING`, patentePropia)
	require.NoError(t, err)
	real, err := svc.Envios.Create(ctx, services.CrearEnvioInput{
		DestinatarioNombre: "Cliente Real", Calle: "Belgrano", Numero: "1950", Localidad: "San Francisco", Peso: 2, Tamano: "chico", FechaEntrega: hoy,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM eventos_envio WHERE envio_id = $1`, real.ID)
		_, _ = pool.Exec(ctx, `
			WITH borrado AS (DELETE FROM envios WHERE id = $1 RETURNING destinatario_id, remitente_id),
			     d AS (DELETE FROM destinatarios WHERE id IN (SELECT destinatario_id FROM borrado))
			DELETE FROM remitentes WHERE id IN (SELECT remitente_id FROM borrado)`, real.ID)
	})
	var usuarios int
	require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FROM usuarios`).Scan(&usuarios))

	contar := func() (rutas, envios, entregados int) {
		require.NoError(t, pool.QueryRow(ctx, `
			SELECT count(DISTINCT r.id), count(e.id), count(e.id) FILTER (WHERE e.estado = 'entregado')
			FROM rutas r JOIN envios e ON e.ruta_id = r.id JOIN destinatarios d ON d.id = e.destinatario_id
			WHERE r.fecha = $1::date AND d.demo`, hoy).Scan(&rutas, &envios, &entregados))
		return
	}

	r1, err := Reiniciar(ctx, svc, hoy)
	require.NoError(t, err)
	require.Greater(t, r1.RutasHoy, 0)
	rutas1, envios1, entregados1 := contar()
	require.Greater(t, envios1, 0)
	require.Greater(t, entregados1, 0, "las primeras entregas de la mañana ya están hechas")

	// Simula que avanzó el día: se entregan más envíos demo.
	_, err = pool.Exec(ctx, `UPDATE envios e SET estado = 'entregado' FROM destinatarios d
		WHERE d.id = e.destinatario_id AND d.demo AND e.fecha_entrega = $1::date AND e.estado = 'asignado'`, hoy)
	require.NoError(t, err)

	// Segundo ▶: vuelve exactamente al mismo estado inicial.
	_, err = Reiniciar(ctx, svc, hoy)
	require.NoError(t, err)
	rutas2, envios2, entregados2 := contar()
	require.Equal(t, rutas1, rutas2)
	require.Equal(t, envios1, envios2)
	require.Equal(t, entregados1, entregados2)

	// Cada ruta de hoy tiene su orden de visita completo (1..n, sin huecos).
	filas, err := pool.Query(ctx, `
		SELECT e.ruta_id::text, e.orden_ruta
		FROM envios e JOIN rutas r ON r.id = e.ruta_id JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE r.fecha = $1::date AND d.demo
		ORDER BY e.ruta_id, e.orden_ruta`, hoy)
	require.NoError(t, err)
	porRuta := map[string][]int{}
	for filas.Next() {
		var ruta string
		var orden *int
		require.NoError(t, filas.Scan(&ruta, &orden))
		require.NotNil(t, orden, "todo envío de una ruta tiene orden")
		porRuta[ruta] = append(porRuta[ruta], *orden)
	}
	filas.Close()
	require.NotEmpty(t, porRuta)
	for ruta, ordenes := range porRuta {
		for i, o := range ordenes {
			require.Equal(t, i+1, o, "orden sin huecos en la ruta %s", ruta)
		}
	}

	// La ruta de ejemplo de la migración 0002 (si es de hoy) suelta su camión para la demo, sin perder su envío.
	var conCamion bool
	var enviosEjemplo int
	errEj := pool.QueryRow(ctx, `SELECT vehiculo_id IS NOT NULL, (SELECT count(*) FROM envios WHERE ruta_id = r.id) FROM rutas r
		WHERE id = '77777777-7777-7777-7777-777777777777' AND fecha = $1::date`, hoy).Scan(&conCamion, &enviosEjemplo)
	if errEj == nil {
		require.False(t, conCamion)
		require.Equal(t, 1, enviosEjemplo)
	}

	// Hoy salen todas menos la del camión naranja, que espera en el depósito
	// para iniciarla desde la app con la cuenta demo.
	filasHoy, err := pool.Query(ctx, `SELECT r.estado::text, COALESCE(v.patente, ''), u.email FROM rutas r
		JOIN usuarios u ON u.id = r.repartidor_id LEFT JOIN vehiculos v ON v.id = r.vehiculo_id
		WHERE r.fecha = $1::date
		  AND EXISTS (SELECT 1 FROM envios e JOIN destinatarios d ON d.id = e.destinatario_id WHERE e.ruta_id = r.id AND d.demo)`, hoy)
	require.NoError(t, err)
	planificadas := 0
	for filasHoy.Next() {
		var estado, patente, email string
		require.NoError(t, filasHoy.Scan(&estado, &patente, &email))
		if patente == camionParaIniciarEnVivo {
			require.Equal(t, "planificada", estado, "el naranja espera en el depósito")
			require.Equal(t, cuentaDemoApp, email, "y su ruta es de la cuenta con la que se entra a la app")
		} else {
			require.Equal(t, "en_curso", estado, "el resto sale repartiendo (%s)", patente)
		}
		if estado == "planificada" {
			planificadas++
		}
	}
	filasHoy.Close()
	require.LessOrEqual(t, planificadas, 1)

	// Las de mañana siguen en el depósito. Iniciar una saca todo "en camino".
	var rutaID, repartidorID string
	err = pool.QueryRow(ctx, `SELECT id::text, repartidor_id::text FROM rutas r
		WHERE r.fecha > $1::date AND r.estado = 'planificada'
		  AND EXISTS (SELECT 1 FROM envios e JOIN destinatarios d ON d.id = e.destinatario_id WHERE e.ruta_id = r.id AND d.demo)
		LIMIT 1`, hoy).Scan(&rutaID, &repartidorID)
	require.NoError(t, err, "el estado inicial deja las rutas de mañana por iniciar")
	n, err := svc.Estados.IniciarRuta(ctx, rutaID, repartidorID, "repartidor")
	require.NoError(t, err)
	require.Greater(t, n, 0)
	var estadoRuta string
	var asignados int
	require.NoError(t, pool.QueryRow(ctx, `SELECT estado::text, (SELECT count(*) FROM envios WHERE ruta_id = r.id AND estado = 'asignado') FROM rutas r WHERE id = $1`, rutaID).Scan(&estadoRuta, &asignados))
	require.Equal(t, "en_curso", estadoRuta)
	require.Zero(t, asignados)
	_, err = svc.Estados.IniciarRuta(ctx, rutaID, "otro-repartidor", "repartidor")
	require.Error(t, err, "un repartidor no puede iniciar una ruta ajena")
	// Ya salió del depósito: no admite envíos nuevos (quedarían "asignados" sin camión).
	_, err = svc.Asignacion.Asignar(ctx, rutaID, []string{real.ID})
	require.ErrorIs(t, err, repository.ErrRutaNoEditable)

	// Lo ajeno sigue igual.
	var estado, estadoVehiculo string
	require.NoError(t, pool.QueryRow(ctx, `SELECT estado::text FROM envios WHERE id = $1`, real.ID).Scan(&estado))
	require.Equal(t, "pendiente", estado)
	require.NoError(t, pool.QueryRow(ctx, `SELECT estado FROM vehiculos WHERE patente = $1`, patentePropia).Scan(&estadoVehiculo))
	require.Equal(t, "activo", estadoVehiculo)
	var usuariosDespues int
	require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FROM usuarios`).Scan(&usuariosDespues))
	require.Equal(t, usuarios, usuariosDespues, "no crea ni borra usuarios")
}
