package httprouter

import (
	"mime"
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

func init() {
	// Go no conoce estas extensiones: sin esto el manifest de la PWA sale como
	// text/plain y Chrome no ofrece instalar la app.
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")
	_ = mime.AddExtensionType(".js", "text/javascript; charset=utf-8")
	// El worker de MapLibre (vista 3D) es un módulo .mjs.
	_ = mime.AddExtensionType(".mjs", "text/javascript; charset=utf-8")
}

// serveSPA devuelve el archivo estático pedido o index.html si no existe.
func serveSPA(w http.ResponseWriter, r *http.Request, dir, urlPath string) {
	file := filepath.Join(dir, filepath.Clean("/"+urlPath))
	st, err := os.Stat(file)
	// Un archivo de /assets/ que no existe es un 404, no la página: si se
	// devolviera index.html, el navegador lo recibiría como script con tipo
	// text/html y el error sería mucho más difícil de entender.
	if (err != nil || st.IsDir()) && strings.HasPrefix(urlPath, "/assets/") {
		http.NotFound(w, r)
		return
	}
	if err != nil || st.IsDir() {
		// El HTML no se cachea: así un deploy nuevo se ve al recargar.
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
		return
	}
	// El service worker y el manifest tampoco, para que la PWA se actualice.
	if base := filepath.Base(file); base == "sw.js" || base == "manifest.webmanifest" {
		w.Header().Set("Cache-Control", "no-cache")
	}
	http.ServeFile(w, r, file)
}
