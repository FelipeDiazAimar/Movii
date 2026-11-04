package httprouter

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// WithSPA sirve la web compilada desde el mismo proceso Go:
//   - /api/*  → la API (con el prefijo removido)
//   - /app/*  → panel del repartidor (app Expo exportada para web), si appDir != ""
//   - el resto → panel de operaciones (webDir), con fallback a index.html para
//     las rutas del lado del cliente (p. ej. /tracking/MOV-...).
func WithSPA(api http.Handler, webDir, appDir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		switch {
		case p == "/api" || strings.HasPrefix(p, "/api/"):
			http.StripPrefix("/api", api).ServeHTTP(w, r)
		case p == "/health":
			api.ServeHTTP(w, r)
		case appDir != "" && p == "/app":
			http.Redirect(w, r, "/app/", http.StatusMovedPermanently)
		case appDir != "" && strings.HasPrefix(p, "/app/"):
			serveSPA(w, r, appDir, strings.TrimPrefix(p, "/app"))
		default:
			serveSPA(w, r, webDir, p)
		}
	})
}

// serveSPA devuelve el archivo estático pedido o index.html si no existe.
func serveSPA(w http.ResponseWriter, r *http.Request, dir, urlPath string) {
	file := filepath.Join(dir, filepath.Clean("/"+urlPath))
	if st, err := os.Stat(file); err != nil || st.IsDir() {
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
		return
	}
	http.ServeFile(w, r, file)
}
