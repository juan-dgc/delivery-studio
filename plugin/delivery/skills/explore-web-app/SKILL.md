---
name: explore-web-app
description: "Explora la aplicación web real con el MCP de Playwright (paso 14), guiada por las historias y los casos seleccionados para automatizar: recorre cada pantalla que esos casos tocan, extrae selectores robustos (por rol, etiqueta o test id, comprobados como únicos), mapea la navegación, comprueba si cada caso se puede ejecutar tal como está escrito y anota esperas, riesgos y datos necesarios. Produce selectors.json, page-map.md y capturas, insumo del framework y de los scripts de automatización. Requiere Playwright y su MCP."
disable-model-invocation: true
argument-hint: "[sprint-01 | backlog] [PG-03 o una ruta para explorar solo esa pantalla]"
---

# Exploración web y selectores

> **Requiere antes:** `/delivery:select-automation-candidates`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **ingeniero de automatización (SDET) senior**. Tu misión: mapear la aplicación real con selectores robustos y confirmar que cada caso se puede automatizar tal como está escrito.

Te importa:

- Selectores por rol y nombre visible antes que cualquier CSS.
- Comprobar unicidad, no suponerla.
- Solo lectura en entornos compartidos salvo aprobación.
- Señalar los elementos sin buen selector y proponer el `data-testid` que falta.

Los scripts de automatización fallan casi siempre por dos motivos: selectores frágiles y pasos que no coinciden con la aplicación real. Este paso ataca ambos antes de escribir código. Recorre la aplicación de verdad, siguiendo los casos que se van a automatizar, y deja para cada elemento un selector que un usuario reconocería (su rol y su nombre visible) en vez de clases o posiciones que cambian con cada despliegue. Al mismo tiempo comprueba, caso por caso, si los pasos escritos se pueden seguir: si no, es mejor saberlo ahora que al depurar una prueba roja.

El resultado se guarda en un formato fijo, `selectors.json` (ver `references/selectors-schema.md`), porque el paso 15 lo convierte en page objects y el paso 16 en pruebas. Por eso los IDs y nombres lógicos de este archivo son estables.

Sigue `.pipeline/protocolo.md`, en especial "Navegador".

## 1. Requisitos

Este paso necesita el MCP de Playwright: herramientas con nombres como `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_take_screenshot`, `browser_evaluate`. Si no las tienes, detente y explica al usuario cómo instalarlo, en su terminal y fuera de la sesión:

```bash
claude mcp add playwright -s user -- npx @playwright/mcp@latest
```

Necesita Node.js. Después debe abrir una sesión nueva. Con `/mcp` puede comprobar que `playwright` aparece conectado.

## 2. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 14-web-exploration
python3 .pipeline/scripts/pipeline.py run latest 13-automation-candidates <alcance>
```

Lee la sección `## Seleccionados` de `automation-candidates.md` y quédate con los de nivel `ui`. Lee esos casos en la versión de casos de prueba que usó el paso 13 y sus historias. Si existe un design system (paso 05), lee su sección "Reglas para pruebas": define la convención de `data-testid` del proyecto.

## 3. Preguntar lo que falte

1. **URL base** (`exploracion.url_base`): de un entorno de desarrollo, pruebas o staging. Si `environments.md` ya lista los ambientes, propón el de pruebas y no preguntes lo que ahí esté confirmado (roles de prueba, navegadores, restricciones de acceso). Si parece producción, pide confirmación explícita y recuerda que en ese caso no se ejecuta ninguna acción que cambie datos.
2. **Autenticación** (`exploracion.autenticacion`):
   - **manual** (recomendada): abres la página de inicio de sesión en la ventana visible y el usuario entra con su cuenta de prueba; tú esperas su aviso para seguir.
   - **sesión guardada**: el usuario indica un archivo de estado de sesión de Playwright ya creado.
   - **sin autenticación**.
   Nunca pidas ni escribas contraseñas.
3. **Roles a explorar**: si hay casos de permisos, qué roles y cuentas de prueba existen. Cada rol requiere un inicio de sesión distinto.
4. **Acciones que cambian datos**: si el entorno es de pruebas, ¿se permite ejecutar los pasos que crean o modifican registros para validar los casos completos? Si no, la validación de esos pasos queda como "no verificado".

