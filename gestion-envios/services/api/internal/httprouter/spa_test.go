package httprouter

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSPA_AssetsYFallback(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	_ = os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html></html>"), 0o644)
	_ = os.WriteFile(filepath.Join(dir, "assets", "maplibre-gl-worker-abc.mjs"), []byte("self.x=1"), 0o644)
	h := WithSPA(http.NotFoundHandler(), dir, "")

	pedir := func(p string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, p, nil))
		return w
	}

	if w := pedir("/assets/maplibre-gl-worker-abc.mjs"); w.Code != 200 || !strings.HasPrefix(w.Header().Get("Content-Type"), "text/javascript") {
		t.Fatalf("worker: %d %q", w.Code, w.Header().Get("Content-Type"))
	}
	if w := pedir("/assets/no-existe.mjs"); w.Code != http.StatusNotFound {
		t.Fatalf("asset inexistente: %d, quería 404", w.Code)
	}
	if w := pedir("/tracking/MOV-1"); w.Code != 200 || !strings.Contains(w.Body.String(), "<html>") {
		t.Fatalf("ruta del cliente: %d", w.Code)
	}
}
