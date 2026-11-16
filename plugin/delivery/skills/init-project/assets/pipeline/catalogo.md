# Catálogo de skills del plugin delivery

Todas se invocan a mano con `/delivery:<nombre>` y ninguna encadena la siguiente. Las de alcance **lote** reciben el lote como argumento (`sprint-01`, `login`, `backlog`); si no lo indicas, te lo preguntan. Las de alcance **proyecto** se hacen una vez para todo el sistema.

## Base y contexto

| Skill | Qué hace | Requiere antes |
|---|---|---|
| `/delivery:init-project` | Prepara la carpeta del proyecto y muestra este catálogo. | ninguna |
| `/delivery:pipeline-status` | Qué está listo, qué quedó desactualizado o por revisar y qué sigue. También define lotes de historias y muestra este catálogo (`ayuda`). | `/delivery:init-project` |
| `/delivery:ingest-sources` | Convierte audios, documentos, fotos, repositorios, Jira y aplicaciones en funcionamiento en evidencia citable, de forma exhaustiva y con control de que nada quede por fuera. Con `ampliar` vuelve sobre una evidencia que quedó corta. | `/delivery:init-project` |
| `/delivery:generate-context-pack` | Escribe el contexto del proyecto desde la evidencia: pregunta para qué actividades lo necesitas, genera solo esos documentos (o los 22) por tandas y continúa donde quedó cada vez que la ejecutas. | `/delivery:ingest-sources` |
| `/delivery:verify-context-pack` | Revisa la calidad, la profundidad y la cobertura de evidencia del context pack, califica cada chequeo de 0 a 100 y da un puntaje comparable entre versiones y un veredicto, sin corregir. | `/delivery:generate-context-pack` |
| `/delivery:open-questions` | Resuelve lo que falta: te pregunta, arma cuestionario para el cliente o busca respuestas en evidencia nueva. | `/delivery:generate-context-pack` (o cualquier paso que haya dejado preguntas) |
| `/delivery:analyze-change` | Analiza el impacto de información nueva: qué regenerar, qué sigue vigente y cuánto esfuerzo implica. | `/delivery:generate-context-pack` con la información nueva incorporada |

## Revisión, sincronización e informes

No son pasos: se usan cuando hacen falta, sobre lo que ya existe.

| Skill | Qué hace | Requiere antes |
|---|---|---|
| `/delivery:review-deliverable` | Revisión independiente de cualquier entregable, con rúbrica por tipo, puntaje comparable entre versiones y hallazgos. No corrige. | La skill del entregable que se revisa |
| `/delivery:sync-test-management` | Lleva historias y casos a la herramienta de gestión del cliente (CSV o conector), con aprobación y sin duplicar. | `/delivery:generate-user-stories` o `/delivery:generate-test-cases` |
| `/delivery:generate-status-report` | Informe de avance para el cliente en PDF con tu marca, desde la bitácora y los reportes. | `/delivery:init-project` y al menos un paso ejecutado |

## Gestión del proyecto

No son pasos: acompañan la ejecución. Cada una lleva su propio registro en `outputs/`.

| Skill | Qué hace | Requiere antes |
|---|---|---|
| `/delivery:kickoff-project` | Arranque de un proyecto contratado: acta de constitución, agenda de la reunión de arranque y lista de lo que el cliente debe entregar. | `/delivery:generate-context-pack` |
| `/delivery:generate-project-plan` | Plan del proyecto: hitos, calendario calculado con capacidad y dependencias, ruta crítica, comunicaciones y línea base. Con `actualizar`, la desviación. | `/delivery:generate-user-stories backlog`; idealmente `/delivery:plan-sprint` |
| `/delivery:close-sprint` | Cierre de sprint: comprometido frente a terminado, velocidad, qué pasa con lo no terminado, revisión con el cliente, retrospectiva y acciones de mejora (AM). | `/delivery:plan-sprint` |
| `/delivery:track-budget` | Control de presupuesto: horas consumidas frente a presupuestadas por perfil y fase, eficiencia frente al avance real y proyección al cierre. | `/delivery:init-project` y un presupuesto acordado |
| `/delivery:plan-release` | Salida a producción: contenido de la versión, paso a paso, reversión, lista de chequeo con recomendación de salir o no, y notas de la versión. No despliega. | `/delivery:generate-user-stories` |
| `/delivery:process-meeting` | Acta de una reunión desde audio o notas: decisiones, compromisos con responsable y fecha (CMP), preguntas respondidas y nuevas. Arrastra los compromisos pendientes. | `/delivery:init-project` |
| `/delivery:manage-change-request` | Solicitud de cambio para el cliente (SC): alcance, costo, plazo y opciones. Registra la aprobación y deja el plan para llevar el cambio al backlog. | `/delivery:generate-context-pack`; idealmente `/delivery:analyze-change` |
| `/delivery:plan-uat` | Pruebas de aceptación del cliente: guiones en lenguaje de negocio, quién prueba qué, bitácora de resultados y acta de aceptación. | `/delivery:generate-user-stories` |
| `/delivery:triage-incident` | Incidente en un sistema entregado (INC): severidad, causa raíz en código y pruebas, plan de corrección y caso de regresión. No toca producción. | `/delivery:init-project` |
| `/delivery:manage-risks` | Registro vivo de riesgos (R): probabilidad, impacto, responsable, respuesta y disparador. En cada revisión busca señales en la bitácora, defectos, compromisos e incidentes. | `/delivery:generate-context-pack` |

