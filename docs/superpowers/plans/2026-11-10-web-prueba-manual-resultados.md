# Resultados prueba manual web (10/11/2026)

Ambiente: local (API :8080 + web :5173, main fb3a164) contra Supabase compartido. Ventana 1366x~700.

## Casos
- A1 OK redirige a /login. A2 OK (mensaje "email o contraseña incorrectos", en minuscula). A3 OK admin entra sin codigo (no tiene celular).
- F1 parcial: KPIs/flota cargan; hoy no hay rutas -> todo en 0. Indicador "En vivo" visible.
- C1 listado carga (25 envios), tabs con contadores.

## Hallazgos
- H1 [MAYOR/seguridad] LoginPage.tsx:34-35 trae precargados email y clave del ADMIN demo (useState("supervisor@movii.demo") / "Movii2026!"). Va en el bundle de produccion.
- H2 [MENOR/usabilidad] En Operaciones, la rueda del mouse sobre el mapa hace zoom del mapa en vez de scrollear la pagina: al bajar por la pagina el mapa termina mostrando toda Sudamerica.
- H3 [COSMETICO] Sidebar con ventana baja (~700px): aparece una barra de scroll nativa blanca sobre el fondo oscuro.
- H4 [MENOR/datos] La base compartida (produccion) tiene basura de tests: envios "Dest Estado", "Dest Estado H", "E2E", "Cliente Historial Lleno", codigos fuera de formato (MOV-62110500, MOV-72972400), rutas "Ruta Estado Test/Handler".
- H5 [COSMETICO] Operaciones: "Temperatura de carga 21 C" parece dato fijo/inventado; con 0 rutas dice 3 vehiculos "En servicio".
- H6 [COSMETICO] console.error en login fallido ("[login] paso 1 fallo...") — ruido en consola para un 401 esperado.

## Datos QA-1110 creados
(ninguno aun)

## Avance 2
- C1 OK (buscador, tabs, vacio, calendario). C2 OK validaciones (obligatorios, peso<=0). C3 OK alta por UI -> MOV-20261110-0001, geocodifico bien. C5 OK detalle + mapa + historial.
- Fix 354e6d5: tamano invalido -> 400 OK (mensaje generico "faltan datos obligatorios del envio").
- E1 OK listado. E2 OK: capacidad 0 rechazada, patente duplicada rechazada, patente normalizada (qa 111 zz -> QA111ZZ).
- H7 [MENOR/usabilidad] Alta de envio: tras registrar, el cartel de exito (codigo de guia, copiar, ver detalle) aparece ARRIBA pero la pagina queda scrolleada abajo con el form vacio: no se ve confirmacion.
- H8 [COSMETICO] Alta de envio: el error "El peso debe ser mayor a 0" sigue visible despues de corregir el valor (solo revalida al enviar).
- H9 [MENOR] Direccion inexistente ("Calle Zzqqxx Inventada 99999, Pueblo Que No Existe") se acepta con 201 sin aviso (verificar si el detalle avisa "sin ubicacion").
- H10 [COSMETICO] Detalle de envio no muestra los datos del remitente.
- H11 [COSMETICO] Vehiculos: errores del form en minuscula y sin marcar el campo ("revisa patente, modelo..." / "ya existe un vehiculo con esa patente"). Inputs Patente/Modelo sin label accesible (solo placeholder).
- H12 [MENOR/datos] TRK-318 figura como "Moto, Mercedes-Benz Accelo 1016" con 5000 kg: dato inconsistente en la base. Badge "En servicio" se parte en 2 lineas en esa tarjeta.

## Datos QA-1110 creados
- Envios: MOV-20261110-0001 (3d2e8c70-92e3-4118-ade6-b9d081c3d111), -0002 (a3a499d1-853a-4e29-9d58-da989b45586a, tel 3564123456), -0003 Lejos Cordoba (71bd6236-3e2f-447c-bec7-d7ee14630bd9), -0004 direccion inexistente (39d12cf9-788a-449b-b32d-77e523591c8e)
- Vehiculo: QA111ZZ

