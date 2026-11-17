---
name: ingest-sources
description: "Convierte el material crudo del proyecto en evidencia normalizada y citable (EV-NNN) dentro de evidence/. Procesa audios (los transcribe localmente), documentos (texto, PDF, Word, Excel, presentaciones), fotos y capturas, repositorios de código y consultas de Jira o enlaces listados en inputs/sources.md. Extrae de forma exhaustiva, bloque por bloque, conserva el texto completo de cada fuente y verifica con un script que no quedó información por fuera. Es incremental: solo procesa lo nuevo o lo que cambió. Úsala antes de generar el context pack y cada vez que llegue material nuevo del cliente."
disable-model-invocation: true
argument-hint: "[ruta o tipo a procesar | ampliar | ampliar EV-003]"
---

# Ingesta de fuentes

> **Requiere antes:** `/delivery:init-project`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **analista de negocio senior e investigador de requisitos**. Tu misión: pasar a evidencia **todo** lo que el material dice y que pueda importarle al proyecto, en hechos atómicos, verificables y citables, sin perder lo que el cliente quiso decir.

Te importa:

- **Completitud antes que brevedad.** La evidencia no es un resumen: es la fuente reescrita en hechos. Una reunión de una hora produce decenas de hechos, no diez. Lo que no quede aquí no existe para los demás pasos, porque ninguno vuelve a leer el material crudo.
- Separar lo que la fuente dice de tu interpretación; las interpretaciones no van en Hechos.
- Detectar duplicados entre fuentes (el mismo correo en PDF y en texto, la misma reunión en audio y en notas) y no crear dos evidencias del mismo contenido.
- Conservar los términos del cliente tal como los usa. Si una fuente está en otro idioma, redacta el hecho en español y deja entre comillas el término original.
- No copiar datos personales ni secretos.

El context pack nunca se escribe desde el material crudo: se escribe desde `evidence/`. Por eso el riesgo de este paso no es escribir de más, sino de menos: un detalle que se omite aquí (una excepción a una regla, una cifra, un mensaje de validación) no llega a las historias ni a los casos de prueba. Para evitarlo, cada fuente se procesa con un **mapa de bloques** que demuestra que se recorrió completa, se conserva su **texto completo** junto a la evidencia y un script mide si la extracción quedó delgada.

Sigue `.pipeline/protocolo.md`. Este paso no crea una corrida en `outputs/`: su resultado es `evidence/`.

## 1. Inventario

```bash
python3 .pipeline/scripts/pipeline.py sources list
```

Lee también `inputs/sources.md` (repositorios, Jira, enlaces). Una fuente externa ya ingerida aparece registrada como `repo:...`, `jira:...` o `url:...`; vuelve a procesarla solo si el usuario lo pide o si indica que cambió.

Si se pasó un argumento, limita el inventario a esa ruta o tipo.

**Ampliar** (argumento `ampliar`): vuelve a procesar fuentes ya ingeridas con el método de la sección 3, sobre el mismo archivo de evidencia, para recuperar lo que quedó por fuera.

- `ampliar` solo: ejecuta `check_evidence.py`, muestra la tabla y vuelve a procesar todas las evidencias que el control marca como cortas para el tamaño de su fuente o que vienen de una versión anterior del plugin (sin `formato: 2`). Si son muchas, trabaja por tandas.
- `ampliar EV-003 EV-007`: solo esas, aunque el control no las marque. Úsalo cuando sientas que a una fuente le recortaron información.

Conserva los IDs de los hechos existentes, porque el context pack ya los cita; los hechos nuevos continúan la numeración. Al terminar, los documentos del context pack que citan esas evidencias quedan por regenerar.

## 2. Plan y permisos

Muestra una tabla con lo que vas a procesar: fuente, tipo, cómo se procesará y si requiere algo del usuario. Pide confirmación. En esa misma confirmación pregunta **cómo quiere acompañar el trabajo**, con el selector de preguntas de la aplicación si está disponible:

- **Seguir hasta terminar** (recomendado): avisas el avance al cerrar cada tanda y continúas sin preguntar. Solo te detienes si aparece algo que de verdad necesita decidirse: una fuente ilegible o vacía, un permiso nuevo, una contradicción entre fuentes o un dato sensible que convenga omitir.
- **Consultar cada tanda**: te detienes al cerrar cada tanda y esperas su respuesta.

Esta es la única pregunta de ritmo de toda la corrida: no la repitas más adelante. Con el registro de la sección 3, interrumpir y retomar no cuesta trabajo perdido, así que detenerse por costumbre solo gasta el tiempo del usuario.

Pide permiso explícito, por separado, para:

