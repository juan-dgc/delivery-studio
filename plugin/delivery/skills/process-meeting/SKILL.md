---
name: process-meeting
description: "Convierte una reunión (audio, transcripción o notas) en un acta: decisiones, compromisos con responsable y fecha, preguntas respondidas y preguntas nuevas. Lleva un registro vivo de compromisos entre reuniones y arrastra los pendientes de las anteriores. Propone, y solo con tu aprobación aplica, las decisiones y las respuestas a preguntas abiertas del proyecto. Úsala después de cada reunión con el cliente o con el equipo."
disable-model-invocation: true
argument-hint: "[archivo o EV-NNN de la reunión] [tema, por ejemplo 'seguimiento semanal']"
---

# Acta de reunión y compromisos

> **Requiere antes:** `/delivery:init-project`. **Aprovecha si existen:** `/delivery:ingest-sources` (si la reunión ya es una evidencia) y `/delivery:generate-context-pack` (personas, glosario, preguntas abiertas).
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **gerente de proyecto que levanta el acta**. Tu misión: que nada de lo acordado en una reunión dependa de la memoria de alguien.

Te importa:

- Separar lo que se **decidió** de lo que solo se **conversó**. Una idea comentada no es un acuerdo.
- Que cada compromiso tenga responsable y fecha. Si en la reunión no se dijeron, no los inventas: quedan como `[POR CONFIRMAR]` y se preguntan.
- Citar: cada decisión y compromiso apunta al momento de la reunión del que sale (minuto de la transcripción o línea de las notas).
- Dar seguimiento: lo que quedó pendiente en actas anteriores se revisa en esta.
- Un acta que se lee en dos minutos.

Sigue `.pipeline/protocolo.md`. Esta skill no es un paso del pipeline: sus actas van en `outputs/_reuniones/AAAA-MM-DD-<tema>/` y el registro de compromisos en `outputs/_reuniones/compromisos.md`.

## 1. Material de la reunión

Si no vino como argumento, pregunta con el selector de preguntas de la aplicación de dónde sale la reunión:

1. **Una evidencia ya ingerida** (`EV-NNN`): lee su texto completo en `evidence/_texto/` o `evidence/_transcripciones/`, no solo los hechos.
2. **Un audio o documento en `inputs/` sin ingerir**: recomienda ejecutar primero `/delivery:ingest-sources` para que quede como evidencia citable. Si el usuario prefiere seguir, transcribe con `python3 .pipeline/scripts/transcribe.py` (pide permiso antes de instalar lo que haga falta) y avisa que el acta no tendrá citas `EV`.
3. **Notas pegadas en el chat**: guárdalas tal cual en `<carpeta del acta>/notas-originales.md` antes de trabajar.

Pregunta también, si no se deduce del material: fecha, tema, asistentes y si es una reunión con el cliente o interna. Para los nombres y roles usa `context-pack/customer-background.md`; no asumas quién es quién.

## 2. Compromisos anteriores

```bash
python3 .pipeline/scripts/pipeline.py ids CMP
python3 .pipeline/scripts/pipeline.py oq list --estado ABIERTA
```

Lee `outputs/_reuniones/compromisos.md` si existe. Para cada compromiso abierto, busca en el material si la reunión lo mencionó:

- **Cumplido**: con la cita de dónde se dijo.
- **Sigue abierto**: si su fecha ya pasó, queda **Vencido**.
- **Reprogramado**: con la fecha nueva y quién la dio.
- **Cancelado**: con el motivo.
- **No se mencionó**: no cambies su estado. Va al acta en "Pendientes sin novedad".

## 3. Extraer

Recorre el material completo, de principio a fin, y clasifica:

| Tipo | Qué es | ID |
|---|---|---|
| Decisión | Algo que se acordó y cambia el proyecto: alcance, prioridad, herramienta, fecha, regla de negocio | Se propone como `DEC` en el paso 5 |
| Compromiso | Alguien hará algo: responsable, qué, para cuándo | `CMP-NNN` |
| Respuesta | La reunión responde una pregunta abierta `OQ-NNN` del proyecto | La `OQ` que responde |
| Pregunta nueva | Algo que quedó sin resolver y bloquea o afecta trabajo | Se propone como `OQ` en el paso 5 |
| Información nueva | Reglas, cifras, excepciones o cambios de alcance que no estaban en el context pack | Lista para ingesta |
| Riesgo o alerta | Algo que alguien advirtió | Lista para `/delivery:manage-risks` |

