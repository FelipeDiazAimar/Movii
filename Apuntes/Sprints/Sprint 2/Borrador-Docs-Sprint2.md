# Borrador — Preparación docs Sprint 2 (Movii)

> Nota de trabajo (10/09/2026): NO es el entregable. Es la lista de lo que
> el documento formal del Sprint 2 necesita + los datos ya reunidos, para
> redactarlo rápido. Estructura espejo del doc de Sprint 1
> (`Sprint1 - Araya_Diaz-Aimar_Micheloud.md`, 9 secciones).

## 1. Qué debe contener (checklist)

- [ ] Objetivo del Sprint (HU-06 a HU-10, alcance completo 10/09, deadline 24/09)
- [ ] Product Backlog priorizado + modificaciones durante el sprint
- [ ] Estimaciones (las del borrador: HU-06 5 SP, HU-07 5 SP, HU-09 5 SP, HU-08 8 SP, HU-10 3 SP)
- [ ] Sprint Backlog por HU con tareas + horas est/real (FALTAN las horas diarias: registrar día por día de acá en más)
- [ ] Modelo de datos: migraciones 0003 (eventos), 0004 (evidencias + reprogramación), 0005 (foto incidencia)
- [ ] Implementación por HU (API + web + móvil)
- [ ] Testing (suites + conteos — ver §3)
- [ ] Cronograma y burndown (FALTA: necesita log diario desde el 10/09)
- [ ] DoD + convenciones (revisar §8-9 del doc Sprint 1: develop+PRs sigue sin definirse con el equipo)
- [ ] Retrospectiva (incluir seguimiento de las 5 acciones del Sprint 1)

## 2. Datos ya reunidos (parte Ulises, API + web)

Horas reales Ulises (10/09, registrar en planilla):

| Bloque | Real (hs) |
|---|:--:|
| Task 0 entorno + HU-06/07 API | 1 |
| HU-09 API | 0.5 |
| HU-08 API + foto HU-07 | 0.5 |
| HU-10 API | 0.5 |
| Web Sprint 2 (detalle + acciones + tracking) | 1 |
| Foto incidencia (endpoint + botón web) | 0.5 |
| **Subtotal Ulises 10/09** | **4** |

Commits Sprint 2 (rama `feature/sprint2-seguimiento-tracking`, 12, sin pushear al 10/09):

```
6a70219 Postgres local Docker · eef8c74 migraciones 0003/0004 ·
707a6aa openapi seguimiento/tracking · 4c903ff plan HU-06/07 ·
70fd724 borrador fichas · fdceb4f gitignore override local ·
4146e6f HU-06+07 · d1f3b79 HU-09 · b031708 HU-08 + foto HU-07 ·
19e6804 HU-10 · 8917c5c web Sprint 2 · 4007403 ver foto incidencia
```

Planes de implementación (docs/superpowers/plans/): HU-06/07, HU-09, HU-08, HU-10, web, HU-07-foto — todos tildados.

## 3. Conteos de tests (extraer antes de redactar)

```bash
cd gestion-envios/services/api && go test ./... -p 1 -count=1 -v 2>&1 | grep -c -- '--- PASS'
cd gestion-envios/apps/web && npm test 2>&1 | tail -3
# móvil: pedir número a Felipe (Sprint 1: 82 API + 19 móvil)
```

## 4. Faltantes / bloqueos (pedir al equipo)

- [ ] Horas y avance móvil de Felipe (CA móviles de HU-06/07/09/08) + su número de tests
- [ ] Parte de Jeremías (¿qué HU/documentos lleva en Sprint 2?)
- [ ] Acceso de escritura para Ulises en `FelipeDiazAimar/Movii` (push 10/09 → 403) o decisión de fork
- [ ] Definir `develop` + PRs (DoD) antes de mergear la rama del Sprint 2
- [ ] Validar borrador de fichas (`Borrador-HU-Sprint2.md`: CA-03 HU-07, CA-05 HU-08 y otros "A validar")
- [ ] Aviso por Discord por migraciones 0003/04/05 antes del push/merge
