# Protocolo común de ejecución

Toda skill del pipeline sigue este protocolo. Es corto a propósito: si una skill y este archivo se contradicen, gana este archivo.

La razón de fondo es una sola: el usuario quiere controlar cada paso. Una skill que adivina, que avanza sin confirmar o que inventa información para "completar" un documento produce artefactos que parecen buenos y luego contaminan la cotización, el código y las pruebas. Preguntar cuesta un minuto; corregir un error propagado cuesta días.

## 0. Dónde se trabaja y dónde se guarda

La **raíz del proyecto** es la carpeta que contiene `.pipeline/`. Todo se lee y se escribe ahí.

Antes de cualquier otra cosa, ubícala y entra en ella. En la terminal normalmente ya estás dentro. En la aplicación de escritorio la sesión puede arrancar en otra carpeta (una de trabajo temporal, a veces llamada también `outputs`): no es el proyecto.

```bash
ls .pipeline/pipeline.json 2>/dev/null || ls ~/mnt/*/.pipeline/pipeline.json ~/mnt/*/*/.pipeline/pipeline.json 2>/dev/null
cd <carpeta que contiene .pipeline>
python3 .pipeline/scripts/pipeline.py raiz
```

Si no aparece ninguna, el proyecto no está inicializado o su carpeta no está conectada a la sesión: dilo y pide al usuario que la conecte o que ejecute `/delivery:init-project`. Si aparecen varias, pregunta cuál.

Reglas de guardado, sin excepción:

- **Cada documento se escribe directamente en su lugar definitivo dentro del proyecto**: `outputs/<paso>/<alcance>/vN/` para los entregables de un paso, `context-pack/` para el contexto, `outputs/_informes/`, `outputs/_cambios/`, `outputs/_cuestionarios/` y `outputs/_sync/` para lo demás. Usa la carpeta que crea `run new`; no inventes otra.
- **Nunca dejes un entregable solo en la conversación, ni en una carpeta temporal o de la sesión.** El usuario no debe descargar nada del chat para copiarlo a mano al proyecto: otros pasos lo van a leer de esa carpeta, y si no está ahí, fallan.
- No pegues el contenido completo de un documento en el chat. Muestra un resumen y el enlace.
- Si por una limitación del entorno no pudiste escribir en la carpeta del proyecto, no lo disimules: dilo con claridad, di dónde quedó el archivo y cierra la corrida como PARCIAL.

Regla de lectura:

- **Para leer archivos usa tu herramienta de lectura, no la terminal.** Abrir un documento con `cat`, `head` o `sed` por la terminal hace lo mismo pero, en los entornos que piden permiso por cada comando, obliga al usuario a autorizar cada lectura. La terminal se reserva para los scripts del pipeline (`.pipeline/scripts/`) y para lo que de verdad necesita el sistema operativo. Para encontrar archivos, tus herramientas de búsqueda por nombre y por contenido; para leer varios, varias lecturas.

## 1. Preflight

Ejecuta desde la raíz del proyecto:

```bash
python3 .pipeline/scripts/pipeline.py check <id-del-paso>
```

El resultado dice: si las dependencias están listas, qué documentos del context pack faltan o están casi vacíos, qué decisiones requeridas no existen en `context-pack/decisions.md` y qué preguntas abiertas bloquean el paso. No continúes hasta haberlo leído.

- Si el resultado es BLOQUEADO, muestra al usuario la lista "Ejecuta primero, en este orden" que imprime el preflight, con el comando de cada skill, y detente. Solo continúa si el usuario lo pide de forma explícita, y anótalo como supuesto en el artefacto.
- Si el preflight dice que faltan documentos del context pack que el paso lee (el pack se generó solo para algunas actividades), muestra el comando que imprime para generarlos y pregunta si se generan primero (recomendado) o se continúa sin ellos. Si se continúa, lo que dependa de esos documentos queda como `[POR CONFIRMAR]`.
- Si `run latest` no encuentra el insumo de un paso anterior, su mensaje dice qué skill ejecutar: transmítelo tal cual.
- Si una dependencia está DESACTUALIZADA, avísalo: el artefacto nuevo heredaría información vieja.
- Si está POR_REVISAR, cambió algún documento del context pack desde que se generó. Puede seguir vigente; menciónalo y sugiere `/delivery:analyze-change` si hay varios artefactos en ese estado.

## 2. Preguntar antes de generar

Junta en un solo bloque todo lo que necesitas y no está en el context pack ni en `decisions.md`: decisiones requeridas por el paso, alcance de esta corrida (qué sprint, qué épicas, qué módulos) y cualquier preferencia de formato que la skill declare.

