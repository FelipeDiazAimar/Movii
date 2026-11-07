package httprouter

// T1: primer login con cambio de contraseña obligatorio + código por WhatsApp
// (con celular) o por mail (sin celular). Corre sin base: repos en memoria.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/handlers"
	"movii/api/internal/middleware"
	"movii/api/internal/platform/google"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
	"movii/api/internal/services"
)

// --- repos y canales en memoria ---

type usuariosMem struct {
	mu sync.Mutex
	us map[string]domain.Usuario // por id
}

func (r *usuariosMem) Create(_ context.Context, u domain.Usuario) (domain.Usuario, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, x := range r.us {
		if strings.EqualFold(x.Email, u.Email) {
			return domain.Usuario{}, repository.ErrDuplicado
		}
	}
	u.ID = fmt.Sprintf("00000000-0000-4000-8000-%012d", len(r.us)+1)
	u.Activo = true
	if u.AuthProvider == "" {
		u.AuthProvider = "password"
	}
	r.us[u.ID] = u
	return u, nil
}
func (r *usuariosMem) GetByEmail(_ context.Context, email string) (domain.Usuario, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, u := range r.us {
		if u.Email == email {
			return u, nil
		}
	}
	return domain.Usuario{}, repository.ErrNoEncontrado
}
func (r *usuariosMem) GetByID(_ context.Context, id string) (domain.Usuario, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if u, ok := r.us[id]; ok {
		return u, nil
	}
	return domain.Usuario{}, repository.ErrNoEncontrado
}
func (r *usuariosMem) cambiar(id string, f func(*domain.Usuario)) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	u := r.us[id]
	f(&u)
	r.us[id] = u
	return nil
}
func (r *usuariosMem) ActualizarPassword(_ context.Context, id, hash string) error {
	return r.cambiar(id, func(u *domain.Usuario) { u.PasswordHash = hash })
}
func (r *usuariosMem) CompletarPrimerAcceso(_ context.Context, id string) error {
	return r.cambiar(id, func(u *domain.Usuario) { u.MustChangePassword = false })
}
func (r *usuariosMem) VincularGoogle(_ context.Context, id, g string) error {
	return r.cambiar(id, func(u *domain.Usuario) {
		if u.GoogleID == "" {
			u.GoogleID = g
		}
	})
}
func (r *usuariosMem) BuscarParaGoogle(_ context.Context, g, email string) (domain.Usuario, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, u := range r.us {
		if u.GoogleID == g {
			return u, nil
		}
	}
	for _, u := range r.us {
		if strings.EqualFold(u.Email, email) {
			return u, nil
		}
	}
	return domain.Usuario{}, repository.ErrNoEncontrado
}

type codigosMem struct {
	mu sync.Mutex
	cs map[string]*repository.CodigoOTP
	at map[string]time.Time
}

func (r *codigosMem) CrearCodigo(_ context.Context, id, dest string, uid *string, hash string, exp time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cs[id] = &repository.CodigoOTP{ID: id, Telefono: dest, UsuarioID: uid, CodigoHash: hash, ExpiraAt: exp}
	r.at[id] = time.Now()
	return nil
}
func (r *codigosMem) ObtenerCodigo(_ context.Context, id string) (repository.CodigoOTP, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if c, ok := r.cs[id]; ok {
		return *c, nil
	}
	return repository.CodigoOTP{}, repository.ErrNoEncontrado
}
func (r *codigosMem) ContarCodigosDesde(_ context.Context, dest string, desde time.Time) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	n := 0
	for id, c := range r.cs {
		if c.Telefono == dest && !r.at[id].Before(desde) {
			n++
		}
	}
	return n, nil
}
func (r *codigosMem) SumarIntento(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cs[id].Intentos++
	return nil
}
func (r *codigosMem) MarcarUsado(_ context.Context, id string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cs[id].Usado {
		return false, nil
	}
	r.cs[id].Usado = true
	return true, nil
}

