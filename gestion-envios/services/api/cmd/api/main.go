package main

import (
	"log"
	"net/http"

	"github.com/joho/godotenv"

	"movii/api/internal/config"
	"movii/api/internal/httprouter"
)

func main() {
	_ = godotenv.Load() // en producción las variables ya están en el entorno

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	router := httprouter.New(httprouter.Deps{CORSOrigins: cfg.CORSOrigins})

	log.Printf("API escuchando en :%s (env=%s)", cfg.Port, cfg.Env)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server: %v", err)
	}
}
