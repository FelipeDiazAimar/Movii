package services

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/platform/mail"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
)

var (
	// ErrDemasiadosPedidos: se pidieron demasiados códigos en poco tiempo.
	ErrDemasiadosPedidos = errors.New("demasiados pedidos de codigo")
	// ErrEsperarReenvio: ya se pidió un código hace menos de un minuto.
	ErrEsperarReenvio = errors.New("esperar antes de pedir otro codigo")
	// ErrCodigoInvalido: el código no coincide, venció, ya se usó o superó los intentos.
	ErrCodigoInvalido = errors.New("codigo invalido")
	// ErrCodigoVencido (es también ErrCodigoInvalido): venció, ya se usó o se
	// agotaron los intentos; hay que pedir uno nuevo.
	ErrCodigoVencido = fmt.Errorf("%w: vencido o sin intentos", ErrCodigoInvalido)
)

// Valores por defecto (OTP_TTL_MIN y OTP_MAX_INTENTOS los cambian).
const (
	vigenciaOTP           = 10 * time.Minute
	ventanaPedidosOTP     = 15 * time.Minute
	maxPedidosOTP         = 3
	esperaEntrePedidosOTP = time.Minute
	maxIntentosOTP        = 3
	digitosOTP            = 6
)

// Canales por los que sale el código.
const (
	CanalWhatsapp = "whatsapp"
	CanalMail     = "mail"
)

// otpRepo es lo que OTPService necesita de la base (repository.WhatsappRepo lo implementa).
type otpRepo interface {
	CrearCodigo(ctx context.Context, id, telefono string, usuarioID *string, hash string, expira time.Time) error
	ObtenerCodigo(ctx context.Context, id string) (repository.CodigoOTP, error)
	ContarCodigosDesde(ctx context.Context, telefono string, desde time.Time) (int, error)
	SumarIntento(ctx context.Context, id string) error
	MarcarUsado(ctx context.Context, id string) (bool, error)
}

// usuariosPorID busca al usuario del desafío al verificar el código.
type usuariosPorID interface {
	GetByID(ctx context.Context, id string) (domain.Usuario, error)
	CompletarPrimerAcceso(ctx context.Context, id string) error
}

// emisorToken firma el JWT de sesión (AuthService lo implementa).
type emisorToken interface {
	EmitirToken(u domain.Usuario) (string, error)
}

// Desafio es el segundo paso pendiente de un login: el código ya salió por
// WhatsApp o por mail.
type Desafio struct {
	ID       string `json:"desafio_id"`
	Telefono string `json:"telefono"` // enmascarado para mostrar: +54 9 3564 ••••45 (vacío si fue por mail)
	Canal    string `json:"canal"`    // "whatsapp" | "mail"
	Destino  string `json:"destino"`  // celular o mail enmascarado
	VenceEn  int    `json:"vence_en_segundos"`
}

// OTPService implementa el segundo factor del login (HU-16): después de
// validar email y contraseña, la app pide un código de 6 dígitos que llega al
// WhatsApp del usuario. Recién con ese código se emite el JWT.
//
// Seguridad: el código se guarda como HMAC (nunca en claro), vence a los 5
// minutos, admite 5 intentos y se invalida al usarse; se pueden pedir como
// máximo 3 códigos cada 15 minutos por usuario. El desafío solo se obtiene con
// la contraseña correcta.
type OTPService struct {
	repo     otpRepo
	usuarios usuariosPorID
	tokens   emisorToken
	sender   whatsapp.Sender
	mail     mail.Sender
	secreto  []byte
	ahora    func() time.Time
	generar  func() (string, error)
	// EsperaEnvio es cuánto espera el login a que WhatsApp confirme el envío
	// antes de responder igual (el mensaje sigue saliendo en segundo plano).
	EsperaEnvio time.Duration
	// TTL es la vigencia del código y MaxIntentos los intentos por código.
	TTL         time.Duration
	MaxIntentos int
}

// NewOTPService crea un OTPService. secreto firma los hashes de los códigos.
func NewOTPService(repo otpRepo, usuarios usuariosPorID, tokens emisorToken, sender whatsapp.Sender, secreto string) *OTPService {
	return &OTPService{repo: repo, usuarios: usuarios, tokens: tokens, sender: sender, mail: mail.SoloLog{}, secreto: []byte(secreto),
		ahora: time.Now, generar: generarCodigo, EsperaEnvio: 8 * time.Second, TTL: vigenciaOTP, MaxIntentos: maxIntentosOTP}
}

