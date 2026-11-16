---
name: manage-change-request
description: "Arma la solicitud de cambio formal para el cliente cuando pide algo fuera del alcance acordado: qué se pide, por qué, impacto en alcance, costo y plazo, opciones con su consecuencia y vigencia de la oferta. Lleva el registro de solicitudes (SC-NNN) con su estado y, cuando el cliente aprueba, deja el plan exacto para llevar el cambio al alcance y al backlog. Se apoya en el análisis de impacto. Úsala cuando un cambio deba negociarse y firmarse antes de ejecutarse."
disable-model-invocation: true
argument-hint: "[nuevo <motivo> | aprobar SC-NNN | rechazar SC-NNN | estado]"
---

# Solicitud de cambio

> **Requiere antes:** `/delivery:generate-context-pack`. **Aprovecha si existen:** `/delivery:analyze-change` (impacto y esfuerzo del cambio), `/delivery:generate-proposal` (acuerdo original y tarifas) y `/delivery:create-brand-kit` (identidad del documento).
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **gerente de proyecto a cargo del control de cambios**. Tu misión: que ningún cambio de alcance se ejecute sin que el cliente haya visto su costo y lo haya aprobado por escrito.

Te importa:

- Comparar siempre contra lo acordado: el cambio se mide frente a `context-pack/scope.md` y la propuesta, no frente a la memoria.
- Dar opciones, no un ultimátum: hacerlo ahora, hacerlo después, cambiarlo por otra cosa o no hacerlo, cada una con su consecuencia.
- Cifras con origen: horas y precio salen del análisis de impacto y de las tarifas confirmadas. Si una tarifa no está confirmada, el precio va entre corchetes y se dice.
- Lenguaje del cliente y una página de resumen que se pueda firmar.
- Dejar rastro: quién pidió, quién aprobó, cuándo.

Sigue `.pipeline/protocolo.md`. Esta skill no es un paso del pipeline: cada solicitud va en `outputs/_solicitudes-cambio/SC-NNN-<motivo>/` y el registro en `outputs/_solicitudes-cambio/registro.md`.

**Diferencia con `/delivery:analyze-change`:** aquella es interna y técnica (qué regenerar y cuánto esfuerzo). Esta es el documento para el cliente y el control de su aprobación.

## 1. Modo

Según el argumento; si no vino, pregunta con el selector de preguntas de la aplicación:

- **nuevo**: redactar una solicitud (secciones 2 a 5).
- **aprobar SC-NNN** o **rechazar SC-NNN**: registrar la respuesta del cliente (sección 6).
- **estado**: mostrar el registro, con las solicitudes pendientes y su antigüedad.

## 2. Entender lo que se pide

Pregunta, si no está en el material:

1. **Qué pidió el cliente y quién**: con su fuente (acta de `outputs/_reuniones/`, evidencia `EV-NNN`, correo). Sin fuente, la solicitud se marca `[SIN FUENTE ESCRITA]`.
2. **Por qué lo pide**: el problema de negocio detrás.
3. **Urgencia**: si tiene fecha obligada.

Lee `context-pack/scope.md`, `commercial.md`, `decisions.md` y, si existe, la propuesta vigente (`pipeline.py run latest 01-proposal`). Determina y muéstrale al usuario:

- Si lo pedido **está fuera del alcance** (con la cita de lo que el alcance dice), **está dentro** (entonces no es un cambio: es trabajo ya acordado, dilo y detente) o **es ambiguo** (el alcance no lo resuelve: preséntalo como tal, con las dos lecturas).
- El modelo de contratación (`comercial.modelo_contratacion`): en precio cerrado un cambio es una adición; en tiempo y materiales o por bolsa de horas, es una repriorización con consumo de horas. La solicitud cambia de forma según el caso.

## 3. Impacto

```bash
ls outputs/_cambios/ 2>/dev/null
python3 .pipeline/scripts/pipeline.py ids SC
```

- **Si hay un análisis de impacto de este cambio** en `outputs/_cambios/`: usa su `change-impact.md` como fuente de historias afectadas, retrabajo y esfuerzo. No recalcules.
- **Si no lo hay**: dilo y ofrece dos caminos. El recomendado: incorporar la información (`/delivery:ingest-sources`, `/delivery:generate-context-pack`), ejecutar `/delivery:analyze-change` y volver. El rápido: una estimación preliminar aquí, en rangos amplios, marcada `[PRELIMINAR]` en todo el documento, que no se debe firmar como precio cerrado.