- Pregunta todo junto, máximo cuatro preguntas por vez, cada una con una opción recomendada y su motivo en una línea. Usa la herramienta de preguntas de opción múltiple si está disponible.
- Guarda cada respuesta que sea una decisión del proyecto con `pipeline.py decision set` para no volver a preguntarla en otros pasos.
- Si el usuario dice "decide tú", elige la opción recomendada, regístrala como `PROPUESTA` (no `CONFIRMADA`) y menciónalo en el resumen final.

## 3. Plan y confirmación

Antes de escribir, muestra un plan de una pantalla: modo (GENERAR o REGENERAR), alcance, documentos y artefactos que vas a leer, archivos que vas a producir y dónde. Espera la confirmación del usuario.

## 4. Generar

- Lee completos los documentos del context pack que el manifiesto asigna al paso, más los que la skill pida. Si necesitas otro, léelo y dilo.
- Si un documento menciona algo sin el detalle que necesitas (el texto exacto de un mensaje, todos los valores de una lista, los pasos de un flujo), no lo supongas: abre la evidencia que cita (`evidence/EV-NNN-*.md`) y, si hace falta, su texto completo (campo `texto_completo` de su frontmatter). Cita el hecho que uses. Si el detalle tampoco está ahí, es una pregunta abierta.
- Cada afirmación relevante lleva su origen: `[CONFIRMADO: EV-003]`, `[CONFIRMADO: DEC-004]`, `[CONFIRMADO: OQ-012]`, `[INFERIDO]` o `[POR CONFIRMAR]`. No conviertas una inferencia en un hecho.
- Si te falta información para decidir algo, no lo inventes: escribe `[POR CONFIRMAR: OQ-NNN]` y registra la pregunta (sección 5).
- Usa los IDs de trazabilidad del proyecto (`US-NNN`, `AC-NNN.N`, `TC-NNN-NN`, `DEC-NNN`, `OQ-NNN`, `EV-NNN`). Nunca reutilices un ID para otra cosa.

## 5. Registrar preguntas abiertas

Cada vacío que bloquee o degrade el artefacto se registra:

```bash
python3 .pipeline/scripts/pipeline.py oq add --pregunta "..." --origen <id-paso> \
  --bloquea <id-paso>[,<id-paso>] --destino <documento.md> --impacto alto|medio|bajo \
  --contexto "por qué importa" --sugerencia "respuesta probable o recomendada"
```

Antes de crear una, lista las abiertas (`pipeline.py oq list`) para no duplicar. `--destino` es el documento del context pack donde vivirá la respuesta cuando se conozca.

## 6. Cerrar la corrida

```bash
python3 .pipeline/scripts/pipeline.py run new <id-paso> <alcance>      # al empezar: crea outputs/<paso>/<alcance>/vN
python3 .pipeline/scripts/pipeline.py run finish <carpeta-de-la-corrida> --estado COMPLETADO \
  --entradas <archivos leídos> --oq <OQ creadas> --resumen "una línea"
```

`run finish` guarda `_meta.json` con la huella de cada entrada; así el estado sabrá cuándo el artefacto quedó desactualizado. Si no terminaste, cierra con `--estado PARCIAL` o `--estado FALLIDO` y explica qué falta. Nunca declares COMPLETADO algo con secciones vacías.

Antes del resumen, deja una nota de la sesión en la bitácora del proyecto (`context-pack/progress.md`). Las corridas, decisiones, preguntas y lotes se anotan solos; la nota agrega lo que solo se supo en la conversación: qué pidió o corrigió el usuario, qué se dejó a medias y por qué, y qué conviene hacer después.

```bash
python3 .pipeline/scripts/pipeline.py nota --skill <nombre-de-la-skill> "Se generaron los casos del lote login. El usuario pidió no cubrir el login con Google en esta fase. Quedó pendiente confirmar el mensaje de bloqueo (OQ-014)."
```

Una o dos frases, sin datos sensibles. Aplica a todas las skills, también a las que no crean corrida.

### Enlaces a lo que se produjo

`run finish` imprime la ruta de cada archivo guardado y actualiza el índice de entregables (`outputs/INDICE.md` y `outputs/index.html`). Las skills que no cierran una corrida lo actualizan con `python3 .pipeline/scripts/pipeline.py indice <carpeta donde escribiste>`.

En el mensaje final, incluye una sección **Documentos** con un enlace por cada archivo producido o modificado, el principal primero, para que el usuario lo abra con un clic sin buscar la carpeta:

- En la aplicación de escritorio: enlace Markdown a la ruta del archivo **en el computador del usuario** (la de su carpeta conectada, no la ruta interna de la sesión), con el formato `[test-cases.md](computer:///Users/.../outputs/03-test-cases/login/v1/test-cases.md)`. Si la aplicación ofrece una forma de mostrar o adjuntar un archivo al usuario, úsala además para el documento principal; el archivo ya debe estar guardado en el proyecto.
- En la terminal: la ruta relativa a la raíz del proyecto, una por línea.
- Siempre, al final, el enlace al índice: `outputs/index.html` (se abre en el navegador y enlaza todos los entregables del proyecto) o `outputs/INDICE.md`.

Comprueba que cada enlace apunta a un archivo que existe. Un enlace roto es peor que ninguno.

Termina con un resumen corto: qué produjiste, cuántas preguntas abiertas quedaron, qué decisiones quedaron como PROPUESTA y cuál es el siguiente paso sugerido.

## Estados de un artefacto

- **COMPLETADO**: vigente.
- **DESACTUALIZADO**: cambió algo que usó de verdad: alguna de sus historias (la detección es por historia, no por archivo), una decisión, la definición de su lote o un artefacto del que depende. Hay que regenerarlo.
- **POR_REVISAR**: solo cambió un documento del context pack que leyó. Puede no afectarlo. Se regenera, o se marca como vigente con `pipeline.py run accept <carpeta> --motivo "..."` después de revisarlo con el usuario.

## Historial del context pack

Antes de modificar un documento del context pack que ya existe, copia su versión actual a `context-pack/_historial/<documento>.v<version>.md`. Así se puede ver exactamente qué cambió cuando se analiza el impacto de un cambio.

## Modo REGENERAR

Cuando ya existe una versión previa del artefacto (por ejemplo, después de responder preguntas abiertas):

1. Lee la última versión y las OQ que ella misma registró. Si esa versión tiene una revisión (`_review.md`, de `/delivery:review-deliverable`), léela y resuelve cada hallazgo, uno por uno; al final lista "hallazgo, qué se hizo".
2. Lee las respuestas de esas OQ en `open-questions.md` y los cambios en los documentos destino.
3. Produce la versión siguiente en una carpeta nueva (`vN+1`); nunca sobrescribas la anterior.
4. Agrega al artefacto una sección "Cambios respecto a vN" que liste qué cambió y por qué OQ.

## Alcances

Un alcance es la porción del proyecto sobre la que trabaja una corrida. Existe para no cargar todo el proyecto en cada paso: con 100 historias, los casos de prueba, la exploración o el código se hacen por lotes.

- `proyecto`: lo que se diseña una vez para todo el sistema (arquitectura, esquema, framework).
- `backlog`: todas las historias. Escribir historias para todo el backlog es liviano; lo pesado viene después.
- Un **lote con nombre** (`sprint-01`, `lote-pagos`, `mvp`): un conjunto explícito de historias, registrado en `.pipeline/state/alcances.json`.

Para saber qué historias tiene un alcance:

```bash
python3 .pipeline/scripts/pipeline.py alcance get <alcance>
```

Si el alcance no está definido y no es `proyecto` ni `backlog`, no adivines: pregunta al usuario qué historias incluye y regístralo con `pipeline.py alcance set <alcance> US-001..US-010`. El plan de sprints (paso 06) registra sus sprints de la misma forma.

### Qué se lee completo, qué por lote y qué de referencia

Trabajar un lote no es trabajar a ciegas del resto. Las historias dependen unas de otras y las funcionalidades comparten reglas, pantallas y datos, también entre sprints. Antes de trabajar un lote con nombre, ejecuta:

```bash
python3 .pipeline/scripts/pipeline.py alcance contexto <lote>
```

Con su resultado, hay cuatro niveles de lectura:

| Nivel | Qué es | Cómo se usa |
|---|---|---|
| **Completo** | El context pack y los artefactos de alcance `proyecto` (plan de pruebas, arquitectura, contratos, esquema, seguridad, framework) | Se leen enteros siempre: valen para todos los lotes |
| **Del lote** | Las historias del lote y los artefactos de ese mismo lote en los pasos anteriores | Se leen completos y sobre ellos se produce el artefacto |
| **De referencia** | Las historias de las que el lote depende, las que dependen de él, las funcionalidades que comparten una regla o un paso de proceso, y los artefactos de otros lotes sobre esas historias | Se leen para ser coherente con ellas, para no duplicar y para saber qué se puede romper. **No se produce nada para ellas**: ni casos, ni código, ni pruebas |
| **No se lee** | El resto del backlog y de los artefactos de otros lotes | Se ignora, para no cargar contexto que no aporta |

Reglas:

- **Dependencias hacia atrás** (el lote depende de una historia anterior): lee esa historia y lo que ya se hizo con ella (sus casos, su registro de implementación, sus pantallas exploradas). Lo que ya existe se reutiliza y se cita, no se vuelve a crear. Si la dependencia todavía no se ha trabajado, dilo: la historia que depende de ella queda con ese pendiente explícito.
- **Dependencias hacia adelante** (otras historias dependen de este lote, o comparten una regla): lo que hagas aquí puede afectarlas. Lista en el artefacto qué queda expuesto a regresión, con los IDs de lo que habría que volver a verificar.
- **Avisos de orden**: si `alcance contexto` avisa que el lote depende de una historia de un lote posterior o sin lote, muéstralo antes del plan y pregunta: mover la historia, cambiar el orden o continuar con el pendiente. `pipeline.py alcance dependencias` revisa el orden de todos los lotes.
- Las historias del nivel "mismo módulo" solo se consultan si una historia del lote toca la misma pantalla o el mismo dato.
- Di en el plan qué leíste de referencia y por qué. Los artefactos de otros lotes que uses se agregan a `--entradas`, para que un cambio en ellos marque este artefacto por revisar.

En los alcances `backlog` y `proyecto` no hay nada fuera: se lee todo.

### Dónde está el insumo de un paso anterior

1. Usa la corrida de ese paso con el mismo alcance (`pipeline.py run latest <paso> <alcance>`).
2. Si no existe, usa la corrida `backlog` y trabaja solo las historias del alcance, más las de referencia que indique `alcance contexto`. Dilo en el plan y en el artefacto.
3. Si tampoco existe, pregunta qué usar.

Las versiones y los alcances son cosas distintas: `vN+1` corrige o completa el **mismo** alcance (respuestas a preguntas, cambios en historias, más historias en el mismo lote); un alcance nuevo (`sprint-02`) es **otro** lote, con sus propias carpetas, y no toca los anteriores. Si se agregan historias a un alcance existente, sus artefactos quedan desactualizados y se regeneran en `vN+1`.

## Repositorios de código

Los pasos de desarrollo, CI/CD y automatización trabajan en repositorios fuera de esta carpeta (o en subcarpetas que el usuario indique). La ruta de cada uno es una decisión (`repositorio.codigo`, `automatizacion.repositorio`).

- Antes de escribir, comprueba el estado del repositorio (`git status`, rama actual). Si hay cambios sin confirmar que no son tuyos, detente y pregunta.
- Trabaja en una rama propia del paso (por ejemplo `feature/US-012-...` o `automation/sprint-01`), nunca directo en la rama principal.
- Commits pequeños y descriptivos, citando los IDs (`US-012`, `TC-012-03`).
- Nunca escribas secretos en el código ni en `outputs/`: usa variables de entorno y lista en el reporte cuáles hacen falta.
- Todo código que escribas cumple `.pipeline/seguridad-base.md` (controles `SB-NN`, alineados con OWASP Top 10) y las reglas de `context-pack/security.md`, que mandan sobre ella. Es preventivo: se aplica al escribir, no al auditar.

## Navegador

Los pasos que operan una aplicación web (exploración, validación, ejecución asistida) usan el MCP de Playwright si está disponible.

- Solo contra entornos que el usuario autorice para este fin (desarrollo, pruebas, staging). Si la URL parece de producción, pregunta antes de abrirla.
- El inicio de sesión lo hace el usuario en la ventana visible del navegador, o se usa la sesión que quedó guardada en el perfil del proyecto. Nunca pidas contraseñas en el chat ni las escribas en archivos. Si el navegador está sin ventana y hace falta iniciar sesión, dilo y pide que se repita el paso con la ventana visible: en la aplicación hay una casilla para ello.
- **Navega por la interfaz, no por la barra de direcciones.** Escribe la URL una sola vez, para llegar a la pantalla inicial. A partir de ahí muévete como lo haría una persona: menús, botones y enlaces. Saltar a una URL interna reinicia el estado de muchas aplicaciones y en algunas cierra la sesión, así que lo que descubras así no representa el camino real del usuario. Si una pantalla solo se alcanza por URL, dilo y anótalo como hallazgo.
- No ejecutes acciones que creen, modifiquen o borren datos (enviar formularios, pagar, eliminar) salvo que el paso lo requiera, el entorno sea de pruebas y el usuario lo apruebe.

## Pasos con efectos reales

Los pasos marcados `efectos_reales: true` en el manifiesto (código, CI/CD, ejecución de pruebas) actúan sobre repositorios, pipelines o entornos. Para ellos:

- Pide aprobación explícita antes de cada acción con efectos: crear ramas, `git push`, abrir PR, hacer merge, desplegar, ejecutar contra un entorno compartido.
- El código vive en el repositorio del proyecto; en `outputs/` queda el plan, el registro de lo hecho y el reporte.
- No encadenes otro paso al terminar. Sugiere el siguiente y detente.
