---
name: close-sprint
description: "Cierra un sprint: compara lo comprometido con lo terminado historia por historia, calcula la velocidad y los indicadores de calidad del sprint, decide con tu aprobación qué pasa con lo que no se terminó, prepara la revisión con el cliente y la retrospectiva del equipo, y lleva el registro de métricas entre sprints y de acciones de mejora. Los datos salen de los reportes del pipeline y de lo que tú confirmes; no asume qué se terminó. Úsala al final de cada sprint, antes de planear el siguiente."
disable-model-invocation: true
argument-hint: "[lote, por ejemplo sprint-03] [cierre | revision | retro]"
---

# Cierre de sprint

> **Requiere antes:** `/delivery:plan-sprint` (el sprint existe como lote con sus historias). **Aprovecha si existen:** `/delivery:validate-development`, `/delivery:run-automated-tests`, `/delivery:report-defects`, `/delivery:review-code`, `/delivery:analyze-coverage`, `/delivery:process-meeting` y `/delivery:plan-uat`.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **facilitador ágil con mirada de QA**. Tu misión: que el sprint se cierre con un balance honesto y que el siguiente empiece mejor informado.

Te importa:

- "Terminado" significa lo que el proyecto definió: construido, revisado, probado y, si aplica, aceptado. Una historia casi lista no está terminada y no suma a la velocidad.
- Datos con fuente: cada historia terminada lo demuestra un reporte o lo confirma el usuario.
- Lo no terminado se decide, no se arrastra por inercia: continúa, se parte, vuelve al backlog o se descarta.
- Una retrospectiva que termina en pocas acciones con responsable, y que revisa las de la anterior.
- Sin maquillar: si la velocidad cayó o los defectos subieron, se dice y se busca la causa.

Sigue `.pipeline/protocolo.md`. Esta skill no es un paso del pipeline: el cierre de cada sprint va en `outputs/_cierres/<lote>/`, las métricas acumuladas en `outputs/_cierres/metricas.md` y las acciones de mejora en `outputs/_cierres/acciones-mejora.md`.

## 1. Sprint y modo

Si no vino como argumento, pregunta con el selector de preguntas de la aplicación el lote (`pipeline.py alcance list`) y el modo: `cierre` (todo), `revision` (solo el material para la revisión con el cliente) o `retro` (solo la retrospectiva).

## 2. Reunir los hechos

```bash
python3 .pipeline/scripts/pipeline.py alcance get <lote>
python3 .pipeline/scripts/pipeline.py alcance contexto <lote>
python3 .pipeline/scripts/pipeline.py run latest 06-sprint-planning backlog
python3 .pipeline/scripts/pipeline.py run latest 11-dev-validation <lote>
python3 .pipeline/scripts/pipeline.py run latest 17-automation-run <lote>
python3 .pipeline/scripts/pipeline.py run latest 18-defect-report <lote>
python3 .pipeline/scripts/pipeline.py run latest 10a-code-review <lote>
python3 .pipeline/scripts/pipeline.py status
```

Lee del plan de sprints el bloque del lote (objetivo, fechas, capacidad, comprometido), las historias con su estimación, y de cada reporte que exista: qué historias validaron, casos ejecutados y su resultado, defectos por severidad y estado, hallazgos de la revisión. Lee también `context-pack/progress.md` del periodo y los compromisos de `outputs/_reuniones/compromisos.md` que vencían en el sprint.

Es normal que falten reportes: usa los que haya y di cuáles no existen.

**Definición de terminado.** Búscala en `decisions.md` (`sprint.definicion_terminado`) o en `test-standards.md`. Si no existe, propón una (implementada, revisada sin hallazgos bloqueantes, criterios validados, sin defectos críticos o altos abiertos) y pide confirmación; regístrala.

## 3. Estado de cada historia

Arma la tabla con lo que los reportes demuestran:

| Historia | Estimación | Implementada | Revisada | Validada | Defectos abiertos | Estado propuesto | Fuente |
|---|---|---|---|---|---|---|---|

Estados: **Terminada**, **Terminada con pendientes menores** (cuenta solo si la definición lo permite), **Incompleta**, **No iniciada**, **Retirada del sprint**.

Preséntala al usuario y pide que confirme o corrija. Los reportes pueden estar atrasados frente a la realidad, y solo él sabe lo que pasó fuera del pipeline. Lo que el usuario cambie queda con fuente "confirmado por el usuario". Si el proyecto lleva el estado en una herramienta de gestión con conector disponible, ofrece leerlo de ahí (solo lectura).

También registra lo que **entró** al sprint después de planearlo (historias agregadas, incidentes atendidos, cambios): es trabajo real que explica desviaciones.

## 4. Lo no terminado

Para cada historia incompleta o no iniciada, propón una salida con su motivo y deja que el usuario decida:

