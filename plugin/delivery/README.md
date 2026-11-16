# Delivery pipeline: guía de uso

45 skills para llevar un proyecto desde el material crudo del cliente (audios, documentos, fotos, repositorios, Jira) hasta un context pack trazable, y de ahí a cotización, historias, pruebas, arquitectura, código, CI/CD y automatización web.

Nombres de skills en inglés; instrucciones y documentos en español. Todas se invocan a mano con el prefijo del plugin (`/delivery:nombre`). Ninguna corre sola ni encadena la siguiente, y las que actúan sobre repositorios o entornos piden aprobación antes de cada acción.

`/delivery:init-project` muestra el catálogo completo al terminar, y `/delivery:pipeline-status ayuda` lo muestra en cualquier momento. Cada skill indica qué skills requiere antes y, si falta un insumo, dice cuáles correr primero y en qué orden.

## Las skills, en orden

### Base y contexto

| Skill | Qué hace |
|---|---|
| `/delivery:init-project` | Prepara la carpeta del proyecto y copia `.pipeline/` (manifiesto, protocolo, plantillas, scripts) |
| `/delivery:pipeline-status` | Qué está listo, qué quedó desactualizado y qué sigue |
| `/delivery:ingest-sources` | Convierte `inputs/` en evidencia citable `EV-NNN`: extracción exhaustiva bloque por bloque, texto completo conservado y control de completitud (incremental; `ampliar` para profundizar una evidencia corta) |
| `/delivery:generate-context-pack` | Escribe el context pack desde la evidencia, por perfiles de actividad y por tandas, con citas, decisiones, preguntas y control de cobertura |
| `/delivery:verify-context-pack` | Revisión automática y de juicio (fidelidad, profundidad, información que quedó por fuera), con veredicto (mejor en conversación nueva) |
| `/delivery:open-questions` | Resuelve preguntas abiertas: te pregunta, arma cuestionario para el cliente o busca en evidencia nueva, e incorpora al context pack |
| `/delivery:analyze-change` | Impacto de información nueva: qué regenerar, qué sigue vigente, en qué orden y con qué esfuerzo |

### Revisión, sincronización e informes

No son pasos del pipeline: se usan cuando hacen falta, sobre lo que ya existe.

| Skill | Qué hace |
|---|---|
| `/delivery:review-deliverable` | Revisión independiente de cualquier entregable (historias, plan de pruebas, casos, propuesta, arquitectura...) con una rúbrica por tipo, puntaje de 0 a 100 comparable entre versiones y hallazgos accionables. No corrige: la skill del entregable lee la revisión al regenerar |
| `/delivery:sync-test-management` | Lleva historias y casos a Jira, Zephyr, Xray, TestRail o Azure DevOps: exporta CSV o crea con el conector, con aprobación, y guarda la clave de cada elemento para actualizar sin duplicar |
| `/delivery:generate-status-report` | Informe de avance para el cliente en PDF con tu marca, armado desde la bitácora, el estado, la cobertura y los defectos |

### Gestión del proyecto

Tampoco son pasos: acompañan la ejecución y cada una lleva su propio registro.

| Skill | Qué hace |
|---|---|
| `/delivery:kickoff-project` | Arranque de un proyecto contratado: acta de constitución, reunión de arranque y lista de lo que el cliente debe entregar para empezar |
| `/delivery:generate-project-plan` | Plan del proyecto: hitos, calendario calculado con capacidad y dependencias, ruta crítica, comunicaciones y línea base; con `actualizar` muestra la desviación |
| `/delivery:close-sprint` | Cierre de sprint: comprometido frente a terminado, velocidad, lo no terminado, revisión con el cliente, retrospectiva y acciones de mejora |
| `/delivery:track-budget` | Control de presupuesto: horas consumidas frente a presupuestadas, eficiencia frente al avance real y proyección al cierre |
| `/delivery:plan-release` | Salida a producción: contenido, paso a paso, reversión, lista de chequeo con recomendación de salir o no, y notas de la versión |
| `/delivery:process-meeting` | Acta de reunión desde audio o notas: decisiones, compromisos con responsable y fecha, preguntas respondidas; arrastra los pendientes de reuniones anteriores |
| `/delivery:manage-change-request` | Solicitud de cambio formal para el cliente: alcance, costo, plazo y opciones; registra la aprobación y deja el plan para llevarla al backlog |
| `/delivery:plan-uat` | Pruebas de aceptación del cliente: guiones en lenguaje de negocio, quién prueba qué, bitácora de resultados y acta de aceptación |
| `/delivery:triage-incident` | Incidente en producción: severidad, causa raíz en código y casos de prueba, plan de corrección y caso de regresión |
| `/delivery:manage-risks` | Registro vivo de riesgos con probabilidad, impacto, responsable, respuesta y disparador, actualizado desde la bitácora, los defectos y los atrasos |

