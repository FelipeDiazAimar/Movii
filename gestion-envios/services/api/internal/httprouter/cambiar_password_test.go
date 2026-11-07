package httprouter

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
)

func TestCambiarPassword_DesdeElPerfil(t *testing.T) {
	e := nuevoEntorno(t, nil)
	_, err := e.auth.Register(context.Background(), "Diego", "diego@movii.demo", "Movii2026!", domain.RolRepartidor)
	require.NoError(t, err)
	rec, out := e.post(t, "/auth/login", map[string]string{"email": "diego@movii.demo", "password": "Movii2026!"})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	token := out["token"].(string)

	cambiar := func(tok, actual, nueva string) (*httptest.ResponseRecorder, string) {
		b, _ := json.Marshal(map[string]string{"actual": actual, "nueva": nueva})
		req := httptest.NewRequest(http.MethodPost, "/auth/cambiar-password", bytes.NewReader(b))
		if tok != "" {
			req.Header.Set("Authorization", "Bearer "+tok)
		}
		w := httptest.NewRecorder()
		e.h.ServeHTTP(w, req)
		var o map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &o)
		return w, codigoDeError(o)
	}

	w, _ := cambiar("", "Movii2026!", "Nueva2027!")
	require.Equal(t, http.StatusUnauthorized, w.Code, "sin sesión no se puede")

	w, cod := cambiar(token, "otra", "Nueva2027!")
	require.Equal(t, "password_actual_incorrecta", cod)
	w, cod = cambiar(token, "Movii2026!", "corta")
	require.Equal(t, "password_debil", cod)
	w, cod = cambiar(token, "Movii2026!", "Movii2026!")
	require.Equal(t, "password_repetida", cod)

	w, _ = cambiar(token, "Movii2026!", "Nueva2027!")
	require.Equal(t, http.StatusNoContent, w.Code, w.Body.String())

	rec, _ = e.post(t, "/auth/login", map[string]string{"email": "diego@movii.demo", "password": "Movii2026!"})
	require.Equal(t, http.StatusUnauthorized, rec.Code, "la vieja ya no sirve")
	rec, _ = e.post(t, "/auth/login", map[string]string{"email": "diego@movii.demo", "password": "Nueva2027!"})
	require.Equal(t, http.StatusOK, rec.Code, "la nueva sí")
}
