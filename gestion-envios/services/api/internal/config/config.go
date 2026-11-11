package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config agrupa toda la configuración de la API leída desde el entorno.
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	CORSOrigins []string
	Env         string

	// Sprint 3
	MigrateOnStart           bool     // MIGRATE_ON_START=true aplica las migraciones al arrancar
	MigrationsDir            string   // MIGRATIONS_DIR (default "migrations")
	PublicWebURL             string   // PUBLIC_WEB_URL: URL pública de la web (links de tracking en los avisos)
	PublicAppURL             string   // PUBLIC_APP_URL: URL del panel del repartidor (aviso de ruta asignada)
	SimuladorGPS             bool     // SIMULADOR_GPS=true mueve los vehículos por sus rutas
	SimuladorFactor          float64  // SIMULADOR_FACTOR: cuántas veces más rápido que la realidad (default 1: el vehículo llega a la hora estimada)
	SimuladorEntregas        bool     // SIMULADOR_ENTREGAS: el simulador entrega solo los envíos de demostración (default true)
	SimuladorParadaSeg       int      // SIMULADOR_PARADA_SEG: segundos que se queda en cada domicilio (default 40)
	SimuladorEntregaManual   []string // SIMULADOR_ENTREGA_MANUAL: patentes que esperan la entrega desde la app (default TRK-318; "-" = ninguna)
	SimuladorVelocidadManual float64  // SIMULADOR_VELOCIDAD_MANUAL: km/h de esos camiones (default 45)
	DemoReinicio             bool     // DEMO_REINICIO: habilita el botón ▶ que deja el día de demostración en su estado inicial (default true)
	WhatsappHabilitado       bool     // WHATSAPP_HABILITADO=true conecta la cuenta de WhatsApp (whatsmeow)
	NominatimURL             string   // NOMINATIM_URL (vacío = servidor público de OSM)
	OSRMURL                  string   // OSRM_URL (vacío = servidor público de OSRM)
	Geocodificar             bool     // GEOCODIFICAR=false desactiva la geocodificación (tests sin red)
	GeoProvider              string   // GEO_PROVIDER: "osrm" (default, gratis) o "google" (requiere GOOGLE_MAPS_KEY)
	GoogleMapsKey            string   // GOOGLE_MAPS_KEY (opcional)
	RecomiendaOKKm           float64  // RECOMIENDA_UMBRAL_OK_KM: por debajo de este desvío, conviene (default 2)
	RecomiendaNoKm           float64  // RECOMIENDA_UMBRAL_NO_KM: por encima, no conviene (default 5)

	// T1/T2: primer acceso y login con Google
	OTPTTLMin      int    // OTP_TTL_MIN: vigencia del código en minutos (default 10)
	OTPMaxIntentos int    // OTP_MAX_INTENTOS: intentos por código (default 3)
	ResendAPIKey   string // RESEND_API_KEY: vacío = el mail del código se escribe en el log
	MailFrom       string // MAIL_FROM: remitente verificado en Resend (ej. "Movii <no-reply@tu-dominio.com>")
	// Mail por SMTP (Gmail con contraseña de aplicación). Si SMTP_USER y
	// SMTP_PASSWORD están cargados, tiene prioridad sobre Resend.
	SMTPHost           string // SMTP_HOST (default smtp.gmail.com)
	SMTPPort           int    // SMTP_PORT (default 587, STARTTLS; 465 = TLS directo)
	SMTPUser           string // SMTP_USER: la cuenta, ej. avisos.movii@gmail.com
	SMTPPassword       string // SMTP_PASSWORD: contraseña de aplicación de 16 letras
	GoogleClientID     string // GOOGLE_CLIENT_ID
	GoogleClientSecret string // GOOGLE_CLIENT_SECRET
	GoogleCallbackURL  string // GOOGLE_CALLBACK_URL: URL pública de /auth/google/callback
}

// GoogleHabilitado indica si están las tres variables del login con Google.
func (c Config) GoogleHabilitado() bool {
	return c.GoogleClientID != "" && c.GoogleClientSecret != "" && c.GoogleCallbackURL != ""
}

func envInt(nombre string, porDefecto int) int {
	if n, err := strconv.Atoi(strings.TrimSpace(os.Getenv(nombre))); err == nil && n > 0 {
		return n
	}
	return porDefecto
}

func envBool(nombre string, porDefecto bool) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(nombre))) {
	case "true", "1", "si", "sí", "yes":
		return true
	case "false", "0", "no":
		return false
	}
	return porDefecto
}

