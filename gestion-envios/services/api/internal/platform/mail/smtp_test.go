package mail

import (
	"io"
	"mime"
	"mime/quotedprintable"
	"net/mail"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestArmarMensaje(t *testing.T) {
	desde := &mail.Address{Name: "Movii", Address: "avisos@movii.test"}
	para := &mail.Address{Address: "lucia@cliente.test"}
	fecha := time.Date(2026, 11, 11, 10, 0, 0, 0, time.UTC)

	crudo, err := ArmarMensaje(desde, para, "Su envío está en camino", "Buenos días, Lucía.\nLínea dos.", fecha)
	require.NoError(t, err)
	msg, err := mail.ReadMessage(strings.NewReader(string(crudo)))
	require.NoError(t, err)

	asunto, err := new(mimeDecoder).DecodeHeader(msg.Header.Get("Subject"))
	require.NoError(t, err)
	require.Equal(t, "Su envío está en camino", asunto)
	require.Equal(t, `"Movii" <avisos@movii.test>`, msg.Header.Get("From"))
	require.Equal(t, "<lucia@cliente.test>", msg.Header.Get("To"))
	require.Contains(t, msg.Header.Get("Content-Type"), "utf-8")
	require.True(t, strings.HasSuffix(msg.Header.Get("Message-ID"), "@movii.test>"))

	cuerpo, err := io.ReadAll(quotedprintable.NewReader(msg.Body))
	require.NoError(t, err)
	require.Equal(t, "Buenos días, Lucía.\r\nLínea dos.", string(cuerpo))
}

func TestArmarMensaje_RechazaInyeccionDeEncabezados(t *testing.T) {
	_, err := ArmarMensaje(&mail.Address{Address: "a@b.test"}, &mail.Address{Address: "c@d.test"}, "Hola\r\nBcc: x@y.test", "texto", time.Now())
	require.Error(t, err)
}

func TestNewSMTP_ValoresDeGmail(t *testing.T) {
	s := NewSMTP("", 0, "cuenta@gmail.com", "clave", "")
	require.Equal(t, GmailHost, s.Host)
	require.Equal(t, GmailPort, s.Port)
	require.Equal(t, "cuenta@gmail.com", s.Remitente())
}

type mimeDecoder = mime.WordDecoder
