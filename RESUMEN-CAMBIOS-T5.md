# Resumen de Cambios: T5 — Vista 3D de Rutas y Navegación en Google Maps

Este documento resume los cambios implementados en la rama `feat/t5-3d-maps-google-maps` para completar el alcance del ticket **T5** (Spike 3D en Web y botón "Abrir en Maps" en Web y Móvil), solucionando además los problemas de carga del Web Worker en entornos de producción con Vite.

---

## 1. Problemas Resueltos

1. **Fallo de carga del Web Worker de MapLibre GL en Vite / Producción**:
   - **Error original**: `Failed to load module script: The server responded with a non-JavaScript MIME type of "text/html"`.
   - **Causa**: MapLibre GL intentaba resolver de manera dinámica el script del worker (`maplibre-gl-worker.mjs`). Al no estar empaquetado explícitamente en `dist/assets/`, el servidor de la SPA aplicaba la regla catch-all (`/* -> index.html`), sirviendo HTML con error de MIME type.
   - **Solución**:
     - En `apps/web/src/features/mapas/Mapa3D.tsx` se importó el worker con el modificador oficial de Vite: `import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"` y se registró globalmente mediante `maplibregl.setWorkerUrl(maplibreWorkerUrl)`.
     - Se copiaron copias estáticas a `apps/web/public/assets/maplibre-gl-worker.mjs` y `apps/web/public/maplibre-gl-worker.mjs` para garantizar que cualquier solicitud directa del navegador reciba siempre JavaScript válido (`application/javascript`).

2. **Toggle 2D / 3D Unificado (Web)**:
   - Se implementó un control segmentado `Toggle2D3D` accesible tanto en la vista 2D (`/rutas/:id/mapa`) como en la vista 3D (`/rutas/:id/3d`), permitiendo alternar de forma inmediata entre ambos motores de mapa.
   - Si el dispositivo o navegador no dispone de aceleración WebGL (`hayWebGL() === false`), conmuta automáticamente a la vista 2D de respaldo sin romper la navegación.

3. **Completitud de la Vista 3D (`Ruta3DPage` y `Mapa3D`)**:
   - **Encabezado completo de ruta**: Nombre de ruta, fecha, repartidor, patente del vehículo asignado, distancia total en kilómetros y tiempo estimado de manejo.
   - **Acción directa a Maps**: Botón "Abrir en Maps" integrado en la barra de herramientas superior.
   - **Lista interactiva de paradas**: Muestra todas las entregas ordenadas con código de guía, destinatario, dirección y badge de estado. Al hacer clic en cualquier parada, la cámara 3D vuela y se enfoca en las coordenadas de ese destino (`flyTo`).
   - **Marcador de Depósito Central**: Se agregó el marcador de origen y retorno con icono `🏢` y popup descriptivo.
   - **Marcadores de paradas con estados**: Colores distintivos (verde para entregado, azul para en camino, oscuro para pendiente) y popup emergente interactivo con detalles.
   - **Dot del Repartidor interactivo**: Vehículo `🚚` con radar pulsante, lectura de posición en vivo por SSE (`/operaciones/flota/stream`) y fallback de simulación cada 5 s si no hay señal GPS. Popup al hacer clic con datos del chofer y vehículo.
   - **Controles de cámara avanzados**: Sliders de inclinación (pitch 0° a 85°) y rotación (bearing -180° a 180°), más botones de acceso rápido: *🎯 Repartidor*, *📐 Vista 3D*, *🗺️ Cenital* y *🔄 Resetear encuadre*.

4. **Navegación en Google Maps con Modo "Próximo destino" y "Ruta completa" (Mobile)**:
   - **Ficha de entrega (`stop/[id].tsx`)**: Selector segmentado para que el chofer elija entre navegar directamente hacia el destino actual (*Próximo destino*) o cargar la ruta completa con todas las paradas pendientes del día con waypoints (*Ruta completa*).
   - **Pantalla de mapa de ruta (`route-map.tsx`)**: Se incorporó la tarjeta de navegación a Google Maps con selector de modo (próxima parada vs ruta completa).
   - La URL generada cumple con el límite de la API de Google Maps Directions (`destination` + hasta 9 `waypoints` separados por `|`).

