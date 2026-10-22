package services

import (
	"context"
	"errors"
	"math"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// ErrFechaReporteInvalida indica una fecha que no es YYYY-MM-DD.
var ErrFechaReporteInvalida = errors.New("fecha invalida")

// maxAlertas es la cantidad de incidencias recientes que muestra el panel.
const maxAlertas = 10

// porcentaje devuelve parte/total en %, redondeado a 2 decimales (0 si total es 0).
func porcentaje(parte, total int) float64 {
	if total == 0 {
		return 0
	}
	return math.Round(float64(parte)*10000/float64(total)) / 100
}

// fechaODefault valida YYYY-MM-DD estricto; vacía significa hoy en UTC.
func fechaODefault(fecha string, ahora time.Time) (string, error) {
	if fecha == "" {
		return ahora.UTC().Format("2006-01-02"), nil
	}
	if f, err := time.Parse("2006-01-02", fecha); err != nil || f.Format("2006-01-02") != fecha {
		return "", ErrFechaReporteInvalida
	}
	return fecha, nil
}

// OperacionesService arma el panel en vivo (HU-11) y el mapa de ruta (HU-12).
type OperacionesService struct {
	repo *repository.OperacionesRepo
}

// NewOperacionesService crea un OperacionesService.
func NewOperacionesService(repo *repository.OperacionesRepo) *OperacionesService {
	return &OperacionesService{repo: repo}
}

// Dashboard devuelve métricas, rutas y últimas incidencias del día (vacía = hoy UTC).
func (s *OperacionesService) Dashboard(ctx context.Context, fecha string) (domain.DashboardOperaciones, error) {
	fecha, err := fechaODefault(fecha, time.Now())
	if err != nil {
		return domain.DashboardOperaciones{}, err
	}
	metricas, err := s.repo.ContadoresDelDia(ctx, fecha)
	if err != nil {
		return domain.DashboardOperaciones{}, err
	}
	metricas.PorcentajeEfectividad = porcentaje(metricas.Entregados, metricas.Entregados+metricas.NoEntregados)

	rutas, err := s.repo.RutasDelDia(ctx, fecha)
	if err != nil {
		return domain.DashboardOperaciones{}, err
	}
	for i := range rutas {
		rutas[i].PorcentajeAvance = porcentaje(rutas[i].Completadas, rutas[i].TotalParadas)
	}

	alertas, motivos, err := s.repo.IncidenciasDelDia(ctx, fecha, maxAlertas)
	if err != nil {
		return domain.DashboardOperaciones{}, err
	}
	for i, m := range motivos {
		alertas[i].Descripcion = etiquetaMotivo(m)
	}

	return domain.DashboardOperaciones{Fecha: fecha, Metricas: metricas, RutasActivas: rutas, UltimasAlertas: alertas}, nil
}

// MapaRuta devuelve las paradas de la ruta. Un repartidor solo ve sus rutas:
// una ajena responde igual que una inexistente (404), sin revelar que existe.
func (s *OperacionesService) MapaRuta(ctx context.Context, rutaID, usuarioID, rol string) (domain.RutaMapa, error) {
	mapa, err := s.repo.RutaParaMapa(ctx, rutaID)
	if err != nil {
		return domain.RutaMapa{}, err
	}
	if rol == domain.RolRepartidor && mapa.Repartidor.ID != usuarioID {
		return domain.RutaMapa{}, repository.ErrNoEncontrado
	}
	if mapa.Paradas, err = s.repo.ParadasDeRuta(ctx, mapa.RutaID); err != nil {
		return domain.RutaMapa{}, err
	}
	return mapa, nil
}

func etiquetaMotivo(m string) string {
	if e, ok := domain.EtiquetasMotivo[m]; ok {
		return e
	}
	return "Incidencia sin motivo registrado"
}
