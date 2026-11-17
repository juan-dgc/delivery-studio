---
name: automate-test-cases
description: "Automatiza los casos de prueba seleccionados de un alcance (paso 16) en el framework existente: una prueba por TC, cada paso del caso como paso de la prueba, verificaciones por resultado esperado, page objects y selectores del paso 14, datos por fábricas y etiquetas de trazabilidad. Ejecuta cada prueba nueva varias veces para detectar inestabilidad, separa fallas del script de posibles defectos y registra el estado de cada TC. Pide aprobación antes de ejecutar contra un entorno y de hacer commit."
disable-model-invocation: true
argument-hint: "[sprint-01] [TC-001-01 ... para limitar]"
---

# Automatizar casos de prueba

> **Requiere antes:** `/delivery:explore-web-app`, `/delivery:scaffold-automation-framework`. **Aprovecha si existen:** `/delivery:design-api-contracts`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **ingeniero de automatización (SDET) senior**. Tu misión: convertir cada caso seleccionado en una prueba que falle solo cuando la aplicación tiene un problema.

Te importa:

- Fidelidad al caso: mismo ID, mismos pasos, mismos resultados esperados.
- Sin esperas fijas ni dependencias entre pruebas.
- Nunca ajustar una prueba para que pase ante un defecto real.
- Verificar estabilidad repitiendo la ejecución antes de darla por buena.

Una prueba automatizada es buena si falla solo cuando la aplicación tiene un problema. Por eso aquí cada prueba se escribe pegada a su caso (mismo ID, mismos pasos, mismos resultados esperados), usa los page objects en vez de selectores sueltos, se ejecuta varias veces antes de darla por buena, y cuando falla se decide si el problema está en el script o en la aplicación. Una prueba que falla por un defecto real no se "arregla" para que pase.

Sigue `.pipeline/protocolo.md`, en especial "Repositorios de código" y "Pasos con efectos reales".

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 16-automation-tests
python3 .pipeline/scripts/pipeline.py run latest 15-automation-framework
python3 .pipeline/scripts/pipeline.py run latest 14-web-exploration <alcance>
python3 .pipeline/scripts/pipeline.py run latest 13-automation-candidates <alcance>
```

Las decisiones `automatizacion.framework`, `automatizacion.lenguaje` y `automatizacion.repositorio` vienen del paso 15 y no se vuelven a preguntar. Si alguna cambia, este paso queda desactualizado.

Antes de escribir, revisa lo que ya existe en el repositorio de automatización de otros lotes: page objects, fábricas de datos, fixtures de sesión y utilidades. Reutilízalos; no crees un segundo page object para una pantalla que ya tiene uno. Si un caso necesita una pantalla explorada en este lote que aún no tiene page object, hay que regenerar el framework (`/delivery:scaffold-automation-framework`) antes de automatizarlo. Con `pipeline.py alcance contexto <alcance>` identifica los casos que dependen de funcionalidades de lotes anteriores: su estado inicial se prepara con fábricas o por API (un usuario ya registrado, un pedido ya creado), nunca ejecutando antes la prueba de otro lote.

Lee `framework-setup.md` (convenciones, cómo ejecutar), `selectors.json`, `exploration-log.md`, la sección `## Seleccionados` de los candidatos, `automation-standards.md` (nombres, etiquetas, esperas y reintentos) y `environments.md` (ambiente, cuentas por rol y procesos automáticos que pueden alterar una prueba). Los casos marcados como no ejecutables en la exploración no se automatizan hasta resolver su discrepancia: listalos y sigue con los demás.

## 2. Preguntar lo que falte

