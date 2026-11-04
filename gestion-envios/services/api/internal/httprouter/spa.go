package httprouter

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// WithSPA sirve la web compilada (webDir) desde el mismo proceso Go: la API
// queda bajo /api y cualquier otra ruta devuelve el archivo estático o, si no
// existe, index.html (rutas del lado del cliente como /tracking/MOV-...).
func WithSPA(api http.Handler, webDir string) http.Handler {
	files := http.FileServer(http.Dir(webDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api" || strings.HasPrefix(r.URL.Path, "/api/") {
			http.StripPrefix("/api", api).ServeHTTP(w, r)
			return
		}
		if r.URL.Path == "/health" {
			api.ServeHTTP(w, r)
			return
		}
		p := filepath.Join(webDir, filepath.Clean("/"+r.URL.Path))
		if st, err := os.Stat(p); err != nil || st.IsDir() {
			http.ServeFile(w, r, filepath.Join(webDir, "index.html"))
			return
		}
		files.ServeHTTP(w, r)
	})
}
