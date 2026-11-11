package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
)

// Canales por los que sale un aviso (columna notificaciones_whatsapp.canal).
const (
	CanalAvisoWhatsapp = "whatsapp"
	CanalAvisoMail     = "mail"
)

// franjas son las franjas horarias de reprogramación (HU-09) con su horario.
var franjas = map[string]string{
	"manana": "por la mañana (de 8 a 13 h)",
	"tarde":  "por la tarde (de 13 a 18 h)",
	"noche":  "por la noche (de 18 a 21 h)",
}

var relaciones = map[string]string{
	"familiar":  "familiar",
	"vecino":    "vecino/a",
	"encargado": "encargado/a del edificio",
}

var (
	diasSemana = [...]string{"domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"}
	meses      = [...]string{"enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"}
)

// FechaLarga convierte "2026-11-09" en "lunes 9 de noviembre" (o "hoy, ..." / "mañana, ...").
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

// paraFecha arma "para el lunes 9 de noviembre" o "para mañana, martes 10 de noviembre".
func paraFecha(iso string, ahora time.Time) string {
	f := FechaLarga(iso, ahora)
	if strings.HasPrefix(f, "hoy,") || strings.HasPrefix(f, "mañana,") {
		return "para " + f
	}
	return "para el " + f
}

func primerNombre(nombre string) string {
	if p := strings.Fields(nombre); len(p) > 0 {
		return p[0]
	}
	return ""
}

// saludo según la hora de Argentina: "Buenos días, Lucía." (sin nombre si no hay).
func saludo(nombre string, ahora time.Time) string {
	s := "Buenas noches"
	switch h := ahora.In(ZonaAR).Hour(); {
	case h >= 5 && h < 12:
		s = "Buenos días"
	case h >= 12 && h < 20:
		s = "Buenas tardes"
	}
	if n := primerNombre(nombre); n != "" {
		return s + ", " + n + "."
	}
	return s + "."
}

// firma cierra todos los mensajes, igual en todos los avisos.
const firma = "\n\nMovii | Envíos y distribución\nEste es un mensaje automático."

// Aviso es un mensaje listo para mandar: el texto sirve tal cual para
// WhatsApp y para el cuerpo del mail; el asunto, para el mail.
type Aviso struct {
	Tipo   string
	Asunto string
	Texto  string
}

// MensajeEnvio redacta el aviso al destinatario. Devuelve tipo "" si el estado
// no amerita aviso (ej. recién asignado a una ruta).
func MensajeEnvio(d repository.DatosAvisoEnvio, webURL string) (tipo, texto string) {
	a := avisoEnvio(d, webURL, time.Now())
	return a.Tipo, a.Texto
}

func mensajeEnvio(d repository.DatosAvisoEnvio, webURL string, ahora time.Time) (tipo, texto string) {
	a := avisoEnvio(d, webURL, ahora)
	return a.Tipo, a.Texto
}

