# Clase SCM

## Pagina 1
Gestión de
Configuración
de Software
ING. JAVIER SALDARINI
ING. DIEGO GANDINO

## Pagina 2
Objetivos
 Conocer los problemas que se presentan en la
construcción de un software
 Conocer la forma de controlar los cambios
durante el desarrollo de un software
2

## Pagina 3
Pregunta
Si hoy un cliente llama diciendo que encontró un error...
 ¿qué versión tiene?
 ¿quién hizo ese cambio?
 ¿en qué fecha?
 ¿qué otros archivos cambió?
 ¿podemos volver atrás?
3

## Pagina 4
Introducción
 Cuando se construye software los cambios son inevitables
 Bugs
 Nuevas regulaciones
 Cambios de hardware
 Competencia
 Aumentan el grado de confusión:
 No se analizan
 No se registran antes de implementarlos
 No se comunican
 No se controlan
 El cambio es simple en concepto, pero complejo en la
implementación
 No administramos el software, administramos el cambio
4

## Pagina 5
 Los resultados de la IS son:
 Programas de computadora
 Documentos
 Datos
 Archivos YAML
 APIs
 Modelos de IA
 prompts
 Colectivamente forman la configuración del
software
 La gestión se ocupa de las políticas, procesos y
las herramientas para administrar los sistemas
cambiantes de software.
 Es útil para trabajos individuales y esencial para el
trabajo en equipo.
5

## Pagina 6
Ciclo de Vida del Software
 Cambios
 Internos
 Correctivo (Defectos)
 Perfectivo (Mejoras)
 Externos
 Adaptativos
 Nuevos
requerimientos
 Cambios en
requerimientos
6
Desarrollo
Propuesta
de Cambio

## Pagina 7
El software 7
Requerimient
os
Diseño
Fuente 1 Fuente 2 Fuente 3 Fuente 4 Fuente 5 Fuente 6
Objeto 2 Objeto 3 Objeto 5
Enero

## Pagina 8
La evolución del software 8
Requerimiento
s
Diseño
Fuente 1 Fuente 2 Fuente 3 Fuente 4 Fuente 5 Fuente 6
Objeto 2 Objeto 3 Objeto 5
Enero
Requerimientos
Diseño
Fuente 1 Fuente 2 Fuente 3 Fuente 4 Fuente 5 Fuente 6
Objeto 2 Objeto 3 Objeto 5
Febrero

## Pagina 9
Problemas 9
Reqeurimientos
Diseño
Fuente 1 Fuente 2 Fuente 3 Fuente 4 Fuente 5 Fuente 6
Objeto 2 Objeto 3 Objeto 5
¿Febrero?
Reqeurimientos
Diseño
Fuente 1 Fuente 2 Fuente 3 Fuente 4 Fuente 5 Fuente 6
Objeto 2 Objeto 3 Objeto 5
Febrero

## Pagina 10
Evolución de un fuente 10
Fuente 3
Fuente 3
Febrero
Enero
Fuente 3
Marzo
Fuente 3
Abril
Fuente 3
Febrero 15
Fuente 3
Junio
Fuente 3
Marzo 9
Rama
Combinación
Rama
Tronco

## Pagina 11
Evolución del conjunto 11
SS 1.0.00
SS 1.2.00
SS 2.0.00SS 2.0.00
SS 2.0.01 NT3.51
SS 2.1.00 NT3.51
SS 2.1.01 NT3.51
SS 2.1.00
SS 2.1.01
SS 2.3.00
SS 3.0.00
SS 2.2.00
En desarrollo
En producción
Anterior
Piloto

## Pagina 12
Problemas en el manejo
de componentes
 Pérdida de un componente
 Pérdida de cambios (el componente que tengo
no es el último)
 sincronía fuente - objeto - ejecutable
 regresión de fallas
 Doble mantenimiento
 Superposición de cambios
 Cambios no validados
12

## Pagina 13
Mas problemas
 Un error fue arreglado hace meses y de repente
aparece
 Se perdieron 12 hs en hacer el cambio en una
versión incorrecta
 Dos programadores perdieron 40 hs trabajando y
sobreescribieron su trabajo
 Nadie encuentra la ultima versión....
13

## Pagina 14
Pérdida de Componentes
c
c c c
c c c c
?
c
14

