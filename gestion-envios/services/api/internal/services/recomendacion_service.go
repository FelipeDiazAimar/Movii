package services

import (
	"context"
	"errors"
	"fmt"

	"movii/api/internal/domain"
	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
)

// ErrDireccionInvalida indica que la dirección del envío no se pudo ubicar
// con confianza suficiente (T4).
var ErrDireccionInvalida = errors.New("la dirección del envío no es válida")

// Valores de Recomendacion.Recomendacion.
const (
	RecomConviene      = "conviene"
	RecomDudoso        = "dudoso"
	RecomNoConviene    = "no_conviene"
	RecomSinRecomienda = "sin_recomendacion" // proveedor caído: se puede asignar igual
)

// Recomendacion es el resultado de evaluar sumar un envío a una ruta.
type Recomendacion struct {
	ExtraKm       float64 `json:"extra_km"`
	DesvioPct     float64 `json:"desvio_pct"`
	Recomendacion string  `json:"recomendacion"`
	Motivo        string  `json:"motivo"`
}

type recoRutaRepo interface {
	GetByID(ctx context.Context, id string) (domain.Ruta, error)
	EnviosDeRuta(ctx context.Context, rutaID string) ([]domain.Envio, error)
}

type recoGeoRepo interface {
	Direccion(ctx context.Context, destinatarioID string) (repository.DireccionDestinatario, error)
	DestinatarioDeEnvio(ctx context.Context, envioID string) (string, error)
}

// RecomendacionService valida la dirección de un envío y estima el desvío que
// causa en una ruta (T4).
type RecomendacionService struct {
	rutas    recoRutaRepo
	geoRepo  recoGeoRepo
	provider geo.GeoProvider
	okKm     float64 // por debajo: conviene
	noKm     float64 // por encima: no conviene
}

// NewRecomendacionService crea el servicio con los umbrales en km.
func NewRecomendacionService(rutas recoRutaRepo, geoRepo recoGeoRepo, p geo.GeoProvider, okKm, noKm float64) *RecomendacionService {
	return &RecomendacionService{rutas: rutas, geoRepo: geoRepo, provider: p, okKm: okKm, noKm: noKm}
}

func (s *RecomendacionService) ubicar(ctx context.Context, destID string) (geo.Punto, error) {
	d, err := s.geoRepo.Direccion(ctx, destID)
	if err != nil {
		return geo.Punto{}, err
	}
	p, conf, err := s.provider.Geocodificar(ctx, ExpandirCalle(d.Calle), d.Numero, d.Localidad, d.CodigoPostal)
	if err != nil {
		return geo.Punto{}, err
	}
	if conf < geo.ConfianzaMinima {
		return geo.Punto{}, geo.ErrSinResultados
	}
	return p, nil
}

// Recomendar evalúa agregar el envío a la ruta. Devuelve ErrDireccionInvalida
// si la dirección no se ubica; si el proveedor falla (red) devuelve
// "sin_recomendacion" sin error, para no bloquear la operación.
func (s *RecomendacionService) Recomendar(ctx context.Context, rutaID, envioID string) (Recomendacion, error) {
	if _, err := s.rutas.GetByID(ctx, rutaID); err != nil {
		return Recomendacion{}, err
	}
	destID, err := s.geoRepo.DestinatarioDeEnvio(ctx, envioID)
	if err != nil {
		return Recomendacion{}, err
	}
	nuevo, err := s.ubicar(ctx, destID)
	if errors.Is(err, geo.ErrSinResultados) {
		return Recomendacion{}, ErrDireccionInvalida
	}
	if err != nil {
		return sinRecomendacion("no se pudo consultar el servicio de mapas"), nil
	}

	envios, err := s.rutas.EnviosDeRuta(ctx, rutaID)
	if err != nil {
		return Recomendacion{}, err
	}
	// Puntos: depósito + paradas actuales (las que no se ubican se ignoran) + el nuevo al final.
	// shortcut: el orden de visita es el de la consulta; subir a un orden real de paradas si se persiste.
	puntos := []geo.Punto{geo.CentroSanFrancisco}
	for _, e := range envios {
		if e.ID == envioID {
			continue
		}
		if p, err := s.ubicar(ctx, e.DestinatarioID); err == nil {
			puntos = append(puntos, p)
		}
	}
	m, err := s.provider.Matriz(ctx, append(puntos, nuevo))
	if err != nil {
		return sinRecomendacion("no se pudo calcular la distancia"), nil
	}
	return s.evaluar(m.KM), nil
}

func sinRecomendacion(motivo string) Recomendacion {
	return Recomendacion{Recomendacion: RecomSinRecomienda, Motivo: motivo + ": se puede asignar igual"}
}

// evaluar aplica las reglas sobre la matriz de km; el último punto es el nuevo.
// Extra = inserción más barata entre dos paradas consecutivas o al final.
func (s *RecomendacionService) evaluar(km [][]float64) Recomendacion {
	n := len(km) - 1 // índice del punto nuevo
	var largo float64
	for i := 0; i < n-1; i++ {
		largo += km[i][i+1]
	}
	extra := km[n-1][n] // al final
	for i := 0; i < n-1; i++ {
		if c := km[i][n] + km[n][i+1] - km[i][i+1]; c < extra {
			extra = c
		}
	}
	if extra < 0 {
		extra = 0
	}
	var pct float64
	if largo > 0 {
		pct = extra / largo * 100
	}
	r := Recomendacion{ExtraKm: round1(extra), DesvioPct: round1(pct)}
	detalle := fmt.Sprintf("+%.1f km", extra)
	if largo > 0 {
		detalle += fmt.Sprintf(", +%.0f%%", pct)
	}
	switch {
	case extra > s.noKm:
		r.Recomendacion, r.Motivo = RecomNoConviene, "desvío grande ("+detalle+")"
	case extra < s.okKm || (largo > 0 && pct < 15):
		r.Recomendacion, r.Motivo = RecomConviene, "queda cerca de la ruta ("+detalle+")"
	case largo > 0 && pct > 40:
		r.Recomendacion, r.Motivo = RecomNoConviene, "alarga mucho la ruta ("+detalle+")"
	default:
		r.Recomendacion, r.Motivo = RecomDudoso, "desvío moderado ("+detalle+")"
	}
	return r
}

func round1(f float64) float64 { return float64(int(f*10+0.5)) / 10 }
