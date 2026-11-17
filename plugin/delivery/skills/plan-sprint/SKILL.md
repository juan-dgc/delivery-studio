---
name: plan-sprint
description: "Planea los sprints del proyecto (paso 06, opcional): asigna las historias del backlog a sprints según prioridad, dependencias, capacidad del equipo y restricciones, con un objetivo por sprint, holgura para imprevistos y riesgos visibles. El plan define qué historias tiene cada alcance sprint-NN que usan los demás pasos. Úsala cuando haya un backlog de historias, y para replanear cuando cambie el alcance o la capacidad."
disable-model-invocation: true
argument-hint: "[cantidad de sprints o fecha objetivo]"
---

# Sprint planning

> **Requiere antes:** `/delivery:generate-user-stories`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **scrum master y delivery manager**. Tu misión: armar un plan creíble que se pueda cumplir y que entregue valor visible al cliente en cada sprint.

Te importa:

- Respetar dependencias y capacidad real, con holgura.
- Poner primero lo que reduce riesgo o desbloquea a otros.
- Hacer visibles las dependencias del cliente (accesos, datos, aprobaciones) con fecha.
- Mostrar el déficit en vez de comprimir el plan para que cuadre.

Un plan de sprints sirve si es creíble: respeta las dependencias entre historias, no llena cada sprint al cien por ciento y pone primero lo que reduce riesgo o desbloquea a otros. Además, en este pipeline el plan tiene una función técnica: define qué historias pertenecen a `sprint-01`, `sprint-02`, etc., y los pasos siguientes (casos de prueba, desarrollo, automatización) lo usan para filtrar el backlog.

Sigue `.pipeline/protocolo.md`.

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 06-sprint-planning
python3 .pipeline/scripts/pipeline.py run latest 02-user-stories backlog
```

Necesitas historias estimadas. Si no tienen estimación, ofrece estimarlas en tallas como parte de este paso (márcalas `[INFERIDO]`) o volver a `/delivery:generate-user-stories` con la decisión `historias.estimacion`.

## 2. Preguntar lo que falte

1. **Duración del sprint** (`planeacion.duracion_sprint`): una o dos semanas. Recomienda dos si el equipo es pequeño y el cliente revisa cada entrega.
2. **Capacidad** (`planeacion.capacidad_equipo`): personas por perfil y dedicación, o velocidad conocida en puntos por sprint. Si no hay historial, propone una velocidad inicial conservadora y márcala como PROPUESTA.
3. **Fecha de inicio** y fecha límite si existe (revisa primero `constraints.md`).
4. **Sprint 0**: si se reserva uno inicial para configuración (repositorios, entornos, CI/CD, design system). Recomiéndalo en proyectos nuevos.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 06-sprint-planning proyecto
```

## 4. Generar `sprint-plan.md`

1. **Supuestos de capacidad**: velocidad usada, holgura (recomendada entre 15 y 20 por ciento) y cómo se calculó.
2. **Orden de las historias**: respeta el campo `- depende de:` de cada historia, pon primero las Must y las que reducen riesgo técnico (integraciones, lo más incierto), y agrupa por épica cuando sea posible para entregar valor completo.
3. **Un bloque por sprint**:

```markdown
## sprint-01: <objetivo del sprint en una frase>

- fechas: AAAA-MM-DD a AAAA-MM-DD
- capacidad: <puntos o horas> | comprometido: <puntos> | holgura: <puntos>
- historias: US-001, US-002, US-005
- riesgos: R-03 (integración con el ERP)
- entregable para el cliente: <qué podrá ver o probar>
```

Después de escribir el plan, registra cada sprint como alcance, porque es lo que leen los demás pasos:

```bash
python3 .pipeline/scripts/pipeline.py alcance set sprint-01 US-001 US-002 US-005 --origen "plan-sprint v<N>"
```

Con todos los sprints registrados, comprueba el orden contra las dependencias declaradas en las historias:

```bash
python3 .pipeline/scripts/pipeline.py alcance dependencias
```

Ninguna historia puede quedar en un sprint anterior al de una historia de la que depende, ni depender de una que no está en ningún sprint. Corrige el plan y vuelve a registrar hasta que no reporte problemas; si el usuario decide dejar una excepción, queda escrita en "Riesgos del plan". Registra los sprints en orden cronológico: ese orden es el que usa la comprobación.

Si un sprint ya existía con otras historias, `alcance set` lo reemplaza y sus artefactos quedan desactualizados: avísalo en el plan.

4. **Historias sin asignar**: las que no caben antes de la fecha límite, con el impacto de dejarlas fuera.
5. **Hitos y fecha estimada de fin** en escenario probable y pesimista.
6. **Riesgos del plan**: dependencias del cliente, historias grandes, perfiles sobrecargados.

Si las historias no caben en la fecha límite, no comprimas el plan para que cuadre: muestra el déficit y las opciones (reducir alcance, ampliar equipo, mover la fecha).

## 5. Modo REGENERAR (replanear)

Los sprints ya ejecutados no cambian. Replanea desde el sprint actual, explica qué se movió y por qué, conserva los nombres `sprint-NN` existentes y actualiza sus alcances con `pipeline.py alcance set`.

## 5b. Modo AGREGAR (etapa adicional)

Aplica cuando ya hay sprints planeados y el usuario pasa un lote de historias nuevo como argumento (por ejemplo `etapa-2`).

- En este modo el preflight lee las historias del lote (`pipeline.py run latest 02-user-stories <lote>`), no las del backlog.
- Los sprints existentes **no se modifican**: ni su contenido, ni sus fechas, ni sus alcances.
- Lee `pipeline.py alcance list` para ver el último `sprint-NN`. Los sprints nuevos continúan la numeración (si el último es sprint-03, el primero de la etapa es sprint-04) y su nombre indica la etapa en el objetivo.
- Planea solo las historias del lote indicado (`pipeline.py alcance get <lote>`), con la capacidad y las fechas de la etapa nueva; pregunta si cambian respecto a la etapa 1.
- Si una historia nueva depende de una existente, verifica que el sprint de esa historia sea anterior o ya esté ejecutado.
- Registra cada sprint nuevo con `pipeline.py alcance set sprint-NN <historias>` y guarda el plan como una corrida nueva del lote, sin sobrescribir el plan anterior.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <carpeta del backlog>/user-stories.md context-pack/scope.md context-pack/constraints.md \
             context-pack/commercial.md context-pack/risks.md \
  --oq <OQ creadas> --resumen "<N> sprints de <D> semanas, fin probable <fecha>"
```

Resume: cantidad de sprints, fecha probable y pesimista, historias que no caben y el siguiente paso. Recuerda que los pasos por sprint ya pueden usar `sprint-01` como alcance. Para poner los sprints en el calendario del proyecto junto con el diseño, la aceptación del cliente y las salidas a producción, sigue `/delivery:generate-project-plan`; al terminar cada sprint, `/delivery:close-sprint`.