### Marca propia

| Skill | Qué hace |
|---|---|
| `/delivery:create-brand-kit` | Kit de marca de tu empresa (logo, paleta con contrastes, tipografía, datos comerciales, voz) en `~/.delivery/marcas/<marca>/`, reutilizable en todos los proyectos. Lo usan la propuesta y cualquier documento que entregues a tu nombre. No es la identidad del cliente: esa va en `generate-design-system`. |

### Pasos del pipeline

| Paso | Skill | Entregable |
|---|---|---|
| 01 (opc.) | `/delivery:generate-proposal` | Propuesta comercial en PDF con tu marca, precios calculados con código y control de calidad por página, más la hoja interna |
| 02 | `/delivery:generate-user-stories` | Historias con criterios de aceptación (US, AC) |
| 02a (opc.) | `/delivery:generate-test-plan` | Plan y estrategia de pruebas: alcance, análisis de riesgo, niveles y tipos, automatización, criterios de entrada y salida. Lo leen los casos, la cobertura y la automatización |
| 03 | `/delivery:generate-test-cases` | Casos de prueba trazados a cada criterio (TC) |
| 04 | `/delivery:analyze-coverage` | Matriz US/AC/TC y brechas, por lote o acumulada con resumen por épica |
| 05 (opc.) | `/delivery:generate-design-system` | Tokens, componentes y vista previa HTML |
| 06 (opc.) | `/delivery:plan-sprint` | Historias asignadas a sprints |
| 07 | `/delivery:design-architecture` | Arquitectura, diagramas C4 y plan de módulos |
| 07a (opc.) | `/delivery:design-api-contracts` | Contratos OpenAPI trazados a las historias |
| 07b (opc.) | `/delivery:design-integration` | Diseño de cada integración externa, con simulador y pruebas de contrato |
| 08 | `/delivery:design-db-schema` | Esquema, diagrama ER y DDL |
| 09 | `/delivery:review-security` | Amenazas, hallazgos y requisitos de seguridad |
| 10 | `/delivery:implement-code` | Código en el repositorio y registro de implementación |
| 10a | `/delivery:review-code` | Revisión del código contra criterios, contratos y seguridad (en conversación nueva) |
| 10b (opc.) | `/delivery:audit-code-security` | Auditoría de seguridad del código contra la línea base (OWASP Top 10): escaneo, dependencias y revisión de endpoints, datos y permisos; hallazgos con corrección y modo `corregir` |
| 11 | `/delivery:validate-development` | Resultado de cada TC contra lo construido |
| 12 | `/delivery:setup-cicd-code` | Pipeline de integración y despliegue del código |
| 13 | `/delivery:select-automation-candidates` | Qué casos automatizar y en qué orden |
| 14 | `/delivery:explore-web-app` | Exploración con Playwright: selectores, mapa de pantallas, viabilidad de cada caso |
| 15 | `/delivery:scaffold-automation-framework` | Framework con page objects generados desde los selectores |
| 16 | `/delivery:automate-test-cases` | Pruebas automatizadas de UI y de API, una por TC |
| 17 | `/delivery:run-automated-tests` | Ejecución, resumen por TC y clasificación de fallas |
| 18 | `/delivery:report-defects` | Defectos por lote o consolidado de todos los sprints, CSV y creación opcional en Jira |
| 19 | `/delivery:setup-cicd-automation` | Pipeline de la automatización: PR, nocturno y post despliegue |

