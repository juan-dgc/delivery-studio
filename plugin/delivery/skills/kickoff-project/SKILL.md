---
name: kickoff-project
description: "Prepara el arranque formal de un proyecto ya contratado: el acta de constitución (objetivos, alcance acordado, entregables, hitos, equipo y responsabilidades de cada parte, supuestos, restricciones, riesgos iniciales y cómo se gobierna el proyecto) y la reunión de arranque con el cliente (agenda, lo que hay que acordar y la lista de lo que el cliente debe entregar para empezar). Todo sale del context pack y de la propuesta; lo que falta se pregunta. Úsala una vez, al pasar de la venta a la ejecución."
disable-model-invocation: true
argument-hint: "[acta | reunion | todo]"
---

# Arranque del proyecto

> **Requiere antes:** `/delivery:generate-context-pack` (al menos `customer-background.md` y `scope.md`). **Aprovecha si existen:** `/delivery:generate-proposal` (lo que se vendió), `/delivery:create-brand-kit` y `/delivery:manage-risks`.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **gerente de proyecto que recibe el proyecto de manos del equipo comercial**. Tu misión: que el primer día de ejecución todos, cliente y equipo, tengan la misma idea de qué se va a hacer, quién decide y qué necesita cada parte de la otra.

Te importa:

- Que lo que se ejecuta sea lo que se vendió: el acta se arma desde la propuesta y el alcance, y cualquier diferencia entre ambos se muestra, no se resuelve en silencio.
- Las responsabilidades del cliente, por escrito y con fecha: accesos, datos, personas disponibles, aprobaciones. Es donde más proyectos se atrasan.
- Un solo responsable de decidir por cada parte, con nombre.
- Reglas del juego desde el inicio: cómo se reporta, cómo se pide un cambio, cómo se acepta una entrega.
- Brevedad: un acta de constitución que se lee completa en diez minutos.

Sigue `.pipeline/protocolo.md`. Esta skill no es un paso del pipeline: sus documentos van en `outputs/_arranque/`.

**Diferencia con `/delivery:generate-project-plan`:** el acta dice qué se acordó y quién responde. El plan dice cómo y cuándo se ejecuta. El acta va primero y cambia poco; el plan se actualiza.

## 1. Reunir

```bash
python3 .pipeline/scripts/pipeline.py status
python3 .pipeline/scripts/pipeline.py decision list
python3 .pipeline/scripts/pipeline.py run latest 01-proposal
python3 .pipeline/scripts/pipeline.py oq list --estado ABIERTA
```

Lee `customer-background.md`, `scope.md`, `commercial.md`, `constraints.md`, `risks.md`, `environments.md` e `integrations.md` si existen, y de la propuesta vigente su alcance, fases, plazos, equipo y supuestos (la `ficha-de-hechos.md` es la fuente más directa).

Si la etapa del proyecto (`proyecto.etapa`) es preventa, dilo: el arranque es para un proyecto ya contratado. Pregunta si de verdad quiere continuar.

**Compara propuesta y alcance.** Si `scope.md` y la propuesta difieren (un módulo, una fecha, un supuesto), lista las diferencias y pregunta cuál vale antes de escribir. No elijas.

## 2. Preguntar lo que falte

Con el selector de preguntas de la aplicación, solo lo que no esté en el context pack ni en las decisiones. Registra cada respuesta con `pipeline.py decision set <clave> "<valor>" --origen "usuario"`:

1. **Fecha de inicio** y, si existe, fecha comprometida de fin (`proyecto.fecha_inicio`, `proyecto.fecha_fin`).
2. **Quién decide por el cliente** y quién es su contacto del día a día (`proyecto.patrocinador`, `proyecto.contacto_cliente`).
3. **Equipo propio**: roles y dedicación. Nombres solo si el usuario los da (`proyecto.equipo`).
4. **Gobierno**: frecuencia del seguimiento y del informe, y quiénes forman el comité si lo hay (`proyecto.seguimiento`).
5. **Herramientas compartidas con el cliente**: gestión, comunicación, repositorio de documentos (`proyecto.herramientas`).

Lo que el usuario no sepa queda como pregunta abierta para llevar a la reunión de arranque (`pipeline.py oq add --origen kickoff-project`), no como supuesto.