// envejecer simula que pasaron 2 minutos (límite de un código por minuto).
func (r *codigosMem) envejecer() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id := range r.at {
		r.at[id] = r.at[id].Add(-2 * time.Minute)
	}
}

type buzon struct {
	mu   sync.Mutex
	msjs map[string]string // destino → último mensaje
}

func (b *buzon) guardar(dest, texto string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.msjs[dest] = texto
	return nil
}
func (b *buzon) ultimo(dest string) string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.msjs[dest]
}

type waMem struct{ *buzon }

func (w waMem) Enviar(_ context.Context, tel, texto string) error { return w.guardar(tel, texto) }
func (waMem) Estado() whatsapp.Estado                             { return whatsapp.Estado{Habilitado: true, Vinculado: true} }

type mailMem struct{ *buzon }

func (m mailMem) Enviar(_ context.Context, para, _, texto string) error {
	return m.guardar(para, texto)
}

var (
	codigoWA   = regexp.MustCompile("```(\\d{6})```")
	codigoMail = regexp.MustCompile(`es: (\d{6})`)
)

// --- armado ---

const secretoTest = "secreto-de-test"

type entorno struct {
	h       http.Handler
	us      *usuariosMem
	codigos *codigosMem
	wa      *buzon
	mail    *buzon
	auth    *services.AuthService
	otp     *services.OTPService
}

// nuevoEntorno arma el router con repos en memoria. cliente nil = sin Google.
func nuevoEntorno(t *testing.T, cliente *google.Cliente) *entorno {
	t.Helper()
	e := &entorno{
		us:      &usuariosMem{us: map[string]domain.Usuario{}},
		codigos: &codigosMem{cs: map[string]*repository.CodigoOTP{}, at: map[string]time.Time{}},
		wa:      &buzon{msjs: map[string]string{}},
		mail:    &buzon{msjs: map[string]string{}},
	}
	e.auth = services.NewAuthService(e.us, secretoTest)
	e.otp = services.NewOTPService(e.codigos, e.us, e.auth, waMem{e.wa}, secretoTest).ConMail(mailMem{e.mail})
	e.h = New(Deps{
		JWTSecret: secretoTest, CORSOrigins: []string{"*"},
		AuthHandler:   handlers.NewAuthHandler(e.auth).ConSegundoFactor(e.otp),
		GoogleHandler: handlers.NewGoogleHandler(cliente, e.auth, e.otp, secretoTest, "http://web.test", false),
	})
	return e
}

func (e *entorno) post(t *testing.T, path string, body any) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	b, _ := json.Marshal(body)
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b)))
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec, out
}

func codigoDeError(out map[string]any) string {
	e, _ := out["error"].(map[string]any)
	c, _ := e["code"].(string)
	return c
}

// alta por /auth/register (como el admin desde la web) y login → 428.
func (e *entorno) altaYLogin428(t *testing.T, email, telefono string) (userID, token string) {
	t.Helper()
	rec, _ := e.post(t, "/auth/register", map[string]string{"nombre": "Nuevo", "email": email, "password": "Temporal123", "rol": domain.RolOperador, "telefono": telefono})
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	rec, out := e.post(t, "/auth/login", map[string]string{"email": email, "password": "Temporal123"})
	require.Equal(t, http.StatusPreconditionRequired, rec.Code, rec.Body.String())
	require.Equal(t, "must_change_password", out["code"])
	require.NotEmpty(t, out["user_id"])
	require.NotEmpty(t, out["token"])
	return out["user_id"].(string), out["token"].(string)
}

