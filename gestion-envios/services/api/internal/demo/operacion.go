// Operación de hoy, pendientes y mañana con los servicios reales.
package demo

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
	"movii/api/internal/platform/geo"
	"movii/api/internal/platform/imagenes"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// marcarDemo marca el destinatario como demo apenas creado, antes de cambiar estados.
func marcarDemo(ctx context.Context, pool *pgxpool.Pool, destinatarioID string) error {
	_, err := pool.Exec(ctx, `UPDATE destinatarios SET demo = true WHERE id = $1`, destinatarioID)
	return err
}

// elegirVehiculosHoy devuelve hasta n vehículos disponibles (no mantenimiento),
// priorizando los de la migración y luego los demo, en orden de patente.
// preferenciaVehiculos: en qué orden salen los camiones de la flota demo (una
// ruta por repartidor activo). Los primeros son los que mejor se ven en el mapa.
// El verde (AB512TR) sale repartiendo y el naranja (TRK-318) espera en el
// depósito: con 2 repartidores ya están los dos.
var preferenciaVehiculos = []string{"AB512TR", "TRK-318", "FUR-102", "AA874KP", "AC238UY", "KLM412"}

// camionParaIniciarEnVivo: su ruta queda sin iniciar (camión en el depósito)
// para mostrar en la presentación cómo el repartidor la inicia desde la app.
const camionParaIniciarEnVivo = "TRK-318"

// cuentaDemoApp es el repartidor con el que se entra a la app en la
// presentación: le toca la ruta que se inicia en vivo.
const cuentaDemoApp = "repartidor@movii.demo"

func elegirVehiculosHoy(ctx context.Context, pool *pgxpool.Pool, fecha string, n int) ([]struct{ ID, Patente string }, error) {
	// Solo vehículos libres ese día: uno por ruta (índice único rutas.vehiculo_id + fecha).
	rows, err := pool.Query(ctx, `
		SELECT id::text, patente FROM vehiculos
		WHERE estado != 'mantenimiento'
		  AND patente = ANY($2)
		  AND id NOT IN (SELECT vehiculo_id FROM rutas WHERE fecha = $1::date AND vehiculo_id IS NOT NULL)
		ORDER BY array_position($3::text[], patente) NULLS LAST, patente
	`, fecha, append(PatentesDemo(), "TRK-318", "FUR-102", "CAM-205"), preferenciaVehiculos)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var todos []struct{ ID, Patente string }
	for rows.Next() {
		var v struct{ ID, Patente string }
		if err := rows.Scan(&v.ID, &v.Patente); err != nil {
			return nil, err
		}
		todos = append(todos, v)
	}
	if len(todos) < n {
		n = len(todos)
	}
	return todos[:n], rows.Err()
}

