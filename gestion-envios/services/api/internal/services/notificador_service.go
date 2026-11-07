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

// franjas son las franjas horarias de reprogramación (HU-09) con su horario.
var franjas = map[string]string{
	"manana": "mañana (8 a 13 h)",
	"tarde":  "tarde (13 a 18 h)",
	"noche":  "noche (18 a 21 h)",
}

var relaciones = map[string]string{
	"destinatario": "el destinatario",
	"familiar":     "un familiar",
	"vecino":       "un vecino",
	"encargado":    "el encargado",
}

var (
	diasSemana = [...]string{"domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"}
	meses      = [...]string{"enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"}
)

// FechaLarga convierte "2026-11-09" en "lunes 9 de noviembre" (o "hoy" / "mañana").
func FechaLarga(iso string, ahora time.Time) string {
	f, err := time.ParseInLocation("2006-01-02", iso, ZonaAR)
	if err != nil {
		return iso
	}
	hoy := ahora.In(ZonaAR).Format("2006-01-02")
	manana := ahora.In(ZonaAR).AddDate(0, 0, 1).Format("2006-01-02")
	texto := fmt.Sprintf("%s %d de %s", diasSemana[f.Weekday()], f.Day(), meses[f.Month()-1])
	switch iso {
	case hoy:
		return "hoy, " + texto
	case manana:
		return "mañana, " + texto
	}
	return texto
}

func primerNombre(nombre string) string {
	if p := strings.Fields(nombre); len(p) > 0 {
		return p[0]
	}
	return ""
}

func saludo(nombre string) string {
	if n := primerNombre(nombre); n != "" {
		return "Hola, " + n + " 👋"
	}
	return "Hola 👋"
}

// firma cierra todos los mensajes, igual en todos los avisos.
const firma = "\n\n— *Movii* · Envíos y distribución"

// MensajeEnvio redacta el aviso al destinatario. Devuelve tipo "" si el estado
// no amerita aviso (ej. recién asignado a una ruta).
func MensajeEnvio(d repository.DatosAvisoEnvio, webURL string) (tipo, texto string) {
	return mensajeEnvio(d, webURL, time.Now())
}

