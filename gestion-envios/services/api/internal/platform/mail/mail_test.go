package mail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResend_ArmaElPedidoYDetectaErrores(t *testing.T) {
	var recibido map[string]any
	estado := http.StatusOK
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer re_test", r.Header.Get("Authorization"))
		require.NoError(t, json.NewDecoder(r.Body).Decode(&recibido))
		w.WriteHeader(estado)
	}))
	defer srv.Close()

	m := NewResend("re_test", "Movii <no-reply@movii.demo>")
	m.URL = srv.URL
	require.NoError(t, m.Enviar(context.Background(), "ana@movii.demo", "Código", "123456"))
	require.Equal(t, "Movii <no-reply@movii.demo>", recibido["from"])
	require.Equal(t, []any{"ana@movii.demo"}, recibido["to"])
	require.Equal(t, "123456", recibido["text"])

	estado = http.StatusForbidden
	require.Error(t, m.Enviar(context.Background(), "ana@movii.demo", "Código", "123456"))
}
