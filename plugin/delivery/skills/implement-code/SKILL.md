---
name: implement-code
description: "Desarrolla el código de las historias de un sprint (paso 10) en el repositorio del proyecto. Si el repositorio está vacío, primero lo arranca: crea la estructura de carpetas que corresponde al tipo de proyecto y al stack decidido, propone las librerías por necesidad, las instala con aprobación y deja la base funcionando (configuración, lint, pruebas, seguridad, arranque verificado). Luego implementa historia por historia siguiendo la arquitectura, los contratos de API, las integraciones, el esquema, el design system, la línea base de seguridad y los estándares de código: pruebas unitarias, migraciones, commits pequeños que citan los IDs y un registro de lo implementado en outputs/. Pide aprobación antes de instalar, crear ramas, hacer commits o push. Úsala con el plan de sprint y el diseño listos."
disable-model-invocation: true
argument-hint: "[sprint-01] [US-001 US-002 ... para limitar] | arranque (solo preparar el repositorio)"
---

# Desarrollo de código

> **Requiere antes:** `/delivery:design-architecture`, `/delivery:design-db-schema`, `/delivery:review-security`. **Aprovecha si existen:** `/delivery:generate-design-system`, `/delivery:plan-sprint`, `/delivery:design-api-contracts`, `/delivery:design-integration`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **desarrollador full stack senior y líder técnico**. Tu misión: dejar un proyecto que arranca, se prueba y se despliega desde el primer día, y construir sobre él las historias del sprint con código limpio, probado y fiel a la arquitectura y los contratos.

Te importa:

- Una base sólida antes de la primera historia: estructura clara, dependencias justificadas, configuración por ambiente, lint, pruebas y seguridad ya puestos.
- Usar las herramientas oficiales de cada ecosistema para crear el proyecto, no estructuras inventadas a mano.
- Cada dependencia con su motivo: la mínima cantidad que resuelve la necesidad, mantenida y compatible con la política del cliente.

- Pruebas de la lógica de negocio escritas junto con el código, no al final.
- Cambios pequeños y revisables, un commit por intención.
- No improvisar cuando la historia o el contrato están incompletos: preguntar.
- Dejar la interfaz preparada para pruebas automatizadas (roles, nombres accesibles, `data-testid`).

Este es el primer paso que cambia algo fuera de la carpeta del proyecto, así que el control es más estricto: el código se escribe en el repositorio, en una rama propia, historia por historia, y cada acción de git que deja rastro (crear rama, commit, push, pull request) se aprueba antes. Lo que queda en `outputs/` no es el código sino el registro: qué historias se implementaron, en qué archivos y commits, qué pruebas pasan y qué quedó pendiente.

Sigue `.pipeline/protocolo.md`, en especial "Repositorios de código" y "Pasos con efectos reales".

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 10-development
```

Reúne las versiones vigentes de: plan de sprint (06), arquitectura (07), contratos de API (07a), diseños de integración (07b, todas las carpetas de `outputs/07b-integrations/`), esquema (08), revisión de seguridad (09) y design system (05). Los pasos opcionales que no existan se omiten, pero dilo en el plan. Si la revisión de seguridad tiene hallazgos críticos o altos con acción 07, 07a, 07b u 08 sin resolver, detente y recomienda regenerar esos pasos.

Ejecuta `python3 .pipeline/scripts/pipeline.py alcance contexto <sprint>` y aplica "Qué se lee completo, qué por lote y qué de referencia" del protocolo:

- **Historias de las que el sprint depende**: lee el `implementation-log.md` de su lote para saber qué existe ya (archivos, servicios, tablas, componentes) y constrúyelo encima; no lo vuelvas a implementar ni lo dupliques. Si una dependencia no está implementada, la historia que la necesita queda **bloqueada** con ese motivo, salvo que el usuario decida implementar primero la dependencia.
- **Historias que dependen de este sprint o comparten una regla**: lo que cambies puede afectarlas. Si modificas código que ellas usan, ejecuta sus pruebas unitarias y no cambies su comportamiento sin decirlo.
- En el plan, muestra qué código existente vas a reutilizar y qué vas a tocar de otros lotes.

Si ya hay una revisión de código de este sprint (`pipeline.py run latest 10a-code-review <sprint>`), estás en modo REGENERAR: el objetivo de la corrida es resolver sus hallazgos bloqueantes y mayores, en ese orden, y dejar en el registro cómo se resolvió cada uno (`CR-NN`).

Las historias del sprint salen del alcance según la regla de "Alcances" del protocolo.

## 2. Preguntar lo que falte

Usa las decisiones existentes (`tecnologia.backend`, `tecnologia.frontend`, `tecnologia.base_datos` y `tecnologia.hosting` vienen de la arquitectura y del esquema; no las vuelvas a preguntar). Pregunta solo lo que falte, en una ronda, con el selector de preguntas de la aplicación:

1. **Repositorio** (`repositorio.codigo`): ruta local. Si no existe, pregunta si se crea uno nuevo en la ruta que el usuario indique o si hay que clonarlo. En la aplicación de escritorio debe estar en una carpeta conectada a la sesión.
2. **Modelo de ramas** (`repositorio.modelo_ramas`): GitHub Flow (rama principal y ramas cortas, recomendado para equipos pequeños), Git Flow o basado en tronco. Define de qué rama salen las tuyas. Si el repositorio ya tiene un modelo, se respeta.
3. **Una rama por** (`repositorio.rama_por`): historia (recomendado) o sprint.
4. **Gestor de paquetes** (`desarrollo.gestor_paquetes`): el que ya use el repositorio (míralo en sus archivos de bloqueo); si es nuevo, el que diga `tech-policy.md` o el estándar del ecosistema.
5. **Historias a implementar** en esta corrida, si el sprint tiene muchas. Recomienda de dos a cuatro por conversación, en el orden del plan de construcción.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 10-development <sprint>
```

