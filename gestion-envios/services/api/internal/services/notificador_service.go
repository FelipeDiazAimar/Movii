package services

import (
	"context"
	"log"
	"strings"
	"time"

	"movii/api/internal/platform/mail"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
)

// Tipos de aviso (columna notificaciones_whatsapp.tipo).
const (
	AvisoEnCamino      = "envio_en_camino"
	AvisoEntregado     = "envio_entregado"
	AvisoNoEntregado   = "envio_no_entregado"
	AvisoReprogramado  = "envio_reprogramado"
	AvisoRutaAsignada  = "ruta_asignada"
	capacidadColaAviso = 256
)

// notificadorRepo es lo que el Notificador necesita de la base (repository.WhatsappRepo lo implementa).
type notificadorRepo interface {
	DatosAvisoEnvio(ctx context.Context, envioID string) (repository.DatosAvisoEnvio, error)
	DatosAvisoRuta(ctx context.Context, rutaID string) (repository.DatosAvisoRuta, error)
	RegistrarNotificacion(ctx context.Context, n repository.Notificacion) (string, bool, error)
	ResultadoNotificacion(ctx context.Context, id, canal, destino string, envioErr error) error
}

type tareaAviso struct {
	envioID string
	rutaID  string
}

// Notificador manda por WhatsApp (o, de respaldo, por mail) los avisos de HU-17: al destinatario cuando
// su envío sale a reparto, se entrega, falla o se reprograma (siempre con el
// link de seguimiento), y al repartidor cuando se le asignan envíos. Trabaja
// con una cola: quien dispara el aviso no espera ni se entera si falla. Cada
// aviso queda registrado y una clave única evita mandarlo dos veces.
type Notificador struct {
	repo   notificadorRepo
	sender whatsapp.Sender
	mail   mail.Sender
	webURL string
	appURL string
	cola   chan tareaAviso
	listo  chan struct{}
}

// NewNotificador crea un Notificador. webURL es la URL pública de la web (para
// el link de tracking) y appURL la del panel del repartidor.
func NewNotificador(repo notificadorRepo, sender whatsapp.Sender, webURL, appURL string) *Notificador {
	return &Notificador{
		repo: repo, sender: sender,
		webURL: strings.TrimRight(webURL, "/"), appURL: appURL,
		cola: make(chan tareaAviso, capacidadColaAviso), listo: make(chan struct{}),
	}
}

// ConMail agrega el mail como canal de respaldo: se usa cuando WhatsApp no
// está vinculado, el número no es válido o no tiene WhatsApp, y el
// destinatario tiene mail. Sin llamarlo, los avisos solo salen por WhatsApp.
func (n *Notificador) ConMail(m mail.Sender) *Notificador {
	n.mail = m
	return n
}

// CambioDeEstado implementa AvisosEnvio.
func (n *Notificador) CambioDeEstado(envioID string) { n.encolar(tareaAviso{envioID: envioID}) }

// RutaAsignada implementa AvisosRuta.
func (n *Notificador) RutaAsignada(rutaID string) { n.encolar(tareaAviso{rutaID: rutaID}) }

func (n *Notificador) encolar(t tareaAviso) {
	select {
	case n.cola <- t:
	default:
		log.Printf("avisos: cola llena, se descarta el aviso %+v", t)
	}
}

// Correr procesa la cola hasta que se cancele ctx.
func (n *Notificador) Correr(ctx context.Context) {
	defer close(n.listo)
	for {
		select {
		case <-ctx.Done():
			return
		case t := <-n.cola:
			c, cancel := context.WithTimeout(ctx, 45*time.Second)
			var err error
			if t.envioID != "" {
				err = n.avisarEnvio(c, t.envioID)
			} else {
				err = n.avisarRuta(c, t.rutaID)
			}
			cancel()
			if err != nil && ctx.Err() == nil {
				log.Printf("avisos: %v", err)
			}
		}
	}
}

// Procesar atiende de inmediato todo lo encolado (para tests y scripts).
func (n *Notificador) Procesar(ctx context.Context) {
	for {
		select {
		case t := <-n.cola:
			if t.envioID != "" {
				_ = n.avisarEnvio(ctx, t.envioID)
			} else {
				_ = n.avisarRuta(ctx, t.rutaID)
			}
		default:
			return
		}
	}
}
