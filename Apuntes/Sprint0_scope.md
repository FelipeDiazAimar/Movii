# Sprint 0 - Analisis de alcance y base del proyecto

## 1. Contexto general

El proyecto corresponde al **Sistema de Gestion de Envios y Distribucion**, elegido a partir del caso dado por el profesor para desarrollar una aplicacion que permita gestionar el proceso de distribucion de paquetes de una empresa logistica.

El alcance inicial se centra en cubrir el ciclo basico de un envio: registro, asignacion a ruta y repartidor, seguimiento del estado, gestion de entregas fallidas, reprogramacion, confirmacion de entrega y consulta del envio por parte del cliente final.

## 2. Problema que resuelve

El caso del profesor plantea necesidades concretas que el sistema debe resolver:

- Registrar envios con datos del remitente, destinatario, direccion de entrega y caracteristicas del paquete.
- Asignar cada envio a una ruta de reparto y a un repartidor.
- Permitir a los repartidores consultar sus envios y actualizar el estado de entrega.
- Registrar entregas fallidas y permitir reprogramarlas.
- Hacer seguimiento en tiempo real para uso interno y para consulta de clientes.
- Registrar la confirmacion al momento de la entrega.
- Generar reportes sobre tiempos de entrega, cantidad de envios, incidencias y desempeno.

## 3. Usuarios objetivo

El caso permite identificar tres perfiles principales:

- **Operador logistico**: registra envios, asigna rutas y repartidores.
- **Repartidor**: consulta los envios asignados, visualiza la ruta y actualiza estados.
- **Cliente final**: consulta el estado de su envio mediante un codigo de seguimiento.

## 4. Alcance funcional

### 4.1 Dentro del alcance

- Registro de envios con datos del remitente, destinatario, direccion de entrega y caracteristicas del paquete.
- Asignacion de cada envio a una ruta de reparto y a un repartidor.
- Organizacion de rutas diarias considerando las zonas de entrega.
- Acceso movil del repartidor al listado de envios asignados.
- Visualizacion de la ruta de reparto.
- Actualizacion del estado de cada entrega: pendiente, en camino, entregado, no entregado.
- Registro del motivo de una entrega fallida.
- Reprogramacion de una entrega no completada.
- Seguimiento en tiempo real del estado de los envios.
- Consulta publica del estado de un envio mediante codigo de seguimiento.
- Registro de confirmacion de entrega.
- Captura de firma digital como evidencia de entrega.
- Captura de fotografia como evidencia de entrega.
- Paneles administrativos avanzados para monitoreo y gestion interna.
- Generacion de reportes sobre tiempos de entrega, cantidad de envios realizados, incidencias y desempeno de los repartidores.

### 4.2 Fuera del alcance inicial

- Optimizacion automatica de rutas por algoritmos.
- Integracion con sistemas ERP externos.
- Modulo de facturacion y pagos.
- Gestion de inventario de almacen.
- Soporte multiempresa (multi-tenant).
- Notificaciones por email o WhatsApp.
- Integracion con sistemas externos no definidos por el caso.

## 5. Valor de negocio esperado

- Reduccion del tiempo de coordinacion manual.
- Menos llamadas de seguimiento gracias al tracking.
- Mejor control de entregas y entregas fallidas.
- Menor tiempo de resolucion de reclamos.
- Mayor satisfaccion del cliente por visibilidad en tiempo real.
- Mejor toma de decisiones con metricas historicas y reportes.

## 6. Arquitectura y tecnologias

### 6.1 Decision de arquitectura

El apunte propone una arquitectura de tres capas:

- Frontend
- Backend / API
- Base de datos

Esa separacion permite desarrollo paralelo entre interfaces y escalado independiente de cada capa.

### 6.2 Stack sugerido para este proyecto

En el documento original aparecen React.js + Tailwind, Node.js + Express, PostgreSQL y Prisma. Sin embargo, por lo que comentaste, la direccion real del proyecto quedaria asi:

- **App movil**: React Native
- **Frontend web**: TypeScript
- **Backend**: Go (Golang)
- **Base de datos / Backend gestionado**: Supabase

### 6.3 Observacion tecnica importante

Supabase debe entenderse como el soporte de persistencia y servicios gestionados del proyecto, no solo como base de datos. Incluye PostgreSQL administrado y puede cubrir autenticacion y almacenamiento si el equipo lo necesita.

Para mantener orden arquitectonico, la opcion mas consistente es usar Go como backend central y Supabase como soporte de datos y servicios.

## 7. Modulos del sistema

### 7.1 Modulo operativo interno

- Alta de envios.
- Asignacion de rutas y repartidores.
- Organizacion de rutas del dia.
- Consulta del estado de la operacion.
- Reportes basicos.

### 7.2 Modulo repartidor

- Mi ruta diaria.
- Cambio de estado de entrega.
- Registro de entrega fallida.
- Reprogramacion.
- Confirmacion de entrega.

### 7.3 Modulo tracking cliente

- Consulta publica por codigo de guia.
- Historial de estado del envio.

## 8. Criterios de calidad

El Sprint 0 ya deja definidos criterios de calidad que conviene conservar desde el inicio:

- Code review por pull request.
- Pruebas manuales de flujos principales.
- Pruebas unitarias para logica de negocio.
- Integracion continua.
- Documentacion de API actualizada si corresponde.
- Sin bugs severos abiertos al cerrar una historia.

## 9. Decisiones y supuestos para avanzar

Para poder arrancar la estructura del proyecto sin frenar, tomo estos supuestos:

- El producto se va a construir como un repositorio unificado.
- La aplicacion movil sera la pieza principal de uso operativo.
- El frontend web quedara para el tracking y, si hace falta, una vista administrativa basica.
- Go sera el backend principal con API REST.
- Supabase sera el soporte de datos y servicios gestionados.

## 10. Propuesta de alcance inicial de implementacion

Si arrancamos el proyecto en forma incremental, el primer MVP deberia incluir:

- Registro de envios.
- Asignacion de repartidor y ruta.
- Vista de entregas del dia para repartidor.
- Cambio de estados de entrega.
- Registro de entrega fallida.
- Reprogramacion basica.
- Tracking publico por codigo de guia.
- Confirmacion de entrega.
- Persistencia en Supabase.

## 11. Pendientes para definir antes de crear carpetas

Hay algunos puntos que conviene cerrar antes de scaffolding:

- Si la autenticacion se manejara con Supabase Auth o con una implementacion propia en Go.
- Si el frontend web sera solo tracking o tambien incluira un panel operativo minimo.
- Si se usara Expo en React Native o React Native bare workflow.
- Si la aplicacion movil y el frontend web compartiran tipos, contratos y componentes.
- Si las evidencias de entrega quedaran fuera del alcance del sprint inicial.

## 12. Conclusion

Con el caso elegido, el proyecto queda bien delimitado para un sistema logistico con foco en operacion, trazabilidad y seguimiento en tiempo real. La base funcional ya esta clara y el siguiente paso razonable es definir la estructura inicial del repositorio, los paquetes principales y la estrategia de integracion entre React Native, TypeScript, Go y Supabase.

Cuando quieras, pasamos a crear la estructura de carpetas inicial.
