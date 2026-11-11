// Limpieza de todo lo generado por el demo (y nada más).
package demo

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ResumenLimpieza cuenta lo borrado por -limpiar.
type ResumenLimpieza struct {
	Envios         int
	Notificaciones int
	Confirmaciones int
	Eventos        int
	Destinatarios  int
	Remitentes     int
	Rutas          int
	Vehiculos      int
}

// LimpiarDemo borra en una transacción todo lo generado (destinatarios demo,
// sus envíos, avisos, rutas que queden vacías y vehículos propios). Con
// fechas, solo los envíos demo con fecha de entrega en esos días (y sus
// rutas); los vehículos y el historial quedan.
func LimpiarDemo(ctx context.Context, pool *pgxpool.Pool, fechas []string) (ResumenLimpieza, error) {
	var r ResumenLimpieza
	tx, err := pool.Begin(ctx)
	if err != nil {
		return r, err
	}
	defer tx.Rollback(ctx)

	// Envíos demo: por destinatario demo.
	var envioIDs []string
	rows, err := tx.Query(ctx, `
		SELECT e.id::text FROM envios e
		JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE d.demo = true AND ($1::date[] IS NULL OR e.fecha_entrega = ANY($1::date[]))
	`, fechas)
	if err != nil {
		return r, err
	}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return r, err
		}
		envioIDs = append(envioIDs, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return r, err
	}
	// Rutas que tenían envíos demo (antes de borrarlos).
	var rutaIDs []string
	if len(envioIDs) > 0 {
		rr, err := tx.Query(ctx, `
			SELECT DISTINCT e.ruta_id::text FROM envios e
			JOIN destinatarios d ON d.id = e.destinatario_id
			WHERE d.demo = true AND e.ruta_id IS NOT NULL AND e.id::text = ANY($1)
		`, envioIDs)
		if err != nil {
			return r, err
		}
		for rr.Next() {
			var id string
			if err := rr.Scan(&id); err != nil {
				rr.Close()
				return r, err
			}
			rutaIDs = append(rutaIDs, id)
		}
		rr.Close()
		if err := rr.Err(); err != nil {
			return r, err
		}
	}

	if len(envioIDs) == 0 {
		log.Printf("  limpiar: no hay envíos demo para borrar")
	} else {
		// Avisos ligados a esos envíos o rutas.
		tag, err := tx.Exec(ctx, `
			DELETE FROM notificaciones_whatsapp
			WHERE envio_id = ANY($1) OR ruta_id = ANY($2)
		`, envioIDs, rutaIDs)
		if err != nil {
			return r, fmt.Errorf("avisos: %w", err)
		}
		r.Notificaciones = int(tag.RowsAffected())

		tag, err = tx.Exec(ctx, `DELETE FROM confirmaciones_entrega WHERE envio_id = ANY($1)`, envioIDs)
		if err != nil {
			return r, fmt.Errorf("confirmaciones: %w", err)
		}
		r.Confirmaciones = int(tag.RowsAffected())

		tag, err = tx.Exec(ctx, `DELETE FROM eventos_envio WHERE envio_id = ANY($1)`, envioIDs)
		if err != nil {
			return r, fmt.Errorf("eventos: %w", err)
		}
		r.Eventos = int(tag.RowsAffected())

		// Remitentes usados solo por envíos demo (para no borrar de más).
		var remIDs []string
		rr, err := tx.Query(ctx, `SELECT DISTINCT remitente_id::text FROM envios WHERE id = ANY($1)`, envioIDs)
		if err != nil {
			return r, err
		}
		for rr.Next() {
			var id string
			if err := rr.Scan(&id); err != nil {
				rr.Close()
				return r, err
			}
			remIDs = append(remIDs, id)
		}
		rr.Close()

		tag, err = tx.Exec(ctx, `DELETE FROM envios WHERE id = ANY($1)`, envioIDs)
		if err != nil {
			return r, fmt.Errorf("envíos: %w", err)
		}
		r.Envios = int(tag.RowsAffected())

		// Destinatarios demo huérfanos.
		tag, err = tx.Exec(ctx, `
			DELETE FROM destinatarios d
			WHERE d.demo = true AND NOT EXISTS (SELECT 1 FROM envios e WHERE e.destinatario_id = d.id)
		`)
		if err != nil {
			return r, fmt.Errorf("destinatarios: %w", err)
		}
		r.Destinatarios = int(tag.RowsAffected())

		// Remitentes huérfanos (solo los que eran de envíos demo).
		if len(remIDs) > 0 {
			tag, err = tx.Exec(ctx, `
				DELETE FROM remitentes m
				WHERE m.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM envios e WHERE e.remitente_id = m.id)
			`, remIDs)
			if err != nil {
				return r, fmt.Errorf("remitentes: %w", err)
			}
			r.Remitentes = int(tag.RowsAffected())
		}
	}

	// Rutas que quedaron sin envíos (verifica que no tengan no-demo).
	for _, rid := range rutaIDs {
		var quedan int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM envios WHERE ruta_id = $1`, rid).Scan(&quedan); err != nil {
			return r, err
		}
		if quedan > 0 {
			log.Printf("  limpiar: ruta %s tiene %d envíos no-demo, la conservo", rid, quedan)
			continue
		}
		// Avisos de la ruta (por si quedaron sin envío ligado).
		if _, err := tx.Exec(ctx, `DELETE FROM notificaciones_whatsapp WHERE ruta_id = $1`, rid); err != nil {
			return r, err
		}
		tag, err := tx.Exec(ctx, `DELETE FROM rutas WHERE id = $1`, rid)
		if err != nil {
			return r, fmt.Errorf("ruta %s: %w", rid, err)
		}
		r.Rutas += int(tag.RowsAffected())
	}

	// Vehículos propios del demo (nunca los de la migración); solo en la limpieza total.
	if fechas == nil {
		pats := PatentesDemo()
		tag, err := tx.Exec(ctx, `
			DELETE FROM vehiculos WHERE patente = ANY($1)
			AND patente NOT IN ('TRK-318', 'FUR-102', 'CAM-205')
		`, pats)
		if err != nil {
			return r, fmt.Errorf("vehículos: %w", err)
		}
		r.Vehiculos = int(tag.RowsAffected())
	}

	if err := tx.Commit(ctx); err != nil {
		return r, err
	}
	log.Printf(
		"  limpiar: envíos=%d avisos=%d confirmaciones=%d eventos=%d destinatarios=%d remitentes=%d rutas=%d vehículos=%d",
		r.Envios, r.Notificaciones, r.Confirmaciones, r.Eventos, r.Destinatarios, r.Remitentes, r.Rutas, r.Vehiculos,
	)
	return r, nil
}
