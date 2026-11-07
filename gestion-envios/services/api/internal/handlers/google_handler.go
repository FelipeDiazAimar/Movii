package handlers

import (
	"crypto/hmac"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"movii/api/internal/platform/google"
	httpx "movii/api/internal/platform/http"
	"movii/api/internal/services"
)

const cookieStateGoogle = "movii_google_state"

// GoogleHandler implementa el login con Google (T2) y el feature flag público
// GET /auth/config. Sin GOOGLE_* configurado, cliente es nil y el botón se oculta.
type GoogleHandler struct {
	cliente      *google.Cliente
	auth         *services.AuthService
	otp          *services.OTPService
	secreto      []byte
	webURL       string
	permitirExpo bool // acepta volver a exp:// (Expo Go); solo fuera de producción
}

// NewGoogleHandler crea el handler. cliente nil = login con Google deshabilitado.
func NewGoogleHandler(cliente *google.Cliente, auth *services.AuthService, otp *services.OTPService, jwtSecret, webURL string, permitirExpo bool) *GoogleHandler {
	return &GoogleHandler{cliente: cliente, auth: auth, otp: otp, secreto: []byte(jwtSecret), webURL: strings.TrimRight(webURL, "/"), permitirExpo: permitirExpo}
}

// Config maneja GET /auth/config: qué métodos de login están disponibles.
func (h *GoogleHandler) Config(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]bool{"google": h != nil && h.cliente != nil})
}

// volverPermitido limita adónde puede volver la app móvil con el token (evita
// un open redirect que se lleve el JWT a otro sitio).
func (h *GoogleHandler) volverPermitido(v string) bool {
	return strings.HasPrefix(v, "movii://") || (h.permitirExpo && strings.HasPrefix(v, "exp://"))
}

// Iniciar maneja GET /auth/google[?redirect_uri=movii://...]: redirige a Google.
func (h *GoogleHandler) Iniciar(w http.ResponseWriter, r *http.Request) {
	volver := r.URL.Query().Get("redirect_uri")
	if volver != "" && !h.volverPermitido(volver) {
		httpx.WriteError(w, http.StatusBadRequest, "redirect_invalido", "redirect_uri no permitido")
		return
	}
	if h.cliente == nil {
		h.volverCon(w, r, volver, "", url.Values{"error": {"google_no_configurado"}})
		return
	}
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "error_interno", "no se pudo iniciar el login con Google")
		return
	}
	nonce := hex.EncodeToString(b)
	// El nonce va firmado en el state y en una cookie del navegador: el
	// callback solo acepta el state si llega desde el mismo navegador (CSRF).
	http.SetCookie(w, &http.Cookie{
		Name: cookieStateGoogle, Value: nonce, Path: "/", MaxAge: 600,
		HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: strings.HasPrefix(h.cliente.CallbackURL, "https://"),
	})
	state := google.FirmarState(h.secreto, nonce, volver, time.Now().Add(10*time.Minute))
	http.Redirect(w, r, h.cliente.URLAutorizacion(state), http.StatusFound)
}

// Callback maneja GET /auth/google/callback?code=&state=: valida el state,
// canjea el code, busca o crea al usuario y vuelve a la web (o a la app) con
// el token, o con el desafío del código si tiene el primer acceso pendiente.
func (h *GoogleHandler) Callback(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	nonce, volver, err := google.LeerState(h.secreto, q.Get("state"), time.Now())
	cookie, cerr := r.Cookie(cookieStateGoogle)
	http.SetCookie(w, &http.Cookie{Name: cookieStateGoogle, Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	if err != nil || cerr != nil || !hmac.Equal([]byte(cookie.Value), []byte(nonce)) || h.cliente == nil {
		h.volverCon(w, r, "", "", url.Values{"error": {"google_error"}})
		return
	}
	if e := q.Get("error"); e != "" {
		codigo := "google_denied"
		if e == "access_denied" {
			codigo = "cancelado" // el usuario canceló en la pantalla de Google
		}
		h.volverCon(w, r, volver, "", url.Values{"error": {codigo}})
		return
	}

	perfil, err := h.cliente.Perfil(r.Context(), q.Get("code"))
	if err != nil {
		log.Printf("google: %v", err)
		codigo := "google_error"
		if errors.Is(err, google.ErrEmailNoVerificado) {
			codigo = "email_no_verificado"
		}
		h.volverCon(w, r, volver, "", url.Values{"error": {codigo}})
		return
	}
	u, err := h.auth.LoginGoogle(r.Context(), services.PerfilGoogle{Sub: perfil.Sub, Email: perfil.Email, Nombre: perfil.Nombre})
	switch {
	case errors.Is(err, services.ErrCuentaInactiva):
		h.volverCon(w, r, volver, "", url.Values{"error": {"cuenta_inactiva"}})
		return
	case errors.Is(err, services.ErrGoogleOtraCuenta):
		h.volverCon(w, r, volver, "", url.Values{"error": {"google_otra_cuenta"}})
		return
	case err != nil:
		log.Printf("google: login de %s: %v", perfil.Email, err)
		h.volverCon(w, r, volver, "", url.Values{"error": {"google_error"}})
		return
	}

	// Google saltea el cambio de contraseña, pero el primer acceso igual pide el código (T1).
	if u.MustChangePassword {
		d, err := h.otp.Iniciar(r.Context(), u)
		if err != nil {
			log.Printf("google: código de primer acceso para %s: %v", u.Email, err)
			h.volverCon(w, r, volver, "", url.Values{"error": {"codigo_no_enviado"}})
			return
		}
		h.volverCon(w, r, volver, "primer-acceso", url.Values{
			"desafio_id": {d.ID}, "canal": {d.Canal}, "destino": {d.Destino},
			"vence_en_segundos": {strconv.Itoa(d.VenceEn)}, "email": {u.Email},
		})
		return
	}
	token, err := h.auth.EmitirToken(u)
	if err != nil {
		h.volverCon(w, r, volver, "", url.Values{"error": {"google_error"}})
		return
	}
	h.volverCon(w, r, volver, "", url.Values{"token": {token}, "email": {u.Email}})
}

// volverCon redirige a la web (/login o /primer-acceso) o a la app (volver).
// Los errores van en la query (?error=); el token y el desafío en el fragmento
// (#...), que el navegador no manda a ningún servidor ni queda en los logs.
func (h *GoogleHandler) volverCon(w http.ResponseWriter, r *http.Request, volver, pagina string, datos url.Values) {
	destino := volver
	if destino == "" {
		if pagina == "" {
			pagina = "login"
		}
		destino = h.webURL + "/" + pagina
	}
	if datos.Has("error") {
		destino += "?" + datos.Encode()
	} else {
		destino += "#" + datos.Encode()
	}
	http.Redirect(w, r, destino, http.StatusFound)
}