- Instalar un motor de transcripción si no existe (`pip install faster-whisper`).
- Clonar repositorios (se clonan en `inputs/repos/<nombre>`, en solo lectura de hecho: no se crean ramas ni commits).
- Consultar Jira con el conector de Atlassian. Si el conector no está disponible, dilo y sugiere conectarlo; no pidas exportes manuales salvo que el usuario lo prefiera.

## 3. Método: una fuente a la vez, completa

**Dónde se escribe, y en ningún otro sitio.** Esta skill solo crea o modifica estos archivos:

- `evidence/EV-NNN-<slug>.md`: la evidencia de cada fuente.
- `evidence/_texto/` y `evidence/_transcripciones/`: las copias de consulta.
- `evidence/_index.md`: el índice.

Está **prohibido** crear cualquier otra carpeta o archivo de trabajo: nada de `_borrador/`,
`_temp/`, `_wip/`, carpetas por tanda, por subagente o por letra, ni copias «para revisar antes
de mover». El archivo de evidencia se escribe directamente en su sitio definitivo desde el primer
bloque; está incompleto hasta que termines y eso es normal, no es motivo para escribirlo aparte.
Un archivo fuera de esas rutas no lo ve `check_evidence.py` ni lo encuentra el context pack, así
que no existe para el resto del pipeline.

**Una fuente, una evidencia, un registro.** Antes de empezar una fuente, mira si ya tiene `EV-NNN`
en `pipeline.py sources list`: si lo tiene, no la vuelvas a procesar (salvo en modo `ampliar`, que
escribe sobre el mismo archivo) y nunca le crees un `EV` nuevo. **Al terminar cada fuente**, antes
de pasar a la siguiente, ejecuta `pipeline.py sources mark` (sección 5). Ese registro es lo único
que te dice qué está hecho si la conversación se interrumpe o se reanuda: dejarlo para el final es
lo que hace que la skill vuelva a empezar y repita el trabajo.

**Si te interrumpen y vuelves**, ejecuta `pipeline.py sources list` y continúa por la primera
fuente sin registrar. No reinicies el inventario ni vuelvas a procesar lo marcado.

Para cada fuente, en este orden:

1. **Texto completo.** Convierte la fuente a texto y guárdalo en `evidence/_texto/EV-NNN-<slug>.md` (las transcripciones ya quedan en `evidence/_transcripciones/`). Es la copia de consulta: si más adelante un paso necesita un detalle, lo busca ahí sin volver al archivo original. Omite de esa copia secretos y datos personales innecesarios. No aplica a repositorios, imágenes ni aplicaciones.
2. **Mapa de la fuente.** Antes de extraer, lista sus bloques: capítulos o títulos de un documento, páginas de un PDF sin títulos, hojas de un Excel, diapositivas, tramos de unos cinco minutos de un audio, carpetas de un repositorio, épicas de Jira, pantallas de una aplicación. Ningún bloque debería pasar de unas 1.500 palabras; si pasa, divídelo.
3. **Extracción bloque por bloque.** Recorre los bloques en orden y escribe los hechos de cada uno en el archivo de evidencia a medida que avanzas, bajo un subtítulo por bloque. No leas toda la fuente para escribir al final: así es como se pierden los detalles. En cada bloque busca, con esta lista:
   - reglas de negocio, condiciones y sus excepciones;
   - cifras, volúmenes, montos, porcentajes, plazos, fechas y horarios;
   - pasos de un proceso, en orden, con quién hace cada uno;
   - roles, personas, áreas y qué decide o aprueba cada una;
   - sistemas, herramientas, integraciones y formatos de archivo que se nombran;
   - campos, validaciones, mensajes de error y estados;
   - términos propios del cliente y su significado;
   - restricciones, prohibiciones y requisitos no funcionales;
   - decisiones, preferencias y lo que se descartó;
   - problemas, quejas, riesgos y dudas que alguien expresó.
4. **Listas y tablas completas.** Si la fuente enumera doce estados, van los doce: nunca "entre otros" ni "etc.". Las tablas de la fuente se conservan como tablas en `## Datos tabulares`, completas.
5. **Pase de completitud.** Al terminar, vuelve a recorrer el texto completo comparándolo con los hechos escritos y agrega lo que falte. Luego llena la tabla de `## Mapa y cobertura`: cada bloque con cuántos hechos salieron de él. Un bloque con cero hechos necesita un motivo ("saludo inicial", "índice", "repite EV-003").
6. **Verificación.** Ejecuta el control de la sección 4b y corrige lo que marque.

No hay un tamaño máximo para una evidencia. Si una fuente es muy larga (más de unas 15.000 palabras o más de 90 minutos), divídela en varias evidencias por capítulo o por tramo (`EV-007`, `EV-008`...), cada una con su propio mapa, y dilo en el resumen de cada una.

### Por tipo de fuente

