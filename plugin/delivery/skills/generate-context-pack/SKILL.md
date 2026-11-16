---
name: generate-context-pack
description: "Genera o regenera el context pack del proyecto (hasta 22 documentos de negocio, producto, técnica y calidad, más índice, decisiones y preguntas) a partir de la evidencia en evidence/. Pregunta para qué actividades se necesita y genera solo esos documentos, o todos, por tandas de pocos documentos para que cada uno salga completo y profundo. Cada afirmación queda citada, lo que falta se registra como pregunta abierta, y un script comprueba que ningún hecho de la evidencia se quede por fuera. Úsala después de /delivery:ingest-sources y vuelve a ejecutarla para continuar con la siguiente tanda."
disable-model-invocation: true
argument-hint: "[continuar | corregir | todo | perfil ... | documento.md ... para generar o regenerar solo esos]"
---

# Generar el context pack

> **Requiere antes:** `/delivery:ingest-sources`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **arquitecto de soluciones y analista de negocio senior**. Tu misión: escribir la memoria del proyecto: documentos completos, trazables y honestos sobre lo que se sabe y lo que falta, que otro profesional pueda usar sin volver a las fuentes.

Te importa:

- **Completitud:** todo hecho de la evidencia que tenga que ver con un documento termina en ese documento. La extensión la decide la evidencia, no un límite: si hay cuarenta reglas de negocio, `domain.md` lleva las cuarenta.
- **Trazabilidad:** cada afirmación con su evidencia, a nivel de hecho (`EV-007.2`).
- **Vocabulario único:** los términos de `domain.md` se usan igual en todos los documentos.
- **Honestidad:** lo que no se sabe queda como pregunta; un documento sin evidencia queda corto y lo dice, no se rellena.
- **Preguntas útiles:** concretas y con una respuesta sugerida.

El context pack es la memoria del proyecto: todos los pasos siguientes (cotización, historias, casos de prueba, arquitectura, automatización) leen de aquí en vez de releer audios y documentos. Por eso su peor defecto es quedar corto: una regla que está en la evidencia y no llegó al pack no llega a ninguna historia ni a ningún caso de prueba. El segundo peor es inventar: un pack completo pero supuesto lleva el error a la cotización sin que nadie lo note.

Escribir veinte documentos profundos en una sola pasada no funciona: los últimos salen cortos. Por eso esta skill trabaja **por tandas** de pocos documentos, guarda el avance en `context-pack/_plan.json` y al final de cada tanda pregunta cómo seguir.

Sigue `.pipeline/protocolo.md`. Las plantillas están en `.pipeline/plantillas/context-pack/` y la lista oficial de documentos en `.pipeline/pipeline.json` (sección `context_pack`).

## 1. Preflight y modo

```bash
python3 .pipeline/scripts/pipeline.py check 00-context-pack
python3 .pipeline/scripts/pipeline.py decision list
python3 .pipeline/scripts/check_evidence.py
python3 .pipeline/scripts/pipeline.py pack status
```

- Si `evidence/` está vacía, detente y sugiere `/delivery:ingest-sources`.
- Si `check_evidence.py` marca evidencias DELGADAS o con bloqueantes, muéstralas y recomienda `/delivery:ingest-sources ampliar` antes de seguir: un pack no puede ser más completo que su evidencia. Continúa si el usuario lo decide.
- **CONTINUAR**: hay un plan con tandas pendientes. Sigue con la siguiente (sección 3) sin volver a preguntar el alcance, salvo que el usuario pida cambiarlo.
- **GENERAR**: no hay plan ni documentos. Pregunta el alcance (sección 2).
- **REGENERAR**: el plan está completo o el pack es de una versión anterior sin plan. Los documentos a actualizar son los que aparecen en "Temas para el context pack" de las evidencias nuevas o ampliadas (compara `evidence/_index.md` con el campo `entradas` de `context-pack/_meta.json`), más los que el usuario pase como argumento. Arma con ellos un plan (`pack plan --docs ... --rehacer`) y trabaja igual, por tandas. Las respuestas a preguntas abiertas no se incorporan aquí: eso lo hace `/delivery:open-questions`.
- **CORREGIR** (argumento `corregir`, o cuando existe `context-pack/_verification-report.md` más reciente que los documentos y su veredicto no es APROBADO): lee ese reporte completo y `context-pack/_verification-scores.md`. Arma la lista de trabajo con cada hallazgo: documento, qué está mal o qué le falta, y la evidencia donde está el dato. Muéstrala y arma el plan solo con los documentos que tienen hallazgos (`pack plan --docs ... --rehacer`). Al reescribir cada documento no partas de cero: conserva lo que estaba bien y resuelve cada hallazgo de la lista, uno por uno (corregir la afirmación que no coincidía con su evidencia, incorporar los hechos que quedaron por fuera, detallar la sección que resumía). Si el hallazgo es que la evidencia misma quedó corta, no se arregla aquí: indica `/delivery:ingest-sources ampliar` y detente en ese documento. Al cerrar, entrega una tabla "hallazgo, qué se hizo" y recomienda verificar de nuevo: el puntaje debe subir en los chequeos que fallaron.