## Marca propia

| Skill | Qué hace | Requiere antes |
|---|---|---|
| `/delivery:create-brand-kit` | Kit de marca de TU empresa (logo, colores, tipografía, datos, voz) para los documentos que entregas al cliente. | ninguna (se crea una vez y sirve para todos los proyectos) |

## Pasos del pipeline

| Paso | Skill | Qué hace | Alcance | Requiere antes | Aprovecha si existe |
|---|---|---|---|---|---|
| 01 (opc.) | `/delivery:generate-proposal` | Propuesta comercial en PDF con tu marca, estimación con código y control de calidad por página. | proyecto | `/delivery:generate-context-pack` | `/delivery:create-brand-kit`, `/delivery:generate-user-stories` |
| 02 | `/delivery:generate-user-stories` | Historias de usuario con criterios de aceptación, por épica; también de sistemas existentes. | lote | `/delivery:generate-context-pack` | - |
| 02a (opc.) | `/delivery:generate-test-plan` | Plan y estrategia de pruebas: riesgo por módulo, niveles, tipos, automatización y criterios de salida. | proyecto | `/delivery:generate-user-stories` | - |
| 03 | `/delivery:generate-test-cases` | Casos de prueba trazados a cada criterio, con técnicas de diseño de pruebas. | lote | `/delivery:generate-user-stories` | `/delivery:generate-test-plan` |
| 04 | `/delivery:analyze-coverage` | Cobertura entre historias y casos, por lote o acumulada con resumen por épica. | lote | `/delivery:generate-user-stories`, `/delivery:generate-test-cases` | `/delivery:generate-test-plan` |
| 05 (opc.) | `/delivery:generate-design-system` | Design system del producto del cliente: tokens, componentes y vista previa. | proyecto | `/delivery:generate-user-stories` | - |
| 06 (opc.) | `/delivery:plan-sprint` | Reparte las historias en sprints y registra cada sprint como lote. | proyecto | `/delivery:generate-user-stories` | - |
| 07 | `/delivery:design-architecture` | Arquitectura, diagramas C4 y plan de módulos. | proyecto | `/delivery:generate-user-stories` | - |
| 07a (opc.) | `/delivery:design-api-contracts` | Contratos OpenAPI trazados a las historias. | proyecto | `/delivery:design-architecture` | - |
| 07b (opc.) | `/delivery:design-integration` | Diseño de una integración externa, con simulador y pruebas de contrato. | integracion | `/delivery:design-architecture` | - |
| 08 | `/delivery:design-db-schema` | Esquema de base de datos, diagrama ER y DDL. | proyecto | `/delivery:design-architecture` | `/delivery:design-api-contracts` |
| 09 | `/delivery:review-security` | Modelo de amenazas y hallazgos de seguridad del diseño. | proyecto | `/delivery:design-architecture`, `/delivery:design-db-schema` | `/delivery:design-api-contracts`, `/delivery:design-integration` |
| 10 | `/delivery:implement-code` | Código de las historias del lote en el repositorio. | lote | `/delivery:design-architecture`, `/delivery:design-db-schema`, `/delivery:review-security` | `/delivery:generate-design-system`, `/delivery:plan-sprint`, `/delivery:design-api-contracts`, `/delivery:design-integration` |
| 10a | `/delivery:review-code` | Revisión del código contra criterios, contratos y seguridad. | lote | `/delivery:implement-code` | - |
| 10b (opc.) | `/delivery:audit-code-security` | Auditoría de seguridad del código contra la línea base (OWASP Top 10), con modo corregir. | proyecto | ninguna (solo un repositorio con código) | `/delivery:implement-code`, `/delivery:review-security` |
| 11 | `/delivery:validate-development` | Ejecuta los casos del lote contra lo construido. | lote | `/delivery:implement-code`, `/delivery:review-code`, `/delivery:generate-test-cases` | - |
| 12 | `/delivery:setup-cicd-code` | Pipeline de integración y despliegue del código. | proyecto | `/delivery:implement-code` | - |
| 13 | `/delivery:select-automation-candidates` | Elige qué casos automatizar y en qué orden. | lote | `/delivery:generate-test-cases` | `/delivery:generate-test-plan` |
| 14 | `/delivery:explore-web-app` | Explora la aplicación con Playwright y extrae selectores. | lote | `/delivery:select-automation-candidates` | - |
| 15 | `/delivery:scaffold-automation-framework` | Crea el framework de automatización con page objects. | proyecto | `/delivery:select-automation-candidates`, `/delivery:explore-web-app` | - |
| 16 | `/delivery:automate-test-cases` | Automatiza los casos seleccionados, de UI y de API. | lote | `/delivery:explore-web-app`, `/delivery:scaffold-automation-framework` | `/delivery:design-api-contracts` |
| 17 | `/delivery:run-automated-tests` | Ejecuta la suite y clasifica las fallas. | lote | `/delivery:automate-test-cases` | - |
| 18 | `/delivery:report-defects` | Redacta defectos por lote o consolida los de todos los sprints. | lote | `/delivery:generate-test-cases` | - |
| 19 | `/delivery:setup-cicd-automation` | Pipeline de CI/CD para la automatización. | proyecto | `/delivery:automate-test-cases`, `/delivery:run-automated-tests` | - |