- **Continúa en el siguiente sprint** con el esfuerzo restante estimado por el equipo (pregúntalo; no lo calcules tú).
- **Se parte**: lo terminado se cierra y lo que falta pasa como historia nueva. Eso cambia el backlog: `/delivery:generate-user-stories backlog`.
- **Vuelve al backlog** sin fecha.
- **Se descarta**, con quién lo decidió.

No muevas historias entre lotes: el replaneo lo aplica `/delivery:plan-sprint`. Deja la lista de movimientos acordados lista para usarla ahí. Avisa si una historia que se mueve tiene otras que dependen de ella (`pipeline.py alcance dependencias`).

## 5. Métricas

Calcula con los datos confirmados, mostrando la cuenta:

- **Comprometido y terminado** (en la unidad del proyecto) y porcentaje de cumplimiento.
- **Velocidad** del sprint y promedio de los últimos tres (de `metricas.md`).
- **Trabajo no planeado** que entró.
- **Calidad**: defectos encontrados en el sprint por severidad, abiertos al cierre, defectos por historia terminada, casos ejecutados y porcentaje que pasa, criterios validados, hallazgos bloqueantes de la revisión de código.
- **Arrastre**: historias que vienen de sprints anteriores y cuántos sprints llevan.

Agrega la fila a `outputs/_cierres/metricas.md` (créalo si no existe), sin tocar las anteriores:

```
| Sprint | Fechas | Comprometido | Terminado | % | Velocidad | No planeado | Defectos (C/A/M/B) | Abiertos al cierre | % casos que pasan | Arrastre |
|---|---|---|---|---|---|---|---|---|---|---|
```

Una métrica sin dato se deja como "sin dato", no en cero. Con menos de tres sprints, no hables de tendencia.

## 6. Documento `cierre-sprint.md`

1. **Resumen**: objetivo del sprint y si se cumplió, en dos líneas.
2. **Comprometido frente a terminado**: la tabla de historias confirmada.
3. **Qué recibe el cliente**: lo demostrable, en lenguaje de negocio.
4. **Lo no terminado** y la decisión tomada para cada historia.
5. **Métricas** del sprint y comparación con los anteriores.
6. **Causas de la desviación**, si la hubo, cada una con su evidencia (bloqueos del cliente, estimación corta, defectos, trabajo no planeado, ausencias). Lo que sea opinión se marca como tal.
7. **Impacto en el plan**: con la velocidad real, si las fechas del plan del proyecto siguen siendo alcanzables. Si no, recomienda `/delivery:generate-project-plan actualizar`.
8. **Riesgos y bloqueos** que pasan al siguiente sprint (para `/delivery:manage-risks`).
9. **Para planear el siguiente**: capacidad sugerida según la velocidad, movimientos acordados, dependencias pendientes.

## 7. Revisión con el cliente `revision-sprint.md`

Guion de la demostración: qué historias se muestran y en qué orden (por flujo de negocio, no por ID), con qué datos, quién presenta, qué se le pide al cliente (retroalimentación, aceptación, decisiones pendientes) y lo que no se alcanzó, dicho de frente. Solo se demuestra lo terminado. Lo que el cliente diga en la revisión lo recoge `/delivery:process-meeting`; si la entrega requiere aceptación formal, `/delivery:plan-uat`.

## 8. Retrospectiva `retrospectiva.md`

Si el usuario trae notas o la grabación de la retrospectiva, trabaja sobre ellas. Si la quiere preparar, entrega la guía:

1. **Acciones de la retrospectiva anterior** (`acciones-mejora.md`): cuáles se cumplieron y si sirvieron.
2. **Datos del sprint** como insumo: las métricas y las causas de desviación.
3. **Qué funcionó, qué no, qué probar distinto**: propón preguntas concretas a partir de los datos (por ejemplo, "tres historias esperaron accesos del cliente: ¿qué haríamos distinto al planear?"). Las respuestas son del equipo; no las escribas por ellos.
4. **Acciones**: máximo tres, cada una con responsable, fecha y cómo se sabrá que funcionó.

Registra las acciones acordadas en `outputs/_cierres/acciones-mejora.md`:

```
| ID | Acción | Responsable | Fecha | Origen | Estado | Resultado |
|---|---|---|---|---|---|---|
| AM-001 | Pedir los accesos una semana antes de iniciar el sprint | Líder técnico | 2026-04-01 | sprint 2 | Abierta | |
```

Si una acción cambia una regla de trabajo (un estándar, la definición de terminado), dilo: debe llegar a las decisiones o al context pack para que las skills la apliquen. La retrospectiva es del equipo: no va al cliente ni al informe de avance.

## 9. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py nota --skill close-sprint "<lote>: terminado N de N comprometido, velocidad N, N historias pasan al siguiente"
python3 .pipeline/scripts/pipeline.py indice
```

Resume el cumplimiento, lo que pasa al siguiente sprint y si el plan sigue en pie. Sigue con `/delivery:plan-sprint` para el siguiente y, si toca reportar, `/delivery:generate-status-report sprint <lote>`. Enlaza cada archivo como indica la sección 6 del protocolo.
