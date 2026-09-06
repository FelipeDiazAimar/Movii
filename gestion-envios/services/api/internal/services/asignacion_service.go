package services

import (
	"context"
	"errors"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// ErrFechaVencida indica que se intentó asignar un envío a una ruta cuya
// fecha de reparto ya pasó (CA-05 de HU-04).
var ErrFechaVencida = errors.New("no se puede asignar a una ruta con fecha vencida")

// AsignacionService contiene la lógica de negocio de HU-04.
type AsignacionService struct {
	rutaRepo  *repository.RutaRepo
	envioRepo *repository.EnvioRepo
}

// NewAsignacionService crea un AsignacionService.
func NewAsignacionService(rutaRepo *repository.RutaRepo, envioRepo *repository.EnvioRepo) *AsignacionService {
	return &AsignacionService{rutaRepo: rutaRepo, envioRepo: envioRepo}
}

// Asignar valida que la ruta exista y su fecha no haya vencido, y asigna los
// envíos dados (deben estar pendientes).
func (s *AsignacionService) Asignar(ctx context.Context, rutaID string, envioIDs []string) error {
	ruta, err := s.rutaRepo.GetByID(ctx, rutaID)
	if err != nil {
		return err
	}

	// time.Parse sin zona da un time.Time en UTC a medianoche; "hoy" se
	// calcula también en UTC para comparar la misma fecha calendario sin
	// que el huso horario local corra el resultado (una ruta creada "hoy"
	// no debe leerse como vencida solo porque la máquina está en UTC-3).
	fechaRuta, err := time.Parse("2006-01-02", ruta.Fecha)
	if err != nil {
		return err
	}
	hoy := time.Now().UTC()
	hoySinHora := time.Date(hoy.Year(), hoy.Month(), hoy.Day(), 0, 0, 0, 0, time.UTC)
	if fechaRuta.Before(hoySinHora) {
		return ErrFechaVencida
	}

	return s.envioRepo.AsignarEnvios(ctx, envioIDs, rutaID)
}

// Desasignar valida que la ruta esté planificada y quita el envío de ella.
func (s *AsignacionService) Desasignar(ctx context.Context, rutaID, envioID string) error {
	ruta, err := s.rutaRepo.GetByID(ctx, rutaID)
	if err != nil {
		return err
	}
	if ruta.Estado != domain.EstadoRutaPlanificada {
		return repository.ErrRutaNoEditable
	}
	return s.envioRepo.DesasignarEnvio(ctx, envioID, rutaID)
}
