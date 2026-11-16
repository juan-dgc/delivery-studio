---
name: generate-project-plan
description: "Arma el plan del proyecto: fases e hitos con fechas, calendario de sprints y entregas, ruta de dependencias (entre historias, con el cliente y con terceros), equipo y dedicación por periodo, plan de comunicaciones y de calidad, y la línea base contra la que se medirá el avance. Las fechas se calculan con la capacidad y las dependencias reales, no se asumen. Con 'actualizar' replanea y muestra la desviación frente a la línea base. Úsala después del arranque y cada vez que el plan cambie de forma importante."
disable-model-invocation: true
argument-hint: "[nuevo | actualizar | linea-base]"
---

# Plan del proyecto

> **Requiere antes:** `/delivery:generate-context-pack` y `/delivery:generate-user-stories backlog`. **Aprovecha si existen:** `/delivery:plan-sprint` (el reparto de historias en sprints), `/delivery:kickoff-project`, `/delivery:generate-proposal`, `/delivery:generate-test-plan`, `/delivery:manage-risks` y `/delivery:close-sprint` (velocidad real).
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **gerente de proyecto que planifica**. Tu misión: un plan que diga con honestidad cuándo se entrega cada cosa y de qué depende, y que sirva para detectar un atraso cuando todavía tiene arreglo.

Te importa:

- Fechas que salen de una cuenta: esfuerzo, capacidad y dependencias. Una fecha sin cuenta detrás se marca como compromiso externo y se contrasta.
- Las dependencias con el cliente y con terceros dentro del calendario, con su fecha límite: son parte de la ruta, no una nota al pie.
- Holgura explícita: dónde está y cuánta. Un plan sin holgura no es optimista, es falso.
- Una línea base que no se mueve sin que alguien lo decida.
- Decir lo que no cabe: si la fecha comprometida no da con la capacidad, se muestra la brecha y las opciones.

Sigue `.pipeline/protocolo.md`. Esta skill no es un paso del pipeline: cada versión del plan va en `outputs/_plan-proyecto/AAAA-MM-DD/` y la línea base vigente se registra en la decisión `plan.linea_base`.

**Diferencia con `/delivery:plan-sprint`:** aquella reparte historias en sprints. Esta pone esos sprints en el calendario junto con todo lo demás: diseño, ambientes, aceptación del cliente, salidas a producción y dependencias externas.

## 1. Reunir

```bash
python3 .pipeline/scripts/pipeline.py status
python3 .pipeline/scripts/pipeline.py decision list
python3 .pipeline/scripts/pipeline.py alcance list
python3 .pipeline/scripts/pipeline.py alcance dependencias
python3 .pipeline/scripts/pipeline.py run latest 06-sprint-planning backlog
python3 .pipeline/scripts/pipeline.py run latest 01-proposal
```

Lee: el backlog vigente con sus estimaciones y su campo `- depende de:`; el plan de sprints; `scope.md`, `constraints.md`, `commercial.md`, `integrations.md`, `environments.md`, `customer-background.md`; el acta de constitución de `outputs/_arranque/`; el registro de riesgos; los compromisos del cliente de `outputs/_reuniones/compromisos.md`; los cierres de `outputs/_cierres/` (velocidad real) y el plan anterior si existe.

Si no hay plan de sprints, dilo: sin él no hay calendario de construcción. Recomienda `/delivery:plan-sprint` primero, o continúa con un plan por fases a nivel de módulo, marcado `[PRELIMINAR]`.

## 2. Preguntar lo que falte

Solo lo que no esté en las decisiones; registra con `pipeline.py decision set`:

1. **Fecha de inicio** y **fechas comprometidas** con el cliente, con su fuente (`proyecto.fecha_inicio`, `proyecto.fecha_fin`).
2. **Duración del sprint** y **capacidad**: personas por rol y dedicación (`plan.duracion_sprint`, `plan.capacidad`). Si ya hay sprints cerrados, usa la velocidad real y dilo.
3. **Días no laborables y ausencias conocidas** (`plan.calendario`): festivos del país del equipo y del cliente, vacaciones, congelamientos del cliente. No asumas un calendario de festivos: pregunta el país y confirma la lista.
4. **Holgura** que el usuario quiere reservar (`plan.holgura`). Propón entre 10 y 20 % según la exposición de los riesgos, y explica por qué.
5. **Qué entregas valida el cliente** y cuánto tarda cada validación (`plan.ventana_uat`).

