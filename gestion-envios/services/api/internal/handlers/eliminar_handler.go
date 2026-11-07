package handlers

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
	"movii/api/internal/middleware"
	httpx "movii/api/internal/platform/http"
)

// EliminarHandler implementa los borrados físicos (T3). Solo admin: el router
// lo restringe; acá van las reglas de negocio de cada borrado.
type EliminarHandler struct{ pool *pgxpool.Pool }

// NewEliminarHandler crea un EliminarHandler.
func NewEliminarHandler(pool *pgxpool.Pool) *EliminarHandler { return &EliminarHandler{pool: pool} }

func bloqueado(w http.ResponseWriter, code, msg string) {
	httpx.WriteError(w, http.StatusLocked, code, msg)
}

// fkViolada indica que otra tabla todavía referencia al registro.
func fkViolada(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

// Ruta maneja DELETE /rutas/{id}: no se borra una ruta en curso. Los envíos
// "asignado" vuelven a pendiente; si quedan otros (en camino, entregados) el
// FK frena el borrado.
func (h *EliminarHandler) Ruta(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo eliminar la ruta")
		return
	}
	defer tx.Rollback(r.Context())

	var estado string
	if err := tx.QueryRow(r.Context(), `SELECT estado::text FROM rutas WHERE id = $1 FOR UPDATE`, id).Scan(&estado); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "la ruta no existe")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo eliminar la ruta")
		return
	}
	if estado == string(domain.EstadoRutaEnCurso) {
		bloqueado(w, "ruta_en_curso", "no se puede eliminar una ruta en curso")
		return
	}
	_, err = tx.Exec(r.Context(), `UPDATE envios SET ruta_id = NULL, estado = 'pendiente' WHERE ruta_id = $1 AND estado = 'asignado'`, id)
	if err == nil {
		_, err = tx.Exec(r.Context(), `DELETE FROM rutas WHERE id = $1`, id)
	}
	switch {
	case fkViolada(err):
		bloqueado(w, "ruta_con_envios", "la ruta tiene envíos en camino o entregados")
	case err != nil || tx.Commit(r.Context()) != nil:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo eliminar la ruta")
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

// Envio maneja DELETE /envios/{id}: solo envíos sin ruta y que no salieron a reparto.
func (h *EliminarHandler) Envio(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tag, err := h.pool.Exec(r.Context(),
		`DELETE FROM envios WHERE id = $1 AND ruta_id IS NULL AND estado NOT IN ('en_camino', 'entregado')`, id)
	switch {
	case fkViolada(err):
		bloqueado(w, "envio_no_eliminable", "el envío tiene registros asociados")
	case err != nil:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo eliminar el envío")
	case tag.RowsAffected() == 1:
		w.WriteHeader(http.StatusNoContent)
	default:
		var existe bool
		_ = h.pool.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM envios WHERE id = $1)`, id).Scan(&existe)
		if !existe {
			httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el envío no existe")
			return
		}
		bloqueado(w, "envio_no_eliminable", "solo se pueden eliminar envíos sin ruta y que no estén en camino ni entregados")
	}
}

// Usuario maneja DELETE /users/{id}: no a uno mismo ni al último admin.
func (h *EliminarHandler) Usuario(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if c, ok := middleware.ClaimsFromContext(r.Context()); ok && c.UsuarioID == id {
		bloqueado(w, "auto_borrado", "no podés eliminar tu propio usuario")
		return
	}
	tag, err := h.pool.Exec(r.Context(), `
		DELETE FROM usuarios u WHERE u.id = $1
		  AND (u.rol <> 'admin' OR (SELECT count(*) FROM usuarios WHERE rol = 'admin') > 1)`, id)
	switch {
	case fkViolada(err):
		bloqueado(w, "usuario_con_registros", "el usuario tiene rutas asignadas; reasignalas antes de eliminarlo")
	case err != nil:
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo eliminar el usuario")
	case tag.RowsAffected() == 1:
		w.WriteHeader(http.StatusNoContent)
	default:
		var existe bool
		_ = h.pool.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM usuarios WHERE id = $1)`, id).Scan(&existe)
		if !existe {
			httpx.WriteError(w, http.StatusNotFound, "no_encontrado", "el usuario no existe")
			return
		}
		bloqueado(w, "ultimo_admin", "no se puede eliminar al último admin")
	}
}