// requireAuthAcepta dice si RequireAuth deja pasar el token.
func requireAuthAcepta(token string) int {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	req := httptest.NewRequest(http.MethodGet, "/envios", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	middleware.RequireAuth(secretoTest)(ok).ServeHTTP(rec, req)
	return rec.Code
}

// --- tests ---

// Flag: el alta por API deja el primer acceso pendiente y el token del 428 no
// sirve para /envios, /rutas ni /users. Los usuarios existentes no se tocan.
func TestPrimerAcceso_FlagYBloqueo(t *testing.T) {
	e := nuevoEntorno(t, nil)
	_, token := e.altaYLogin428(t, "nuevo@movii.demo", "")

	for _, path := range []string{"/envios", "/rutas", "/users"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		e.h.ServeHTTP(rec, req)
		require.Equal(t, http.StatusForbidden, rec.Code, path)
	}
	claims := jwt.MapClaims{}
	_, _, err := jwt.NewParser().ParseUnverified(token, claims)
	require.NoError(t, err)
	require.Nil(t, claims["rol"], "el token del 428 no lleva rol")

	// Alta "vieja" (demo/seed, Register): entra directo, sin primer acceso.
	_, err = e.auth.Register(context.Background(), "Demo", "demo@movii.demo", "Movii2026!", domain.RolOperador)
	require.NoError(t, err)
	rec, out := e.post(t, "/auth/login", map[string]string{"email": "demo@movii.demo", "password": "Movii2026!"})
	require.Equal(t, http.StatusOK, rec.Code)
	require.NotEmpty(t, out["token"])
}

func TestPrimerAcceso_CanalMail(t *testing.T) {
	e := nuevoEntorno(t, nil)
	const email = "sin-celular@movii.demo"
	uid, token := e.altaYLogin428(t, email, "")

	// Reglas de la contraseña y token del 428.
	rec, out := e.post(t, "/auth/primer-acceso/cambiar-password", map[string]string{"user_id": uid, "token": token, "nueva_password": "corta1"})
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Equal(t, "password_debil", codigoDeError(out))
	rec, _ = e.post(t, "/auth/primer-acceso/cambiar-password", map[string]string{"user_id": uid, "token": token, "nueva_password": "sinnumeroS"})
	require.Equal(t, http.StatusBadRequest, rec.Code)
	rec, _ = e.post(t, "/auth/primer-acceso/cambiar-password", map[string]string{"user_id": uid, "token": "x.y.z", "nueva_password": "NuevaClave1"})
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	rec, _ = e.post(t, "/auth/primer-acceso/cambiar-password", map[string]string{"user_id": "otro-id", "token": token, "nueva_password": "NuevaClave1"})
	require.Equal(t, http.StatusUnauthorized, rec.Code, "el token es de otro usuario")
	normal, err := e.auth.EmitirToken(domain.Usuario{ID: uid, Rol: domain.RolOperador})
	require.NoError(t, err)
	rec, _ = e.post(t, "/auth/primer-acceso/cambiar-password", map[string]string{"user_id": uid, "token": normal, "nueva_password": "NuevaClave1"})
	require.Equal(t, http.StatusUnauthorized, rec.Code, "un JWT de sesión no sirve como token de primer acceso")

	rec, out = e.post(t, "/auth/primer-acceso/cambiar-password", map[string]string{"user_id": uid, "token": token, "nueva_password": "NuevaClave1"})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Equal(t, "mail", out["canal"])
	require.Equal(t, "s•••@movii.demo", out["destino"])
	require.EqualValues(t, 600, out["vence_en_segundos"])
	require.Empty(t, e.wa.msjs, "sin celular no sale nada por WhatsApp")
	m := codigoMail.FindStringSubmatch(e.mail.ultimo(email))
	require.Len(t, m, 2, "el mail trae el código: %q", e.mail.ultimo(email))

	// Hasta validar el código el flag sigue: la contraseña nueva vuelve a dar 428.
	rec, _ = e.post(t, "/auth/login", map[string]string{"email": email, "password": "NuevaClave1"})
	require.Equal(t, http.StatusPreconditionRequired, rec.Code)

	rec, out = e.post(t, "/auth/primer-acceso/verificar", map[string]string{"desafio_id": out["desafio_id"].(string), "codigo": m[1]})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Equal(t, http.StatusNoContent, requireAuthAcepta(out["token"].(string)), "el JWT final sí da acceso")

	// Primer acceso completo: login normal con la contraseña nueva; la vieja ya no sirve.
	rec, out = e.post(t, "/auth/login", map[string]string{"email": email, "password": "NuevaClave1"})
	require.Equal(t, http.StatusOK, rec.Code)
	require.NotEmpty(t, out["token"])
	rec, _ = e.post(t, "/auth/login", map[string]string{"email": email, "password": "Temporal123"})
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestPrimerAcceso_CanalWhatsapp(t *testing.T) {
	e := nuevoEntorno(t, nil)
	const email, tel = "con-celular@movii.demo", "5493564111222"
	uid, token := e.altaYLogin428(t, email, "3564 111222")

	rec, out := e.post(t, "/auth/primer-acceso/cambiar-password", map[string]string{"user_id": uid, "token": token, "nueva_password": "NuevaClave1"})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Equal(t, "whatsapp", out["canal"])
	require.Equal(t, "+54 9 3564 ••••22", out["destino"])
	require.Empty(t, e.mail.msjs, "con celular no sale mail")
	m := codigoWA.FindStringSubmatch(e.wa.ultimo(tel))
	require.Len(t, m, 2)

	rec, out = e.post(t, "/auth/primer-acceso/verificar", map[string]string{"desafio_id": out["desafio_id"].(string), "codigo": m[1]})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Equal(t, http.StatusNoContent, requireAuthAcepta(out["token"].(string)))
	u, err := e.us.GetByID(context.Background(), uid)
	require.NoError(t, err)
	require.False(t, u.MustChangePassword)
}

// Código vencido por 3 fallos → error claro; reenviar manda uno nuevo e invalida el anterior.
func TestPrimerAcceso_TresFallosYReenvio(t *testing.T) {
	e := nuevoEntorno(t, nil)
	const email = "fallos@movii.demo"
	uid, token := e.altaYLogin428(t, email, "")
	_, out := e.post(t, "/auth/primer-acceso/cambiar-password", map[string]string{"user_id": uid, "token": token, "nueva_password": "NuevaClave1"})
	d1 := out["desafio_id"].(string)
	bueno := codigoMail.FindStringSubmatch(e.mail.ultimo(email))[1]
	malo := "000000"
	if bueno == malo {
		malo = "111111"
	}

	// Reenviar enseguida: un código por minuto.
	rec, out := e.post(t, "/auth/primer-acceso/reenviar", map[string]string{"desafio_id": d1})
	require.Equal(t, http.StatusTooManyRequests, rec.Code)
	require.Equal(t, "esperar_reenvio", codigoDeError(out))

	rec, out = e.post(t, "/auth/primer-acceso/verificar", map[string]string{"desafio_id": d1, "codigo": malo})
	require.Equal(t, "codigo_invalido", codigoDeError(out), rec.Body.String())
	e.post(t, "/auth/primer-acceso/verificar", map[string]string{"desafio_id": d1, "codigo": malo})
	rec, out = e.post(t, "/auth/primer-acceso/verificar", map[string]string{"desafio_id": d1, "codigo": malo})
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	require.Equal(t, "codigo_vencido", codigoDeError(out), "al tercer fallo el código se invalida")
	rec, out = e.post(t, "/auth/primer-acceso/verificar", map[string]string{"desafio_id": d1, "codigo": bueno})
	require.Equal(t, "codigo_vencido", codigoDeError(out), "ni con el código correcto")

	e.codigos.envejecer()
	rec, out = e.post(t, "/auth/primer-acceso/reenviar", map[string]string{"desafio_id": d1})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	d2 := out["desafio_id"].(string)
	require.NotEqual(t, d1, d2)
	nuevo := codigoMail.FindStringSubmatch(e.mail.ultimo(email))[1]
	rec, out = e.post(t, "/auth/primer-acceso/verificar", map[string]string{"desafio_id": d2, "codigo": nuevo})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NotEmpty(t, out["token"])
}
