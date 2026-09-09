// Package testenv carga el .env de services/api antes de que corran los
// tests. Los paquetes de test leen DATABASE_URL con os.Getenv directamente
// (nunca llaman a godotenv.Load, eso solo pasa en cmd/api y cmd/migrate), así
// que sin este import "go test ./..." salteaba en silencio la mitad de la
// suite: el proceso terminaba con exit code 0 igual, dando la falsa
// impresión de que todo había corrido y pasado.
//
// Se importa con nombre en blanco (_ "movii/api/internal/testenv") desde un
// archivo _test.go de cada paquete que necesita DATABASE_URL; alcanza con
// una sola importación por paquete, porque Init corre antes que cualquier
// test de ese binario.
package testenv

import (
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

func init() {
	dir, err := os.Getwd()
	if err != nil {
		return
	}
	for {
		envPath := filepath.Join(dir, ".env")
		if _, err := os.Stat(envPath); err == nil {
			_ = godotenv.Load(envPath)
			return
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return
		}
		dir = parent
	}
}
