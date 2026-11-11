package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"movii/api/internal/domain"
	"movii/api/internal/middleware"
	httpx "movii/api/internal/platform/http"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// PedidosHandler expone "Mis pedidos" de la app del repartidor: todos sus
// envíos (viejos, de hoy y próximos), búsqueda y detalle completo por código.
// El repartidor siempre sale del JWT.
type PedidosHandler struct {
	envios *repository.EnvioRepo
	svc    *services.EnvioService
}

// NewPedidosHandler crea un PedidosHandler.
func NewPedidosHandler(envios *repository.EnvioRepo, svc *services.EnvioService) *PedidosHandler {
	return &PedidosHandler{envios: envios, svc: svc}
}

type pedidosResponse struct {
	Hoy     string                   `json:"hoy"`
	Periodo string                   `json:"periodo"`
	Conteo  repository.ConteoPedidos `json:"conteo"`
	Pedidos []domain.EnvioDelDia     `json:"pedidos"`
}

// Listar maneja GET /repartidor/pedidos?periodo=viejos|hoy|proximos&q=.
func (h *PedidosHandler) Listar(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}
	periodo := r.URL.Query().Get("periodo")
	switch periodo {
	case "", repository.PedidosViejos, repository.PedidosHoy, repository.PedidosProximos:
	default:
		httpx.WriteError(w, http.StatusBadRequest, "periodo_invalido", "el período debe ser viejos, hoy o proximos")
		return
	}
	hoy := services.FechaAR(time.Now())
	conteo, err := h.envios.ContarPedidos(r.Context(), claims.UsuarioID, hoy)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudieron obtener los pedidos")
		return
	}
	lista, err := h.envios.ListarPedidos(r.Context(), claims.UsuarioID, hoy, periodo, r.URL.Query().Get("q"))
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudieron obtener los pedidos")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, pedidosResponse{Hoy: hoy, Periodo: periodo, Conteo: conteo, Pedidos: lista})
}

type pedidoDetalleResponse struct {
	domain.EnvioDetalle
	Remitente domain.Remitente `json:"remitente"`
}

// PorCodigo maneja GET /repartidor/pedidos/{codigo}: todos los datos del envío,
// solo si es de una ruta del repartidor logueado.
func (h *PedidosHandler) PorCodigo(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.ClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "sin_token", "falta autenticación")
		return
	}
	id, err := h.envios.IDPedidoDeRepartidor(r.Context(), claims.UsuarioID, strings.TrimSpace(chi.URLParam(r, "codigo")))
	var det domain.EnvioDetalle
	if err == nil {
		det, err = h.svc.GetByID(r.Context(), id)
	}
	var rem domain.Remitente
	if err == nil {
		rem, err = h.envios.RemitenteDe(r.Context(), id)
		if errors.Is(err, repository.ErrNoEncontrado) {
			err = nil // sin remitente: se muestra igual
		}
	}
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, pedidoDetalleResponse{EnvioDetalle: det, Remitente: rem})
	case errors.Is(err, repository.ErrNoEncontrado):
		httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "no tenés ningún pedido con ese código")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo obtener el pedido")
	}
}
