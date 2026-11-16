---
name: generate-user-stories
description: "Genera o regenera las historias de usuario del proyecto (paso 02) desde el context pack, agrupadas por épica, con criterios de aceptación verificables e IDs estables (US-NNN, AC-NNN.N) que después usan los casos de prueba, la cobertura y la automatización. Trabaja por alcance (backlog completo, un sprint o una épica) y versiona cada corrida. Úsala cuando el context pack esté listo, o para regenerar historias después de resolver preguntas abiertas."
disable-model-invocation: true
argument-hint: "[alcance: backlog | sprint-01 | epica-ep-02]"
---

# Historias de usuario

> **Requiere antes:** `/delivery:generate-context-pack`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **product owner y analista de requisitos senior**. Tu misión: convertir el alcance en historias pequeñas, valiosas y verificables, que el equipo pueda estimar y QA pueda probar sin preguntar.

Te importa:

- Describir el problema y el valor, no la solución técnica.
- Criterios de aceptación observables, incluidos los caminos de error y los permisos.
- Definición de lista para trabajar: cada historia tiene criterios, rol, prioridad y dependencias, y no tiene preguntas abiertas de impacto alto; las que no cumplan se marcan.
- Para sistemas existentes, historias que describen el comportamiento actual (marcadas `tipo: existente`) cuando el objetivo es probar o automatizar, no construir.

Las historias son el contrato del resto del pipeline: los casos de prueba se escriben contra sus criterios de aceptación, la cobertura se mide contra ellos y la automatización hereda sus IDs. Por eso importan dos cosas por encima de la redacción: **criterios verificables** (si no se puede probar, no es un criterio) e **IDs estables** (una historia conserva su ID para siempre, aunque cambie su contenido).

Sigue `.pipeline/protocolo.md`. Plantilla de salida: `.pipeline/plantillas/artefactos/user-stories.md`.

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 02-user-stories
```

## 2. Preguntar lo que falte

Junta en una sola ronda lo que no esté decidido:

1. **Alcance de esta corrida** (si no vino como argumento): `backlog` (todo el producto, útil en preventa para cotizar), un sprint (`sprint-01`) o una épica (`epica-ep-02`). Si eliges sprint y no existe el paso 06, pregunta qué módulos o épicas entran.
2. **Formato** (`historias.formato`, si falta). Recomendada: "Como/Quiero/Para con criterios Dado/Cuando/Entonces", porque los criterios en ese formato se convierten casi directo en casos de prueba. Alternativas: criterios en lista simple, o el formato que ya use el cliente en Jira.
3. **Estimación** (`historias.estimacion`, si falta y el usuario quiere estimar): puntos Fibonacci, tallas (S, M, L, XL) o sin estimar. En preventa recomienda tallas: bastan para cotizar con rangos y no fingen precisión.

Guarda las decisiones con `pipeline.py decision set`.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 02-user-stories <alcance>
python3 .pipeline/scripts/pipeline.py ids US
python3 .pipeline/scripts/pipeline.py ids EP
```

`run new` crea la carpeta de la corrida y dice si es GENERAR o REGENERAR. `ids` da el siguiente número libre en todo el proyecto, para no repetir IDs entre sprints o épicas.

Muestra el plan: modo, alcance, épicas y módulos (`MOD-NN` de `scope.md`) que vas a cubrir, cantidad aproximada de historias y archivos que vas a producir. Espera confirmación.

## 4. Escribir las historias

Lee los documentos que asigna el manifiesto (`customer-background.md`, `scope.md`, `domain.md`, `business-processes.md`, `constraints.md`, `ux-design.md`). Escribe `user-stories.md` en la carpeta de la corrida siguiendo la plantilla.

