package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"

	"movii/api/internal/config"
	"movii/api/internal/platform/db"
)

// Uso: go run ./cmd/migrate up | go run ./cmd/migrate down
func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	if len(os.Args) < 2 {
		log.Fatal("uso: migrate [up|down]")
	}

	switch os.Args[1] {
	case "up":
		if err := db.RunMigrations(cfg.DatabaseURL, "migrations"); err != nil {
			log.Fatal(err)
		}
		log.Println("migraciones aplicadas")
	case "down":
		if err := db.RollbackLast(cfg.DatabaseURL, "migrations"); err != nil {
			log.Fatal(err)
		}
		log.Println("última migración revertida")
	default:
		log.Fatalf("comando desconocido: %s", os.Args[1])
	}
}
