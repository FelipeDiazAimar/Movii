package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"movii/api/internal/middleware"
	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// OperacionesHandler expone HU-11 (panel en vivo) y HU-12 (mapa de ruta).
type OperacionesHandler struct {
	svc *services.OperacionesService
}

// NewOperacionesHandler crea un OperacionesHandler.
func NewOperacionesHandler(svc *services.OperacionesService) *OperacionesHandler {
	return &OperacionesHandler{svc: svc}
}

// Dashboard maneja GET /operaciones/dashboard?fecha=YYYY-MM-DD (default hoy UTC).
func (h *OperacionesHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	d, err := h.svc.Dashboard(r.Context(), r.URL.Query().Get("fecha"))
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, d)
	case errors.Is(err, services.ErrFechaReporteInvalida):
		httpx.WriteError(w, http.StatusBadRequest, "fecha_invalida", "la fecha debe tener formato YYYY-MM-DD")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener el panel de operaciones")
	}
}

// MapaRuta maneja GET /rutas/{id}/mapa. El repartidor solo ve sus rutas (ajena → 404).
func (h *OperacionesHandler) MapaRuta(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.ClaimsFromContext(r.Context())
	m, err := h.svc.MapaRuta(r.Context(), chi.URLParam(r, "id"), claims.UsuarioID, claims.Rol)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, m)
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "la ruta no existe")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener el mapa de la ruta")
	}
}

// ReportesHandler expone HU-13 (envíos y CSV), HU-14 (ranking) y HU-15 (incidencias).
type ReportesHandler struct {
	svc *services.ReportesService
}

// NewReportesHandler crea un ReportesHandler.
func NewReportesHandler(svc *services.ReportesService) *ReportesHandler {
	return &ReportesHandler{svc: svc}
}

func escribirErrorReporte(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, services.ErrPeriodoInvalido):
		httpx.WriteError(w, http.StatusBadRequest, "periodo_invalido", "desde y hasta son obligatorios (YYYY-MM-DD), desde no puede ser posterior a hasta y el período no puede superar 366 días")
	case errors.Is(err, services.ErrEstadoReporteInvalido):
		httpx.WriteError(w, http.StatusBadRequest, "estado_invalido", "el estado indicado no existe")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", fallback)
	}
}

// Envios maneja GET /reportes/envios?desde=&hasta=&estado=&formato=json|csv.
func (h *ReportesHandler) Envios(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	desde, hasta, estado := q.Get("desde"), q.Get("hasta"), q.Get("estado")

	switch q.Get("formato") {
	case "", "json":
		rep, err := h.svc.ReporteEnvios(r.Context(), desde, hasta, estado)
		if err != nil {
			escribirErrorReporte(w, err, "no se pudo generar el reporte de envíos")
			return
		}
		httpx.WriteJSON(w, http.StatusOK, rep)
	case "csv":
		// Validar antes de escribir: una vez enviados los headers ya no se puede responder un 400.
		if _, err := services.ValidarPeriodo(desde, hasta); err != nil {
			escribirErrorReporte(w, err, "")
			return
		}
		if err := services.ValidarEstadoReporte(estado); err != nil {
			escribirErrorReporte(w, err, "")
			return
		}
		nombre := "reporte_envios_" + strings.ReplaceAll(desde, "-", "") + "_" + strings.ReplaceAll(hasta, "-", "") + ".csv"
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="`+nombre+`"`)
		w.WriteHeader(http.StatusOK)
		// shortcut: si la base falla a mitad del streaming el archivo queda truncado (el 200 ya salió);
		// alcanza mientras los reportes sean chicos, pasar a generar en un buffer si crecen.
		_ = h.svc.ExportarEnviosCSV(r.Context(), w, desde, hasta, estado)
	default:
		httpx.WriteError(w, http.StatusBadRequest, "formato_invalido", "el formato debe ser json o csv")
	}
}

// Repartidores maneja GET /reportes/repartidores?desde=&hasta= (HU-14).
func (h *ReportesHandler) Repartidores(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	rep, err := h.svc.RankingRepartidores(r.Context(), q.Get("desde"), q.Get("hasta"))
	if err != nil {
		escribirErrorReporte(w, err, "no se pudo generar el ranking de repartidores")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, rep)
}

// Incidencias maneja GET /reportes/incidencias?desde=&hasta= (HU-15).
func (h *ReportesHandler) Incidencias(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	rep, err := h.svc.Incidencias(r.Context(), q.Get("desde"), q.Get("hasta"))
	if err != nil {
		escribirErrorReporte(w, err, "no se pudo generar el reporte de incidencias")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, rep)
}
