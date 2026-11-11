// Historial demo: últimos N días sin domingos, con rutas completadas.
package demo

import (
	"context"
	"fmt"
	"log"
	"math/rand/v2"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/platform/imagenes"
)

// RepartidorInfo es un repartidor existente que usará el demo.
type RepartidorInfo struct {
	ID     string
	Nombre string
	Email  string
}

// CargarRepartidores devuelve hasta 4 repartidores activos por nombre,
// más el id del primer operador/admin activo (vacío si no hay).
func CargarRepartidores(ctx context.Context, pool *pgxpool.Pool) ([]RepartidorInfo, string, error) {
	rows, err := pool.Query(ctx, `
		SELECT id::text, nombre, email FROM usuarios
		WHERE rol = 'repartidor' AND activo = true
		ORDER BY nombre LIMIT 6
	`)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()
	var reps []RepartidorInfo
	for rows.Next() {
		var r RepartidorInfo
		if err := rows.Scan(&r.ID, &r.Nombre, &r.Email); err != nil {
			return nil, "", err
		}
		reps = append(reps, r)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}
	var operador string
	_ = pool.QueryRow(ctx, `
		SELECT id::text FROM usuarios
		WHERE rol IN ('operador', 'admin') AND activo = true
		ORDER BY nombre LIMIT 1
	`).Scan(&operador)
	return reps, operador, nil
}

// DiaTieneDemo indica si la fecha ya tiene datos demo (para idempotencia).
func DiaTieneDemo(ctx context.Context, pool *pgxpool.Pool, fecha string) (bool, error) {
	var n int
	err := pool.QueryRow(ctx, `
		SELECT count(*) FROM rutas r
		JOIN envios e ON e.ruta_id = r.id
		JOIN destinatarios d ON d.id = e.destinatario_id
		WHERE r.fecha = $1::date AND d.demo = true
	`, fecha).Scan(&n)
	return n > 0, err
}

// maxCodigoEnBase busca el máximo número existente para un prefijo.
func maxCodigoEnBase(ctx context.Context, pool *pgxpool.Pool, prefijo string) (int, error) {
	var codigo string
	err := pool.QueryRow(ctx, `
		SELECT codigo_guia FROM envios
		WHERE codigo_guia LIKE $1 ORDER BY codigo_guia DESC LIMIT 1
	`, prefijo+"%").Scan(&codigo)
	if err != nil {
		return 0, nil // sin filas: empieza en 1
	}
	var n int
	if _, err := fmt.Sscanf(codigo[len(codigo)-4:], "%04d", &n); err != nil {
		return 0, nil
	}
	return n, nil
}

// pendienteReprog es un envío fallado que se entregará otro día.
type pendienteReprog struct {
	envioID        string
	repartidorIdx  int
	franja         string
	fechaAlta      string
	receptorFijo   string
	relacionFija   string
	peso           float64
	tamano         string
	contenido      string
	remitenteID    string
	destinatarioID string
	codigo         string
}

// horaUTC arma un instante UTC para guardar (12 UTC = 9 ART, 22 UTC = 19 ART).
func horaUTC(fecha string, horaUTCInt, minuto int) time.Time {
	t, _ := time.Parse("2006-01-02", fecha)
	return time.Date(t.Year(), t.Month(), t.Day(), horaUTCInt, minuto, 0, 0, time.UTC)
}

