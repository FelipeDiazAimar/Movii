package services

import (
	"context"
	"errors"
	"regexp"
	"slices"
	"strings"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
)

var (
	colorValido = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
	// ErrVehiculoInvalido: faltan datos, la patente no tiene formato válido o tipo/estado/capacidad no son válidos.
	ErrVehiculoInvalido = errors.New("vehiculo invalido")
	// ErrVehiculoNoDisponible: el vehículo está en mantenimiento y no puede salir a ruta.
	ErrVehiculoNoDisponible = errors.New("vehiculo en mantenimiento")
	// ErrPatenteEnUso: ya hay un vehículo con esa patente.
	ErrPatenteEnUso = errors.New("patente en uso")
)

// patenteValida acepta los formatos argentinos (AB123CD, ABC123) y los
// internos de la flota (TRK-318).
var patenteValida = regexp.MustCompile(`^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$`)

// FlotaService gestiona los vehículos y su seguimiento en el mapa (HU-11, HU-12, HU-18).
type FlotaService struct {
	repo   *repository.FlotaRepo
	ops    *repository.OperacionesRepo
	router geo.Router
	ahora  func() time.Time
}

// NewFlotaService crea un FlotaService.
func NewFlotaService(repo *repository.FlotaRepo, ops *repository.OperacionesRepo, router geo.Router) *FlotaService {
	return &FlotaService{repo: repo, ops: ops, router: router, ahora: time.Now}
}

func (s *FlotaService) fecha(f string) (string, error) {
	if f == "" {
		return FechaAR(s.ahora()), nil
	}
	return fechaODefault(f, s.ahora())
}

// List devuelve la flota con la ruta de cada vehículo en la fecha (vacía = hoy).
func (s *FlotaService) List(ctx context.Context, fecha string) ([]domain.Vehiculo, error) {
	f, err := s.fecha(fecha)
	if err != nil {
		return nil, err
	}
	return s.repo.List(ctx, f)
}

// Detalle devuelve el vehículo con los paquetes a bordo y el recorrido por
// calles de su ruta del día (desde su posición actual por las paradas pendientes).
func (s *FlotaService) Detalle(ctx context.Context, id, fecha string) (domain.VehiculoDetalle, error) {
	f, err := s.fecha(fecha)
	if err != nil {
		return domain.VehiculoDetalle{}, err
	}
	v, err := s.repo.Get(ctx, id, f)
	if err != nil {
		return domain.VehiculoDetalle{}, err
	}
	det := domain.VehiculoDetalle{Vehiculo: v, Paquetes: []domain.PaqueteVehiculo{}}
	if v.RutaID == nil {
		return det, nil
	}
	if det.Paquetes, err = s.repo.Paquetes(ctx, *v.RutaID); err != nil {
		return domain.VehiculoDetalle{}, err
	}
	paradas, err := s.ops.ParadasDeRuta(ctx, *v.RutaID)
	if err != nil {
		return domain.VehiculoDetalle{}, err
	}
	puntos := []geo.Punto{{Lat: v.Latitud, Lng: v.Longitud}}
	for _, p := range paradas {
		if p.Coordenadas != nil && (p.Estado == domain.EstadoEnvioAsignado || p.Estado == domain.EstadoEnvioEnCamino) {
			puntos = append(puntos, geo.Punto{Lat: p.Coordenadas.Lat, Lng: p.Coordenadas.Lng})
		}
	}
	det.Recorrido = s.recorrido(ctx, puntos)
	return det, nil
}

// recorrido traza el camino por calles; nil si no hay al menos dos puntos.
func (s *FlotaService) recorrido(ctx context.Context, puntos []geo.Punto) *domain.RecorridoMapa {
	if len(puntos) < 2 || s.router == nil {
		return nil
	}
	rec, err := s.router.Recorrido(ctx, puntos)
	if err != nil {
		return nil
	}
	return aRecorridoMapa(rec)
}

func aRecorridoMapa(rec geo.Recorrido) *domain.RecorridoMapa {
	out := &domain.RecorridoMapa{DistanciaM: rec.DistanciaM, DuracionS: rec.DuracionS, Geometria: make([][2]float64, len(rec.Geometria))}
	for i, p := range rec.Geometria {
		out.Geometria[i] = [2]float64{p.Lat, p.Lng}
	}
	return out
}