// ConMail fija el canal de mail para quien no tiene celular (T1). Sin llamarlo, el mail va al log.
func (s *OTPService) ConMail(m mail.Sender) *OTPService {
	s.mail = m
	return s
}

func generarCodigo() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%0*d", digitosOTP, n.Int64()), nil
}

func (s *OTPService) hash(desafio, codigo string) string {
	m := hmac.New(sha256.New, s.secreto)
	m.Write([]byte(desafio + ":" + codigo))
	return hex.EncodeToString(m.Sum(nil))
}

// EnmascararTelefono deja ver solo el área y los dos últimos dígitos.
func EnmascararTelefono(tel string) string {
	if len(tel) != 13 || tel[:3] != "549" {
		return "••••"
	}
	return "+54 9 " + tel[3:7] + " ••••" + tel[11:]
}

// EnmascararEmail deja ver la primera letra y el dominio: a•••@movii.demo.
func EnmascararEmail(email string) string {
	at := strings.LastIndex(email, "@")
	if at < 1 {
		return "••••"
	}
	return email[:1] + "•••" + email[at:]
}

// Requiere indica si el usuario debe pasar el segundo factor. Se exige cuando
// tiene celular cargado y WhatsApp puede entregar el código; si WhatsApp está
// deshabilitado o desvinculado se entra solo con la contraseña, para que nadie
// quede afuera (incluido el admin que tiene que volver a vincularlo).
func (s *OTPService) Requiere(u domain.Usuario) bool {
	if u.Telefono == "" {
		return false
	}
	st := s.sender.Estado()
	return !st.Habilitado || st.Vinculado // deshabilitado = modo desarrollo: el código va al log
}

// Iniciar genera un código para el usuario (ya autenticado), lo manda por
// WhatsApp si tiene celular y WhatsApp puede entregarlo (ver Requiere) o, si
// no, por mail (T1), y devuelve el desafío a completar.
func (s *OTPService) Iniciar(ctx context.Context, u domain.Usuario) (Desafio, error) {
	canal, destino, mascara := CanalWhatsapp, u.Telefono, EnmascararTelefono(u.Telefono)
	if !s.Requiere(u) {
		canal, destino, mascara = CanalMail, strings.ToLower(u.Email), EnmascararEmail(u.Email)
	}
	ahora := s.ahora()
	if n, err := s.repo.ContarCodigosDesde(ctx, destino, ahora.Add(-esperaEntrePedidosOTP)); err != nil {
		return Desafio{}, err
	} else if n > 0 {
		return Desafio{}, ErrEsperarReenvio
	}
	n, err := s.repo.ContarCodigosDesde(ctx, destino, ahora.Add(-ventanaPedidosOTP))
	if err != nil {
		return Desafio{}, err
	}
	if n >= maxPedidosOTP {
		return Desafio{}, ErrDemasiadosPedidos
	}
	codigo, err := s.generar()
	if err != nil {
		return Desafio{}, err
	}
	// El id del desafío (UUID aleatorio) es también la sal del HMAC del código.
	id, err := nuevoUUID()
	if err != nil {
		return Desafio{}, err
	}
	if err := s.repo.CrearCodigo(ctx, id, destino, &u.ID, s.hash(id, codigo), ahora.Add(s.TTL)); err != nil {
		return Desafio{}, err
	}
	minutos := int(s.TTL.Minutes())
	enviar := func(c context.Context) error {
		return s.mail.Enviar(c, destino, "Movii · Código de verificación", fmt.Sprintf(
			"Tu código de verificación de Movii es: %s\n\n"+
				"Vence en %d minutos y sirve una sola vez. No lo compartas con nadie: el equipo de Movii nunca te lo va a pedir.\n\n"+
				"Si no fuiste vos, ignorá este mail.", codigo, minutos))
	}
	if canal == CanalWhatsapp {
		texto := fmt.Sprintf("🔐 *Movii · Código de verificación*\n\n"+
			"Para terminar de iniciar sesión, ingresá este código en la app:\n\n"+
			"```%s```\n\n"+
			"⏱️ Vence en *%d minutos* y sirve una sola vez.\n"+
			"🚫 No lo compartas con nadie: el equipo de Movii *nunca* te lo va a pedir.\n\n"+
			"_Si no fuiste vos, ignorá este mensaje: tu cuenta sigue protegida._", codigo, minutos)
		enviar = func(c context.Context) error { return s.sender.Enviar(c, destino, texto) }
	}
	desafio := Desafio{ID: id, Canal: canal, Destino: mascara, VenceEn: int(s.TTL.Seconds())}
	if canal == CanalWhatsapp {
		desafio.Telefono = mascara
	}

	// El envío corre aparte con su propio límite: si WhatsApp o el mail tardan,
	// el login no queda colgado. Se espera hasta EsperaEnvio; si para entonces
	// no falló, se devuelve el desafío y el mensaje termina de salir solo.
	inicio := time.Now()
	resultado := make(chan error, 1)
	go func() {
		c, cancel := context.WithTimeout(context.Background(), limiteEnvioOTP)
		defer cancel()
		err := enviar(c)
		if err != nil {
			log.Printf("2fa: falló el envío del código (%s) a %s después de %s: %v", canal, mascara, time.Since(inicio).Round(time.Millisecond), err)
		} else {
			log.Printf("2fa: código enviado (%s) a %s en %s", canal, mascara, time.Since(inicio).Round(time.Millisecond))
		}
		resultado <- err
	}()
	select {
	case err := <-resultado:
		if err != nil {
			if canal == CanalMail {
				return Desafio{}, fmt.Errorf("no se pudo enviar el código por mail: %w", err)
			}
			return Desafio{}, fmt.Errorf("no se pudo enviar el código por WhatsApp: %w", err)
		}
	case <-time.After(s.EsperaEnvio):
		log.Printf("2fa: el envío a %s sigue en curso después de %s; se responde igual", mascara, s.EsperaEnvio)
	}
	return desafio, nil
}

