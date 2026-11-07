// Package whatsapp envía mensajes de texto por WhatsApp (HU-16, HU-17).
//
// La implementación real usa whatsmeow: una cuenta de WhatsApp común vinculada
// como "dispositivo" escaneando un QR desde el panel del admin (igual que
// WhatsApp Web). No es la API oficial de Meta: no requiere cuenta Business ni
// plantillas aprobadas, pero WhatsApp puede limitar números que envían mucho;
// para un uso real conviene migrar a la Cloud API detrás de la misma interfaz.
package whatsapp

import (
	"context"
	"errors"
	"log"
	"time"
)

// ErrNoVinculado indica que todavía no se escaneó el QR (o se cerró la sesión).
var ErrNoVinculado = errors.New("whatsapp: la cuenta no está vinculada")

// ErrSinWhatsApp indica que el número no tiene cuenta de WhatsApp.
var ErrSinWhatsApp = errors.New("whatsapp: el número no tiene WhatsApp")

// Estado es el estado de la conexión que ve el admin.
type Estado struct {
	Habilitado bool      `json:"habilitado"`
	Conectado  bool      `json:"conectado"`
	Vinculado  bool      `json:"vinculado"`
	Numero     string    `json:"numero,omitempty"`
	QR         string    `json:"qr,omitempty"` // contenido del QR a escanear (vacío si no hay uno vigente)
	QRVence    time.Time `json:"qr_vence,omitempty"`
}

// Sender es lo que la aplicación necesita para mandar avisos y códigos.
type Sender interface {
	// Enviar manda un texto al número (formato internacional sin "+").
	Enviar(ctx context.Context, telefono, texto string) error
	// Estado devuelve el estado de la conexión.
	Estado() Estado
}

// Administrable es un Sender que además se puede vincular y desvincular.
type Administrable interface {
	Sender
	// IniciarVinculacion genera un QR nuevo si la cuenta no está vinculada.
	IniciarVinculacion(ctx context.Context) error
	// Desvincular cierra la sesión de WhatsApp en este servidor.
	Desvincular(ctx context.Context) error
}

// SoloLog es el Sender de desarrollo: no manda nada, escribe el mensaje en el
// log del servidor. Se usa cuando WHATSAPP_HABILITADO no es "true".
type SoloLog struct{}

// Enviar implementa Sender.
func (SoloLog) Enviar(_ context.Context, telefono, texto string) error {
	log.Printf("[whatsapp deshabilitado] para %s: %s", telefono, texto)
	return nil
}

// Estado implementa Sender.
func (SoloLog) Estado() Estado { return Estado{Habilitado: false} }

// IniciarVinculacion implementa Administrable.
func (SoloLog) IniciarVinculacion(context.Context) error { return nil }

// Desvincular implementa Administrable.
func (SoloLog) Desvincular(context.Context) error { return nil }
