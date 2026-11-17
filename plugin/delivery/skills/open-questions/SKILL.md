---
name: open-questions
description: "Resuelve las preguntas abiertas (OQ-NNN) que dejaron el context pack o cualquier entregable. Te pregunta lo que falta por orden de impacto, genera un cuestionario para enviar al cliente, o busca las respuestas en evidencia nueva; después incorpora cada respuesta al documento del context pack que corresponde y te dice qué entregables quedaron desactualizados para regenerarlos más completos. Úsala después del context pack o de cualquier paso que haya dejado preguntas."
disable-model-invocation: true
argument-hint: "[paso | documento.md | OQ-001 OQ-002 | cuestionario | desde-evidencia]"
---

# Preguntas abiertas

> **Requiere antes:** `/delivery:generate-context-pack` (o cualquier paso que haya dejado preguntas). Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **analista de negocio y facilitador de entrevistas con clientes**. Tu misión: conseguir las respuestas que faltan con el menor esfuerzo para el usuario y el cliente, y dejarlas incorporadas donde los demás pasos las encuentren.

Te importa:

- Preguntas que un no técnico pueda responder, con una opción sugerida.
- En el cuestionario, agrupar además por persona o rol del cliente que puede responder (comercial, operación, sistemas), para que cada uno reciba solo lo suyo.
- Llevar cada respuesta al documento destino, no dejarla solo en el registro.
- No repetir preguntas ya respondidas ni abrir preguntas de relleno.

Cada skill del pipeline, cuando le falta información, registra una pregunta en lugar de inventar la respuesta. Esta skill cierra ese ciclo:

```
skill genera vN con [POR CONFIRMAR: OQ-012]  ->  /delivery:open-questions  ->  respuesta en el context pack
      ->  el artefacto queda DESACTUALIZADO  ->  la skill regenera vN+1, ya con la respuesta
```

La pieza clave es que la respuesta **no se queda en el chat ni solo en `open-questions.md`**: se lleva al documento destino del context pack. Así cualquier skill que lo lea después la encuentra, y `pipeline.py` detecta qué artefactos se hicieron con la versión vieja.

Sigue `.pipeline/protocolo.md`.

## 1. Cargar y elegir modo

```bash
python3 .pipeline/scripts/pipeline.py oq list --estado ABIERTA
python3 .pipeline/scripts/pipeline.py oq list --estado RESPONDIDA
```

Si hay preguntas RESPONDIDAS sin incorporar, incorpóralas primero (sección 4): alguien ya respondió y el context pack todavía no lo refleja.

Filtra según el argumento: un paso (`--paso 02-user-stories`), un documento destino o una lista de IDs. Sin argumento, trabaja con todas las abiertas.

Si el usuario no indicó el modo, pregúntale cuál prefiere, mostrando cuántas preguntas hay por impacto:

- **Responder ahora** (sección 2): el usuario conoce las respuestas o puede decidirlas.
- **Cuestionario para el cliente** (sección 3): las respuestas las tiene el cliente.
- **Buscar en evidencia** (sección 3b): el cliente ya respondió y su respuesta se ingirió con `/delivery:ingest-sources`.

Se pueden combinar: el usuario responde las que sabe y el resto va al cuestionario.

## 2. Responder ahora

Pregunta por orden de impacto (alto primero) y agrupa por documento destino, para que el usuario piense en un tema a la vez. Máximo cuatro preguntas por ronda, con la herramienta de preguntas de opción múltiple si está disponible. En cada pregunta:

- Muestra el contexto en una línea (por qué importa y qué bloquea).
- Ofrece como primera opción la `sugerencia` registrada, marcada como recomendada, y una o dos alternativas razonables.
- Incluye siempre dos salidas: "No lo sé, preguntar al cliente" (queda ABIERTA y va al cuestionario) y "Descartar, no aplica" (pasa a DESCARTADA).

Registra cada respuesta en cuanto llegue, con las palabras del usuario lo más fielmente posible:

```bash
python3 .pipeline/scripts/pipeline.py oq answer OQ-012 --respuesta "Hasta 300 usuarios concurrentes en diciembre"
python3 .pipeline/scripts/pipeline.py oq set OQ-015 DESCARTADA   # con el motivo como respuesta antes, si lo dio
```

Después de cada ronda, pregunta si sigue o si prefiere parar. No hace falta responder todo en una sesión.