## Pagina 15
Múltiples copias del
mismo documento
a
b c d
e f g
?
i
h h h
15

## Pagina 16
Copias viejas
a
b c d
e f g
?
i
1998
h (1975)
h (1998)
¿
16

## Pagina 17
Desarrollo en equipo:
Actualización múltiple
aaa
zzz
ccc
g
aaa
yyy
ccc
g
aaa
zzz
ccc
g
aaa
yyy
ccc
g
17

## Pagina 18
Desarrollo en equipo:
Doble actualización
aaa
bbb
ccc
g
aaa
bbb
ccc
g
aaa
xxx
ccc
g
18

## Pagina 19
Preguntas claves
 ¿Cuál es mi configuración de software actual?
 ¿Cuál es su estado?
 ¿Cómo controlo los cambios en las
configuraciones?
 ¿Cómo informo a todos los cambios?
 ¿Qué cambios se han hecho?
19

## Pagina 20
La Gestión de
Configuraciones
 Es el arte de identificar, organizar, controlar las
modificaciones que sufre el software y asegurarse
que todas las personas se enteren.
 Es una actividad de garantía de calidad que se
aplica en todas las fases del proceso de
desarrollo
20

## Pagina 21
La configuración
 Es el conjunto de todos los componentes fuentes
que son compilados en un ejecutable consistente
 Son todos los componentes, documentos e
información de su estructura que definen una
versión determinada del producto a entregar
21

## Pagina 22
Origen de los cambios
 Nuevos negocios
 Nuevas necesidades del cliente.
 Reorganización y/o reducción del volumen
comercial.
 Restricciones presupuestarias o de planificación.
 Nuevas tecnologías
22

## Pagina 23
Ventajas
 Aumenta la protección contra cambios
innecesarios
 Mejora de la visibilidad del estado del proyecto y
sus componentes
 Aumenta la auto responsabilidad
 Disminuye los costos por retrabajos
 Disminuye el tiempo de desarrollo
 Aumenta la calidad
23

## Pagina 24
Línea base
 Una especificación o producto que se ha
revisado y sobre los que se ha llegado a un
acuerdo y que de ahí en adelante sirve como
base para un desarrollo posterior y que puede
cambiarse solamente a través de procedimientos
formales de control de cambios
 La linea base es un concepto ingenieril
 Las herramientas lo implementan como Tag
24

## Pagina 25
Línea Base 25
A
B
C
D
A
B
D
E
A
B
D
E
CambioLínea Base
Enero Febrero Marzo
Componente

## Pagina 26
Administración del
cambio
26
 Asegurar que los cambios se aplican en forma
controlada.
 Priorizar los cambios mas urgentes y rentables.
 Analiza los costos y beneficios.
 Consecuencia de no realizar el cambio.
 Beneficios del cambio.
 Nro de usuarios afectados.
 Costos de hacer el cambio.
 Ciclo de liberación del producto.
 El proceso  se inicia con una petición de cambio.

## Pagina 27
Proceso de Cambios 27
Desarrollo
Revisión
A
Línea Base
Propuesta
de Cambio Análisis
de Impacto Revisión
de Partes Aceptación
o Rechazo Notificación
a Partes
Comité Control
de Cambios

## Pagina 28
[Sin texto extraible]

## Pagina 29
Tareas de GCS
 Identificación
 Items que se administran
 Objetos necesarios para diseñar, desarrollar, construir, mantener y
testear un software
 Es lo mas importante
 Control de versiones
 Es el proceso de controlar y limitar los cambios realizados en los items
 Evalua, coordina, aprueba e implementa los cambios
29

## Pagina 30
 Control de cambios
 Realiza seguimiento de los cambios
 Provee los mecanismos para determinar el estado
de cada item en cada fase del proceso
 Recolecta información para:
 ¿Qué cambios se pidieron?
 ¿Qué cambios se realizaron? ¿Cuándo?
 ¿Quien realizo el cambio? ¿Quién lo autorizo?
 Auditorías de configuración
 Generación de informes
30

## Pagina 31
Auditoría de
configuración
 ¿Se realizo el cambio? ¿se hicieron cambios
adicionales?
 Se llevó a cabo una RTF
 Se siguieron los estándares de la IS.
 Se siguieron los procedimientos de GCS para
