Trabajo Integrador Sprint 0

Sistema de Gestión de Envíos y Distribución

![](./Trabajo%20Final%20Integrador%20-%20Sprint0%20-%20Araya_Diaz-Aimar_Micheloud_images/image-001.png)

UTN Facultad Regional San Francisco

Grupo N°7

**Docentes**:

-   Gandino, Diego
-   Saldarini, Javier Daniel

**Integrantes**:

-   Araya, Ulises
-   Diaz Aimar, Felipe
-   Micheloud, Jeremías

**Índice**

Contenido

1\. Propósito del Sistema 3

1.1 Descripción general 3

1.2 Necesidad detectada 3

1.3 Problema que resuelve 3

2\. Usuarios Objetivo 4

3\. Valor de Negocio Esperado 5

3.1 Eficiencia operativa 5

3.2 Calidad de servicio 5

3.3 Toma de decisiones 5

4\. Alcance Inicial 6

4.1 Dentro del alcance 6

4.2 Fuera del alcance (versión inicial) 8

5\. Herramientas de Gestión del Proyecto 9

6\. Arquitectura y Tecnologías 11

6.1 Decisión de arquitectura 11

6.2 Stack tecnológico 12

7\. Implementación del Ambiente de Trabajo 14

7.1 Estado del ambiente 14

7.2 Instructivo de Instalación 15

8\. Prototipo de Interfaz de Usuario 17

8.1 Módulo Administrador / Operador logístico 17

8.2 Módulo Repartidor (App Móvil) 18

8.3 Módulo de Tracking (Cliente Final) 18

8.4 Decisiones de diseño del prototipo 19

9\. Criterios de Calidad (DoD + Estrategia QA) 20

9.1 Definition of Done (DoD) 20

9.2 Estrategia de QA 21

10\. Product Backlog 22

10.1 Escalas de estimación 22

10.2 Backlog priorizado 22

# 1\. Propósito del Sistema

## 1.1 Descripción general

El Sistema de Gestión de Envíos y Distribución es una plataforma web y móvil diseñada para optimizar el proceso logístico de empresas de reparto. La solución centraliza el ciclo de vida completo de un envío: desde su registro y asignación hasta su entrega final, pasando por el seguimiento en tiempo real y la generación de reportes de desempeño.

## 1.2 Necesidad detectada

Las empresas logísticas de mediana escala enfrentan dificultades recurrentes para coordinar sus operaciones diarias: la asignación manual de paquetes a repartidores, la falta de visibilidad sobre el estado de los envíos y la imposibilidad de informar al cliente en tiempo real. Estas ineficiencias generan costos operativos elevados, incidencias sin trazabilidad y baja satisfacción del cliente.

## 1.3 Problema que resuelve

El sistema aborda tres problemas centrales:

-   **Desorganización operativa:** elimina la coordinación por canales informales reemplazándola por una plataforma unificada de asignación de rutas y repartidores.
-   **Falta de trazabilidad:** ofrece seguimiento en tiempo real del estado de cada envío, tanto para el equipo interno como para el cliente final.
-   **Gestión de incidencias sin respaldo:** registra el motivo de entregas fallidas y habilita la reprogramación, con evidencia auditable de cada evento.

# 2\. Usuarios Objetivo

El sistema contempla cuatro perfiles de usuario con roles y necesidades diferenciadas:

| Perfil | Acceso | Responsabilidades principales  
 |
| --- | --- | --- |
| Operador logístico | App móvil / Web (Mobile-first) | Registrar envíos, asignar rutas y repartidores, gestionar incidencias |
| Repartidor | App móvil | Consultar envíos del día, actualizar estado de entregas, registrar motivos de fallo |
| Supervisor / Administrador | App móvil / Web (Mobile-first) | Monitorear el estado global de operaciones, generar reportes, administrar usuarios |
| Cliente final | Portal web / link de tracking | Consultar el estado de su envío mediante un código de seguimiento |

# 3\. Valor de Negocio Esperado

## 3.1 Eficiencia operativa

-   Reducción del tiempo dedicado a la coordinación manual de rutas mediante la asignación digital y organización por zonas.
-   Disminución de llamadas de seguimiento al equipo interno gracias al portal de consulta para clientes.
-   Centralización del registro de incidencias, eliminando el seguimiento por canales informales.

## 3.2 Calidad de servicio

