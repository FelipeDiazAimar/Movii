package services

import (
	"sync"

	"movii/api/internal/domain"
)

// FlotaHub reparte las posiciones en vivo de los vehículos a los clientes
// suscriptos por SSE (HU-11/HU-12). Es en memoria: alcanza con una instancia
// de la API.
type FlotaHub struct {
	mu   sync.Mutex
	subs map[chan domain.PosicionVehiculo]struct{}
	// ultima guarda la última posición de cada vehículo para quien se suscribe tarde.
	ultima map[string]domain.PosicionVehiculo
}

// NewFlotaHub crea un hub vacío.
func NewFlotaHub() *FlotaHub {
	return &FlotaHub{subs: map[chan domain.PosicionVehiculo]struct{}{}, ultima: map[string]domain.PosicionVehiculo{}}
}

// Suscribir devuelve un canal con las posiciones (empieza con la última conocida
// de cada vehículo) y la función para desuscribirse.
func (h *FlotaHub) Suscribir() (<-chan domain.PosicionVehiculo, func()) {
	ch := make(chan domain.PosicionVehiculo, 64)
	h.mu.Lock()
	for _, p := range h.ultima {
		select {
		case ch <- p:
		default:
		}
	}
	h.subs[ch] = struct{}{}
	h.mu.Unlock()

	var once sync.Once
	return ch, func() {
		once.Do(func() {
			h.mu.Lock()
			delete(h.subs, ch)
			h.mu.Unlock()
			close(ch)
		})
	}
}

// Publicar envía la posición a todos los suscriptos. Un cliente lento pierde
// posiciones intermedias en vez de frenar al resto.
func (h *FlotaHub) Publicar(p domain.PosicionVehiculo) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.ultima[p.VehiculoID] = p
	for ch := range h.subs {
		select {
		case ch <- p:
		default:
		}
	}
}

// Suscriptos devuelve la cantidad de clientes conectados.
func (h *FlotaHub) Suscriptos() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.subs)
}
