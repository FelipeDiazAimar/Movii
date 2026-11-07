// Package mail manda mails de texto (código de primer acceso, T1) por la API
// HTTP de Resend. Sin RESEND_API_KEY se usa SoloLog, igual que WhatsApp
// deshabilitado: el mail se escribe en el log del servidor.
package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// Sender manda un mail de texto plano.
type Sender interface {
	Enviar(ctx context.Context, para, asunto, texto string) error
}

// SoloLog es el Sender de desarrollo: no manda nada, lo escribe en el log.
type SoloLog struct{}

// Enviar implementa Sender.
func (SoloLog) Enviar(_ context.Context, para, asunto, texto string) error {
	log.Printf("[mail deshabilitado] para %s: %s\n%s", para, asunto, texto)
	return nil
}

// Resend manda mails con la API de Resend (https://resend.com/docs/api-reference/emails/send-email).
type Resend struct {
	APIKey string
	From   string
	URL    string // vacío = https://api.resend.com/emails (los tests lo cambian)
	HTTP   *http.Client
}

// NewResend crea el Sender real.
func NewResend(apiKey, from string) *Resend {
	return &Resend{APIKey: apiKey, From: from, HTTP: &http.Client{Timeout: 15 * time.Second}}
}

// Enviar implementa Sender.
func (r *Resend) Enviar(ctx context.Context, para, asunto, texto string) error {
	url := r.URL
	if url == "" {
		url = "https://api.resend.com/emails"
	}
	body, err := json.Marshal(map[string]any{"from": r.From, "to": []string{para}, "subject": asunto, "text": texto})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := r.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("resend: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		detalle, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("resend: status %d: %s", resp.StatusCode, detalle)
	}
	return nil
}
