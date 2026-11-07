package httprouter

// T2: login con Google contra un token endpoint falso (sin red ni base).

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/platform/google"
)

// googleFalso responde el token endpoint con un id_token armado con claims.
func googleFalso(t *testing.T, claims *jwt.MapClaims) *google.Cliente {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		require.Equal(t, "authorization_code", r.PostForm.Get("grant_type"))
		require.Equal(t, "cs", r.PostForm.Get("client_secret"))
		idToken, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, *claims).SignedString([]byte("da-igual"))
		_ = json.NewEncoder(w).Encode(map[string]string{"id_token": idToken})
	}))
	t.Cleanup(srv.Close)
	return &google.Cliente{
		ClientID: "cid", ClientSecret: "cs", CallbackURL: "http://api.test/auth/google/callback",
		AuthURL: "http://accounts.test/auth", TokenURL: srv.URL, HTTP: srv.Client(),
	}
}

func perfil(email string, verificado bool) *jwt.MapClaims {
	return &jwt.MapClaims{
		"iss": "https://accounts.google.com", "aud": "cid", "exp": time.Now().Add(time.Hour).Unix(),
		"sub": "google-" + email, "email": email, "email_verified": verificado, "name": "Persona Google",
	}
}

func (e *entorno) get(path string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, req)
	return rec
}

// loginGoogle hace /auth/google → (Google) → /auth/google/callback y devuelve adónde redirige.
func (e *entorno) loginGoogle(t *testing.T, volver, extra string) *url.URL {
	t.Helper()
	path := "/auth/google"
	if volver != "" {
		path += "?redirect_uri=" + url.QueryEscape(volver)
	}
	rec := e.get(path)
	require.Equal(t, http.StatusFound, rec.Code, rec.Body.String())
	aGoogle, err := url.Parse(rec.Header().Get("Location"))
	require.NoError(t, err)
	require.Equal(t, "openid email profile", aGoogle.Query().Get("scope"))
	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	require.True(t, cookies[0].HttpOnly)

	rec = e.get("/auth/google/callback?code=abc&state="+url.QueryEscape(aGoogle.Query().Get("state"))+extra, cookies[0])
	require.Equal(t, http.StatusFound, rec.Code)
	destino, err := url.Parse(rec.Header().Get("Location"))
	require.NoError(t, err)
	return destino
}

func fragmento(t *testing.T, u *url.URL) url.Values {
	t.Helper()
	v, err := url.ParseQuery(u.Fragment)
	require.NoError(t, err)
	return v
}

func rolDe(t *testing.T, token string) string {
	t.Helper()
	tok, err := jwt.Parse(token, func(*jwt.Token) (any, error) { return []byte(secretoTest), nil }, jwt.WithValidMethods([]string{"HS256"}))
	require.NoError(t, err)
	return tok.Claims.(jwt.MapClaims)["rol"].(string)
}

func TestGoogle_FeatureFlag(t *testing.T) {
	sin := nuevoEntorno(t, nil)
	rec := sin.get("/auth/config")
	require.JSONEq(t, `{"google":false}`, rec.Body.String())
	rec = sin.get("/auth/google")
	require.Equal(t, http.StatusFound, rec.Code)
	require.Equal(t, "http://web.test/login?error=google_no_configurado", rec.Header().Get("Location"))

	con := nuevoEntorno(t, googleFalso(t, perfil("x@gmail.com", true)))
	require.JSONEq(t, `{"google":true}`, con.get("/auth/config").Body.String())
}

func TestGoogle_UsuarioNuevoEntraComoOperador(t *testing.T) {
	e := nuevoEntorno(t, googleFalso(t, perfil("nueva@gmail.com", true)))
	destino := e.loginGoogle(t, "", "")
	require.Equal(t, "/login", destino.Path)
	f := fragmento(t, destino)
	require.Equal(t, domain.RolOperador, rolDe(t, f.Get("token")))
	require.Empty(t, destino.RawQuery, "el token va en el fragmento, no en la query")

	u, err := e.us.GetByEmail(context.Background(), "nueva@gmail.com")
	require.NoError(t, err)
	require.Equal(t, "google", u.AuthProvider)
	require.Equal(t, "google-nueva@gmail.com", u.GoogleID)
	require.False(t, u.MustChangePassword)
}

