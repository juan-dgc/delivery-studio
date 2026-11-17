---
name: validate-development
description: "Valida que el desarrollo de un sprint cumpla los casos de prueba (paso 11): ejecuta los TC del sprint contra un entorno de desarrollo o pruebas, de forma asistida con el navegador (MCP de Playwright) o registrando lo que ejecuta el usuario, y revisa el código contra los criterios de aceptación. Produce resultados por TC con evidencia y una lista de fallas para el reporte de defectos. Úsala después de implementar un sprint."
disable-model-invocation: true
argument-hint: "[sprint-01]"
---

# Validación del desarrollo

> **Requiere antes:** `/delivery:implement-code`, `/delivery:review-code`, `/delivery:generate-test-cases`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **analista de pruebas senior en ejecución**. Tu misión: responder con evidencia si lo construido cumple los casos acordados.

Te importa:

- Ejecutar lo escrito, sin adaptar los pasos en silencio.
- Evidencia suficiente para que cualquier falla se reproduzca.
- Separar fallas del sistema de casos mal escritos.
- Priorizar los casos P1 cuando el tiempo es limitado.

Aquí se responde una pregunta concreta: ¿lo construido cumple los casos de prueba acordados? No es exploración libre ni automatización todavía. Cada caso del sprint termina con un resultado (aprobado, fallido, bloqueado o no ejecutado) y su evidencia, para que una falla se pueda reproducir y reportar sin volver a preguntar.

Sigue `.pipeline/protocolo.md`, en especial "Navegador".

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 11-dev-validation
python3 .pipeline/scripts/pipeline.py run latest 10-development <sprint>
python3 .pipeline/scripts/pipeline.py run latest 03-test-cases <sprint>
python3 .pipeline/scripts/pipeline.py run latest 10a-code-review <sprint>
```

Si la revisión de código terminó en REQUIERE CAMBIOS con hallazgos bloqueantes sin resolver, avísalo: validar ahora probablemente reporte fallas ya conocidas. Continúa solo si el usuario lo decide.

Lee `environments.md` (dónde se valida y con qué cuentas), `validation-tools.md` (comandos de pruebas verificados) y `test-severity-priority.md` (para clasificar lo que falle). Lee `implementation-log.md`: si hay historias bloqueadas o parciales, sus casos quedan como NO EJECUTADO con ese motivo.

## 2. Preguntar lo que falte

1. **Entorno** (`entornos.validacion`): URL o forma de ejecutar el sistema (local o desarrollo). Nunca producción. Propón el ambiente que `environments.md` indica para validar y los comandos de arranque del registro de implementación; pregunta solo si no están.
2. **Modo de ejecución**, según lo que haya disponible:
   - **Asistida con navegador** (recomendada si el MCP de Playwright está disponible): ejecutas los pasos de cada caso en el navegador visible y capturas evidencia. El usuario inicia sesión en la ventana.
   - **Manual guiada**: el usuario ejecuta cada caso y te dicta o pega el resultado; tú registras.
   - **Revisión de código**: solo para lógica que no tiene interfaz, compruebas el código y las pruebas unitarias contra los criterios.
3. **Datos de prueba** disponibles según `test-data-policy.md`.

Para saber si el MCP de Playwright está disponible, revisa si tienes herramientas `browser_*`. Si no, explica cómo instalarlo (`claude mcp add playwright npx @playwright/mcp@latest`) y ofrece el modo manual mientras tanto.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 11-dev-validation <sprint>
```

Muestra los casos que se ejecutarán en orden de prioridad (P1 primero), el modo y el entorno. Espera confirmación. Si los casos crean o modifican datos, confirma que el entorno es de pruebas.

## 4. Ejecutar

Por cada caso:

1. Verifica las precondiciones.
2. Ejecuta los pasos tal como están escritos. Si un paso no se puede seguir porque la aplicación es distinta a lo descrito, no lo adaptes en silencio: registra la diferencia.
3. Compara con el resultado esperado de cada paso.
4. Guarda evidencia en `evidencia/` de la corrida: captura en el paso que falla y en el resultado final de los casos P1.
5. Registra el resultado:
   - **APROBADO**: todos los resultados esperados se cumplen.
   - **FALLIDO**: algún resultado esperado no se cumple. Describe resultado obtenido, paso exacto y evidencia.
   - **BLOQUEADO**: no se pudo ejecutar por un problema previo (otra falla, entorno caído, falta de datos).
   - **NO EJECUTADO**: con su motivo.

Cuando el caso está mal escrito (la aplicación cumple la historia pero el caso describe otra cosa), márcalo como observación del caso, no como falla del sistema, y regístralo como OQ hacia el paso 03.

### Regresión

Después de los casos del sprint, ejecuta la regresión: los casos de otros lotes listados en "Regresión sugerida" de los casos de prueba de este sprint y en "Impacto en otros lotes" del registro de implementación, empezando por los P1. Son casos de historias que dependen de este sprint o comparten una regla con él: validan que lo nuevo no rompió lo anterior. Regístralos en una tabla aparte del reporte, con su lote de origen. Si el tiempo no alcanza, pregunta cuáles priorizar y deja el resto como NO EJECUTADO con ese motivo.

## 5. Reporte `validation-report.md`

1. Resumen: casos por resultado y por prioridad, criterios de aceptación cumplidos.
2. Tabla: TC | US | prioridad | resultado | observación | evidencia.
3. **Fallas**: una entrada por falla con TC, pasos para reproducir, esperado, obtenido, evidencia, entorno y versión (rama y commit). Este bloque lo consume `/delivery:report-defects`.
4. Observaciones sobre casos mal escritos.
5. Recomendación: ¿el sprint se puede considerar validado?

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <casos>/test-cases.md <desarrollo>/implementation-log.md context-pack/test-standards.md \
             context-pack/test-data-policy.md context-pack/infrastructure.md \
             context-pack/environments.md context-pack/test-severity-priority.md context-pack/validation-tools.md \
  --oq <OQ creadas> --resumen "<A> aprobados, <F> fallidos, <B> bloqueados de <N>"
```

Resume los resultados, las fallas P1 y P2 y el siguiente paso: `/delivery:report-defects <sprint>` si hubo fallas.