## Avance 3 (rutas)
- D1 OK listado. D2 OK alta (repartidor obligatorio; selector lista repartidores). D3 OK: recomendacion "No conviene (+215.9km, fuera de zona)" para Cordoba, "Conviene (+1.9km)" cercanos, "Direccion invalida" para la inexistente; asignar 2 OK, totales 2 / 6.5 kg. D4 OK asignar vehiculo QA111ZZ (carga 6.5 de 800 kg). D6 OK mapa 2D con paradas, recorrido 2.6 km ~5 min. D7 OK 3D: carga, camaras Seguir/General, modo Noche; sin errores WebGL.
- D7 pantalla completa: NO verificable (el clic automatizado no cuenta como gesto de usuario -> "TypeError: not granted"); pero la excepcion queda sin capturar en consola.
- H13 [COSMETICO] Listado de rutas: titulos truncados ("Ruta Segui...") con espacio de sobra; no se distinguen rutas con nombre parecido.
- H14 [MENOR/visual] Panel "Envios pendientes" (detalle de ruta): muy angosto; el codigo se parte en 3 lineas y al aparecer el badge de recomendacion el peso ("2 kg") se sale del borde de la tarjeta.
- H15 [MENOR/usabilidad] Con un envio de "Direccion invalida" tildado, el boton "Asignar (n)" queda deshabilitado sin ningun mensaje que diga por que.
- H16 [COSMETICO] Recomendacion muestra "+0%" con ruta vacia (dato sin sentido). Checkboxes de pendientes sin nombre accesible ("on").
- H17 [COSMETICO] Mapa de ruta: fecha en formato crudo "2026-11-10" (el resto de la app usa "10 nov. 2026"). Detalle de ruta no muestra la fecha. Alta de ruta no permite elegir fecha (siempre hoy) ni exige nombre.
- H18 [COSMETICO] Tabla "Envios de la ruta": sin destinatario/direccion y el codigo no es link al envio.
- H19 [COSMETICO] Vista 3D: el panel de info tapa la parada 1 en la camara General.

## Datos QA-1110 creados (suma)
- Ruta: "QA-1110 Ruta" 5f1b2c7d-b9f0-4818-859b-0c6107106e99 (Carla, vehiculo QA111ZZ, envios 0001 y 0002)

## Avance 4 (estados, operaciones en vivo)
- C6 OK: "Iniciar reparto" pasa a En camino, timeline suma evento "Por Ana Supervisora", aparece "Volver a asignado". Aviso WhatsApp generado al log (no enviado) con link de tracking.
- C5 OK: detalle con seguimiento en vivo y texto "QA111ZZ esta a 1.9 km (~3 min) y tiene 1 entrega(s) antes".
- E3 OK: editar vehiculo (estado En base -> En servicio) persiste.
- F1 OK KPIs/flota/chofer/linea de paradas. F2 OK: camion se mueve sin recargar, velocidad 34-35 km/h, "Resta" baja. F3 OK: clic en paquete -> "Camino a MOV-... 0.9 km, ~1 min". F4 OK toggle 3D en operaciones.
- H20 [MENOR/logica] Un vehiculo "En base" se puede asignar a una ruta y sus envios pasar a "En camino", pero el simulador solo mueve vehiculos "activo": queda quieto a 0 km/h sin ningun aviso. El alta de vehiculo arranca por defecto en "En base". Ademas KPI "Vehiculos en servicio 3 de 4" cuenta camiones sin ruta.
- H21 [MENOR/visual] Editar vehiculo: el form se abre dentro de la columna de una tarjeta; selects truncados ("Ca...", "En ..."), modelo cortado.
- H22 [COSMETICO] Color "automatico" de vehiculo cambia entre cargas (TRK-318 celeste y despues rosa). "Temperatura de carga" cambia sola (21 C, despues 4 C): dato inventado.
- H23 [COSMETICO] HUD 3D de operaciones: "RESTA 1.8 ..." truncado; barra de camaras pisa la atribucion del mapa.
- Nombre del admin demo sigue siendo "Ana Supervisora" (dato, rol ya es admin).