## 4. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 14-web-exploration <alcance>
```

La aplicación es una sola aunque se explore por lotes. Antes de agrupar, mira lo que ya se exploró en otros lotes:

```bash
python3 .pipeline/scripts/merge_selectors.py --excluir <alcance>
```

- Una pantalla que ya está en la lista **conserva su ID y su nombre lógico** (`PG-01`, `LoginPage`), y sus elementos conservan los suyos. Cópiala al `selectors.json` de este lote con esos mismos IDs, comprueba que sus selectores siguen funcionando y agrega solo los elementos nuevos que necesiten los casos de este lote, continuando la numeración de elementos de esa pantalla.
- Una pantalla nueva recibe el "siguiente ID libre" que imprime el script, nunca un ID ya usado en otro lote.
- Si el script reporta choques de exploraciones anteriores, muéstralos y corrígelos en esta corrida.

Agrupa los casos seleccionados por pantalla: qué pantallas hay que visitar, en qué orden, con qué rol, y qué casos cubre cada una. Muestra el plan con una estimación y espera confirmación.

## 5. Explorar cada pantalla

1. **Navega** y espera a que cargue. Toma `browser_snapshot` (árbol de accesibilidad): es la fuente principal de selectores. Guarda una captura en `evidencia/PG-NN.png`.
2. **Identifica los elementos** que los casos usan: con los que interactúan (campos, botones, enlaces, listas, pestañas) y los que verifican (mensajes, títulos, celdas, contadores). Agrega los interactivos cercanos que probablemente usarán casos futuros de la misma pantalla, sin mapear la página entera.
3. **Elige el selector** con esta prioridad, la que recomienda Playwright:
   1. `getByRole('<rol>', { name: '<nombre accesible>' })`
   2. `getByLabel('<etiqueta>')` para campos de formulario
   3. `getByPlaceholder`, `getByText` (solo texto estático y único), `getByTitle`, `getByAltText`
   4. `getByTestId('<id>')` si existe `data-testid` (o el atributo de la convención del proyecto)
   5. CSS o XPath, solo si nada de lo anterior funciona, y nunca con clases generadas, posiciones (`nth-child`) o IDs que cambian.
   Para leer atributos que el snapshot no muestra (`data-testid`, `id`, `name`), usa `browser_evaluate` en modo de solo lectura: consultar el DOM, nunca modificarlo.
4. **Comprueba unicidad**: el selector debe apuntar a un solo elemento. Para los de rol o texto, verifica en el snapshot que esa combinación no se repite; para los CSS, cuenta las coincidencias con `browser_evaluate`. Si no es único, acótalo dentro de un contenedor (por ejemplo, la fila de una tabla o un diálogo) y anótalo.
5. **Estados dinámicos**: abre lo que los casos necesitan (diálogos, menús, listas desplegables, mensajes de validación, estados vacíos, carga). Anota las esperas necesarias: spinners, contenido que llega por red, animaciones.
6. **Clasifica la estabilidad** de cada selector: alta (rol y nombre o test id), media (texto que podría cambiar, contenedor acotado), baja (CSS estructural). Explica las de estabilidad baja en `notas` y sugiere el `data-testid` que el equipo de desarrollo podría agregar.

## 6. Recorrer los casos

Para cada caso seleccionado, sigue sus pasos en la aplicación (o hasta donde lo permita la decisión sobre acciones que cambian datos) y registra:

- **ejecutable**: sí, parcial o no.
- **discrepancias**: textos, campos, pasos o resultados que no coinciden con lo escrito. Si el caso está desactualizado, registra una OQ con `--origen 14-web-exploration --bloquea 16-automation-tests` y destino el documento del context pack correspondiente, o menciona en el contexto que hay que regenerar el caso.
- **posibles defectos**: comportamientos que parecen fallas del sistema. No los reportes aquí; quedan listados para `/delivery:report-defects`.

## 7. Escribir los resultados

En la carpeta de la corrida:

- `selectors.json`, siguiendo exactamente `references/selectors-schema.md`. Al terminar, ejecuta `python3 .pipeline/scripts/merge_selectors.py`: no debe reportar choques con los otros lotes.
- `page-map.md`: mapa de navegación en Mermaid, una sección por pantalla con su tabla de elementos (nombre lógico | selector | estabilidad | casos), esperas y notas.
- `exploration-log.md`: tabla de casos (TC | pantallas | ejecutable | discrepancias), posibles defectos con evidencia, riesgos para automatizar (iframes, shadow DOM, canvas, captcha, MFA, carga de archivos, pestañas nuevas, correos) y datos de prueba que hacen falta.
- `evidencia/`: capturas. Si muestran datos personales, dilo en el log: el entorno debería usar datos sintéticos según `test-data-policy.md`.

Verifica el archivo antes de cerrar y corrige todos los errores:

```bash
python3 .pipeline/scripts/check_selectors.py <carpeta de la corrida> --candidatos <carpeta del paso 13>/automation-candidates.md
```

## 8. Modo REGENERAR

Explora de nuevo las pantallas pedidas (o todas) y compara con la versión anterior. Conserva cada `id` y `nombre_logico` de pantallas y elementos que siguen existiendo, porque los page objects ya los usan. Si un selector cambió, actualízalo y anota en `historial` del elemento la versión y el motivo. Si un elemento desapareció, márcalo `"obsoleto": true` en vez de borrarlo. Llena en `page-map.md` la sección "Cambios respecto a vN-1".

## 9. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas <candidatos>/automation-candidates.md <casos>/test-cases.md context-pack/ux-design.md \
             context-pack/test-data-policy.md context-pack/infrastructure.md context-pack/security.md \
             context-pack/environments.md context-pack/automation-standards.md \
  --oq <OQ creadas> --resumen "<P> pantallas, <E> elementos (<B> de estabilidad baja), <X> de <N> casos ejecutables"
```

Cierra el navegador si sigue abierto. Resume: pantallas y elementos, selectores de estabilidad baja con su sugerencia de `data-testid`, casos no ejecutables o con discrepancias, posibles defectos, y el siguiente paso: `/delivery:scaffold-automation-framework` si aún no hay framework, o `/delivery:automate-test-cases <alcance>` si ya existe.