---

## 2. Archivos Modificados y Creados

### Frontend Web (`apps/web`)
* [`apps/web/src/features/mapas/Mapa3D.tsx`](gestion-envios/apps/web/src/features/mapas/Mapa3D.tsx):
  * Importación del worker con `?worker&url` y registro con `setWorkerUrl()`.
  * Marcador de depósito central, popups en paradas y dot de repartidor animado.
  * Presets de cámara rápida y soporte para enfocar paradas seleccionadas (`paradaDestacadaId`).
* [`apps/web/src/pages/rutas/Ruta3DPage.tsx`](gestion-envios/apps/web/src/pages/rutas/Ruta3DPage.tsx):
  * Vista 3D completa con encabezado de ruta, `Toggle2D3D`, `BotonAbrirMaps` y lista de paradas.
* [`apps/web/src/pages/rutas/RutaMapaPage.tsx`](gestion-envios/apps/web/src/pages/rutas/RutaMapaPage.tsx):
  * Integración de `Toggle2D3D` y `BotonAbrirMaps` en el encabezado.
* [`apps/web/src/components/ui/Toggle2D3D.tsx`](gestion-envios/apps/web/src/components/ui/Toggle2D3D.tsx) *(Nuevo)*:
  * Control segmentado de navegación entre `/rutas/:id/mapa` y `/rutas/:id/3d`.
* [`apps/web/src/components/ui/Toggle2D3D.test.tsx`](gestion-envios/apps/web/src/components/ui/Toggle2D3D.test.tsx) *(Nuevo)*:
  * Tests unitarios para el selector 2D/3D.
* [`apps/web/public/assets/maplibre-gl-worker.mjs`](gestion-envios/apps/web/public/assets/maplibre-gl-worker.mjs) *(Nuevo)*:
  * Archivo de worker estático servido como JS independiente.

### Aplicación Móvil (`apps/mobile`)
* [`apps/mobile/app/stop/[id].tsx`](gestion-envios/apps/mobile/app/stop/[id].tsx):
  * Selector segmentado de modo (Próximo destino vs Ruta completa) y botón "Abrir en Maps".
* [`apps/mobile/app/route-map.tsx`](gestion-envios/apps/mobile/app/route-map.tsx):
  * Tarjeta de navegación externa a Google Maps con selector de modo.
* [`apps/mobile/tests/google-maps.test.ts`](gestion-envios/apps/mobile/tests/google-maps.test.ts):
  * Test para validar la apertura con múltiples paradas de texto y waypoints.

### Documentación (`docs`)
* [`docs/decisions/3d-mapas.md`](gestion-envios/docs/decisions/3d-mapas.md):
  * Actualizado con los detalles de arquitectura, motor MapLibre GL, OpenFreeMap, resolución del worker y Google Maps.

---

## 3. Estado de Pruebas y Validación

* **Web Tests:** 22 archivos pasados, 110 tests exitosos (`npm test -- --run` en `apps/web`).
* **Web Build:** `npm run build` exitoso, generando el chunk del worker `maplibre-gl-worker-[hash].js` de 520 KB.
* **Mobile Tests:** 8 archivos pasados (1 skipped auth), 59 tests exitosos (`npm test -- --run` en `apps/mobile`).
* **Go Backend Tests:** Todos los flujos RBAC, login Google, primer acceso y recomendación por distancia verificados.

---

## 4. Guía para Comparar y Rejuntar con tu Compañero

1. Obtener la rama remota:
   ```bash
   git fetch origin
   git checkout feat/t5-3d-maps-google-maps
   ```
2. Comparar diferencias contra tu rama de trabajo (o `main`):
   ```bash
   git diff main..feat/t5-3d-maps-google-maps
   ```
3. Para fusionar los cambios:
   ```bash
   git merge feat/t5-3d-maps-google-maps
   ```
4. Probar en local:
   * **Web**: `cd apps/web && npm run dev`
   * **Build de producción**: `cd apps/web && npm run build`
