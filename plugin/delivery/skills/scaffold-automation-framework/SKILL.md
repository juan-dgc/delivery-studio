---
name: scaffold-automation-framework
description: "Crea el framework de automatización web del proyecto (paso 15) a partir de los selectores explorados: estructura del repositorio, configuración por entorno y navegador, un page object por pantalla de selectors.json, autenticación por rol con sesión guardada, datos de prueba, reportes (HTML y JUnit), convención de trazabilidad con TC y US, linter y una prueba de humo. Por defecto Playwright con TypeScript; pregunta framework, lenguaje, repositorio y patrón. Pide aprobación antes de instalar, ejecutar o hacer commit."
disable-model-invocation: true
argument-hint: "[proyecto]"
---

# Framework de automatización

> **Requiere antes:** `/delivery:select-automation-candidates`, `/delivery:explore-web-app`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **líder técnico de automatización de pruebas (SDET lead)**. Tu misión: dejar un framework que haga que cada prueba nueva sea fácil de escribir y barata de mantener.

Te importa:

- Selectores en un solo lugar (page objects) y pruebas independientes.
- Configuración por entorno y secretos fuera del código.
- Reportes que se lean en términos de casos de prueba e historias.
- Lo mínimo necesario: nada de capas que el proyecto no usa.

El framework decide cuánto costará mantener cada prueba durante la vida del proyecto. Las reglas que importan: los selectores viven en un solo lugar (el page object de su pantalla), ninguna prueba depende de otra, la sesión de cada rol se prepara una vez y se reutiliza, los datos se crean y limpian por código, y cada prueba lleva en su nombre el caso que automatiza para que el reporte se lea en términos de negocio. Esta skill deja esa base lista y probada con una prueba de humo; las pruebas reales llegan en el paso 16.

Sigue `.pipeline/protocolo.md`, en especial "Repositorios de código" y "Pasos con efectos reales".

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 15-automation-framework
python3 .pipeline/scripts/pipeline.py run all-latest 13-automation-candidates
```

El framework es de todo el proyecto, así que sus page objects salen de las pantallas de **todos** los lotes explorados, no de uno solo:

```bash
python3 .pipeline/scripts/pipeline.py run all-latest 14-web-exploration
python3 .pipeline/scripts/merge_selectors.py --salida <carpeta de la corrida>/selectors-proyecto.json
```

Trabaja con ese `selectors-proyecto.json` unificado. Si el script reporta choques (un mismo ID para dos pantallas, o una pantalla con dos IDs), detente: hay que corregirlos con `/delivery:explore-web-app` antes de generar page objects. Cuando un lote nuevo agrega pantallas, vuelve a ejecutar esta skill en modo REGENERAR: agrega los page objects nuevos y conserva los existentes.

Si existe el plan de pruebas (`pipeline.py run latest 02a-test-plan proyecto`), lee su estrategia de automatización: niveles a automatizar, ambientes y meta. Lee el `selectors.json` y el `exploration-log.md` de cada lote (riesgos como iframes, MFA, carga de archivos), `automation-standards.md` (framework, localizadores, esperas, convenciones y reportes: lo que esté confirmado ahí no se vuelve a preguntar), `environments.md` (ambientes, navegadores y nombres de las variables de cada cuenta de prueba), `validation-tools.md` (lint y compuertas de CI existentes) y `coding-standards.md`.

## 2. Preguntar lo que falte

1. **Framework** (`automatizacion.framework`): Playwright (recomendado: es el mismo motor de la exploración, los selectores se usan tal cual y trae reportes, trazas y paralelismo), Cypress, WebdriverIO o Selenium. Si `tech-policy.md` impone otro, respétalo.
2. **Lenguaje** (`automatizacion.lenguaje`): TypeScript (recomendado con Playwright), JavaScript, Python, Java o C#. Considera el lenguaje que domina el equipo de QA.
3. **Repositorio** (`automatizacion.repositorio`): por defecto **`automatizacion/` dentro de la carpeta del proyecto**, que es lo más simple y deja el proyecto autocontenido; propónlo así. Si el usuario prefiere otra ruta (por ejemplo un repositorio que ya existe o una carpeta del repositorio del código), que la indique él: en la aplicación, en «Instrucciones adicionales» antes de ejecutar, o deteniéndote y escribiéndola. Solo entonces trabaja fuera de la carpeta del proyecto; no propongas tú una ruta externa.
4. **Patrón** (`automatizacion.patron`): Page Object Model (recomendado) o Screenplay.
5. **Navegadores y dispositivos**: desde `constraints.md`; si no dice, Chromium en escritorio y agrega otros cuando se pidan.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 15-automation-framework proyecto
```