señalar el cambio, registrarlo y divulgarlo.
31

## Pagina 32
El proceso de cambio
32
Cambio en el
software
Mejoras en el
software
Reporte de
problemas
Análisis de impacto
Propuesta de cambio
Evaluación de la
propuesta
Aprobación?Incorporar el cambio
Verificar el cambio Información del
cambio
Se archiva el cambio
FIN

## Pagina 33
Sistemas de control de
versiones
 RCS →CVS→Subversion→Git→GitHub/GitLab/Azure
devOps
 Fácil acceso a todos los componentes
 Reconstrucción de cualquier versión
 Registro de Historia
 No se pierden
 Centralización (no se requiere la presencia del dueño)
 Información de resumen
 Gestión de almacenamiento
33

## Pagina 34
Construcción del sistema
 Proceso para crear un sistema ejecutable y completo
al compilar y vincular los componentes del sistema.
 Comunicación con las herramientas de versionado.
 Implica ensamblar una gran cantidad de
información acerca del  software y su entorno
operacional.
 Algunas características:
 Generación de rutinas de construcción
 Integración con el sistema de versionado.
 Creación del ejecutable
 Automatización de pruebas
 Informes
 Generación de documentación
34

## Pagina 35
GCS como Función de
soporte
 Control de
Versiones
 Seguimiento de
dependencias
 Control de cambios
 Reporte de estado
 Control de auditoría
 Gestión de
Construcción
Gestión de Proceso
 Gestión de espacio
de trabajo
 Gestión de
repositorio
35

## Pagina 36
Qué poner bajo control
de versiones
 Plan de CM
 Propuestas de Cambio
 Visión
 10 Riesgos principales
 Plan de desarrollo
 Prototipo de Interface
 Guía de Estilo de IHM
 Manual de Usuario
 Requerimientos
 Plan de Calidad
 Arquitectura del Software
 Plan de Integración
 Planes de fases
 Estándares de codificación
 Casos de prueba
 Código fuente
 Gráficos, íconos, ...
 Instructivo de ensamble
 Programa de instalación
 Documento de despliegue
 Lista de Control de entrega
 Formulario de aceptación
 Registro del proyecto
36

## Pagina 37
Con qué empezar
 Fuentes
 Ejecutables
 Scripts de BDD
 Scripts de instalación
 Herramientas
(Compiladores, ...)
 Sistema Operativo
 Parámetros de
Clientes
 Parámetros de
Servidores
 Parámetros de Bases
de Datos
 Bibliotecas dinámicas
de tiempo de
ejecución
37

## Pagina 38
Las trabas
 Quejas
 Es burocrático
 Es molesto
 Se meten con mi trabajo
 La transición es difícil
 No hay compromiso en todos los niveles
 No hay conciencia del problema
38

## Pagina 39
Git es Gestion de
configuraciones?
 Git
– Versionado
– Branches
– Merge
– Historial
39
 Gestión de configuraciones
– Control de versiones
– Gestion de cambios
– Baselines
– Auditorías
– Releases
– Build
– Trazabilidad
– Estado de configuración

## Pagina 40
Ejemplo
Sistema de facturación
 El cliente llama: “La factura A imprime mal el
CAE”
Empieza el proceso de GCS
 Paso 1: se crea la solicitud de cambio

## Pagina 41
Paso 2: Análisis:
Paso 3: Aprobación (define responsable)
Paso 4: Desarrollo (se modifica facturaA.php v4.3.2)
Paso 5: Prueba (el tester prueba la correcta
impresion)
Paso 6: Nueva versión (Release 4.3.3)
Paso 7: Actualización (manual, release notes, base
de datos, instalador)

## Pagina 42
Conclusiones
 Hay trabajo extra y sobrecargas
 Con lo cual se logra:
 Visibilidad
 Reducción de Riesgos
 Control del Proyecto
 En realidad es poco tiempo para el beneficio
obtenido
 "La gestión de configuraciones no evita los
cambios. Hace que los cambios sean
controlados, repetibles, trazables y auditables."
42

## Pagina 43
Bibliografía
 Ingeniería de software 9 edic
Ian Sommerville
Capítulo 25
 Ingeniería del Software un
enfoque practico 4º edición
Roger Pressman
Capítulo 9
43