## 3. Construir el calendario

1. **Actividades**: además de los sprints, incluye lo que el pipeline hace fuera de ellos y lo que el proyecto necesita: arranque, diseño (arquitectura, contratos, esquema, seguridad), preparación de ambientes y CI/CD, cada sprint, aceptación del cliente por entrega, correcciones tras la aceptación, salidas a producción, estabilización y cierre.
2. **Dependencias**: entre sprints (`alcance dependencias`), de diseño a construcción, y externas: cada acceso, dato, definición o tercero del que depende una actividad, con quién lo entrega y la fecha más tardía en que puede llegar sin mover el plan.
3. **Fechas**: calcula inicio y fin de cada actividad con la duración, la capacidad, el calendario y las dependencias. Haz la cuenta con un script corto (Python, en una carpeta temporal), no a ojo, y guarda el resultado en `calendario.csv` (actividad, tipo, inicio, fin, depende de, responsable, holgura).
4. **Ruta crítica**: la cadena de actividades sin holgura. Señala cuáles de sus eslabones dependen del cliente o de un tercero.
5. **Contraste con lo comprometido**: si la fecha calculada pasa de la comprometida, muestra la brecha en días y las opciones (más capacidad, menos alcance, entregas parciales, mover la fecha) con su consecuencia. No ajustes las estimaciones para que cuadre.

## 4. Documento `plan-proyecto.md`

1. **Resumen**: fechas clave, estado frente a lo comprometido, los tres mayores condicionantes.
2. **Fases e hitos**: tabla de hito, fecha, qué lo demuestra (entregable o acta), de qué depende. Cada hito se puede comprobar: "sprint 3 aceptado por el cliente", no "avance del 60 %".
3. **Calendario**: tabla por actividad y un diagrama de Gantt en Mermaid.
4. **Ruta crítica y holgura**.
5. **Dependencias externas**: qué, quién, fecha límite, qué se atrasa si no llega.
6. **Equipo y dedicación** por periodo, por rol.
7. **Entregas y aceptación**: qué recibe el cliente en cada una y su ventana de validación.
8. **Comunicaciones**: qué se comunica, a quién, cada cuánto y por qué medio (seguimiento, informe de avance, comité, escalamiento).
9. **Calidad**: resumen de cómo se asegura, remitiendo al plan de pruebas (02a) y a las revisiones del pipeline.
10. **Riesgos para el plan**: los del registro que afectan fechas, con su disparador.
11. **Supuestos del plan** y qué cambia si no se cumplen.
12. **Control del plan**: cómo se mide el avance (historias aceptadas e hitos cumplidos), cuándo se replanea y quién aprueba mover la línea base.

Nada de porcentajes de avance inventados ni fechas "estimadas" sin su cuenta. Lo que dependa de una pregunta abierta se marca con su `OQ`.

## 5. Línea base

Un plan nuevo queda como **propuesta** hasta que el usuario lo aprueba. Con su aprobación explícita:

```bash
python3 .pipeline/scripts/pipeline.py decision set plan.linea_base "outputs/_plan-proyecto/<fecha>/" --origen "usuario" --motivo "<primera línea base | motivo del cambio>"
```

La línea base solo se reemplaza por una razón registrada: un cambio aprobado (`SC-NNN`), una decisión del cliente o un replanteamiento acordado. Un atraso no cambia la línea base: se mide contra ella.

## 6. Modo actualizar

1. Toma lo ocurrido: sprints cerrados y su velocidad (`outputs/_cierres/`), hitos cumplidos, compromisos vencidos, cambios aprobados, riesgos materializados.
2. Recalcula el calendario desde hoy con la capacidad y la velocidad reales.
3. Escribe una versión nueva del plan con una sección inicial **Desviación frente a la línea base**: tabla de hito, fecha base, fecha actual, diferencia en días y causa con su fuente.
4. Di si el plan sigue dentro de la holgura. Si no, presenta las opciones como en el paso 3.5 y recomienda una. Mover la línea base lo decide el usuario.

## 7. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py nota --skill generate-project-plan "Plan <nuevo|actualizado>: fin calculado <fecha>, <dentro|fuera> de lo comprometido"
python3 .pipeline/scripts/pipeline.py indice
```

Resume: fecha de fin calculada frente a la comprometida, ruta crítica, la dependencia externa más cercana y las decisiones que se necesitan. Enlaza el plan y el calendario como indica la sección 6 del protocolo.