Muestra la estructura de carpetas, los page objects que se generarán (uno por pantalla vigente de `selectors.json`), las dependencias a instalar y las variables de entorno necesarias. Espera aprobación. Instalar dependencias y descargar navegadores requiere una aprobación propia.

## 4. Construir

Estructura de referencia para Playwright con TypeScript (adáptala al framework y lenguaje elegidos manteniendo las mismas responsabilidades):

```
<repositorio>/
  package.json  playwright.config.ts  tsconfig.json  .eslintrc  .gitignore
  .env.example                 variables sin valores: BASE_URL, usuario y contraseña por rol
  README.md                    cómo instalar, configurar .env, ejecutar y leer reportes
  src/
    pages/BasePage.ts          navegación, esperas comunes
    pages/<NombreLogico>.ts    un archivo por pantalla de selectors.json
    fixtures/index.ts          extiende test con los page objects y la sesión por rol
    data/                      fábricas de datos según test-data-policy.md
    utils/trazabilidad.ts      ayuda para nombres y etiquetas de casos
  tests/
    auth.setup.ts              inicia sesión por rol con variables de entorno y guarda la sesión
    smoke.spec.ts              abre BASE_URL y verifica que la aplicación responde
```

Reglas:

- **Page objects desde `selectors.json`**: clase con el `nombre_logico` de la pantalla, una propiedad por elemento vigente con su `nombre_logico` y su `locator` (traducido al lenguaje si no es JS o TS), y métodos para las acciones repetidas de la pantalla (por ejemplo `iniciarSesion`). En un comentario, el `id` del elemento (`PG-01.E01`) para rastrearlo. Los elementos con `contenedor` se construyen encadenados al locator del contenedor.
- **Esperas**: usa las esperas automáticas del framework y las de `esperas` de cada pantalla. Nunca esperas fijas por tiempo.
- **Configuración**: `BASE_URL` y credenciales solo desde variables de entorno; reintentos 0 en local y 1 o 2 en CI; trazas y capturas al fallar; reportes HTML y JUnit (el JUnit lo leen los pasos 17 y 19).
- **Trazabilidad**: el título de cada prueba empieza con el ID del caso y lleva etiquetas: `TC-001-01 Crear cotización con datos válidos @US-001 @P1 @sprint-01`. Cada paso del caso será un `test.step` en el paso 16.
- **Autenticación**: un proyecto de configuración por rol que inicia sesión con las variables de entorno y guarda la sesión en `.auth/` (ignorada por git). Si hay MFA o captcha, no intentes saltarlos: documenta la alternativa (usuario de prueba sin MFA, token de prueba) como pendiente para el cliente.
- **Secretos**: `.env` y `.auth/` en `.gitignore`. Nunca leas ni muestres los valores de `.env`.

Después, con aprobación: instalar dependencias, descargar el navegador, ejecutar el linter y la prueba de humo contra la URL de `exploracion.url_base`. El usuario debe haber creado su `.env` a partir de `.env.example`. Si la prueba de humo falla, diagnostica antes de cerrar.

Commit en una rama propia (`automation/framework`) con aprobación. No hagas push sin pedirlo.

## 5. Reporte `framework-setup.md`

Decisiones aplicadas, estructura creada, page objects generados (pantalla, elementos, selectores de estabilidad baja), cómo ejecutar, variables de entorno necesarias, resultado de la prueba de humo, convención de trazabilidad y pendientes.

## 6. Modo REGENERAR

Si cambió `selectors.json`, regenera solo los page objects afectados y conserva los métodos escritos a mano. Lista las pruebas que podrían romperse por elementos obsoletos.

## 7. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <exploración>/selectors.json <candidatos>/automation-candidates.md context-pack/tech-policy.md \
             context-pack/test-standards.md context-pack/coding-standards.md context-pack/infrastructure.md \
             context-pack/test-data-policy.md \
             context-pack/automation-standards.md context-pack/environments.md context-pack/validation-tools.md \
  --oq <OQ creadas> --resumen "<framework> + <lenguaje>, <N> page objects, humo <ok o falla>"
```

Siguiente paso: `/delivery:automate-test-cases <alcance>`.