1. **Casos de esta corrida**: si son muchos, recomienda de cinco a diez por conversación, en el orden de los candidatos.
2. **Entorno de ejecución** para verificar las pruebas nuevas: por defecto, `exploracion.url_base`.
3. Si el entorno permite crear y borrar datos (necesario para casos que modifican información).

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 16-automation-tests <alcance>
```

Revisa el repositorio de automatización (`git status`, rama). Muestra por caso: archivo de prueba, page objects que usa, datos que necesita y si falta algún elemento en los page objects. Espera aprobación. Trabaja en una rama propia (`automation/<alcance>`).

## 4. Escribir cada prueba

- Archivo por historia o por módulo, según `framework-setup.md`.
- Título con el ID y las etiquetas: `TC-004-02 Rechaza cotización sin cliente @US-004 @P1 @sprint-01`.
- Un paso de prueba por fila de la tabla del caso (`test.step('2. Guardar sin cliente', ...)` o su equivalente), para que el reporte muestre en qué paso del caso falló.
- Verificaciones que corresponden a cada resultado esperado, con las aserciones del framework que esperan automáticamente (por ejemplo `expect(locator).toBeVisible()`), nunca esperas fijas.
- Solo selectores a través de los page objects. Si el caso necesita un elemento que no está en `selectors.json`, no inventes el selector: márcalo como pendiente de exploración (`/delivery:explore-web-app <alcance> PG-NN`) y deja la prueba en estado pendiente con su motivo.
- Datos por fábricas, con limpieza al final. Pruebas independientes: cada una prepara lo que necesita y puede correr sola y en paralelo.
- Sesión por rol desde los fixtures, no iniciando sesión en cada prueba (salvo que el caso pruebe justamente el inicio de sesión).

## 4b. Casos de nivel API

Los seleccionados con nivel `api` se automatizan contra los contratos del paso 07a (`pipeline.py run latest 07a-api-contracts proyecto`), no contra la interfaz:

- Usa el cliente HTTP del framework (en Playwright, el contexto `request`), en archivos separados de las pruebas de UI (`tests/api/`).
- Cada prueba llama a la operación por su ruta del contrato, con la autenticación del rol que corresponda, y verifica código de respuesta, cuerpo y formato de error contra el esquema del contrato.
- Los casos negativos de reglas de negocio (`RN-NNN`) suelen ser más rápidos y estables aquí que en la interfaz.
- En un sistema existente, sin paso 07a, sirve como contrato la especificación OpenAPI que ya tenga el sistema, si `codebase-map.md` o la evidencia la referencian. Dilo en el registro.
- Si no hay ningún contrato, dilo y deja estos casos pendientes: sin contrato no hay contra qué verificar.

## 5. Verificar

Con aprobación, ejecuta las pruebas nuevas contra el entorno, primero una vez y luego repetidas (por ejemplo `--repeat-each=3` en Playwright) para detectar inestabilidad. Por cada falla, abre la traza o captura y clasifica:

- **Script**: selector, espera o dato mal resuelto. Corrige y repite.
- **Posible defecto**: la aplicación no cumple el resultado esperado. Deja la prueba fallando, anota la evidencia y no la ajustes al comportamiento actual.
- **Ambiente o datos**: entorno caído, datos faltantes. Regístralo y continúa.
- **Inestable**: pasa y falla sin cambios. No la entregues como lista: investiga la causa (espera, dato compartido, orden) o márcala pendiente.

Ejecuta el linter. Commit con aprobación, citando los TC.

## 6. Registro `automation-log.md`

1. Resumen: casos automatizados, pendientes y bloqueados; porcentaje de seleccionados de UI cubiertos.
2. Tabla: TC | US | archivo | estado (pasa, falla por posible defecto, pendiente de exploración, bloqueado, inestable) | ejecuciones | nota.
3. Posibles defectos con evidencia (los consume `/delivery:report-defects`).
4. Cambios en page objects y elementos que conviene explorar de nuevo.
5. Rama y commits.

## 7. Modo REGENERAR

Si cambiaron los casos (nueva versión del paso 03) o los selectores, actualiza solo las pruebas afectadas y conserva sus nombres de archivo y títulos. Las pruebas de casos retirados se eliminan con aprobación y se listan.

## 8. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado <COMPLETADO o PARCIAL> \
  --entradas <candidatos>/automation-candidates.md <exploración>/selectors.json <framework>/framework-setup.md \
             <casos>/test-cases.md context-pack/test-standards.md context-pack/test-data-policy.md context-pack/coding-standards.md \
             context-pack/automation-standards.md context-pack/environments.md \
  --oq <OQ creadas> --resumen "<A> de <S> casos automatizados, <D> posibles defectos"
```

Siguiente paso: `/delivery:run-automated-tests <alcance>`.
