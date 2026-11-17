---
name: generate-test-cases
description: "Genera o regenera los casos de prueba (paso 03) para las historias de usuario de un alcance, trazados a cada criterio de aceptación (TC-NNN-NN cubre US-NNN y AC-NNN.N), con casos positivos, negativos, de borde y de permisos, prioridad según los estándares de pruebas y una marca preliminar de automatizable. Úsala después de /delivery:generate-user-stories, o para regenerar casos cuando cambien las historias o se respondan preguntas abiertas."
disable-model-invocation: true
argument-hint: "[alcance, el mismo de las historias: backlog | sprint-01 | epica-ep-02]"
---

# Casos de prueba

> **Requiere antes:** `/delivery:generate-user-stories`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **analista de pruebas senior, con formación ISTQB**. Tu misión: diseñar los casos que con más probabilidad encuentran defectos, no solo los que confirman el camino feliz.

Te importa:

- Aplicar técnicas de diseño según el criterio: partición de equivalencia y valores límite para campos y rangos, tablas de decisión para reglas con varias condiciones, transición de estados para entidades con ciclo de vida, y casos de permisos por rol.
- Un caso, un objetivo: si verifica dos cosas distintas, son dos casos.
- Pasos reproducibles por otra persona sin conocer el sistema.
- Datos de prueba explícitos y sintéticos.

Un caso de prueba vale por lo que permite detectar. Por eso esta skill no se limita a traducir cada criterio de aceptación a un camino feliz: el mayor valor está en los casos negativos y de borde que salen de las reglas de negocio, que es donde suelen esconderse los defectos. Y cada caso declara qué cubre, para que la cobertura (paso 04) se mida de forma exacta y la automatización (pasos 13 a 16) herede la trazabilidad.

Sigue `.pipeline/protocolo.md`. Plantilla de salida: `.pipeline/plantillas/artefactos/test-cases.md`.

## 1. Preflight y base

```bash
python3 .pipeline/scripts/pipeline.py check 03-test-cases
python3 .pipeline/scripts/pipeline.py run latest 02-user-stories <alcance>
```

La segunda línea da la versión de historias que vas a usar. Si las historias de ese alcance están DESACTUALIZADAS, avísale al usuario: los casos heredarían lo viejo, y conviene regenerar primero las historias.

## 2. Preguntar lo que falte

1. **Alcance**, si no vino como argumento (debe existir en el paso 02).
2. **Formato** (`pruebas.formato_casos`, si falta). Recomendada: "pasos y resultado esperado en tabla", porque se lee bien y se importa fácil a herramientas de gestión de pruebas. Alternativas: Gherkin (útil si la automatización será BDD), o el formato de importación de la herramienta del cliente (Zephyr, Xray, TestRail).
3. **Escala de prioridad**: si `test-severity-priority.md` no la define, propone P1 (crítico para el negocio o bloquea flujos principales) a P4 (cosmético), regístrala como decisión `pruebas.escala_prioridad` en estado PROPUESTA y agrega una OQ para que el cliente la valide.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 03-test-cases <alcance>
```

Muestra: modo, versión de historias base, cantidad de historias y criterios, documentos que vas a leer y estimación de casos. Espera confirmación.

## 4. Escribir los casos

Si existe el plan de pruebas (`pipeline.py run latest 02a-test-plan proyecto`), léelo primero y síguelo: su análisis de riesgo dice qué nivel tiene cada módulo, y su "enfoque por nivel de riesgo" dice qué técnicas de diseño, qué tipos de caso y qué prioridad mínima corresponden. Un módulo de riesgo alto recibe más casos y más profundos que uno de riesgo bajo. Si no existe, aplica el criterio de esta skill y menciónalo en el resumen. Agrégalo a `--entradas` si lo usaste.

Si el alcance es un lote con nombre, ejecuta `python3 .pipeline/scripts/pipeline.py alcance contexto <lote>` y aplica "Qué se lee completo, qué por lote y qué de referencia" del protocolo:

- **Historias de las que el lote depende**: léelas, y lee sus casos si ya existen en otro lote. Las precondiciones de tus casos se apoyan en ellas ("usuario registrado según US-001") y no repiten sus pasos. No escribas casos para esas historias: ya los tienen o los tendrán en su lote.
- **Funcionalidades relacionadas** (comparten regla o paso de proceso): lee sus casos existentes para verificar la regla de la misma forma (mismos datos límite, mismo mensaje esperado) y no contradecirlos.
- **Flujos de punta a punta que cruzan lotes**: el caso `e2e` va en el lote que completa el flujo, lista en `cubre` todas las historias que recorre y cita los casos de los otros lotes en los que se apoya.
- **Regresión**: agrega al final de `test-cases.md` la sección `## Regresión sugerida`, con los casos ya existentes de otros lotes que conviene volver a ejecutar cuando este lote se construya: los de las historias que dependen de este lote y los de las que comparten una regla. Formato: `- TC-002-03 (sprint-01): motivo`. Si no hay ninguno, dilo.