## Flujos típicos

**Proyecto nuevo, desde preventa:**

1. `/delivery:init-project`, copiar el material en `inputs/`, `/delivery:ingest-sources`.
2. `/delivery:generate-context-pack`, `/delivery:verify-context-pack`, `/delivery:open-questions`.
3. `/delivery:create-brand-kit` (una sola vez) y `/delivery:generate-proposal`.
4. `/delivery:generate-user-stories backlog` y `/delivery:plan-sprint`.
5. Diseño de proyecto: arquitectura, contratos, integraciones, esquema, seguridad.
6. Por cada sprint: casos, cobertura, desarrollo, revisión, validación, candidatos, exploración, automatización, ejecución, defectos.

**Automatizar pruebas de un sistema que ya existe:**

1. `/delivery:init-project` con la etapa "pruebas de un sistema existente" (omite los pasos de construcción).
2. `/delivery:ingest-sources` con documentación, Jira y la URL del entorno de pruebas para recorrerlo.
3. `/delivery:generate-context-pack`, `/delivery:verify-context-pack`, `/delivery:open-questions`.
4. `/delivery:generate-user-stories <lote>` describiendo el comportamiento actual.
5. `/delivery:generate-test-plan` (opcional, recomendado), `/delivery:generate-test-cases <lote>` y `/delivery:analyze-coverage <lote>`.
6. `/delivery:select-automation-candidates`, `/delivery:explore-web-app`, `/delivery:scaffold-automation-framework`, `/delivery:automate-test-cases`, `/delivery:run-automated-tests`, `/delivery:report-defects` y `/delivery:setup-cicd-automation`.

**Antes de entregar algo al cliente:** `/delivery:review-deliverable <paso>` en una conversación nueva; si hay hallazgos, vuelve a ejecutar la skill del entregable, que los lee y los resuelve.

**Antes de salir a producción:** `/delivery:audit-code-security` y, con sus hallazgos, `/delivery:audit-code-security corregir`. Luego `/delivery:plan-uat` para la aceptación del cliente y `/delivery:plan-release` para la salida.

**Gestión de un proyecto en ejecución:**

1. Al empezar: `/delivery:kickoff-project`, `/delivery:generate-project-plan`, `/delivery:manage-risks` y `/delivery:track-budget iniciar`.
2. Después de cada reunión: `/delivery:process-meeting`.
3. Al final de cada sprint: `/delivery:close-sprint`, `/delivery:track-budget corte`, `/delivery:manage-risks revisar` y `/delivery:generate-status-report`.
4. Cuando el cliente pide algo fuera del alcance: `/delivery:analyze-change` y `/delivery:manage-change-request`.
5. Después de salir a producción: `/delivery:triage-incident` para lo que falle.

**Cuando llega información nueva:** ingesta, context pack, backlog y `/delivery:analyze-change`.

Una skill por conversación, o `/clear` entre pasos. `/delivery:pipeline-status` siempre dice qué sigue.
