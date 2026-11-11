# Movii — App del repartidor

App del repartidor (Expo SDK 57 + React Native + Expo Router + TypeScript). Consume la API en Go de
`services/api` con el JWT del repartidor: el repartidor siempre sale del token, nunca de un parámetro.
Se distribuye como **APK** (EAS Build, perfil `preview` en `eas.json`) y como **PWA** servida por la
API en `/app/` (iPhone: "Agregar a inicio").

## Ejecución local

```bash
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL = IP de la PC en la red (el celular no ve "localhost")
npx expo start         # QR para Expo Go; "w" abre la versión web
npm test               # Vitest
npx tsc --noEmit
```

Desde `gestion-envios/`, `npm run dev` levanta API, web y app juntas, y `npm run serve` sirve todo
desde Go (la app queda en `http://localhost:8080/app/`).

## Qué hace

| Pantalla | HU | Qué hace |
|---|---|---|
| `login`, `forgot-password`, `oauth/` | HU-01, HU-16 | Login en dos pasos (código por WhatsApp), login con Google y recuperación. |
| `(tabs)/index` | HU-05 | Envíos del día agrupados por ruta. Si una ruta todavía está en el depósito aparece la tarjeta **"Iniciar ruta"**: todos sus envíos salen "en camino" a la vez. |
| `stop/[id]` | HU-06, HU-12 | Detalle de la parada, camino desde el camión y "Abrir en Google Maps". Con la ruta iniciada: **Entregado** o **No entregado**; antes de iniciarla, la parada indica que el envío sigue en el depósito. |
| `delivery/[id]` | HU-08 | Confirmación con firma (todo el ancho del recuadro) y foto. |
| `failure/[id]` | HU-07 | Incidencia con motivo, comentario (con límite) y foto opcional. |
| `reschedule/[id]` | HU-09 | Nueva fecha y franja. |
| `route-map` | HU-12 | Mapa real de la ruta con el recorrido por calles y el camión. |
| `(tabs)/orders`, `pedido/` | — | "Mis pedidos": envíos viejos, de hoy y próximos, con búsqueda y ficha completa. |
| `(tabs)/history`, `(tabs)/profile` | — | Historial y perfil (vehículo de hoy, estadísticas, cambio de contraseña). |

El "en camino" ya no se marca envío por envío: lo pone **Iniciar ruta** (`POST /rutas/{id}/iniciar`).

## Presentación

Con el botón ▶ del centro de operaciones (web, admin), la ruta del camión naranja (TRK-318) queda
en el depósito y es de la cuenta `repartidor@movii.demo`: se inicia en vivo desde esta app. Ese
camión no entrega solo: espera en cada puerta a que se confirme la entrega desde la app (ver
`SIMULADOR_ENTREGA_MANUAL` en `docs/deploy.md`).

## Más documentación

- Guía de pantallas y navegación del prototipo original: [PROTOTYPE.md](./PROTOTYPE.md).
- Decisiones de diseño orientadas a móvil: [design.md](./design.md).