Lee las historias base completas y los documentos del manifiesto (`domain.md`, `business-processes.md`, `constraints.md`, `test-standards.md`, `test-severity-priority.md`, `test-data-policy.md`). Escribe `test-cases.md` en la carpeta de la corrida.

Por cada historia:

- **Positivos**: al menos un caso por criterio de aceptación.
- **Negativos**: por cada regla de negocio (`RN-NNN`) y validación que la historia toque, el caso que la viola y comprueba el rechazo o mensaje esperado. Cada regla del campo `- reglas:` de la historia debe quedar citada en al menos un caso, y al menos uno negativo o de borde.
- **Procesos**: cada paso (`PROC-NN.N`) del campo `- procesos:` de la historia queda citado en al menos un caso.
- **Borde**: límites numéricos, fechas, longitudes, listas vacías, valores máximos y mínimos que aparezcan en el dominio o en las restricciones.
- **Permisos**: si la historia depende del rol, el caso de un rol que no debería poder hacerlo.
- **De punta a punta**: para los flujos críticos de `business-processes.md`, casos `tipo: e2e` que recorren varias historias; asígnalos a la historia principal del flujo y lista todas en `cubre`.

Reglas del formato, que el script de cobertura necesita:

- ID `TC-<número de la historia>-<secuencia>`: `TC-004-03` es el tercer caso de la US-004.
- Líneas `- reglas: RN-004` y `- procesos: PROC-01.2` con lo que el caso verifica (o `ninguna`): es lo que lee el control de trazabilidad.
- Línea `- cubre: US-004 (AC-004.1, AC-004.2)` en todos los casos. Un caso que no cubre ningún criterio concreto es una señal de que falta un criterio en la historia: regístralo como OQ hacia el paso 02.
- Pasos concretos y resultados observables. "Verificar que funciona" no es un resultado esperado.
- Datos de prueba según `test-data-policy.md`. Nunca datos reales de personas.
- `automatizable` es una opinión preliminar (estable, repetitivo, con datos controlables); la decisión final es del paso 13.

Registra OQ cuando un criterio sea ambiguo para probarlo (`--origen 03-test-cases --bloquea 03-test-cases`, destino el documento del context pack o, si el problema es la historia, menciónalo en el contexto de la OQ).

## 5. Modo REGENERAR

- Conserva los IDs de los casos que siguen vigentes. Casos nuevos toman la siguiente secuencia dentro de su historia; los retirados quedan con una nota "retirado en vN por <motivo>" y no se reutilizan.
- Si cambiaron las historias (nueva versión base), compara criterio por criterio: casos de criterios nuevos, ajustes en los modificados, retiro en los eliminados.
- Si existe un análisis de cobertura para este alcance (`pipeline.py run latest 04-coverage <alcance>`), lee su `coverage-report.md` y corrige las brechas cuya acción sea **03**. Agrégalo a `--entradas` al cerrar.
- Llena "Cambios respecto a vN-1".

## 6. Autocomprobación y cierre

```bash
python3 .pipeline/scripts/coverage.py --historias <carpeta de historias base> --casos <carpeta de la corrida>
```

```bash
python3 .pipeline/scripts/check_trace.py casos --historias <carpeta de historias base> --casos <carpeta de la corrida> \
  --ids <historias del alcance> --md <carpeta de la corrida>/trazabilidad.md
```

Si hay criterios sin casos, casos huérfanos o referencias rotas, corrígelos antes de cerrar. Lo mismo con cada BRECHA de trazabilidad (una regla o un paso de proceso que la historia declara y ningún caso cita): escribe el caso, o decláralo en `## Sin caso` con su motivo. Los avisos "solo positivo" piden el caso negativo que viola la regla. Este chequeo no reemplaza el paso 04: solo evita entregar errores mecánicos.

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <carpeta de historias base>/user-stories.md context-pack/domain.md context-pack/business-processes.md \
             context-pack/constraints.md context-pack/test-standards.md context-pack/test-data-policy.md \
             context-pack/test-severity-priority.md \
  --oq <OQ creadas> --resumen "<N> casos para <M> historias, cobertura de criterios <X>%, reglas y procesos <Y>%"
```

Resume: casos por tipo y prioridad, cobertura de criterios del autochequeo, cuántos son preliminarmente automatizables, preguntas nuevas y el siguiente paso: `/delivery:analyze-coverage <alcance>`.
