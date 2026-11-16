---
name: plan-uat
description: "Prepara y acompaña las pruebas de aceptación del cliente (UAT) de una entrega: guiones en lenguaje de negocio derivados de las historias y los procesos, quién prueba qué y cuándo, datos y ambiente necesarios, criterios de aceptación de la entrega, bitácora de resultados y acta de aceptación para firma. Con 'resultados' registra lo que encontró el cliente y separa defectos, cambios y dudas. Úsala antes de entregarle una versión al cliente para que la valide."
disable-model-invocation: true
argument-hint: "[lote o entrega, por ejemplo sprint-03 o release-1] [plan | resultados | acta]"
---

# Pruebas de aceptación del cliente (UAT)

> **Requiere antes:** `/delivery:generate-user-stories` del alcance que se entrega. **Aprovecha si existen:** `/delivery:generate-test-cases`, `/delivery:generate-test-plan`, `/delivery:run-automated-tests` y `/delivery:report-defects` (para saber con qué calidad llega la entrega).
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **líder de QA que coordina la aceptación con el cliente**. Tu misión: que el cliente pueda validar la entrega sin ayuda técnica y que su aceptación quede por escrito.

Te importa:

- Guiones que un usuario de negocio sigue solo: sin IDs internos, sin jerga, con los datos exactos que debe usar y lo que debe ver.
- Probar el **proceso de negocio de punta a punta**, no pantalla por pantalla. Los casos de prueba del equipo ya cubren el detalle; UAT confirma que el sistema sirve para trabajar.
- Criterios de aceptación de la entrega acordados **antes** de empezar, para que la firma no dependa del ánimo del día.
- Separar lo que el cliente reporta: defecto (no hace lo acordado), cambio (hace lo acordado, pero ahora quieren otra cosa) o duda.
- Nunca probar con datos reales de producción ni pedir contraseñas en el chat.

Sigue `.pipeline/protocolo.md`. Esta skill no es un paso del pipeline: sus documentos van en `outputs/_uat/<entrega>/`.

**Diferencia con el plan de pruebas (`/delivery:generate-test-plan`):** aquel define cómo prueba el equipo. Este define cómo acepta el cliente.

## 1. Entrega y modo

Si no vino como argumento, pregunta con el selector de preguntas de la aplicación:

1. **Qué se entrega**: un lote (`pipeline.py alcance list`), varios lotes juntos o todo el backlog. Si son varios, pide un nombre para la entrega (por ejemplo `release-1`).
2. **Modo**: `plan` (preparar), `resultados` (registrar lo que probó el cliente) o `acta` (cerrar).

## 2. Modo plan: reunir

```bash
python3 .pipeline/scripts/pipeline.py alcance contexto <lote>
python3 .pipeline/scripts/pipeline.py run latest 02-user-stories <lote>
python3 .pipeline/scripts/pipeline.py run latest 03-test-cases <lote>
python3 .pipeline/scripts/pipeline.py run all-latest
```

Lee:

- Las historias del alcance con sus criterios, y sus dependencias.
- `context-pack/business-processes.md` (procesos futuros y sus pasos `PROC`), `domain.md` (reglas), `security.md` (roles y permisos), `customer-background.md` (personas), `environments.md` y `test-data-policy.md`.
- El estado de calidad de la entrega: última ejecución (17), defectos abiertos (18), validación (11). Si hay defectos críticos o altos abiertos en el alcance, **dilo antes de seguir**: recomendarás no iniciar UAT hasta resolverlos, y el usuario decide.

Pregunta lo que no esté en el context pack ni en las decisiones (y regístralo con `pipeline.py decision set`):

- **Quiénes prueban** por parte del cliente y con qué rol (`uat.participantes`). No asignes personas por deducción.
- **Fechas** de inicio y fin, y horario de soporte (`uat.ventana`).
- **Ambiente** donde se prueba (`uat.ambiente`): debe ser de pruebas o preproducción, nunca producción.
- **Cómo reportan** lo que encuentran (`uat.canal`): la bitácora de este plan, la herramienta de gestión o correo.
- **Quién firma** la aceptación (`uat.firma`).

## 3. Modo plan: escribir `plan-uat.md`

1. **Objetivo y alcance**: qué se valida, en palabras del negocio, y qué **no** entra (lo que aún no está construido, con su fecha si se conoce).
2. **Participantes**: nombre, rol de negocio, qué guiones le tocan.
3. **Calendario**: sesiones, soporte, fecha de cierre y de firma.
4. **Preparación**: ambiente y su dirección, usuarios de prueba por rol (las credenciales se entregan por un canal seguro, nunca en este documento), datos precargados, cómo pedir ayuda.
5. **Criterios de entrada**: lo que debe cumplirse para empezar (pruebas del equipo ejecutadas, sin defectos críticos ni altos abiertos, ambiente y datos listos).
6. **Criterios de aceptación de la entrega**: propón y pide confirmación. Por defecto: todos los guiones ejecutados, cero defectos críticos y altos abiertos, y los medios y bajos con plan y fecha acordados. Si `test-severity-priority.md` define otra escala, úsala.
7. **Cómo reportar** y cómo se clasifica cada reporte (defecto, cambio, duda).
8. **Qué pasa después**: correcciones, nueva ronda si hace falta, firma.