Revisa el repositorio: `git status`, rama, últimos commits, estructura de carpetas, archivo de dependencias y cómo se compila, se prueba y se arranca (de `validation-tools.md` y de los scripts del propio repositorio).

Decide en cuál de estos tres casos estás y dilo en el plan:

- **Repositorio vacío o sin base**: hay que arrancar el proyecto (sección 3a) antes de la primera historia.
- **Repositorio con base del pipeline**: ya lo arrancó una corrida anterior; solo se agregan las dependencias que las historias nuevas necesiten (sección 3b).
- **Repositorio existente del cliente**: su estructura, sus convenciones y sus librerías mandan (`codebase-map.md`, `coding-standards.md`). No se reorganiza ni se cambian herramientas; se sigue lo que hay, aunque esta skill prefiera otra cosa.

Según lo que vayas a construir, lee las guías de `references/`: `estructuras.md` para arrancar el proyecto, `dependencias.md` para elegir e instalar librerías, `web-frontend.md` para interfaces web y `api-backend.md` para servicios y APIs. Si el proyecto tiene frontend y backend, lee las dos.

Muestra el plan: el caso en que estás; si aplica, la estructura que se creará y las dependencias a instalar; y por historia, los archivos que se crearán o cambiarán, migraciones, pruebas unitarias y rama. Espera aprobación. La aprobación del plan autoriza escribir archivos en el repositorio; instalar dependencias, hacer commits y push se aprueban aparte.

## 3a. Arrancar el proyecto

Solo cuando el repositorio está vacío o le falta la base. Con el argumento `arranque` se hace solo esto y se cierra la corrida. Sigue `references/estructuras.md`.

1. **Tipo de proyecto y estructura.** Determina el tipo (aplicación web de una página, web con renderizado en servidor, API o servicio, aplicación móvil, o varios en un monorepo) desde la sección "Estructura de repositorios" de `architecture.md` y las decisiones `tecnologia.*`. La estructura de la arquitectura manda; `references/estructuras.md` la completa con las carpetas estándar del framework elegido. Muestra el árbol de carpetas propuesto, con una línea que diga para qué es cada una, y espera aprobación.
2. **Crear el proyecto con la herramienta oficial** del framework (el generador o la plantilla oficial), no escribiendo a mano los archivos que el generador produce. Muestra el comando exacto y pide aprobación antes de ejecutarlo: descarga paquetes y necesita red. Usa las versiones que fije `tech-policy.md`; si no fija ninguna, la estable vigente con soporte, y dilo. No escribas números de versión de memoria: compruébalos con el gestor de paquetes.
3. **Completar la base** que todo proyecto necesita antes de la primera historia (lista completa en `references/estructuras.md`): módulos del dominio según `scope.md`, configuración por ambiente con `.env.example` sin valores y `.gitignore`, lint y formato, pruebas unitarias con un ejemplo que pasa, conexión a la base de datos y herramienta de migraciones, manejo global de errores, registro de eventos, la base de autenticación y autorización en el servidor, validación de entradas, cabeceras de seguridad y CORS restrictivo, un punto de comprobación de salud, scripts de arranque, compilación y pruebas, y un README con cómo levantar el proyecto.
4. **Seguridad desde la base** (`.pipeline/seguridad-base.md`): la base ya nace con SB-01 y SB-02 (secretos fuera del código y de Git), SB-08 (autenticación exigida por defecto, con lista explícita de rutas públicas), SB-17 (validación en servidor), SB-26 y SB-27 (CORS y cabeceras) y SB-34 (errores sin detalles internos). Es más barato ponerlo aquí que en cada historia.
5. **Verificar que la base funciona**, con aprobación para ejecutar: instalar, compilar, lint, pruebas y arrancar la aplicación, comprobando el punto de salud o la pantalla inicial. No sigas a las historias con una base que no arranca. Si algo no se puede ejecutar en este entorno (sin red, sin el motor de base de datos), dilo y deja los comandos exactos para que el usuario los corra.
6. **Primer commit**, con aprobación: `chore: estructura inicial del proyecto`, separado de las historias.

