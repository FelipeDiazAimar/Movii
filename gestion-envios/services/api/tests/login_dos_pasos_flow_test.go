package tests

// E2E de HU-16: login en dos pasos. Con celular cargado, la contraseña
// correcta no devuelve el token sino un desafío; el código de 6 dígitos llega
// por WhatsApp (acá, un Sender falso que lo captura) y recién con él se entra.

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"regexp"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"movii/api/internal/handlers"
	"movii/api/internal/httprouter"
	"movii/api/internal/platform/db"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
	"movii/api/internal/services"
	_ "movii/api/internal/testenv"
)

// whatsappDeTest guarda el último mensaje enviado a cada número.
type whatsappDeTest struct {
	mu       sync.Mutex
	mensajes map[string]string
}

func (w *whatsappDeTest) Enviar(_ context.Context, tel, texto string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.mensajes[tel] = texto
	return nil
}
func (w *whatsappDeTest) Estado() whatsapp.Estado {
	return whatsapp.Estado{Habilitado: true, Vinculado: true}
}

var codigoEnMensaje = regexp.MustCompile("```(\\d{6})```")

func TestFlujoCompleto_LoginEnDosPasos(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL no está seteada")
	}
	pool, err := db.New(t.Context(), url)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	ctx := t.Context()

	const email, tel, pass = "e2e-2fa@movii.demo", "5493564999777", "Clave2026!"
	limpiar := func(c context.Context) {
		_, _ = pool.Exec(c, "DELETE FROM codigos_otp WHERE telefono = $1", tel)
		_, _ = pool.Exec(c, "DELETE FROM usuarios WHERE email = $1", email)
	}
	limpiar(ctx)
	t.Cleanup(func() { limpiar(context.Background()) })
	hash, err := bcrypt.GenerateFromPassword([]byte(pass), 10)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `INSERT INTO usuarios (nombre, email, password_hash, rol, telefono) VALUES ('E2E 2FA', $1, $2, 'operador', $3)`, email, string(hash), tel)
	require.NoError(t, err)

	usuarioRepo := repository.NewUsuarioRepo(pool)
	envioRepo := repository.NewEnvioRepo(pool)
	eventoRepo := repository.NewEventoRepo(pool)
	confRepo := repository.NewConfirmacionRepo(pool)
	rutaRepo := repository.NewRutaRepo(pool)
	wa := &whatsappDeTest{mensajes: map[string]string{}}
	auth := services.NewAuthService(usuarioRepo, "secreto-de-test")
	otp := services.NewOTPService(repository.NewWhatsappRepo(pool), usuarioRepo, auth, wa, "secreto-de-test")
	router := httprouter.New(httprouter.Deps{
		CORSOrigins:       []string{"*"},
		JWTSecret:         "secreto-de-test",
		AuthHandler:       handlers.NewAuthHandler(auth).ConSegundoFactor(otp),
		UsuariosHandler:   handlers.NewUsuariosHandler(usuarioRepo),
		EnvioHandler:      handlers.NewEnvioHandler(services.NewEnvioService(pool, envioRepo, eventoRepo, confRepo)),
		RutaHandler:       handlers.NewRutaHandler(services.NewRutaService(rutaRepo), services.NewAsignacionService(rutaRepo, envioRepo)),
		RepartidorHandler: handlers.NewRepartidorHandler(services.NewRepartidorService(envioRepo)),
		EstadoHandler:     handlers.NewEstadoHandler(services.NewEstadoService(pool, envioRepo, eventoRepo, confRepo)),
		TrackingHandler:   handlers.NewTrackingHandler(services.NewTrackingService(repository.NewTrackingRepo(pool))),
	})
	var resp struct {
		Token          string `json:"token"`
		RequiereCodigo bool   `json:"requiere_codigo"`
		DesafioID      string `json:"desafio_id"`
		Telefono       string `json:"telefono"`
	}
	leer := func(rec interface{ Result() *http.Response }) {
		resp.Token, resp.RequiereCodigo, resp.DesafioID = "", false, ""
		require.NoError(t, json.NewDecoder(rec.Result().Body).Decode(&resp))
	}

	// Contraseña incorrecta: no se manda nada.
	rec := pedidoSeguimientoDeTest(t, router, http.MethodPost, "/auth/login", "", map[string]string{"email": email, "password": "mala"})
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	require.Empty(t, wa.mensajes)

	// Paso 1: contraseña correcta → desafío, sin token; el código llega por WhatsApp.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPost, "/auth/login", "", map[string]string{"email": email, "password": pass})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	leer(rec)
	require.True(t, resp.RequiereCodigo)
	require.Empty(t, resp.Token, "sin el código no hay token")
	require.Equal(t, "+54 9 3564 ••••77", resp.Telefono)
	m := codigoEnMensaje.FindStringSubmatch(wa.mensajes[tel])
	require.Len(t, m, 2, "el WhatsApp trae el código: %q", wa.mensajes[tel])
	desafio, codigo := resp.DesafioID, m[1]

	// Código incorrecto → 401.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPost, "/auth/login/verificar", "", map[string]string{"desafio_id": desafio, "codigo": "000000"})
	if codigo == "000000" {
		require.Equal(t, http.StatusOK, rec.Code)
		return
	}
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	require.Equal(t, "codigo_invalido", codigoErrorSeguimientoDeTest(t, rec))

	// Paso 2: código correcto → token válido para la API.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPost, "/auth/login/verificar", "", map[string]string{"desafio_id": desafio, "codigo": codigo})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	leer(rec)
	require.NotEmpty(t, resp.Token)
	require.Equal(t, http.StatusOK, pedidoSeguimientoDeTest(t, router, http.MethodGet, "/envios", resp.Token, nil).Code)

	// El mismo código no sirve dos veces.
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPost, "/auth/login/verificar", "", map[string]string{"desafio_id": desafio, "codigo": codigo})
	require.Equal(t, http.StatusUnauthorized, rec.Code)

	// Reenviar: un desafío nuevo con otro mensaje. Se puede pedir un código por
	// minuto: se "envejecen" los anteriores para no esperar.
	envejecer := func() {
		_, err := pool.Exec(ctx, "UPDATE codigos_otp SET created_at = created_at - interval '2 minutes' WHERE telefono = $1", tel)
		require.NoError(t, err)
	}
	envejecer()
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPost, "/auth/login", "", map[string]string{"email": email, "password": pass})
	leer(rec)
	envejecer()
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPost, "/auth/login/reenviar", "", map[string]string{"desafio_id": resp.DesafioID})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	leer(rec)
	require.True(t, resp.RequiereCodigo)

	// Un usuario sin celular entra en un solo paso (como antes).
	rec = pedidoSeguimientoDeTest(t, router, http.MethodPost, "/auth/login", "", map[string]string{"email": "operador@movii.demo", "password": "Movii2026!"})
	require.Equal(t, http.StatusOK, rec.Code)
	leer(rec)
	require.NotEmpty(t, resp.Token)
	require.False(t, resp.RequiereCodigo)
}