-   Mejora en la tasa de entregas en primer intento mediante la visibilidad de historial de incidencias por dirección.
-   Reducción del tiempo de resolución de reclamos al contar con evidencia digital de cada entrega (confirmación y firma digital).
-   Mayor satisfacción del cliente final mediante tracking en tiempo real con historial de eventos.

## 3.3 Toma de decisiones

-   Disponibilidad de métricas de desempeño por repartidor, ruta y zona geográfica.
-   Identificación temprana de ineficiencias mediante reportes de tiempos de entrega e incidencias clasificadas por motivo.
-   Base de datos histórica de operaciones para análisis y mejora continua del servicio.

# 4\. Alcance Inicial

## 4.1 Dentro del alcance

**Gestión de envíos**

-   Registro de envíos con datos del remitente, destinatario, dirección de entrega y características del paquete (peso, tamaño, tipo de contenido, indicadores de urgencia o fragilidad).
-   Asignación de envíos a rutas de reparto y a repartidores específicos.
-   Organización de rutas diarias agrupadas por zona geográfica con visualización de paradas y progreso.

**Operación móvil del repartidor**

-   Listado de envíos asignados para el día con nombre del destinatario, dirección, número de guía y peso.
-   Visualización de la ruta en mapa con numeración de paradas y posición actual del repartidor.
-   Actualización del estado de cada envío: pendiente, en camino, entregado, no entregado.
-   Registro de incidencia con selección de motivo (cliente ausente, dirección incorrecta, rechazado por destinatario, zona insegura, otro), comentarios adicionales y evidencia fotográfica.
-   Reprogramación de entregas fallidas con selección de nueva fecha y franja horaria, y notificación al cliente por email o WhatsApp.

**Confirmación de entrega**

-   Registro del nombre y relación del receptor (destinatario, familiar, vecino, encargado).
-   Captura de firma digital del receptor dentro del dispositivo móvil.
-   Captura de fotografía del paquete entregado como evidencia adicional.

**Seguimiento en tiempo real**

-   Panel de operaciones con métricas del día: tiempo promedio de entrega, envíos totales, tasa de éxito e incidencias.
-   Listado de envíos en vivo con estado actualizado: entregado, en camino, pendiente, no entregado.
-   Portal de consulta para el cliente final mediante código de guía con historial completo de eventos del envío.

**Reportes**

-   Gráfico de envíos por período con tendencia diaria.
-   Clasificación de incidencias por motivo con distribución porcentual.
-   Ranking de desempeño de repartidores: cantidad de entregas, calificación y tasa de éxito.
-   KPIs exportables: total de envíos, tiempo promedio de entrega e incidencias en el período seleccionado.

## 4.2 Fuera del alcance (versión inicial)

| Funcionalidad excluida | Justificación  
 |
| --- | --- |
| Optimización automática de rutas (algoritmos) | Requiere integración con servicios de mapas externos; se evaluará en sprint posterior |
| Integración con sistemas ERP externos | Depende de APIs de terceros no definidas aún |
| Módulo de facturación y pagos | Fuera del alcance logístico del sistema |
| Gestión de inventario de almacén | Es un dominio separado no contemplado en el enunciado |
| Soporte multiempresa (multi-tenant) | Arquitectura a considerar en escalabilidad futura |

# 5\. Herramientas de Gestión del Proyecto

| Categoría | Herramienta | Uso en el proyecto  
 |
| --- | --- | --- |
| Gestión de tareas | Jira | Backlog del producto, sprints, tablero Kanban y seguimiento de velocidad del equipo |
| Control de versiones | GitHub | Repositorio del código fuente, pull requests, revisión de código y gestión de ramas por feature |
| Comunicación | Discord / WhatsApp | Canal de comunicación interna para coordinación diaria y reuniones de seguimiento |
| Documentación técnica | Confluence / Notion | Documentación de arquitectura, instructivos de instalación y especificaciones técnicas |
| Diseño de interfaces | Figma | Prototipado de interfaces de usuario y flujos de navegación del sistema |
| Videoconferencias | Google Meet | Sprint planning, daily standups y retrospectivas |
| Almacenamiento | Google Drive | Repositorio compartido de documentos, actas y entregables académicos |

# 6\. Arquitectura y Tecnologías

## 6.1 Decisión de arquitectura

Se adopta una arquitectura de tres capas con separación clara entre frontend, backend y base de datos. El backend expone una única API REST, consumida tanto por el frontend web como por la aplicación móvil del repartidor. Esta decisión facilita el desarrollo paralelo de las distintas interfaces y permite escalar cada capa de forma independiente.

