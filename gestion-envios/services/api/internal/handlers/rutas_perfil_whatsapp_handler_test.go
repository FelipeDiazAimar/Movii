package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/middleware"
	"movii/api/internal/platform/geo"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// ---------- WhatsappHandler (con dobles, sin base ni red) ----------

type waFalso struct {
	estado     whatsapp.Estado
	iniciada   bool
	errIniciar error
	errDesvinc error
}

func (f *waFalso) Enviar(context.Context, string, string) error { return nil }
func (f *waFalso) Estado() whatsapp.Estado                      { return f.estado }
func (f *waFalso) IniciarVinculacion(context.Context) error {
	f.iniciada = true
	f.estado.QR = "2@codigo-de-prueba"
	return f.errIniciar
}
func (f *waFalso) Desvincular(context.Context) error { return f.errDesvinc }

type usuariosFalso struct {
	err    error
	ultimo string
}

func (u *usuariosFalso) ActualizarTelefono(_ context.Context, _ string, tel string) error {
	u.ultimo = tel
	return u.err
}

type avisosFalso struct {
	lista []repository.NotificacionEnvio
	err   error
}

func (a avisosFalso) NotificacionesDeEnvio(context.Context, string) ([]repository.NotificacionEnvio, error) {
	return a.lista, a.err
}

func TestWhatsapp_Estado(t *testing.T) {
	t.Run("sin vincular pide un QR y lo devuelve como imagen", func(t *testing.T) {
		wa := &waFalso{estado: whatsapp.Estado{Habilitado: true}}
		h := NewWhatsappHandler(wa, &usuariosFalso{}, avisosFalso{})
		rec := httptest.NewRecorder()
		h.Estado(rec, httptest.NewRequest(http.MethodGet, "/admin/whatsapp/estado", nil))
		require.Equal(t, http.StatusOK, rec.Code)
		require.True(t, wa.iniciada)
		var resp map[string]any
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
		require.True(t, strings.HasPrefix(resp["qr_imagen"].(string), "data:image/png;base64,"))
	})

	t.Run("falla al iniciar la vinculacion da 502", func(t *testing.T) {
		wa := &waFalso{estado: whatsapp.Estado{Habilitado: true}, errIniciar: errors.New("sin red")}
		h := NewWhatsappHandler(wa, &usuariosFalso{}, avisosFalso{})
		rec := httptest.NewRecorder()
		h.Estado(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		require.Equal(t, http.StatusBadGateway, rec.Code)
		require.Equal(t, "whatsapp_error", codigoDe(t, rec))
	})

	t.Run("ya vinculado no pide QR", func(t *testing.T) {
		wa := &waFalso{estado: whatsapp.Estado{Habilitado: true, Vinculado: true, Conectado: true, Numero: "5493564000000"}}
		h := NewWhatsappHandler(wa, &usuariosFalso{}, avisosFalso{})
		rec := httptest.NewRecorder()
		h.Estado(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		require.Equal(t, http.StatusOK, rec.Code)
		require.False(t, wa.iniciada)
		require.NotContains(t, rec.Body.String(), "qr_imagen")
	})
}

func TestWhatsapp_Desvincular(t *testing.T) {
	rec := httptest.NewRecorder()
	NewWhatsappHandler(&waFalso{}, &usuariosFalso{}, avisosFalso{}).Desvincular(rec, httptest.NewRequest(http.MethodPost, "/", nil))
	require.Equal(t, http.StatusNoContent, rec.Code)

	rec = httptest.NewRecorder()
	NewWhatsappHandler(&waFalso{errDesvinc: errors.New("boom")}, &usuariosFalso{}, avisosFalso{}).Desvincular(rec, httptest.NewRequest(http.MethodPost, "/", nil))
	require.Equal(t, http.StatusBadGateway, rec.Code)
}

func TestWhatsapp_ActualizarTelefono(t *testing.T) {
	put := func(u *usuariosFalso, body string) *httptest.ResponseRecorder {
		req := withURLParam(httptest.NewRequest(http.MethodPut, "/users/1/telefono", strings.NewReader(body)), "id", "1")
		rec := httptest.NewRecorder()
		NewWhatsappHandler(&waFalso{}, u, avisosFalso{}).ActualizarTelefono(rec, req)
		return rec
	}

	require.Equal(t, http.StatusBadRequest, put(&usuariosFalso{}, "no es json").Code)
	require.Equal(t, http.StatusBadRequest, put(&usuariosFalso{}, `{"telefono":"123"}`).Code)

	u := &usuariosFalso{}
	rec := put(u, `{"telefono":"03564 15 123456"}`)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NotEmpty(t, u.ultimo)

	u = &usuariosFalso{}
	require.Equal(t, http.StatusOK, put(u, `{"telefono":""}`).Code)
	require.Equal(t, "", u.ultimo, "vacío quita el teléfono")

	require.Equal(t, http.StatusNotFound, put(&usuariosFalso{err: repository.ErrNoEncontrado}, `{"telefono":""}`).Code)
	require.Equal(t, http.StatusConflict, put(&usuariosFalso{err: repository.ErrTelefonoDuplicado}, `{"telefono":""}`).Code)
	require.Equal(t, http.StatusInternalServerError, put(&usuariosFalso{err: errors.New("db")}, `{"telefono":""}`).Code)
}

func TestWhatsapp_AvisosEnvio(t *testing.T) {
	get := func(a avisosFalso) *httptest.ResponseRecorder {
		req := withURLParam(httptest.NewRequest(http.MethodGet, "/envios/1/avisos", nil), "id", "1")
		rec := httptest.NewRecorder()
		NewWhatsappHandler(&waFalso{}, &usuariosFalso{}, a).AvisosEnvio(rec, req)
		return rec
	}
	rec := get(avisosFalso{lista: []repository.NotificacionEnvio{{Tipo: "entregado", Estado: "enviado", Mensaje: "ok", CreatedAt: time.Now()}}})
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), "entregado")
	require.Equal(t, http.StatusInternalServerError, get(avisosFalso{err: errors.New("db")}).Code)
}

