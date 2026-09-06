package httprouter

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"movii/api/internal/domain"
	"movii/api/internal/handlers"
	"movii/api/internal/middleware"
)

// Deps son las dependencias que el router necesita para montar las rutas.
type Deps struct {
	CORSOrigins     []string
	JWTSecret       string
	AuthHandler     *handlers.AuthHandler
	UsuariosHandler *handlers.UsuariosHandler
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

	r.Post("/auth/register", deps.AuthHandler.Register)
	r.Post("/auth/login", deps.AuthHandler.Login)

	r.Group(func(protected chi.Router) {
		protected.Use(middleware.RequireAuth(deps.JWTSecret))

		protected.Group(func(supervisorOnly chi.Router) {
			supervisorOnly.Use(middleware.RequireRole(domain.RolSupervisor))
			supervisorOnly.Get("/users", deps.UsuariosHandler.List)
		})
	})

	return r
}