// GenerarOperacionHoy arma una ruta por repartidor con 6–9 paradas reales,
// mezcla de estados, vehículo asignado y posición final del camión.
// Usa los servicios reales para que todo sea consistente y dispara avisos.
func GenerarOperacionHoy(
	ctx context.Context,
	pool *pgxpool.Pool,
	envios *services.EnvioService,
	asignacion *services.AsignacionService,
	estados *services.EstadoService,
	rutaSvc *services.RutaService,
	flota *repository.FlotaRepo,
	geoRepo *repository.GeoRepo,
	fecha string,
	reps []RepartidorInfo,
) (int, error) {
	vehiculos, err := elegirVehiculosHoy(ctx, pool, fecha, len(reps))
	if err != nil {
		return 0, err
	}
	reps = conCuentaDemoEnVivo(reps, vehiculos)
	total := 0
	for i, rep := range reps {
		rnd := NuevoRandPara(fecha+"-hoy", uint64(3000+i))
		zona := zonasDemo[i%len(zonasDemo)]
		nombre := fmt.Sprintf("Reparto %s %s/%s", zona, fecha[8:10], fecha[5:7])

		ruta, err := rutaSvc.Create(ctx, domain.Ruta{Nombre: nombre, Zona: zona, Fecha: fecha, RepartidorID: rep.ID})
		if err != nil {
			return total, fmt.Errorf("ruta %s: %w", nombre, err)
		}
		n := 8 + rnd.IntN(5) // 8..12
		ids := make([]string, 0, n)
		destDeEnvio := map[string]string{}
		for k := 0; k < n; k++ {
			desNom := NombreCompleto(rnd)
			desTel := GenerarTelefono(rnd)
			desMail := GenerarEmail(desNom, rnd)
			dir := direccionSF(rnd)
			calle, numero := dir.calle, dir.numero
			remNom, remTel, remDir := RemitenteDemo(rnd)
			cont, peso, tam, fragil, urgente := ContenidoPaquete(rnd)
			e, err := envios.Create(ctx, services.CrearEnvioInput{
				RemitenteNombre: remNom, RemitenteTelefono: remTel, RemitenteDireccion: remDir,
				DestinatarioNombre: desNom, DestinatarioTelefono: desTel, DestinatarioEmail: desMail,
				Calle: calle, Numero: numero, Localidad: "San Francisco", CodigoPostal: "X2400",
				Peso: peso, Tamano: tam, TipoContenido: cont, Fragil: fragil, Urgente: urgente,
				FechaEntrega: fecha,
			})
			if err != nil {
				return total, fmt.Errorf("envío %s: %w", desNom, err)
			}
			destID, err := geoRepo.DestinatarioDeEnvio(ctx, e.ID)
			if err == nil {
				_ = marcarDemo(ctx, pool, destID)
				ubicar(ctx, pool, destID, dir)
				destDeEnvio[e.ID] = destID
			}
			ids = append(ids, e.ID)
		}
		if _, err := asignacion.Asignar(ctx, ruta.ID, ids); err != nil {
			return total, fmt.Errorf("asignar %s: %w", nombre, err)
		}
		// Las entregas de la mañana siguen el orden del recorrido más corto.
		if enOrden, err := idsEnOrden(ctx, pool, ruta.ID); err == nil && len(enOrden) == len(ids) {
			ids = enOrden
		}

		// Vehículo: uno por ruta, en orden de la lista disponible.
		var vehID, vehPatente string
		if i < len(vehiculos) {
			vehID, vehPatente = vehiculos[i].ID, vehiculos[i].Patente
			if err := flota.AsignarARuta(ctx, ruta.ID, &vehID); err != nil {
				log.Printf("  vehículo %s para %s: %v", vehPatente, nombre, err)
				vehID = ""
			} else {
				// El simulador solo mueve activos: en_base pasa a activo.
				_, _ = pool.Exec(ctx, `
					UPDATE vehiculos SET estado = 'activo'
					WHERE id = $1 AND estado = 'en_base'
				`, vehID)
			}
		}

		// Estado de la mañana. Las rutas salen del depósito con todo a bordo (todos
		// los envíos "en camino"), ya entregaron las 2–3 primeras paradas y una de
		// cada dos tuvo una incidencia. La del camión naranja todavía no salió: se
		// inicia en vivo desde la app.
		nEntregadas := 2
		if n > 7 {
			nEntregadas = 3
		}
		entregadosIDs := []string{}
		if vehPatente != camionParaIniciarEnVivo {
			for _, id := range ids {
				if _, err := estados.CambiarEstado(ctx, id, domain.EstadoEnvioEnCamino, rep.ID, domain.RolRepartidor); err != nil {
					log.Printf("  en camino %s: %v", id, err)
				}
			}
			for k := 0; k < nEntregadas && k < len(ids); k++ {
				id := ids[k]
				// Receptor: mayoría el destinatario, a veces otro.
				rel := RelacionReceptor(rnd)
				receptor := NombreCompleto(rnd)
				// El nombre del destinatario no se guarda a mano: se usa el que ya
				// tiene el envío si la relación es destinatario.
				if rel == "destinatario" {
					var nom string
					_ = pool.QueryRow(ctx, `SELECT nombre FROM destinatarios WHERE id = (SELECT destinatario_id FROM envios WHERE id = $1)`, id).Scan(&nom)
					if nom != "" {
						receptor = nom
					}
				} else {
					receptor = NombreCompleto(rnd)
				}
				if _, err := estados.ConfirmarEntrega(ctx, id, receptor, rel, imagenes.Firma(rnd), imagenes.Foto(rnd), rep.ID, domain.RolRepartidor); err != nil {
					log.Printf("  confirmar %s: %v", id, err)
				} else {
					entregadosIDs = append(entregadosIDs, id)
				}
			}
			siguiente := nEntregadas
			if i%2 == 0 && siguiente < len(ids) {
				// Incidencia de hoy en una ruta de cada dos (aparecen en "Últimas incidencias").
				id := ids[siguiente]
				motivo := ElegirMotivo(rnd)
				coment := ComentarioParaMotivo(motivo, rnd)
				if _, err := estados.RegistrarIncidencia(ctx, id, motivo, coment, nil, rep.ID, domain.RolRepartidor); err != nil {
					log.Printf("  incidencia %s: %v", id, err)
				} else {
					log.Printf("  incidencia de hoy: %s (%s)", id, motivo)
				}
				siguiente++
			}
		}

		// Posición final del camión: última parada entregada o depósito.
		if vehID != "" {
			lat, lng := geo.CentroSanFrancisco.Lat, geo.CentroSanFrancisco.Lng
			if len(entregadosIDs) > 0 {
				ultimo := entregadosIDs[len(entregadosIDs)-1]
				if dest, ok := destDeEnvio[ultimo]; ok {
					var la, lo *float64
					_ = pool.QueryRow(ctx, `SELECT latitud::float8, longitud::float8 FROM destinatarios WHERE id = $1`, dest).Scan(&la, &lo)
					if la != nil && lo != nil {
						lat, lng = *la, *lo
					}
				}
			}
			temp := TemperaturaDemo(vehPatente)
			if temp == 18 && (vehPatente == "TRK-318" || vehPatente == "FUR-102") {
				if vehPatente == "TRK-318" {
					temp = 5
				} else {
					temp = 18
				}
			}
			if _, err := pool.Exec(ctx, `
				UPDATE vehiculos SET latitud = $2, longitud = $3, velocidad = 0, rumbo = 0,
					temperatura = $4, posicion_at = now()
				WHERE id = $1
			`, vehID, lat, lng, temp); err != nil {
				log.Printf("  posición %s: %v", vehPatente, err)
			}
		}
		log.Printf("  ruta %s: %d envíos, vehículo %s, repartidor %s", nombre, len(ids), vehPatente, rep.Nombre)
		total += len(ids)
	}
	return total, nil
}

