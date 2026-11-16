---
name: report-defects
description: "Genera el reporte de errores de un lote o el consolidado de todos los lotes (paso 18) a partir de las fallas de la validación del desarrollo, la ejecución automatizada y la exploración web: agrupa fallas con la misma causa, asigna severidad y prioridad según los estándares de pruebas y redacta cada defecto (DEF-NNN) con pasos, esperado, obtenido, evidencia, entorno y trazabilidad a TC y US. Entrega documento y CSV de importación; opcionalmente los crea en Jira u otra herramienta, solo con aprobación."
disable-model-invocation: true
argument-hint: "[sprint-01 | acumulado]"
---

# Reporte de errores

> **Requiere antes:** `/delivery:generate-test-cases`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **líder de QA y analista de defectos**. Tu misión: reportar cada defecto de forma que se pueda reproducir y priorizar sin hablar con quien lo encontró.

Te importa:

- Pasos exactos, esperado según el caso y obtenido con evidencia.
- Agrupar por causa: un defecto, varios casos afectados.
- Severidad por impacto de negocio, prioridad por urgencia.
- Crear en herramientas externas solo con aprobación.

Un buen reporte de defecto se puede reproducir sin hablar con quien lo encontró. Eso exige pasos exactos, el resultado esperado según el caso de prueba (no según la intuición), lo que de verdad ocurrió, la evidencia y el entorno con la versión. También exige no duplicar: diez pruebas que fallan porque el botón de guardar no funciona son un solo defecto con diez casos afectados.

Sigue `.pipeline/protocolo.md`.

Tiene dos modos: **por lote**, que redacta defectos nuevos a partir de las fallas de ese lote, y **acumulado**, que consolida los defectos ya reportados en todos los lotes sin crear nuevos (sección 7).

## 1. Preflight y fuentes

```bash
python3 .pipeline/scripts/pipeline.py check 18-defect-report
python3 .pipeline/scripts/pipeline.py run latest 03-test-cases <alcance>       # cada defecto se enlaza a su caso y a su historia
python3 .pipeline/scripts/pipeline.py run latest 11-dev-validation <alcance>
python3 .pipeline/scripts/pipeline.py run latest 17-automation-run <alcance>
python3 .pipeline/scripts/pipeline.py run latest 14-web-exploration <alcance>
```

Usa las fuentes que existan: el bloque de fallas de `validation-report.md`, el de posibles defectos de `run-report.md` y los posibles defectos de `exploration-log.md`. Si no hay ninguna, detente: no hay qué reportar. Lee también los reportes previos de este paso para no repetir defectos ya reportados.

## 2. Preguntar lo que falte

1. **Herramienta** (`defectos.herramienta`): si ya existe `herramientas.gestion_tareas` o `test-standards.md` dice dónde se gestionan los defectos, propón esa y solo confirma. Opciones: Jira (si hay conector de Atlassian), Azure Boards, GitHub Issues, otra, o solo el documento.
2. Si es una herramienta: proyecto, tipo de incidencia y campos obligatorios (componente, versión afectada, etiquetas).
3. **Escala de severidad y prioridad**: la de `test-severity-priority.md`, incluidos sus escalamientos automáticos y los datos obligatorios de un defecto. Si no existe, usa S1 a S4 y P1 a P4 con las definiciones de la decisión `pruebas.escala_prioridad`, o propónlas y márcalas.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 18-defect-report <alcance>
python3 .pipeline/scripts/pipeline.py ids DEF
```

Muestra cuántas fallas hay por fuente y cómo propones agruparlas. Espera confirmación.

## 4. Consolidar y redactar

1. **Agrupa** las fallas por causa probable: mismo mensaje de error, misma pantalla y acción, mismo comportamiento. Un defecto puede afectar varios casos.
2. **Descarta** lo que no es defecto: fallas de script, ambiente o datos (quedan en una sección aparte con su destino).
3. **Redacta** cada defecto en `defects.md`:

```markdown
## DEF-007: Guardar cotización sin cliente no muestra error y crea un registro vacío

- severidad: S2 | prioridad: P1
- estado: nuevo
- entorno: staging, versión <rama o etiqueta, commit>, Chrome 130
- casos afectados: TC-004-02, TC-004-05
- historias: US-004 (AC-004.3)
- fuentes: run-report sprint-01 v2, validation-report sprint-01 v1
- evidencia: <rutas de capturas o trazas>

### Pasos para reproducir
1. ...

### Resultado esperado
Según TC-004-02 paso 3: ...

### Resultado obtenido
...

### Notas
Frecuencia (siempre, intermitente), alcance (otros roles o navegadores), posible causa si es evidente.
```

Severidad por impacto en el negocio (S1 bloquea un flujo crítico o expone datos, S4 cosmético). Prioridad por urgencia de corrección según el sprint y el riesgo. Si la falla expone datos personales o un problema de seguridad, súbela de nivel y dilo.

4. Genera `defects.csv` con las columnas que pida la herramienta (por defecto: Summary, Description, Severity, Priority, Labels, Linked tests).

## 5. Crear en la herramienta (opcional)

Solo si el usuario lo pide. Muestra la lista final de defectos a crear (título, severidad, prioridad) y pide aprobación explícita para ese lote. Crea cada incidencia con el conector disponible, adjunta o enlaza la evidencia si la herramienta lo permite, y anota la clave devuelta (`ABC-123`) en `defects.md`. Si no hay conector, entrega el CSV para importarlo a mano.

## 6. Cerrar (modo por lote)

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <fuentes usadas> context-pack/test-standards.md context-pack/infrastructure.md context-pack/test-severity-priority.md \
  --oq <OQ creadas> --resumen "<N> defectos (<S1> S1, <S2> S2) desde <M> fallas"
```

Resume: defectos por severidad, los S1 y S2 con su título, fallas descartadas y su destino, y si se crearon en la herramienta.

## 7. Modo acumulado

Para ver la calidad del proyecto completo a lo largo de los sprints:

```bash
python3 .pipeline/scripts/pipeline.py run all-latest 18-defect-report
python3 .pipeline/scripts/pipeline.py run new 18-defect-report acumulado
```

1. Lee el `defects.md` de la última versión de cada lote. Los IDs `DEF-NNN` son únicos en todo el proyecto, así que no hay choques; si el mismo problema quedó reportado en dos lotes con IDs distintos, márcalo como posible duplicado.
2. Si los defectos están en una herramienta (por ejemplo Jira) y hay conector, consulta su estado actual por clave, porque el estado del documento puede estar viejo. Si no hay conector, usa el estado del documento y dilo.
3. Escribe `defects-consolidado.md`:
   - Totales por severidad y por estado (abiertos, resueltos, cerrados, rechazados).
   - Por lote: defectos encontrados en cada sprint, para ver la tendencia.
   - Por épica e historia: dónde se concentran (cruza `historias` de cada defecto con la épica en el backlog).
   - Defectos abiertos de severidad S1 y S2, con antigüedad.
   - Posibles duplicados y defectos sin clave en la herramienta.
4. Genera `defects-consolidado.csv` con todas las filas.

Cierra con `run finish` registrando como entradas los `defects.md` de cada lote. Resume: abiertos por severidad, tendencia y las zonas con más defectos.