Reglas:

- Un compromiso sin responsable o sin fecha se registra con `[POR CONFIRMAR]` en ese campo. No lo completes por deducción.
- Si dos personas dijeron cosas contrarias y no se cerró, no es una decisión: es una pregunta nueva.
- Si la transcripción es dudosa en un nombre, una cifra o una fecha, márcalo `[INAUDIBLE o DUDOSO]` y pregúntalo al usuario al final, todo en un solo bloque.

## 4. Escribir el acta `acta.md`

1. **Encabezado**: fecha, tema, tipo (cliente o interna), asistentes con su rol, fuente (`EV-NNN` o archivo).
2. **Resumen**: tres a cinco líneas, lo que alguien que no asistió debe saber.
3. **Decisiones**: tabla de decisión, quién la tomó, cita.
4. **Compromisos nuevos**: tabla de `CMP-NNN`, qué, responsable, fecha, cita.
5. **Seguimiento de compromisos anteriores**: cumplidos, vencidos, reprogramados, cancelados.
6. **Pendientes sin novedad**: compromisos abiertos que no se tocaron.
7. **Preguntas respondidas**: `OQ-NNN`, la respuesta y la cita.
8. **Preguntas nuevas**.
9. **Información nueva para el proyecto**: qué es y a qué documento del context pack afectaría.
10. **Riesgos y alertas mencionados**.
11. **Próxima reunión**, si se acordó.

Si la reunión fue con el cliente, escribe además `acta-cliente.md`: la versión para enviar, sin IDs internos ni jerga del pipeline, con resumen, decisiones, compromisos por responsable y próximos pasos. No la envíes: se entrega al usuario.

## 5. Actualizar el registro y proponer los cambios al proyecto

Actualiza `outputs/_reuniones/compromisos.md` (créalo si no existe) con esta tabla, una fila por compromiso, sin borrar los cerrados:

```
| ID | Compromiso | Responsable | Fecha | Estado | Origen | Cierre |
|---|---|---|---|---|---|---|
| CMP-001 | Enviar el listado de sucursales | Ana Ruiz (cliente) | 2026-03-12 | Abierto | 2026-03-05 seguimiento | |
```

Estados: Abierto, Vencido, Cumplido, Reprogramado, Cancelado. En **Cierre** va el acta donde se cerró.

Después presenta al usuario, en un solo bloque, lo que la reunión cambiaría en el proyecto y pide aprobación por cada grupo:

- **Decisiones** que deben quedar en `decisions.md`: con aprobación, `python3 .pipeline/scripts/pipeline.py decision set <clave> "<valor>" --origen "<acta>"`. Si la clave ya existe con otro valor, muestra los dos y pregunta cuál vale.
- **Preguntas respondidas**: con aprobación, `python3 .pipeline/scripts/pipeline.py oq answer OQ-NNN --respuesta "<respuesta> (acta <fecha>)"`. Llevar la respuesta a los documentos del context pack es trabajo de `/delivery:open-questions`.
- **Preguntas nuevas**: con aprobación, `python3 .pipeline/scripts/pipeline.py oq add --origen process-meeting --pregunta "..." --impacto "..." --contexto "..."`.

Lo que **no** aplica esta skill, y solo recomienda:

- Información nueva: `/delivery:ingest-sources` y luego `/delivery:generate-context-pack`. Si cambia alcance, después `/delivery:analyze-change`.
- Riesgos: `/delivery:manage-risks`.
- Un cambio de alcance pedido por el cliente: `/delivery:manage-change-request`.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py nota --skill process-meeting "<fecha y tema>: N decisiones, N compromisos nuevos, N vencidos"
python3 .pipeline/scripts/pipeline.py indice
```

Resume: decisiones, compromisos nuevos, compromisos vencidos con su responsable y lo que quedó `[POR CONFIRMAR]`. Enlaza el acta, la versión para el cliente y el registro de compromisos como indica la sección 6 del protocolo.
