# Guía de navegación del prototipo Movii

## Propósito

Este documento describe el prototipo móvil navegable de Movii. La experiencia usa datos locales y conserva los cambios durante la sesión: marcar una entrega como completada, registrar una incidencia o reprogramar una visita modifica los datos que aparecen en el detalle, ruta e historial.

## Pantallas operativas

| Pantalla | Acceso | Contenido y comportamiento |
|---|---|---|
| Inicio de sesión | Apertura de la aplicación | Selector de perfil demostrativo, datos de acceso precompletados y vínculo al tracking público. |
| Mi ruta de hoy | Tab «Ruta» | Muestra la Ruta Norte 02, el progreso de la jornada y las paradas ordenadas. Cada tarjeta abre un detalle. |
| Ruta en mapa | Botón «Ver ruta en el mapa» | Placeholder cartográfico con el orden de cinco paradas y enlaces a cada una. |
| Detalle de parada | Selección de una parada | Incluye destinatario, dirección, ventana horaria, paquete, timeline, mapa visual y acciones de operación. |
| Confirmar entrega | Botón «Entregado» | Solicita firma digital dibujada y/o evidencia de foto simulada, además del nombre de quien recibe. |
| Registrar incidencia | Botón «No entregado» | Permite indicar el motivo, agregar una nota y adjuntar evidencia simulada. |
| Reprogramar visita | Enlace del detalle | Ofrece tres fechas y tres franjas horarias en un selector táctil. |
| Historial | Tab «Historial» | Lista filtrable de entregas resueltas y fallidas. |
| Perfil | Tab «Perfil» | Presenta identidad, métricas de jornada, accesos útiles y cierre de sesión. |
| Sistema de diseño | Tab «Sistema» | Reúne paleta, escala tipográfica, botones y badges semánticos. |

## Flujo de entrega exitosa

> **Ruta → Parada → Entregado → Firma o evidencia → Confirmar entrega → Detalle actualizado.**

La pantalla de confirmación deja el botón deshabilitado hasta que la persona registre al menos una firma o una evidencia simulada. Al confirmar, el estado de la parada cambia a **Entregado**, se actualiza el último evento del timeline y se muestra la persona receptora en el detalle.

## Flujo de incidencia y reprogramación

| Acción | Resultado dentro del prototipo |
|---|---|
| No entregado | Guarda un motivo, una nota opcional y una evidencia simulada. La parada queda con badge rojo. |
| Reprogramar | Selecciona una nueva fecha y franja. La parada vuelve a estado pendiente y refleja la próxima visita. |
| Marcar en camino | Cambia el estado de pendiente a en camino y activa el hito correspondiente del timeline. |

## Tracking público

El acceso público se abre desde «Seguir mi envío» en la pantalla de inicio o desde Perfil. El usuario ingresa un código de guía para ver el estado, destino, mapa placeholder y timeline. El código de demostración **`MOV-2026-000777`** representa un paquete en camino a Martínez, con el recorrido listo para presentar.

## Diseño y accesibilidad

La interfaz utiliza superficies de cristal, aurora suave, amarillo Movii como acento y espacios amplios. Las acciones importantes se ubican en la mitad inferior de cada pantalla, los formularios muestran labels persistentes y los controles tienen dimensiones adecuadas para interacción táctil. Los estados siempre se comunican con color y texto, para no depender exclusivamente de la tonalidad visual.
