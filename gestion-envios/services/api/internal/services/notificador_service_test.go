package services

import (
	"context"
	"errors"
	"testing"
	"time"
	"unicode"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
)

func ptr(s string) *string { return &s }

// sinEmojis falla si el texto tiene símbolos gráficos (emojis, pictogramas).
func sinEmojis(t *testing.T, texto string) {
	t.Helper()
	for _, r := range texto {
		require.False(t, r > 0x2000 && (unicode.Is(unicode.So, r) || unicode.Is(unicode.Sk, r)), "símbolo %q en %q", r, texto)
	}
}

func TestMensajeEnvio(t *testing.T) {
	ahora := time.Date(2026, 11, 7, 10, 0, 0, 0, ZonaAR) // sábado a la mañana
	base := repository.DatosAvisoEnvio{CodigoGuia: "MOV-1", Destinatario: "Lucía Fernández", Direccion: "Belgrano 1950, San Francisco", Remitente: "Tienda Sol"}

	casos := []struct {
		nombre   string
		ajustar  func(*repository.DatosAvisoEnvio)
		tipo     string
		contiene []string
	}{
		{"en camino", func(d *repository.DatosAvisoEnvio) {
			d.Estado = domain.EstadoEnvioEnCamino
			d.Repartidor = ptr("Carla Repartidora")
			d.Patente = ptr("TRK-318")
		}, AvisoEnCamino, []string{"Buenos días, Lucía.", "su envío MOV-1, de Tienda Sol, salió hoy a reparto con destino a Belgrano 1950, San Francisco.", "Lo entrega Carla en el vehículo TRK-318.", "https://movii.test/tracking/MOV-1", "Movii | Envíos y distribución"}},
		{"entregado", func(d *repository.DatosAvisoEnvio) {
			d.Estado = domain.EstadoEnvioEntregado
			d.HoraEntrega = ptr("15:42")
			d.Receptor = ptr("Juan Fernández")
			d.RelacionReceptor = ptr("familiar")
		}, AvisoEntregado, []string{"fue entregado hoy a las 15:42", "Lo recibió Juan Fernández (familiar).", "/tracking/MOV-1", "Gracias por confiar en nosotros."}},
		{"no entregado con motivo", func(d *repository.DatosAvisoEnvio) {
			d.Estado = domain.EstadoEnvioNoEntregado
			d.Motivo = ptr(domain.MotivoClienteAusente)
		}, AvisoNoEntregado, []string{"no fue posible completar la entrega", "Motivo: Destinatario ausente.", "nueva visita"}},
		{"reprogramado", func(d *repository.DatosAvisoEnvio) {
			d.Estado = domain.EstadoEnvioPendiente
			d.ReprogramadoPara = ptr("2026-11-09")
			d.Franja = ptr("manana")
		}, AvisoReprogramado, []string{"fue reprogramada para el lunes 9 de noviembre, por la mañana (de 8 a 13 h), en Belgrano 1950"}},
	}
	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			d := base
			c.ajustar(&d)
			a := avisoEnvio(d, "https://movii.test", ahora)
			require.Equal(t, c.tipo, a.Tipo)
			require.Contains(t, a.Asunto, "MOV-1")
			for _, s := range c.contiene {
				require.Contains(t, a.Texto, s)
			}
			require.NotContains(t, a.Texto, "*", "sin negritas de WhatsApp: el mismo texto va por mail")
			sinEmojis(t, a.Texto)
		})
	}

	t.Run("asignado o pendiente sin reprogramar no avisa", func(t *testing.T) {
		for _, e := range []string{domain.EstadoEnvioAsignado, domain.EstadoEnvioPendiente} {
			d := base
			d.Estado = e
			tipo, _ := mensajeEnvio(d, "https://movii.test", ahora)
			require.Empty(t, tipo, e)
		}
	})

	t.Run("saludo según la hora", func(t *testing.T) {
		require.Equal(t, "Buenas tardes, Ana.", saludo("Ana Paz", time.Date(2026, 11, 7, 15, 0, 0, 0, ZonaAR)))
		require.Equal(t, "Buenas noches.", saludo("", time.Date(2026, 11, 7, 22, 0, 0, 0, ZonaAR)))
	})
}

func TestFechaLarga(t *testing.T) {
	ahora := time.Date(2026, 11, 7, 23, 30, 0, 0, ZonaAR)
	require.Equal(t, "hoy, sábado 7 de noviembre", FechaLarga("2026-11-07", ahora))
	require.Equal(t, "mañana, domingo 8 de noviembre", FechaLarga("2026-11-08", ahora))
	require.Equal(t, "miércoles 25 de noviembre", FechaLarga("2026-11-25", ahora))
	require.Equal(t, "no-es-fecha", FechaLarga("no-es-fecha", ahora))
	require.Equal(t, "para mañana, domingo 8 de noviembre", paraFecha("2026-11-08", ahora))
	require.Equal(t, "para el miércoles 25 de noviembre", paraFecha("2026-11-25", ahora))
}

