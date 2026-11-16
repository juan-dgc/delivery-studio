---
name: run-automated-tests
description: "Ejecuta la suite de pruebas automatizadas (paso 17) contra un entorno elegido, con filtros por etiqueta (sprint, prioridad, historia), navegadores y paralelismo; resume los reportes JUnit por caso de prueba y clasifica cada falla como posible defecto, problema del script, ambiente, datos o inestabilidad, con su evidencia. No modifica las pruebas. Pide aprobación antes de ejecutar contra un entorno compartido. Úsala para regresiones, validación de un sprint o después de un despliegue."
disable-model-invocation: true
argument-hint: "[sprint-01 | regresion | @P1 | TC-001-01 ...]"
---

# Ejecución de pruebas automatizadas

> **Requiere antes:** `/delivery:automate-test-cases`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **analista de automatización especializado en análisis de fallas**. Tu misión: ejecutar la suite y entregar fallas ya clasificadas, listas para actuar.

Te importa:

- Clasificar cada falla con evidencia: defecto, script, ambiente, datos o inestabilidad.
- Comparar con la ejecución anterior para separar lo nuevo de lo conocido.
- No tocar las pruebas durante la ejecución.
- Recomendar con claridad si la versión se puede promover.

El valor de una ejecución está en su análisis, no en el número verde o rojo. Una falla sin clasificar obliga a alguien a investigarla otra vez; una falla clasificada como defecto con su evidencia se puede reportar en minutos. Por eso esta skill ejecuta, resume por caso de prueba y revisa cada falla con su traza. No toca el código de las pruebas: si un script está mal, lo deja anotado para el paso 16, así la ejecución no se convierte en una sesión de depuración que mezcla dos trabajos.

Sigue `.pipeline/protocolo.md`, en especial "Pasos con efectos reales".

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 17-automation-run
python3 .pipeline/scripts/pipeline.py run all-latest 16-automation-tests      # la suite reúne las pruebas de todos los lotes
python3 .pipeline/scripts/pipeline.py run latest 15-automation-framework
```

Lee `framework-setup.md` (cómo se ejecuta y dónde quedan los reportes), `environments.md` (ambiente, estabilidad y ventanas de mantenimiento), `test-severity-priority.md` (para clasificar las fallas) y `automation-log.md` (estado conocido de cada prueba: las que ya fallan por posible defecto no son sorpresa).

## 2. Preguntar lo que falte

1. **Entorno** (`entornos.ejecucion_automatizada`): URL. Propón el ambiente de pruebas de `environments.md` (el mismo de `exploracion.url_base` si aplica) y solo confirma. Si es compartido, confirma que no hay otra ejecución o carga de datos al mismo tiempo.
2. **Qué ejecutar**: un sprint, la regresión completa, por prioridad o casos específicos. Al ejecutar un sprint recién automatizado, recomienda sumar la regresión de los lotes relacionados: las pruebas de las historias que dependen de ese sprint o comparten una regla con él (`pipeline.py alcance contexto <sprint>`), porque los page objects compartidos pudieron cambiar. Tradúcelo al filtro del framework (en Playwright, `--grep @sprint-01`).
3. **Navegadores** y **paralelismo** (trabajadores). Recomendado: los navegadores de `constraints.md`, y paralelismo moderado en entornos compartidos.
4. **Reintentos**: recomendado 1, para separar inestabilidad de fallas reales.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 17-automation-run <alcance>
```

Muestra el comando exacto, el entorno, la cantidad aproximada de pruebas y la duración estimada. Espera aprobación. El usuario debe tener su `.env` configurado; no leas ni muestres sus valores.

## 4. Ejecutar y resumir

Ejecuta en el repositorio de automatización con el reportero JUnit activo. Copia a la carpeta de la corrida el JUnit y la ruta del reporte HTML (no copies trazas pesadas: deja la ruta). Luego:

```bash
python3 .pipeline/scripts/summarize_results.py <ruta>/junit.xml --md <carpeta>/resumen.md --json <carpeta>/resumen.json
```

## 5. Clasificar cada falla

Por cada caso FALLIDO o INESTABLE, abre la evidencia (traza, captura, video o registro de consola) y decide:

| Clase | Señales | Va a |
|---|---|---|
| Posible defecto | La aplicación no cumple el resultado esperado del caso; se reproduce | `/delivery:report-defects` |
| Script | Selector no encontrado tras un cambio de interfaz, espera insuficiente, dato mal preparado | `/delivery:automate-test-cases` o re-exploración |
| Ambiente | Tiempo de espera de red, servicio caído, error 5xx no relacionado | Equipo de infraestructura |
| Datos | Dato inexistente, duplicado o modificado por otra ejecución | Revisar `test-data-policy.md` y fábricas |
| Inestable | Pasa con reintento sin cambios | `/delivery:automate-test-cases`, investigar causa |

Si dudas entre defecto y script, revisa la captura contra el resultado esperado del caso: si la interfaz muestra un comportamiento incorrecto, es defecto; si el elemento existe pero el script no lo encontró, es script. Compara con `automation-log.md` y con la ejecución anterior (`pipeline.py run latest 17-automation-run <alcance>`) para separar fallas nuevas de las conocidas.

## 6. Reporte `run-report.md`

1. Contexto: entorno, versión desplegada si se conoce, filtro, navegadores, fecha, duración.
2. Resultados por estado y por prioridad, y comparación con la ejecución anterior (nuevas fallas, corregidas, persistentes).
3. Tabla de fallas: TC | US | prioridad | clase | descripción corta | evidencia | destino.
4. **Posibles defectos**: bloque con pasos, esperado, obtenido y evidencia por cada uno, que consume `/delivery:report-defects`.
5. Recomendación: ¿la versión probada se puede promover?

## 7. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <automatización>/automation-log.md <framework>/framework-setup.md context-pack/infrastructure.md \
             context-pack/test-data-policy.md context-pack/test-standards.md \
             context-pack/automation-standards.md context-pack/environments.md context-pack/test-severity-priority.md \
  --oq <OQ creadas> --resumen "<A> aprobados, <F> fallidos (<D> posibles defectos), <I> inestables"
```

Resume y sugiere el siguiente paso según lo encontrado.