Una skill por conversación, o `/clear` entre pasos: el estado vive en los archivos, no en el chat.

Cada skill actúa con un rol de experto definido (por ejemplo, analista de pruebas senior en los casos de prueba, o arquitecto de APIs en los contratos) y dice al inicio qué skills requiere antes.

## El context pack por partes

Escribir todos los documentos de una vez los deja cortos. Por eso `/delivery:generate-context-pack`:

1. **Pregunta para qué actividades lo necesitas** (preventa, historias y pruebas, automatización, diseño y desarrollo) y genera solo los documentos que esas actividades leen. Las anclas (`customer-background`, `scope`, `domain`) van siempre.
2. **Trabaja por tandas** de hasta cinco documentos. Al final de cada una muestra lo que escribió y pregunta si continúa, para, ajusta o cambia el plan. El avance queda en `context-pack/_plan.json`: al ejecutarla de nuevo, incluso en otra conversación, sigue donde quedó.
3. **Comprueba que nada quede por fuera**: al cerrar, cada hecho de la evidencia debe estar citado en algún documento o en `context-pack/_no-incorporado.md` con su motivo.

Los documentos que no pediste se pueden sumar después (`/delivery:generate-context-pack security.md` o con otro perfil). Si un paso necesita uno que no existe, su preflight lo dice y da el comando.

Si sientes que la evidencia quedó corta, `/delivery:ingest-sources ampliar` vuelve sobre las fuentes que quedaron cortas, bloque por bloque (o `ampliar EV-003` para una en particular), y `check_evidence.py` muestra cuántos hechos salieron de cada fuente frente a su tamaño.

## Que nada se pierda en el camino

Hay un control en cada salto, y todos avisan qué quedó por fuera:

| Salto | Control | Qué comprueba |
|---|---|---|
| Material a evidencia | `check_evidence.py` | Hechos extraídos frente al tamaño de cada fuente; bloques sin procesar |
| Evidencia a context pack | `check_pack.py --cobertura` | Cada hecho está citado en un documento o descartado con motivo |
| Context pack a historias | `check_trace.py historias` | Cada regla `RN`, paso `PROC` y módulo `MOD` tiene una historia, o está en "Sin historia" con motivo |
| Historias a casos | `coverage.py` y `check_trace.py casos` | Cada criterio tiene caso; cada regla de la historia tiene un caso, y uno negativo |

`/delivery:verify-context-pack` califica el pack de 0 a 100 con 13 chequeos ponderados y guarda el historial, para ver si una versión mejora frente a la anterior.

## Dónde quedan los documentos y cómo abrirlos

- **Todo se guarda en la carpeta del proyecto**, en su lugar definitivo: `outputs/<paso>/<lote>/vN/` para cada entregable, `context-pack/` para el contexto y `outputs/_informes/`, `_cambios/`, `_cuestionarios/` y `_sync/` para lo demás. Ninguna skill deja un documento solo en la conversación: los demás pasos lo leen de ahí.
- **Cada skill termina con los enlaces** a los archivos que produjo, para abrirlos con un clic.
- **`outputs/index.html`** (y `outputs/INDICE.md`) es el índice de todos los entregables del proyecto, con su estado y un enlace a cada archivo. Se actualiza solo en cada cierre; ábrelo en el navegador y déjalo a la mano.
- En la aplicación de escritorio la sesión puede arrancar fuera de la carpeta del proyecto: las skills la ubican primero (la que contiene `.pipeline/`) y los scripts la encuentran desde cualquier directorio.

## El paso de desarrollo

`/delivery:implement-code` hace más que escribir historias:

1. **Arranca el proyecto** si el repositorio está vacío (`/delivery:implement-code arranque` para hacer solo esto): crea la estructura con el generador oficial del framework según el tipo de proyecto (aplicación web, web con servidor, API, móvil o monorepo) y la arquitectura, y deja la base lista: configuración por ambiente, lint, pruebas, migraciones, manejo de errores, autenticación en el servidor, cabeceras de seguridad, punto de salud, scripts y README. Verifica que instala, compila, pasa pruebas y arranca.
2. **Gestiona las dependencias**: parte de la necesidad, prefiere lo que ya trae el framework y lo que aprueba `tech-policy.md`, propone una tabla con el motivo de cada librería, instala con tu aprobación, fija versiones y audita vulnerabilidades.
3. **Implementa historia por historia** con una definición de hecho, y registra todo en `implementation-log.md`.

