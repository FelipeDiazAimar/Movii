package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// ErrCamposObligatorios indica que faltan datos requeridos para crear un envío.
var ErrCamposObligatorios = errors.New("faltan campos obligatorios")

// CrearEnvioInput agrupa los datos del formulario de alta de envío (HU-02, CA-01).
type CrearEnvioInput struct {
	RemitenteNombre      string
	RemitenteTelefono    string
	RemitenteDireccion   string
	DestinatarioNombre   string
	DestinatarioTelefono string
	Calle                string
	Numero               string
	PisoDepto            string
	Localidad            string
	CodigoPostal         string
	Peso                 float64
	Tamano               string
	TipoContenido        string
	Fragil               bool
	Urgente              bool
}

// validarCrearEnvioInput chequea los campos obligatorios del CA-04 de HU-02:
// nombre destinatario, dirección, localidad, peso.
func validarCrearEnvioInput(in CrearEnvioInput) error {
	if in.DestinatarioNombre == "" || in.Calle == "" || in.Localidad == "" || in.Peso <= 0 {
		return ErrCamposObligatorios
	}
	return nil
}

// EnvioService contiene la lógica de negocio de HU-02 (y el detalle con
// historial de HU-06/HU-07, Task 5).
type EnvioService struct {
	pool       *pgxpool.Pool
	envioRepo  *repository.EnvioRepo
	eventoRepo *repository.EventoRepo
}

// NewEnvioService crea un EnvioService.
func NewEnvioService(pool *pgxpool.Pool, envioRepo *repository.EnvioRepo, eventoRepo *repository.EventoRepo) *EnvioService {
	return &EnvioService{pool: pool, envioRepo: envioRepo, eventoRepo: eventoRepo}
}

// Create valida el input y crea remitente + destinatario + envío en una sola
// transacción, generando un código de guía único (CA-02).
func (s *EnvioService) Create(ctx context.Context, in CrearEnvioInput) (domain.Envio, error) {
	if err := validarCrearEnvioInput(in); err != nil {
		return domain.Envio{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Envio{}, fmt.Errorf("envios: no se pudo iniciar la transacción: %w", err)
	}
	defer tx.Rollback(ctx) // no-op si ya se hizo commit

	remitente, err := repository.CreateRemitente(ctx, tx, domain.Remitente{
		Nombre: in.RemitenteNombre, Telefono: in.RemitenteTelefono, Direccion: in.RemitenteDireccion,
	})
	if err != nil {
		return domain.Envio{}, fmt.Errorf("envios: no se pudo crear el remitente: %w", err)
	}

	destinatario, err := repository.CreateDestinatario(ctx, tx, domain.Destinatario{
		Nombre: in.DestinatarioNombre, Telefono: in.DestinatarioTelefono, Calle: in.Calle,
		Numero: in.Numero, PisoDepto: in.PisoDepto, Localidad: in.Localidad, CodigoPostal: in.CodigoPostal,
	})
	if err != nil {
		return domain.Envio{}, fmt.Errorf("envios: no se pudo crear el destinatario: %w", err)
	}

	envio, err := s.crearConCodigoUnico(ctx, tx, in, remitente.ID, destinatario.ID)
	if err != nil {
		return domain.Envio{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Envio{}, fmt.Errorf("envios: no se pudo confirmar la transacción: %w", err)
	}
	return envio, nil
}

// crearConCodigoUnico genera un código de guía MOV-YYYYMMDD-XXXX y reintenta
// con el siguiente número si otro envío tomó ese código en simultáneo.
func (s *EnvioService) crearConCodigoUnico(ctx context.Context, q repository.Querier, in CrearEnvioInput, remitenteID, destinatarioID string) (domain.Envio, error) {
	// UTC igual que el resto del sistema ("hoy" del repartidor y la validación
	// de fecha vencida de las rutas). Con la hora local de la máquina, cerca de
	// medianoche el código de guía quedaba fechado un día distinto al que el
	// resto de la API considera "hoy".
	fecha := time.Now().UTC().Format("20060102")
	prefijo := "MOV-" + fecha + "-"

	var ultimoErr error
	for intento := 0; intento < 5; intento++ {
		count, err := s.envioRepo.ContarPorPrefijoCodigo(ctx, q, prefijo)
		if err != nil {
			return domain.Envio{}, fmt.Errorf("envios: no se pudo generar el código de guía: %w", err)
		}
		codigo := fmt.Sprintf("%s%04d", prefijo, count+1+intento)

		envio, err := s.envioRepo.Create(ctx, q, domain.Envio{
			CodigoGuia: codigo, Peso: in.Peso, Tamano: in.Tamano, TipoContenido: in.TipoContenido,
			Fragil: in.Fragil, Urgente: in.Urgente, RemitenteID: remitenteID, DestinatarioID: destinatarioID,
		})
		if errors.Is(err, repository.ErrDuplicado) {
			ultimoErr = err
			continue
		}
		if err != nil {
			return domain.Envio{}, fmt.Errorf("envios: no se pudo crear el envío: %w", err)
		}
		return envio, nil
	}
	return domain.Envio{}, fmt.Errorf("envios: no se pudo generar un código de guía único tras varios intentos: %w", ultimoErr)
}

// List devuelve los envíos filtrados por estado y/o fecha (CA-05).
func (s *EnvioService) List(ctx context.Context, estado, fecha string) ([]domain.EnvioConDetalle, error) {
	return s.envioRepo.List(ctx, estado, fecha)
}

// GetByID devuelve el detalle de un envío con su historial de eventos
// (Task 5, HU-06/HU-07). Sin eventos, Historial es [] y no nil, para que
// serialice como `"historial": []` según el openapi.
func (s *EnvioService) GetByID(ctx context.Context, id string) (domain.EnvioDetalle, error) {
	detalle, err := s.envioRepo.GetByID(ctx, id)
	if err != nil {
		return domain.EnvioDetalle{}, err
	}
	historial, err := s.eventoRepo.ListarPorEnvio(ctx, id)
	if err != nil {
		return domain.EnvioDetalle{}, err
	}
	return domain.EnvioDetalle{EnvioConDetalle: detalle, Historial: historial}, nil
}