// limiteEnvioOTP es el tiempo máximo para que WhatsApp acepte el mensaje.
const limiteEnvioOTP = 45 * time.Second

// nuevoUUID genera un UUID v4.
func nuevoUUID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b)
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:], nil
}

// Reenviar invalida el desafío anterior y manda un código nuevo al mismo usuario.
func (s *OTPService) Reenviar(ctx context.Context, desafioID string) (Desafio, error) {
	c, err := s.repo.ObtenerCodigo(ctx, desafioID)
	if errors.Is(err, repository.ErrNoEncontrado) || (err == nil && c.UsuarioID == nil) {
		return Desafio{}, ErrCodigoInvalido
	}
	if err != nil {
		return Desafio{}, err
	}
	u, err := s.usuarios.GetByID(ctx, *c.UsuarioID)
	if err != nil || !u.Activo {
		return Desafio{}, ErrCodigoInvalido
	}
	// El anterior se invalida recién si salió el nuevo (si no, sigue sirviendo).
	d, err := s.Iniciar(ctx, u)
	if err == nil {
		_, _ = s.repo.MarcarUsado(ctx, c.ID)
	}
	return d, err
}

// Verificar valida el código del desafío y, si es correcto, devuelve el JWT.
// Si era el primer acceso (T1), lo da por completo antes de emitir el token.
func (s *OTPService) Verificar(ctx context.Context, desafioID, codigo string) (string, error) {
	c, err := s.repo.ObtenerCodigo(ctx, desafioID)
	if errors.Is(err, repository.ErrNoEncontrado) {
		return "", ErrCodigoInvalido
	}
	if err != nil {
		return "", err
	}
	if c.UsuarioID == nil {
		return "", ErrCodigoInvalido
	}
	if c.Usado || !s.ahora().Before(c.ExpiraAt) || c.Intentos >= s.MaxIntentos {
		_, _ = s.repo.MarcarUsado(ctx, c.ID)
		return "", ErrCodigoVencido
	}
	if err := s.repo.SumarIntento(ctx, c.ID); err != nil {
		return "", err
	}
	if !hmac.Equal([]byte(c.CodigoHash), []byte(s.hash(c.ID, codigo))) {
		if c.Intentos+1 >= s.MaxIntentos {
			_, _ = s.repo.MarcarUsado(ctx, c.ID)
			return "", ErrCodigoVencido
		}
		return "", ErrCodigoInvalido
	}
	usado, err := s.repo.MarcarUsado(ctx, c.ID)
	if err != nil {
		return "", err
	}
	if !usado {
		return "", ErrCodigoInvalido
	}
	u, err := s.usuarios.GetByID(ctx, *c.UsuarioID)
	if err != nil || !u.Activo {
		return "", ErrCodigoInvalido
	}
	if u.MustChangePassword {
		if err := s.usuarios.CompletarPrimerAcceso(ctx, u.ID); err != nil {
			return "", err
		}
		u.MustChangePassword = false
	}
	return s.tokens.EmitirToken(u)
}
