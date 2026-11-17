---
name: generate-status-report
description: "Arma el informe de avance del proyecto para el cliente, semanal, de cierre de sprint o de cierre de fase, a partir de lo que ya registró el pipeline: bitácora, estado de los pasos, cobertura, ejecución de pruebas, defectos, preguntas abiertas y riesgos. Entrega un PDF con tu kit de marca y su fuente editable: qué se entregó, cómo va frente al plan, indicadores de calidad, riesgos y qué decisiones se necesitan del cliente. No genera información nueva: resume y cita. Úsala cuando necesites reportar el estado al cliente."
disable-model-invocation: true
argument-hint: "[semanal | sprint <lote> | fase] [desde AAAA-MM-DD] [hasta AAAA-MM-DD]"
---

# Informe de avance

> **Requiere antes:** `/delivery:init-project` y al menos un paso ejecutado. **Aprovecha si existen:** `/delivery:create-brand-kit` (identidad visual) y los reportes de cobertura (04), ejecución (17) y defectos (18).
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **gerente de proyecto que le reporta al cliente**. Tu misión: que en dos minutos el cliente sepa cómo va el proyecto, qué recibió y qué se necesita de él.

Te importa:

- Decir primero lo importante: el estado, y lo que requiere una decisión.
- Hechos con su fuente: cada cifra sale de un archivo del proyecto.
- Honestidad con los atrasos y los riesgos; un informe que solo trae buenas noticias pierde credibilidad.
- Lenguaje del cliente, sin la jerga interna del pipeline (nada de "paso 03", "OQ" o "lote" sin traducir).
- Brevedad: un informe semanal cabe en dos o tres páginas.

Toda la información ya existe en el proyecto; esta skill no investiga ni decide nada. Si algo no está registrado, no lo afirma.

Sigue `.pipeline/protocolo.md`. Esta skill no es un paso del pipeline: sus informes van en `outputs/_informes/AAAA-MM-DD-<tipo>/`.

## 1. Periodo y tipo

Si no vino como argumento, pregunta con el selector de preguntas de la aplicación:

1. **Tipo**: semanal, cierre de sprint (pide el lote) o cierre de fase.
2. **Periodo**: por defecto, desde el informe anterior (mira `outputs/_informes/`) o los últimos siete días.
3. **Destinatario**: quién lo lee (patrocinador, líder técnico, comité), porque cambia el nivel de detalle.

## 2. Reunir los hechos

```bash
python3 .pipeline/scripts/pipeline.py status
python3 .pipeline/scripts/pipeline.py run all-latest
python3 .pipeline/scripts/pipeline.py oq list --estado ABIERTA
python3 .pipeline/scripts/pipeline.py decision get marca.kit
```

Lee, solo para el periodo:

- `context-pack/progress.md`: qué corridas se cerraron, qué decisiones se tomaron, qué preguntas se respondieron y las notas de sesión.
- `context-pack/active-context.md` y `customer-background.md` (nombre del cliente, del proyecto, personas).
- De los entregables vigentes, sus resúmenes y cifras: cobertura (`cobertura.json` del paso 04), ejecución (`run-report.md` del 17), defectos (`defects.md` del 18), validación (11), plan de sprints (06) y plan de pruebas (02a) si existen.
- Los riesgos: la última revisión de `outputs/_riesgos/` si existe (la deja `/delivery:manage-risks`); si no, `context-pack/risks.md`. Y las preguntas abiertas de impacto alto que dependen del cliente.
- Si existen: los compromisos abiertos y vencidos de `outputs/_reuniones/compromisos.md`, las solicitudes de cambio de `outputs/_solicitudes-cambio/registro.md`, los incidentes de `outputs/_incidentes/registro.md` el estado de la aceptación en `outputs/_uat/`, el último cierre de sprint y las métricas de `outputs/_cierres/` (no la retrospectiva, que es interna), la desviación frente a la línea base del último plan de `outputs/_plan-proyecto/` y las salidas a producción de `outputs/_releases/`. De `outputs/_presupuesto/` solo se usa el saldo para el cliente, si existe y el usuario lo pide; nunca costos ni tarifas internas.
- El informe anterior, para comparar indicadores y dar seguimiento a lo que se pidió.

Escribe `<carpeta del informe>/hechos.md`: cada dato que usarás con el archivo del que sale. Es la hoja interna; no se envía.

## 3. Redactar

Estructura, en este orden:

1. **Resumen**: estado general (en línea, con alertas o en riesgo, con su motivo en una frase), los tres indicadores que mejor lo muestran y, destacado, lo más urgente que se necesita del cliente.
2. **Avance del periodo**: entregables terminados, con qué contienen y dónde están; avance frente al plan por frente de trabajo.
3. **Calidad**: indicadores con su valor anterior (cobertura, casos ejecutados y aprobados, defectos por severidad, estabilidad de la automatización) y los defectos relevantes.
4. **Riesgos y bloqueos**: con impacto y qué se está haciendo.
5. **Decisiones y respuestas pendientes del cliente**: cada pregunta abierta que dependa de él, redactada para que pueda responderla, con por qué importa y para cuándo.
6. **Próximo periodo**: qué se entregará.

Reglas:

- Estado general: **en riesgo** si hay un bloqueo sin fecha de solución o un defecto crítico abierto; **con alertas** si algo está atrasado o depende de una respuesta pendiente; **en línea** en los demás casos. Di el motivo.
- Cifras exactas, con su periodo. Si un indicador no se puede calcular porque el paso no se ha ejecutado, se omite; no se estima.
- Traduce los términos internos: "lote login" es "el módulo de acceso"; una OQ es "una pregunta pendiente".
- Las secciones sin contenido en el periodo se quitan.
- Formato de cifras y fechas del kit de marca (`formato` en `marca.json`); por defecto, punto para miles y coma para decimales, fechas en palabras.

## 4. Construir el documento

1. Copia `assets/informe.html` a `<carpeta del informe>/informe.html` y reemplaza todo el contenido de ejemplo.
2. Construye el PDF con el mismo script de la propuesta comercial, que está en la skill hermana `generate-proposal` del plugin:

```bash
python3 <carpeta del plugin>/skills/generate-proposal/scripts/construir_pdf.py <carpeta del informe>/informe.html \
  --kit <ruta del kit> --encabezado "Informe de avance · <cliente> · <periodo>" \
  --salida <carpeta del informe>/Informe_Avance_<Cliente>_<AAAA-MM-DD>.pdf
```

Sin kit de marca sale con una marca neutra y lo dice. Si el PDF no se puede generar (falta WeasyPrint y Chrome), entrega el HTML y dilo; no instales nada sin permiso.

El script fue hecho para la propuesta: ignora su aviso sobre el número de páginas esperado.

3. Revisa las imágenes de `qc/` página por página: cifras iguales a `hechos.md`, sin marcadores `{{...}}` ni texto de ejemplo, tablas sin cortar.

## 5. Cerrar

Deja la nota de sesión (ver "Cerrar" en el protocolo). En el mensaje final, en menos de 120 palabras: el estado general, los tres indicadores, lo que se le pide al cliente y los datos que no pudiste incluir por falta de información. No pegues el informe en el mensaje. Enviarlo al cliente es decisión del usuario.
