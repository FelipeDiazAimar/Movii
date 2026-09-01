---

---

---

---

---

---

---

PROCESO Ciclo de Desarrollo de Software

![Image ds1-mtiv51om::p1::img_p0_1](image_ds1-mtiv51om::p1::img_p0_1.png)

Documento Plan Maestro de pruebas (PMP)

### Ingeniería en Computación e Informática

---

---

---

---

---

---

---

---

# PLAN MAESTRO DE PRUEBAS

### INGENIERÍA EN COMPUTACIÓN E INFORMÁTICA

## NSGT- NUEVO SISTEMA DE GESTIÓN DE

## TITULACIÓN

VERSIÓN 1.0

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

> **ℹ Note**
>
> Instituto profesional Ciisa Ingeniería en Computación eInformática

Ejemplo - Plan-de-Pruebas- Ejemplo.docx

Fecha Actualización:17/05/08 Página1de 10

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---


---

---

---

---

---

---

---

---

PROCESO Ciclo de Desarrollo de Software

![Image ds1-mtiv51om::p2::g_d0_img_p1_1](image_ds1-mtiv51om::p2::g_d0_img_p1_1.png)

Documento Plan Maestro de pruebas (PMP)

### **Ingeniería en** **Computación e** **Informática**

---

---

---

---

---

---

---

---

### HOJA RESUMEN DE MODIFICACIONES

---

### CAMBIOS RESPECTO DE LA VERSIÓN ANTERIOR

> **ℹ Note**
>
> VERSIÓN FECHA PUNTO1.0 17/05/2008 Versión Inicial

| PREPARADO | APROBADO POR |
| --- | --- |
| POR |
| Claudia Cifuentes | Pilar Gonzalez de la Vega S. |
|  |  |
|  |  |

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

> **ℹ Note**
>
> Instituto profesional Ciisa Ingeniería en Computación eInformática

**Ejemplo - Plan-de-Pruebas-** **Ejemplo.docx**

**Fecha Actualización:17/05/08** **Página2de 10**

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---


---

---

---

---

---

---

---

---

---

---

---

---

---

---

PROCESO Ciclo de Desarrollo de Software Documento Plan Maestro de pruebas (PMP)

**Ingeniería en** **Computación e** **Informática**

![Image ds1-mtiv51om::p3::g_d0_img_p1_1](image_ds1-mtiv51om::p3::g_d0_img_p1_1.png)

---

---

---

---

---

---

---

---

INDICE