En un repositorio existente del cliente no reorganiza nada: sigue su estructura y sus librerías.

## Seguridad: prevenir y corregir con la misma lista

`.pipeline/seguridad-base.md` tiene 41 controles (`SB-01` a `SB-41`) en seis grupos: secretos y credenciales, base de datos y control de acceso, validación de datos, protección contra ataques, costos y operación, y revisión general. Están alineados con OWASP Top 10.

- **Prevención:** la arquitectura, los contratos y el esquema se diseñan con esos controles; la revisión de seguridad (09) dice cuáles aplican y dónde se resuelven; `implement-code` los aplica al escribir cada historia, corre el escáner antes de cada commit y deja un autochequeo en su registro; `review-code` lo comprueba en cada lote; el CI escanea secretos y dependencias.
- **Corrección:** `/delivery:audit-code-security` audita el repositorio completo contra la misma lista, incluido el historial de Git, y con `corregir` aplica las correcciones aprobadas.
- **Ajustes del proyecto:** lo que el cliente endurece, exceptúa o ya cumple va en `context-pack/security.md` y manda sobre la línea base.

Como desarrollo y auditoría usan la misma lista, la auditoría no falla por cosas que nadie pidió.

## Bitácora

`context-pack/progress.md` registra en orden lo que pasa en el proyecto: cada corrida que se cierra, cada decisión, cada pregunta respondida, cada lote, y una nota por sesión con lo que se habló y lo que quedó pendiente. `active-context.md` dice cómo está el proyecto hoy; la bitácora dice cómo llegó ahí. `/delivery:pipeline-status historial` la resume.

## Gestión del proyecto: registros que se alimentan entre sí

| Registro | Dónde queda | Lo lleva | ID |
|---|---|---|---|
| Actas y compromisos | `outputs/_reuniones/` (`compromisos.md`) | `/delivery:process-meeting` | CMP-NNN |
| Solicitudes de cambio | `outputs/_solicitudes-cambio/` (`registro.md`) | `/delivery:manage-change-request` | SC-NNN |
| Aceptación del cliente | `outputs/_uat/<entrega>/` | `/delivery:plan-uat` | UAT-NNN |
| Incidentes | `outputs/_incidentes/` (`registro.md`) | `/delivery:triage-incident` | INC-NNN |
| Riesgos | `outputs/_riesgos/` (`registro-riesgos.md`) | `/delivery:manage-risks` | R-NN |
| Arranque | `outputs/_arranque/` (acta de constitución) | `/delivery:kickoff-project` | - |
| Plan del proyecto | `outputs/_plan-proyecto/<fecha>/` y la decisión `plan.linea_base` | `/delivery:generate-project-plan` | - |
| Cierres de sprint | `outputs/_cierres/` (`metricas.md`, `acciones-mejora.md`) | `/delivery:close-sprint` | AM-NNN |
| Presupuesto | `outputs/_presupuesto/` (`presupuesto.csv`, `horas.csv`, cortes) | `/delivery:track-budget` | - |
| Salidas a producción | `outputs/_releases/<versión>/` | `/delivery:plan-release` | - |

Cómo se conectan: una reunión deja compromisos y puede destapar un cambio o un riesgo; un compromiso vencido del cliente es una señal para el registro de riesgos; lo que el cliente reporta en UAT se separa en defectos y cambios; un incidente deja un caso de regresión y, si se repite, un riesgo. La velocidad de cada cierre de sprint alimenta el plan del proyecto y el avance real con el que se mide el presupuesto; la salida a producción exige la aceptación del cliente y cero defectos graves. El informe de avance lee estos registros, salvo el presupuesto y la retrospectiva, que son internos. Ninguna aplica cambios al proyecto sin tu aprobación: proponen, y las decisiones y preguntas abiertas se registran solo cuando las confirmas.

