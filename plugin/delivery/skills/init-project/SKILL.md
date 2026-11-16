---
name: init-project
description: "Prepara la carpeta de un proyecto nuevo para el pipeline de entregables (context pack, historias, casos de prueba, automatización). Crea inputs/, evidence/, context-pack/, outputs/, la carpeta compartida .pipeline/ con manifiesto, protocolo, plantillas y scripts, y el CLAUDE.md del proyecto. Úsala una vez por proyecto, o para actualizar .pipeline/ cuando cambien las skills."
disable-model-invocation: true
argument-hint: "[nombre del proyecto]"
---

# Inicializar un proyecto

> **Requiere antes:** ninguna. Si falta un insumo, el preflight dice qué skills correr primero, en orden.

## Rol

Actúas como **ingeniero de plataforma y experiencia de desarrollo**. Tu misión: dejar cada proyecto listo para trabajar en minutos, con una estructura predecible que cualquier persona del equipo entienda sin explicación.

Te importa:

- No pisar nada existente: en una carpeta con contenido, preguntas antes de crear o reemplazar.
- Comprobar requisitos (Python 3.8 o superior; git si habrá repositorios) y decir con claridad qué falta.
- Recomendar no subir `inputs/` a un repositorio público si contiene material del cliente o datos personales.
- En modo actualización, avisar si la versión de `.pipeline/` del proyecto es más vieja que la del plugin.

Esta skill deja lista la carpeta actual para que las demás skills del pipeline funcionen. Todas dependen de `.pipeline/` (manifiesto, protocolo, plantillas y scripts), así que este paso va primero.

Los archivos fuente están en la carpeta de esta skill, en `assets/`.

## 1. Revisar dónde estamos

El proyecto debe quedar en una carpeta del computador del usuario, no en una carpeta temporal de la sesión. En la aplicación de escritorio, comprueba que estás dentro de una carpeta conectada (`~/mnt/<carpeta>`); si la sesión arrancó en otra parte, entra a la carpeta conectada donde el usuario quiere el proyecto, y si no hay ninguna conectada, pídele que conecte una antes de crear nada.

Lista el contenido de la carpeta actual.

- Si ya existe `.pipeline/`, estás en **modo actualización**: compara cada archivo de `assets/pipeline/` con su copia en `.pipeline/`, muestra al usuario qué cambiaría y pide confirmación antes de sobrescribir. Nunca toques `inputs/`, `evidence/`, `context-pack/` ni `outputs/` en este modo. Si el usuario ajustó plantillas del proyecto, ofrécele conservar las suyas. Salta al paso 5.
- Si la carpeta tiene otros archivos, pregunta si este es el proyecto correcto o si prefiere crear una subcarpeta.

## 2. Preguntar lo mínimo

Haz estas preguntas juntas (usa la herramienta de preguntas si está disponible):

1. Nombre del proyecto y del cliente (si vino como argumento, confírmalo).
2. Etapa: preventa (todavía no hay contrato, el objetivo cercano es cotizar), en ejecución, evolutivo de un sistema existente, o **pruebas de un sistema existente** (el sistema ya funciona y el objetivo es diseñar y automatizar pruebas, sin construir).
3. ¿Ya existe código del sistema? (sí, en repositorios que listarás después / no).

No preguntes nada más: herramientas, stack y formatos se preguntan en el paso que los necesita.

## 3. Crear la estructura

```
inputs/
  audio/  documentos/  imagenes/
  sources.md            <- copia de assets/sources.md
evidence/
context-pack/
outputs/                <- entregables de los pasos; las skills de gestión crean aquí sus carpetas _<registro>/ cuando se usan
.pipeline/              <- copia completa de assets/pipeline/
  state/
CLAUDE.md               <- desde assets/CLAUDE.md, con los marcadores {{...}} reemplazados
```

Si ya existe un `CLAUDE.md`, no lo reemplaces: agrega el contenido de la plantilla al final, bajo un encabezado, y avísale al usuario.

## 4. Registrar las primeras decisiones