- **Épicas** desde los módulos de `scope.md` o los procesos de `business-processes.md`. Una épica agrupa historias que entregan un resultado de negocio completo.
- **Roles** con los nombres de `domain.md` y `business-processes.md`, no roles genéricos como "usuario".
- **Una historia, un valor.** Aplica INVEST: si una historia necesita más de seis o siete criterios o mezcla roles, divídela.
- **Criterios de aceptación**: cubren el camino feliz, las reglas de negocio aplicables (cita `RN-NNN`), validaciones y errores esperados, y permisos cuando el rol importa. Cada criterio describe un resultado observable. Evita palabras que no se pueden probar ("rápido", "fácil", "intuitivo"): tradúcelas a algo medible o registra una OQ.
- **No funcionales**: los requisitos de `constraints.md` (rendimiento, navegadores, accesibilidad) van como criterios de la historia afectada o como historias `tipo: no funcional`.
- **Marcas de confianza** en el campo `fuente` de cada historia y en los criterios que lo necesiten. Una historia completa inferida es válida en preventa, pero debe decirlo.
- **Vacíos**: registra OQ con `--origen 02-user-stories --bloquea 02-user-stories,03-test-cases` y el documento destino donde debería vivir la respuesta.

- **Dependencias entre historias**: en `- depende de:` lista las historias que deben existir antes para que esta se pueda construir o probar (necesita su pantalla, su dato o su resultado: "recuperar contraseña" depende de "registrar usuario"). Solo dependencias directas y reales, no un orden de preferencia; `ninguna` si no tiene. Este campo lo usan el plan de sprints para ordenar y todos los pasos por lote para saber qué leer de otros lotes. Las funcionalidades relacionadas que no son dependencia quedan enlazadas solas por compartir regla (`- reglas:`) o paso de proceso (`- procesos:`), así que llena bien esos dos campos.
- **Trazabilidad al context pack**: en cada historia, `- reglas:` lista todas las `RN-NNN` que aplican y `- procesos:` los pasos (`PROC-NN.N`) que implementa. Antes de escribir, haz el inventario de reglas de `domain.md`, pasos de `business-processes.md` y módulos en alcance de `scope.md`: en el `backlog`, cada uno debe terminar en al menos una historia. Lo que quede fuera a propósito va en la sección `## Sin historia` con su motivo; nada se omite en silencio.
- **Con el detalle del context pack**: los criterios llevan las cifras, mensajes, estados y excepciones que el pack trae, no una versión general. Si el pack menciona algo sin el detalle que necesitas, búscalo en la evidencia que cita (ver "Generar" en el protocolo).

Si el alcance es grande (más de cuarenta historias), escribe una épica por vez y revisa los IDs al final.

## Sistemas existentes

Si la etapa es `pruebas de un sistema existente` o el lote describe funcionalidad que ya está construida, las historias describen el **comportamiento actual** para poder probarlo:

- Marca cada una con `tipo: existente`.
- Los criterios de aceptación salen de la evidencia: manuales, historias en Jira, recorridos de la aplicación (`tipo: aplicacion`). Son lo que el sistema hace y debe seguir haciendo.
- Donde la evidencia muestra un comportamiento dudoso (un mensaje que no cuadra con una regla, una validación que falta), no lo conviertas en criterio: regístralo como OQ para que el cliente confirme cuál es el comportamiento correcto. De ahí suelen salir defectos.
- Ejemplo de lote: `login` con "Iniciar sesión", "Recuperar contraseña", "Bloqueo por intentos fallidos" y "Cerrar sesión".

## 5. Modo REGENERAR

Además de lo que dice el protocolo:

- Lee la versión previa completa. **Conserva cada ID**: la misma historia mantiene su `US-NNN` y sus `AC-NNN.N`. Un criterio nuevo toma el siguiente número dentro de su historia; uno eliminado no se reutiliza.
- Una historia que sale del alcance no se borra: queda con `prioridad: Won't` y una nota "retirada en vN por <motivo>".
- Incorpora las respuestas de las OQ que la versión previa registró (`pipeline.py oq list --paso 02-user-stories`) y quita sus marcadores.
- Si existe un análisis de cobertura para este alcance (`pipeline.py run latest 04-coverage <alcance>`), lee su `coverage-report.md` y corrige las brechas cuya acción sea **02** (criterios ambiguos o faltantes).
- Llena "Cambios respecto a vN-1" y compruébalo contra la comparación exacta:
  ```bash
  python3 .pipeline/scripts/pipeline.py diff-historias <versión previa>/user-stories.md <carpeta de la corrida>/user-stories.md
  ```
  Toda historia que el script reporte como modificada debe aparecer explicada en esa sección. Una historia que no quisiste cambiar no debe aparecer como modificada: si aparece, revisa que no hayas reescrito su texto sin necesidad, porque cada historia modificada deja desactualizados los casos, la automatización y el código de su lote.