// ---------- RutaHandler: Create/List/Update y validación de recomendación ----------

func TestRutaHandler_CreateValidaciones(t *testing.T) {
	h, _, repartidorID := nuevoRutaHandlerDeTest(t)

	rec := httptest.NewRecorder()
	h.Create(rec, httptest.NewRequest(http.MethodPost, "/rutas", strings.NewReader("no es json")))
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "body_invalido", codigoDe(t, rec))

	body, _ := json.Marshal(map[string]string{"nombre": "Sin repartidor", "zona": "Centro"})
	rec = httptest.NewRecorder()
	h.Create(rec, httptest.NewRequest(http.MethodPost, "/rutas", bytes.NewReader(body)))
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "campos_obligatorios", codigoDe(t, rec))
	_ = repartidorID
}

func TestRutaHandler_ListYUpdate(t *testing.T) {
	h, pool, repartidorID := nuevoRutaHandlerDeTest(t)
	ctx := context.Background()
	fecha := "2031-01-15"

	ruta, err := repository.NewRutaRepo(pool).Create(ctx, domain.Ruta{Nombre: "Lista Test", Zona: "Centro", Fecha: fecha, RepartidorID: repartidorID})
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID) })

	// List filtra por fecha y devuelve array.
	rec := httptest.NewRecorder()
	h.List(rec, httptest.NewRequest(http.MethodGet, "/rutas?fecha="+fecha, nil))
	require.Equal(t, http.StatusOK, rec.Code)
	var lista []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &lista))
	require.Len(t, lista, 1)
	require.Equal(t, "Lista Test", lista[0]["nombre"])

	rec = httptest.NewRecorder()
	h.List(rec, httptest.NewRequest(http.MethodGet, "/rutas?fecha=2031-01-16", nil))
	require.Equal(t, http.StatusOK, rec.Code)
	require.JSONEq(t, "[]", rec.Body.String(), "sin rutas ese día debe ser [] y no null")

	put := func(id, body string) *httptest.ResponseRecorder {
		req := withURLParam(httptest.NewRequest(http.MethodPut, "/rutas/"+id, strings.NewReader(body)), "id", id)
		rec := httptest.NewRecorder()
		h.Update(rec, req)
		return rec
	}
	ok, _ := json.Marshal(map[string]string{"nombre": "Editada", "zona": "Norte", "fecha": fecha, "repartidor_id": repartidorID})
	rec = put(ruta.ID, string(ok))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), "Editada")

	require.Equal(t, http.StatusBadRequest, put(ruta.ID, "no es json").Code)
	require.Equal(t, http.StatusBadRequest, put(ruta.ID, `{"nombre":"x","zona":"y"}`).Code)
	require.Equal(t, http.StatusNotFound, put(idInexistente, string(ok)).Code)

	_, err = pool.Exec(ctx, "UPDATE rutas SET estado = 'en_curso' WHERE id = $1", ruta.ID)
	require.NoError(t, err)
	rec = put(ruta.ID, string(ok))
	require.Equal(t, http.StatusConflict, rec.Code)
	require.Equal(t, "ruta_no_editable", codigoDe(t, rec))
}