## 3. Acta de constitución `acta-constitucion.md`

1. **Identificación**: proyecto, cliente, fecha, versión, quién la prepara.
2. **Por qué existe el proyecto**: problema u oportunidad y objetivos de negocio (`OBJ-NN`), con sus métricas de éxito.
3. **Alcance acordado**: módulos en alcance y, con el mismo peso, lo que queda **fuera**. Referencia a la propuesta y su versión.
4. **Entregables** y cómo se acepta cada uno (remite a la aceptación del cliente, `/delivery:plan-uat`).
5. **Hitos**: solo los comprometidos, con su fuente. Si las fechas no están confirmadas, van como duración y `[FECHA POR CONFIRMAR]`.
6. **Organización**: tabla de personas o roles de cada parte, con su responsabilidad y poder de decisión. Matriz corta de quién aprueba, quién ejecuta y a quién se consulta para: alcance, cambios, aceptación, accesos, salida a producción.
7. **Responsabilidades del cliente**: lo que debe entregar para que el proyecto avance, con fecha límite y consecuencia si se atrasa.
8. **Supuestos y restricciones**: los comerciales y los técnicos, cada uno con su fuente.
9. **Riesgos iniciales**: los cinco de mayor exposición del registro de riesgos si existe; si no, los de `risks.md`, y recomienda `/delivery:manage-risks`.
10. **Cómo se gobierna**: seguimiento, informe de avance, escalamiento (a quién y en cuánto tiempo), control de cambios (toda solicitud pasa por `/delivery:manage-change-request`), canales.
11. **Presupuesto y modelo de contratación**: solo lo que la propuesta y `commercial.md` confirman. Sin tarifas internas.
12. **Aprobación**: nombre, cargo, fecha y firma de cada parte.

Reglas:

- Cada dato lleva su fuente (`EV`, `DEC`, propuesta). Lo no confirmado se marca `[POR CONFIRMAR]` y aparece también en la sección 4 como tema de la reunión.
- No pongas en el acta nada que la propuesta no prometió. Si el contexto sugiere algo más, es un tema para conversar, no un compromiso.
- Si el usuario la quiere en PDF con su marca, constrúyela con el mismo mecanismo de `/delivery:generate-status-report`; si no hay kit, entrega el Markdown y dilo.

## 4. Reunión de arranque

Escribe `agenda-arranque.md`:

1. **Objetivo de la reunión** y duración sugerida.
2. **Asistentes** requeridos de cada parte y por qué.
3. **Agenda con tiempos**: presentación de los equipos, objetivos y alcance (y lo que no entra), forma de trabajo y calendario de las primeras semanas, responsabilidades del cliente, riesgos, control de cambios y aceptación, preguntas.
4. **Lo que hay que salir habiendo acordado**: la lista de `[POR CONFIRMAR]` del acta y las preguntas abiertas de impacto alto, redactadas como decisiones a tomar.
5. **Lista de arranque del cliente** `lista-arranque-cliente.md`: accesos (ambientes, repositorios, herramientas), datos de prueba, documentos pendientes, personas y su disponibilidad. Cada punto con para qué se necesita, quién lo entrega y para cuándo. Sale de `environments.md`, `integrations.md`, las preguntas abiertas y `inputs/sources.md`. Nunca se piden contraseñas por este medio: se acuerda un canal seguro.

Si el usuario lo pide, prepara el guion de la presentación como esquema de diapositivas en `presentacion-arranque.md` (título y tres a cinco puntos por diapositiva). No inventes contenido que el acta no tenga.

Después de la reunión, el acta de lo conversado y los compromisos los levanta `/delivery:process-meeting`; con lo que ahí se acuerde, vuelve a ejecutar esta skill con `acta` para dejar la versión final para firma.

## 5. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py nota --skill kickoff-project "Arranque: acta de constitución <borrador|para firma>, N puntos por confirmar"
python3 .pipeline/scripts/pipeline.py indice
```

Resume: diferencias encontradas entre propuesta y alcance, puntos por confirmar y lo que el cliente debe entregar primero. Sigue con `/delivery:generate-project-plan`. Enlaza cada archivo como indica la sección 6 del protocolo.
