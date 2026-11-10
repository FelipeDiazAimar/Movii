# T5 — Vista 3D rutas en web + botón Abrir en Google Maps

**Prioridad:** Baja (Spike 3-5d) + MVP | **Tipo:** Spike + Feature

## Historia
Como operador quiero ver en 3D cada ruta y dónde va cada repartidor. Como repartidor quiero abrir la ruta en Maps con 1 toque.

## Aclaración importante
Los archivos `reference.mp4`, `map-flight.mp4`, `new-york-camera.esp` y Prompts A/B/C son pipeline de **video promo** (Earth Studio + `camera.json/route.json` + render frame-by-frame). No sirven para tiempo real. No replicar eso en la app. La vista 3D real va con Mapbox 3D / Google 3D Tiles + posición en vivo.

## Alcance
### A) Spike 3D solo web (no móvil)
- Nueva ruta `/rutas/:id/3d` con toggle 2D/3D.
- Evaluar y elegir (doc `docs/decisions/3d-mapas.md`): Mapbox GL JS `freeCamera+terrain` vs Google Photorealistic 3D Tiles (Cesium/deck.gl). Criterio: costo/cuota, perf, créditos visibles.
- Dibuja: ruta OSRM (línea azul `#2F7FF5`), paradas, dot repartidor (posición simulada o `WS /rutas/:id/live` cada 5s si ya hay GPS). Controles tilt/bearing. Fallback 2D si sin WebGL.

### B) Botón Abrir en Google Maps (web + móvil)
- Web en detalle ruta + móvil en ficha entrega: botón "Abrir en Maps".
- Genera `https://www.google.com/maps/dir/?api=1&origin=..&destination=proxima_parada&waypoints=..&travelmode=driving`.
- Modos: "Próximo destino" (default) y "Ruta completa". En móvil usa `Linking.openURL` (abre app nativa), en web `target=_blank`.

## Criterios de aceptación
1. Toggle 3D carga <3s en desktop, no tapa créditos del mapa.
2. Dot repartidor se mueve (aunque sea simulado en spike).
3. Botón Maps abre ruta correcta con 2+ paradas (testeado en Android + web).
4. Doc decisión + demo deployada para aprobar MVP.

## Fuera de alcance
Seguimiento cada 1s, Earth Studio en prod, navegación turn-by-turn propia.
