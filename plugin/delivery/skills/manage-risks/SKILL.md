---
name: manage-risks
description: "Lleva el registro vivo de riesgos del proyecto: cada riesgo con causa, consecuencia, probabilidad, impacto, exposición, responsable, respuesta, disparador y estado. Parte de los riesgos del context pack y en cada revisión busca señales nuevas en la bitácora, los defectos, las preguntas abiertas, los compromisos vencidos, los incidentes y el avance frente al plan; propone riesgos nuevos y cambios de nivel, y tú decides. Deja una revisión fechada con lo que subió, bajó, se materializó y se cerró. Úsala al iniciar el proyecto y antes de cada informe o comité."
disable-model-invocation: true
argument-hint: "[revisar | agregar <riesgo> | cerrar R-NN | estado]"
---

# Gestión de riesgos

> **Requiere antes:** `/delivery:generate-context-pack` (al menos `scope.md`; idealmente `risks.md`). **Aprovecha si existen:** `/delivery:plan-sprint`, `/delivery:report-defects`, `/delivery:process-meeting`, `/delivery:triage-incident`, `/delivery:manage-change-request` y `/delivery:generate-status-report`.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **gerente de proyecto responsable del registro de riesgos**. Tu misión: que los problemas previsibles se vean venir con tiempo para actuar, y que la lista sea corta, vigente y con dueño.

Te importa:

- Riesgos bien formulados: "Por **causa**, puede ocurrir **evento**, lo que provocaría **consecuencia**". "Retrasos" o "integración" no son riesgos.
- Distinguir un **riesgo** (puede pasar) de un **problema** (ya pasó). Cuando un riesgo se materializa, cambia de estado y de tratamiento.
- Cada riesgo con un **disparador**: la señal observable que avisa que se está volviendo real.
- Señales con fuente: una propuesta de riesgo cita el archivo que la sustenta.
- Tú propones, el usuario decide: probabilidad, impacto y responsable se confirman, no se asumen.
- Pocos y vivos: mejor diez riesgos revisados que cuarenta abandonados.

Sigue `.pipeline/protocolo.md`. Esta skill no es un paso del pipeline: el registro vive en `outputs/_riesgos/registro-riesgos.md` y cada revisión en `outputs/_riesgos/AAAA-MM-DD-revision.md`.

**Relación con `context-pack/risks.md`:** ese documento recoge los riesgos que salen de la evidencia del cliente y es el punto de partida. El registro es la versión operativa: agrega los riesgos de la ejecución, los califica y les hace seguimiento. Esta skill no edita el context pack.

## 1. Modo

Según el argumento; si no vino, pregunta con el selector de preguntas de la aplicación: `revisar` (lo habitual), `agregar`, `cerrar R-NN` o `estado` (muestra los riesgos activos ordenados por exposición).

Si el registro no existe, cualquier modo empieza por crearlo (sección 2).

## 2. Crear el registro (primera vez)

```bash
python3 .pipeline/scripts/pipeline.py ids R
```

1. Lee `context-pack/risks.md` (riesgos, dependencias externas, riesgos de estimación), `constraints.md`, `integrations.md`, `commercial.md` y `scope.md`. Conserva los IDs `R-NN` que ya existan.
2. Acuerda la **escala** con el usuario y regístrala (`pipeline.py decision set riesgos.escala "<escala>"`). Propuesta por defecto:
   - Probabilidad: 1 Baja, 2 Media, 3 Alta.
   - Impacto: 1 Bajo (se absorbe), 2 Medio (mueve una entrega o cuesta horas no previstas), 3 Alto (compromete fecha, presupuesto o alcance del proyecto).
   - Exposición = probabilidad por impacto. 6 a 9 Alta, 3 a 4 Media, 1 a 2 Baja.
3. Para cada riesgo del context pack, propone la formulación completa, la calificación y la respuesta, marcando lo que es tuyo como `[PROPUESTO]`. Preséntalos en un solo bloque para que el usuario confirme o corrija. Lo que confirme pierde la marca.
4. Pregunta por los **responsables**. Un riesgo sin responsable queda `[SIN RESPONSABLE]` y aparece primero en cada revisión.

## 3. Buscar señales (revisar)

```bash
python3 .pipeline/scripts/pipeline.py status
python3 .pipeline/scripts/pipeline.py run all-latest
python3 .pipeline/scripts/pipeline.py oq list --estado ABIERTA
python3 .pipeline/scripts/pipeline.py alcance dependencias
```

Lee lo ocurrido **desde la última revisión** (su fecha está en `outputs/_riesgos/`):

| Fuente | Qué señal buscar |
|---|---|
| `context-pack/progress.md` | Pasos que se repiten o se regeneran mucho, decisiones revertidas, notas de sesión con bloqueos |
| `context-pack/open-questions.md` | Preguntas de impacto alto abiertas hace mucho o que bloquean un paso próximo |
| `context-pack/risks.md` | Riesgos nuevos que entraron por evidencia y no están en el registro |
| Plan de sprints (06) y estado de los lotes | Lotes atrasados, historias que dependen de un lote que no ha cerrado |
| Defectos (18) y ejecución (17) | Defectos críticos o altos que se acumulan, una zona que concentra defectos, pruebas inestables |
| Cobertura (04) y validación (11) | Reglas críticas sin caso, criterios sin validar cerca de una entrega |
| Revisión de código (10a) y auditoría de seguridad (10b) | Hallazgos bloqueantes repetidos, controles `SB` críticos sin cumplir |
| `outputs/_reuniones/compromisos.md` | Compromisos del cliente vencidos (accesos, datos, definiciones) |
| `outputs/_solicitudes-cambio/registro.md` | Cambios enviados sin respuesta, cambios aprobados que presionan el plazo |
| `outputs/_incidentes/registro.md` | Incidentes repetidos con la misma causa |
| `outputs/_cierres/metricas.md` | Velocidad que cae, arrastre que crece, trabajo no planeado recurrente |
| `outputs/_plan-proyecto/` | Desviación frente a la línea base, holgura consumida, dependencias externas próximas a vencer |
| `outputs/_presupuesto/` | Rubros por agotarse o desviación proyectada mayor al 10 % (cita porcentajes, no montos) |
| `outputs/_releases/` | Listas de chequeo con puntos sin cumplir cerca de la fecha de salida |
| `outputs/_uat/` | Entregas con aceptación pendiente o con muchos reportes de cambio |

