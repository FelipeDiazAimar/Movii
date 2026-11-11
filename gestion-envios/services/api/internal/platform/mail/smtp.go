package mail

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"
)

// GmailHost y GmailPort son los valores de Gmail (STARTTLS en el 587).
const (
	GmailHost = "smtp.gmail.com"
	GmailPort = 587
)

// SMTP manda mails por un servidor SMTP con usuario y contraseña. Pensado
// para Gmail con una "contraseña de aplicación" (la cuenta necesita la
// verificación en dos pasos activada), pero sirve para cualquier servidor
// que ofrezca STARTTLS (587) o TLS directo (465). Nunca autentica sin cifrar.
type SMTP struct {
	Host    string
	Port    int
	Usuario string
	Clave   string
	// From es el remitente que se ve ("Movii <cuenta@gmail.com>"). Vacío = Usuario.
	// Gmail reemplaza la dirección por la de la cuenta si no es un alias verificado.
	From    string
	Timeout time.Duration
}

// NewSMTP crea el Sender. host vacío = Gmail; port 0 = 587.
func NewSMTP(host string, port int, usuario, clave, from string) *SMTP {
	if host == "" {
		host = GmailHost
	}
	if port == 0 {
		port = GmailPort
	}
	return &SMTP{Host: host, Port: port, Usuario: usuario, Clave: clave, From: from, Timeout: 20 * time.Second}
}

// Remitente devuelve la dirección que se usa como remitente (para mostrar en el panel).
func (s *SMTP) Remitente() string {
	if s.From != "" {
		return s.From
	}
	return s.Usuario
}

// Enviar implementa Sender.
func (s *SMTP) Enviar(ctx context.Context, para, asunto, texto string) error {
	from := s.Remitente()
	desde, err := mail.ParseAddress(from)
	if err != nil {
		return fmt.Errorf("smtp: remitente inválido: %w", err)
	}
	destino, err := mail.ParseAddress(para)
	if err != nil {
		return fmt.Errorf("smtp: destinatario inválido: %w", err)
	}
	cuerpo, err := ArmarMensaje(desde, destino, asunto, texto, time.Now())
	if err != nil {
		return err
	}

	timeout := s.Timeout
	if timeout == 0 {
		timeout = 20 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	dir := net.JoinHostPort(s.Host, strconv.Itoa(s.Port))
	var d net.Dialer
	conn, err := d.DialContext(ctx, "tcp", dir)
	if err != nil {
		return fmt.Errorf("smtp: no se pudo conectar a %s: %w", dir, err)
	}
	if limite, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(limite)
	}
	tlsConf := &tls.Config{ServerName: s.Host, MinVersion: tls.VersionTLS12}
	if s.Port == 465 {
		conn = tls.Client(conn, tlsConf)
	}
	c, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		conn.Close()
		return fmt.Errorf("smtp: %w", err)
	}
	defer c.Close()

	if s.Port != 465 {
		if ok, _ := c.Extension("STARTTLS"); !ok {
			return errors.New("smtp: el servidor no ofrece STARTTLS; no se manda la clave sin cifrar")
		}
		if err := c.StartTLS(tlsConf); err != nil {
			return fmt.Errorf("smtp: starttls: %w", err)
		}
	}
	if err := c.Auth(smtp.PlainAuth("", s.Usuario, s.Clave, s.Host)); err != nil {
		return fmt.Errorf("smtp: autenticación rechazada (para Gmail hace falta una contraseña de aplicación): %w", err)
	}
	if err := c.Mail(desde.Address); err != nil {
		return fmt.Errorf("smtp: remitente rechazado: %w", err)
	}
	if err := c.Rcpt(destino.Address); err != nil {
		return fmt.Errorf("smtp: destinatario rechazado: %w", err)
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp: %w", err)
	}
	if _, err := w.Write(cuerpo); err != nil {
		return fmt.Errorf("smtp: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp: el servidor no aceptó el mensaje: %w", err)
	}
	return c.Quit()
}

// ArmarMensaje arma el mail completo (encabezados + texto plano en UTF-8,
// quoted-printable). Rechaza saltos de línea en el asunto para que no se
// puedan inyectar encabezados.
func ArmarMensaje(desde, para *mail.Address, asunto, texto string, fecha time.Time) ([]byte, error) {
	if strings.ContainsAny(asunto, "\r\n") {
		return nil, errors.New("smtp: el asunto no puede tener saltos de línea")
	}
	var b bytes.Buffer
	enc := func(k, v string) { fmt.Fprintf(&b, "%s: %s\r\n", k, v) }
	enc("From", desde.String())
	enc("To", para.String())
	enc("Subject", mime.QEncoding.Encode("utf-8", asunto))
	enc("Date", fecha.Format(time.RFC1123Z))
	enc("Message-ID", fmt.Sprintf("<%s@%s>", idAleatorio(), dominio(desde.Address)))
	enc("MIME-Version", "1.0")
	enc("Content-Type", `text/plain; charset="utf-8"`)
	enc("Content-Transfer-Encoding", "quoted-printable")
	b.WriteString("\r\n")
	qp := quotedprintable.NewWriter(&b)
	normal := strings.ReplaceAll(strings.ReplaceAll(texto, "\r\n", "\n"), "\n", "\r\n")
	if _, err := qp.Write([]byte(normal)); err != nil {
		return nil, err
	}
	if err := qp.Close(); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

func idAleatorio() string {
	var r [12]byte
	_, _ = rand.Read(r[:])
	return hex.EncodeToString(r[:])
}

func dominio(dir string) string {
	if i := strings.LastIndex(dir, "@"); i >= 0 {
		return dir[i+1:]
	}
	return "movii.local"
}