// Dobles de la recomendación por distancia (T4): mapa y repos en memoria.
type recoRutasFalso struct{ otros []domain.Envio }

func (recoRutasFalso) GetByID(context.Context, string) (domain.Ruta, error) {
	return domain.Ruta{ID: "r"}, nil
}
func (f recoRutasFalso) EnviosDeRuta(context.Context, string) ([]domain.Envio, error) {
	return f.otros, nil
}

type recoGeoFalso struct{}

func (recoGeoFalso) Direccion(context.Context, string) (repository.DireccionDestinatario, error) {
	return repository.DireccionDestinatario{Calle: "Mitre", Numero: "250", Localidad: "San Francisco"}, nil
}
func (recoGeoFalso) DestinatarioDeEnvio(_ context.Context, envioID string) (string, error) {
	return "dest-" + envioID, nil
}

type proveedorFalso struct {
	confianza float64
	km        [][]float64
}

func (p proveedorFalso) Geocodificar(context.Context, string, string, string, string) (geo.Punto, float64, error) {
	return geo.Punto{Lat: -31.43, Lng: -62.08}, p.confianza, nil
}
func (p proveedorFalso) Matriz(context.Context, []geo.Punto) (geo.Matriz, error) {
	return geo.Matriz{KM: p.km}, nil
}

