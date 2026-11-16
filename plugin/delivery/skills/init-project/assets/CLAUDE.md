# Proyecto {{NOMBRE_PROYECTO}}

Cliente: {{CLIENTE}}. Etapa: {{ETAPA}}. Idioma de los documentos: español.

Este proyecto usa un pipeline de skills: cada entregable lo produce una skill que se invoca a mano
(`/delivery:nombre-de-la-skill`). Ninguna skill corre sola ni encadena la siguiente.

## Dónde está cada cosa

- `inputs/`: material crudo del cliente (audios, documentos, fotos). `inputs/sources.md` lista repositorios y consultas de Jira.
- `evidence/`: material normalizado (EV-NNN), lo produce `/delivery:ingest-sources`. Los pasos leen esto, no `inputs/`.
- `context-pack/`: contexto del proyecto. Empieza por `context-pack-index.md` y `active-context.md` (estado actual). `progress.md` es la bitácora: qué se hizo, cuándo y qué se decidió.
- `outputs/<paso>/<alcance>/vN/`: entregables versionados. Nunca se sobrescribe una versión. `outputs/index.html` (o `INDICE.md`) enlaza todos los entregables: es el lugar para abrir cualquiera.
- Todo documento se guarda directamente en estas carpetas, nunca solo en el chat ni en una carpeta temporal.
- `.pipeline/`: manifiesto, protocolo, plantillas y scripts compartidos por las skills.

## Gestión del proyecto

Skills que no son pasos del pipeline. Cada una lleva su registro en una carpeta de `outputs/` que se crea al usarla:

- `outputs/_arranque/`: acta de constitución y reunión de arranque (`/delivery:kickoff-project`).
- `outputs/_plan-proyecto/`: plan, calendario y línea base (`/delivery:generate-project-plan`).
- `outputs/_reuniones/`: actas y `compromisos.md`, CMP-NNN (`/delivery:process-meeting`).
- `outputs/_riesgos/`: `registro-riesgos.md`, R-NN, y sus revisiones (`/delivery:manage-risks`).
- `outputs/_solicitudes-cambio/`: solicitudes SC-NNN y su registro (`/delivery:manage-change-request`).
- `outputs/_cierres/`: cierre de cada sprint, `metricas.md` y `acciones-mejora.md` (`/delivery:close-sprint`).
- `outputs/_presupuesto/`: presupuesto, horas y cortes. Información interna: no va a documentos del cliente (`/delivery:track-budget`).
- `outputs/_uat/`: guiones, bitácora y acta de aceptación del cliente (`/delivery:plan-uat`).
- `outputs/_releases/`: plan de salida a producción, lista de chequeo y notas de versión (`/delivery:plan-release`).
- `outputs/_incidentes/`: incidentes INC-NNN y su registro (`/delivery:triage-incident`).

Estas skills proponen; las decisiones y preguntas abiertas se registran solo con aprobación. Ninguna envía nada al cliente, despliega ni toca producción.

## Reglas

- Todas las skills siguen `.pipeline/protocolo.md`.
- Para saber qué sigue: `/delivery:pipeline-status`.
- Las decisiones (herramientas, formatos, stack) viven en `context-pack/decisions.md`. Si una ya existe, no se vuelve a preguntar.
- Lo que falte se registra como pregunta abierta (OQ-NNN) en `context-pack/open-questions.md`, nunca se inventa. `/delivery:open-questions` las resuelve.
- Trabaja una skill por conversación, o usa `/clear` entre pasos: el estado vive en los archivos, no en el chat.