## Automatizar un sistema que ya existe

1. `/delivery:init-project` con la etapa "pruebas de un sistema existente": omite los pasos de construcción.
2. `/delivery:ingest-sources` con documentos, Jira y la URL del entorno de pruebas, que se recorre en solo lectura.
3. Context pack, verificación y preguntas abiertas.
4. `/delivery:generate-user-stories login` (el lote con las funcionalidades a probar), que describe el comportamiento actual.
5. Casos, cobertura, candidatos, exploración web, framework, automatización, ejecución, defectos y CI/CD.

## Trabajar por lotes

Con muchas historias no conviene cargar todo en cada paso. Las historias se escriben una vez para todo el `backlog` (es liviano) y lo pesado se hace por lotes con nombre:

1. Define el lote: `/delivery:plan-sprint` (con capacidad y fechas) o, rápido, `/delivery:pipeline-status alcance sprint-01 US-001..US-010`.
2. Corre los pasos con ese alcance: `/delivery:generate-test-cases sprint-01`, `/delivery:analyze-coverage sprint-01`, etc. Cada uno lee solo esas historias y escribe en `outputs/<paso>/sprint-01/v1/`.
3. Para seguir con más historias:
   - **Lote nuevo** (recomendado si el anterior ya está revisado): `alcance sprint-02 US-011..US-025`. Carpetas nuevas, `sprint-01` intacto.
   - **Ampliar el lote**: `alcance` con `add`. Los artefactos de `sprint-01` quedan desactualizados y se regeneran en `v2` con todas las historias.

### Qué lee un paso cuando trabaja un sprint

| Nivel | Qué es | Cómo se usa |
|---|---|---|
| Completo | El context pack y los entregables de proyecto (plan de pruebas, arquitectura, contratos, esquema, framework) | Siempre enteros |
| Del lote | Las historias del sprint y sus entregables anteriores | Enteros; sobre ellos se produce |
| De referencia | Historias de las que el sprint depende, las que dependen de él, las que comparten una regla o un paso de proceso, y lo que otros sprints ya hicieron con ellas | Se leen para ser coherente, reutilizar y prever regresión; no se produce nada para ellas |
| No se lee | El resto | Se ignora |

Las dependencias salen del campo `- depende de:` de cada historia, y las funcionalidades relacionadas, de las reglas y pasos de proceso que comparten. `pipeline.py alcance contexto sprint-02` muestra los cuatro niveles para un sprint, y `pipeline.py alcance dependencias` comprueba que ningún sprint dependa de una historia de un sprint posterior. Los casos de prueba de cada sprint dejan una lista de "Regresión sugerida" con los casos de otros sprints que conviene volver a ejecutar.

En la automatización, las pantallas se exploran por sprint pero conservan un mismo ID en todo el proyecto, y el framework genera sus page objects con las pantallas de todos los sprints (`merge_selectors.py`).

`vN` es una versión nueva del mismo lote (correcciones, respuestas a preguntas, historias agregadas); `sprint-NN` es otro lote. Los pasos de diseño (arquitectura, contratos, esquema, framework) son de alcance `proyecto`: si un lote nuevo trae módulos nuevos, se regeneran en `vN+1`.

## Cuando llega información nueva

1. Material a `inputs/`, `/delivery:ingest-sources` y `/delivery:generate-context-pack` (regenera solo los documentos afectados y guarda la versión anterior en `context-pack/_historial/`).
2. `/delivery:generate-user-stories backlog`: nueva versión del backlog que conserva los IDs y agrega las historias nuevas.
3. `/delivery:analyze-change`: qué historias cambiaron y en qué sprints están, qué artefactos regenerar en orden, cuáles siguen vigentes y cuánto cuesta el cambio.
4. `/delivery:plan-sprint` para ubicar las historias nuevas (un sprint nuevo o los próximos) y luego el plan de regeneración.

La detección es **por historia**: si el backlog pasa a v2 con 5 historias nuevas y una modificada, solo queda desactualizado el lote que contiene la modificada. Un cambio que solo toca el context pack deja los artefactos **por revisar**, no desactualizados: se regeneran o se marcan como vigentes.

