# Decisión: motor de mapas 3D para la vista de rutas (T5)

Fecha: 2026-11-07. Estado: spike aprobado para MVP.

## Opciones

| | Mapbox GL JS | Google Photorealistic 3D Tiles (Cesium / deck.gl) | MapLibre GL JS + OpenFreeMap |
|---|---|---|---|
| Costo / cuota | Requiere token. Gratis hasta 50k cargas de mapa web/mes, luego por uso. | Requiere API key y facturación en Google Cloud. Cuota gratuita limitada, luego por 1000 root tile requests. | Gratis, sin key. Librería BSD; tiles de OpenFreeMap sin cuota, DEM de Terrarium (AWS Open Data). |
| 3D | Terreno, edificios extruidos, freeCamera. | Malla fotorrealista de ciudades (cobertura en Argentina variable). | Edificios extruidos (estilo liberty) y terreno raster-dem; pitch/bearing hasta 85. |
| Performance | Muy buena. | Pesada: cientos de MB de tiles, GPU exigente, difícil cargar en menos de 3 s. | Buena; bundle ~800 KB (se carga con lazy). |
| Créditos | Logo y atribución obligatorios. | Logo de Google y atribución de datos obligatorios, no se pueden tapar. | Atribución OSM / OpenFreeMap obligatoria (control por defecto, abajo a la derecha). |
| Lock-in | Licencia propietaria desde v2. | Alto. | Bajo: API compatible con Mapbox GL v1, estilos intercambiables. |

## Elección: MapLibre GL JS

- Sin key ni tarjeta: el spike se deploya hoy sin gestionar secretos.
- Cumple lo pedido: línea de ruta `#2F7FF5`, paradas, dot del repartidor, tilt/bearing, edificios 3D.
- Carga rápida (< 3 s): sin tiles masivos; chunk separado con `React.lazy`.
- Créditos: se deja el `attributionControl` por defecto y los controles propios van arriba a la izquierda.
- Si hace falta realismo fotográfico más adelante, la capa de datos (`/rutas/{id}/mapa`, SSE de flota) es independiente del motor y se puede migrar.

## Implementación

- Ruta `/rutas/:id/3d` (`pages/rutas/Ruta3DPage.tsx`, lazy en `App.tsx`). Toggle 2D/3D en el detalle de ruta.
- Sin WebGL cae a `RutaMapaPage` (2D Leaflet).
- Posición del repartidor: SSE `/operaciones/flota/stream` si hay; si no, simulación cada 5 s sobre la polilínea OSRM.
- Terreno: en zonas llanas (Rafaela) casi no se nota; es barato y queda activo.

## Pendiente / riesgos

- OpenFreeMap es un servicio comunitario sin SLA: para producción evaluar self-host o un proveedor pago (MapTiler, Stadia).
- No se probó en dispositivos reales ni con GPS real.