func TestGoogle_ExistenteVinculaYConservaRol(t *testing.T) {
	e := nuevoEntorno(t, googleFalso(t, perfil("jefa@movii.demo", true)))
	_, err := e.auth.Register(context.Background(), "Jefa", "Jefa@movii.demo", "Movii2026!", domain.RolAdmin)
	require.NoError(t, err)

	f := fragmento(t, e.loginGoogle(t, "", ""))
	require.Equal(t, domain.RolAdmin, rolDe(t, f.Get("token")))
	u, err := e.us.GetByEmail(context.Background(), "Jefa@movii.demo")
	require.NoError(t, err)
	require.Equal(t, "google-jefa@movii.demo", u.GoogleID)
	require.Len(t, e.us.us, 1, "no se crea un usuario nuevo")
}

func TestGoogle_PrimerAccesoIgualPideCodigo(t *testing.T) {
	e := nuevoEntorno(t, googleFalso(t, perfil("alta@movii.demo", true)))
	_, err := e.auth.RegisterConTelefono(context.Background(), "Alta", "alta@movii.demo", "Temporal123", domain.RolOperador, "")
	require.NoError(t, err)

	destino := e.loginGoogle(t, "", "")
	require.Equal(t, "/primer-acceso", destino.Path)
	f := fragmento(t, destino)
	require.Empty(t, f.Get("token"))
	require.Equal(t, "mail", f.Get("canal"))
	m := codigoMail.FindStringSubmatch(e.mail.ultimo("alta@movii.demo"))
	require.Len(t, m, 2)

	rec, out := e.post(t, "/auth/primer-acceso/verificar", map[string]string{"desafio_id": f.Get("desafio_id"), "codigo": m[1]})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NotEmpty(t, out["token"])
	u, _ := e.us.GetByEmail(context.Background(), "alta@movii.demo")
	require.False(t, u.MustChangePassword)
}

func TestGoogle_CanceladoYErrores(t *testing.T) {
	claims := perfil("alguien@gmail.com", true)
	e := nuevoEntorno(t, googleFalso(t, claims))

	destino := e.loginGoogle(t, "", "&error=access_denied")
	require.Equal(t, "/login", destino.Path)
	require.Equal(t, "cancelado", destino.Query().Get("error"))

	(*claims)["email_verified"] = false
	require.Equal(t, "email_no_verificado", e.loginGoogle(t, "", "").Query().Get("error"))

	(*claims)["email_verified"] = true
	(*claims)["aud"] = "otra-app"
	require.Equal(t, "google_error", e.loginGoogle(t, "", "").Query().Get("error"), "id_token de otra app")
	require.Empty(t, e.us.us, "nunca se creó un usuario")

	// state ajeno, sin cookie o con la cookie de otro navegador → rechazado.
	rec := e.get("/auth/google")
	state := url.Values{}
	loc, _ := url.Parse(rec.Header().Get("Location"))
	state.Set("state", loc.Query().Get("state"))
	require.Contains(t, e.get("/auth/google/callback?code=abc&"+state.Encode()).Header().Get("Location"), "error=google_error")
	require.Contains(t, e.get("/auth/google/callback?code=abc&"+state.Encode(), &http.Cookie{Name: "movii_google_state", Value: "otro"}).Header().Get("Location"), "error=google_error")
	adulterado := strings.Replace(loc.Query().Get("state"), ".", "x.", 1)
	require.Contains(t, e.get("/auth/google/callback?code=abc&state="+url.QueryEscape(adulterado), rec.Result().Cookies()[0]).Header().Get("Location"), "error=google_error")
}

func TestGoogle_AppMovil(t *testing.T) {
	e := nuevoEntorno(t, googleFalso(t, perfil("repa@gmail.com", true)))
	require.Equal(t, http.StatusBadRequest, e.get("/auth/google?redirect_uri="+url.QueryEscape("https://malo.test/robar")).Code)
	require.Equal(t, http.StatusBadRequest, e.get("/auth/google?redirect_uri="+url.QueryEscape("exp://192.168.0.2:8081/--/auth")).Code, "exp:// solo fuera de producción")

	destino := e.loginGoogle(t, "movii://auth", "")
	require.Equal(t, "movii", destino.Scheme)
	require.NotEmpty(t, fragmento(t, destino).Get("token"))
}
