# Decisión: motor de mapas 3D para la vista de rutas (T5)

Fecha: 2026-11-07. Estado: spike aprobado para MVP.

## Opciones evaluadas

| | Mapbox GL JS | Google Photorealistic 3D Tiles (Cesium / deck.gl) | MapLibre GL JS + OpenFreeMap |
|---|---|---|---|
| **Costo / cuota** | Requiere token. Gratis hasta 50k cargas de mapa web/mes, luego por uso. | Requiere API key y facturación en Google Cloud. Cuota gratuita limitada, luego facturado por 1000 root tile requests. | Gratis, sin key ni tarjeta. Librería de código abierto (BSD); tiles vectoriales de OpenFreeMap sin cuota, DEM de Terrarium (AWS Open Data). |
| **Capacidades 3D** | Terreno, edificios extruidos, freeCamera. | Malla fotorrealista continua de ciudades (cobertura en Argentina muy dispar fuera de CABA). | Edificios vectoriales 3D extruidos (estilo Liberty) y terreno raster-dem; soporte de inclinación (pitch) hasta 85° y rotación (bearing). |
| **Performance** | Muy buena (<2 s). | Muy pesada: cientos de MB de 3D tilesets, exigencia extrema de GPU WebGL2, carga > 5-10 s en conexiones intermedias. | Excelente; chunk separado con `React.lazy` (~800 KB gzip), carga inicial < 3 s en desktop. |
| **Créditos visibles** | Logo y atribución obligatorios, reglas estrictas de Mapbox. | Logo Google y atribución de datos cartográficos obligatorios, no se pueden ocultar ni tapar. | Atribución OSM / OpenFreeMap obligatoria: `attributionControl` activo por defecto abajo a la derecha, sin tapar. |
| **Lock-in** | Licencia propietaria comercial a partir de v2. | Muy alto; APIs cerradas de Google Cloud. | Mínimo: estándar libre compatible con Mapbox GL v1; estilos intercambiables. |

## Elección: MapLibre GL JS + OpenFreeMap

- **Sin secretos ni facturación:** se despliega inmediatamente en cualquier ambiente (incluido CI y Vercel) sin credenciales ni riesgo de cobros inesperados.
- **Cumplimiento del alcance T5:**
  - Trazado de ruta OSRM con polilínea azul corporativa (`#2F7FF5`) con borde de contraste blanco.
  - Paradas numeradas interactivas con popups (código de guía, destinatario, dirección y badge de estado: pendiente, en camino, entregado).
  - Marcador de Depósito Central (🏢) con punto de partida y retorno.
  - Dot repartidor (🚚) con radar pulsante, posición en vivo vía SSE (`/operaciones/flota/stream`) o simulación continua cada 5 s sobre la geometría/paradas.
  - Controles de cámara: sliders de pitch/bearing y presets rápidos (*🎯 Centrar en repartidor*, *📐 Vista 3D*, *🗺️ Cenital*, *🔄 Resetear encuadre*).
- **Criterio de rendimiento (< 3 s):** chunk asíncrono con `React.lazy` y `Suspense`, sin descargas masivas de mallas poligonales.
- **Créditos legales:** atribución obligatoria de OpenFreeMap / OpenStreetMap preservada abajo a la derecha; controles propios ubicados arriba a la izquierda.
- **Fallback transparente:** si el navegador no soporta WebGL (`hayWebGL() === false`), conmuta automáticamente a la vista 2D (`RutaMapaPage`) sin interrumpir la operación.

## Integración con Google Maps (Parte B)

- **Web:** componente `BotonAbrirMaps` disponible en detalle de ruta (`/rutas/:id`), mapa 2D (`/rutas/:id/mapa`) y vista 3D (`/rutas/:id/3d`), con selector de modo:
  - *Próximo destino:* genera enlace directo al primer punto pendiente.
  - *Ruta completa:* genera ruta con destino final y waypoints ordenados (hasta 9 waypoints para cumplir con el límite de la URL de Google Maps Directions).
- **Móvil (Android / iOS):**
  - En la ficha de entrega (`app/stop/[id].tsx`), el repartidor cuenta con selector de modo (*Próximo destino* vs *Ruta completa con X paradas pendientes*). Al tocar el botón, se abre la app nativa de Google Maps vía `Linking.openURL(url)`.
  - En el mapa general de ruta (`app/route-map.tsx`), tarjeta de navegación directa a Maps con modo próxima parada y ruta completa.

## Riesgos y próximos pasos post-MVP

1. **SLA del proveedor de tiles:** OpenFreeMap es un servicio comunitario; para producción a gran escala se recomienda self-host de tiles o contratar proveedor con SLA (MapTiler o Stadia Maps).
2. **Navegación turn-by-turn:** fuera de alcance de este ticket; la delegación a Google Maps resuelve de forma nativa la navegación por voz y tráfico sin costo de desarrollo.
