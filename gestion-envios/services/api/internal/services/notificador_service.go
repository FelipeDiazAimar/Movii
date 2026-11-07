package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"movii/api/internal/domain"
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
	ResultadoNotificacion(ctx context.Context, id string, envioErr error) error
}

type tareaAviso struct {
	envioID string
	rutaID  string
}

// Notificador manda por WhatsApp los avisos de HU-17: al destinatario cuando
// su envío sale a reparto, se entrega, falla o se reprograma (siempre con el
// link de seguimiento), y al repartidor cuando se le asignan envíos. Trabaja
// con una cola: quien dispara el aviso no espera ni se entera si falla. Cada
// aviso queda registrado y una clave única evita mandarlo dos veces.
type Notificador struct {
	repo   notificadorRepo
	sender whatsapp.Sender
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

var franjas = map[string]string{"manana": "mañana", "tarde": "tarde", "noche": "noche"}

// MensajeEnvio redacta el aviso al destinatario. Devuelve tipo "" si el estado
// no amerita aviso (ej. recién asignado a una ruta).
func MensajeEnvio(d repository.DatosAvisoEnvio, webURL string) (tipo, texto string) {
	link := webURL + "/tracking/" + d.CodigoGuia
	nombre := strings.Fields(d.Destinatario)
	saludo := "Hola"
	if len(nombre) > 0 {
		saludo = "Hola " + nombre[0]
	}
	switch d.Estado {
	case domain.EstadoEnvioEnCamino:
		return AvisoEnCamino, fmt.Sprintf("%s! 🚚 Tu envío *%s* salió a reparto y hoy llega a %s.\nSeguilo en vivo: %s", saludo, d.CodigoGuia, d.Direccion, link)
	case domain.EstadoEnvioEntregado:
		return AvisoEntregado, fmt.Sprintf("%s! ✅ Tu envío *%s* fue entregado. ¡Gracias por elegir Movii!\nDetalle: %s", saludo, d.CodigoGuia, link)
	case domain.EstadoEnvioNoEntregado:
		motivo := "no pudimos completar la entrega"
		if d.Motivo != nil {
			if e, ok := domain.EtiquetasMotivo[*d.Motivo]; ok {
				motivo = strings.ToLower(e)
			}
		}
		return AvisoNoEntregado, fmt.Sprintf("%s. ⚠️ Hoy no pudimos entregar tu envío *%s* (%s). Lo vamos a reprogramar y te avisamos.\nDetalle: %s", saludo, d.CodigoGuia, motivo, link)
	case domain.EstadoEnvioPendiente:
		if d.ReprogramadoPara == nil {
			return "", ""
		}
		cuando := *d.ReprogramadoPara
		if d.Franja != nil {
			cuando += " por la " + franjas[*d.Franja]
		}
		return AvisoReprogramado, fmt.Sprintf("%s! 📅 Reprogramamos la entrega de tu envío *%s* para el %s.\nSeguilo: %s", saludo, d.CodigoGuia, cuando, link)
	}
	return "", ""
}

// MensajeRuta redacta el aviso al repartidor.
func MensajeRuta(d repository.DatosAvisoRuta, appURL string) string {
	vehiculo := ""
	if d.Patente != "" {
		vehiculo = fmt.Sprintf(" en el vehículo *%s*", d.Patente)
	}
	envios := "1 envío"
	if d.Envios != 1 {
		envios = fmt.Sprintf("%d envíos", d.Envios)
	}
	nombre := strings.Fields(d.Repartidor)
	saludo := "Hola"
	if len(nombre) > 0 {
		saludo = "Hola " + nombre[0]
	}
	texto := fmt.Sprintf("%s! 📦 Tenés asignada la ruta *%s* (%s) para el %s con %s%s.", saludo, d.Nombre, d.Zona, d.Fecha, envios, vehiculo)
	if appURL != "" {
		texto += "\nAbrí la app de Movii para ver el recorrido: " + appURL
	}
	return texto
}

func (n *Notificador) avisarEnvio(ctx context.Context, envioID string) error {
	d, err := n.repo.DatosAvisoEnvio(ctx, envioID)
	if err != nil {
		return fmt.Errorf("envío %s: %w", envioID, err)
	}
	tipo, texto := MensajeEnvio(d, n.webURL)
	if tipo == "" {
		return nil
	}
	// La clave usa el último evento: si el envío vuelve a salir a reparto otro día, es otro aviso.
	clave := fmt.Sprintf("envio:%s:%s:%s", d.EnvioID, tipo, d.UltimoEventoID)
	return n.mandar(ctx, repository.Notificacion{Clave: clave, Tipo: tipo, EnvioID: &d.EnvioID, Mensaje: texto}, d.Telefono)
}

func (n *Notificador) avisarRuta(ctx context.Context, rutaID string) error {
	d, err := n.repo.DatosAvisoRuta(ctx, rutaID)
	if err != nil {
		return fmt.Errorf("ruta %s: %w", rutaID, err)
	}
	// Con cada tanda de envíos asignados el repartidor recibe el total actualizado.
	clave := fmt.Sprintf("ruta:%s:%d", d.RutaID, d.Envios)
	return n.mandar(ctx, repository.Notificacion{Clave: clave, Tipo: AvisoRutaAsignada, RutaID: &d.RutaID, Mensaje: MensajeRuta(d, n.appURL)}, d.Telefono)
}

// mandar registra el aviso y lo envía. Sin teléfono válido queda "omitido".
func (n *Notificador) mandar(ctx context.Context, notif repository.Notificacion, telefonoCrudo string) error {
	tel, errTel := NormalizarTelefonoAR(telefonoCrudo)
	notif.Telefono = tel
	if errTel != nil {
		notif.Telefono = strings.TrimSpace(telefonoCrudo)
		if notif.Telefono == "" {
			notif.Telefono = "-"
		}
		notif.Estado, notif.Error = "omitido", "teléfono vacío o inválido"
		_, _, err := n.repo.RegistrarNotificacion(ctx, notif)
		return err
	}
	id, nuevo, err := n.repo.RegistrarNotificacion(ctx, notif)
	if err != nil || !nuevo {
		return err
	}
	errEnvio := n.sender.Enviar(ctx, tel, notif.Mensaje)
	if errors.Is(errEnvio, whatsapp.ErrSinWhatsApp) {
		errEnvio = errors.New("el número no tiene WhatsApp")
	}
	return n.repo.ResultadoNotificacion(ctx, id, errEnvio)
}
