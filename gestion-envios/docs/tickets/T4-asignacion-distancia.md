# T4 — Validar dirección al asignar + recomendar por distancia

**Prioridad:** Alta | **Tipo:** Feature

## Historia
Como operador quiero que al asignar un pedido a una ruta se valide la dirección y me diga si conviene por distancia.

## Estado actual
Asignación en `/rutas/:id` (HU-04) no valida dirección. Ya existe `internal/platform/geo/` (usar de base).

## Alcance
### Backend `services/api`
- Interfaz `GeoProvider { Geocodificar(dir)->{lat,lon,confianza}, Matriz(origen,destinos)->km/min }`.
- Impl inicial gratis: Nominatim (geocode) + OSRM `router.project-osrm.org` (route/table). Dejar enchufable Google Distance Matrix (`GOOGLE_MAPS_KEY` opcional).
- Nuevo `POST /rutas/:id/recomendar {envio_id}`:
  - Geocodifica dirección envío + paradas actuales ruta. Si `confianza<0.6` o null → `422 {code:"direccion_invalida"}`.
  - Calcula `extra_km` y `desvio_%` = extra / largo actual.
  - Regla inicial: `<2km o <15% = conviene`, `>5km o >40% = no_conviene`, resto `dudoso`. Devuelve `{extra_km, desvio_pct, recomendacion, motivo}`.
- `POST /rutas/:id/envios` ahora exige `direccion_valida=true` (o llama a recomendar por dentro). Si `no_conviene` exige `{forzar:true}` + log.

### Frontend `apps/web`
- En panel asignación: al seleccionar envío muestra badge: verde "Conviene (+1.2km, +8%)" / amarillo "Dudoso" / rojo "No conviene (+9km, fuera de zona)". Botón Asignar deshabilitado si dirección inválida; si rojo pide checkbox "Asignar igual".

## Criterios de aceptación
1. Dirección vacía/inexistente → error `422` y no asigna.
2. Pedido a 1km → verde, asigna directo. Pedido a 15km → rojo, exige confirmar.
3. Sin internet a OSRM → mensaje "sin recomendación" pero permite asignar (degradado).
4. Tests: `recomendar_test.go` con 3 casos (cerca/lejos/inválida). Cache geocode 24h.

## Env nuevas
`GEO_PROVIDER=osrm`, `GOOGLE_MAPS_KEY` (opcional), `RECOMIENDA_UMBRAL_OK_KM=2`, `RECOMIENDA_UMBRAL_NO_KM=5`
