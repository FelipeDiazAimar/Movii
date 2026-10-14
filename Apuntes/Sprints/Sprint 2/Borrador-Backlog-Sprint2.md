# Borrador — Planificación Sprint Backlog 2 (Movii)

> Nota de trabajo (10/09/2026): NO es el entregable. Es el Backlog 2
> pre-armado con material existente, listo para pulir y pasar a formato
> formal. Espejo de `sprint backlog1.md` (5 secciones).
> El Informe de cierre se prepara en `Borrador-Docs-Sprint2.md`.

## 1. Objetivo del Sprint (propuesta)

Implementar el seguimiento completo del ciclo de vida del envío: transiciones
de estado (HU-06), incidencias con motivo y foto (HU-07), reprogramación de
fallidas (HU-09), confirmación con evidencia (HU-08) y tracking público
(HU-10), con su reflejo en la web operativa y la app móvil. Al final del
sprint, un repartidor podrá avanzar, fallar, confirmar y reprogramar entregas;
el operador lo gestionará desde la web y el cliente final lo verá por tracking.
**Alcance: completo, sin recortes (decisión 10/09). Duración: 14 días
(10/09 → 24/09, deadline autoimpuesto).**

## 2. Product Backlog priorizado (huella del Sprint 1, verificar cambios)

HU-01 a HU-05 cerradas (Sprint 1). Sprint 2: HU-06 (Alta), HU-07 (Alta),
HU-08 (Alta), HU-09 (Media), HU-10 (Media). Sprint 3: HU-11 a HU-15
(panel tiempo real, mapa, reportes, ranking, clasificación incidencias).
Fuente: tabla §2 de `sprint backlog1.md` — [ ] confirmar que no hubo
repriorización con el profe.

## 3. Fichas HU seleccionadas

Fuente: `Borrador-HU-Sprint2.md` (fichas HU-06/07/08/09/10 + matriz de
transiciones). [ ] **Ulises valida** los puntos marcados "A validar"
(CA-03 HU-07 foto opcional —YA RESUELTA: opcional—; CA-05 HU-08 doble
evento —implementado—; CA-03 HU-09 franja; CA-03 HU-10 recorte exacto).

## 4. Estimaciones de Valor y Esfuerzo (del borrador)

| HU | Título | SP | Valor | Responsable |
|---|---|:--:|:--:|---|
| HU-06 | Actualización de estado | 5 | 8 | Araya (API+web) / Díaz Aimar (móvil) |
| HU-07 | Entrega fallida + foto | 5 | 5 | Araya (API+web) / Díaz Aimar (móvil) |
| HU-08 | Confirmación firma+foto | 8 | 5 | Araya (API+web) / Díaz Aimar (móvil) |
| HU-09 | Reprogramación | 5 | 5 | Araya (API+web) / Díaz Aimar (móvil) |
| HU-10 | Tracking público | 3 | 5 | Araya (API+web) |
| Escalas Fibonacci/valor: copiar §4.1–4.2 del Backlog 1 (no cambian). |

## 5. Sprint Backlog — Desglose de tareas (de los planes de implementación)

Fuente: `docs/superpowers/plans/` (todos tildados al 10/09 salvo móvil).
Reparto: Araya = API + web + Supabase/DB + docs; Díaz Aimar = móvil.

- HU-06/07 API (`2026-09-10-api-hu06-hu07-*`): entorno local, dominio+matriz,
  EventoRepo, EstadoService (estado+incidencia), handlers+rutas+wiring,
  historial en detalle, E2E. ✅ hecho 10/09.
- HU-09 API (`...-hu09-*`): repo (Reprogramar, filtro fecha, limpieza al
  asignar), service, handler+ruta, detalle+E2E. ✅ hecho 10/09.
- HU-08 API (`...-hu08-*`): ConfirmacionRepo+matriz, ConfirmarEntrega,
  handler+binarios+wiring, metadata, foto HU-07 (migración 0005), E2E. ✅ 10/09.
- HU-10 API (`...-hu10-*`): eventos crear/asignar/desasignar, TrackingRepo+
  descripciones+service, handler+ruta pública, E2E. ✅ hecho 10/09.
- Web (`...-web-hu06-hu10-*`): tipos+schemas+api, timeline+detalle, acciones,
  tracking público. ✅ hecho 10/09.
- Foto incidencia (`...-hu07-ver-foto-*`): endpoint + flag + botón web. ✅ 10/09.
- Móvil (Felipe): tarjeta con acción (HU-06), incidencia (HU-07),
  confirmación con signature-pad (HU-08), reprogramar (HU-09). [ ] pedir
  desglose y avance a Felipe.
- Transversales: migraciones 0003/04/05 (✅), openapi (✅), push rama
  `feature/sprint2-seguimiento-tracking` ([ ] bloqueado: acceso GitHub),
  docs cátedra ([ ] este borrador + informe).

## 6. Faltantes para cerrar el documento formal

- [ ] Validación del borrador de fichas (Ulises + equipo)
- [ ] Desglose y horas estimadas del móvil (Felipe) + parte de Jeremías
- [ ] Escalas §4.1–4.2 (copiar del Backlog 1), portada/integrantes/fechas
- [ ] Pasar a .docx/.pdf como los entregables anteriores