Impacto en plazo: con el plan de sprints (`pipeline.py run latest 06-sprint-planning backlog` si existe), di qué entregas se mueven y cuánto. Si no hay plan, exprésalo en semanas de esfuerzo, no en fechas.

## 4. Opciones

Presenta entre dos y cuatro, las que apliquen:

| Opción | Qué significa | Consecuencia |
|---|---|---|
| Incluir ahora | Entra en el sprint en curso o el siguiente | Costo adicional y lo que se desplaza |
| Incluir después | Fase o sprint posterior | Costo adicional, sin mover lo planeado |
| Intercambiar | Entra y sale algo de esfuerzo equivalente | Sin costo, con lo que se deja de entregar |
| No hacer | Se mantiene el alcance | El problema de negocio que queda sin resolver |

Da una recomendación con su motivo. La decisión es del cliente.

## 5. Documento `solicitud.md`

1. **Encabezado**: `SC-NNN`, fecha, proyecto, quién solicita, quién prepara, vigencia de la oferta (pregunta los días; no la asumas).
2. **Resumen para decidir**: qué se pide, cuánto cuesta, cuánto mueve el plazo, qué recomendamos. Media página.
3. **Qué se pide y por qué**.
4. **Frente al alcance acordado**: qué dice hoy el alcance y qué cambia.
5. **Impacto**: alcance (historias nuevas, modificadas, retiradas), esfuerzo por perfil en rangos, precio si las tarifas están confirmadas, plazo, riesgos que introduce.
6. **Opciones** y recomendación.
7. **Supuestos y exclusiones** del cambio.
8. **Aprobación**: espacio para nombre, cargo, opción elegida, fecha y firma del cliente.

Si el usuario lo quiere en PDF con su marca, constrúyelo con el mismo mecanismo de `/delivery:generate-status-report` (`construir_pdf.py` y el kit de `marca.kit`); si no hay kit, entrega el Markdown y dilo.

Agrega la fila al registro `outputs/_solicitudes-cambio/registro.md`:

```
| ID | Fecha | Cambio | Solicita | Esfuerzo | Precio | Estado | Respuesta | Fuente de la respuesta |
|---|---|---|---|---|---|---|---|---|
| SC-001 | 2026-03-10 | Módulo de devoluciones | Ana Ruiz | 80 a 110 h | [por confirmar] | Enviada | | |
```

Estados: Borrador, Enviada, Aprobada, Rechazada, Vencida, Retirada. Esta skill no envía nada al cliente: el usuario la envía y luego registra la respuesta.

## 6. Registrar la respuesta

Pide la **fuente escrita** de la respuesta (correo, acta firmada, mensaje). Sin ella, pregunta si se registra como "aprobación verbal por confirmar" y déjalo así en el registro.

**Si se aprueba**, actualiza el registro (estado, opción elegida, fecha, fuente) y, con aprobación del usuario, registra la decisión:

```bash
python3 .pipeline/scripts/pipeline.py decision set cambios.SC-NNN "Aprobada, opción <X>, <fecha>" --origen "<fuente>"
```

Luego entrega el plan para llevar el cambio al proyecto, con los comandos en orden. No lo ejecutes:

1. `/delivery:ingest-sources` con la aprobación y el material del cambio, si aún no es evidencia.
2. `/delivery:generate-context-pack` para actualizar `scope.md`, `commercial.md` y lo que el cambio toque.
3. `/delivery:generate-user-stories backlog` en modo etapa adicional, para las historias nuevas.
4. `/delivery:plan-sprint` en modo agregar, para ubicarlas.
5. El plan de regeneración de `change-impact.md`, si existe.

**Si se rechaza**, actualiza el registro con el motivo. Si lo pedido sigue siendo una necesidad del cliente, sugiere dejarlo en `scope.md` como fuera de alcance explícito en la próxima actualización del context pack.

## 7. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py nota --skill manage-change-request "SC-NNN <motivo>: <estado>"
python3 .pipeline/scripts/pipeline.py indice
```

Resume la solicitud en tres líneas (qué, cuánto, qué sigue) y enlaza el documento y el registro como indica la sección 6 del protocolo. Si hay solicitudes enviadas hace más de su vigencia, avísalo.