func TestMensajeRuta(t *testing.T) {
	ahora := time.Date(2026, 11, 7, 8, 0, 0, 0, ZonaAR)
	txt := mensajeRuta(repository.DatosAvisoRuta{Nombre: "Demo Centro", Zona: "Centro", Fecha: "2026-11-07", Repartidor: "Carla Repartidora", Envios: 5, Patente: "TRK-318"}, "https://movii.test/app/", ahora)
	for _, s := range []string{"Buenos días, Carla.", "Se le asignó la ruta Demo Centro (zona Centro) para hoy, sábado 7 de noviembre.", "Envíos a entregar: 5", "Vehículo: TRK-318", "https://movii.test/app/"} {
		require.Contains(t, txt, s)
	}
	sinEmojis(t, txt)
	require.Contains(t, mensajeRuta(repository.DatosAvisoRuta{Nombre: "R", Fecha: "2026-11-07", Envios: 1}, "", ahora), "Envíos a entregar: 1")
}

// notificadorRepoFalso registra lo que pasaría en la base.
type notificadorRepoFalso struct {
	envio      repository.DatosAvisoEnvio
	ruta       repository.DatosAvisoRuta
	claves     map[string]repository.Notificacion
	resultados map[string]resultadoFalso
}

type resultadoFalso struct {
	canal, destino string
	err            error
}

func nuevoRepoFalso() *notificadorRepoFalso {
	return &notificadorRepoFalso{claves: map[string]repository.Notificacion{}, resultados: map[string]resultadoFalso{}}
}

func (r *notificadorRepoFalso) DatosAvisoEnvio(context.Context, string) (repository.DatosAvisoEnvio, error) {
	return r.envio, nil
}
func (r *notificadorRepoFalso) DatosAvisoRuta(context.Context, string) (repository.DatosAvisoRuta, error) {
	return r.ruta, nil
}
func (r *notificadorRepoFalso) RegistrarNotificacion(_ context.Context, n repository.Notificacion) (string, bool, error) {
	if _, ok := r.claves[n.Clave]; ok {
		return "", false, nil
	}
	r.claves[n.Clave] = n
	return n.Clave, true, nil
}
func (r *notificadorRepoFalso) ResultadoNotificacion(_ context.Context, id, canal, destino string, err error) error {
	r.resultados[id] = resultadoFalso{canal, destino, err}
	return nil
}

// mailFalso guarda los mails "enviados".
type mailFalso struct {
	enviados map[string]string
	falla    error
}

func (m *mailFalso) Enviar(_ context.Context, para, asunto, texto string) error {
	if m.falla != nil {
		return m.falla
	}
	m.enviados[para] = asunto + "\n" + texto
	return nil
}

func unicoResultado(t *testing.T, repo *notificadorRepoFalso) resultadoFalso {
	t.Helper()
	require.Len(t, repo.resultados, 1)
	for _, r := range repo.resultados {
		return r
	}
	return resultadoFalso{}
}

func TestNotificador_MandaUnaSolaVezPorEvento(t *testing.T) {
	repo := nuevoRepoFalso()
	repo.envio = repository.DatosAvisoEnvio{EnvioID: "e1", CodigoGuia: "MOV-1", Estado: domain.EstadoEnvioEnCamino, UltimoEventoID: "ev1", Destinatario: "Ana", Telefono: "3564-412301"}
	sender := nuevoSender(true)
	n := NewNotificador(repo, sender, "https://movii.test", "")

	n.CambioDeEstado("e1")
	n.CambioDeEstado("e1") // mismo evento: no se repite
	n.Procesar(context.Background())

	require.Len(t, repo.claves, 1)
	require.Contains(t, sender.enviados["5493564412301"], "salió hoy a reparto")
	r := unicoResultado(t, repo)
	require.NoError(t, r.err)
	require.Equal(t, CanalAvisoWhatsapp, r.canal)
}

func TestNotificador_SinTelefonoNiMailQuedaOmitido(t *testing.T) {
	repo := nuevoRepoFalso()
	repo.envio = repository.DatosAvisoEnvio{EnvioID: "e1", CodigoGuia: "MOV-1", Estado: domain.EstadoEnvioEntregado, UltimoEventoID: "ev2"}
	sender := nuevoSender(true)
	n := NewNotificador(repo, sender, "https://movii.test", "").ConMail(&mailFalso{enviados: map[string]string{}})
	n.CambioDeEstado("e1")
	n.Procesar(context.Background())

	require.Len(t, repo.claves, 1)
	for _, notif := range repo.claves {
		require.Equal(t, "omitido", notif.Estado)
	}
	require.Empty(t, sender.enviados)
}