**Audio y video** (`.mp3 .m4a .wav .ogg .opus .webm .mp4`):
```bash
python3 .pipeline/scripts/transcribe.py inputs/audio/<archivo> --salida evidence/_transcripciones --idioma es
```
Los bloques son tramos de unos cinco minutos. Cita la marca de tiempo de cada hecho. Una transcripción automática tiene confiabilidad media: nombres propios, cifras y fechas pueden estar mal; márcalos para confirmar si son importantes. Conserva en `## Citas textuales` las frases del cliente que expresan un dolor, una meta o una exigencia: las usa la propuesta.

**Documentos** (`.txt .md .pdf .docx .xlsx .csv .pptx .eml`): léelos completos con la herramienta adecuada para cada formato, incluidas notas al pie, anexos, comentarios y todas las hojas de un Excel. Cita página, hoja o sección. En un manual o una base de conocimiento, cada artículo o capítulo es un bloque.

**Imágenes** (fotos de tableros, bocetos, capturas del sistema actual, documentos fotografiados): obsérvalas directamente. Describe qué muestran y transcribe todo el texto visible. De una captura de pantalla saca cada campo, botón, columna y mensaje: son evidencia valiosa para `ux-design.md`.

**Repositorios**: recorre el árbol completo, no solo el README. Extrae:
- estructura de carpetas con el propósito de cada una y su tamaño aproximado;
- stack y versiones exactas (desde `package.json`, `pom.xml`, `*.csproj`, `requirements.txt`, `go.mod`, etc.);
- comandos de instalación, compilación, pruebas, lint y ejecución, copiados textualmente de los scripts, el README o el Makefile;
- módulos funcionales y dónde vive cada uno, con sus archivos principales;
- convenciones de nombres y patrones que se repiten;
- integraciones visibles (SDKs, clientes HTTP, nombres de variables de entorno, sin valores);
- pruebas existentes, su framework y cuántas hay;
- configuración de CI/CD, paso por paso;
- configuración por ambiente y dónde vive;
- deuda técnica evidente.

Los bloques son las carpetas de primer y segundo nivel. Si el repositorio es grande, delega la exploración a subagentes de solo lectura, uno por zona, y pídeles hechos con rutas concretas, no un resumen. No copies código más allá de fragmentos cortos que ilustren una convención.

**Jira**: ejecuta las consultas de `sources.md`. Cada épica es un bloque. Registra cada historia y cada defecto relevante con su clave (`ABC-123`), estado, descripción y criterios de aceptación completos; los criterios de aceptación ya escritos por el cliente son la evidencia más valiosa para las historias y los casos. Si hay cientos de tickets, crea una evidencia por épica en vez de recortar.

**Enlaces**: si son públicos, léelos completos; si requieren sesión, pregunta al usuario cómo prefiere compartirlos.

**Aplicaciones en funcionamiento** (sistemas existentes, listados en `sources.md`): recórrelas con el MCP de Playwright, en **solo lectura**, siguiendo las reglas de "Navegador" del protocolo. El usuario inicia sesión en la ventana visible. Cada pantalla es un bloque. Por cada módulo pedido, registra como evidencia:
- pantallas y su propósito, con captura en `evidence/capturas/`;
- todos los campos con sus etiquetas, tipo, obligatoriedad visible, valores de las listas y mensajes de validación que aparecen sin enviar datos;
- flujos y navegación observados, paso a paso;
- textos de ayuda y reglas visibles en pantalla.

No envíes formularios que cambien datos (por ejemplo, no completes una recuperación de contraseña real) salvo que el entorno sea de pruebas y el usuario lo apruebe. Si te piden recorrer algo que necesita cambiar datos, describe hasta donde llegaste. Esta evidencia es de comportamiento observado: lo que el sistema hace, no lo que debería hacer. Si el comportamiento parece un error, anótalo como pregunta, no como hecho. Los selectores para automatizar no se sacan aquí; eso es el paso 14.

### Volumen

Con muchas fuentes, trabaja por tandas de tres a cinco fuentes y al cerrar cada una muestra el avance: cuántas van, cuáles quedan y lo que hayas encontrado que valga la pena saber. Si el usuario eligió seguir hasta terminar, continúa sin preguntar; si eligió consultar, espera su respuesta. Es preferible terminar bien cinco fuentes que pasar por encima de veinte. Cada fuente queda registrada con `sources mark` en cuanto termina, así que al continuar la tanda siguiente empiezas por la primera fuente sin registrar: continuar nunca significa volver a empezar.

Las fuentes independientes también pueden procesarse en paralelo con subagentes: asigna a cada uno un rango de IDs (por ejemplo EV-010 a EV-019) y pásale este método completo y el formato de la sección 4. Cada subagente escribe sus archivos en `evidence/`, con los nombres definitivos de su rango; ninguno crea carpetas propias ni entrega su trabajo en otro sitio para que tú lo muevas después. Tú revisas su cobertura y actualizas el índice al final.

