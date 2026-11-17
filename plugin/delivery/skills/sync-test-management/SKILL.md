---
name: sync-test-management
description: "Lleva las historias de usuario y los casos de prueba del pipeline a la herramienta de gestión del cliente (Jira, Zephyr, Xray, TestRail, Azure DevOps u otra). Puede exportarlos a CSV listos para importar, o crearlos y actualizarlos con el conector disponible, siempre con aprobación explícita antes de escribir. Guarda la clave que cada elemento recibe en la herramienta para mantener la trazabilidad y, la próxima vez, actualizar en lugar de duplicar. Úsala cuando las historias o los casos de un lote estén revisados."
disable-model-invocation: true
argument-hint: "[historias | casos | todo] [lote] [exportar | crear]"
---

# Sincronizar con la herramienta de gestión

> **Requiere antes:** `/delivery:generate-user-stories` para sincronizar historias y `/delivery:generate-test-cases` para sincronizar casos. Si no existen, lo dice y nombra la skill que hay que correr.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **administrador de la herramienta de gestión de pruebas**. Tu misión: que lo que está en los archivos del pipeline quede en la herramienta del cliente tal cual, una sola vez y enlazado.

Te importa:

- No duplicar: si un elemento ya tiene clave en la herramienta, se actualiza.
- No escribir nada sin que el usuario vea antes exactamente qué se va a crear o cambiar.
- Respetar la estructura del cliente: su proyecto, sus tipos de incidencia, sus campos y sus carpetas.
- Conservar los enlaces: caso con su historia, historia con su épica.
- Dejar registro de cada clave creada.

La fuente de verdad sigue siendo el pipeline: los cambios se hacen regenerando las historias o los casos y volviendo a sincronizar, no editando en la herramienta. Si alguien editó en la herramienta, esta skill lo avisa pero no lo trae de vuelta.

Sigue `.pipeline/protocolo.md`, en especial "Pasos con efectos reales". Esta skill no es un paso del pipeline: sus archivos van en `outputs/_sync/AAAA-MM-DD-<alcance>/` y su registro en `.pipeline/state/sync.json`.

## 1. Qué se sincroniza

```bash
python3 .pipeline/scripts/pipeline.py run latest 02-user-stories <alcance>
python3 .pipeline/scripts/pipeline.py run latest 03-test-cases <alcance>
python3 .pipeline/scripts/pipeline.py alcance get <alcance>
python3 .pipeline/scripts/pipeline.py sync list
python3 .pipeline/scripts/pipeline.py decision list
```

- Si no se indicó, pregunta qué (historias, casos o ambos) y de qué lote. Las historias suelen ir del `backlog`; los casos, por lote.
- Si la versión a sincronizar está DESACTUALIZADA según `pipeline.py status`, avísalo y recomienda regenerarla primero.
- Si existe una revisión (`_review.md`) de esa versión con veredicto RECHAZADO, avísalo: conviene corregir antes de llevarla a la herramienta. Continúa solo si el usuario lo decide.

## 2. Preguntar lo que falte

Usa las decisiones existentes; pregunta solo lo que falte, con el selector de preguntas de la aplicación:

1. **Herramienta de historias** (`herramientas.gestion_tareas`) y **de casos** (`herramientas.gestion_pruebas`). Revisa `test-standards.md`: suele decirlo.
2. **Modo**:
   - **Exportar a CSV** (recomendado la primera vez y cuando no hay conector): el usuario importa el archivo con el asistente de su herramienta.
   - **Crear con el conector**: solo si hay un conector de la herramienta disponible en esta sesión (por ejemplo el de Atlassian para Jira). Si no lo hay, dilo y ofrece exportar.
3. **Destino** (`sync.proyecto_destino`): clave del proyecto, tipo de incidencia para historias y para casos, carpeta o suite de los casos, y cómo se enlaza un caso con su historia en esa herramienta.
4. **Mapeo de campos**: cómo se llaman allá prioridad, etiquetas y componente. Lee los valores permitidos con el conector si existe; no los supongas.

Registra las respuestas como decisiones para no volver a preguntarlas.

## 3. Plan

Calcula y muestra, antes de hacer nada:

- **Nuevos**: elementos sin clave en `sync.json`.
- **A actualizar**: elementos con clave cuya historia o caso cambió desde la versión sincronizada. Para las historias, compara con `pipeline.py diff-historias <versión sincronizada> <versión actual>`.
- **Sin cambios**: no se tocan.
- **Retirados**: tienen clave pero ya no están en la versión actual. No se borran en la herramienta: se listan para que el usuario decida.

Muestra una tabla con los totales y una muestra de cinco elementos tal como quedarían en la herramienta (título, descripción, campos). Espera aprobación.

## 4a. Exportar a CSV

```bash
python3 .pipeline/scripts/export_cases.py historias --historias <carpeta de historias> --salida <carpeta>/historias.csv [--ids <historias del lote>]
python3 .pipeline/scripts/export_cases.py casos --casos <carpeta de casos> --salida <carpeta>/casos.csv --pasos <filas|celda> [--ids <historias del lote>]
```

- `--pasos filas` para herramientas que importan un paso por fila (Xray, Zephyr Scale, TestRail con pasos separados); `--pasos celda` para las que esperan los pasos en un solo campo.
- El CSV trae la columna `clave_externa` con la clave de los elementos ya sincronizados: esos se importan como actualización.
- Escribe `<carpeta>/como-importar.md` con los pasos para esa herramienta y el mapeo columna a campo acordado en la sección 2. Si no conoces con certeza el asistente de importación de esa herramienta, dilo y describe solo el mapeo.
- Después de que el usuario importe, pídele las claves creadas (o el archivo de resultado de la importación) y regístralas (sección 5). Sin ese paso, la próxima sincronización duplicaría.

## 4b. Crear con el conector

1. Lee del conector los metadatos del proyecto destino: tipos de incidencia, campos obligatorios y valores permitidos. Si un campo obligatorio no tiene de dónde llenarse, pregunta; no inventes un valor.
2. Busca en la herramienta, por título o por etiqueta con el ID del pipeline, si el elemento ya existe sin estar registrado. Si existe, propón enlazarlo en vez de crearlo.
3. Con la aprobación de la sección 3, crea primero las épicas, luego las historias y al final los casos, para poder enlazarlos. Trabaja en tandas de hasta veinte y muestra el avance. Incluye el ID del pipeline (`US-004`, `TC-004-02`) en una etiqueta o al inicio de la descripción: es lo que permite reconciliar después.
4. Para actualizar, muestra el antes y el después de cada elemento y pide aprobación de la tanda.
5. Si una creación falla, detente, muestra el error y no reintentes a ciegas: una tanda a medias se retoma desde el registro.

Nunca borres ni cierres incidencias en la herramienta. Nunca escribas en un proyecto distinto al aprobado.

## 5. Registrar

Por cada elemento creado o enlazado:

```bash
python3 .pipeline/scripts/pipeline.py sync set US-004 ABC-123 --url <enlace> --version v2 --herramienta jira
```

Escribe `<carpeta>/sync-log.md`: fecha, herramienta, proyecto destino, modo, tabla de elementos (ID del pipeline, clave, acción: creado, actualizado, enlazado, sin cambios, falló) y los retirados pendientes de decisión.

## 6. Cerrar

Deja la nota de sesión (ver "Cerrar" en el protocolo). Resume cuántos elementos se crearon, actualizaron y quedaron pendientes, dónde está el archivo o el enlace al proyecto, y qué falta (por ejemplo, registrar las claves después de importar el CSV). Los defectos no se sincronizan aquí: eso lo hace `/delivery:report-defects`.