func envOr(nombre, porDefecto string) string {
	if v := os.Getenv(nombre); v != "" {
		return v
	}
	return porDefecto
}

func envFloat(nombre string, porDefecto float64) float64 {
	if f, err := strconv.ParseFloat(os.Getenv(nombre), 64); err == nil && f > 0 {
		return f
	}
	return porDefecto
}

// Load lee la configuración desde variables de entorno. DATABASE_URL y
// JWT_SECRET son obligatorias; el resto tiene valores por defecto.
func Load() (Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return Config{}, fmt.Errorf("config: falta la variable de entorno DATABASE_URL")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return Config{}, fmt.Errorf("config: falta la variable de entorno JWT_SECRET")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	env := os.Getenv("ENV")
	if env == "" {
		env = "development"
	}

	origins := []string{"http://localhost:5173"}
	if raw := os.Getenv("CORS_ORIGINS"); raw != "" {
		origins = strings.Split(raw, ",")
	}

	factor := 1.0
	if raw := os.Getenv("SIMULADOR_FACTOR"); raw != "" {
		if f, err := strconv.ParseFloat(raw, 64); err == nil && f > 0 {
			factor = f
		}
	}
	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "migrations"
	}
	webURL := os.Getenv("PUBLIC_WEB_URL")
	if webURL == "" {
		webURL = "http://localhost:5173"
	}

	return Config{
		Port:                     port,
		DatabaseURL:              dbURL,
		JWTSecret:                jwtSecret,
		CORSOrigins:              origins,
		Env:                      env,
		MigrateOnStart:           envBool("MIGRATE_ON_START", false),
		MigrationsDir:            migrationsDir,
		PublicWebURL:             strings.TrimRight(webURL, "/"),
		PublicAppURL:             os.Getenv("PUBLIC_APP_URL"),
		SimuladorGPS:             envBool("SIMULADOR_GPS", true),
		SimuladorFactor:          factor,
		SimuladorEntregas:        envBool("SIMULADOR_ENTREGAS", true),
		SimuladorParadaSeg:       envInt("SIMULADOR_PARADA_SEG", 40),
		DemoReinicio:             envBool("DEMO_REINICIO", true),
		SimuladorEntregaManual:   listaPatentes(envOr("SIMULADOR_ENTREGA_MANUAL", "TRK-318")),
		SimuladorVelocidadManual: envFloat("SIMULADOR_VELOCIDAD_MANUAL", 45),
		WhatsappHabilitado:       envBool("WHATSAPP_HABILITADO", false),
		NominatimURL:             os.Getenv("NOMINATIM_URL"),
		OSRMURL:                  os.Getenv("OSRM_URL"),
		Geocodificar:             envBool("GEOCODIFICAR", true),
		GeoProvider:              strings.ToLower(strings.TrimSpace(envOr("GEO_PROVIDER", "osrm"))),
		GoogleMapsKey:            os.Getenv("GOOGLE_MAPS_KEY"),
		RecomiendaOKKm:           envFloat("RECOMIENDA_UMBRAL_OK_KM", 2),
		RecomiendaNoKm:           envFloat("RECOMIENDA_UMBRAL_NO_KM", 5),
		OTPTTLMin:                envInt("OTP_TTL_MIN", 10),
		OTPMaxIntentos:           envInt("OTP_MAX_INTENTOS", 3),
		ResendAPIKey:             strings.TrimSpace(os.Getenv("RESEND_API_KEY")),
		MailFrom:                 strings.TrimSpace(os.Getenv("MAIL_FROM")),
		SMTPHost:                 strings.TrimSpace(os.Getenv("SMTP_HOST")),
		SMTPPort:                 envInt("SMTP_PORT", 587),
		SMTPUser:                 strings.TrimSpace(os.Getenv("SMTP_USER")),
		SMTPPassword:             strings.ReplaceAll(strings.TrimSpace(os.Getenv("SMTP_PASSWORD")), " ", ""),
		GoogleClientID:           strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID")),
		GoogleClientSecret:       strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET")),
		GoogleCallbackURL:        strings.TrimSpace(os.Getenv("GOOGLE_CALLBACK_URL")),
	}, nil
}

// listaPatentes separa "TRK-318, ABC123" en patentes en mayúsculas ("-" o vacío = ninguna).
func listaPatentes(raw string) []string {
	var out []string
	for _, p := range strings.Split(raw, ",") {
		if p = strings.ToUpper(strings.TrimSpace(p)); p != "" && p != "-" {
			out = append(out, p)
		}
	}
	return out
}
