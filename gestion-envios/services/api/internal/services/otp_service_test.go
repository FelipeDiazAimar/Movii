package services

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"movii/api/internal/domain"
	"movii/api/internal/platform/whatsapp"
	"movii/api/internal/repository"
)

// --- dobles de prueba ---

type otpRepoFalso struct {
	mu      sync.Mutex
	codigos map[string]*repository.CodigoOTP
	creados map[string]time.Time
}

func nuevoOTPRepo() *otpRepoFalso {
	return &otpRepoFalso{codigos: map[string]*repository.CodigoOTP{}, creados: map[string]time.Time{}}
}

func (r *otpRepoFalso) CrearCodigo(_ context.Context, id, tel string, uid *string, hash string, expira time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.codigos[id] = &repository.CodigoOTP{ID: id, Telefono: tel, UsuarioID: uid, CodigoHash: hash, ExpiraAt: expira}
	r.creados[id] = expira.Add(-vigenciaOTP)
	return nil
}
func (r *otpRepoFalso) ObtenerCodigo(_ context.Context, id string) (repository.CodigoOTP, error) {
	if c, ok := r.codigos[id]; ok {
		return *c, nil
	}
	return repository.CodigoOTP{}, repository.ErrNoEncontrado
}
func (r *otpRepoFalso) ContarCodigosDesde(_ context.Context, tel string, desde time.Time) (int, error) {
	n := 0
	for id, c := range r.codigos {
		if c.Telefono == tel && !r.creados[id].Before(desde) {
			n++
		}
	}
	return n, nil
}
func (r *otpRepoFalso) SumarIntento(_ context.Context, id string) error {
	r.codigos[id].Intentos++
	return nil
}
func (r *otpRepoFalso) MarcarUsado(_ context.Context, id string) (bool, error) {
	c := r.codigos[id]
	if c.Usado {
		return false, nil
	}
	c.Usado = true
	return true, nil
}

type usuariosFalsos map[string]domain.Usuario // por id

func (u usuariosFalsos) GetByID(_ context.Context, id string) (domain.Usuario, error) {
	if x, ok := u[id]; ok {
		return x, nil
	}
	return domain.Usuario{}, repository.ErrNoEncontrado
}

type tokensFalsos struct{}

func (tokensFalsos) EmitirToken(u domain.Usuario) (string, error) { return "jwt-de-" + u.ID, nil }

type senderFalso struct {
	mu       sync.Mutex
	estado   whatsapp.Estado
	enviados map[string]string
	falla    error
}

func nuevoSender(vinculado bool) *senderFalso {
	return &senderFalso{estado: whatsapp.Estado{Habilitado: true, Vinculado: vinculado}, enviados: map[string]string{}}
}
func (s *senderFalso) Enviar(_ context.Context, tel, texto string) error {
	if s.falla != nil {
		return s.falla
	}
	s.mu.Lock()
	s.enviados[tel] = texto
	s.mu.Unlock()
	return nil
}
func (s *senderFalso) Estado() whatsapp.Estado { return s.estado }

const telCarla = "5493564412345"

var carla = domain.Usuario{ID: "u-carla", Email: "carla@movii.demo", Rol: domain.RolRepartidor, Activo: true, Telefono: telCarla}

func nuevoOTP(sender *senderFalso) (*OTPService, *otpRepoFalso, *time.Time) {
	repo := nuevoOTPRepo()
	ahora := time.Date(2026, 11, 7, 10, 0, 0, 0, ZonaAR)
	svc := NewOTPService(repo, usuariosFalsos{carla.ID: carla}, tokensFalsos{}, sender, "secreto")
	svc.ahora = func() time.Time { return ahora }
	svc.generar = func() (string, error) { return "123456", nil }
	return svc, repo, &ahora
}

// --- tests ---

func TestOTP_Requiere(t *testing.T) {
	svc, _, _ := nuevoOTP(nuevoSender(true))
	require.True(t, svc.Requiere(carla), "con celular y WhatsApp vinculado se pide código")
	sinTel := carla
	sinTel.Telefono = ""
	require.False(t, svc.Requiere(sinTel), "sin celular entra solo con la contraseña")

	desvinculado, _, _ := nuevoOTP(nuevoSender(false))
	require.False(t, desvinculado.Requiere(carla), "con WhatsApp desvinculado nadie queda afuera")

	dev, _, _ := nuevoOTP(&senderFalso{estado: whatsapp.Estado{Habilitado: false}, enviados: map[string]string{}})
	require.True(t, dev.Requiere(carla), "en desarrollo (solo log) también se pide el código")
}

