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
	CORSOrigins       []string
	JWTSecret         string
	AuthHandler       *handlers.AuthHandler
	UsuariosHandler   *handlers.UsuariosHandler
	EnvioHandler      *handlers.EnvioHandler
	RutaHandler       *handlers.RutaHandler
	RepartidorHandler *handlers.RepartidorHandler
	EstadoHandler     *handlers.EstadoHandler
	TrackingHandler   *handlers.TrackingHandler

	// Sprint 3. Opcionales: si son nil, sus rutas no se montan (los tests de
	// sprints anteriores arman el router sin ellos).
	OperacionesHandler *handlers.OperacionesHandler
	ReportesHandler    *handlers.ReportesHandler
	FlotaHandler       *handlers.FlotaHandler
	WhatsappHandler    *handlers.WhatsappHandler
	EliminarHandler    *handlers.EliminarHandler // T3: borrados físicos, solo admin
	GoogleHandler      *handlers.GoogleHandler   // T2: login con Google y GET /auth/config
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

	r.Get("/tracking/{codigo}", deps.TrackingHandler.PorCodigo)

	// Segundo paso del login (HU-16): código de 6 dígitos enviado por WhatsApp.
	r.Post("/auth/login/verificar", deps.AuthHandler.VerificarCodigo)
	r.Post("/auth/login/reenviar", deps.AuthHandler.ReenviarCodigo)

	// Primer acceso (T1): el login responde 428; se cambia la contraseña y se
	// valida un código por WhatsApp o mail. Verificar/reenviar comparten lógica con HU-16.
	r.Post("/auth/primer-acceso/cambiar-password", deps.AuthHandler.CambiarPasswordPrimerAcceso)
	r.Post("/auth/primer-acceso/verificar", deps.AuthHandler.VerificarCodigo)
	r.Post("/auth/primer-acceso/reenviar", deps.AuthHandler.ReenviarCodigo)

	// Login con Google (T2). /auth/config es el feature flag público del botón.
	r.Get("/auth/config", deps.GoogleHandler.Config) // nil-safe: sin handler responde google=false
	if deps.GoogleHandler != nil {
		r.Get("/auth/google", deps.GoogleHandler.Iniciar)
		r.Get("/auth/google/callback", deps.GoogleHandler.Callback)
	}

	// SSE de posiciones en vivo: fuera del grupo protegido porque autentica
	// también con ?access_token= (EventSource no manda headers).
	if deps.FlotaHandler != nil {
		r.With(
			middleware.TokenDesdeQuery,
			middleware.RequireAuth(deps.JWTSecret),
			middleware.RequireRole(domain.RolOperador, domain.RolAdmin, domain.RolRepartidor),
		).Get("/operaciones/flota/stream", deps.FlotaHandler.Stream)
	}

	r.Group(func(protected chi.Router) {
		protected.Use(middleware.RequireAuth(deps.JWTSecret))
		protected.Use(middleware.ValidarUUIDs)

		// Cualquier rol: cambiar la propia contraseña desde el perfil.
		protected.Post("/auth/cambiar-password", deps.AuthHandler.CambiarPassword)

		protected.Group(func(adminOnly chi.Router) {
			adminOnly.Use(middleware.RequireRole(domain.RolAdmin))
			adminOnly.Get("/users", deps.UsuariosHandler.List)
			if deps.EliminarHandler != nil {
				adminOnly.Delete("/users/{id}", deps.EliminarHandler.Usuario)
				adminOnly.Delete("/rutas/{id}", deps.EliminarHandler.Ruta)
				adminOnly.Delete("/envios/{id}", deps.EliminarHandler.Envio)
				adminOnly.Delete("/vehiculos/{id}", deps.EliminarHandler.Vehiculo)
			}
			if deps.WhatsappHandler != nil {
				adminOnly.Put("/users/{id}/telefono", deps.WhatsappHandler.ActualizarTelefono)
				adminOnly.Get("/admin/whatsapp/estado", deps.WhatsappHandler.Estado)
				adminOnly.Post("/admin/whatsapp/desvincular", deps.WhatsappHandler.Desvincular)
			}
		})

		protected.Get("/envios", deps.EnvioHandler.List)
		protected.Get("/envios/{id}", deps.EnvioHandler.GetByID)
		protected.Put("/envios/{id}/estado", deps.EstadoHandler.CambiarEstado)
		protected.Post("/envios/{id}/incidencia", deps.EstadoHandler.RegistrarIncidencia)
		protected.Get("/envios/{id}/eventos/{eventoId}/foto", deps.EstadoHandler.DescargarFotoIncidencia)
		protected.Post("/envios/{id}/reprogramacion", deps.EstadoHandler.Reprogramar)
		protected.Post("/envios/{id}/confirmacion", deps.EstadoHandler.Confirmar)
		protected.Get("/envios/{id}/confirmacion/firma", deps.EstadoHandler.DescargarFirma)
		protected.Get("/envios/{id}/confirmacion/foto", deps.EstadoHandler.DescargarFoto)
		protected.Get("/rutas", deps.RutaHandler.List)
		protected.Get("/rutas/{id}", deps.RutaHandler.Detail)
		if deps.OperacionesHandler != nil {
			// HU-12: el repartidor ve el mapa de sus rutas; una ajena responde 404.
			protected.Get("/rutas/{id}/mapa", deps.OperacionesHandler.MapaRuta)
		}
		if deps.FlotaHandler != nil {
			protected.Get("/envios/{id}/trayecto", deps.FlotaHandler.Trayecto)
		}

		protected.Group(func(operativo chi.Router) {
			operativo.Use(middleware.RequireRole(domain.RolOperador, domain.RolAdmin))
			operativo.Get("/repartidores", deps.UsuariosHandler.Repartidores)
			operativo.Post("/envios", deps.EnvioHandler.Create)
			operativo.Post("/rutas", deps.RutaHandler.Create)
			operativo.Put("/rutas/{id}", deps.RutaHandler.Update)
			operativo.Post("/rutas/{id}/envios", deps.RutaHandler.AsignarEnvios)
			operativo.Post("/rutas/{id}/recomendar", deps.RutaHandler.Recomendar)
			operativo.Delete("/rutas/{id}/envios/{envioId}", deps.RutaHandler.DesasignarEnvio)

			if deps.OperacionesHandler != nil {
				operativo.Get("/operaciones/dashboard", deps.OperacionesHandler.Dashboard)
			}
			if deps.ReportesHandler != nil {
				operativo.Get("/reportes/envios", deps.ReportesHandler.Envios)
				operativo.Get("/reportes/repartidores", deps.ReportesHandler.Repartidores)
				operativo.Get("/reportes/incidencias", deps.ReportesHandler.Incidencias)
			}
			if deps.FlotaHandler != nil {
				operativo.Get("/operaciones/flota", deps.FlotaHandler.List)
				operativo.Get("/operaciones/flota/{id}", deps.FlotaHandler.Detalle)
				operativo.Post("/vehiculos", deps.FlotaHandler.Crear)
				operativo.Put("/vehiculos/{id}", deps.FlotaHandler.Actualizar)
				operativo.Put("/rutas/{id}/vehiculo", deps.FlotaHandler.AsignarVehiculo)
			}
			if deps.WhatsappHandler != nil {
				operativo.Get("/envios/{id}/avisos", deps.WhatsappHandler.AvisosEnvio)
			}
		})

		protected.Group(func(repartidorOnly chi.Router) {
			repartidorOnly.Use(middleware.RequireRole(domain.RolRepartidor))
			repartidorOnly.Get("/repartidor/envios-del-dia", deps.RepartidorHandler.EnviosDelDia)
			repartidorOnly.Get("/repartidor/perfil", deps.RepartidorHandler.Perfil)
		})
	})

	return r
}