// GenerarPendientes crea 6–10 envíos sin ruta para hoy y mañana (panel de asignación).
func GenerarPendientes(
	ctx context.Context,
	pool *pgxpool.Pool,
	envios *services.EnvioService,
	geoRepo *repository.GeoRepo,
	hoy, manana string,
) (int, error) {
	rnd := NuevoRandPara(hoy+"-pendientes", 4000)
	total := 8 // 4 para hoy, 4 para mañana
	fechas := []string{hoy, hoy, hoy, hoy, manana, manana, manana, manana}
	for i := 0; i < total; i++ {
		fechaEntrega := fechas[i]
		desNom := NombreCompleto(rnd)
		desTel := GenerarTelefono(rnd)
		desMail := GenerarEmail(desNom, rnd)
		dir := direccionSF(rnd)
		calle, numero := dir.calle, dir.numero
		remNom, remTel, remDir := RemitenteDemo(rnd)
		cont, peso, tam, fragil, urgente := ContenidoPaquete(rnd)
		e, err := envios.Create(ctx, services.CrearEnvioInput{
			RemitenteNombre: remNom, RemitenteTelefono: remTel, RemitenteDireccion: remDir,
			DestinatarioNombre: desNom, DestinatarioTelefono: desTel, DestinatarioEmail: desMail,
			Calle: calle, Numero: numero, Localidad: "San Francisco", CodigoPostal: "X2400",
			Peso: peso, Tamano: tam, TipoContenido: cont, Fragil: fragil, Urgente: urgente,
			FechaEntrega: fechaEntrega,
		})
		if err != nil {
			return i, err
		}
		if destID, err := geoRepo.DestinatarioDeEnvio(ctx, e.ID); err == nil {
			_ = marcarDemo(ctx, pool, destID)
			ubicar(ctx, pool, destID, dir)
		}
	}
	log.Printf("  pendientes: %d envíos sin ruta (%s y %s)", total, hoy, manana)
	return total, nil
}

