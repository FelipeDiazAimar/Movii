package services

import (
	"context"
	"errors"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// ErrRutaCamposObligatorios indica que falta el repartidor al
// crear/editar una ruta (CA-05 de HU-03).
var ErrRutaCamposObligatorios = errors.New("faltan campos obligatorios de la ruta")

// ErrRepartidorInvalido indica que el repartidor no existe, está inactivo o no tiene rol repartidor.
var ErrRepartidorInvalido = errors.New("el repartidor no es válido")

// ErrFechaRutaInvalida indica una fecha de ruta que no es YYYY-MM-DD.
var ErrFechaRutaInvalida = errors.New("la fecha de la ruta no es válida")

// validarRuta chequea los campos obligatorios de una ruta y su fecha.
func validarRuta(ruta domain.Ruta) error {
	if ruta.RepartidorID == "" {
		return ErrRutaCamposObligatorios
	}
	if ruta.Fecha != "" {
		if f, err := time.Parse("2006-01-02", ruta.Fecha); err != nil || f.Format("2006-01-02") != ruta.Fecha {
			return ErrFechaRutaInvalida
		}
	}
	return nil
}

// validarRutaConRepartidor suma a validarRuta que el repartidor exista, esté
// activo y tenga rol repartidor (sin esto la base aceptaba a un operador como
// chofer o fallaba con 500).
func (s *RutaService) validarRutaConRepartidor(ctx context.Context, ruta domain.Ruta) error {
	if err := validarRuta(ruta); err != nil {
		return err
	}
	ok, err := s.repo.RepartidorValido(ctx, ruta.RepartidorID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrRepartidorInvalido
	}
	return nil
}

// DetalleRuta agrupa una ruta con sus envíos y los totales (CA-04 de HU-03,
// CA-06 de HU-04).
type DetalleRuta struct {
	Ruta           domain.Ruta
	Envios         []domain.Envio
	PesoTotal      float64
	CantidadEnvios int
}

// RutaService contiene la lógica de negocio de HU-03.
type RutaService struct {
	repo *repository.RutaRepo
}

// NewRutaService crea un RutaService.
func NewRutaService(repo *repository.RutaRepo) *RutaService {
	return &RutaService{repo: repo}
}

// Create valida y crea una ruta nueva.
func (s *RutaService) Create(ctx context.Context, ruta domain.Ruta) (domain.Ruta, error) {
	if err := s.validarRutaConRepartidor(ctx, ruta); err != nil {
		return domain.Ruta{}, err
	}
	return s.repo.Create(ctx, ruta)
}

// List devuelve las rutas filtradas por fecha (CA-02).
func (s *RutaService) List(ctx context.Context, fecha string) ([]domain.RutaConConteo, error) {
	return s.repo.List(ctx, fecha)
}

// Detalle devuelve una ruta con sus envíos, peso total y cantidad (CA-04).
func (s *RutaService) Detalle(ctx context.Context, id string) (DetalleRuta, error) {
	ruta, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return DetalleRuta{}, err
	}
	envios, err := s.repo.EnviosDeRuta(ctx, id)
	if err != nil {
		return DetalleRuta{}, err
	}
	var peso float64
	for _, e := range envios {
		peso += e.Peso
	}
	return DetalleRuta{Ruta: ruta, Envios: envios, PesoTotal: peso, CantidadEnvios: len(envios)}, nil
}

// Update valida y edita una ruta, solo si está planificada (CA-03).
func (s *RutaService) Update(ctx context.Context, id string, ruta domain.Ruta) (domain.Ruta, error) {
	if err := s.validarRutaConRepartidor(ctx, ruta); err != nil {
		return domain.Ruta{}, err
	}
	return s.repo.Update(ctx, id, ruta)
}
