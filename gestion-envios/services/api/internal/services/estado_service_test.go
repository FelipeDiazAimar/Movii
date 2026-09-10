package services

import (
	"testing"

	"movii/api/internal/domain"
)

// TestTransicionValida cubre la matriz de HU-06 sin DB: los dos pares
// válidos (asignado ⇄ en_camino) y todo lo demás inválido, incluyendo los
// estados finales como destino (los gobiernan HU-07/HU-08 en sus planes).
func TestTransicionValida(t *testing.T) {
	casos := []struct {
		nombre  string
		origen  string
		destino string
		valida  bool
	}{
		{"asignado a en_camino", domain.EstadoEnvioAsignado, domain.EstadoEnvioEnCamino, true},
		{"en_camino a asignado", domain.EstadoEnvioEnCamino, domain.EstadoEnvioAsignado, true},

		{"mismo estado asignado", domain.EstadoEnvioAsignado, domain.EstadoEnvioAsignado, false},
		{"mismo estado en_camino", domain.EstadoEnvioEnCamino, domain.EstadoEnvioEnCamino, false},
		{"pendiente a asignado", domain.EstadoEnvioPendiente, domain.EstadoEnvioAsignado, false},
		{"asignado a pendiente", domain.EstadoEnvioAsignado, domain.EstadoEnvioPendiente, false},
		{"en_camino a pendiente", domain.EstadoEnvioEnCamino, domain.EstadoEnvioPendiente, false},
		{"asignado a entregado", domain.EstadoEnvioAsignado, domain.EstadoEnvioEntregado, false},
		{"en_camino a entregado", domain.EstadoEnvioEnCamino, domain.EstadoEnvioEntregado, false},
		{"asignado a no_entregado", domain.EstadoEnvioAsignado, domain.EstadoEnvioNoEntregado, false},
		{"en_camino a no_entregado", domain.EstadoEnvioEnCamino, domain.EstadoEnvioNoEntregado, false},
		{"entregado a en_camino", domain.EstadoEnvioEntregado, domain.EstadoEnvioEnCamino, false},
		{"no_entregado a asignado", domain.EstadoEnvioNoEntregado, domain.EstadoEnvioAsignado, false},
		{"origen desconocido", "inexistente", domain.EstadoEnvioEnCamino, false},
		{"destino desconocido", domain.EstadoEnvioAsignado, "inexistente", false},
	}

	for _, tc := range casos {
		t.Run(tc.nombre, func(t *testing.T) {
			if got := transicionValida(tc.origen, tc.destino); got != tc.valida {
				t.Errorf("transicionValida(%q, %q) = %v, quiere %v", tc.origen, tc.destino, got, tc.valida)
			}
		})
	}
}