func normalizarVehiculo(v domain.Vehiculo) (domain.Vehiculo, error) {
	v.Patente = strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(v.Patente), " ", ""))
	v.Modelo = strings.TrimSpace(v.Modelo)
	if v.Tipo == "" {
		v.Tipo = "camion"
	}
	if v.Estado == "" {
		v.Estado = domain.EstadoVehiculoEnBase
	}
	if !patenteValida.MatchString(v.Patente) || v.Modelo == "" || len(v.Modelo) > 60 ||
		!slices.Contains(domain.TiposVehiculo, v.Tipo) || !slices.Contains(domain.EstadosVehiculo, v.Estado) ||
		(v.Color != "" && !colorValido.MatchString(v.Color)) ||
		v.CapacidadPeso <= 0 || v.CapacidadVolumen <= 0 {
		return domain.Vehiculo{}, ErrVehiculoInvalido
	}
	return v, nil
}

// Crear da de alta un vehículo y devuelve su detalle.
func (s *FlotaService) Crear(ctx context.Context, v domain.Vehiculo) (domain.Vehiculo, error) {
	v, err := normalizarVehiculo(v)
	if err != nil {
		return domain.Vehiculo{}, err
	}
	id, err := s.repo.Create(ctx, v)
	if errors.Is(err, repository.ErrDuplicado) {
		return domain.Vehiculo{}, ErrPatenteEnUso
	}
	if err != nil {
		return domain.Vehiculo{}, err
	}
	return s.repo.Get(ctx, id, FechaAR(s.ahora()))
}

// Actualizar modifica modelo, tipo, capacidades y estado (la patente no cambia).
func (s *FlotaService) Actualizar(ctx context.Context, id string, v domain.Vehiculo) (domain.Vehiculo, error) {
	actual, err := s.repo.Get(ctx, id, FechaAR(s.ahora()))
	if err != nil {
		return domain.Vehiculo{}, err
	}
	v.Patente = actual.Patente
	if v, err = normalizarVehiculo(v); err != nil {
		return domain.Vehiculo{}, err
	}
	if err := s.repo.Update(ctx, id, v); err != nil {
		return domain.Vehiculo{}, err
	}
	return s.repo.Get(ctx, id, FechaAR(s.ahora()))
}

// AsignarARuta asigna el vehículo a la ruta (vehiculoID vacío = quitarlo).
// Un vehículo en mantenimiento no puede salir a ruta.
func (s *FlotaService) AsignarARuta(ctx context.Context, rutaID, vehiculoID string) error {
	if vehiculoID == "" {
		return s.repo.AsignarARuta(ctx, rutaID, nil)
	}
	v, err := s.repo.Get(ctx, vehiculoID, FechaAR(s.ahora()))
	if err != nil {
		return err
	}
	if v.Estado == domain.EstadoVehiculoMantenimiento {
		return ErrVehiculoNoDisponible
	}
	return s.repo.AsignarARuta(ctx, rutaID, &vehiculoID)
}

// Trayecto devuelve el camino por calles desde el vehículo de la ruta hasta el
// destino del envío. Un repartidor solo puede consultar envíos de sus rutas.
func (s *FlotaService) Trayecto(ctx context.Context, envioID, usuarioID, rol string) (domain.TrayectoEnvio, error) {
	d, err := s.repo.DestinoEnvio(ctx, envioID)
	if err != nil {
		return domain.TrayectoEnvio{}, err
	}
	t := domain.TrayectoEnvio{EnvioID: d.EnvioID, CodigoGuia: d.CodigoGuia, Estado: d.Estado, Direccion: d.Direccion}
	if d.Lat != nil && d.Lng != nil {
		t.Destino = &domain.Coordenadas{Lat: *d.Lat, Lng: *d.Lng}
	}
	if d.RutaID == nil {
		if rol == domain.RolRepartidor {
			return domain.TrayectoEnvio{}, repository.ErrNoEncontrado
		}
		return t, nil
	}
	if rol == domain.RolRepartidor {
		ruta, err := s.ops.RutaParaMapa(ctx, *d.RutaID)
		if err != nil {
			return domain.TrayectoEnvio{}, err
		}
		if ruta.Repartidor.ID != usuarioID {
			return domain.TrayectoEnvio{}, repository.ErrNoEncontrado
		}
	}
	if t.Vehiculo, err = s.repo.VehiculoDeRuta(ctx, *d.RutaID); err != nil {
		return domain.TrayectoEnvio{}, err
	}
	enCurso := d.Estado == domain.EstadoEnvioAsignado || d.Estado == domain.EstadoEnvioEnCamino
	if !enCurso || t.Vehiculo == nil || t.Destino == nil {
		return t, nil
	}
	if t.ParadasAntes, err = s.repo.ParadasPendientesAntes(ctx, *d.RutaID, envioID); err != nil {
		return domain.TrayectoEnvio{}, err
	}
	t.Recorrido = s.recorrido(ctx, []geo.Punto{{Lat: t.Vehiculo.Lat, Lng: t.Vehiculo.Lng}, {Lat: t.Destino.Lat, Lng: t.Destino.Lng}})
	return t, nil
}
