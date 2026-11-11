package demo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// ErrSinRepartidores: el estado inicial necesita al menos un repartidor activo (no crea usuarios).
var ErrSinRepartidores = errors.New("no hay repartidores activos")

// Servicios es lo que usa el reinicio. Envios no debe geocodificar: las
// coordenadas salen del catálogo. Estados es el de la API (con avisos), así
// los avisos de las entregas de la mañana quedan registrados como "simulado".
type Servicios struct {
	Pool       *pgxpool.Pool
	Envios     *services.EnvioService
	Asignacion *services.AsignacionService
	Estados    *services.EstadoService
	Rutas      *services.RutaService
	Flota      *repository.FlotaRepo
	Geo        *repository.GeoRepo
}

// ResumenReinicio cuenta lo que dejó armado el reinicio.
type ResumenReinicio struct {
	Fecha          string `json:"fecha"`
	RutasHoy       int    `json:"rutas_hoy"`
	EnviosHoy      int    `json:"envios_hoy"`
	EnviosBorrados int    `json:"envios_borrados"`
	DiasHistorial  int    `json:"dias_historial_nuevos"`
	DuracionMs     int64  `json:"duracion_ms"`
}

// estadoInicialMigracion: los 3 vehículos de la migración 0007 vuelven a este estado.
var estadoInicialMigracion = map[string]string{"TRK-318": "activo", "FUR-102": "en_base", "CAM-205": "mantenimiento"}

// Reiniciar deja el estado inicial de un día normal de trabajo, listo para
// simular: historial de los últimos 30 días (solo agrega los días que
// falten), la operación de hoy recién empezada (rutas con vehículo, las
// primeras entregas de la mañana hechas y el resto por repartir),
// pendientes sin ruta y las rutas de mañana. Sobrescribe solo lo que generó
// el demo: borra los envíos de demostración de hoy en adelante (y las rutas
// que queden vacías) y devuelve la flota demo a su estado inicial. Usuarios,
// vehículos agregados a mano y envíos o rutas reales no se tocan.
func Reiniciar(ctx context.Context, s Servicios, hoy string) (ResumenReinicio, error) {
	inicio := time.Now()
	r := ResumenReinicio{Fecha: hoy}

	reps, _, err := CargarRepartidores(ctx, s.Pool)
	if err != nil {
		return r, err
	}
	if len(reps) == 0 {
		return r, ErrSinRepartidores
	}
	if _, err := AsegurarFlota(ctx, s.Pool); err != nil {
		return r, fmt.Errorf("flota: %w", err)
	}

	// Lo de hoy en adelante se rehace siempre; el historial solo se completa.
	dias := make([]string, 0, 15)
	for i := 0; i < 15; i++ {
		dias = append(dias, SumarDias(hoy, i))
	}
	borrado, err := LimpiarDemo(ctx, s.Pool, dias)
	if err != nil {
		return r, fmt.Errorf("limpiar: %w", err)
	}
	r.EnviosBorrados = borrado.Envios

	if err := liberarCamionesDeEjemplo(ctx, s.Pool, hoy); err != nil {
		return r, fmt.Errorf("flota: %w", err)
	}
	if err := reponerFlota(ctx, s.Pool); err != nil {
		return r, fmt.Errorf("flota: %w", err)
	}
	antes, err := diasConHistorial(ctx, s.Pool, hoy)
	if err != nil {
		return r, err
	}
	if _, _, err := GenerarHistorial(ctx, s.Pool, hoy, 30); err != nil {
		return r, fmt.Errorf("historial: %w", err)
	}
	despues, err := diasConHistorial(ctx, s.Pool, hoy)
	if err != nil {
		return r, err
	}
	r.DiasHistorial = despues - antes

	n, err := GenerarOperacionHoy(ctx, s.Pool, s.Envios, s.Asignacion, s.Estados, s.Rutas, s.Flota, s.Geo, hoy, reps)
	if err != nil {
		return r, fmt.Errorf("operación de hoy: %w", err)
	}
	r.EnviosHoy, r.RutasHoy = n, len(reps)
	manana := ProximoHabil(SumarDias(hoy, 1))
	if _, err := GenerarPendientes(ctx, s.Pool, s.Envios, s.Geo, hoy, manana); err != nil {
		return r, fmt.Errorf("pendientes: %w", err)
	}
	if _, err := GenerarManana(ctx, s.Pool, s.Envios, s.Asignacion, s.Rutas, s.Geo, manana, reps); err != nil {
		return r, fmt.Errorf("mañana: %w", err)
	}
	r.DuracionMs = time.Since(inicio).Milliseconds()
	return r, nil
}

// reponerFlota devuelve los vehículos del demo y los de la migración al
// depósito, detenidos y con su estado inicial. Los vehículos agregados a
// mano no se tocan.
func reponerFlota(ctx context.Context, pool *pgxpool.Pool) error {
	dep := geo.CentroSanFrancisco
	for _, v := range vehiculosDemo {
		if _, err := pool.Exec(ctx, `
			UPDATE vehiculos SET estado = $2, latitud = $3, longitud = $4, velocidad = 0, rumbo = 0,
			       temperatura = $5, posicion_at = now()
			WHERE patente = $1
		`, v.Patente, v.Estado, dep.Lat, dep.Lng, v.Temperatura); err != nil {
			return err
		}
	}
	for patente, estado := range estadoInicialMigracion {
		if _, err := pool.Exec(ctx, `
			UPDATE vehiculos SET estado = $2, latitud = $3, longitud = $4, velocidad = 0, rumbo = 0, posicion_at = now()
			WHERE patente = $1
		`, patente, estado, dep.Lat, dep.Lng); err != nil {
			return err
		}
	}
	return nil
}

func diasConHistorial(ctx context.Context, pool *pgxpool.Pool, hoy string) (int, error) {
	var n int
	err := pool.QueryRow(ctx, `
		SELECT count(DISTINCT r.fecha) FROM rutas r
		JOIN envios e ON e.ruta_id = r.id
		JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE d.demo AND r.fecha < $1::date
	`, hoy).Scan(&n)
	return n, err
}

// destinatariosDeEjemplo son los del seed de la migración 0002 (Juan Pérez y
// María Gómez). Los tests del repo los usan, así que no se borran ni se marcan.
var destinatariosDeEjemplo = []string{"55555555-5555-5555-5555-555555555555", "66666666-6666-6666-6666-666666666666"}

// liberarCamionesDeEjemplo quita el camión de las rutas de hoy que solo tienen
// envíos del seed de ejemplo (en una base recién creada, "Ruta Centro 01" queda
// con fecha de hoy y se queda con el TRK-318). La ruta y sus envíos no se tocan;
// el camión queda libre para la operación de demostración.
func liberarCamionesDeEjemplo(ctx context.Context, pool *pgxpool.Pool, hoy string) error {
	_, err := pool.Exec(ctx, `
		UPDATE rutas r SET vehiculo_id = NULL
		WHERE r.fecha = $1::date AND r.vehiculo_id IS NOT NULL
		  AND EXISTS (SELECT 1 FROM envios e WHERE e.ruta_id = r.id)
		  AND NOT EXISTS (
		      SELECT 1 FROM envios e
		      WHERE e.ruta_id = r.id AND e.destinatario_id::text <> ALL($2::text[]))
	`, hoy, destinatariosDeEjemplo)
	return err
}