El sistema tiene **dos interfaces cliente** sobre **una misma API y una única base de datos Supabase**:

- **Aplicación web** — panel del operador logístico y del supervisor (registro de envíos, gestión de rutas, asignación, monitoreo y reportes) más el portal público de tracking del cliente final. Todavía no se implementó (queda para un sprint posterior); consumirá la misma API ya construida.
- **Aplicación móvil nativa** — vista del repartidor (envíos del día, ruta, actualización de estados, confirmación de entrega, incidencias). Ya implementada y reconectada a la API real (ver documento *Sprint 1*, sección Implementación).

*Nota: durante el Sprint 1 se decidió una sola API en Go para ambas interfaces (en vez de un backend Node/Express separado para la web), para no duplicar la lógica de negocio entre dos servidores. El stack de abajo refleja esa decisión, ya en funcionamiento.*

## 6.2 Stack tecnológico

| Capa | Tecnología | Justificación  
 |
| --- | --- | --- |
| Frontend Web | React.js + Tailwind CSS | Componentes reutilizables, gran ecosistema y curva de aprendizaje manejable para el equipo. Pendiente de implementación. |
| App Móvil | React Native + Expo | Código base compartido con el frontend web a nivel de lenguaje (TypeScript); genera versiones Android e iOS desde un mismo proyecto. **Implementado.** |
| Backend / API | Go (chi + pgx) | Tipado fuerte y rendimiento nativo para una API que sirve tanto a la web como al móvil; sin ORM, acceso a datos con SQL explícito vía pgx para mantener control total sobre las queries. **Implementado** (HU-01 a HU-05 completas). |
| Base de datos | Supabase (PostgreSQL gestionado) | Base de datos relacional PostgreSQL provista como servicio, ideal para el modelo de envíos, rutas y repartidores con relaciones claras. Se usa únicamente como Postgres (no se usa la Auth ni la API REST propias de Supabase). **En uso**, con las 5 tablas del modelo migradas y datos de demo cargados. |
| Autenticación | JWT (JSON Web Tokens) propio | Estándar ampliamente adoptado para autenticación stateless en APIs REST; emitido y validado por la propia API (HS256), no por un proveedor externo. **Implementado.** |
| Hosting / Despliegue | Supabase (base de datos) + Vercel (frontend web, a futuro) + Render/Railway (API) | Despliegue rápido y gratuito para entornos de desarrollo y prueba académica. **Pendiente** — hoy la API corre localmente y se prueba en el teléfono por la red local. |
| Documentación API | Swagger / OpenAPI | Generación automática de documentación interactiva de los endpoints del sistema. **Pendiente.** |

# 7\. Implementación del Ambiente de Trabajo

## 7.1 Estado del ambiente

El ambiente de desarrollo está instalado, configurado y funcionando: la API corre localmente contra una base Supabase real (no local ni en Docker), y la app móvil se probó en dispositivos físicos (Android e iPhone) conectados a la API por la red local. No se usa Docker en este proyecto — la base de datos es un servicio gestionado (Supabase), no hace falta contenedores para levantarla.

## 7.2 Instructivo de Instalación

A continuación, se describen los pasos necesarios para replicar el ambiente de desarrollo del proyecto en cualquier otro equipo.

#### Prerrequisitos

-   Go 1.22 o superior (API)
-   Node.js v20 LTS + pnpm 9 (app móvil)
-   Cuenta de Supabase (proyecto propio o compartido por el equipo)
-   Git v2.40 o superior
-   Visual Studio Code con extensiones: Go, ESLint, Prettier, GitLens
-   Expo Go instalado en el teléfono (para probar la app móvil)

```
// Clonar el repositorio
git clone https://github.com/FelipeDiazAimar/Movii.git
cd Movii

// Configuración de la API (Go)
cd gestion-envios/services/api
cp .env.example .env
// Completar en .env: DATABASE_URL (connection string de Supabase), JWT_SECRET, PORT, CORS_ORIGINS
go run ./cmd/migrate up   // aplica el esquema de las 5 tablas + datos de demo
go run ./cmd/api          // levanta la API en :8080

// Configuración de la app móvil (Expo)
cd ../../apps/mobile
pnpm install
cp .env.example .env
// Completar EXPO_PUBLIC_API_URL con la IP de red local de la PC que corre la API
npx expo start --port 8081
// Escanear el QR con la cámara del teléfono (Expo Go) para abrir la app
```

Variables de entorno requeridas en `gestion-envios/services/api/.env`:

