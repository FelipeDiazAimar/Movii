package main

import (
	"context"
	"log"
	"net/http"

	"github.com/joho/godotenv"

	"movii/api/internal/config"
	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func main() {
	_ = godotenv.Load() // en producción las variables ya están en el entorno

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	usuarioRepo := repository.NewUsuarioRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)

	authService := services.NewAuthService(usuarioRepo, cfg.JWTSecret)
	eventoRepo := repository.NewEventoRepo(pool)
	confirmacionRepo := repository.NewConfirmacionRepo(pool)
	envioService := services.NewEnvioService(pool, envioRepo, eventoRepo, confirmacionRepo)
	rutaService := services.NewRutaService(rutaRepo)
	asignacionService := services.NewAsignacionService(rutaRepo, envioRepo)
	repartidorService := services.NewRepartidorService(envioRepo)
	estadoService := services.NewEstadoService(pool, envioRepo, eventoRepo, confirmacionRepo)
	trackingService := services.NewTrackingService(repository.NewTrackingRepo(pool))

	router := httprouter.New(httprouter.Deps{
		CORSOrigins:       cfg.CORSOrigins,
		JWTSecret:         cfg.JWTSecret,
		AuthHandler:       handlers.NewAuthHandler(authService),
		UsuariosHandler:   handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:      handlers.NewEnvioHandler(envioService),
		RutaHandler:       handlers.NewRutaHandler(rutaService, asignacionService),
		RepartidorHandler: handlers.NewRepartidorHandler(repartidorService),
		EstadoHandler:     handlers.NewEstadoHandler(estadoService),
		TrackingHandler:   handlers.NewTrackingHandler(trackingService),
	})

	log.Printf("API escuchando en :%s (env=%s)", cfg.Port, cfg.Env)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server: %v", err)
	}
}