// GenerarHistorial carga el historial de los N días previos a ref (sin domingos).
// Devuelve cuántos envíos y rutas creó (sin contar los salteados por idempotencia).
func GenerarHistorial(ctx context.Context, pool *pgxpool.Pool, ref string, dias int) (int, int, error) {
	fechas := RangoHistorial(ref, dias)
	reps, operadorID, err := CargarRepartidores(ctx, pool)
	if err != nil {
		return 0, 0, err
	}
	if len(reps) == 0 {
		return 0, 0, fmt.Errorf("no hay repartidores activos: el demo no crea usuarios")
	}
	var operadorPtr *string
	if operadorID != "" {
		operadorPtr = &operadorID
	}

	// Próximo número de guía por fecha de alta.
	siguienteNum := map[string]int{}
	numPara := func(fecha string) (int, error) {
		if n, ok := siguienteNum[fecha]; ok {
			siguienteNum[fecha] = n + 1
			return n, nil
		}
		compacta := ""
		for _, c := range fecha {
			if c != '-' {
				compacta += string(c)
			}
		}
		max, err := maxCodigoEnBase(ctx, pool, "MOV-"+compacta+"-")
		if err != nil {
			return 0, err
		}
		siguienteNum[fecha] = max + 2
		return max + 1, nil
	}

	// Cola de reprogramados por fecha destino.
	cola := map[string][]pendienteReprog{}
	totalEnvios, totalRutas := 0, 0

	for _, fecha := range fechas {
		tiene, err := DiaTieneDemo(ctx, pool, fecha)
		if err != nil {
			return totalEnvios, totalRutas, err
		}
		if tiene {
			log.Printf("  historial %s: ya tiene datos demo, lo salteo", fecha)
			continue
		}
		rndDia := NuevoRandPara(fecha, 1000)
		_ = rndDia
		esSab := EsSabado(fecha)

		// Rutas del día (una por repartidor).
		type rutaDia struct {
			id            string
			repartidorIdx int
			nombre        string
			zona          string
		}
		rutas := make([]rutaDia, 0, len(reps))
		for i, r := range reps {
			_ = r
			zona := zonasDemo[i%len(zonasDemo)]
			rutas = append(rutas, rutaDia{
				id:            uuid.NewString(),
				repartidorIdx: i,
				nombre:        fmt.Sprintf("Reparto %s %s", zona, fecha[8:10]+"/"+fecha[5:7]),
				zona:          zona,
			})
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return totalEnvios, totalRutas, err
		}
		batch := &pgx.Batch{}

		// Crea las rutas primero (estado completada al final del día).
		for _, ru := range rutas {
			rep := reps[ru.repartidorIdx]
			creada := horaUTC(fecha, 10, 0)
			batch.Queue(`
				INSERT INTO rutas (id, nombre, zona, fecha, estado, repartidor_id, created_at)
				VALUES ($1, $2, $3, $4::date, 'completada', $5, $6)
			`, ru.id, ru.nombre, ru.zona, fecha, rep.ID, creada)
		}

		enviosDia := 0
		for _, ru := range rutas {
			rep := reps[ru.repartidorIdx]
			a, b := SemillaPara(fecha, 2000+uint64(ru.repartidorIdx))
			rnd := rand.New(rand.NewPCG(a, b))
			efect := EfectividadPorRepartidor(ru.repartidorIdx, len(reps))

			// Reprogramados que vencen hoy para este repartidor.
			var debidos []pendienteReprog
			for _, p := range cola[fecha] {
				if p.repartidorIdx == ru.repartidorIdx {
					debidos = append(debidos, p)
				}
			}

			objetivo := CantidadPorDia(esSab, rnd)
			nuevos := objetivo - len(debidos)
			if nuevos < 5 {
				nuevos = 5
			}

			// 1) Reprogramados: asignar a la ruta de hoy y entregar.
			for _, p := range debidos {
				asigHora := 8 + rnd.IntN(30)
				asig := horaUTC(fecha, 11, asigHora%60)
				salidaH, salidaM := HoraEntrega(rnd)
				salida := horaUTC(fecha, salidaH+3, salidaM) // ART->UTC
				entreH := salidaH
				entreM := salidaM + 20 + rnd.IntN(80)
				for entreM >= 60 {
					entreH++
					entreM -= 60
				}
				if entreH > 19 {
					entreH = 19
					entreM = rnd.IntN(60)
				}
				entre := horaUTC(fecha, entreH+3, entreM)
				if !salida.Before(entre) {
					entre = salida.Add(40 * time.Minute)
				}
				// UPDATE del envío: vuelve a ruta y se entrega.
				batch.Queue(`
					UPDATE envios SET ruta_id = $2, estado = 'entregado',
						fecha_entrega = $3::date, updated_at = $4 WHERE id = $1
				`, p.envioID, ru.id, fecha, entre)
				// Eventos: pendiente->asignado (operador), asignado->en_camino,
				// en_camino->entregado (repartidor).
				pend := "pendiente"
				asigE := "asignado"
				cam := "en_camino"
				entr := "entregado"
				batch.Queue(`
					INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
					VALUES ($1, $2::estado_envio, $3::estado_envio, $4, $5)
				`, p.envioID, pend, asigE, operadorPtr, asig)
				batch.Queue(`
					INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
					VALUES ($1, $2::estado_envio, $3::estado_envio, $4, $5)
				`, p.envioID, asigE, cam, rep.ID, salida)
				batch.Queue(`
					INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
					VALUES ($1, $2::estado_envio, $3::estado_envio, $4, $5)
				`, p.envioID, cam, entr, rep.ID, entre)
				receptor := p.receptorFijo
				batch.Queue(`
					INSERT INTO confirmaciones_entrega (envio_id, receptor_nombre, receptor_relacion, firma, foto, confirmada_por, confirmada_at)
					VALUES ($1, $2, $3::relacion_receptor, $4, $5, $6, $7)
				`, p.envioID, receptor, p.relacionFija, imagenes.Firma(rnd), imagenes.Foto(rnd), rep.ID, entre)
				enviosDia++
			}
			// Limpia los debidos de la cola.
			filtrada := cola[fecha][:0]
			for _, p := range cola[fecha] {
				if p.repartidorIdx != ru.repartidorIdx {
					filtrada = append(filtrada, p)
				}
			}
			cola[fecha] = filtrada

			// 2) Nuevos de hoy.
			for k := 0; k < nuevos; k++ {
				n, err := numPara(fecha)
				if err != nil {
					_ = tx.Rollback(ctx)
					return totalEnvios, totalRutas, err
				}
				codigo := CodigoGuia(fecha, n)
				envioID := uuid.NewString()
				remID := uuid.NewString()
				desID := uuid.NewString()
				remNom, remTel, remDir := RemitenteDemo(rnd)
				desNom := NombreCompleto(rnd)
				desTel := GenerarTelefono(rnd)
				desMail := GenerarEmail(desNom, rnd)
				calle, numero := CalleNumero(rnd)
				lat, lng := GenerarCoordenadaDemo(rnd)
				cont, peso, tam, fragil, urgente := ContenidoPaquete(rnd)
				altaMin := 30 + rnd.IntN(60)
				alta := horaUTC(fecha, 10, altaMin%60)
				asigMin := altaMin + 15 + rnd.IntN(30)
				asig := horaUTC(fecha, 11, asigMin%60)

				batch.Queue(`
					INSERT INTO remitentes (id, nombre, telefono, direccion)
					VALUES ($1, $2, $3, $4)
				`, remID, remNom, remTel, remDir)
				batch.Queue(`
					INSERT INTO destinatarios (id, nombre, telefono, calle, numero, localidad, codigo_postal, email, latitud, longitud, geo_fuente, demo, created_at)
					VALUES ($1, $2, $3, $4, $5, 'San Francisco', 'X2400', NULLIF($6, ''), $7, $8, 'demo', true, $9)
				`, desID, desNom, desTel, calle, numero, desMail, lat, lng, alta)

				entregado := DecideEntregado(rnd, efect)
				if entregado {
					salidaH, salidaM := HoraEntrega(rnd)
					salida := horaUTC(fecha, salidaH+3, salidaM)
					if !asig.Before(salida) {
						salida = asig.Add(30 * time.Minute)
					}
					entre := salida.Add(time.Duration(30+rnd.IntN(240)) * time.Minute)
					limite := horaUTC(fecha, 22, 0)
					if entre.After(limite) {
						entre = limite.Add(-time.Duration(rnd.IntN(60)) * time.Minute)
					}
					batch.Queue(`
						INSERT INTO envios (id, codigo_guia, estado, peso, tamano, tipo_contenido, fragil, urgente,
							remitente_id, destinatario_id, ruta_id, fecha_entrega, created_at, updated_at)
						VALUES ($1, $2, 'entregado', $3, $4::tamano_paquete, $5, $6, $7, $8, $9, $10, $11::date, $12, $13)
					`, envioID, codigo, peso, tam, cont, fragil, urgente, remID, desID, ru.id, fecha, alta, entre)
					pend := "pendiente"
					asigE := "asignado"
					cam := "en_camino"
					entr := "entregado"
					batch.Queue(`
						INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
						VALUES ($1, NULL, $2::estado_envio, $3, $4)
					`, envioID, pend, operadorPtr, alta)
					batch.Queue(`
						INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
						VALUES ($1, $2::estado_envio, $3::estado_envio, $4, $5)
					`, envioID, pend, asigE, operadorPtr, asig)
					batch.Queue(`
						INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
						VALUES ($1, $2::estado_envio, $3::estado_envio, $4, $5)
					`, envioID, asigE, cam, rep.ID, salida)
					batch.Queue(`
						INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
						VALUES ($1, $2::estado_envio, $3::estado_envio, $4, $5)
					`, envioID, cam, entr, rep.ID, entre)
					rel := RelacionReceptor(rnd)
					receptor := desNom
					if rel != "destinatario" {
						receptor = NombreCompleto(rnd)
					}
					batch.Queue(`
						INSERT INTO confirmaciones_entrega (envio_id, receptor_nombre, receptor_relacion, firma, foto, confirmada_por, confirmada_at)
						VALUES ($1, $2, $3::relacion_receptor, $4, $5, $6, $7)
					`, envioID, receptor, rel, imagenes.Firma(rnd), imagenes.Foto(rnd), rep.ID, entre)
				} else {
					motivo := ElegirMotivo(rnd)
					coment := ComentarioParaMotivo(motivo, rnd)
					salidaH, salidaM := HoraEntrega(rnd)
					salida := horaUTC(fecha, salidaH+3, salidaM)
					if !asig.Before(salida) {
						salida = asig.Add(30 * time.Minute)
					}
					fallo := salida.Add(time.Duration(20+rnd.IntN(90)) * time.Minute)
					limite := horaUTC(fecha, 22, 0)
					if fallo.After(limite) {
						fallo = limite.Add(-time.Duration(rnd.IntN(30)) * time.Minute)
					}
					reprog := rnd.Float64() < 0.40
					if reprog {
						// Destino: +1 o +2 hábiles (nunca domingo).
						delta := 1 + rnd.IntN(2)
						dest := fecha
						for i := 0; i < delta; i++ {
							dest = SumarDias(dest, 1)
							dest = ProximoHabil(dest)
						}
						franja := FranjaReprogramacion(rnd)
						reprogAt := horaUTC(fecha, 23, 10+rnd.IntN(40))
						comentReprog := "Reprogramado para el " + dest[8:10] + "/" + dest[5:7] + "/" + dest[0:4] + " (" + etiquetaFranja(franja) + ")"
						batch.Queue(`
							INSERT INTO envios (id, codigo_guia, estado, peso, tamano, tipo_contenido, fragil, urgente,
								remitente_id, destinatario_id, ruta_id, fecha_entrega, reprogramado_para, franja, created_at, updated_at)
							VALUES ($1, $2, 'pendiente', $3, $4::tamano_paquete, $5, $6, $7, $8, $9, NULL, $10::date, $10::date, $11::franja_horaria, $12, $13)
						`, envioID, codigo, peso, tam, cont, fragil, urgente, remID, desID, dest, franja, alta, reprogAt)
						pend := "pendiente"
						asigE := "asignado"
						cam := "en_camino"
						noentr := "no_entregado"
						batch.Queue(`
							INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
							VALUES ($1, NULL, $2::estado_envio, $3, $4)
						`, envioID, pend, operadorPtr, alta)
						batch.Queue(`
							INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
							VALUES ($1, $2::estado_envio, $3::estado_envio, $4, $5)
						`, envioID, pend, asigE, operadorPtr, asig)
						batch.Queue(`
							INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
							VALUES ($1, $2::estado_envio, $3::estado_envio, $4, $5)
						`, envioID, asigE, cam, rep.ID, salida)
						batch.Queue(`
							INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, motivo, comentario, actor_id, created_at)
							VALUES ($1, $2::estado_envio, $3::estado_envio, $4::motivo_fallo, $5, $6, $7)
						`, envioID, cam, noentr, motivo, coment, rep.ID, fallo)
						batch.Queue(`
							INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, comentario, actor_id, created_at)
							VALUES ($1, $2::estado_envio, $3::estado_envio, $4, $5, $6)
						`, envioID, noentr, pend, comentReprog, rep.ID, reprogAt)
						rel := RelacionReceptor(rnd)
						rec := desNom
						if rel != "destinatario" {
							rec = NombreCompleto(rnd)
						}
						cola[dest] = append(cola[dest], pendienteReprog{
							envioID: envioID, repartidorIdx: ru.repartidorIdx,
							franja: franja, fechaAlta: fecha,
							receptorFijo: rec, relacionFija: rel,
							peso: peso, tamano: tam, contenido: cont,
							remitenteID: remID, destinatarioID: desID, codigo: codigo,
						})
					} else {
						batch.Queue(`
							INSERT INTO envios (id, codigo_guia, estado, peso, tamano, tipo_contenido, fragil, urgente,
								remitente_id, destinatario_id, ruta_id, fecha_entrega, created_at, updated_at)
							VALUES ($1, $2, 'no_entregado', $3, $4::tamano_paquete, $5, $6, $7, $8, $9, $10, $11::date, $12, $13)
						`, envioID, codigo, peso, tam, cont, fragil, urgente, remID, desID, ru.id, fecha, alta, fallo)
						pend := "pendiente"
						asigE := "asignado"
						cam := "en_camino"
						noentr := "no_entregado"
						batch.Queue(`
							INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
							VALUES ($1, NULL, $2::estado_envio, $3, $4)
						`, envioID, pend, operadorPtr, alta)
						batch.Queue(`
							INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
							VALUES ($1, $2::estado_envio, $3::estado_envio, $4, $5)
						`, envioID, pend, asigE, operadorPtr, asig)
						batch.Queue(`
							INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, actor_id, created_at)
							VALUES ($1, $2::estado_envio, $3::estado_envio, $4, $5)
						`, envioID, asigE, cam, rep.ID, salida)
						batch.Queue(`
							INSERT INTO eventos_envio (envio_id, estado_anterior, estado_nuevo, motivo, comentario, actor_id, created_at)
							VALUES ($1, $2::estado_envio, $3::estado_envio, $4::motivo_fallo, $5, $6, $7)
						`, envioID, cam, noentr, motivo, coment, rep.ID, fallo)
					}
				}
				enviosDia++
			}
		}

		br := tx.SendBatch(ctx, batch)
		if err := br.Close(); err != nil {
			_ = tx.Rollback(ctx)
			return totalEnvios, totalRutas, fmt.Errorf("historial %s: %w", fecha, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return totalEnvios, totalRutas, fmt.Errorf("historial %s: %w", fecha, err)
		}
		log.Printf("  historial %s: %d envíos en %d rutas", fecha, enviosDia, len(rutas))
		totalEnvios += enviosDia
		totalRutas += len(rutas)
	}
	// Los reprogramados con destino más allá del rango (últimos días) quedan
	// pendientes para la operación de hoy/mañana: se informan y se dejan en
	// la base como pendientes (ya están insertados con reprogramado_para).
	pendientes := 0
	for f, lista := range cola {
		if len(lista) == 0 {
			continue
		}
		// Solo cuentan los que caen fuera de lo ya procesado.
		fuera := false
		for _, procesada := range fechas {
			if f == procesada {
				fuera = true
				break
			}
		}
		if !fuera {
			pendientes += len(lista)
		} else if len(lista) > 0 {
			// Quedaron sin entregar porque su destino no se procesó (cae en
			// hoy o más adelante): quedan como pendientes reprogramados.
			pendientes += 0
		}
	}
	_ = pendientes
	return totalEnvios, totalRutas, nil
}

func etiquetaFranja(f string) string {
	switch f {
	case "manana":
		return "mañana"
	case "tarde":
		return "tarde"
	default:
		return "noche"
	}
}