```bash
python3 .pipeline/scripts/pipeline.py decision set proyecto.etapa "<preventa|en ejecución|evolutivo|pruebas de un sistema existente>" --origen "usuario"
python3 .pipeline/scripts/pipeline.py decision set proyecto.codigo_existente "<sí|no>" --origen "usuario"
```

Así quedan creados `context-pack/decisions.md` y sirve de prueba de que los scripts funcionan. Si `python3` no existe, prueba con `python`; si ninguno funciona, díselo al usuario (se necesita Python 3.8 o superior) y detente.

Si la etapa es preventa, el paso 01-proposal será relevante; si es en ejecución sin intención de cotizar, sugiere omitirlo:

```bash
python3 .pipeline/scripts/pipeline.py skip 01-proposal --motivo "proyecto ya contratado"
```

Pregunta antes de omitirlo.

Si la etapa es **pruebas de un sistema existente**, los pasos de construcción no aplican. Muestra la lista y, con aprobación, omítelos de una vez (cada uno con `pipeline.py skip <paso> --motivo "sistema existente: solo pruebas"`): 01, 05, 06, 07, 07a, 07b, 08, 09, 10, 10a, 11 y 12. La cadena que queda es contexto, historias, plan de pruebas (02a, opcional), casos, cobertura y automatización (13 a 19). La auditoría de seguridad del código (10b) sigue disponible si hay acceso al repositorio del sistema. Si más adelante se desarrolla algo nuevo, se reactivan con `/delivery:pipeline-status reactivar <paso>`.

## 5. Cerrar

Muestra al usuario el catálogo de skills del plugin, leyendo `.pipeline/catalogo.md` (en modo actualización también, porque puede haber skills nuevas). Preséntalo tal cual: todas las tablas (base y contexto, revisión e informes, gestión del proyecto, marca y pasos del pipeline) y los flujos típicos. Es la referencia de qué puede ejecutar y qué necesita cada skill.

Ejecuta `python3 .pipeline/scripts/pipeline.py status` y termina con instrucciones concretas:

1. Copiar el material del cliente en `inputs/` (audios en `audio/`, documentos en `documentos/`, fotos y capturas en `imagenes/`).
2. Completar `inputs/sources.md` con repositorios, consultas de Jira, enlaces y, si el sistema ya existe, la URL de un entorno de pruebas para recorrerlo.
3. Abrir una conversación nueva y ejecutar `/delivery:ingest-sources`.

Agrega, según la etapa, qué skills de gestión del proyecto le conviene tener presentes. No son pasos y ninguna es obligatoria:

| Etapa | Recomienda |
|---|---|
| Preventa | Ninguna todavía. `/delivery:process-meeting` si quiere dejar acta de las reuniones con el cliente. |
| En ejecución o evolutivo | Con el context pack listo: `/delivery:kickoff-project`, `/delivery:generate-project-plan`, `/delivery:manage-risks` y `/delivery:track-budget iniciar`. Durante el proyecto: `/delivery:process-meeting`, `/delivery:close-sprint`, `/delivery:manage-change-request`, `/delivery:plan-uat`, `/delivery:plan-release` y, ya en producción, `/delivery:triage-incident`. |
| Pruebas de un sistema existente | `/delivery:process-meeting`, `/delivery:manage-risks` y, si se controlan horas, `/delivery:track-budget`. |

**En modo actualización**, además:

- Di qué versión tenía `.pipeline/pipeline.json` y cuál queda, y nombra las skills que son nuevas para este proyecto comparando el catálogo anterior con el nuevo.
- Comprueba que los scripts nuevos quedaron copiados (por ejemplo `budget.py`) y que `python3 .pipeline/scripts/pipeline.py indice` corre sin error: así los registros de gestión que ya existan en `outputs/_*/` aparecen en el índice de entregables.
- Si el `CLAUDE.md` del proyecto no tiene la sección "Gestión del proyecto" de `assets/CLAUDE.md`, ofrece agregarla al final, sin tocar el resto.