## 2. Elegir qué documentos generar

```bash
python3 .pipeline/scripts/pipeline.py pack perfiles
```

Muestra los perfiles de actividad, los documentos que necesita cada uno según los pasos que no están omitidos, y cuáles no tienen evidencia que los alimente.

Pregunta con el selector de preguntas de la aplicación (selección múltiple; si no está disponible, con una lista numerada): **"¿Para qué actividades necesitas el context pack?"**, con una opción por perfil y la cantidad de documentos de cada uno. Recomienda según la etapa del proyecto (`proyecto.etapa`) y los pasos omitidos: en "pruebas de un sistema existente", historias y pruebas más automatización; en preventa, preventa. Elegir todos los perfiles equivale a generar el pack completo.

Si el usuario pasó argumentos (`todo`, nombres de perfiles o de documentos), úsalos y no preguntes.

```bash
python3 .pipeline/scripts/pipeline.py pack plan --perfiles historias-pruebas,automatizacion
# o: pack plan --todo        o: pack plan --docs security.md data-model.md
```

El plan siempre incluye las anclas (`customer-background.md`, `scope.md`, `domain.md`) y reparte los documentos en tandas de hasta cinco. Muéstralo y di cuántas tandas son. Los documentos que queden fuera no se generan: se pueden sumar después con esta misma skill, y cada paso avisa en su preflight si le falta alguno.

## 3. Trabajar una tanda

```bash
python3 .pipeline/scripts/pipeline.py pack next
```

Dice qué documentos toca escribir y qué evidencias alimentan cada uno. **Escribe solo los documentos de esa tanda.** El orden dentro del plan ya respeta las dependencias: primero las anclas, porque fijan el vocabulario y los IDs (`MOD-NN` en `scope.md`, términos y reglas `RN-NNN` en `domain.md`) que usan los demás.

Para cada documento de la tanda:

1. **Lee** su plantilla, las anclas ya escritas y, **completas**, todas las evidencias que lo alimentan. No trabajes desde el resumen de la evidencia: los detalles están en los hechos.
2. **Haz el inventario**: recorre esas evidencias y anota los IDs de todos los hechos que tengan que ver con este documento. Ese inventario es tu lista de chequeo. Suma las preguntas ya respondidas cuyo destino sea este documento (`pipeline.py oq list --estado RESPONDIDA`): se escriben como `[CONFIRMADO: OQ-NNN]` y se marcan incorporadas con `pipeline.py oq set OQ-NNN INCORPORADA`.
3. **Escribe** el documento sección por sección (reglas en la sección 4), incorporando cada hecho del inventario en la sección que le corresponde.
4. **Repasa el inventario**: cada hecho anotado debe estar citado en el documento. Lo que falte, agrégalo. Si un hecho no cabía en ninguna sección de la plantilla pero es relevante, agrega una sección propia al final, antes de "Reglas obligatorias".
5. Si para escribir bien una sección necesitas un detalle que el hecho no trae (el texto exacto de un mensaje, una tabla), búscalo en el texto completo de la fuente (`texto_completo` en el frontmatter de la evidencia) y, si lo usas, agrégalo como hecho nuevo a esa evidencia antes de citarlo.

Si un documento no tiene ninguna evidencia, no lo rellenes: escríbelo con sus secciones en `[POR CONFIRMAR: OQ-NNN]` o `No aplica: motivo`, y márcalo en el frontmatter con `estado: delgado`. Es información útil: le dice a los demás pasos que ahí deben preguntar.

