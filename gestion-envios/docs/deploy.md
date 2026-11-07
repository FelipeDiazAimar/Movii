# Deploy de Movii (Sprint 3)

| Pieza | Dónde | Por qué |
|---|---|---|
| Base de datos | **Supabase** (Postgres) | Ya la usamos; la API se conecta con `DATABASE_URL` como a cualquier Postgres. |
| API Go | **Railway** (Docker) | La API necesita un proceso siempre prendido: la sesión de WhatsApp, el simulador GPS y el stream SSE del mapa. Vercel solo corre funciones cortas y Supabase no ejecuta Go. |
| Panel web + PWA del repartidor | **Vercel** | Sitio estático: web en `/`, app del repartidor en `/app`. |
| App Android | **APK con EAS Build** | Instalable sin Play Store. |
| App iPhone | **PWA** ("Agregar a inicio") | Sin cuenta de Apple Developer. |

> La imagen Docker de la API sirve **todo** (web en `/`, PWA en `/app`, API en `/api`). Con solo Railway el sistema ya funciona completo; Vercel es el frente público recomendado.

## 1. Supabase
1. Project Settings → Database → anotar la contraseña (sin símbolos raros, o URL-encodeados).
2. Botón **Connect** → copiar **Session pooler**. Ese es el `DATABASE_URL`.
3. No hace falta correr migraciones a mano: la API las aplica al arrancar.

## 2. Railway (API)
1. New Project → Deploy from GitHub repo → elegir el repo, **Root Directory** `gestion-envios` (usa el `Dockerfile`).
2. Variables:
   ```
   DATABASE_URL=<session pooler de Supabase>
   JWT_SECRET=<cadena larga aleatoria>
   CORS_ORIGINS=https://<tu-proyecto>.vercel.app
   PUBLIC_WEB_URL=https://<tu-proyecto>.vercel.app
   PUBLIC_APP_URL=https://<tu-proyecto>.vercel.app/app/
   SIMULADOR_GPS=true
   WHATSAPP_HABILITADO=true
   ```
   (`PORT`, `MIGRATE_ON_START` y los directorios ya vienen en la imagen.)
3. Settings → Networking → **Generate Domain**. La API queda en `https://<dominio>/api` (eso es `MOVII_API_URL`); en `https://<dominio>/` ya funciona también la web y en `/app/` la app del repartidor.
4. Datos de demo para la presentación (rutas de hoy con camiones moviéndose): desde la PC, con el `DATABASE_URL` de producción, `go run ./cmd/demo` en `services/api`.

## 3. Vercel (web + PWA)
1. Add New Project → importar el repo → **Root Directory** `gestion-envios`. `vercel.json` ya define install, build y salida.
2. Environment Variables: `MOVII_API_URL=https://<api>.up.railway.app/api` (con `/api` al final: la imagen de Railway sirve la API bajo `/api`).
3. Deploy. Panel: `https://<proyecto>.vercel.app` · App del repartidor: `https://<proyecto>.vercel.app/app/`.

La web y la PWA llaman directo a la API de Railway (CORS habilitado para el dominio de Vercel), así el stream SSE del mapa no pasa por un proxy.

## 4. WhatsApp (vincular el número)
1. Entrar a la web como **supervisor** → menú **WhatsApp**.
2. En el celular de la empresa: WhatsApp → Configuración → Dispositivos vinculados → Vincular un dispositivo → escanear el QR.
3. Cargar el celular de cada usuario en **Usuarios** (columna Celular). Con eso:
   - al iniciar sesión, después de la contraseña se les pide el **código de 6 dígitos que les llega por WhatsApp** (web y app);
   - el repartidor recibe un aviso cuando le asignan envíos;
   - el destinatario recibe avisos con el link de seguimiento (usa el teléfono cargado en el envío).

La sesión queda guardada en la base (tablas `whatsmeow_*`): sobrevive a reinicios y redeploys. Es una conexión **no oficial** (como WhatsApp Web): usar un número de la empresa, no uno personal.

## 5. APK para Android (EAS Build)
```bash
cd apps/mobile
npx eas-cli login          # cuenta gratuita de Expo
npx eas-cli init           # vincula el proyecto (agrega el projectId)
# editar eas.json → profile "preview" → EXPO_PUBLIC_API_URL = URL de Railway
npx eas-cli build -p android --profile preview
```
Al terminar, EAS da un link/QR para descargar el `.apk`. En el teléfono: permitir "instalar apps desconocidas" e instalar.

## 6. iPhone (PWA)
1. Abrir `https://<proyecto>.vercel.app/app/` en **Safari**.
2. Compartir → **Agregar a inicio**.
3. Se abre a pantalla completa: sin barras del navegador, la barra de estado transparente sobre el fondo de la app y los márgenes del notch y la barra de inicio respetados (`viewport-fit=cover` + safe areas).

## Verificación rápida
- `GET https://<api>/health` → `{"status":"ok"}`
- Web: login → **Operaciones** muestra la flota y el mapa "En vivo".
- `/app/` en el celular: login, **Ver ruta en el mapa**, firma de entrega en todo el ancho.
