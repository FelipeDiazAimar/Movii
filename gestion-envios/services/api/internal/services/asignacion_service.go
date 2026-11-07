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
	avisos    AvisosRuta
}

// AvisosRuta recibe las asignaciones confirmadas para avisar al repartidor (HU-17).
type AvisosRuta interface {
	RutaAsignada(rutaID string)
}

// ConAvisos activa el aviso por WhatsApp al repartidor cuando se le asignan envíos.
func (s *AsignacionService) ConAvisos(a AvisosRuta) *AsignacionService {
	s.avisos = a
	return s
}

// NewAsignacionService crea un AsignacionService.
func NewAsignacionService(rutaRepo *repository.RutaRepo, envioRepo *repository.EnvioRepo) *AsignacionService {
	return &AsignacionService{rutaRepo: rutaRepo, envioRepo: envioRepo}
}

// Asignar valida que la ruta exista y su fecha no haya vencido, y asigna los
// envíos dados (deben estar pendientes). Devuelve cuántos envíos quedaron
// asignados; si alguno no estaba disponible no asigna ninguno.
func (s *AsignacionService) Asignar(ctx context.Context, rutaID string, envioIDs []string) (int, error) {
	ruta, err := s.rutaRepo.GetByID(ctx, rutaID)
	if err != nil {
		return 0, err
	}

	// Las rutas se planifican por día calendario argentino: se compara contra
	// "hoy" en hora local (UTC-3). Con UTC, después de las 21 h una ruta de
	// hoy se leía como vencida.
	if _, err := time.Parse("2006-01-02", ruta.Fecha); err != nil {
		return 0, err
	}
	if ruta.Fecha < FechaAR(time.Now()) {
		return 0, ErrFechaVencida
	}

	n, err := s.envioRepo.AsignarEnvios(ctx, envioIDs, rutaID)
	if err == nil && n > 0 && s.avisos != nil {
		s.avisos.RutaAsignada(rutaID)
	}
	return n, err
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