## Avance 5 (tracking, repartidores, reportes, incidencia, reprogramacion)
- K1 OK codigo inexistente -> mensaje generico. K2/K3 OK /tracking/MOV-20261110-0002: ventana horaria, pasos, mapa en vivo, patente enmascarada (QA***ZZ), zona aproximada. K4 OK no expone datos internos (sin nombre/direccion exacta).
- G1 OK listado repartidores. G2 OK detalle con rutas.
- H1 OK 3 pestanas de reportes (envios total 19, ranking, incidencias vacio). H2 (validaciones de periodo) NO probado en UI. H3 CSV: boton presente, descarga NO ejecutada.
- C6+ OK registrar incidencia (cliente ausente + comentario) -> No entregado; reprogramar: fecha vacia y fecha pasada rechazadas; fecha valida -> vuelve a Pendiente con fecha 12 nov. Tarjeta "Avisos por WhatsApp" muestra los mensajes ("Sin telefono").
- H24 [COSMETICO] Mensajes de error en minuscula y tecnicos: "no se encontro ningun envio con ese codigo", "la fecha debe tener formato YYYY-MM-DD y ser hoy o futura", "La fecha debe tener formato AAAA-MM-DD" (con el campo vacio deberia decir "Elegi una fecha").
- H25 [MENOR/usabilidad] Calendario de reprogramacion deja elegir fechas pasadas (despues el servidor las rechaza).
- H26 [COSMETICO] Historial: "reprogramado para 2026-11-12 (manana)" (fecha cruda, "manana" sin enie) y "Comprometido para 2026-11-12".
- H27 [COSMETICO] Tracking: "Llega entre 19:43 y 19:56" cuando ya eran ~19:46 (la ventana arranca en el pasado).
- H28 [COSMETICO] Detalle de repartidor: tabla de rutas sin fecha ni link; rutas con el mismo nombre son indistinguibles. Reporte: "100% efectividad" con 2 entregados de 9 asignados (la tasa ignora pendientes) puede confundir.
- H29 [COSMETICO] Input de foto de incidencia es el nativo del navegador sin estilo ("Ningun arc...leccionado").
- Estado actual datos QA: envio 0001 = pendiente (reprogramado 12/11, sigue en la ruta?), 0002 = en camino.

## Avance 6 (usuarios, primer acceso, roles, 404)
- I1 OK listado usuarios (propio usuario sin boton borrar). I2 OK alta (email duplicado rechazado). I5 OK primer acceso completo: 428 -> /primer-acceso, clave debil rechazada ("Inclui al menos una mayuscula"), claves distintas rechazadas, codigo por mail (al log), codigo incorrecto rechazado, codigo correcto entra.
- B1 OK operador no ve Usuarios/WhatsApp. B2 OK por URL -> acceso denegado. B3 OK operador sin botones de borrar. D2 OK selector de repartidor funciona como operador.
- A5 OK repartidor -> "Acceso no disponible, usa la app movil". A7 OK logout limpia token y protege rutas. J1 OK pantalla WhatsApp (muestra "deshabilitado en este servidor").
- A6 FALLA visual (ver H31).
- H30 [MAYOR/funcional] En /acceso-denegado, "Cerrar sesion" borra el token pero NO redirige a /login: el usuario queda en la misma pantalla (ahora con otro texto) y el boton ya no hace nada. Callejon sin salida (reproducido con repartidor@movii.demo).
- H31 [MAYOR/visual] Pagina 404 rota: mitad superior negra y mitad inferior gris; el titulo "Pagina no encontrada" es texto oscuro sobre fondo negro (ilegible). Captura: capturas-qa-1110/H31-pagina-404-ilegible.jpg
- H32 [MENOR/usabilidad] "Acceso no disponible" para un operador solo ofrece "Cerrar sesion"; falta "Volver al panel".
- H33 [COSMETICO] Envio inexistente (/envios/<uuid que no existe>): solo el texto "el envio no existe", sin titulo ni link para volver.
- H34 [COSMETICO] Alta de usuario vacia: no muestra mensajes propios (usa validacion nativa del navegador, distinto al resto). Celulares en formatos distintos en el listado ("+54 9 3406518585" vs "+5493564021559"). Casillas del codigo OTP no aparecen como campos en el arbol de accesibilidad.
- H1 (refuerzo): tras cerrar sesion el login vuelve a precargar email y clave del admin.
- Usuario QA: qa1110.operador@movii.test (clave inicial QaInicial1110! -> cambiada a QaNueva1110!). Para borrar al final.

