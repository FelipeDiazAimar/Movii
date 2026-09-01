# <<Nombre de proyecto>>

## Plan de prueba

### Historial de cambios del documento

| Número de versión | Fecha | Colaborador | Colaborador |
| --- | --- | --- | --- |
|  |  |
| V1.0 |  |  | ¿Qué cambios (adiciones y |

supresiones) se han introducido en esta versión?

---

---

** Nota para el autor del documento - El texto rojo y azul en este documento está dirigido al usuario de la plantilla para describir procesos, crear normas y ayudar a construir el documento a partir de la plantilla. Todo el texto en rojo y azul debe ser eliminado antes de presentar cualquier documentación formal, incluyendo tanto el borrador como los entregables finales. ****

Actualizado el 6 de junio de 2023


---

**Objetivo de las pruebas**

Evaluar las funcionalidades del producto de software para verificar y validar que el producto satisfaga las expectativas del** cliente** y de los** usuarios**. También se busca reducir la probabilidad de que aparezcan defectos en el entorno de producción.

**Alcance (S**cope**)**

*(Nota: esto es un acuerdo con el equipo de testing pero también con otros equipos para* *setear expectativas. No tiene porque ser solo tipos de prueba, sino que también podemos* *definir como parte del alcance algunas funcionalidades a probar y dejar otras fuera)*

Se verificará la funcionalidad del producto de software así como también su compatibilidad con diversos dispositivos y portabilidad en diferentes plataformas. También estará dentro del alcance de las pruebas verificar su UI/UX y los tiempos de respuesta.

Quedarán fuera del alcance de las pruebas las comprobaciones de seguridad.

**Equipo (P**eople**)**

*(Nota: se debe buscar un grado de independencia adecuado. ¿Qué quiere decir? Muchas* *personas pueden ser útiles para probar: desarrolladores, testers independientes (externos* *al equipo, proyecto o empresa), usuarios finales, expertos de negocio. Buscar combinar los* *distintos puntos de vista y grados de independencia.)*

El equipo de pruebas estará conformado por un tester junior full time y un tester semi-senior part time. Ambos testers estarán prestando servicios desde Argentina. Debido a que se estará trabajando dentro de una WAN, será necesario asistir a la oficina cada vez que se lance una nueva versión.

**Estrategia (A**pproach**)**

*(Nota: proporciona una descripción genérica del proceso de prueba. Según ISTQB algunas* *estrategias pueden ser Analítica (requisitos, riesgos, costos), Basada en Modelos, Metódico,* *etc. (ver 5.2.2 de ISTQB). Ponerle pienso a esta parte para determinar la mejor forma de* *probar esto; cómo organizar las pruebas, si vamos a automatizar o no, cuánto vamos a* *automatizar, qué niveles vamos a automatizar, etc. Todo lo que definamos aquí tiene que*

*estar alineado y ser consistente con objetivos y alcance.)*


---

El equipo de desarrollo implementará pruebas unitarias como parte de su

pipeline.

El equipo de testing realizará pruebas funcionales y no funcionales de forma manual. Cada vez que una nueva versión llegue a testing se hará una prueba de regresión sobre aquellos escenarios que se consideren de prioridad alta.

Dentro de las pruebas no funcionales se ejecutarán pruebas de performance, portabilidad, compatibilidad y usabilidad.

Al finalizar cada sprint se realizarán pruebas de aceptación de usuario (UAT). Al mismo tiempo, se aprovecharán esas reuniones para hacer pruebas de usabilidad.

**Criterios (C**riteria**)**

*(Nota: aquí van los criterios de entrada -definition of ready- para comenzar las pruebas,* *criterios de salida -definition of done- para saber cuándo las pruebas han sido completadas* *y criterios de suspensión para saber cuándo suspender la ejecución de las pruebas -ej. Si* *fallan pruebas de un módulo core-)*

Las pruebas del equipo de testing comenzarán cuando hayan pasado satisfactoriamente las pruebas unitarias. Para poder realizar las pruebas se deberá contar con los entornos de prueba necesarios.

El criterio de finalización de las pruebas será cuando se hayan ejecutado todas las pruebas planificadas o, si el tiempo apremia, al menos se hayan ejecutado los casos de prueba de prioridad alta y media según el siguiente criterio:

Todos los casos de prueba de Prioridad 1 se han ejecutado sin fallos
Al menos el 60% de los casos de prueba de prioridad 2 se han

ejecutado sin fallos.


---

Se usará la siguiente tabla como referencia:

| Prioridad de test cases | ¿Qué significa? |
| --- | --- |
| Alta | Test case debe ser ejecutado |
| Media | Test case debería ser ejecutado |
| Baja | Test case puede ser ejecutado |

El criterio para pasar a producción será que no haya errores bloqueantes o críticos sin resolver.

**Ambientes (E**nvironments**)**

*(Nota: existencia de un entorno dedicado a la actividad de pruebas, incluyendo hardware,* *software de base y herramientas;*

Nuestros ambientes de prueba serán:

● 1 notebook mac ● 1 notebook Lenovo con windows 10 ● 1 notebook Samsung con ubuntu 22.04 LTS ● 1 IPhone 12 Pro (iOS) ● 1 Samsung Galaxy A51 (Android) Para cada uno de los tipo de dispositivo anteriores, probaremos utilizando las siguientes versiones de navegador:

● Google Chrome 98-112 ● Safari 15.4-16.4 ● Firefox 94-112

Los datos del ambiente de testing serán actualizados luego del lanzamiento de cada release, tomando datos del servidor de producción y anonimizando la información sensible (ver anexo D) para no comprometer la seguridad de los datos.


---

**Entregables (D**eliverables**)**

Los entregables que se generarán son:

● Plan de pruebas ● Lista de escenarios de pruebas ejecutadas ● Informe de estado al finalizar cada sprint ● Reporte de defectos

**Gestión de incidentes (I**ncidents**)**

Se utilizará el siguiente workflow para la gestión de defectos:

![Image ds1-mtiv86o6::p5::img_p4_1](image_ds1-mtiv86o6::p5::img_p4_1.png)

La severidad será asignada por el tester y la prioridad por el product owner.

Las severidades que se utilizarán serán:

**Bloqueante** : cuando una funcionalidad no se pueda utilizar y no haya

otra forma de realizar esa misma acción.

**Crítica** : cuando una funcionalidad no se pueda utilizar pero exista un

camino alternativo para realizar eso mismo.


---

-** Alta**: cualquier defecto sobre una funcionalidad prioritaria del sistema o que tiene impacto secundario en una funcionalidad prioritaria del

mismo.

**Medio** : cualquier defecto que impacte en una funcionalidad

secundaria.

**Bajo** : cualquier defecto cosmético o errores de ortografía.

**Riesgos (R**isks**)**

---

---

Contingencia Horas extras pagas pruebas a

| Riesgo | Probabilidad | Impacto Mitigación |
| --- | --- | --- |
| No cumplir con las | baja | alto Monitoreo |

burndown

---

| Rotación del personal | medio | medio Equiparar |
| --- | --- | --- |
|  | sueldos |

Rotar a un miembro de otro proyecto por intereses Tercerizar Motivación del equipo Seguimiento individual


---

**Tareas (T**

asks**)**

![Image ds1-mtiv86o6::p7::img_p6_1](image_ds1-mtiv86o6::p7::img_p6_1.png)