func avisoEnvio(d repository.DatosAvisoEnvio, webURL string, ahora time.Time) Aviso {
	link := webURL + "/tracking/" + d.CodigoGuia
	var b strings.Builder
	parrafo := func(format string, args ...any) {
		if b.Len() > 0 {
			b.WriteString("\n\n")
		}
		fmt.Fprintf(&b, format, args...)
	}
	envio := "su envío " + d.CodigoGuia
	if d.Remitente != "" {
		envio += ", de " + d.Remitente + ","
	}

	parrafo("%s", saludo(d.Destinatario, ahora))
	switch d.Estado {
	case domain.EstadoEnvioEnCamino:
		texto := fmt.Sprintf("Le informamos que %s salió hoy a reparto con destino a %s.", envio, d.Direccion)
		if d.Repartidor != nil {
			texto += " Lo entrega " + primerNombre(*d.Repartidor)
			if d.Patente != nil {
				texto += " en el vehículo " + *d.Patente
			}
			texto += "."
		}
		parrafo("%s", texto)
		parrafo("Puede seguir el recorrido en tiempo real desde el siguiente enlace:\n%s", link)
		parrafo("Si no va a estar en el domicilio, puede recibirlo otra persona mayor de edad en su nombre.")
		b.WriteString(firma)
		return Aviso{Tipo: AvisoEnCamino, Asunto: "Su envío " + d.CodigoGuia + " está en camino", Texto: b.String()}

	case domain.EstadoEnvioEntregado:
		cuando := "hoy"
		if d.HoraEntrega != nil {
			cuando = "hoy a las " + *d.HoraEntrega
		}
		texto := fmt.Sprintf("Le confirmamos que %s fue entregado %s en %s.", envio, cuando, d.Direccion)
		if d.Receptor != nil {
			texto += " Lo recibió " + *d.Receptor
			if d.RelacionReceptor != nil {
				if rel, ok := relaciones[*d.RelacionReceptor]; ok {
					texto += " (" + rel + ")"
				}
			}
			texto += "."
		}
		parrafo("%s", texto)
		parrafo("El comprobante de entrega está disponible en:\n%s", link)
		parrafo("Gracias por confiar en nosotros.")
		b.WriteString(firma)
		return Aviso{Tipo: AvisoEntregado, Asunto: "Su envío " + d.CodigoGuia + " fue entregado", Texto: b.String()}

	case domain.EstadoEnvioNoEntregado:
		parrafo("Le informamos que hoy visitamos %s para entregar %s pero no fue posible completar la entrega.", d.Direccion, envio)
		if d.Motivo != nil {
			if e, ok := domain.EtiquetasMotivo[*d.Motivo]; ok {
				parrafo("Motivo: %s.", e)
			}
		}
		parrafo("Vamos a coordinar una nueva visita y le informaremos la fecha por este mismo medio. Puede consultar el estado del envío en:\n%s", link)
		b.WriteString(firma)
		return Aviso{Tipo: AvisoNoEntregado, Asunto: "No pudimos entregar su envío " + d.CodigoGuia, Texto: b.String()}

	case domain.EstadoEnvioPendiente:
		if d.ReprogramadoPara == nil {
			return Aviso{}
		}
		texto := fmt.Sprintf("Le informamos que la entrega de %s fue reprogramada %s", envio, paraFecha(*d.ReprogramadoPara, ahora))
		if d.Franja != nil {
			if f, ok := franjas[*d.Franja]; ok {
				texto += ", " + f
			}
		}
		texto += ", en " + d.Direccion + "."
		parrafo("%s", texto)
		parrafo("Ese día le avisaremos cuando el vehículo salga hacia su domicilio. Seguimiento del envío:\n%s", link)
		b.WriteString(firma)
		return Aviso{Tipo: AvisoReprogramado, Asunto: "Nueva fecha de entrega para su envío " + d.CodigoGuia, Texto: b.String()}
	}
	return Aviso{}
}

// MensajeRuta redacta el aviso al repartidor.
func MensajeRuta(d repository.DatosAvisoRuta, appURL string) string {
	return mensajeRuta(d, appURL, time.Now())
}

func mensajeRuta(d repository.DatosAvisoRuta, appURL string, ahora time.Time) string {
	var b strings.Builder
	ruta := d.Nombre
	if d.Zona != "" {
		ruta += " (zona " + d.Zona + ")"
	}
	b.WriteString(saludo(d.Repartidor, ahora))
	fmt.Fprintf(&b, "\n\nSe le asignó la ruta %s %s.", ruta, paraFecha(d.Fecha, ahora))
	fmt.Fprintf(&b, "\n\nEnvíos a entregar: %d", d.Envios)
	if d.Patente != "" {
		fmt.Fprintf(&b, "\nVehículo: %s", d.Patente)
	}
	b.WriteString("\nSalida: depósito central")
	if appURL != "" {
		fmt.Fprintf(&b, "\n\nEl recorrido y el orden de las paradas están disponibles en la aplicación:\n%s", appURL)
	}
	b.WriteString(firma)
	return b.String()
}

func asuntoRuta(d repository.DatosAvisoRuta, ahora time.Time) string {
	return "Ruta asignada: " + d.Nombre + " " + paraFecha(d.Fecha, ahora)
}

func (n *Notificador) avisarEnvio(ctx context.Context, envioID string) error {
	d, err := n.repo.DatosAvisoEnvio(ctx, envioID)
	if err != nil {
		return fmt.Errorf("envío %s: %w", envioID, err)
	}
	a := avisoEnvio(d, n.webURL, time.Now())
	if a.Tipo == "" {
		return nil
	}
	// La clave usa el último evento: si el envío vuelve a salir a reparto otro día, es otro aviso.
	clave := fmt.Sprintf("envio:%s:%s:%s", d.EnvioID, a.Tipo, d.UltimoEventoID)
	return n.mandar(ctx, repository.Notificacion{Clave: clave, Tipo: a.Tipo, EnvioID: &d.EnvioID, Mensaje: a.Texto},
		destinoAviso{telefono: d.Telefono, email: d.Email, demo: d.Demo}, a.Asunto)
}