## El ciclo de regeneración

Cuando a una skill le falta información, registra una pregunta `OQ-NNN` en vez de inventar. `/delivery:open-questions` lleva la respuesta al documento del context pack que corresponde. El script de estado detecta por huella que ese documento cambió y marca como DESACTUALIZADOS los entregables que lo leyeron, y en cascada los que dependen de ellos. Al volver a ejecutar la skill, trabaja en modo REGENERAR: crea `vN+1`, conserva los IDs y documenta qué cambió. Lo mismo pasa si cambia una decisión, por ejemplo el framework de automatización.

## Estructura de cada proyecto

```
inputs/          material crudo; sources.md lista repos, Jira y enlaces
evidence/        EV-NNN con sus hechos, y el texto completo de cada fuente en _texto/
context-pack/    hasta 22 documentos temáticos + índice, estado, decisiones y preguntas
outputs/<paso>/<alcance>/vN/   entregables versionados con _meta.json
outputs/_<registro>/           gestión del proyecto: reuniones, cambios, riesgos, UAT, cierres, plan, presupuesto, releases, incidentes
.pipeline/       pipeline.json, protocolo.md, plantillas/, scripts/
```

## Los scripts de `.pipeline/scripts/`

Las skills los ejecutan solas; no hace falta usarlos a mano. Solo leen y escriben archivos del proyecto.

| Script | Para qué |
|---|---|
| `pipeline.py` | Versiones, estados por historia, lotes, dependencias, decisiones, preguntas abiertas, plan del context pack por tandas, bitácora, registro de sincronización, comparación de backlog, impacto e IDs |
| `check_evidence.py` | Completitud de la ingesta: hechos extraídos frente al tamaño de cada fuente y bloques sin procesar |
| `check_pack.py` | Verificación automática del context pack: estructura, citas, secciones delgadas y cobertura de los hechos de la evidencia |
| `coverage.py` | Matriz de cobertura entre historias y casos, por lote o acumulada, con resumen por épica |
| `check_trace.py` | Trazabilidad: cada regla, paso de proceso y módulo del context pack termina en una historia, y cada regla y paso de una historia en un caso de prueba |
| `score_pack.py` | Puntaje ponderado de la verificación del context pack y su historial |
| `security_scan.py` | Escaneo estático de seguridad: secretos en el código y en el historial, SQL concatenado, CORS abierto, tokens en el navegador y más, con el control `SB-NN` de cada señal |
| `score_review.py` | Puntaje ponderado de la revisión de un entregable o de una auditoría, comparado con la versión anterior |
| `export_cases.py` | Exporta historias y casos a CSV para importarlos en la herramienta de gestión |
| `budget.py` | Corte de presupuesto: horas consumidas frente a presupuestadas, ritmo, eficiencia y proyección al cierre |
| `merge_selectors.py` | Une las pantallas exploradas en todos los lotes, da el siguiente ID libre y detecta choques |
| `check_selectors.py` | Verificación de `selectors.json` de la exploración web |
| `summarize_results.py` | Resumen por caso de cualquier reporte JUnit |
| `transcribe.py` | Transcripción local de audios |

Además, `create-brand-kit` trae `brand_tools.py` (colores, paleta, contraste, logo blanco, tokens) y `generate-proposal` trae `estimar.py` (precios, IVA y pagos) y `construir_pdf.py` (PDF, metadatos e imágenes para el control de calidad).

## Context pack

- **Negocio**: customer-background, scope, domain, business-processes, constraints, commercial, risks.
- **Producto**: ux-design.
- **Técnico**: tech-policy, arch-standards, codebase-map, integrations, data-model, coding-standards, infrastructure, environments, validation-tools, security.
- **Calidad**: test-standards, test-severity-priority, test-data-policy, automation-standards.
- **Gobierno**: decisions, open-questions.
- **Navegación**: context-pack-index, active-context.

Cada documento temático tiene, además de sus secciones propias: reglas obligatorias, reglas recomendadas, restricciones y prohibiciones, ejemplos válidos e inválidos, excepciones, supuestos, pendientes y trazabilidad.
