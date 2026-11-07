// Comando demo: arma la operación del día para presentar el Sprint 3.
//
// Crea (si no existen) dos repartidores más, tres rutas para HOY con
// direcciones reales de San Francisco (Córdoba), les asigna un vehículo y
// pone en camino las primeras entregas de cada una, así el simulador GPS
// mueve los camiones por las calles. Es idempotente: si las rutas de hoy ya
// existen no hace nada.
//
// Uso: go run ./cmd/demo
package main

import (
	"context"
	"log"
	"time"

	"github.com/joho/godotenv"

	"movii/api/internal/config"
	"movii/api/internal/domain"
	"movii/api/internal/platform/db"
	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

type parada struct{ nombre, tel, calle, numero, contenido string }

type rutaDemo struct {
	nombre, zona, repartidorEmail, repartidorNombre, patente string
	enCamino                                                 int // cuántas paradas salen ya "en camino"
	paradas                                                  []parada
}

const passwordDemo = "Movii2026!"

var rutas = []rutaDemo{
	{
		nombre: "Demo Centro", zona: "Centro", repartidorEmail: "repartidor@movii.demo", repartidorNombre: "Carla Repartidora", patente: "TRK-318", enCamino: 2,
		paradas: []parada{
			{"Lucía Fernández", "3564 412301", "Bv. 25 de Mayo", "1850", "Indumentaria"},
			{"Estudio Jurídico Paz", "3564 412302", "Belgrano", "1950", "Documentación"},
			{"Farmacia Central", "3564 412303", "Iturraspe", "1600", "Medicamentos"},
			{"Martín Gómez", "3564 412304", "Pellegrini", "320", "Electrónica"},
			{"Panadería La Espiga", "3564 412305", "Mitre", "850", "Insumos"},
		},
	},
	{
		nombre: "Demo Norte", zona: "Barrio Catedral", repartidorEmail: "diego@movii.demo", repartidorNombre: "Diego Repartidor", patente: "FUR-102", enCamino: 1,
		paradas: []parada{
			{"Sofía Ramírez", "3564 412311", "Av. del Libertador Norte", "450", "Libros"},
			{"Ferretería El Tornillo", "3564 412312", "Juan B. Justo", "2100", "Herramientas"},
			{"Carlos Medina", "3564 412313", "Dante Alighieri", "300", "Repuestos"},
			{"Ana Villalba", "3564 412314", "Rivadavia", "600", "Cosmética"},
		},
	},
	{
		nombre: "Demo Sur", zona: "Barrio Parque", repartidorEmail: "lucia@movii.demo", repartidorNombre: "Lucía Repartidora", patente: "CAM-205", enCamino: 0,
		paradas: []parada{
			{"Club Sportivo Belgrano", "3564 412321", "Av. Rosario de Santa Fe", "900", "Indumentaria deportiva"},
			{"Jorge Paredes", "3564 412322", "López y Planes", "1500", "Electrodoméstico"},
			{"Veterinaria San Roque", "3564 412323", "Bv. Roca", "1200", "Alimento balanceado"},
		},
	},
}

func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()
	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	hoy := services.FechaAR(time.Now())
	var existentes int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM rutas WHERE fecha = $1::date AND nombre LIKE 'Demo %'`, hoy).Scan(&existentes); err != nil {
		log.Fatal(err)
	}
	if existentes > 0 {
		log.Printf("ya hay %d rutas demo para %s: no hago nada", existentes, hoy)
		return
	}

	usuarios := repository.NewUsuarioRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	eventoRepo := repository.NewEventoRepo(pool)
	confRepo := repository.NewConfirmacionRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)
	flota := repository.NewFlotaRepo(pool)
	auth := services.NewAuthService(usuarios, cfg.JWTSecret)
	envios := services.NewEnvioService(pool, envioRepo, eventoRepo, confRepo)
	rutaSvc := services.NewRutaService(rutaRepo)
	asignacion := services.NewAsignacionService(rutaRepo, envioRepo)
	estados := services.NewEstadoService(pool, envioRepo, eventoRepo, confRepo)
	geoSvc := services.NewGeoService(repository.NewGeoRepo(pool), geo.NewNominatim(cfg.NominatimURL))

	// Los camiones salen del depósito central.
	if _, err := pool.Exec(ctx, `UPDATE vehiculos SET latitud = $1, longitud = $2, velocidad = 0, estado = 'activo'`,
		geo.CentroSanFrancisco.Lat, geo.CentroSanFrancisco.Lng); err != nil {
		log.Fatal(err)
	}

	for _, r := range rutas {
		rep, err := usuarios.GetByEmail(ctx, r.repartidorEmail)
		if err != nil {
			rep, err = auth.Register(ctx, r.repartidorNombre, r.repartidorEmail, passwordDemo, domain.RolRepartidor)
			if err != nil {
				log.Fatalf("repartidor %s: %v", r.repartidorEmail, err)
			}
			log.Printf("repartidor creado: %s (%s / %s)", rep.Nombre, r.repartidorEmail, passwordDemo)
		}

		ruta, err := rutaSvc.Create(ctx, domain.Ruta{Nombre: r.nombre, Zona: r.zona, Fecha: hoy, RepartidorID: rep.ID})
		if err != nil {
			log.Fatalf("ruta %s: %v", r.nombre, err)
		}

		ids := make([]string, 0, len(r.paradas))
		for _, p := range r.paradas {
			e, err := envios.Create(ctx, services.CrearEnvioInput{
				RemitenteNombre: "Depósito Central Movii", RemitenteTelefono: "3564 100100", RemitenteDireccion: "Ruta 19 km 4, San Francisco",
				DestinatarioNombre: p.nombre, DestinatarioTelefono: p.tel, Calle: p.calle, Numero: p.numero,
				Localidad: "San Francisco", CodigoPostal: "X2400", Peso: 2 + float64(len(p.nombre)%9)*3.5,
				Tamano: "mediano", TipoContenido: p.contenido,
			})
			if err != nil {
				log.Fatalf("envío %s: %v", p.nombre, err)
			}
			destID, _ := repository.NewGeoRepo(pool).DestinatarioDeEnvio(ctx, e.ID)
			if err := geoSvc.GeocodificarDestinatario(ctx, destID); err != nil {
				log.Printf("  no se pudo ubicar %s %s: %v", p.calle, p.numero, err)
			}
			ids = append(ids, e.ID)
		}
		if _, err := asignacion.Asignar(ctx, ruta.ID, ids); err != nil {
			log.Fatalf("asignar %s: %v", r.nombre, err)
		}

		var vehiculoID string
		if err := pool.QueryRow(ctx, `SELECT id FROM vehiculos WHERE patente = $1`, r.patente).Scan(&vehiculoID); err == nil {
			if err := flota.AsignarARuta(ctx, ruta.ID, &vehiculoID); err != nil {
				log.Printf("  vehículo %s: %v", r.patente, err)
			}
		}
		for i := 0; i < r.enCamino && i < len(ids); i++ {
			if _, err := estados.CambiarEstado(ctx, ids[i], domain.EstadoEnvioEnCamino, rep.ID, domain.RolRepartidor); err != nil {
				log.Printf("  en camino %d: %v", i, err)
			}
		}
		log.Printf("ruta %s: %d envíos, vehículo %s, repartidor %s", r.nombre, len(ids), r.patente, rep.Nombre)
	}
	log.Printf("listo: la demo de %s está armada", hoy)
}
