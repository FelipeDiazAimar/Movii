package services

import (
	"context"
	"time"

	"movii/api/internal/domain"
	"movii/api/internal/repository"
)

// RepartidorService contiene la lógica de negocio de HU-05.
type RepartidorService struct {
	envioRepo *repository.EnvioRepo
}

// NewRepartidorService crea un RepartidorService.
func NewRepartidorService(envioRepo *repository.EnvioRepo) *RepartidorService {
	return &RepartidorService{envioRepo: envioRepo}
}

// EnviosDelDia devuelve los envíos de hoy del repartidor dado, agrupados por
// ruta, con el resumen de contadores por estado.
func (s *RepartidorService) EnviosDelDia(ctx context.Context, repartidorID, estado string) (domain.ResumenDelDia, error) {
	hoy := time.Now().UTC().Format("2006-01-02")

	envios, err := s.envioRepo.ListDelDiaPorRepartidor(ctx, repartidorID, hoy, estado)
	if err != nil {
		return domain.ResumenDelDia{}, err
	}

	total, pendientes, asignados, enCamino, entregados, noEntregados := calcularContadores(envios)

	return domain.ResumenDelDia{
		Fecha:        hoy,
		Rutas:        agruparPorRuta(envios),
		Total:        total,
		Pendientes:   pendientes,
		Asignados:    asignados,
		EnCamino:     enCamino,
		Entregados:   entregados,
		NoEntregados: noEntregados,
	}, nil
}

// agruparPorRuta agrupa los envíos por ruta, preservando el orden de
// aparición de cada ruta en la lista de entrada. Devuelve siempre un slice
// no nulo: un repartidor sin envíos asignados hoy debe serializarse como
// "rutas": [] y no como "rutas": null, porque el cliente móvil recorre esa
// lista directamente y con null rompe (mostraría un error de conexión en vez
// del estado vacío "no tenés envíos asignados para hoy").
func agruparPorRuta(envios []domain.EnvioDelDia) []domain.RutaConEnviosDelDia {
	grupos := make([]domain.RutaConEnviosDelDia, 0, len(envios))
	indicePorRuta := make(map[string]int)

	for _, e := range envios {
		rutaID := ""
		if e.Envio.RutaID != nil {
			rutaID = *e.Envio.RutaID
		}
		idx, existe := indicePorRuta[rutaID]
		if !existe {
			grupos = append(grupos, domain.RutaConEnviosDelDia{RutaID: rutaID, RutaNombre: e.RutaNombre})
			idx = len(grupos) - 1
			indicePorRuta[rutaID] = idx
		}
		grupos[idx].Envios = append(grupos[idx].Envios, e)
	}
	return grupos
}

// calcularContadores cuenta los envíos por estado para el resumen del día.
func calcularContadores(envios []domain.EnvioDelDia) (total, pendientes, asignados, enCamino, entregados, noEntregados int) {
	for _, e := range envios {
		total++
		switch e.Estado {
		case domain.EstadoEnvioPendiente:
			pendientes++
		case domain.EstadoEnvioAsignado:
			asignados++
		case domain.EstadoEnvioEnCamino:
			enCamino++
		case domain.EstadoEnvioEntregado:
			entregados++
		case domain.EstadoEnvioNoEntregado:
			noEntregados++
		}
	}
	return
}
