# Movii — Plan de diseño móvil

## Propósito y principio de experiencia

Movii es una aplicación de operación de última milla orientada principalmente al repartidor, con un acceso público y directo para que el cliente siga su envío. La interfaz se diseña exclusivamente en orientación vertical 9:16 y prioriza el uso con una mano: las acciones críticas aparecen en la zona inferior, los objetivos táctiles miden al menos 44 px y la información se organiza en bloques escaneables.

El producto debe sentirse nativo de iOS: jerarquía tipográfica clara, navegación por pila, barras inferiores translúcidas, feedback de presión sutil y superficies livianas. El prototipo no requiere autenticación real ni red; el selector de rol solo dirige al flujo correspondiente y los cambios de estado se conservan durante la sesión.

## Pantallas

| Pantalla | Contenido principal | Acciones y navegación |
|---|---|---|
| Inicio de sesión | Marca Movii, selector Operador/Repartidor, correo y contraseña de muestra | Entrar como repartidor, abrir tracking público |
| Mi ruta de hoy | Resumen de paradas, porcentaje completado y lista ordenada de entregas | Abrir detalle de parada, abrir mapa de ruta simulado |
| Mapa de ruta | Placeholder cartográfico, progreso, próximas paradas y leyenda | Volver a la ruta o seleccionar una parada |
| Detalle de parada | Código de guía, destinatario, dirección, ventana horaria, paquete y timeline | Marcar en camino, entregar, registrar fallida, reprogramar |
| Confirmar entrega | Lienzo de firma, evidencia de foto simulada y nombre de receptor | Confirmar la entrega y actualizar el envío |
| Entrega fallida | Motivos seleccionables, nota y evidencia opcional simulada | Guardar incidencia y devolver al detalle |
| Reprogramar | Selector de fecha y franja horaria | Guardar nueva visita y actualizar la parada |
| Historial | Filtros por estado y listado de envíos resueltos | Revisar detalle de envío histórico |
| Perfil | Datos del repartidor, métricas de jornada, opciones de apariencia y sesión | Alternar apariencia y cerrar sesión |
| Seguir mi envío | Campo para código de guía y accesos de ejemplo | Consultar MOV-2026-000777 o buscar un código |
| Estado del envío | Timeline, ETA, dirección de destino y mapa placeholder | Volver o consultar otro envío |
| Sistema de diseño | Paleta, escala tipográfica, chips, botones, tarjetas y estados | Referencia visual para la cátedra |

## Flujos de usuario prioritarios

| Flujo | Secuencia |
|---|---|
| Inicio del repartidor | Inicio de sesión → seleccionar Repartidor → Mi ruta de hoy → detalle de parada |
| Entrega exitosa | Mi ruta → detalle → Entregado → Confirmar entrega → firmar, elegir evidencia y receptor → Confirmar → detalle actualizado |
| Entrega no realizada | Mi ruta → detalle → No entregado → elegir motivo y nota → Guardar → detalle actualizado |
| Nueva visita | Mi ruta → detalle → Reprogramar → elegir fecha/franja → Guardar → detalle actualizado |
| Seguimiento de cliente | Inicio de sesión o acceso público → Seguir mi envío → ingresar MOV-2026-000777 → Estado del envío |

## Dirección visual

La identidad usa blanco `#FFFFFF`, fondos `#F7F7F8` y `#EFEFF2`, texto principal `#1C1C1E` y gris secundario `#6E6E73`. El amarillo Movii `#FFD60A` destaca controles activos, CTA y puntos de progreso; se reserva el amarillo suave `#FFF4CC` para fondos auxiliares. Los estados semánticos mantienen verde `#34C759`, naranja `#FF9F0A`, rojo `#FF3B30` y gris `#8E8E93`. El modo oscuro conserva superficies `rgba(255,255,255,0.06)` sobre `#0A0A0C`.

Las tarjetas, formularios y la barra de pestañas emplean una apariencia de cristal: blanco translúcido, bordes blancos discretos, sombras amplias y radio de 20 px. Un fondo aurora animado y liviano combina amarillo pálido, lila y celeste en dos cintas ondulantes de movimiento lento; evita WebGL para preservar compatibilidad con Expo. Se utilizan `SF Pro` y el fallback del sistema; los títulos usan peso 600 y las etiquetas y cuerpo usan pesos 400–500.

## Estructura técnica prevista

El proyecto utiliza Expo Router y TypeScript. Los datos del dominio vivirán en `mock/` y los modelos compartidos en `types/`. Un contexto local coordinará el estado de sesión del prototipo y las actualizaciones de los envíos; no se incorporará backend. Las pantallas de repartidor estarán agrupadas detrás de tabs inferiores: Ruta, Historial, Perfil y Diseño. Los flujos de detalle, entrega, falla, reprogramación y tracking funcionarán como rutas de pila independientes.

## Accesibilidad e interacción

Los inputs tendrán label visible, los controles expondrán etiquetas de accesibilidad y los colores de estado siempre estarán acompañados por texto o icono. Los botones críticos se ubican al alcance del pulgar y emplean respuesta de presión y háptica leve cuando la plataforma lo permita. Las listas serán `FlatList` y cada vista respetará las áreas seguras, teclado y desplazamiento nativo.
