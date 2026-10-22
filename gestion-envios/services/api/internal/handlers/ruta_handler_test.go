package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

func nuevoRutaHandlerDeTest(t *testing.T) (*RutaHandler, *pgxpool.Pool, string) {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada; ver Task 0 del plan de HU-01")
	}
	pool, err := pgxpool.New(context.Background(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	var repartidorID string
	err = pool.QueryRow(context.Background(), "SELECT id FROM usuarios WHERE email = 'repartidor@movii.demo'").Scan(&repartidorID)
	require.NoError(t, err)

	rutaRepo := repository.NewRutaRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	h := NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo))
	return h, pool, repartidorID
}

// withURLParam agrega un parámetro de ruta al request. Si el request ya
// tiene un RouteContext (por una llamada anterior a withURLParam), reusa el
// mismo en vez de crear uno nuevo — un chi.NewRouteContext() nuevo pisaría
// los parámetros ya seteados.
func withURLParam(req *http.Request, key, value string) *http.Request {
	rctx := chi.RouteContext(req.Context())
	if rctx == nil {
		rctx = chi.NewRouteContext()
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	}
	rctx.URLParams.Add(key, value)
	return req
}

// crearEnvioPendienteDeTest crea un envío pendiente completo (con su
// remitente y destinatario) para usar en pruebas de asignación. Cada
// paquete de tests define su propia copia local.
func crearEnvioPendienteDeTest(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	rem, err := repository.CreateRemitente(ctx, pool, domain.Remitente{Nombre: "Rem"})
	require.NoError(t, err)
	dest, err := repository.CreateDestinatario(ctx, pool, domain.Destinatario{
		Nombre: "Dest", Calle: "Calle", Numero: "1", Localidad: "San Francisco", CodigoPostal: "X2400",
	})
	require.NoError(t, err)
	envioRepo := repository.NewEnvioRepo(pool)
	envio, err := envioRepo.Create(ctx, pool, domain.Envio{
		CodigoGuia: "MOV-HTEST-" + time.Now().Format("150405.000"), Peso: 1, Tamano: domain.TamanoChico,
		RemitenteID: rem.ID, DestinatarioID: dest.ID,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM envios WHERE id = $1", envio.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM remitentes WHERE id = $1", rem.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM destinatarios WHERE id = $1", dest.ID)
	})
	return envio.ID
}

func TestRutaHandler_CreateDevuelve201(t *testing.T) {
	h, pool, repartidorID := nuevoRutaHandlerDeTest(t)

	body, _ := json.Marshal(map[string]string{
		"nombre": "Ruta Handler Test", "zona": "Centro", "fecha": "2026-09-20", "repartidor_id": repartidorID,
	})
	req := httptest.NewRequest(http.MethodPost, "/rutas", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), "DELETE FROM rutas WHERE id = $1", resp["id"]) })
}

func TestRutaHandler_DetailDevuelveConteosYTotales(t *testing.T) {
	h, pool, repartidorID := nuevoRutaHandlerDeTest(t)
	ctx := context.Background()

	rutaRepo := repository.NewRutaRepo(pool)
	ruta, err := rutaRepo.Create(ctx, domain.Ruta{Nombre: "Ruta Detail Test", Zona: "Centro", Fecha: "2026-09-21", RepartidorID: repartidorID})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	req := httptest.NewRequest(http.MethodGet, "/rutas/"+ruta.ID, nil)
	req = withURLParam(req, "id", ruta.ID)
	rec := httptest.NewRecorder()

	h.Detail(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Equal(t, float64(0), resp["cantidad_envios"])
}

func TestRutaHandler_AsignarYDesasignarEnvios(t *testing.T) {
	h, pool, repartidorID := nuevoRutaHandlerDeTest(t)
	ctx := context.Background()

	rutaRepo := repository.NewRutaRepo(pool)
	ruta, err := rutaRepo.Create(ctx, domain.Ruta{Nombre: "Ruta Asig Handler", Zona: "Centro", Fecha: time.Now().UTC().Format("2006-01-02"), RepartidorID: repartidorID})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	envioID := crearEnvioPendienteDeTest(t, pool)

	body, _ := json.Marshal(map[string]any{"envio_ids": []string{envioID}})
	req := httptest.NewRequest(http.MethodPost, "/rutas/"+ruta.ID+"/envios", bytes.NewReader(body))
	req = withURLParam(req, "id", ruta.ID)
	rec := httptest.NewRecorder()

	h.AsignarEnvios(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	delReq := httptest.NewRequest(http.MethodDelete, "/rutas/"+ruta.ID+"/envios/"+envioID, nil)
	delReq = withURLParam(delReq, "id", ruta.ID)
	delReq = withURLParam(delReq, "envioId", envioID)
	delRec := httptest.NewRecorder()

	h.DesasignarEnvio(delRec, delReq)
	require.Equal(t, http.StatusOK, delRec.Code)
}