```
DATABASE_URL=postgresql://postgres:[password]@[host].supabase.co:5432/postgres
JWT_SECRET=clave_secreta_larga_y_aleatoria
PORT=8080
CORS_ORIGINS=http://localhost:5173
```

# 8\. Prototipo de Interfaz de Usuario

Se desarrolló un mockup estático con todas las vistas del sistema, organizado en tres módulos según el perfil de usuario: Administrador/Operador logístico, Repartidor y Cliente final (tracking). Cada módulo fue diseñado como una simulación de app móvil con navegación real entre pantallas, con un enfoque mobile-first integral que permite la gestión operativa desde cualquier lugar.

## 8.1 Módulo Administrador / Operador logístico

Accesible desde la pestaña Admin del prototipo. Cuenta con cinco sub-vistas navegables mediante pestañas internas:

-   **Panel principal (Inicio):** Dashboard operativo con saludo personalizado y cuatro tarjetas de métricas en tiempo real. Sección Seguimiento en vivo con actualizaciones de envíos.
-   **Registrar envío (Nuevo):** Formulario de remitente, destinatario y paquete.
-   **Asignar envío (Asignar):** Pantalla de asignación que muestra rutas compatibles y estado de los repartidores.
-   **Rutas del día (Rutas):** Vista de gestión de rutas activas con mapa estilizado y progreso.
-   **Reportes:** Panel de análisis con KPIs, gráfico de envíos, distribución de incidencias y ranking de repartidores.

## 8.2 Módulo Repartidor (App Móvil)

Accesible desde la pestaña Repartidor del prototipo. Diseñado íntegramente para uso móvil.

*Actualización Sprint 1: la vista "Mi ruta" de este módulo dejó de ser una maqueta — está implementada y conectada a la API real (login y listado de envíos del día reales, ver documento Sprint 1). El resto de las pantallas de este módulo (confirmar entrega, incidencia, reprogramar) siguen como maqueta; corresponden a HU de Sprint 2.*

-   **Mi ruta:** Vista principal con mapa, progreso del día y lista de próximas entregas.
-   **Reportar incidencia:** Selección de motivo de no entrega y captura de evidencia fotográfica.
-   **Confirmar entrega:** DNI, pad de firma digital y foto del paquete.
-   **Reprogramar entrega:** Selección de nueva fecha/hora y configuración de notificaciones al cliente.

## 8.3 Módulo de Tracking (Cliente Final)

Accesible desde la pestaña Tracking. Es la vista pública del sistema para consulta sin inicio de sesión, con historial en línea de tiempo.

## 8.4 Decisiones de diseño del prototipo

| Decisión | Justificación  
 |
| --- | --- |
| Diseño mobile-first (390×844 px, simulando iPhone) | Todos los perfiles, incluyendo operadores y administradores, requieren movilidad. Se priorizó el diseño para pantallas móviles garantizando una gestión operativa ágil y remota desde cualquier dispositivo. |
| Colores semánticos por estado | Verde: entregado, Azul: en camino, Amarillo: pendiente, Rojo: no entregado. Lectura inmediata sin necesitar leer el texto. |
| Máximo 3 acciones por tarjeta de envío | Reduce el tiempo de operación; los flujos críticos no superan 3 pasos. |
| Indicadores de tendencia en métricas | Permite al operador detectar de un vistazo si un KPI mejoró o empeoró. |
| Firma digital + foto como doble evidencia | Cubre escenarios donde la firma no es posible y aporta evidencia visual. |
| Reprogramación con notificación integrada | Cierra el flujo de incidencia en una sola pantalla. |
| Animación de pulso en estado activo | Diferencia visualmente el estado En camino del resto. |

# 9\. Criterios de Calidad (DoD + Estrategia QA)

## 9.1 Definition of Done (DoD)

Una historia de usuario o tarea se considera terminada cuando cumple la totalidad de los siguientes criterios:

1.  El código fue revisado por al menos un compañero de equipo mediante pull request en GitHub.
2.  El código sigue los lineamientos de estilo definidos (`gofmt` + `go vet` en la API; ESLint + Prettier en la app móvil).
3.  La funcionalidad fue probada manualmente sobre el ambiente de desarrollo con casos positivos y negativos.
4.  Se escribieron pruebas unitarias para la lógica de negocio del backend (cobertura mínima del 70%).
5.  La funcionalidad fue integrada en la rama develop sin conflictos y el pipeline de CI pasa sin errores.
6.  La documentación de la API fue actualizada en Swagger si el cambio afecta algún endpoint.
7.  La historia fue demostrada y aprobada por el equipo en la revisión de sprint antes de cerrarla.
8.  No hay bugs conocidos de severidad alta o crítica pendientes de resolución en la funcionalidad entregada.