[HOJA RESUMEN DE MODIFICACIONES......................................................................................2](#page-2)

[INTRODUCCIÓN](#page-4) [...................................................................................................................](#page-4) [4](#page-4)

[1.1. OBJETIVOSDELPLANDEPRUEBAS .............................................................................. 4](#page-4) [1.2. DOCUMENTOSRELACIONADOS .................................................................................... 4](#page-4)

[ALCANCE DE LAS PRUEBAS ...............................................................................................](#page-4) [4](#page-4)

[2.1. CUADRORESUMENDELASPRUEBAS .......................................................................... 5](#page-5) [2.2. REQUERIMIENTOSDEPRUEBASEXCLUIDOS .............................................................. 5](#page-5) [2.3. CASOSDEPRUEBASINCLUIDOS ................................................................................... 6](#page-6) [2.4. CASOSDEPRUEBASEXCLUIDOS .................................................................................. 6](#page-6)

[ENTORNO Y CONFIGURACIÓN DE LAS PRUEBAS .............................................................](#page-6) [6](#page-6)

[3.1. CRITERIOSDEINICIO ...................................................................................................... 7](#page-7) [3.2. BASESDEDATOSDEPRUEBAS ..................................................................................... 7](#page-7) [3.3. CRITERIOSDEAPROBACION/RECHAZO...................................................................... 7](#page-7)

[ESTRATEGIA DE PRUEBAS .................................................................................................](#page-8) [8](#page-8)

[4.1. ESCENARIODELASPRUEBAS ....................................................................................... 8](#page-8) [4.2. ORDENDEEJECUCIÓNDEPRUEBAS............................................................................ 9](#page-9) [4.3. EQUIPODEPRUEBASYRESPONSABILIDADES.......................................................... 10](#page-10)

---

---

> **ℹ Note**
>
> Instituto profesional Ciisa Ingeniería en Computación eInformática

**Ejemplo - Plan-de-Pruebas-** **Fecha Actualización:17/05/08** **Ejemplo.docx** **Página3de 10**


---

---

---

---

---

---

---

---

PROCESO Ciclo de Desarrollo de Software

![Image ds1-mtiv51om::p4::g_d0_img_p1_1](image_ds1-mtiv51om::p4::g_d0_img_p1_1.png)

Documento Plan Maestro de pruebas (PMP)

**Ingeniería en** **Computación e** **Informática**

---

---

---

---

---

---

---

---

INTRODUCCIÓN

| Proyecto(s) | Tipo de Proyecto |
| --- | --- |
| NSGT-Nuevo Sistema de Gestión de Titulación. | Proyecto de Desarrollo de Software Académico. |
| Documentos Evaluación relacionados |
| NSGT-DC_AD_v1.1.doc NSGT-DC_IR_v1.1.doc |
| Equipo de Proyecto |
| Pilar González Jefe de Equipo de la Vega S. | Javier Trabol L.– Arquitecto de Producto Claudia Cifuentes C. |

---

---

---

---

1.1. OBJETIVOS DEL PLAN DE PRUEBAS

Este documento, tiene como finalidad entregar las pautas y definir la estrategia que se seguirá para llevar a cabo la certificación del software NSGT- Nuevo Sistema de Gestión de Titulación.

El objetivo general del plan es establecer la cronología y condiciones para la aplicación de las pruebas de manera de obtener, un sistema que pueda ser completado con una recepción total de los interesados y entrar en operación con la totalidad de las funcionalidades requeridas para su funcionamiento.

1.2. DOCUMENTOS RELACIONADOS

| Nombre | Descripción | Ruta en Blog (URL) |
| --- | --- | --- |
| Informe deRequisitosVersión 1.0 | Informe de Requisitos | http://nsgt.files.wordpress.com/2008/04/nsgt-dc_ir_v111.doc |
| Informe deAnálisis yDiseño v.1.1 | Informe de Análisis y Diseño | http://nsgt.files.wordpress.com/2008/05/nsgt-dc_ad_v11.doc |

ALCANCE DE LAS PRUEBAS

Mediante los siguientes cuadros se describen los requerimientos de pruebas del sistema NSGT, incluidos y excluidos en la presente certificación del sistema NSGT, dicha información puede ser consultada desde el Blog del proyecto : http://nsgt.wordpress.com/category/nsgt/.

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

> **ℹ Note**
>
> Instituto profesional Ciisa Ingeniería en Computación eInformática

---

**Ejemplo - Plan-de-Pruebas-** **Ejemplo.docx**

**Fecha Actualización:17/05/08** **Página4de 10**

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---


---

---

---

---

---

---

---

---

![Image ds1-mtiv51om::p5::g_d0_img_p1_1](image_ds1-mtiv51om::p5::g_d0_img_p1_1.png)

Documento Plan Maestro de pruebas (PMP)

PROCESO Ciclo de Desarrollo de Software

**Ingeniería en** **Computación e** **Informática**

---

---

---

---

---

---

---

---

**2.1. CUADRO RESUMEN DE LAS PRUEBAS**

---

Módulos del Sistema Sencillito a ser probados:

> **ℹ Note**
>
> Módulos: Proyectos Revisión Aprobación

---

Objetivosde las Pruebas

> **ℹ Note**
>
> En estos Módulos se realizarán pruebas para validar:Lavisualizaciónde los datos, ingresados o modificados.La operación de los servicios, confeccionados para dar respuesta a los productos del sistema NSGT.La respuesta y realización de las transacciones de cada módulo.Que los estados de las actividades y documentos generados en el sistema se reflejen de acuerdo a la secuencia lógica requerida por el usuario.La secuencia lógica de las funcionalidades y transacciones.

---

Detalle del orden de ejecución de los módulos

> **ℹ Note**
>
> Los módulos se deben ejecutar en forma independiente, pero consecutivos en el orden siguiente: Proyectos . Revisión . Aprobación

> **ℹ Note**
>
> Responsabilidad de la Prueba Las pruebas son responsabilidad del Testing Operacional equipo de seleccionar las pruebas que aseguren la efectividad del

**2.2. REQUERIMIENTOS DE PRUEBAS EXCLUIDOS**

del proyecto, quien en conjunto con el usuario deben sistema.

| Nombre | Descripción | Tipo | Nivel Criticidad (Bajo, Medio, Alto) |
| --- | --- | --- | --- |
| N/A | N/A | N/A | N/A |

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

> **ℹ Note**
>
> Instituto profesional Ciisa Ingeniería en Computación eInformática

---

**Ejemplo - Plan-de-Pruebas-** **Ejemplo.docx**

**Fecha Actualización:17/05/08** **Página5de 10**

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---


---

---

---

---

---

---

---

---

PROCESO Ciclo de Desarrollo de Software

![Image ds1-mtiv51om::p6::g_d0_img_p1_1](image_ds1-mtiv51om::p6::g_d0_img_p1_1.png)

Documento Plan Maestro de pruebas (PMP)

**Ingeniería en** **Computación e** **Informática**

---

---

---

---

---

---

---

---

**2.3. CASOS DE PRUEBAS INCLUIDOS** **2.4. CASOS DE PRUEBAS EXCLUIDOS**

|  | # Estimado Casos |  |  | Total de |
| --- | --- | --- | --- | --- |
| # Casos Disponibles | Nuevos | Tipo | Modulo | Casos |
| 200 | 30 | funcional | Proyectos |  |
| 75 | 11 | funcional | Revisión |  |
| 55 | 8 | funcional | Aprobación |  |
|  |  |  |  | 330 |

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

|  | # Estimado Casos |  |  |
| --- | --- | --- | --- |
| # Casos Disponibles | Nuevos | Tipo | Modulo |
| N/A | N/A | N/A | N/A |

ENTORNO Y CONFIGURACIÓN DE LAS PRUEBAS

Para el proceso de pruebas del proyecto se requiere de la disponibilidad de los siguientes entornos, a saber:

Servidor Windows Server 2003 con Internet Information Server ASP 2.0.

 Equipo marca LENOVO T2330(1.60GHz), 1GB RAM, 160GB 5400rpm HDD, 12.1in 1280x800 LCD, Intel X3100, 802.11bg wireless, Windows XP Pro sp 2, IE

versión 7.

Equipos Cliente: Equipos de Prueba.

 Equipo marca COMPAQ Amd Sempron 1.80 GHz Windows Server 2003 1 GB

RAM 80 HDD, 802.11bg wireless, IE version 6.

 Equipo marca DELL Inspiron 1300, Pentium 1.70 GHz 512 Mb RAM, 80 HDD,

Windows XP Pro sp2, IE versión 7.

Base de Datos SQL 2000. Reside en equipo de servidor de Pruebas detallado en el punto a del

entorno y configuración de las pruebas.

Todos ellos configurados por el equipo NSGT.

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

> **ℹ Note**
>
> Instituto profesional Ciisa Ingeniería en Computación eInformática

---

**Ejemplo - Plan-de-Pruebas-** **Ejemplo.docx**

**Fecha Actualización:17/05/08** **Página6de 10**

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---


---

---

---

---

---

---

---

---

PROCESO Ciclo de Desarrollo de Software

![Image ds1-mtiv51om::p7::g_d0_img_p1_1](image_ds1-mtiv51om::p7::g_d0_img_p1_1.png)

Documento Plan Maestro de pruebas (PMP)

**Ingeniería en** **Computación e** **Informática**

---

---

---

---

---

---

---

> **ℹ Note**
>
> 3.1. CRITERIOS DE INICIOAceptación del plan de pruebas . Revisión y aceptación del documento que contiene los casos de pruebas para lacertificación del proyecto.Aceptación de paquetes . Revisión y aceptación de los paquetes de desarrollo, y que este cumpla con las condiciones de aceptación.Aceptación de ambiente . Revisión y aceptación del ambiente de certificación, y que este cumpla con las condiciones de aceptación.3.2. BASES DE DATOS DE PRUEBASBase de Datos : NSGTServidor BD : NSGTDatos : \\NSGT\datosnsgt3.3. CRITERIOS DE APROBACION / RECHAZOErrores Graves: información crítica presentada erróneamente, información mal registrada en la base de datos, caídas de programas, incumplimiento de objetivos en funciones principales, etc.Errores Medios (comunes): errores en documentos impresos que se entregan a personas ajenas a la organización, errores en presentación de datos, incumplimiento de objetivos en funciones secundarias, caídas de programas auxiliares, etc.Errores Leves:errores en presentación de datos secundarios, no adecuación a estándares, comportamientos correctos pero diferentes en situaciones similares, dificultades de operación, etc.Nombre Descripción1 Se aprobará el proyecto con un 100% de las pruebas ejecutadas pero con un 90% de aceptación. Esto quiere decir el 90% de las pruebas deben ser exitosas y sin errores. El restante 10% pueden existir errores medios o bajos, pero no graves.En caso de ocurrir que el proyecto no cumpla con el nivel exigido, el proyecto se rechaza completo en su etapa de certificación.

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

> **ℹ Note**
>
> Instituto profesional Ciisa Ingeniería en Computación eInformática

---

**Ejemplo - Plan-de-Pruebas-** **Ejemplo.docx**

**Fecha Actualización:17/05/08** **Página7de 10**

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---


---

---

---

---

---

---

---

---

PROCESO Ciclo de Desarrollo de Software

![Image ds1-mtiv51om::p8::g_d0_img_p1_1](image_ds1-mtiv51om::p8::g_d0_img_p1_1.png)

Documento Plan Maestro de pruebas (PMP)

**Ingeniería en** **Computación e** **Informática**

---

---

---

---

---

---

---

> **ℹ Note**
>
> ESTRATEGIA DE PRUEBAS Se requiere certificar por parte del equipo de desarrollo y por parte del usuario al producto NSGT – Nuevo Sistema de Gestión de Titulación en dos etapas, que administre y gestione los talleres de titulación del IPCiisa. Por ende se debe verificar: 1ra. Etapa: Que las funcionalidades de los módulos de Proyectos y de Revisión son operativas. 2da. Etapa: Que las funcionalidades integradas de los módulos de Proyectos, Revisión y Aprobación son operativas. Conjuntamente los sub-objetivos para los tres módulos se resumen de la siguiente forma:o El ingreso y la postulación de las propuestas técnicas y sus profesores asociados.o La creación, modificación y eliminación de documentos asociados al proyecto de titulación de cada grupo de alumnos.o La creación, modificación y eliminación de tareas (actividades) asociadas al proyecto de titulación.o La creación, modificación y eliminación de Resoluciones y Memorándums por parte del Consejo.o La revisión y aprobación de los entregables de cada proyecto.o La visualización, modificación y eliminación del calendario de evaluaciones y reuniones.o Que los documentos y actividades se generen con su estado correspondiente en el sistema.Será necesario indicar como objetivo realizar las pruebas de los módulos para la gestión y administración de los Talleres de los proyectos de Titulación del IPCiisa . Esto se refiere a verificar y validar los resultados o salidas generados. Un objetivo importante es la utilización de técnicas formales de prueba (RTFs.: Estáticas y Dinámicas).4.1. ESCENARIO DE LAS PRUEBASPara cumplir con los objetivos planteados deben existir tres escenarios, que son, Pruebas de Instalación, Pruebas de GUI o Interfaz y Pruebas de Operación o Funcionales.Para las Pruebas de Instalación se debe comprobar que: Aplicación no presenta anomalías. Que apunta al servidor y base de datos definidos.Para las pruebas de GUI se debe comprobar que: Comportamiento de aplicación con casos de bordes inválidos y válidos, donde las pruebas de borde se definen como aquellas pruebas en las cuáles los datos de prueba a utilizar son valores límites.

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

> **ℹ Note**
>
> Instituto profesional Ciisa Ingeniería en Computación eInformática

---

**Ejemplo - Plan-de-Pruebas-** **Ejemplo.docx**

**Fecha Actualización:17/05/08** **Página8de 10**

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---


---

---

---

---

---

---

---

---

PROCESO Ciclo de Desarrollo de Software

![Image ds1-mtiv51om::p9::g_d0_img_p1_1](image_ds1-mtiv51om::p9::g_d0_img_p1_1.png)

Documento Plan Maestro de pruebas (PMP)

**Ingeniería en** **Computación e** **Informática**

---

---

---

---

---

---

---

> **ℹ Note**
>
>  Carga, despliegue, foco, modalidad, navegabilidad y usabilidad de las GUI del Sistema y sus elementos. Donde las métricas y Heurísticas de usabilidad y funcionalidad a utilizar son las siguientes:o Comprensión Global del Sitio.o Aspectos de Interfaces y Estéticos.o Métricas de confiabilidad.o Navegación y Exploración.Para las pruebas de Operación o Funcionales se debe comprobar: El comportamiento de aplicación con casos inválidos y válidos, de flujo completo del proceso de las propuestas y proyectos. El comportamiento de aplicación con casos inválidos y válidos, de flujo completo del proceso de los documentos generados por el consejo. El comportamiento de aplicación con casos inválidos y válidos, de flujo completo del proceso de las diferentes acitividades relacionadas a una propuesta y proyecto de titulación. El comportamiento de la aplicación para el módulo de proyectos. El comportamiento de la aplicación para el módulo de Revisión. El comportamiento de la aplicación para el módulo de Aprobación.4.2. ORDEN DE EJECUCIÓN DE PRUEBASLas pruebas se llevarán a cabo de la siguiente forma:Secuencias de pasos para la Configuración Configuración de los Equipos Cliente y del Servidor de Aplicación Web y de Base de Datos. iguración de Archivos XM ¿? [¿??? ] Secuencias de pasos para la generación de archivos para los tres módulos. Ejecución de proceso (manual) de generación de archivos de entrada con la información de los alumnos para alimentar al sistema NSGT. Secuencias de pasos para la generación de datos para los tres módulos. Ejecución del proceso (manual) de generación de datos, donde las tablas y campos a utilizar serán llenados manualmente.

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

> **ℹ Note**
>
> Instituto profesional Ciisa Ingeniería en Computación eInformática

---

**Ejemplo - Plan-de-Pruebas-** **Ejemplo.docx**

**Fecha Actualización:17/05/08** **Página9de 10**

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---


---

---

---

---

---

---

---

---

PROCESO Ciclo de Desarrollo de Software Documento Plan Maestro de pruebas (PMP)

**Ingeniería en** **Computación e** **Informática**

![Image ds1-mtiv51om::p10::g_d0_img_p1_1](image_ds1-mtiv51om::p10::g_d0_img_p1_1.png)

---

---

---

---

---

---

---

---

**4.3. EQUIPO DE PRUEBAS Y RESPONSABILIDADES**

---

---

---

---

---

---

---

---

---

---

---

---

Nombre

Claudia Cifuentes.

Responsabilidad

Arquitecto de Producto, responsable de evaluar las condiciones de término para el proceso de pruebas junto alJefe deProyectos.

---

---

---

---

---

---

---

Pilar Gonzalez de la Vega.

Jefe de Proyectos, responsable de evaluar las condiciones de término para el proceso de pruebas junto al Arquitecto de Producto.

---

---

---

---

---

---

---

Javier Traboll.

Analista funcional, responsable de la resolución de las incidencias de certificación para los módulos de Proyectos, Revisión y Aprobación.

---

---

---

---

---

---

---

---

---

Javier Traboll, Claudia

Cifuentes, Pilar Gonzalez de la Vega.

Testing de Solución, responsable de la generación del plan de pruebas.

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

> **ℹ Note**
>
> Instituto profesional Ciisa Ingeniería en Computación eInformática

---

**Ejemplo - Plan-de-Pruebas-** **Ejemplo.docx**

**Fecha Actualización:17/05/08** **Página10de10**

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---

---