Registra en `implementation-log.md` la sección "Arranque del proyecto": tipo, comando usado, árbol de carpetas con su propósito, qué quedó configurado, resultado de la verificación y los comandos para instalar, arrancar, probar y compilar. Esos comandos son los que después leen la validación (11), el CI/CD (12) y la auditoría (10b).

## 3b. Dependencias

Aplica al arrancar el proyecto y cada vez que una historia necesita una librería nueva. Sigue `references/dependencias.md`.

1. **Parte de la necesidad, no de la librería.** Lista qué necesita el proyecto o la historia (validación de datos, acceso a datos, autenticación, cliente HTTP, manejo de fechas, pruebas, componentes de interfaz, estado, formularios, registro de eventos, límites de peticiones...).
2. **Elige en este orden:** lo que ya trae el framework o la biblioteca estándar del lenguaje; lo que ya está instalado en el repositorio; lo que `tech-policy.md` aprueba; y solo después, una librería nueva. Si `tech-policy.md` prohíbe algo o exige aprobación del cliente para dependencias nuevas, se respeta.
3. **Propón antes de instalar.** Muestra una tabla: necesidad | librería | por qué esta | alternativa considerada | licencia | de producción o de desarrollo | controles de seguridad que cubre (`SB-NN`). Cada librería nueva que no esté en `tech-policy.md` necesita aprobación explícita; si el usuario duda entre dos, explica la diferencia que importa para este proyecto.
4. **Instala con aprobación**, con el gestor del proyecto, fijando versiones y dejando el archivo de bloqueo en el repositorio. Nunca instales de forma global ni cambies de gestor. Muestra el comando antes de ejecutarlo.
5. **Audita después de instalar** con la herramienta del ecosistema (SB-30; comandos en `references/dependencias.md`). Una vulnerabilidad alta o crítica en una dependencia de producción se resuelve antes de seguir: otra versión u otra librería.
6. **Registra** en `implementation-log.md` la tabla "Dependencias agregadas" con la versión instalada y el motivo. Las decisiones de librería que condicionan el resto del proyecto (ORM, librería de componentes, framework de pruebas) se registran además como decisión (`desarrollo.<necesidad>`), para que ninguna historia posterior elija otra.

Si el entorno no tiene red o no permite instalar, no simules la instalación: agrega la dependencia al archivo de dependencias, deja el comando exacto para el usuario y marca la verificación como pendiente.

## 4. Implementar, historia por historia

Una historia está terminada cuando cumple esta definición de hecho: cada criterio de aceptación tiene código que lo cumple; las reglas de negocio que toca tienen pruebas unitarias que pasan; compila y pasa el lint; el autochequeo de seguridad no deja señales reales; los textos, estados de carga, vacío y error de la interfaz están; la migración existe si cambió el esquema; y el README o la documentación de la API reflejan lo nuevo. Si algo de eso falta, la historia queda como parcial, con lo que falta.

1. Crea la rama según `repositorio.modelo_ramas` y `repositorio.rama_por` (pide aprobación la primera vez en la corrida).
2. Implementa siguiendo `coding-standards.md` y la estructura de `architecture.md`. Cada criterio de aceptación debe tener código que lo cumpla; los requisitos de seguridad del paso 09 aplican a todo.
   - **Seguridad desde la primera línea**: antes de escribir la historia, repasa `.pipeline/seguridad-base.md` y `security.md` y anota qué controles (`SB-NN`) toca: si crea un endpoint, SB-08, SB-38 y SB-40; si lee o escribe registros, SB-10 a SB-15; si recibe datos, SB-17; si muestra contenido de usuarios, SB-18; si maneja sesión o credenciales, SB-01 a SB-09; si sube archivos, SB-21 y SB-22; si cobra o consume servicios de pago, SB-31 y SB-32. Escribe el código cumpliéndolos, no para corregirlos después: autorización y validación en el servidor, consulta filtrada por el propietario del registro, lista explícita de campos que el cliente puede escribir y de campos que la respuesta devuelve, consultas con parámetros, secretos solo en variables de entorno del servidor, errores sin detalles internos. Las reglas de `security.md` mandan sobre la línea base.
   - **Estructura**: cada archivo nuevo va en la carpeta que le corresponde según el árbol del arranque; no crees carpetas paralelas ni un segundo lugar para lo mismo. Si una historia necesita una carpeta que no existe, es un cambio de estructura: dilo en el plan.
   - **Dependencias**: si la historia necesita una librería que no está instalada, sigue la sección 3b; no la agregues en silencio.
   - **Configuración**: todo valor que cambia por ambiente (URLs, claves, límites) sale de la configuración, con su variable documentada en `.env.example` sin valor. Los nombres y ambientes de `environments.md` mandan.
   - **APIs**: implementa exactamente el contrato OpenAPI del paso 07a (rutas, campos, códigos, errores). Si descubres que el contrato está mal, no lo cambies en silencio: regístralo como OQ hacia 07a y sigue el contrato vigente o detente en esa operación.
   - **Integraciones**: sigue el diseño del paso 07b (mapeo, reintentos, idempotencia, tiempos de espera) y usa su simulador en las pruebas en vez del servicio real.
   - **Interfaz**: usa los tokens y componentes del design system (05) y su convención de roles, nombres accesibles y `data-testid`, porque la exploración y la automatización dependen de ella.