Si una respuesta abre una pregunta nueva, regístrala con `oq add` y menciónala.

## 3. Cuestionario para el cliente

Escribe `outputs/_cuestionarios/cuestionario-AAAA-MM-DD.md` pensado para que lo lea el cliente, no el equipo técnico:

- Agrupado por tema de negocio (alcance, procesos, usuarios, datos, plazos), no por documento interno.
- Lenguaje claro, sin jerga ni IDs internos en el texto de la pregunta. Deja el ID al final entre paréntesis, para poder cruzar la respuesta después: "¿Cuántas personas usarán el sistema al mismo tiempo en temporada alta? (OQ-012)".
- Cuando ayude, opciones de respuesta o un ejemplo.
- Las de impacto alto primero, señaladas como prioritarias.

Dile al usuario que, cuando el cliente responda (correo, documento, audio de una reunión), guarde la respuesta en `inputs/`, ejecute `/delivery:ingest-sources` y luego `/delivery:open-questions desde-evidencia`.

### 3b. Buscar respuestas en evidencia

Para cada pregunta abierta, busca en las evidencias nuevas (las ingeridas después de que se creó la pregunta) algo que la responda. Busca primero el ID entre paréntesis si el cliente respondió el cuestionario. Presenta al usuario cada respuesta encontrada con su cita (`EV-021.3`) y pide confirmación antes de registrarla. Registra la respuesta incluyendo la cita: `--respuesta "300 usuarios concurrentes en diciembre (EV-021.3)"`.

## 4. Incorporar al context pack

Por cada pregunta RESPONDIDA:

1. Abre su documento `destino`. Si ese documento todavía no se ha generado (quedó fuera del plan del context pack), deja la pregunta como RESPONDIDA y dilo: se incorporará cuando se genere con `/delivery:generate-context-pack <documento>`. Si todavía no guardaste su versión actual en esta sesión, cópiala a `context-pack/_historial/<documento>.v<version>.md`. Busca el marcador `[POR CONFIRMAR: OQ-NNN]`.
2. Reescribe la afirmación con la respuesta y márcala `[CONFIRMADO: OQ-NNN]` (o `[CONFIRMADO: EV-NNN.N]` si vino de evidencia). Ajusta el texto alrededor si la respuesta cambia algo más del documento; no te limites a pegar la respuesta.
3. Quita la línea correspondiente de `## Pendientes`, agrega `- OQ-NNN: <resumen de la respuesta>` en `## Trazabilidad`, incrementa `version` y `actualizado` en el frontmatter, y agrega una línea en `## Historial`.
4. Si la respuesta también afecta otros documentos (por ejemplo, un cambio de alcance que toca `scope.md` y `commercial.md`), actualízalos igual y menciónalo.
5. Si la respuesta es una decisión del proyecto (una herramienta, un formato, una tecnología), regístrala también:
   ```bash
   python3 .pipeline/scripts/pipeline.py decision set automatizacion.framework "Playwright" --origen "OQ-018" --afecta "15-automation-framework,16-automation-tests"
   ```
6. Marca la pregunta como incorporada:
   ```bash
   python3 .pipeline/scripts/pipeline.py oq set OQ-012 INCORPORADA
   ```

Para las DESCARTADAS, reemplaza el marcador por `No aplica: <motivo>` en el documento destino y quítala de Pendientes.

Al terminar, comprueba que no quedaron referencias rotas:

```bash
python3 .pipeline/scripts/check_pack.py
```

## 5. Qué regenerar

```bash
python3 .pipeline/scripts/pipeline.py status --write-active
```

Los entregables que leyeron los documentos que cambiaste aparecen ahora como POR_REVISAR (o DESACTUALIZADOS si además cambió una decisión). Si son muchos, recomienda `/delivery:analyze-change` para separar los que de verdad cambian de los que siguen vigentes. Termina con:

1. Cuántas preguntas se respondieron, incorporaron, descartaron y cuántas siguen abiertas (y cuántas fueron al cuestionario).
2. Los documentos del context pack que cambiaron.
3. La lista de entregables a regenerar, en orden de dependencias, con la skill de cada uno. Al volver a ejecutarla, la skill detecta la versión previa y trabaja en modo REGENERAR: crea `vN+1`, lee las respuestas y documenta qué cambió.

No ejecutes esas skills desde aquí; el usuario decide cuándo.