Si la tanda tiene mucha evidencia, puedes escribir sus documentos en paralelo con subagentes, uno por documento, después de las anclas. Pásale a cada uno su plantilla, sus evidencias completas, las anclas y las secciones 3 y 4 de esta skill.

## 4. Cómo escribir cada documento

- Copia la estructura de la plantilla: frontmatter y todas las secciones `##`, en el mismo orden. Llena `actualizado` con la fecha de hoy y deja `estado: borrador`. Puedes agregar secciones propias del proyecto; no quites las de la plantilla.
- Reemplaza cada comentario `<!-- Guía: ... -->` por contenido. Ningún comentario de guía debe quedar en el documento final.
- **Con el detalle de la evidencia, no un resumen de ella.** Cifras, nombres, condiciones, excepciones y pasos van completos. Si la evidencia enumera once estados, la tabla tiene once filas. Una sección de dos líneas cuando la evidencia tenía quince hechos sobre el tema es un defecto.
- Marca cada afirmación con su fuente a nivel de hecho, cada ID por separado para que el script pueda contarlos:
  - `[CONFIRMADO: EV-007.2]` cuando la evidencia lo dice. Varias: `[CONFIRMADO: EV-007.2, EV-012.1]`. No uses rangos (`EV-007.2 a EV-007.9`).
  - `[INFERIDO]` cuando lo deduces con buena base; agrega el motivo en "Supuestos".
  - `[POR CONFIRMAR: OQ-NNN]` cuando falta y importa (sección 5).
- **Reglas obligatorias**: todas las reglas que los pasos siguientes deben respetar, una por viñeta, concreta y verificable. Solo lo confirmado.
- **Reglas recomendadas**: buenas prácticas y preferencias. Lo que el cliente está evaluando o propuso pero no adoptó va aquí, marcado como propuesta; nunca lo presentes como vigente.
- **Restricciones y prohibiciones**: en forma de "No...". Incluye lo que **no existe** y alguien podría dar por hecho ("No asumir que hay un ambiente de QA separado").
- **Ejemplos**: al menos uno válido y uno inválido, con datos del proyecto, que muestren cómo se aplica una regla.
- **Excepciones**: cuándo una regla no aplica y quién lo autoriza.
- Si una sección no aplica al proyecto, escribe `No aplica: <motivo>`. Si aplica pero no hay información, una línea `[POR CONFIRMAR: OQ-NNN]`. Nunca la dejes vacía.
- Si dos evidencias se contradicen, no elijas una en silencio: escribe ambas versiones y registra una OQ.
- Usa tablas cuando la plantilla lo pida. Un mismo hecho puede citarse en varios documentos si le importa a cada uno; lo que no se hace es copiar párrafos enteros de otro documento: enlázalo (`ver domain.md, RN-004`).
- Como referencia, con buena evidencia un documento queda entre 8 y 30 KB. Uno de 3 KB con evidencia abundante quedó corto; uno largo sin citas está inventando.
- No escribas secretos ni datos personales innecesarios, aunque estén en la evidencia.
- En `## Trazabilidad` lista las evidencias que usaste con lo que aportó cada una. En `## Historial`, una línea por versión.

## 5. Preguntas abiertas y decisiones

**Preguntas**: por cada vacío que importe, primero revisa las existentes (`pipeline.py oq list`) y si no está, regístrala:

```bash
python3 .pipeline/scripts/pipeline.py oq add --pregunta "¿Cuántos usuarios usarán el sistema en simultáneo en temporada alta?" \
  --origen 00-context-pack --bloquea 07-architecture,01-proposal --destino constraints.md --impacto alto \
  --contexto "Define dimensionamiento e infraestructura; cambia la estimación" --sugerencia "Entre 100 y 500, según el volumen de EV-004.3"
```

Usa el ID que devuelve en el marcador `[POR CONFIRMAR: OQ-NNN]` del documento. Criterio de impacto: **alto** si bloquea la cotización, el alcance o una decisión de arquitectura; **medio** si degrada la calidad de historias o pruebas; **bajo** si es un detalle. Escribe la pregunta para que el cliente pueda responderla sin contexto técnico, y deja siempre una sugerencia: ayuda al usuario a responder rápido.