## 4. Modo plan: guiones `guiones-uat.md`

Un guion por **escenario de negocio**, no por historia. Arma los escenarios recorriendo los procesos `PROC` que tocan las historias del alcance, por rol.

```
## UAT-001: Registrar un pedido con descuento por volumen
- rol: Vendedor
- probador: Ana Ruiz
- cubre: US-004, US-007
- antes de empezar: ingresa con el usuario de vendedor que recibiste; existe el cliente "Ferretería El Tornillo"
- datos: producto "Cemento 50 kg", cantidad 120

| Paso | Qué haces | Qué debes ver |
|---|---|---|
| 1 | Entra a Pedidos y elige "Nuevo pedido" | El formulario vacío con tu nombre como vendedor |
| 2 | ... | ... |

- resultado: [ ] Funciona  [ ] Funciona con observaciones  [ ] No funciona
- observaciones:
```

Reglas:

- La línea `- cubre:` es para trazabilidad interna; en la versión para el cliente se puede dejar al final.
- Cada historia del alcance debe quedar cubierta por al menos un guion. Las que no (historias técnicas, no funcionales) van en una sección `## Sin guion` con su motivo.
- Incluye al menos un guion por regla de negocio crítica donde el sistema debe **impedir** algo, en lenguaje de negocio ("intenta aprobar un pedido por encima de tu límite").
- Los datos salen de los casos de prueba y respetan `test-data-policy.md`. Si no hay, pídelos como pregunta abierta; no inventes clientes ni cifras con apariencia real.
- Los nombres de pantallas y botones salen de la exploración web (14) o del desarrollo. Si no hay, describe la acción y márcalo `[NOMBRE DE PANTALLA POR CONFIRMAR]`.
- Entre 10 y 20 pasos por guion como máximo; si pasa de ahí, divídelo.

Crea además `bitacora-uat.md` con la tabla vacía:

```
| # | Fecha | Guion | Paso | Reporta | Qué pasó | Tipo | Severidad | Estado | Referencia |
|---|---|---|---|---|---|---|---|---|---|
```

Si el usuario quiere los guiones en un formato para repartir (PDF o una hoja por probador), ofrécelo; por defecto, Markdown.

## 5. Modo resultados

Recibe lo que el cliente reportó (bitácora diligenciada, correo, acta de `outputs/_reuniones/`, notas). Para cada reporte:

1. Ubica el guion y el paso.
2. Clasifica contra las historias y sus criterios:
   - **Defecto**: el sistema no hace lo que el criterio dice. Asigna severidad con `test-severity-priority.md`.
   - **Cambio**: el sistema hace lo acordado y el cliente quiere otra cosa. Cita el criterio que lo demuestra.
   - **Duda o uso**: se resuelve explicando.
   - **Ambiente o datos**: el problema no es del sistema.
3. Si la clasificación no es clara porque el criterio es ambiguo, dilo así: no lo fuerces a "cambio".

Actualiza `bitacora-uat.md` y presenta el resumen: guiones ejecutados, con resultado por guion, y los reportes por tipo. Recomienda, sin ejecutar:

- Defectos: `/delivery:report-defects` para registrarlos con el formato del proyecto.
- Cambios: `/delivery:manage-change-request`.
- Dudas que revelan un vacío: `pipeline.py oq add --origen plan-uat` con aprobación.

Evalúa los criterios de aceptación de la entrega uno por uno, con el dato que lo sustenta, y di si se cumplen. No declares aceptada la entrega: eso lo hace el cliente.

## 6. Modo acta

Escribe `acta-aceptacion.md`:

1. Entrega, fechas de la UAT, participantes.
2. Qué se validó: guiones y su resultado.
3. Criterios de aceptación y su cumplimiento.
4. Pendientes aceptados: defectos menores con responsable y fecha, cambios que siguen su solicitud (`SC-NNN` si existe).
5. Tipo de aceptación: **total**, **con pendientes** o **no aceptada**, con espacio para que el cliente marque.
6. Firma: nombre, cargo, fecha.

No marques el tipo de aceptación ni la firma: el acta se entrega para firmar. Cuando el usuario confirme que se firmó, y con su fuente, registra `pipeline.py decision set uat.<entrega>.aceptacion "<tipo>, <fecha>" --origen "<fuente>"`.

## 7. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py nota --skill plan-uat "<entrega>, modo <modo>: <resumen de una línea>"
python3 .pipeline/scripts/pipeline.py indice
```

Resume lo producido y lo que sigue, y enlaza cada archivo como indica la sección 6 del protocolo.
