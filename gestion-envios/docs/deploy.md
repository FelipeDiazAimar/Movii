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

   Opcionales, para la validación de dirección y la recomendación por distancia al asignar envíos a una ruta:
   ```
   GEO_PROVIDER=osrm              # osrm (Nominatim + OSRM, gratis) | google
   GOOGLE_MAPS_KEY=               # solo con GEO_PROVIDER=google (Geocoding + Distance Matrix)
   RECOMIENDA_UMBRAL_OK_KM=2      # desvío menor a esto: "conviene"
   RECOMIENDA_UMBRAL_NO_KM=5      # desvío mayor a esto: "no conviene" (exige confirmar)
   ```
   Si el proveedor de mapas no responde, la recomendación pasa a `sin_recomendacion` y la asignación sigue permitida. Con `GEOCODIFICAR=false` no se valida ni recomienda.

   Opcionales, primer acceso (T1) y login con Google (T2) — ver sección 7:
   ```
   OTP_TTL_MIN=10                 # vigencia del código de verificación (minutos)
   OTP_MAX_INTENTOS=3             # intentos por código
   RESEND_API_KEY=re_...          # mail del código a quien no tiene celular; vacío = va al log
   MAIL_FROM=Movii <no-reply@tu-dominio.com>
   SMTP_USER=avisos.movii@gmail.com   # Gmail (prioridad sobre Resend): código y respaldo de avisos
   SMTP_PASSWORD=abcdefghijklmnop     # contraseña de aplicación de Google (16 letras)
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_CALLBACK_URL=https://<dominio-railway>/api/auth/google/callback
   ```
3. Settings → Networking → **Generate Domain**. La API queda en `https://<dominio>/api` (eso es `MOVII_API_URL`); en `https://<dominio>/` ya funciona también la web y en `/app/` la app del repartidor.
4. Las rutas se crean desde el panel (Rutas → Nueva ruta, asignar envíos y vehículo). Para la presentación, el botón ▶ de Operaciones arma un día de demostración (ver "Datos de demostración" más abajo).

## 3. Vercel (web + PWA)
1. Add New Project → importar el repo → **Root Directory** `gestion-envios`. `vercel.json` ya define install, build y salida.
2. Environment Variables: `MOVII_API_URL=https://<api>.up.railway.app/api` (con `/api` al final: la imagen de Railway sirve la API bajo `/api`).
3. Deploy. Panel: `https://<proyecto>.vercel.app` · App del repartidor: `https://<proyecto>.vercel.app/app/`.

La web y la PWA llaman directo a la API de Railway (CORS habilitado para el dominio de Vercel), así el stream SSE del mapa no pasa por un proxy.

## 4. WhatsApp (vincular el número)
1. Entrar a la web como **admin** → menú **WhatsApp**.
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

## 7. Primer acceso y login con Google
**Primer acceso (T1).** Los usuarios que crea el admin (o `POST /auth/register`) quedan con `must_change_password`: en su primer login la web los lleva a `/primer-acceso`, eligen contraseña nueva (8+ caracteres, una mayúscula y un número) y validan un código de 6 dígitos que llega por **WhatsApp** si tienen celular (y WhatsApp está vinculado) o por **mail** si no. Los usuarios que ya existían no se ven afectados. La app móvil muestra el aviso de hacerlo desde la web.