// GenerarManana crea 2 rutas planificadas para mañana con algunos envíos asignados.
func GenerarManana(
	ctx context.Context,
	pool *pgxpool.Pool,
	envios *services.EnvioService,
	asignacion *services.AsignacionService,
	rutaSvc *services.RutaService,
	geoRepo *repository.GeoRepo,
	manana string,
	reps []RepartidorInfo,
) (int, error) {
	nRutas := 2
	if len(reps) < nRutas {
		nRutas = len(reps)
	}
	total := 0
	for i := 0; i < nRutas; i++ {
		rep := reps[i]
		rnd := NuevoRandPara(manana+"-manana", uint64(5000+i))
		zona := zonasDemo[i%len(zonasDemo)]
		nombre := fmt.Sprintf("Reparto %s %s/%s", zona, manana[8:10], manana[5:7])
		ruta, err := rutaSvc.Create(ctx, domain.Ruta{Nombre: nombre, Zona: zona, Fecha: manana, RepartidorID: rep.ID})
		if err != nil {
			return total, fmt.Errorf("ruta %s: %w", nombre, err)
		}
		n := 4 + rnd.IntN(3) // 4..6
		ids := make([]string, 0, n)
		for k := 0; k < n; k++ {
			desNom := NombreCompleto(rnd)
			desTel := GenerarTelefono(rnd)
			desMail := GenerarEmail(desNom, rnd)
			dir := direccionSF(rnd)
			calle, numero := dir.calle, dir.numero
			remNom, remTel, remDir := RemitenteDemo(rnd)
			cont, peso, tam, fragil, urgente := ContenidoPaquete(rnd)
			e, err := envios.Create(ctx, services.CrearEnvioInput{
				RemitenteNombre: remNom, RemitenteTelefono: remTel, RemitenteDireccion: remDir,
				DestinatarioNombre: desNom, DestinatarioTelefono: desTel, DestinatarioEmail: desMail,
				Calle: calle, Numero: numero, Localidad: "San Francisco", CodigoPostal: "X2400",
				Peso: peso, Tamano: tam, TipoContenido: cont, Fragil: fragil, Urgente: urgente,
				FechaEntrega: manana,
			})
			if err != nil {
				return total, err
			}
			if destID, err := geoRepo.DestinatarioDeEnvio(ctx, e.ID); err == nil {
				_ = marcarDemo(ctx, pool, destID)
				ubicar(ctx, pool, destID, dir)
			}
			ids = append(ids, e.ID)
		}
		if _, err := asignacion.Asignar(ctx, ruta.ID, ids); err != nil {
			return total, fmt.Errorf("asignar %s: %w", nombre, err)
		}
		log.Printf("  ruta %s: %d envíos asignados para %s", nombre, len(ids), manana)
		total += len(ids)
	}
	return total, nil
}

// idsEnOrden devuelve los envíos de la ruta en su orden de visita.
func idsEnOrden(ctx context.Context, pool *pgxpool.Pool, rutaID string) ([]string, error) {
	rows, err := pool.Query(ctx, `SELECT id::text FROM envios WHERE ruta_id::text = $1 ORDER BY COALESCE(orden_ruta, 2147483647), created_at, id`, rutaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// conCuentaDemoEnVivo reordena los repartidores para que la cuenta de la app de
// la presentación quede con el camión que se inicia en vivo (los vehículos se
// reparten en el mismo orden que los repartidores).
func conCuentaDemoEnVivo(reps []RepartidorInfo, vehiculos []struct{ ID, Patente string }) []RepartidorInfo {
	iVeh, iRep := -1, -1
	for i, v := range vehiculos {
		if v.Patente == camionParaIniciarEnVivo && i < len(reps) {
			iVeh = i
		}
	}
	for i, r := range reps {
		if strings.EqualFold(r.Email, cuentaDemoApp) {
			iRep = i
		}
	}
	if iVeh < 0 || iRep < 0 || iVeh == iRep {
		return reps
	}
	out := append([]RepartidorInfo(nil), reps...)
	out[iVeh], out[iRep] = out[iRep], out[iVeh]
	return out
}
