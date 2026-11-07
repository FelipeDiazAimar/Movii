package services

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

func ptr(s string) *string { return &s }

func TestMensajeEnvio(t *testing.T) {
	base := repository.DatosAvisoEnvio{CodigoGuia: "MOV-1", Destinatario: "Lucía Fernández", Direccion: "Belgrano 1950, San Francisco"}

	casos := []struct {
		nombre   string
		ajustar  func(*repository.DatosAvisoEnvio)
		tipo     string
		contiene []string
	}{
		{"en camino", func(d *repository.DatosAvisoEnvio) { d.Estado = domain.EstadoEnvioEnCamino }, AvisoEnCamino,
			[]string{"Hola Lucía", "salió a reparto", "Belgrano 1950", "https://movii.test/tracking/MOV-1"}},
		{"entregado", func(d *repository.DatosAvisoEnvio) { d.Estado = domain.EstadoEnvioEntregado }, AvisoEntregado,
			[]string{"fue entregado", "/tracking/MOV-1"}},
		{"no entregado con motivo", func(d *repository.DatosAvisoEnvio) {
			d.Estado = domain.EstadoEnvioNoEntregado
			d.Motivo = ptr(domain.MotivoClienteAusente)
		}, AvisoNoEntregado, []string{"no pudimos entregar", "destinatario ausente"}},
		{"reprogramado", func(d *repository.DatosAvisoEnvio) {
			d.Estado = domain.EstadoEnvioPendiente
			d.ReprogramadoPara = ptr("09/11/2026")
			d.Franja = ptr("manana")
		}, AvisoReprogramado, []string{"Reprogramamos", "09/11/2026 por la mañana"}},
	}
	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			d := base
			c.ajustar(&d)
			tipo, texto := MensajeEnvio(d, "https://movii.test")
			require.Equal(t, c.tipo, tipo)
			for _, s := range c.contiene {
				require.Contains(t, texto, s)
			}
		})
	}

	t.Run("asignado o pendiente sin reprogramar no avisa", func(t *testing.T) {
		for _, e := range []string{domain.EstadoEnvioAsignado, domain.EstadoEnvioPendiente} {
			d := base
			d.Estado = e
			tipo, _ := MensajeEnvio(d, "https://movii.test")
			require.Empty(t, tipo, e)
		}
	})
}

func TestMensajeRuta(t *testing.T) {
	txt := MensajeRuta(repository.DatosAvisoRuta{Nombre: "Demo Centro", Zona: "Centro", Fecha: "07/11/2026", Repartidor: "Carla Repartidora", Envios: 5, Patente: "TRK-318"}, "https://movii.test/app/")
	for _, s := range []string{"Hola Carla", "*Demo Centro*", "07/11/2026", "5 envíos", "*TRK-318*", "https://movii.test/app/"} {
		require.Contains(t, txt, s)
	}
	require.Contains(t, MensajeRuta(repository.DatosAvisoRuta{Nombre: "R", Envios: 1}, ""), "1 envío.")
}

// notificadorRepoFalso registra lo que pasaría en la base.
type notificadorRepoFalso struct {
	envio      repository.DatosAvisoEnvio
	ruta       repository.DatosAvisoRuta
	claves     map[string]repository.Notificacion
	resultados map[string]error
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
func (r *notificadorRepoFalso) ResultadoNotificacion(_ context.Context, id string, err error) error {
	r.resultados[id] = err
	return nil
}

func TestNotificador_MandaUnaSolaVezPorEvento(t *testing.T) {
	repo := &notificadorRepoFalso{
		envio:  repository.DatosAvisoEnvio{EnvioID: "e1", CodigoGuia: "MOV-1", Estado: domain.EstadoEnvioEnCamino, UltimoEventoID: "ev1", Destinatario: "Ana", Telefono: "3564-412301"},
		claves: map[string]repository.Notificacion{}, resultados: map[string]error{},
	}
	sender := nuevoSender(true)
	n := NewNotificador(repo, sender, "https://movii.test", "")

	n.CambioDeEstado("e1")
	n.CambioDeEstado("e1") // mismo evento: no se repite
	n.Procesar(context.Background())

	require.Len(t, repo.claves, 1)
	require.Contains(t, sender.enviados["5493564412301"], "salió a reparto")
	for _, err := range repo.resultados {
		require.NoError(t, err)
	}
}

func TestNotificador_SinTelefonoQuedaOmitido(t *testing.T) {
	repo := &notificadorRepoFalso{
		envio:  repository.DatosAvisoEnvio{EnvioID: "e1", CodigoGuia: "MOV-1", Estado: domain.EstadoEnvioEntregado, UltimoEventoID: "ev2"},
		claves: map[string]repository.Notificacion{}, resultados: map[string]error{},
	}
	sender := nuevoSender(true)
	n := NewNotificador(repo, sender, "https://movii.test", "")
	n.CambioDeEstado("e1")
	n.Procesar(context.Background())

	require.Len(t, repo.claves, 1)
	for _, notif := range repo.claves {
		require.Equal(t, "omitido", notif.Estado)
	}
	require.Empty(t, sender.enviados)
}

func TestNotificador_AvisoDeRutaAlRepartidor(t *testing.T) {
	repo := &notificadorRepoFalso{
		ruta:   repository.DatosAvisoRuta{RutaID: "r1", Nombre: "Demo Centro", Zona: "Centro", Fecha: "07/11/2026", Repartidor: "Carla", Telefono: "5493564412345", Envios: 3},
		claves: map[string]repository.Notificacion{}, resultados: map[string]error{},
	}
	sender := nuevoSender(true)
	n := NewNotificador(repo, sender, "https://movii.test", "https://movii.test/app/")
	n.RutaAsignada("r1")
	n.Procesar(context.Background())
	require.Contains(t, sender.enviados["5493564412345"], "3 envíos")

	// Con más envíos asignados llega un aviso nuevo con el total actualizado.
	repo.ruta.Envios = 5
	n.RutaAsignada("r1")
	n.Procesar(context.Background())
	require.Contains(t, sender.enviados["5493564412345"], "5 envíos")
	require.Len(t, repo.claves, 2)
}