Mail con [Resend](https://resend.com) (gratis hasta 3.000 mails/mes):
1. Crear cuenta → **API Keys** → crear una → `RESEND_API_KEY`.
2. **Domains** → agregar el dominio de la empresa y cargar los registros DNS que indica. `MAIL_FROM` tiene que usar ese dominio (ej. `Movii <no-reply@empresa.com>`). Para probar sin dominio: `MAIL_FROM=onboarding@resend.dev` (solo envía al mail de la cuenta de Resend).
3. Sin `RESEND_API_KEY`/`MAIL_FROM` el código se escribe en el log de Railway (igual que WhatsApp deshabilitado).

Mail con **Gmail** (recomendado: manda a cualquier destinatario sin dominio propio; tiene prioridad sobre Resend):
1. En la cuenta de Google que va a mandar los mails, activar la **verificación en dos pasos**.
2. **Cuenta de Google → Seguridad → Contraseñas de aplicaciones** → crear una ("Movii") y copiar las 16 letras.
3. Cargar `SMTP_USER=<la cuenta>@gmail.com` y `SMTP_PASSWORD=<las 16 letras>`. El panel **WhatsApp y mail** muestra "Mail de respaldo · Gmail".
4. Los avisos al destinatario salen por WhatsApp; si WhatsApp no está vinculado, el número no es válido o no tiene WhatsApp, salen por mail (si el envío tiene el mail del destinatario). El detalle del envío muestra por qué canal salió cada aviso.

**Datos de demostración: botón ▶.** En el centro de operaciones el admin ve un botón ▶ que deja el estado inicial de un día normal para simular: completa el historial de 30 días si falta y vuelve a armar la operación de hoy (rutas con vehículo y las primeras entregas de la mañana hechas), los pendientes y las rutas de mañana. Cada toque vuelve a ese estado. Solo reescribe datos de demostración (destinatarios marcados `demo` y la flota demo): usuarios, vehículos agregados a mano y envíos o rutas reales no se tocan. Los avisos de esos envíos quedan "simulado" (no se manda nada). Las direcciones salen de un catálogo con coordenadas fijas, así que no depende del geocodificador. `DEMO_REINICIO=false` lo apaga. Lo mismo por consola: `go run ./cmd/demo` (pide escribir "si" y muestra a qué base se conecta); `-limpiar` borra todo lo ficticio. Necesita las migraciones 0016 a 0018 aplicadas (la API nueva desplegada).

**Salir a repartir.** Un envío pasa a "en camino" solo cuando se inicia su ruta (botón "Iniciar ruta" en la web o en la app): todos los envíos de la ruta salen a la vez. Ya no se marca envío por envío (el endpoint `PUT /envios/{id}/estado` sigue en la API, pero ni la web ni la app lo ofrecen). Una ruta que ya salió no admite envíos nuevos (409 `ruta_iniciada`).

**Orden de las paradas.** Cada ruta se visita en el orden del recorrido más corto por calles (ida desde el depósito y vuelta), que se recalcula al asignar envíos y al iniciar la ruta. Ver `docs/decisions/orden-de-rutas.md`.

**Entregas simuladas.** El simulador GPS (`SIMULADOR_GPS=true`) solo mueve camiones con la ruta **en curso**: una ruta planificada espera en el depósito hasta que se inicia (botón "Iniciar ruta" en Operaciones o en el detalle de la ruta, o el repartidor desde la app al marcar un envío en camino). Al iniciarla, todos sus envíos pasan a "en camino". Con `SIMULADOR_ENTREGAS=true` (por defecto), en cada domicilio el camión se queda `SIMULADOR_PARADA_SEG` segundos (40 por defecto) y, si el envío es de demostración, lo entrega con receptor, firma y foto o (1 de cada 10) registra una incidencia; si el envío es real, espera en la puerta a que el repartidor lo resuelva desde la app. Al terminar vuelve al depósito y la ruta queda completada. La web se entera al instante de cada cambio (evento SSE `cambio`). Para una presentación de ~30 minutos conviene `SIMULADOR_FACTOR=1.5`. Los camiones de `SIMULADOR_ENTREGA_MANUAL` (por defecto el TRK-318, el naranja, cuya ruta el ▶ deja sin iniciar para la cuenta `repartidor@movii.demo`) no entregan solos: llegan a cada puerta y esperan a que se confirme la entrega (o la incidencia) desde la app; van a `SIMULADOR_VELOCIDAD_MANUAL` km/h (45 por defecto) para no esperar tanto entre paradas.

**Login con Google (T2).**
1. [Google Cloud Console](https://console.cloud.google.com) → crear proyecto → **APIs y servicios → Pantalla de consentimiento OAuth** (tipo Externo, scopes `openid`, `email`, `profile`; mientras esté "en prueba" solo entran los usuarios de prueba cargados).
2. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
3. En **URI de redireccionamiento autorizados** cargar exactamente `GOOGLE_CALLBACK_URL`: `https://<dominio-railway>/api/auth/google/callback` (con la imagen Docker la API va bajo `/api`; en local, `http://localhost:8080/auth/google/callback`).
4. Copiar ID y secreto a `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` en Railway. `PUBLIC_WEB_URL` tiene que ser la URL de la web: ahí vuelve el usuario después de Google.
5. La app Android vuelve con el esquema `movii://` (no hay que cargar nada más en Google). En Expo Go (`exp://`) solo funciona con `ENV` distinto de `production`.

Sin las tres `GOOGLE_*`, `GET /auth/config` responde `{"google": false}` y el botón no aparece. Quien entra por primera vez con Google queda como **operador** (cualquier cuenta de Google puede crearse un usuario: si hace falta limitarlo, ver `ALLOWED_DOMAINS` en el backlog). Un email que ya existe se vincula y conserva su rol; si tenía el primer acceso pendiente, igual se le pide el código.

## Verificación rápida
- `GET https://<api>/health` → `{"status":"ok"}`
- Web: login → **Operaciones** muestra la flota y el mapa "En vivo".
- `/app/` en el celular: login, **Ver ruta en el mapa**, firma de entrega en todo el ancho.
