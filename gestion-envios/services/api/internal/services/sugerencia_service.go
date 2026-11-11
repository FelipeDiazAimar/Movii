package services

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"movii/api/internal/platform/geo"
	"movii/api/internal/repository"
)

// RutaSugerida es una ruta candidata para un envío, con los datos para decidir.
type RutaSugerida struct {
	RutaID           string   `json:"ruta_id"`
	Nombre           string   `json:"nombre"`
	Zona             string   `json:"zona"`
	Fecha            string   `json:"fecha"`
	RepartidorNombre string   `json:"repartidor_nombre"`
	Vehiculo         string   `json:"vehiculo"` // patente; vacío = sin vehículo
	CapacidadPeso    float64  `json:"capacidad_peso"`
	PesoActual       float64  `json:"peso_actual"`
	Paradas          int      `json:"paradas"`
	DistanciaKm      *float64 `json:"distancia_km"` // del destino al centro de las paradas; nil = sin coordenadas
	MismaFecha       bool     `json:"misma_fecha"`
	Cabe             bool     `json:"cabe"` // el envío entra en el vehículo (true si no hay vehículo)
	Recomendada      bool     `json:"recomendada"`
	Motivo           string   `json:"motivo"`
}

// RepartidorSugerido es un repartidor candidato para una ruta, con su carga del día.
type RepartidorSugerido struct {
	ID          string   `json:"id"`
	Nombre      string   `json:"nombre"`
	Rutas       int      `json:"rutas"`  // rutas que ya tiene ese día
	Envios      int      `json:"envios"` // envíos que ya tiene ese día
	PesoKg      float64  `json:"peso_kg"`
	EnCurso     bool     `json:"en_curso"` // ya salió a repartir ese día
	DistanciaKm *float64 `json:"distancia_km"`
	Actual      bool     `json:"actual"` // es el repartidor de la ruta hoy
	Recomendado bool     `json:"recomendado"`
	Motivo      string   `json:"motivo"`
}

// SugerenciaService arma los rankings de rutas por envío y repartidores por ruta.
type SugerenciaService struct{ repo *repository.SugerenciaRepo }

// NewSugerenciaService crea un SugerenciaService.
func NewSugerenciaService(repo *repository.SugerenciaRepo) *SugerenciaService {
	return &SugerenciaService{repo: repo}
}

func km(a, b geo.Punto) float64 { return math.Round(geo.DistanciaM(a, b)/100) / 10 }

func punto(lat, lng *float64) (geo.Punto, bool) {
	if lat == nil || lng == nil {
		return geo.Punto{}, false
	}
	return geo.Punto{Lat: *lat, Lng: *lng}, true
}

// RutasParaEnvio ordena las rutas planificadas: misma fecha primero, luego las
// que entran en el vehículo, luego las más cercanas al destino del envío.
func (s *SugerenciaService) RutasParaEnvio(ctx context.Context, envioID string) ([]RutaSugerida, error) {
	env, err := s.repo.EnvioParaSugerir(ctx, envioID)
	if err != nil {
		return nil, err
	}
	rutas, err := s.repo.RutasPlanificadas(ctx)
	if err != nil {
		return nil, err
	}
	return rankearRutas(env, rutas), nil
}

func rankearRutas(env repository.EnvioParaSugerir, rutas []repository.RutaPlanificada) []RutaSugerida {
	destino, hayDestino := punto(env.Lat, env.Lng)
	out := make([]RutaSugerida, 0, len(rutas))
	for _, r := range rutas {
		x := RutaSugerida{
			RutaID: r.ID, Nombre: r.Nombre, Zona: r.Zona, Fecha: r.Fecha, RepartidorNombre: r.RepartidorNombre,
			Vehiculo: r.Vehiculo, CapacidadPeso: r.CapacidadPeso, PesoActual: r.PesoActual, Paradas: r.Paradas,
			MismaFecha: env.FechaEntrega == r.Fecha,
			Cabe:       r.CapacidadPeso == 0 || r.PesoActual+env.Peso <= r.CapacidadPeso,
		}
		if hayDestino {
			ref, ok := punto(r.CentroLat, r.CentroLng)
			if !ok {
				ref = geo.CentroSanFrancisco // ruta vacía: se mide desde el depósito
			}
			d := km(destino, ref)
			x.DistanciaKm = &d
		}
		x.Motivo = motivoRuta(x)
		out = append(out, x)
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.MismaFecha != b.MismaFecha {
			return a.MismaFecha
		}
		if a.Cabe != b.Cabe {
			return a.Cabe
		}
		if (a.DistanciaKm == nil) != (b.DistanciaKm == nil) {
			return a.DistanciaKm != nil
		}
		if a.DistanciaKm != nil && *a.DistanciaKm != *b.DistanciaKm {
			return *a.DistanciaKm < *b.DistanciaKm
		}
		return a.Paradas < b.Paradas
	})
	if len(out) > 0 && out[0].MismaFecha && out[0].Cabe {
		out[0].Recomendada = true
	}
	return out
}