## 5b. Etapa adicional (alcance nuevo sobre un backlog existente)

Aplica cuando el alcance es un lote nuevo (por ejemplo `etapa-2`) y ya existen historias de otras corridas, porque el cliente amplió el proyecto. No es REGENERAR: lo que ya existe no se toca.

- No leas ni reescribas las historias existentes; léelas solo para evitar duplicados y para enlazar dependencias (`Depende de: US-NNN`).
- Antes de escribir, ejecuta `pipeline.py ids US` y `pipeline.py ids EP`: las historias nuevas empiezan en el **siguiente número libre** (si la última es US-020, la primera de la etapa es US-021). Las épicas nuevas también continúan su numeración. Nunca reutilices un ID.
- Cubre solo lo que el context pack y las OQ marcan como nuevo (`analyze-change` dice qué cambió). Si algo nuevo modifica una historia existente, no la edites: créala como historia nueva que la referencia y avisa en el resumen para que el usuario decida.
- Registra el lote con las historias nuevas **antes** de cerrar la corrida: `pipeline.py alcance set <lote> US-021..US-0NN --origen "generate-user-stories v<N>"`.
- El `backlog` completo no se regenera. Los pasos de desarrollo y automatización leen todas las historias de `outputs/`, existentes y nuevas.

## 6. Cerrar

Revisa antes de cerrar: todas las historias tienen al menos un criterio, no hay IDs duplicados, el resumen coincide con el contenido.

Comprueba las dependencias: que no haya ciclos ni referencias a historias que no existen, y, si ya hay lotes, que el orden las respete.

```bash
python3 .pipeline/scripts/pipeline.py alcance dependencias
```

Ejecútalo después de `run finish`, porque lee las historias de las corridas cerradas. Si reporta problemas, corrige en una versión nueva o avisa al usuario para que ajuste los lotes.

Comprueba que nada del context pack se quedó sin historia:

```bash
python3 .pipeline/scripts/check_trace.py historias --historias <carpeta de la corrida> --md <carpeta de la corrida>/trazabilidad.md
```

Cada BRECHA es una regla, un paso de proceso o un módulo sin historia: escribe la historia o el criterio que falta, o decláralo en `## Sin historia` con su motivo. En el `backlog` no cierres con brechas. En un lote con nombre (por ejemplo `login`) es normal que aparezcan brechas de lo que pertenece a otros lotes: revisa que ninguna sea de las funcionalidades de este lote y menciónalo en el resumen. Si `domain.md` no tiene reglas `RN-NNN` o `business-processes.md` no numera sus pasos, dilo: conviene regenerar esos documentos para poder trazar.

Si el alcance es un lote con nombre que todavía no está registrado (por ejemplo `login`), regístralo con las historias que acabas de escribir, **antes** de cerrar la corrida, para que los pasos siguientes sepan qué contiene:

```bash
python3 .pipeline/scripts/pipeline.py alcance set <lote> US-001..US-006 --origen "generate-user-stories v<N>"
```

Si ya estaba registrado y agregaste historias nuevas al lote, usa `alcance add`.

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas context-pack/customer-background.md context-pack/scope.md context-pack/domain.md \
             context-pack/business-processes.md context-pack/constraints.md context-pack/ux-design.md \
  --oq <OQ creadas> --resumen "<N> historias en <M> épicas, <K> OQ"
```

Si leíste otros documentos o la versión previa, agrégalos a `--entradas`.

Resume: historias por épica y prioridad, criterios totales, preguntas abiertas nuevas (las de impacto alto con su texto) y el siguiente paso: `/delivery:generate-test-cases <alcance>`, o `/delivery:open-questions 02-user-stories` si quedaron vacíos importantes. Si el usuario quiere cargar las historias en Jira, es una acción con efectos reales: pide aprobación explícita antes de crear cualquier ticket.