func TestNotificador_SinWhatsappVinculadoVaPorMail(t *testing.T) {
	repo := nuevoRepoFalso()
	repo.envio = repository.DatosAvisoEnvio{EnvioID: "e1", CodigoGuia: "MOV-1", Estado: domain.EstadoEnvioEnCamino, UltimoEventoID: "ev1", Destinatario: "Ana", Telefono: "3564412301", Email: " Ana@Correo.com.ar "}
	sender := nuevoSender(false)
	m := &mailFalso{enviados: map[string]string{}}
	n := NewNotificador(repo, sender, "https://movii.test", "").ConMail(m)
	n.CambioDeEstado("e1")
	n.Procesar(context.Background())

	require.Empty(t, sender.enviados)
	require.Contains(t, m.enviados["ana@correo.com.ar"], "Movii | Su envío MOV-1 está en camino")
	r := unicoResultado(t, repo)
	require.NoError(t, r.err)
	require.Equal(t, CanalAvisoMail, r.canal)
	require.Equal(t, "ana@correo.com.ar", r.destino)
}

func TestNotificador_SiWhatsappFallaReintentaPorMail(t *testing.T) {
	repo := nuevoRepoFalso()
	repo.envio = repository.DatosAvisoEnvio{EnvioID: "e1", CodigoGuia: "MOV-1", Estado: domain.EstadoEnvioEntregado, UltimoEventoID: "ev1", Destinatario: "Ana", Telefono: "3564412301", Email: "ana@correo.com.ar"}
	sender := nuevoSender(true)
	sender.falla = whatsapp.ErrSinWhatsApp
	m := &mailFalso{enviados: map[string]string{}}
	n := NewNotificador(repo, sender, "https://movii.test", "").ConMail(m)
	n.CambioDeEstado("e1")
	n.Procesar(context.Background())

	require.Contains(t, m.enviados["ana@correo.com.ar"], "fue entregado")
	r := unicoResultado(t, repo)
	require.NoError(t, r.err)
	require.Equal(t, CanalAvisoMail, r.canal)
}

func TestNotificador_SiFallanAmbosQuedaElError(t *testing.T) {
	repo := nuevoRepoFalso()
	repo.envio = repository.DatosAvisoEnvio{EnvioID: "e1", CodigoGuia: "MOV-1", Estado: domain.EstadoEnvioEntregado, UltimoEventoID: "ev1", Telefono: "3564412301", Email: "ana@correo.com.ar"}
	sender := nuevoSender(true)
	sender.falla = whatsapp.ErrSinWhatsApp
	n := NewNotificador(repo, sender, "https://movii.test", "").ConMail(&mailFalso{enviados: map[string]string{}, falla: errors.New("smtp caído")})
	n.CambioDeEstado("e1")
	n.Procesar(context.Background())

	r := unicoResultado(t, repo)
	require.ErrorContains(t, r.err, "no tiene WhatsApp")
	require.ErrorContains(t, r.err, "smtp caído")
}

func TestNotificador_DestinatarioDemoQuedaSimuladoSinEnviar(t *testing.T) {
	repo := nuevoRepoFalso()
	repo.envio = repository.DatosAvisoEnvio{EnvioID: "e1", CodigoGuia: "MOV-1", Estado: domain.EstadoEnvioEnCamino, UltimoEventoID: "ev1", Telefono: "3564412301", Email: "ana@correo.com.ar", Demo: true}
	sender := nuevoSender(true)
	m := &mailFalso{enviados: map[string]string{}}
	n := NewNotificador(repo, sender, "https://movii.test", "").ConMail(m)
	n.CambioDeEstado("e1")
	n.Procesar(context.Background())

	require.Empty(t, sender.enviados)
	require.Empty(t, m.enviados)
	require.Len(t, repo.claves, 1)
	for _, notif := range repo.claves {
		require.Equal(t, "simulado", notif.Estado)
		require.Equal(t, CanalAvisoWhatsapp, notif.Canal)
		require.NotEmpty(t, notif.Mensaje)
	}
}

func TestNotificador_NoMandaMailsADominiosReservados(t *testing.T) {
	for _, email := range []string{"carla@movii.demo", "x@example.com", "y@algo.test", "no-es-mail"} {
		require.Empty(t, mailUtil(email), email)
	}
	require.Equal(t, "ana@gmail.com", mailUtil("Ana@Gmail.com"))
}

func TestNotificador_AvisoDeRutaAlRepartidor(t *testing.T) {
	repo := nuevoRepoFalso()
	repo.ruta = repository.DatosAvisoRuta{RutaID: "r1", Nombre: "Demo Centro", Zona: "Centro", Fecha: "2026-11-07", Repartidor: "Carla", Telefono: "5493564412345", Envios: 3}
	sender := nuevoSender(true)
	n := NewNotificador(repo, sender, "https://movii.test", "https://movii.test/app/")
	n.RutaAsignada("r1")
	n.Procesar(context.Background())
	require.Contains(t, sender.enviados["5493564412345"], "Envíos a entregar: 3")

	// Con más envíos asignados llega un aviso nuevo con el total actualizado.
	repo.ruta.Envios = 5
	n.RutaAsignada("r1")
	n.Procesar(context.Background())
	require.Contains(t, sender.enviados["5493564412345"], "Envíos a entregar: 5")
	require.Len(t, repo.claves, 2)
}
