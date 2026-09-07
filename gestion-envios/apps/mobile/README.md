# Movii — Prototipo móvil

Movii es un prototipo móvil navegable para la gestión de entregas de última milla. Está pensado para el repartidor que opera su ruta diaria y, en paralelo, ofrece un recorrido público para que un cliente consulte el estado de un envío por código de guía. La implementación emplea Expo Router, React Native, TypeScript y datos mock locales; no necesita backend, credenciales ni llamadas de red.

## Ejecución local

Desde la carpeta del proyecto, instalá las dependencias y luego iniciá Expo. El comando abre la aplicación en modo web y permite acceder a la versión nativa mediante el código QR de Expo.

```bash
pnpm install
npx expo start
```

Para comprobar los tipos TypeScript antes de una entrega, ejecutá el siguiente comando.

```bash
pnpm check
```

## Recorridos incluidos

| Perfil o acceso | Punto de entrada | Recorrido principal |
|---|---|---|
| Repartidor | Inicio de sesión | Ruta del día → Detalle de parada → En camino / Entregado / No entregado / Reprogramar |
| Cliente final | «Seguir mi envío» | Código de guía → Estado del envío → Timeline y destino |
| Referencia de UI | Tab «Sistema» | Paleta → Tipografía → Botones y badges |

Para recorrer el flujo de tracking con datos completos, utilizá el código **`MOV-2026-000777`**. El flujo de login es demostrativo y permite seleccionar Operador o Repartidor; ambos accesos abren el flujo móvil del repartidor, ya que el panel de operación web no forma parte de este proyecto móvil.

## Datos del prototipo

Los modelos y los datos de ejemplo están en `types/logistics.ts` y `mock/shipments.ts`. El proyecto incluye ocho repartidores, rutas por Zona Norte, Centro, Zona Sur y Oeste, más de setenta envíos mock y el conjunto de estados `pendiente`, `en_camino`, `entregado` y `no_entregado`. Durante una sesión, las entregas, incidencias y reprogramaciones actualizan el estado local mediante `lib/movii-context.tsx`.

## Estructura relevante

| Ruta | Responsabilidad |
|---|---|
| `app/(tabs)` | Ruta diaria, historial, perfil y sistema de diseño |
| `app/stop/[id].tsx` | Detalle operativo de una parada |
| `app/delivery/[id].tsx` | Confirmación con firma y evidencia simulada |
| `app/failure/[id].tsx` | Registro de incidencia |
| `app/reschedule/[id].tsx` | Nueva fecha y franja de visita |
| `app/tracking` | Tracking público del cliente |
| `components` | Fondos aurora, timeline, cabecera, firma y primitivos visuales |

La guía completa de pantallas y navegación está en [PROTOTYPE.md](./PROTOTYPE.md). Las decisiones de diseño orientadas a móvil están en [design.md](./design.md).
