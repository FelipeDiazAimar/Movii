package services

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
)

// Fuentes de una coordenada de destino (columna destinatarios.geo_fuente).
const (
	GeoFuenteNominatim  = "nominatim"
	GeoFuenteAproximada = "aproximada"
)

// geoRepo es lo que GeoService necesita de la base (repository.GeoRepo lo implementa).
type geoRepo interface {
	Direccion(ctx context.Context, destinatarioID string) (repository.DireccionDestinatario, error)
	DestinatarioDeEnvio(ctx context.Context, envioID string) (string, error)
	SinGeocodificar(ctx context.Context, limite int) ([]repository.DireccionDestinatario, error)
	GuardarCoordenadas(ctx context.Context, destinatarioID string, lat, lng float64, fuente string) error
}

// GeoService ubica en el mapa los destinos de los envíos (HU-12).
type GeoService struct {
	repo     geoRepo
	geocoder geo.Geocoder
}

// NewGeoService crea un GeoService.
func NewGeoService(repo geoRepo, geocoder geo.Geocoder) *GeoService {
	return &GeoService{repo: repo, geocoder: geocoder}
}

// GeocodificarDestinatario busca las coordenadas de la dirección y las guarda.
// Si la dirección exacta no aparece, prueba con la localidad sola y la marca
// como aproximada; si tampoco, usa el centro de San Francisco (la operación
// nunca deja un destino fuera del mapa).
func (s *GeoService) GeocodificarDestinatario(ctx context.Context, destinatarioID string) error {
	d, err := s.repo.Direccion(ctx, destinatarioID)
	if err != nil {
		return err
	}
	return s.geocodificar(ctx, d)
}

// abreviaturas que OpenStreetMap no reconoce en el nombre de la calle.
var abreviaturas = strings.NewReplacer(
	"Bv. ", "Bulevar ", "Bvd. ", "Bulevar ", "Bvard. ", "Bulevar ", "Bº ", "Barrio ",
	"Av. ", "Avenida ", "Avda. ", "Avenida ", "Gral. ", "General ", "Pte. ", "Presidente ",
	"Dr. ", "Doctor ", "Ing. ", "Ingeniero ", "Tte. ", "Teniente ", "Cnel. ", "Coronel ",
)

// ExpandirCalle reemplaza las abreviaturas comunes del nombre de una calle.
func ExpandirCalle(calle string) string {
	return strings.TrimSpace(abreviaturas.Replace(strings.TrimSpace(calle) + " "))
}

func (s *GeoService) geocodificar(ctx context.Context, d repository.DireccionDestinatario) error {
	calle := ExpandirCalle(d.Calle)
	// 1) dirección exacta, 2) la calle sin altura (OSM no siempre tiene numeración).
	for _, numero := range []string{d.Numero, ""} {
		p, err := s.geocoder.Geocodificar(ctx, calle, numero, d.Localidad, d.CodigoPostal)
		if err == nil {
			return s.repo.GuardarCoordenadas(ctx, d.ID, p.Lat, p.Lng, GeoFuenteNominatim)
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if !errors.Is(err, geo.ErrSinResultados) {
			return err // error de red: se reintenta en el próximo backfill
		}
		if numero == "" {
			break
		}
	}
	p, err := s.geocoder.Geocodificar(ctx, "", "", d.Localidad, d.CodigoPostal)
	if err != nil {
		if !errors.Is(err, geo.ErrSinResultados) {
			return err
		}
		p = geo.CentroSanFrancisco
	}
	return s.repo.GuardarCoordenadas(ctx, d.ID, p.Lat, p.Lng, GeoFuenteAproximada)
}

// GeocodificarEnvioAsync geocodifica en segundo plano el destino de un envío
// recién creado. No bloquea la respuesta del alta (la API pública de
// Nominatim admite una consulta por segundo).
func (s *GeoService) GeocodificarEnvioAsync(envioID string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		destID, err := s.repo.DestinatarioDeEnvio(ctx, envioID)
		if err == nil {
			err = s.GeocodificarDestinatario(ctx, destID)
		}
		if err != nil {
			log.Printf("geo: no se pudo geocodificar el envío %s: %v", envioID, err)
		}
	}()
}

// Backfill geocodifica los destinos que todavía no tienen coordenadas reales.
// Pensado para correr una vez al arrancar; devuelve cuántos actualizó.
func (s *GeoService) Backfill(ctx context.Context, limite int) (int, error) {
	pendientes, err := s.repo.SinGeocodificar(ctx, limite)
	if err != nil {
		return 0, err
	}
	n := 0
	for _, d := range pendientes {
		if err := s.geocodificar(ctx, d); err != nil {
			if ctx.Err() != nil {
				return n, ctx.Err()
			}
			log.Printf("geo: backfill %s: %v", d.ID, err)
			continue
		}
		n++
	}
	return n, nil
}