func motivoRuta(x RutaSugerida) string {
	var p []string
	if x.DistanciaKm != nil {
		if x.Paradas == 0 {
			p = append(p, fmt.Sprintf("a %.1f km del depósito (ruta vacía)", *x.DistanciaKm))
		} else {
			p = append(p, fmt.Sprintf("a %.1f km de sus paradas", *x.DistanciaKm))
		}
	}
	if !x.MismaFecha {
		p = append(p, "otra fecha que la entrega")
	}
	if !x.Cabe {
		p = append(p, "no entra en el vehículo")
	}
	if x.Vehiculo == "" {
		p = append(p, "sin vehículo")
	}
	return strings.Join(p, " · ")
}

// RepartidoresParaRuta devuelve los repartidores activos con su carga del día.
// Con rutaID, mide además la distancia entre el centro de la ruta y el punto
// más cercano de lo que ya reparte (o el depósito si no tiene nada ese día) y
// ordena por cercanía. Sin rutaID (alta de ruta) usa la fecha dada y ordena por carga.
func (s *SugerenciaService) RepartidoresParaRuta(ctx context.Context, rutaID, fecha string) ([]RepartidorSugerido, error) {
	var centro *geo.Punto
	var actualID string
	if rutaID != "" {
		r, err := s.repo.RutaParaSugerir(ctx, rutaID)
		if err != nil {
			return nil, err
		}
		fecha, actualID = r.Fecha, r.RepartidorID
		if p, ok := punto(r.CentroLat, r.CentroLng); ok {
			centro = &p
		} else {
			c := geo.CentroSanFrancisco
			centro = &c // ruta vacía: se mide contra el depósito
		}
	}
	fecha, err := fechaODefault(fecha, time.Now())
	if err != nil {
		return nil, err
	}
	activos, err := s.repo.RepartidoresActivos(ctx)
	if err != nil {
		return nil, err
	}
	paradas, err := s.repo.ParadasDelDia(ctx, fecha, rutaID)
	if err != nil {
		return nil, err
	}
	return rankearRepartidores(activos, paradas, centro, actualID), nil
}

func rankearRepartidores(activos []repository.RepartidorActivo, paradas []repository.ParadaDeRepartidor, centro *geo.Punto, actualID string) []RepartidorSugerido {
	out := make([]RepartidorSugerido, 0, len(activos))
	for _, a := range activos {
		x := RepartidorSugerido{ID: a.ID, Nombre: a.Nombre, Actual: a.ID == actualID}
		rutas := map[string]bool{}
		var minKm *float64
		for _, p := range paradas {
			if p.RepartidorID != a.ID {
				continue
			}
			rutas[p.RutaID] = true
			if p.RutaEstado == "en_curso" {
				x.EnCurso = true
			}
			if !p.TieneEnvio {
				continue
			}
			x.Envios++
			x.PesoKg += p.Peso
			if pt, ok := punto(p.Lat, p.Lng); ok && centro != nil {
				if d := km(*centro, pt); minKm == nil || d < *minKm {
					minKm = &d
				}
			}
		}
		x.Rutas = len(rutas)
		x.PesoKg = math.Round(x.PesoKg*10) / 10
		if centro != nil {
			if minKm == nil { // sin paradas ese día: sale desde el depósito
				d := km(*centro, geo.CentroSanFrancisco)
				minKm = &d
			}
			x.DistanciaKm = minKm
		}
		x.Motivo = motivoRepartidor(x)
		out = append(out, x)
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.EnCurso != b.EnCurso {
			return !a.EnCurso
		}
		if a.DistanciaKm != nil && b.DistanciaKm != nil && *a.DistanciaKm != *b.DistanciaKm {
			return *a.DistanciaKm < *b.DistanciaKm
		}
		if a.Envios != b.Envios {
			return a.Envios < b.Envios
		}
		return a.Nombre < b.Nombre
	})
	if len(out) > 0 && !out[0].EnCurso {
		out[0].Recomendado = true
	}
	return out
}

func motivoRepartidor(x RepartidorSugerido) string {
	var p []string
	switch {
	case x.Rutas == 0:
		p = append(p, "libre ese día")
	default:
		p = append(p, fmt.Sprintf("%d ruta(s), %d envío(s), %.1f kg", x.Rutas, x.Envios, x.PesoKg))
	}
	if x.DistanciaKm != nil {
		if x.Envios == 0 {
			p = append(p, fmt.Sprintf("a %.1f km del depósito", *x.DistanciaKm))
		} else {
			p = append(p, fmt.Sprintf("a %.1f km de una parada suya", *x.DistanciaKm))
		}
	}
	if x.EnCurso {
		p = append(p, "ya salió a repartir")
	}
	return strings.Join(p, " · ")
}
