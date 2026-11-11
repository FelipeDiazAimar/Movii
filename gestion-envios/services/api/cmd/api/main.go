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

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"movii/api/internal/config"
	"movii/api/internal/demo"
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

	// Mail: código de acceso para quien no tiene celular (T1) y respaldo de los
	// avisos cuando WhatsApp no está vinculado o el número no tiene WhatsApp.
	mailSender, estadoMail := elegirMail(cfg)
	log.Printf("mail: %s", estadoMail.Descripcion)
	notificador := services.NewNotificador(whatsappRepo, wa, cfg.PublicWebURL, cfg.PublicAppURL).ConMail(mailSender)
	hub := services.NewFlotaHub()
	// Cada cambio de un envío o de una ruta: aviso al destinatario/repartidor y aviso a la web en vivo.
	avisos := avisosCombinados{notificador, hub}
	go notificador.Correr(ctx)

	geoService := services.NewGeoService(repository.NewGeoRepo(pool), geocoder)

	authService := services.NewAuthService(usuarioRepo, cfg.JWTSecret)
	envioService := services.NewEnvioService(pool, envioRepo, eventoRepo, confirmacionRepo)
	if cfg.Geocodificar {
		envioService.ConGeocodificacion(geoService)
	}
	rutaService := services.NewRutaService(rutaRepo)
	// Recorrido más corto por calles al asignar envíos y al iniciar cada ruta.
	ordenador := services.NewOrdenadorRutas(pool, proveedor)
	asignacionService := services.NewAsignacionService(rutaRepo, envioRepo).ConAvisos(avisos).ConOrden(ordenador)
	repartidorService := services.NewRepartidorService(envioRepo)
	estadoService := services.NewEstadoService(pool, envioRepo, eventoRepo, confirmacionRepo).ConAvisos(avisos).ConOrden(ordenador)
	trackingService := services.NewTrackingService(repository.NewTrackingRepo(pool))
	operacionesService := services.NewOperacionesService(operacionesRepo).ConMapa(flotaRepo, router)
	reportesService := services.NewReportesService(repository.NewReportesRepo(pool))
	flotaService := services.NewFlotaService(flotaRepo, operacionesRepo, router)
	trackingService.ConFlota(flotaService)
	otpService := services.NewOTPService(whatsappRepo, usuarioRepo, authService, wa, cfg.JWTSecret)
	otpService.TTL = time.Duration(cfg.OTPTTLMin) * time.Minute
	otpService.MaxIntentos = cfg.OTPMaxIntentos
	otpService.ConMail(mailSender)
	// Login con Google (T2): sin GOOGLE_* el botón se oculta (GET /auth/config).
	var googleCliente *google.Cliente
	if cfg.GoogleHabilitado() {
		googleCliente = google.New(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleCallbackURL)
	}

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
	var sim *services.SimuladorGPS
	if cfg.SimuladorGPS {
		sim = services.NewSimuladorGPS(flotaRepo, router, hub)
		sim.Factor = cfg.SimuladorFactor
		sim.Parada = time.Duration(cfg.SimuladorParadaSeg) * time.Second
		// Estos camiones no entregan solos: esperan en la puerta a que se entregue desde la app.
		sim.EntregaManual = map[string]bool{}
		for _, p := range cfg.SimuladorEntregaManual {
			sim.EntregaManual[p] = true
		}
		sim.VelocidadManualKmh = cfg.SimuladorVelocidadManual
		if cfg.SimuladorEntregas {
			// Los envíos de demostración se entregan solos; los reales, desde la app del repartidor.
			sim.ConEntregas(estadoService)
		}
		go sim.Correr(ctx)
		log.Printf("simulador GPS activo (x%.1f)", cfg.SimuladorFactor)
	}

	rutaHandler := handlers.NewRutaHandler(rutaService, asignacionService)
	if cfg.Geocodificar { // GEOCODIFICAR=false = sin red: no se valida ni recomienda
		rutaHandler.ConRecomendacion(services.NewRecomendacionService(rutaRepo, repository.NewGeoRepo(pool), proveedor, cfg.RecomiendaOKKm, cfg.RecomiendaNoKm))
	}

	api := httprouter.New(httprouter.Deps{
		CORSOrigins:        cfg.CORSOrigins,
		JWTSecret:          cfg.JWTSecret,
		AuthHandler:        handlers.NewAuthHandler(authService).ConSegundoFactor(otpService),
		UsuariosHandler:    handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:       handlers.NewEnvioHandler(envioService),
		RutaHandler:        rutaHandler,
		RepartidorHandler:  handlers.NewRepartidorHandler(repartidorService).ConPerfil(repository.NewPerfilRepo(pool)),
		EstadoHandler:      handlers.NewEstadoHandler(estadoService),
		TrackingHandler:    handlers.NewTrackingHandler(trackingService),
		OperacionesHandler: handlers.NewOperacionesHandler(operacionesService),
		ReportesHandler:    handlers.NewReportesHandler(reportesService),
		FlotaHandler:       handlers.NewFlotaHandler(flotaService, hub),
		WhatsappHandler:    handlers.NewWhatsappHandler(wa, usuarioRepo, whatsappRepo).ConMail(estadoMail),
		EliminarHandler:    handlers.NewEliminarHandler(pool),
		DemoHandler:        demoHandler(cfg, pool, estadoService, rutaService, flotaRepo, ordenador, sim),
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

// elegirMail decide por dónde salen los mails: Gmail (u otro SMTP) si están
// SMTP_USER y SMTP_PASSWORD; si no, Resend si están RESEND_API_KEY y
// MAIL_FROM; si no, se escriben en el log.
func elegirMail(cfg config.Config) (mail.Sender, handlers.EstadoMail) {
	switch {
	case cfg.SMTPUser != "" && cfg.SMTPPassword != "":
		s := mail.NewSMTP(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPassword, "Movii <"+cfg.SMTPUser+">")
		proveedor := "smtp"
		if s.Host == mail.GmailHost {
			proveedor = "gmail"
		}
		return s, handlers.EstadoMail{Configurado: true, Proveedor: proveedor, Remitente: cfg.SMTPUser,
			Descripcion: "avisos y códigos por " + proveedor + " (" + s.Host + ") desde " + cfg.SMTPUser}
	case cfg.ResendAPIKey != "" && cfg.MailFrom != "":
		return mail.NewResend(cfg.ResendAPIKey, cfg.MailFrom), handlers.EstadoMail{Configurado: true, Proveedor: "resend", Remitente: cfg.MailFrom,
			Descripcion: "avisos y códigos por Resend desde " + cfg.MailFrom}
	}
	return mail.SoloLog{}, handlers.EstadoMail{Proveedor: "log", Descripcion: "sin SMTP_USER/SMTP_PASSWORD ni RESEND_API_KEY: los mails se escriben en el log"}
}

// demoHandler arma el botón ▶ (estado inicial del día de demostración).
// DEMO_REINICIO=false lo apaga. Usa un EnvioService sin geocodificación (las
// coordenadas salen del catálogo) y el EstadoService de la API (con avisos).
func demoHandler(cfg config.Config, pool *pgxpool.Pool, estados *services.EstadoService,
	rutas *services.RutaService, flota *repository.FlotaRepo, ordenador *services.OrdenadorRutas, sim *services.SimuladorGPS) *handlers.DemoHandler {
	if !cfg.DemoReinicio {
		return nil
	}
	svc := demo.Servicios{
		Pool:   pool,
		Envios: services.NewEnvioService(pool, repository.NewEnvioRepo(pool), repository.NewEventoRepo(pool), repository.NewConfirmacionRepo(pool)),
		// Sin avisos de ruta: irían por WhatsApp a los repartidores reales en cada reinicio.
		Asignacion: services.NewAsignacionService(repository.NewRutaRepo(pool), repository.NewEnvioRepo(pool)).ConOrden(ordenador),
		Estados:    estados,
		Rutas:      rutas,
		Flota:      flota,
		Geo:        repository.NewGeoRepo(pool),
	}
	if sim == nil {
		return handlers.NewDemoHandler(svc, nil)
	}
	return handlers.NewDemoHandler(svc, sim)
}

// avisosCombinados reparte cada cambio de estado o de asignación entre los
// avisos al destinatario/repartidor y la web en vivo (SSE "cambio").
type avisosCombinados struct {
	notificador *services.Notificador
	hub         *services.FlotaHub
}

func (a avisosCombinados) CambioDeEstado(envioID string) {
	a.notificador.CambioDeEstado(envioID)
	a.hub.CambioDeEstado(envioID)
}

func (a avisosCombinados) RutaAsignada(rutaID string) {
	a.notificador.RutaAsignada(rutaID)
	a.hub.RutaAsignada(rutaID)
}
