package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"sync"
	"time"

	"movii/api/internal/demo"
	httpx "movii/api/internal/platform/http"
	"movii/api/internal/services"
)

// pausable es el simulador GPS: se frena mientras se rearma el día.
type pausable interface {
	Pausar() (reanudar func())
}

// DemoHandler expone el botón ▶ del centro de operaciones: deja el estado
// inicial de un día normal para simular (ver demo.Reiniciar).
type DemoHandler struct {
	svc demo.Servicios
	sim pausable
	mu  sync.Mutex
}

// NewDemoHandler crea el handler. sim puede ser nil (simulador apagado).
func NewDemoHandler(svc demo.Servicios, sim pausable) *DemoHandler {
	return &DemoHandler{svc: svc, sim: sim}
}

// Reiniciar maneja POST /admin/demo/reiniciar.
func (h *DemoHandler) Reiniciar(w http.ResponseWriter, r *http.Request) {
	if !h.mu.TryLock() {
		httpx.WriteError(w, http.StatusConflict, "reinicio_en_curso", "ya se está preparando el día; esperá unos segundos")
		return
	}
	defer h.mu.Unlock()

	if h.sim != nil {
		reanudar := h.sim.Pausar()
		defer reanudar()
	}
	// Sigue aunque el navegador corte la conexión: dejarlo a medias es peor.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 3*time.Minute)
	defer cancel()

	res, err := demo.Reiniciar(ctx, h.svc, services.FechaAR(time.Now()))
	switch {
	case errors.Is(err, demo.ErrSinRepartidores):
		httpx.WriteError(w, http.StatusConflict, "sin_repartidores", "hace falta al menos un repartidor activo para armar las rutas")
	case err != nil:
		log.Printf("demo: reinicio: %v", err)
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo preparar el día")
	default:
		log.Printf("demo: estado inicial listo: %+v", res)
		httpx.WriteJSON(w, http.StatusOK, res)
	}
}