## 9.2 Estrategia de QA

-   **Pruebas unitarias:** validación de la lógica de negocio en el backend. Framework: `testing` + `testify` (Go). En la app móvil, `vitest` para las funciones puras (adaptadores de datos, decodificación de JWT).
-   **Pruebas de integración:** verificación de los endpoints de la API REST contra la base Supabase real (no se usan mocks de base de datos). Herramienta: `net/http/httptest` (Go).
-   **Pruebas funcionales (end-to-end):** un test por cada bloque de HU que ejercita el flujo completo por HTTP (login → operación → verificación) contra el router real de la API.
-   **Pruebas exploratorias:** sesiones manuales del equipo sobre las funciones críticas antes de cada entrega de sprint (verificado además con la app corriendo en un teléfono físico).

**Gestión de defectos**

-   Todo bug encontrado se registra como issue en GitHub con etiqueta 'bug' y severidad.
-   Los bugs de severidad alta o crítica bloquean el cierre del sprint.
-   Los bugs de severidad media o baja se priorizan en el backlog.

**Herramientas de calidad de código**

-   ESLint: análisis estático del código JavaScript.
-   Prettier: formateo automático del código.
-   GitHub Actions: pipeline de CI que ejecuta lint y tests.

# 10. Product Backlog

El Product Backlog completo del sistema se compone de 15 Historias de Usuario, priorizadas por valor de negocio y esfuerzo y distribuidas en tres sprints. Las fichas detalladas de cada HU (formato *Yo como… / Deseo… / Para…*, criterios de aceptación y propiedades) se encuentran en el documento **Sprint Backlog 1**.

## 10.1 Escalas de estimación

**Valor de negocio:** 1 (soporte) · 2 (útil, no esencial) · 3 (valor operativo claro) · 5 (habilita funcionalidad central) · 8 (imprescindible: sin esto el sistema no opera).

**Esfuerzo — Story Points (Fibonacci):** 1 (trivial) · 2 (directo) · 3 (moderado) · 5 (significativo) · 8 (complejo) · 13 (muy complejo).

## 10.2 Backlog priorizado

| ID    | Historia de Usuario                          | Prioridad | Valor | SP | Sprint   |
| ----- | ------------------------------------------- | --------- | :---: | :-: | -------- |
| HU-01 | Registro y autenticación de usuarios        | Muy Alta  |   8   |  8 | Sprint 1 |
| HU-02 | Registro de envíos                          | Muy Alta  |   8   |  5 | Sprint 1 |
| HU-03 | Gestión de rutas diarias                    | Alta      |   5   |  5 | Sprint 1 |
| HU-04 | Asignación de envíos a ruta y repartidor    | Alta      |   5   |  5 | Sprint 1 |
| HU-05 | Listado de envíos del día para repartidor   | Alta      |   5   |  3 | Sprint 1 |
| HU-06 | Actualización de estado de entrega          | Alta      |   8   |  5 | Sprint 2 |
| HU-07 | Registro de entrega fallida con motivo      | Alta      |   5   |  5 | Sprint 2 |
| HU-08 | Confirmación de entrega con firma y foto    | Alta      |   5   |  8 | Sprint 2 |
| HU-09 | Reprogramación de entregas fallidas         | Media     |   5   |  5 | Sprint 2 |
| HU-10 | Tracking público por código de guía        | Media     |   5   |  3 | Sprint 2 |
| HU-11 | Panel de operaciones en tiempo real         | Media     |   3   |  5 | Sprint 3 |
| HU-12 | Visualización de ruta en mapa (repartidor)  | Media     |   3   |  5 | Sprint 3 |
| HU-13 | Reportes de envíos por período             | Baja      |   2   |  3 | Sprint 3 |
| HU-14 | Ranking de desempeño de repartidores        | Baja      |   2   |  3 | Sprint 3 |
| HU-15 | Clasificación de incidencias por motivo     | Baja      |   2   |  3 | Sprint 3 |

**Total Sprint 1:** valor 31 · 26 SP. La priorización sigue la relación valor/esfuerzo, resolviendo primero las HU que habilitan el flujo operativo mínimo (alta → registro → asignación → reparto).