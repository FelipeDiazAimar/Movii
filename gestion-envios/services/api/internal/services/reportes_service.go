package services

import (
	"context"
	"encoding/csv"
	"errors"
	"io"
	"math"
	"slices"
	"sort"
	"strings"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

var (
	// ErrPeriodoInvalido: desde/hasta faltan, no son YYYY-MM-DD, están invertidas o superan maxDiasPeriodo.
	ErrPeriodoInvalido = errors.New("periodo invalido")
	// ErrEstadoReporteInvalido: el filtro de estado no es un estado de envío.
	ErrEstadoReporteInvalido = errors.New("estado invalido")
)

// maxDiasPeriodo acota los reportes a un año para no barrer la base entera.
const maxDiasPeriodo = 366

var estadosEnvio = []string{domain.EstadoEnvioPendiente, domain.EstadoEnvioAsignado, domain.EstadoEnvioEnCamino, domain.EstadoEnvioEntregado, domain.EstadoEnvioNoEntregado}

// ColumnasCSVEnvios es el encabezado del CSV de HU-13.
var ColumnasCSVEnvios = []string{"Codigo Guia", "Fecha Creacion", "Remitente", "Destinatario", "Direccion", "Localidad", "Estado Actual", "Ultima Actualizacion", "Motivo Fallo"}

// ValidarPeriodo exige desde y hasta en YYYY-MM-DD estricto, desde <= hasta y a lo sumo maxDiasPeriodo días.
func ValidarPeriodo(desde, hasta string) (domain.Periodo, error) {
	d, errD := time.Parse("2006-01-02", desde)
	h, errH := time.Parse("2006-01-02", hasta)
	if errD != nil || errH != nil || d.Format("2006-01-02") != desde || h.Format("2006-01-02") != hasta {
		return domain.Periodo{}, ErrPeriodoInvalido
	}
	if h.Before(d) || h.Sub(d) > maxDiasPeriodo*24*time.Hour {
		return domain.Periodo{}, ErrPeriodoInvalido
	}
	return domain.Periodo{Desde: desde, Hasta: hasta}, nil
}

// ValidarEstadoReporte acepta vacío (todos) o un estado de envío existente.
func ValidarEstadoReporte(estado string) error {
	if estado != "" && !slices.Contains(estadosEnvio, estado) {
		return ErrEstadoReporteInvalido
	}
	return nil
}

// celdaSegura evita la inyección de fórmulas al abrir el CSV en una planilla:
// un valor cargado por un usuario que empieza con = + - @ se ejecutaría como fórmula.
func celdaSegura(v string) string {
	if v != "" && strings.ContainsRune("=+-@\t\r", rune(v[0])) {
		return "'" + v
	}
	return v
}

// ordenarRanking calcula la tasa de efectividad y ordena por tasa, luego
// entregas y luego nombre; asigna la posición 1..n.
func ordenarRanking(lista []domain.DesempenoRepartidor) {
	for i := range lista {
		lista[i].TasaEfectividad = porcentaje(lista[i].Entregados, lista[i].Entregados+lista[i].Fallidos)
		if p := lista[i].PromedioMinutosEntrega; p != nil {
			r := math.Round(*p*10) / 10
			lista[i].PromedioMinutosEntrega = &r
		}
	}
	sort.SliceStable(lista, func(a, b int) bool {
		x, y := lista[a], lista[b]
		if x.TasaEfectividad != y.TasaEfectividad {
			return x.TasaEfectividad > y.TasaEfectividad
		}
		if x.Entregados != y.Entregados {
			return x.Entregados > y.Entregados
		}
		return x.Nombre < y.Nombre
	})
	for i := range lista {
		lista[i].Posicion = i + 1
	}
}

// distribucionIncidencias arma el Pareto con los 5 motivos (también los de
// cantidad 0), de mayor a menor cantidad.
func distribucionIncidencias(conteo map[string]int) (int, []domain.MotivoIncidencia) {
	total := 0
	for _, n := range conteo {
		total += n
	}
	dist := make([]domain.MotivoIncidencia, 0, len(domain.MotivosFallo))
	for _, m := range domain.MotivosFallo {
		dist = append(dist, domain.MotivoIncidencia{Motivo: m, Etiqueta: domain.EtiquetasMotivo[m], Cantidad: conteo[m], Porcentaje: porcentaje(conteo[m], total)})
	}
	sort.SliceStable(dist, func(a, b int) bool { return dist[a].Cantidad > dist[b].Cantidad })
	return total, dist
}

// ReportesService arma los reportes de HU-13 (envíos/CSV), HU-14 (ranking) y HU-15 (incidencias).
type ReportesService struct {
	repo *repository.ReportesRepo
}

// NewReportesService crea un ReportesService.
func NewReportesService(repo *repository.ReportesRepo) *ReportesService {
	return &ReportesService{repo: repo}
}

// ReporteEnvios devuelve el listado del período en JSON.
func (s *ReportesService) ReporteEnvios(ctx context.Context, desde, hasta, estado string) (domain.ReporteEnvios, error) {
	periodo, err := ValidarPeriodo(desde, hasta)
	if err != nil {
		return domain.ReporteEnvios{}, err
	}
	if err := ValidarEstadoReporte(estado); err != nil {
		return domain.ReporteEnvios{}, err
	}
	filas := make([]domain.FilaReporteEnvio, 0)
	err = s.repo.RecorrerEnvios(ctx, desde, hasta, estado, func(f domain.FilaReporteEnvio) error {
		filas = append(filas, f)
		return nil
	})
	return domain.ReporteEnvios{Periodo: periodo, Total: len(filas), Envios: filas}, err
}

// ExportarEnviosCSV escribe el CSV en w fila por fila (UTF-8 con BOM para que
// las planillas muestren bien las tildes). El período y el estado tienen que
// validarse antes de llamarla: una vez que se escribe, ya no se puede responder un 400.
func (s *ReportesService) ExportarEnviosCSV(ctx context.Context, w io.Writer, desde, hasta, estado string) error {
	if _, err := io.WriteString(w, "\xEF\xBB\xBF"); err != nil {
		return err
	}
	cw := csv.NewWriter(w)
	if err := cw.Write(ColumnasCSVEnvios); err != nil {
		return err
	}
	err := s.repo.RecorrerEnvios(ctx, desde, hasta, estado, func(f domain.FilaReporteEnvio) error {
		motivo := ""
		if f.MotivoFallo != nil {
			motivo = etiquetaMotivo(*f.MotivoFallo)
		}
		return cw.Write([]string{
			celdaSegura(f.CodigoGuia), f.FechaCreacion, celdaSegura(f.Remitente), celdaSegura(f.Destinatario),
			celdaSegura(f.Direccion), celdaSegura(f.Localidad), f.Estado, f.UltimaActualizacion, motivo,
		})
	})
	cw.Flush()
	if err != nil {
		return err
	}
	return cw.Error()
}

// RankingRepartidores devuelve el ranking de desempeño del período (HU-14).
func (s *ReportesService) RankingRepartidores(ctx context.Context, desde, hasta string) (domain.RankingRepartidores, error) {
	periodo, err := ValidarPeriodo(desde, hasta)
	if err != nil {
		return domain.RankingRepartidores{}, err
	}
	lista, err := s.repo.DesempenoRepartidores(ctx, desde, hasta)
	if err != nil {
		return domain.RankingRepartidores{}, err
	}
	ordenarRanking(lista)
	return domain.RankingRepartidores{Periodo: periodo, Ranking: lista}, nil
}

// Incidencias devuelve la distribución de incidencias por motivo del período (HU-15).
func (s *ReportesService) Incidencias(ctx context.Context, desde, hasta string) (domain.ReporteIncidencias, error) {
	periodo, err := ValidarPeriodo(desde, hasta)
	if err != nil {
		return domain.ReporteIncidencias{}, err
	}
	conteo, err := s.repo.IncidenciasPorMotivo(ctx, desde, hasta)
	if err != nil {
		return domain.ReporteIncidencias{}, err
	}
	total, dist := distribucionIncidencias(conteo)
	return domain.ReporteIncidencias{Periodo: periodo, TotalIncidencias: total, Distribucion: dist}, nil
}
