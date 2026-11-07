// Package google implementa el login con Google (OAuth2 / OpenID Connect,
// flujo "authorization code") con net/http, sin dependencias nuevas (T2).
package google

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// ErrEmailNoVerificado: Google no garantiza que el email sea de quien inicia sesión.
var ErrEmailNoVerificado = errors.New("google: email no verificado")

// ErrStateInvalido: el parámetro state no es nuestro, venció o fue alterado.
var ErrStateInvalido = errors.New("google: state invalido")

// Cliente habla con los endpoints de OAuth2 de Google.
type Cliente struct {
	ClientID     string
	ClientSecret string
	CallbackURL  string
	AuthURL      string // los tests lo cambian
	TokenURL     string // los tests lo cambian
	HTTP         *http.Client
}

// New crea el Cliente con los endpoints reales de Google.
func New(clientID, secret, callbackURL string) *Cliente {
	return &Cliente{
		ClientID: clientID, ClientSecret: secret, CallbackURL: callbackURL,
		AuthURL:  "https://accounts.google.com/o/oauth2/v2/auth",
		TokenURL: "https://oauth2.googleapis.com/token",
		HTTP:     &http.Client{Timeout: 10 * time.Second},
	}
}

// URLAutorizacion es adonde se manda al usuario para elegir su cuenta.
func (c *Cliente) URLAutorizacion(state string) string {
	q := url.Values{
		"client_id":     {c.ClientID},
		"redirect_uri":  {c.CallbackURL},
		"response_type": {"code"},
		"scope":         {"openid email profile"},
		"state":         {state},
		"prompt":        {"select_account"},
	}
	return c.AuthURL + "?" + q.Encode()
}

// Perfil es lo que se usa de la cuenta de Google.
type Perfil struct {
	Sub    string
	Email  string
	Nombre string
}

// Perfil canjea el code por el id_token y devuelve el perfil verificado.
//
// El id_token llega directo del token endpoint de Google por TLS, así que
// (OpenID Connect Core 3.1.3.7) alcanza con validar iss, aud y exp, sin
// bajar las claves públicas para verificar la firma.
func (c *Cliente) Perfil(ctx context.Context, code string) (Perfil, error) {
	form := url.Values{
		"code":          {code},
		"client_id":     {c.ClientID},
		"client_secret": {c.ClientSecret},
		"redirect_uri":  {c.CallbackURL},
		"grant_type":    {"authorization_code"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return Perfil{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return Perfil{}, fmt.Errorf("google: token: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		detalle, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return Perfil{}, fmt.Errorf("google: token: status %d: %s", resp.StatusCode, detalle)
	}
	var tok struct {
		IDToken string `json:"id_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil || tok.IDToken == "" {
		return Perfil{}, fmt.Errorf("google: respuesta sin id_token")
	}

	claims := jwt.MapClaims{}
	if _, _, err := jwt.NewParser().ParseUnverified(tok.IDToken, claims); err != nil {
		return Perfil{}, fmt.Errorf("google: id_token ilegible: %w", err)
	}
	iss, _ := claims.GetIssuer()
	aud, _ := claims.GetAudience()
	exp, _ := claims.GetExpirationTime()
	if (iss != "https://accounts.google.com" && iss != "accounts.google.com") ||
		len(aud) != 1 || aud[0] != c.ClientID || exp == nil || time.Now().After(exp.Time) {
		return Perfil{}, fmt.Errorf("google: id_token inválido (iss/aud/exp)")
	}
	p := Perfil{}
	p.Sub, _ = claims["sub"].(string)
	p.Email, _ = claims["email"].(string)
	p.Nombre, _ = claims["name"].(string)
	verificado := claims["email_verified"] == true || claims["email_verified"] == "true"
	if p.Sub == "" || !strings.Contains(p.Email, "@") {
		return Perfil{}, fmt.Errorf("google: id_token sin sub o email")
	}
	if !verificado {
		return Perfil{}, ErrEmailNoVerificado
	}
	return p, nil
}

// FirmarState arma el state anti-CSRF: nonce (que además va en una cookie),
// adónde volver y vencimiento, firmados con HMAC-SHA256.
func FirmarState(secreto []byte, nonce, volver string, vence time.Time) string {
	datos, _ := json.Marshal(stateDatos{Nonce: nonce, Volver: volver, Vence: vence.Unix()})
	payload := base64.RawURLEncoding.EncodeToString(datos)
	return payload + "." + firma(secreto, payload)
}

// LeerState valida la firma y el vencimiento del state y devuelve su contenido.
func LeerState(secreto []byte, state string, ahora time.Time) (nonce, volver string, err error) {
	payload, sig, ok := strings.Cut(state, ".")
	if !ok || !hmac.Equal([]byte(sig), []byte(firma(secreto, payload))) {
		return "", "", ErrStateInvalido
	}
	raw, err := base64.RawURLEncoding.DecodeString(payload)
	var d stateDatos
	if err != nil || json.Unmarshal(raw, &d) != nil || d.Nonce == "" || ahora.Unix() > d.Vence {
		return "", "", ErrStateInvalido
	}
	return d.Nonce, d.Volver, nil
}

type stateDatos struct {
	Nonce  string `json:"n"`
	Volver string `json:"v,omitempty"`
	Vence  int64  `json:"e"`
}

func firma(secreto []byte, payload string) string {
	m := hmac.New(sha256.New, secreto)
	m.Write([]byte("google-state:" + payload))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}