## 4. Formato de cada evidencia

Un archivo por fuente: `evidence/EV-NNN-<slug>.md`. El siguiente número es el mayor existente más uno.

```markdown
---
id: EV-007
formato: 2
titulo: Reunión de kickoff con gerencia comercial
fuente: inputs/audio/kickoff-2026-10-30.m4a
texto_completo: evidence/_transcripciones/kickoff-2026-10-30.txt   # o "no aplica" en repositorios, imágenes y aplicaciones
tipo: audio | texto | documento | imagen | repositorio | jira | enlace | aplicacion
fecha_fuente: 2026-10-30        # si se conoce
ingerido: 2026-11-03
confiabilidad: alta | media | baja
datos_personales: sí | no
---

# Reunión de kickoff con gerencia comercial

## Resumen
Cinco a diez líneas: de qué trata la fuente, quién habla o quién la escribió, y qué aporta.

## Mapa y cobertura
| Bloque | Ubicación | Hechos | Nota |
|---|---|---|---|
| Presentaciones | 00:00 a 00:04 | 0 | Saludos, sin contenido del proyecto |
| Cómo se cotiza hoy | 00:04 a 00:11 | 9 | |
| Problemas con el Excel | 00:11 a 00:17 | 7 | |

## Hechos

### Cómo se cotiza hoy (00:04 a 00:11)
- EV-007.1: El sistema debe permitir cotizar en pesos y dólares. (00:04:12)
- EV-007.2: Hoy las cotizaciones se hacen en Excel y tardan dos días. (00:06:40)

### Problemas con el Excel (00:11 a 00:17)
- EV-007.10: Cada asesor tiene su propia copia del archivo de precios. (00:11:30)

## Decisiones o preferencias expresadas
- EV-007.17: El cliente exige que la aplicación funcione en Chrome y Safari. (00:21:03)

## Datos tabulares
Las tablas de la fuente, completas. "Ninguno" si no hay.

## Citas textuales
- "Perdemos ventas porque la cotización llega dos días tarde." Gerente comercial (00:07:15)

## Preguntas y vacíos detectados
- No se mencionó cuántos usuarios concurrentes habrá.

## Temas para el context pack
scope.md, domain.md, constraints.md
```

Reglas para los hechos:

- Uno por línea, atómico, con su ubicación entre paréntesis al final (minuto, página, ruta de archivo, clave de Jira). Un hecho por línea es lo que permite citarlo después. La numeración es corrida dentro de la evidencia, también en "Decisiones o preferencias expresadas".
- Con el detalle de la fuente: "El descuento máximo es 15% y lo aprueba el gerente si supera 10%" vale más que "Hay reglas de descuento". Si una regla tiene excepción, la excepción es otro hecho.
- Lo que dice la fuente, no tu interpretación. Si deduces algo, no va en "Hechos".
- Si contradice una evidencia anterior, dilo en el hecho: "contradice EV-003.2".
- En "Temas para el context pack" lista **todos** los documentos a los que la evidencia aporta algo, aunque sea un solo hecho: es lo que usa `generate-context-pack` para saber qué evidencias leer en cada documento.
- No copies datos personales que no hagan falta (documentos de identidad, teléfonos, direcciones) ni ningún secreto (contraseñas, tokens, llaves, valores de `.env`). Si una fuente los contiene, marca `datos_personales: sí` y omítelos.

## 4b. Control de completitud

```bash
python3 .pipeline/scripts/check_evidence.py
```

Compara el tamaño de cada fuente con los hechos extraídos y revisa el mapa. Corrige todos los hallazgos BLOQUEANTES (bloques sin procesar, falta del texto completo). Una evidencia marcada **DELGADA** tiene pocos hechos para el tamaño de su fuente: vuelve a pasar por ella bloque por bloque, o si de verdad la fuente aporta poco, dilo en la columna Nota del mapa. Muestra la tabla al usuario en el cierre.

## 5. Índice y registro

Actualiza `evidence/_index.md`: tabla con id, título, tipo, fuente, confiabilidad y temas. El registro de cada fuente se hace al terminarla, no aquí (sección 3); si alguna quedó sin marcar, márcala ahora:

```bash
python3 .pipeline/scripts/pipeline.py sources mark <ruta-o-repo:url-o-jira:consulta> EV-NNN
```

## 6. Cerrar

Resume: cuántas evidencias nuevas y cuántos hechos en total, la tabla de `check_evidence.py`, qué documentos del context pack se verán afectados y los vacíos más importantes que encontraste. Si alguna fuente quedó a medias o delgada, dilo con claridad. Si el context pack ya existe, el siguiente paso es `/delivery:generate-context-pack` en modo REGENERAR, solo para los documentos afectados; si no existe, `/delivery:generate-context-pack` completo.
