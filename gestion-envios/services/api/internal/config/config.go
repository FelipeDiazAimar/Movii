package config

import (
	"fmt"
	"os"
	"strings"
)

// Config agrupa toda la configuración de la API leída desde el entorno.
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	CORSOrigins []string
	Env         string
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

	return Config{
		Port:        port,
		DatabaseURL: dbURL,
		JWTSecret:   jwtSecret,
		CORSOrigins: origins,
		Env:         env,
	}, nil
}