func TestRutaHandler_AsignarConRecomendacion(t *testing.T) {
	h, pool, repartidorID := nuevoRutaHandlerDeTest(t)
	ctx := context.Background()
	hoy := services.FechaAR(time.Now())

	nueva := func(t *testing.T) (rutaID, envioID string) {
		t.Helper()
		ruta, err := repository.NewRutaRepo(pool).Create(ctx, domain.Ruta{Nombre: "Reco Test", Zona: "Centro", Fecha: hoy, RepartidorID: repartidorID})
		require.NoError(t, err)
		t.Cleanup(func() {
			_, _ = pool.Exec(ctx, "UPDATE envios SET ruta_id = NULL, estado = 'pendiente' WHERE ruta_id = $1", ruta.ID)
			_, _ = pool.Exec(ctx, "DELETE FROM rutas WHERE id = $1", ruta.ID)
		})
		return ruta.ID, crearEnvioPendienteDeTest(t, pool)
	}
	asignar := func(rutaID string, body map[string]any) *httptest.ResponseRecorder {
		b, _ := json.Marshal(body)
		req := withURLParam(httptest.NewRequest(http.MethodPost, "/rutas/"+rutaID+"/envios", bytes.NewReader(b)), "id", rutaID)
		rec := httptest.NewRecorder()
		h.AsignarEnvios(rec, req)
		return rec
	}
	// Una parada previa en la ruta + el envío nuevo: 20 km de desvío.
	lejos := [][]float64{{0, 2, 30}, {2, 0, 20}, {30, 20, 0}}
	paradaPrevia := []domain.Envio{{ID: "otro", DestinatarioID: "dest-otro"}}

	t.Run("no conviene sin forzar da 409 y no asigna", func(t *testing.T) {
		h.ConRecomendacion(services.NewRecomendacionService(recoRutasFalso{otros: paradaPrevia}, recoGeoFalso{}, proveedorFalso{confianza: 1, km: lejos}, 2, 5))
		rutaID, envioID := nueva(t)
		rec := asignar(rutaID, map[string]any{"envio_ids": []string{envioID}})
		require.Equal(t, http.StatusConflict, rec.Code)
		require.Equal(t, "no_conviene", codigoDe(t, rec))
		var estado string
		require.NoError(t, pool.QueryRow(ctx, "SELECT estado::text FROM envios WHERE id = $1", envioID).Scan(&estado))
		require.Equal(t, "pendiente", estado)
	})

	t.Run("no conviene pero forzado asigna", func(t *testing.T) {
		h.ConRecomendacion(services.NewRecomendacionService(recoRutasFalso{otros: paradaPrevia}, recoGeoFalso{}, proveedorFalso{confianza: 1, km: lejos}, 2, 5))
		rutaID, envioID := nueva(t)
		rec := asignar(rutaID, map[string]any{"envio_ids": []string{envioID}, "forzar": true})
		require.Equal(t, http.StatusOK, rec.Code)
		require.Contains(t, rec.Body.String(), `"asignados":1`)
	})

	t.Run("direccion que no se ubica da 422", func(t *testing.T) {
		h.ConRecomendacion(services.NewRecomendacionService(recoRutasFalso{}, recoGeoFalso{}, proveedorFalso{confianza: 0.1}, 2, 5))
		rutaID, envioID := nueva(t)
		rec := asignar(rutaID, map[string]any{"envio_ids": []string{envioID}})
		require.Equal(t, http.StatusUnprocessableEntity, rec.Code)
		require.Equal(t, "direccion_invalida", codigoDe(t, rec))
	})

	t.Run("cerca de la ruta conviene y asigna sin forzar", func(t *testing.T) {
		cerca := [][]float64{{0, 2, 3}, {2, 0, 1}, {3, 1, 0}}
		h.ConRecomendacion(services.NewRecomendacionService(recoRutasFalso{otros: paradaPrevia}, recoGeoFalso{}, proveedorFalso{confianza: 1, km: cerca}, 2, 5))
		rutaID, envioID := nueva(t)
		require.Equal(t, http.StatusOK, asignar(rutaID, map[string]any{"envio_ids": []string{envioID}}).Code)
	})

	h.ConRecomendacion(nil)
}

// ---------- RepartidorHandler.Perfil ----------

func TestRepartidorHandler_Perfil(t *testing.T) {
	_, pool, repartidorID := nuevoRutaHandlerDeTest(t)
	get := func(h *RepartidorHandler, claims *middleware.Claims) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/repartidor/perfil", nil)
		if claims != nil {
			req = req.WithContext(middleware.ContextWithClaims(req.Context(), *claims))
		}
		rec := httptest.NewRecorder()
		h.Perfil(rec, req)
		return rec
	}
	sinPerfil := NewRepartidorHandler(nil)
	conPerfil := NewRepartidorHandler(nil).ConPerfil(repository.NewPerfilRepo(pool))

	require.Equal(t, http.StatusUnauthorized, get(conPerfil, nil).Code)
	rec := get(sinPerfil, &middleware.Claims{UsuarioID: repartidorID, Rol: domain.RolRepartidor})
	require.Equal(t, http.StatusNotFound, rec.Code)
	require.Equal(t, "no_disponible", codigoDe(t, rec))

	rec = get(conPerfil, &middleware.Claims{UsuarioID: repartidorID, Rol: domain.RolRepartidor})
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"historico"`)

	rec = get(conPerfil, &middleware.Claims{UsuarioID: idInexistente, Rol: domain.RolRepartidor})
	require.Equal(t, http.StatusNotFound, rec.Code)
	require.Equal(t, "no_encontrado", codigoDe(t, rec))
}
