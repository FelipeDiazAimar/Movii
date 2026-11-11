# Orden de las paradas: recorrido más corto

**Fecha:** 11/11/2026 · **Estado:** aceptada (reemplaza lo anotado el 07/11 en el backlog del Sprint 3,
"la optimización de rutas queda fuera de alcance").

## Contexto

Hasta ahora el orden de visita de una ruta era el orden de alta de sus envíos. Cada tramo entre
dos paradas ya era el camino más corto por calles (OSRM), pero el orden no: el recorrido podía ir y
volver por la ciudad. En la demo se notaba (14,5 km para una ruta que se puede hacer en 8,6 km).

## Decisión

- Nueva columna `envios.orden_ruta` (migración 0016). Las consultas de paradas (mapa, simulador,
  app del repartidor, detalle de ruta) ordenan por ella.
- `services.OrdenadorRutas` calcula el orden que minimiza la distancia total por calles: sale del
  depósito (o, con la ruta en curso, de donde está el camión), pasa por las paradas pendientes y
  vuelve al depósito. Las paradas ya resueltas conservan su lugar; las que no tienen ubicación van
  al final.
- Algoritmo: exacto (programación dinámica de Held-Karp) hasta 11 paradas; con más, vecino más
  cercano y mejora 2-opt. La matriz de distancias la da el mismo proveedor que la recomendación al
  asignar (OSRM `/table` o Google); si falla, se usa la distancia en línea recta.
- Se recalcula al asignar envíos a la ruta y al iniciarla (`POST /rutas/{id}/iniciar`).

## Consecuencias

- El operador ya no define el orden a mano. Si en el futuro hace falta fijar una parada
  (por ejemplo, una entrega con horario), habría que agregar un orden manual que el ordenador respete.
- Con más de 11 paradas el resultado es muy bueno pero no garantizadamente óptimo.
