package middleware

import (
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"

	httpx "movii/api/internal/platform/http"
)

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// ValidarUUIDs responde 404 si algún parámetro de ruta que es un id no tiene
// formato UUID. Sin esto, Postgres rechaza el valor y el cliente recibe un 500.
// Debe montarse en un grupo (r.Group/With) para que los parámetros ya estén resueltos.
func ValidarUUIDs(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for _, k := range []string{"id", "envioId", "eventoId"} {
			if v := chi.URLParam(r, k); v != "" && !uuidRe.MatchString(v) {
				httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el recurso no existe")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
