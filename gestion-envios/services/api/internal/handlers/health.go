package handlers

import (
	"net/http"

	httpx "movii/api/internal/platform/http"
)

// Health responde 200 con {"status":"ok"} para chequeos de disponibilidad.
func Health(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
