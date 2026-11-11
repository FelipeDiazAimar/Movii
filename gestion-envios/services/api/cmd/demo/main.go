// Comando demo: deja los datos ficticios de la presentación en su estado inicial.
//
// Uso:
//
//	go run ./cmd/demo [-fecha AAAA-MM-DD] [-limpiar] [-si]
//
// Sin banderas hace lo mismo que el botón ▶ del centro de operaciones
// (demo.Reiniciar): completa el historial de los últimos 30 días si falta y
// vuelve a armar la operación de hoy, los pendientes y las rutas de mañana.
// No crea usuarios ni toca vehículos agregados a mano ni envíos reales.
// -limpiar borra todo lo ficticio (historial incluido).
//
// Antes de escribir muestra a qué host de base se conecta y pide escribir
// "si" (salvo con -si).
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"movii/api/internal/config"
	"movii/api/internal/demo"
	"movii/api/internal/platform/db"
	"movii/api/internal/platform/geo"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// hostDeDatabaseURL devuelve solo el host de la base (nunca usuario ni clave).
func hostDeDatabaseURL(databaseURL string) string {
	u, err := url.Parse(databaseURL)
	if err != nil || u.Hostname() == "" {
		return "desconocido"
	}
	return u.Hostname()
}

func main() {
	fechaFlag := flag.String("fecha", "", "fecha de referencia AAAA-MM-DD (por defecto hoy en Argentina)")
	limpiar := flag.Bool("limpiar", false, "borra todo lo generado por el demo (historial incluido) y nada más")
	si := flag.Bool("si", false, "no pide confirmación por stdin")
	flag.Parse()

	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	ref := services.FechaAR(time.Now())
	if f := strings.TrimSpace(*fechaFlag); f != "" {
		if _, err := time.Parse("2006-01-02", f); err != nil {
			log.Fatalf("fecha inválida %q: tiene que ser AAAA-MM-DD", f)
		}
		ref = f
	}

	ctx := context.Background()
	host := hostDeDatabaseURL(cfg.DatabaseURL)
	if !*si {
		accion := "Se va a dejar el estado inicial del día (borra y rearma la operación ficticia de hoy en adelante)"
		if *limpiar {
			accion = "Se van a BORRAR todos los datos ficticios del demo"
		}
		fmt.Printf("Base: %s\n%s. Escribí \"si\" para continuar: ", host, accion)
		linea, _ := bufio.NewReader(os.Stdin).ReadString('\n')
		if strings.ToLower(strings.TrimSpace(linea)) != "si" {
			fmt.Println("cancelado: no se hizo nada")
			return
		}
	}

	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	log.Printf("base destino: %s", host)

	if *limpiar {
		res, err := demo.LimpiarDemo(ctx, pool, nil)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("limpieza lista: envíos=%d rutas=%d vehículos=%d destinatarios=%d remitentes=%d avisos=%d\n",
			res.Envios, res.Rutas, res.Vehiculos, res.Destinatarios, res.Remitentes, res.Notificaciones)
		return
	}

	envioRepo := repository.NewEnvioRepo(pool)
	eventoRepo := repository.NewEventoRepo(pool)
	confRepo := repository.NewConfirmacionRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)
	estados := services.NewEstadoService(pool, envioRepo, eventoRepo, confRepo)
	// Avisos al destinatario: como es demo quedan "simulado" (no se manda nada).
	notif := services.NewNotificador(repository.NewWhatsappRepo(pool), whatsapp.SoloLog{}, cfg.PublicWebURL, cfg.PublicAppURL)
	estados.ConAvisos(notif)

	res, err := demo.Reiniciar(ctx, demo.Servicios{
		Pool:       pool,
		Envios:     services.NewEnvioService(pool, envioRepo, eventoRepo, confRepo),
		Asignacion: services.NewAsignacionService(rutaRepo, envioRepo).ConOrden(services.NewOrdenadorRutas(pool, geo.NewOSM(geo.NewNominatim(cfg.NominatimURL), cfg.OSRMURL))),
		Estados:    estados,
		Rutas:      services.NewRutaService(rutaRepo),
		Flota:      repository.NewFlotaRepo(pool),
		Geo:        repository.NewGeoRepo(pool),
	}, ref)
	if err != nil {
		log.Fatal(err)
	}
	notif.Procesar(ctx)
	log.Printf("listo: %+v", res)
}