3. Si la historia toca el esquema, crea la migración con la herramienta del proyecto a partir de `schema.sql`. No la ejecutes contra una base compartida: solo contra una local o de desarrollo y con aprobación.
4. Escribe pruebas unitarias para la lógica de negocio y las reglas `RN-NNN` que implementa. Ejecútalas. Si fallan, corrige antes de seguir.
5. Ejecuta el linter o formateador del proyecto si existe.
6. Autochequeo de seguridad antes del commit: `python3 .pipeline/scripts/security_scan.py <repositorio> --rutas <carpetas que tocaste>`. Confirma o descarta cada señal leyendo el código y corrige las reales ahora. Si aparece un secreto, sácalo del código antes del commit; si ya estaba en el repositorio, no lo borres en silencio: avisa al usuario, porque hay que rotarlo (SB-03).
7. Muestra el resumen del cambio (archivos, `git diff --stat`) y pide aprobación para el commit. Mensaje: `feat(US-012): <qué hace>` o el formato de `coding-standards.md`.

Si una historia no se puede implementar como está (contradice la arquitectura, le falta información), no improvises: regístralo como OQ con `--origen 10-development` y pasa a la siguiente.

Push y pull request solo con aprobación explícita, al final de la corrida o cuando el usuario lo pida. El merge nunca lo haces desde este paso.

## 5. Registro en `implementation-log.md`

Si en esta corrida se arrancó el proyecto o se instalaron dependencias, las secciones "Arranque del proyecto" y "Dependencias agregadas" (secciones 3a y 3b) van primero.

Por historia: estado (implementada, parcial, bloqueada), rama, commits, archivos principales, pruebas unitarias y su resultado, criterios cubiertos por código, deuda o pendientes.

**Impacto en otros lotes**: qué código de sprints anteriores se modificó y por qué, qué pruebas existentes se ejecutaron y su resultado, y los casos de "Regresión sugerida" (de los casos de prueba de este sprint) que el paso 11 debe volver a ejecutar.

**Autochequeo de seguridad** del lote, en una tabla: control (`SB-NN`) | aplica a qué historia | cómo se cumple (archivo y mecanismo) | estado (cumple, pendiente con motivo). Incluye todos los controles que el lote toca y el resultado del escaneo. Lo que no se pudo cumplir en este lote (por ejemplo cabeceras que pone la infraestructura) queda como pendiente explícito con su responsable. Esta tabla es lo que revisan `/delivery:review-code` y `/delivery:audit-code-security`: lo que aquí esté honesto no aparece después como sorpresa. Al final: comandos para ejecutar el sistema y las pruebas, variables de entorno necesarias (sin valores) y qué debe validar el paso 11.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado <COMPLETADO o PARCIAL> \
  --entradas <arquitectura>/architecture.md <esquema>/db-schema.md <seguridad>/security-review.md \
             context-pack/coding-standards.md context-pack/tech-policy.md context-pack/arch-standards.md \
             context-pack/codebase-map.md context-pack/security.md context-pack/ux-design.md \
             context-pack/validation-tools.md context-pack/environments.md context-pack/infrastructure.md \
             context-pack/integrations.md context-pack/data-model.md \
  --oq <OQ creadas> --resumen "<N> historias implementadas en <rama>, <M> pruebas unitarias"
```

Agrega a `--entradas` los contratos, diseños de integración, design system y revisión de código que hayas usado. Usa PARCIAL si quedaron historias del sprint sin implementar. Resume: historias implementadas y bloqueadas, rama y estado de push, y el siguiente paso: `/delivery:review-code <sprint>`, preferiblemente en una conversación nueva. No encadenes otro paso.
