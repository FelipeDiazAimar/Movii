package services

import (
	"context"
	"fmt"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)


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

// Asignar valida que la ruta exista y asigna los envíos dados (deben estar
// pendientes). Devuelve cuántos envíos quedaron asignados; si alguno no estaba
// disponible no asigna ninguno. La fecha que rige es la de entrega de cada
// envío, no la de la ruta, así que no se valida contra "hoy".
func (s *AsignacionService) Asignar(ctx context.Context, rutaID string, envioIDs []string) (int, error) {
	ruta, err := s.rutaRepo.GetByID(ctx, rutaID)
	if err != nil {
		return 0, err
	}
	// Sumar envíos a una ruta que ya salió o se cerró dejaría paradas sin repartidor en camino.
	if ruta.Estado != domain.EstadoRutaPlanificada {
		return 0, repository.ErrRutaNoEditable
	}

	n, err := s.envioRepo.AsignarEnvios(ctx, envioIDs, rutaID)
	if err == nil && n > 0 && s.avisos != nil {
		s.avisos.RutaAsignada(rutaID)
	}
	return n, err
}

// ExcedeVehiculo indica si sumar los envíos supera la capacidad del vehículo de
// la ruta (sin vehículo nunca excede) y devuelve el detalle para mostrarlo.
func (s *AsignacionService) ExcedeVehiculo(ctx context.Context, rutaID string, envioIDs []string) (bool, string, error) {
	cap, actual, nuevo, err := s.rutaRepo.CargaConEnvios(ctx, rutaID, envioIDs)
	if err != nil || cap == 0 || actual+nuevo <= cap {
		return false, "", err
	}
	return true, fmt.Sprintf("la carga quedaría en %.1f kg y el vehículo admite %.1f kg", actual+nuevo, cap), nil
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