func (n *Notificador) avisarRuta(ctx context.Context, rutaID string) error {
	d, err := n.repo.DatosAvisoRuta(ctx, rutaID)
	if err != nil {
		return fmt.Errorf("ruta %s: %w", rutaID, err)
	}
	ahora := time.Now()
	// Con cada tanda de envíos asignados el repartidor recibe el total actualizado.
	clave := fmt.Sprintf("ruta:%s:%d", d.RutaID, d.Envios)
	return n.mandar(ctx, repository.Notificacion{Clave: clave, Tipo: AvisoRutaAsignada, RutaID: &d.RutaID, Mensaje: mensajeRuta(d, n.appURL, ahora)},
		destinoAviso{telefono: d.Telefono, email: d.Email}, asuntoRuta(d, ahora))
}

// destinoAviso son los datos de contacto de quien recibe el aviso.
type destinoAviso struct {
	telefono string
	email    string
	// demo: datos ficticios de cmd/demo; el aviso se registra como "simulado" y no se manda.
	demo bool
}

// dominiosReservados no reciben mails (RFC 2606 y las cuentas de demostración).
var dominiosReservados = []string{".demo", ".test", ".example", ".invalid", ".localhost", "@example.com", "@example.net", "@example.org"}

// mailUtil devuelve el mail normalizado si sirve para mandar avisos, o "".
func mailUtil(email string) string {
	e := strings.ToLower(strings.TrimSpace(email))
	if e == "" || !emailValido(e) {
		return ""
	}
	for _, r := range dominiosReservados {
		if strings.HasSuffix(e, r) {
			return ""
		}
	}
	return e
}

// whatsappListo dice si WhatsApp puede entregar mensajes ahora.
func (n *Notificador) whatsappListo() bool {
	e := n.sender.Estado()
	return e.Habilitado && e.Vinculado
}

// mandar elige el canal, registra el aviso y lo envía. Orden: WhatsApp si está
// vinculado y el número es válido; si no, mail (si hay uno y el canal de mail
// está configurado); si WhatsApp falla al enviar, se reintenta por mail. Sin
// ningún destino válido el aviso queda "omitido".
func (n *Notificador) mandar(ctx context.Context, notif repository.Notificacion, dst destinoAviso, asunto string) error {
	tel, errTel := NormalizarTelefonoAR(dst.telefono)
	email := ""
	if n.mail != nil {
		email = mailUtil(dst.email)
	}

	canal, destino := "", ""
	switch {
	case errTel == nil && n.whatsappListo():
		canal, destino = CanalAvisoWhatsapp, tel
	case email != "":
		canal, destino = CanalAvisoMail, email
	case errTel == nil:
		// WhatsApp sin vincular y sin mail: se intenta igual y queda el error registrado.
		canal, destino = CanalAvisoWhatsapp, tel
	}

	if canal == "" {
		notif.Canal = CanalAvisoWhatsapp
		notif.Telefono = strings.TrimSpace(dst.telefono)
		if notif.Telefono == "" {
			notif.Telefono = "-"
		}
		notif.Estado, notif.Error = "omitido", "sin celular ni mail válidos"
		_, _, err := n.repo.RegistrarNotificacion(ctx, notif)
		return err
	}
	notif.Canal, notif.Telefono = canal, destino
	if dst.demo {
		notif.Estado = "simulado"
		_, _, err := n.repo.RegistrarNotificacion(ctx, notif)
		return err
	}

	id, nuevo, err := n.repo.RegistrarNotificacion(ctx, notif)
	if err != nil || !nuevo {
		return err
	}
	errEnvio := n.enviarPor(ctx, canal, destino, asunto, notif.Mensaje)
	if errEnvio != nil && canal == CanalAvisoWhatsapp && email != "" {
		if errMail := n.enviarPor(ctx, CanalAvisoMail, email, asunto, notif.Mensaje); errMail == nil {
			canal, destino, errEnvio = CanalAvisoMail, email, nil
		} else {
			errEnvio = fmt.Errorf("%v; por mail: %v", errEnvio, errMail)
		}
	}
	return n.repo.ResultadoNotificacion(ctx, id, canal, destino, errEnvio)
}

func (n *Notificador) enviarPor(ctx context.Context, canal, destino, asunto, texto string) error {
	if canal == CanalAvisoMail {
		return n.mail.Enviar(ctx, destino, "Movii | "+asunto, texto)
	}
	err := n.sender.Enviar(ctx, destino, texto)
	switch {
	case errors.Is(err, whatsapp.ErrSinWhatsApp):
		return errors.New("el número no tiene WhatsApp")
	case errors.Is(err, whatsapp.ErrNoVinculado):
		return errors.New("WhatsApp no está vinculado")
	}
	return err
}