func TestOTP_FlujoCompleto(t *testing.T) {
	sender := nuevoSender(true)
	svc, repo, _ := nuevoOTP(sender)
	ctx := context.Background()

	d, err := svc.Iniciar(ctx, carla)
	require.NoError(t, err)
	require.Equal(t, "+54 9 3564 ••••45", d.Telefono)
	require.Equal(t, 300, d.VenceEn)
	require.Contains(t, sender.enviados[telCarla], "*123456*")
	require.NotContains(t, repo.codigos[d.ID].CodigoHash, "123456", "el código nunca se guarda en claro")

	token, err := svc.Verificar(ctx, d.ID, "123456")
	require.NoError(t, err)
	require.Equal(t, "jwt-de-u-carla", token)

	_, err = svc.Verificar(ctx, d.ID, "123456")
	require.ErrorIs(t, err, ErrCodigoInvalido, "un código no se puede usar dos veces")
}

func TestOTP_ElCodigoSoloSirveParaSuDesafio(t *testing.T) {
	svc, _, _ := nuevoOTP(nuevoSender(true))
	ctx := context.Background()
	d1, err := svc.Iniciar(ctx, carla)
	require.NoError(t, err)
	_, err = svc.Verificar(ctx, "00000000-0000-4000-8000-000000000000", "123456")
	require.ErrorIs(t, err, ErrCodigoInvalido)
	_, err = svc.Verificar(ctx, d1.ID, "123456")
	require.NoError(t, err)
}

func TestOTP_CodigoIncorrectoYLimiteDeIntentos(t *testing.T) {
	svc, _, _ := nuevoOTP(nuevoSender(true))
	ctx := context.Background()
	d, err := svc.Iniciar(ctx, carla)
	require.NoError(t, err)

	for i := 0; i < maxIntentosOTP; i++ {
		_, err := svc.Verificar(ctx, d.ID, "000000")
		require.ErrorIs(t, err, ErrCodigoInvalido)
	}
	_, err = svc.Verificar(ctx, d.ID, "123456")
	require.ErrorIs(t, err, ErrCodigoInvalido, "después de 5 intentos fallidos el código correcto ya no sirve")
}

func TestOTP_Vencido(t *testing.T) {
	svc, _, ahora := nuevoOTP(nuevoSender(true))
	ctx := context.Background()
	d, err := svc.Iniciar(ctx, carla)
	require.NoError(t, err)

	*ahora = ahora.Add(vigenciaOTP + time.Second)
	_, err = svc.Verificar(ctx, d.ID, "123456")
	require.ErrorIs(t, err, ErrCodigoInvalido)
}

func TestOTP_ReenviarInvalidaElAnteriorYRespetaElLimite(t *testing.T) {
	svc, _, ahora := nuevoOTP(nuevoSender(true))
	ctx := context.Background()
	d1, err := svc.Iniciar(ctx, carla)
	require.NoError(t, err)

	d2, err := svc.Reenviar(ctx, d1.ID)
	require.NoError(t, err)
	require.NotEqual(t, d1.ID, d2.ID)
	_, err = svc.Verificar(ctx, d1.ID, "123456")
	require.ErrorIs(t, err, ErrCodigoInvalido, "el código anterior queda invalidado")

	_, err = svc.Reenviar(ctx, d2.ID)
	require.NoError(t, err) // 3er código en la ventana
	_, err = svc.Iniciar(ctx, carla)
	require.ErrorIs(t, err, ErrDemasiadosPedidos)

	*ahora = ahora.Add(ventanaPedidosOTP + time.Minute)
	_, err = svc.Iniciar(ctx, carla)
	require.NoError(t, err, "pasada la ventana se puede volver a pedir")
}

func TestOTP_FallaElEnvio(t *testing.T) {
	sender := nuevoSender(true)
	sender.falla = errors.New("sin conexión")
	svc, _, _ := nuevoOTP(sender)
	_, err := svc.Iniciar(context.Background(), carla)
	require.Error(t, err)
	require.True(t, strings.Contains(err.Error(), "WhatsApp"))
}

func TestEnmascararTelefono(t *testing.T) {
	require.Equal(t, "+54 9 3564 ••••45", EnmascararTelefono("5493564412345"))
	require.Equal(t, "••••", EnmascararTelefono("123"))
}

// senderLento simula un WhatsApp que no responde.
type senderLento struct{ bloqueo chan struct{} }

func (s senderLento) Enviar(ctx context.Context, _, _ string) error {
	select {
	case <-s.bloqueo:
	case <-ctx.Done():
	}
	return ctx.Err()
}
func (senderLento) Estado() whatsapp.Estado { return whatsapp.Estado{Habilitado: true, Vinculado: true} }

func TestOTP_WhatsAppColgadoNoTrabaElLogin(t *testing.T) {
	lento := senderLento{bloqueo: make(chan struct{})}
	defer close(lento.bloqueo)
	svc := NewOTPService(nuevoOTPRepo(), usuariosFalsos{carla.ID: carla}, tokensFalsos{}, lento, "secreto")
	svc.EsperaEnvio = 50 * time.Millisecond

	inicio := time.Now()
	d, err := svc.Iniciar(context.Background(), carla)
	require.NoError(t, err, "si WhatsApp tarda, se responde con el desafío igual")
	require.NotEmpty(t, d.ID)
	require.Less(t, time.Since(inicio), 2*time.Second, "el login no queda colgado")
}