## Avance 7 (responsive, borrados, produccion)
- L1 responsive (simulado con marcos de 390 y 768 px): OK en Operaciones, Rutas, detalle de ruta, mapa, Vehiculos, Repartidores, alta/detalle de envio, alta de usuario, tracking, login. Menu hamburguesa OK.
- H35 [MAYOR/responsive] A 390 px la PAGINA ENTERA desborda horizontalmente en Envios (949 px), Usuarios (846 px) y Reportes (695 px): las tablas no tienen scroll propio. A 768 px siguen desbordando Envios (957) y Usuarios (854).
- H36 [COSMETICO] Listado de envios en escritorio: la columna "Alta" parte la fecha en 5 lineas.
- C7 OK borrar envio pendiente (dialogo propio de confirmacion). Envio "en camino" NO se puede borrar: mensaje claro. D5 OK ruta con envios en reparto no deja cambiar repartidor. D8/E4/I4 OK borrado de ruta, vehiculo y usuario (hechos por API con el token de admin; el boton de UI solo se probo en envios).
- M (produccion, solo lectura, SIN iniciar sesion): login, tracking publico y 404 se ven igual que en local.
- H1 -> sube a [BLOQUEANTE/seguridad]: en https://movii-production.up.railway.app/login el formulario abre con email y clave del ADMIN precargados. Cualquiera que entre a la URL publica aprieta "Ingresar" y es admin (puede borrar usuarios, envios, rutas).
- H31 confirmado tambien en produccion (404 ilegible).
- H37 [MENOR] Tracking de un envio "en camino" desde hace 81 h (MOV-20261107-0006) sigue prometiendo "Llega entre 19:53 y 20:00, en 2 min".

## No probado
- Login con Google mas alla de que el boton existe y apunta a /auth/google (requiere cuenta real).
- Login en dos pasos por WhatsApp (ningun usuario demo tiene celular; WhatsApp apagado). Si se probo el codigo por mail del primer acceso.
- Pantalla completa del 3D (el navegador no la permite a clics automatizados).
- Descarga real del CSV y validaciones de periodo de reportes en la UI.
- Vehiculo en mantenimiento -> rechazo al asignar; editar celular de usuario; edicion de ruta planificada.
- Panel logueado en produccion (no ingreso claves en un sitio productivo); app movil / PWA.
- Navegacion por teclado y contraste formal.

## Limpieza
- Borrado todo lo creado: 4 envios, ruta, vehiculo QA111ZZ y usuario QA. Verificado por API: 25 envios, 12 rutas, 3 vehiculos, 7 usuarios (igual que al empezar), 0 con "QA-1110".
- Pueden quedar filas huerfanas "QA-1110 ..." en las tablas remitentes/destinatarios y el historial de posiciones del vehiculo borrado (no visibles desde la app).
- API y web locales apagadas; services/api/.env restaurado (SIMULADOR_GPS=false, RESEND con su clave).