func mensajeEnvio(d repository.DatosAvisoEnvio, webURL string, ahora time.Time) (tipo, texto string) {
	link := webURL + "/tracking/" + d.CodigoGuia
	var b strings.Builder
	linea := func(format string, args ...any) { fmt.Fprintf(&b, format+"\n", args...) }
	remitente := ""
	if d.Remitente != "" {
		remitente = " de *" + d.Remitente + "*"
	}

	switch d.Estado {
	case domain.EstadoEnvioEnCamino:
		linea("🚚 *Tu envío está en camino*")
		linea("")
		linea("%s", saludo(d.Destinatario))
		linea("Tu paquete%s salió del depósito y *hoy* lo llevamos a:", remitente)
		linea("📍 %s", d.Direccion)
		linea("")
		linea("📦 Código: *%s*", d.CodigoGuia)
		if d.Repartidor != nil {
			if d.Patente != nil {
				linea("👤 Lo lleva *%s* en el vehículo *%s*", primerNombre(*d.Repartidor), *d.Patente)
			} else {
				linea("👤 Lo lleva *%s*", primerNombre(*d.Repartidor))
			}
		}
		linea("")
		linea("🗺️ Seguí el camión en vivo:")
		b.WriteString(link)
		b.WriteString("\n\n_Si no vas a estar, dejá aviso a alguien de confianza para que lo reciba._")
		b.WriteString(firma)
		return AvisoEnCamino, b.String()

	case domain.EstadoEnvioEntregado:
		linea("✅ *¡Tu envío fue entregado!*")
		linea("")
		linea("%s", saludo(d.Destinatario))
		if d.HoraEntrega != nil {
			linea("Entregamos tu paquete%s *hoy a las %s*.", remitente, *d.HoraEntrega)
		} else {
			linea("Entregamos tu paquete%s.", remitente)
		}
		linea("")
		linea("📦 Código: *%s*", d.CodigoGuia)
		linea("📍 %s", d.Direccion)
		if d.Receptor != nil {
			quien := ""
			if d.RelacionReceptor != nil && *d.RelacionReceptor != "destinatario" {
				quien = " (" + relaciones[*d.RelacionReceptor] + ")"
			}
			linea("✍️ Recibió y firmó: *%s*%s", *d.Receptor, quien)
		}
		linea("")
		linea("🧾 Comprobante y detalle:")
		b.WriteString(link)
		b.WriteString("\n\n¡Gracias por elegirnos! 💛")
		b.WriteString(firma)
		return AvisoEntregado, b.String()

	case domain.EstadoEnvioNoEntregado:
		motivo := "no pudimos completar la entrega"
		if d.Motivo != nil {
			if e, ok := domain.EtiquetasMotivo[*d.Motivo]; ok {
				motivo = e
			}
		}
		linea("⚠️ *No pudimos entregar tu envío*")
		linea("")
		linea("%s", saludo(d.Destinatario))
		linea("Hoy pasamos por tu domicilio con tu paquete%s, pero no pudimos entregarlo.", remitente)
		linea("")
		linea("📦 Código: *%s*", d.CodigoGuia)
		linea("📍 %s", d.Direccion)
		linea("❗ Motivo: *%s*", motivo)
		linea("")
		linea("🔁 Vamos a reprogramar la visita y te avisamos por acá la nueva fecha.")
		linea("")
		linea("Seguimiento:")
		b.WriteString(link)
		b.WriteString(firma)
		return AvisoNoEntregado, b.String()

	case domain.EstadoEnvioPendiente:
		if d.ReprogramadoPara == nil {
			return "", ""
		}
		linea("📅 *Nueva fecha de entrega*")
		linea("")
		linea("%s", saludo(d.Destinatario))
		linea("Reprogramamos la entrega de tu paquete%s:", remitente)
		linea("")
		linea("🗓️ *%s*", mayuscula(FechaLarga(*d.ReprogramadoPara, ahora)))
		if d.Franja != nil {
			if f, ok := franjas[*d.Franja]; ok {
				linea("🕒 Por la *%s*", f)
			}
		}
		linea("📍 %s", d.Direccion)
		linea("📦 Código: *%s*", d.CodigoGuia)
		linea("")
		linea("Ese día te avisamos cuando el camión salga para tu domicilio. Seguimiento:")
		b.WriteString(link)
		b.WriteString(firma)
		return AvisoReprogramado, b.String()
	}
	return "", ""
}

func mayuscula(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	return strings.ToUpper(string(r[0])) + string(r[1:])
}

// MensajeRuta redacta el aviso al repartidor.
func MensajeRuta(d repository.DatosAvisoRuta, appURL string) string {
	return mensajeRuta(d, appURL, time.Now())
}

func mensajeRuta(d repository.DatosAvisoRuta, appURL string, ahora time.Time) string {
	var b strings.Builder
	linea := func(format string, args ...any) { fmt.Fprintf(&b, format+"\n", args...) }
	envios := "1 envío"
	if d.Envios != 1 {
		envios = fmt.Sprintf("%d envíos", d.Envios)
	}
	linea("📦 *Tenés una ruta asignada*")
	linea("")
	linea("%s", saludo(d.Repartidor))
	linea("Esta es tu ruta para *%s*:", FechaLarga(d.Fecha, ahora))
	linea("")
	if d.Zona != "" {
		linea("🛣️ *%s* · zona %s", d.Nombre, d.Zona)
	} else {
		linea("🛣️ *%s*", d.Nombre)
	}
	linea("📦 %s para entregar", envios)
	if d.Patente != "" {
		linea("🚚 Vehículo: *%s*", d.Patente)
	}
	linea("🏁 Salida: depósito central")
	if appURL != "" {
		linea("")
		linea("Abrí la app para ver el recorrido por calles y el orden de las paradas:")
		b.WriteString(appURL)
		b.WriteString("\n")
	}
	b.WriteString("\n¡Buen viaje y manejá con cuidado! 🙌")
	b.WriteString(firma)
	return b.String()
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