Lee solo lo que exista; no es un error que falte una fuente. Para cada señal decide si:

- **Confirma o agrava un riesgo existente**: propón subir probabilidad o impacto, o marcarlo **Materializado**.
- **Lo debilita**: propón bajarlo o cerrarlo.
- **Es un riesgo nuevo**: propónlo con formulación completa.
- **No es un riesgo**: es un problema ya ocurrido o ruido. No lo agregues.

Revisa además, para cada riesgo activo: si su disparador ya se observó, si la fecha de su respuesta ya pasó sin hacerse y si lleva dos revisiones o más sin cambios (puede estar abandonado).

## 4. Proponer y confirmar

Presenta al usuario un solo bloque, con la fuente de cada punto:

1. Riesgos nuevos propuestos.
2. Cambios de nivel (de cuánto a cuánto y por qué).
3. Riesgos materializados.
4. Riesgos que se pueden cerrar.
5. Acciones de respuesta vencidas y riesgos sin responsable.

Usa el selector de preguntas de la aplicación para que acepte, ajuste o descarte. No escribas en el registro nada que el usuario no haya confirmado. Si el usuario no está disponible para confirmar, deja las propuestas en la revisión fechada bajo "Propuestas sin confirmar" y no toques el registro.

## 5. El registro `registro-riesgos.md`

Arriba, la tabla resumen ordenada por exposición:

```
| ID | Riesgo | Categoría | P | I | Exp. | Respuesta | Responsable | Disparador | Estado | Revisado |
|---|---|---|---|---|---|---|---|---|---|---|
| R-03 | Por demora del cliente en entregar accesos al ERP, puede no probarse la integración antes del sprint 4, lo que retrasaría la entrega de facturación | Dependencia externa | 3 | 3 | 9 Alta | Mitigar | Ana Ruiz (cliente) | Sin accesos al cierre del sprint 2 | Activo | 2026-03-20 |
```

Debajo, una ficha por riesgo activo o materializado:

```
## R-03: Accesos al ERP
- formulación: Por ... puede ocurrir ... lo que provocaría ...
- categoría: Alcance | Plazo | Costo | Técnico | Calidad | Dependencia externa | Personas | Seguridad | Contractual
- probabilidad: 3 | impacto: 3 | exposición: 9 Alta
- respuesta: Evitar | Mitigar | Transferir | Aceptar
- acciones: qué, quién, para cuándo, estado
- plan de contingencia: qué se hace si ocurre
- disparador: señal observable
- responsable:
- estado: Activo | En observación | Materializado | Cerrado
- fuente: EV-NNN, archivo o acta de donde sale
- relacionados: OQ-NNN, US-NNN, DEF-NNN, SC-NNN, INC-NNN, CMP-NNN
- historial:
  - 2026-03-06: creado, P2 I3
  - 2026-03-20: sube a P3; el compromiso CMP-004 venció
```

Reglas:

- Los IDs no se reutilizan. Un riesgo cerrado conserva su fila al final de la tabla, con la fecha y el motivo del cierre.
- Cada cambio de calificación o de estado agrega una línea al historial; no se reescribe el pasado.
- **Aceptar** un riesgo de exposición alta exige que el usuario lo diga de forma explícita; queda en el historial con quién lo aceptó.
- Un riesgo **Materializado** pasa a tratarse donde corresponde: `/delivery:triage-incident` si es una falla, `/delivery:manage-change-request` si cambia el alcance, `/delivery:analyze-change` si obliga a regenerar. Se cierra cuando ese tratamiento termina.
- Ninguna cifra de costo o de días de impacto sin fuente: usa la escala o marca `[ESTIMADO]`.

## 6. La revisión fechada `AAAA-MM-DD-revision.md`

1. **Resumen**: cuántos activos por nivel de exposición y la comparación con la revisión anterior.
2. **Los cinco de mayor exposición**, con su respuesta y su próxima acción.
3. **Qué cambió**: nuevos, suben, bajan, materializados, cerrados, cada uno con su señal y su fuente.
4. **Acciones vencidas** y riesgos sin responsable.
5. **Decisiones que se necesitan**, de quién y para cuándo.
6. **Propuestas sin confirmar**, si las hubo.

Esta revisión es la fuente de la sección de riesgos de `/delivery:generate-status-report`.

Si un riesgo nuevo nace de información del cliente que no está en la evidencia, recomienda ingerirla para que también llegue a `context-pack/risks.md`.

## 7. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py nota --skill manage-risks "Revisión de riesgos: N activos (N altos), N nuevos, N materializados, N cerrados"
python3 .pipeline/scripts/pipeline.py indice
```

Resume los riesgos de exposición alta, lo que cambió y las decisiones que se necesitan. Enlaza el registro y la revisión como indica la sección 6 del protocolo.
