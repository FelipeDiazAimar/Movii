package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"movii/api/internal/config"
	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/platform/geo"
	"movii/api/internal/platform/google"
	"movii/api/internal/platform/mail"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func main() {
	_ = godotenv.Load() // en producción las variables ya están en el entorno

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if cfg.MigrateOnStart {
		if err := db.RunMigrations(cfg.DatabaseURL, cfg.MigrationsDir); err != nil {
			log.Fatalf("migraciones: %v", err)
		}
		log.Printf("migraciones al día")
	}

	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	// Servicios externos de mapas (OSM). Si OSRM no responde, el recorrido se
	// dibuja en línea recta para que el mapa nunca quede vacío.
	router := geo.ConRespaldo(geo.NewOSRM(cfg.OSRMURL))
	var geocoder geo.Geocoder = geo.NewNominatim(cfg.NominatimURL)
	var proveedor geo.GeoProvider = geo.NewOSM(geocoder, cfg.OSRMURL)
	if cfg.GeoProvider == "google" {
		if cfg.GoogleMapsKey != "" {
			proveedor = geo.NewGoogle(cfg.GoogleMapsKey)
		} else {
			log.Printf("geo: GEO_PROVIDER=google sin GOOGLE_MAPS_KEY, se usa OSRM")
		}
	}
	proveedor = geo.ConCache(proveedor, 24*time.Hour)

	// WhatsApp: cuenta vinculada por QR (whatsmeow) o, deshabilitado, solo log.
	var wa whatsapp.Administrable = whatsapp.SoloLog{}
	if cfg.WhatsappHabilitado {
		cli, err := whatsapp.NuevoCliente(ctx, cfg.DatabaseURL)
		if err != nil {
			log.Printf("whatsapp: deshabilitado por error al iniciar: %v", err)
		} else {
			wa = cli
			defer cli.Cerrar()
		}
	}

	usuarioRepo := repository.NewUsuarioRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)
	eventoRepo := repository.NewEventoRepo(pool)
	confirmacionRepo := repository.NewConfirmacionRepo(pool)
	operacionesRepo := repository.NewOperacionesRepo(pool)
	flotaRepo := repository.NewFlotaRepo(pool)
	whatsappRepo := repository.NewWhatsappRepo(pool)

	notificador := services.NewNotificador(whatsappRepo, wa, cfg.PublicWebURL, cfg.PublicAppURL)
	go notificador.Correr(ctx)

	geoService := services.NewGeoService(repository.NewGeoRepo(pool), geocoder)

	authService := services.NewAuthService(usuarioRepo, cfg.JWTSecret)
	envioService := services.NewEnvioService(pool, envioRepo, eventoRepo, confirmacionRepo)
	if cfg.Geocodificar {
		envioService.ConGeocodificacion(geoService)
	}
	rutaService := services.NewRutaService(rutaRepo)
	asignacionService := services.NewAsignacionService(rutaRepo, envioRepo).ConAvisos(notificador)
	repartidorService := services.NewRepartidorService(envioRepo)
	estadoService := services.NewEstadoService(pool, envioRepo, eventoRepo, confirmacionRepo).ConAvisos(notificador)
	trackingService := services.NewTrackingService(repository.NewTrackingRepo(pool))
	operacionesService := services.NewOperacionesService(operacionesRepo).ConMapa(flotaRepo, router)
	reportesService := services.NewReportesService(repository.NewReportesRepo(pool))
	flotaService := services.NewFlotaService(flotaRepo, operacionesRepo, router)
	trackingService.ConFlota(flotaService)
	otpService := services.NewOTPService(whatsappRepo, usuarioRepo, authService, wa, cfg.JWTSecret)
	otpService.TTL = time.Duration(cfg.OTPTTLMin) * time.Minute
	otpService.MaxIntentos = cfg.OTPMaxIntentos
	// Mail del código para quien no tiene celular (T1): Resend o, sin clave, solo log.
	if cfg.ResendAPIKey != "" && cfg.MailFrom != "" {
		otpService.ConMail(mail.NewResend(cfg.ResendAPIKey, cfg.MailFrom))
	} else {
		log.Printf("mail: sin RESEND_API_KEY/MAIL_FROM, los códigos por mail se escriben en el log")
	}
	// Login con Google (T2): sin GOOGLE_* el botón se oculta (GET /auth/config).
	var googleCliente *google.Cliente
	if cfg.GoogleHabilitado() {
		googleCliente = google.New(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleCallbackURL)
	}
	hub := services.NewFlotaHub()

	if cfg.Geocodificar {
		go func() {
			bctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
			defer cancel()
			if n, err := geoService.Backfill(bctx, 200); err != nil {
				log.Printf("geo: backfill: %v", err)
			} else if n > 0 {
				log.Printf("geo: %d destinos ubicados en el mapa", n)
			}
		}()
	}
	if cfg.SimuladorGPS {
		sim := services.NewSimuladorGPS(flotaRepo, router, hub)
		sim.Factor = cfg.SimuladorFactor
		go sim.Correr(ctx)
		log.Printf("simulador GPS activo (x%.1f)", cfg.SimuladorFactor)
	}

	envioHandler := handlers.NewEnvioHandler(envioService)
	rutaHandler := handlers.NewRutaHandler(rutaService, asignacionService)
	if cfg.Geocodificar { // GEOCODIFICAR=false = sin red: no se valida ni recomienda
		reco := services.NewRecomendacionService(rutaRepo, repository.NewGeoRepo(pool), proveedor, cfg.RecomiendaOKKm, cfg.RecomiendaNoKm)
		rutaHandler.ConRecomendacion(reco)
		envioHandler.ConValidacionDireccion(reco)
	}

	api := httprouter.New(httprouter.Deps{
		CORSOrigins:        cfg.CORSOrigins,
		JWTSecret:          cfg.JWTSecret,
		AuthHandler:        handlers.NewAuthHandler(authService).ConSegundoFactor(otpService),
		UsuariosHandler:    handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:       envioHandler,
		RutaHandler:        rutaHandler,
		RepartidorHandler:  handlers.NewRepartidorHandler(repartidorService).ConPerfil(repository.NewPerfilRepo(pool)),
		EstadoHandler:      handlers.NewEstadoHandler(estadoService),
		TrackingHandler:    handlers.NewTrackingHandler(trackingService),
		OperacionesHandler: handlers.NewOperacionesHandler(operacionesService),
		ReportesHandler:    handlers.NewReportesHandler(reportesService),
		FlotaHandler:       handlers.NewFlotaHandler(flotaService, hub),
		WhatsappHandler:    handlers.NewWhatsappHandler(wa, usuarioRepo, whatsappRepo),
		EliminarHandler:    handlers.NewEliminarHandler(pool),
		PedidosHandler:     handlers.NewPedidosHandler(envioRepo, envioService),
		SugerenciaHandler:  handlers.NewSugerenciaHandler(services.NewSugerenciaService(repository.NewSugerenciaRepo(pool))),
		GoogleHandler:      handlers.NewGoogleHandler(googleCliente, authService, otpService, cfg.JWTSecret, cfg.PublicWebURL, cfg.Env != "production"),
	})

	var handler http.Handler = api
	if webDir := os.Getenv("WEB_DIR"); webDir != "" {
		handler = httprouter.WithSPA(api, webDir, os.Getenv("APP_DIR")) // web + API en un solo servicio
	}

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: handler, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		<-ctx.Done()
		sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(sctx)
	}()

	log.Printf("API escuchando en :%s (env=%s)", cfg.Port, cfg.Env)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server: %v", err)
	}
}