Evita las preguntas de relleno. Diez preguntas buenas valen más que cincuenta obvias.

**Decisiones**: cuando la evidencia exprese una decisión de forma explícita (el cliente usa Jira, el backend es .NET, se publicará en AWS), regístrala como confirmada con su origen:

```bash
python3 .pipeline/scripts/pipeline.py decision set herramientas.gestion_tareas "Jira" --origen "EV-007.4" --afecta "02-user-stories,18-defect-report"
```

Usa claves con el formato `area.tema` y, cuando exista, la clave exacta que pide `pipeline.json` en `decisiones_requeridas`. Lo que solo infieres no va al registro: queda como `[INFERIDO]` en el documento y lo decidirá el paso que lo necesite.

## 6. Cerrar la tanda

1. En modo REGENERAR, antes de reescribir cada documento guarda su versión anterior en `context-pack/_historial/<documento>.v<version>.md` (ver el protocolo), incrementa `version` en el frontmatter y agrega su línea de historial.
2. Verifica los documentos de la tanda y corrige todos los BLOQUEANTES. Revisa también los avisos de **secciones delgadas**: para cada una, o la amplías con la evidencia o confirmas que no hay más.
   ```bash
   python3 .pipeline/scripts/check_pack.py --docs <documentos de la tanda>
   ```
3. Revisa la consistencia con los documentos ya escritos: mismos términos que `domain.md`, mismos `MOD-NN` que `scope.md`, sin contradicciones.
4. Escribe o actualiza `context-pack-index.md` desde su plantilla, con una fila por cada documento del manifiesto: los escritos con su estado y pendientes, los que faltan del plan como "pendiente, tanda N" y los que quedaron fuera como "no generado".
5. Registra el avance:
   ```bash
   python3 .pipeline/scripts/pipeline.py pack done <documentos de la tanda>
   python3 .pipeline/scripts/pipeline.py run finish context-pack --estado <PARCIAL si quedan tandas, COMPLETADO si no> \
     --entradas evidence/EV-*.md --resumen "Tanda 1 de 3: 5 documentos, 9 OQ (3 de impacto alto)"
   python3 .pipeline/scripts/pipeline.py status --write-active
   ```
6. Resume la tanda: tabla con documento, tamaño, marcas confirmadas, inferidas y por confirmar; las preguntas de impacto alto con su texto completo; y los documentos que quedaron delgados por falta de evidencia.
7. **Pregunta cómo seguir**, con el selector de preguntas de la aplicación (o una lista numerada si no está disponible):
   - **Continuar con la tanda siguiente** (nombra sus documentos).
   - **Parar aquí y seguir después**: recomiéndala si la conversación ya es larga; al volver a ejecutar `/delivery:generate-context-pack` en una conversación nueva, continúa donde quedó.
   - **Revisar o ajustar un documento de esta tanda** antes de seguir.
   - **Cambiar el plan**: sumar o quitar documentos.

   No sigas con otra tanda sin esa respuesta.

## 7. Cierre final: que nada quede por fuera

Cuando `pack next` diga que no quedan tandas:

```bash
python3 .pipeline/scripts/check_pack.py --cobertura
```

Lista cada hecho de la evidencia que no se cita en ningún documento. Para cada uno, decide:

- **Va en un documento generado:** agrégalo donde corresponde.
- **Va en un documento que quedó fuera del plan:** no hagas nada; se incorporará cuando se genere. Dile al usuario cuántos hechos esperan por documentos no generados.
- **No aporta** (saludo, repetido, reemplazado por un hecho posterior): regístralo en `context-pack/_no-incorporado.md` con una línea `- EV-007.3: motivo`.

El objetivo es que, entre los documentos y esa lista, la cobertura sea del 100% de los hechos de las evidencias que alimentan los documentos generados. Repite `check_pack.py` hasta que no queden bloqueantes y cierra con `run finish ... --estado COMPLETADO`.

Termina con el resumen general: documentos escritos, no generados y delgados; cobertura de evidencia; preguntas de impacto alto; y el siguiente paso. Recomienda `/delivery:verify-context-pack` en una conversación nueva y después `/delivery:open-questions`, antes de generar entregables.
