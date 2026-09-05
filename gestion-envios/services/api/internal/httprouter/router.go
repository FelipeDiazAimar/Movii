package httprouter

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"movii/api/internal/handlers"
)

// Deps son las dependencias que el router necesita para montar las rutas.
// Se amplía en tareas siguientes (repos, services).
type Deps struct {
	CORSOrigins []string
}

// New arma el router HTTP completo de la API.
func New(deps Deps) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   deps.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Get("/health", handlers.Health)

	return r
}
