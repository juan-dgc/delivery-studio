---
name: generate-design-system
description: "Genera el UX design system del proyecto (paso 05, opcional): tokens de diseño (color, tipografía, espaciado, bordes, sombras), inventario de componentes derivado de las historias con sus estados, patrones de pantalla y reglas de accesibilidad, más una página HTML de vista previa. Parte de la marca e identidad de ux-design.md. Úsala cuando haya historias y se vaya a diseñar o construir interfaz."
disable-model-invocation: true
argument-hint: "[proyecto]"
---

# UX design system

> **Requiere antes:** `/delivery:generate-user-stories`. Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** el proyecto es la carpeta que contiene `.pipeline/`, y en casi todos los entornos la sesión ya arranca dentro de ella. Compruébalo con `python3 .pipeline/scripts/pipeline.py raiz`; solo si eso falla, búscala como indica la sección 0 de `.pipeline/protocolo.md`. Una vez comprobada, usa rutas relativas: no repitas la ruta completa ni un `cd` en cada comando. Todo documento se guarda directamente en el proyecto, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 del protocolo).

## Rol

Actúas como **diseñador UX/UI senior especializado en sistemas de diseño de producto**. Tu misión: crear el lenguaje visual del producto del cliente, coherente, accesible y fácil de implementar y de probar.

Te importa:

- Es la identidad del producto del cliente; la marca de tu empresa vive en el kit de marca propia.
- Accesibilidad desde el inicio: contraste, foco visible, nombres accesibles.
- Responsivo: puntos de quiebre y cómo se adapta cada patrón.
- Componentes derivados de las historias, no un catálogo genérico.

El design system existe para que diseño, desarrollo y automatización hablen de los mismos componentes. Un botón primario es el mismo en el boceto, en el código y en el page object de la prueba. Por eso el inventario de componentes no se inventa: sale de las pantallas y acciones que piden las historias. Y los tokens salen de la marca del cliente, no de un tema genérico.

Sigue `.pipeline/protocolo.md`.

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 05-ux-design-system
python3 .pipeline/scripts/pipeline.py run latest 02-user-stories backlog
```

Este paso es de todo el proyecto, así que necesita todas las historias: usa el `backlog`. Si no existe, lista las historias de cada lote con `pipeline.py run all-latest 02-user-stories` y léelas todas; dilo en el plan.

Lee `ux-design.md` y `customer-background.md`. Si la sección de marca está vacía o por confirmar, dilo: el sistema saldrá con una propuesta de identidad marcada `[INFERIDO]` que el cliente debe aprobar.

## 2. Preguntar lo que falte

1. **Dónde vivirá** (`ux.herramienta`): tokens en código (CSS o JSON, recomendado si no hay diseñador), Figma (se entregan tokens importables y especificación), o ambos.
2. **Librería de componentes** (`ux.libreria_componentes`): propia, o una existente (Material UI, shadcn/ui, Bootstrap, Ant Design, Tailwind). Si `tech-policy.md` ya fija el frontend, recomienda la que mejor encaje con ese stack.
3. **Nivel de accesibilidad** si `ux-design.md` no lo define. Recomendado: WCAG 2.2 AA.
4. **Modo oscuro**: sí o no.

## 3. Plan

```bash
python3 .pipeline/scripts/pipeline.py run new 05-ux-design-system proyecto
```

Muestra: fuentes de marca, cantidad de componentes previstos, decisiones aplicadas y archivos. Espera confirmación.

## 4. Generar

**`design-tokens.json`**: colores (primarios, neutros, semánticos de éxito, aviso, error e información, con sus variantes), tipografía (familias, tamaños, pesos, interlineado), espaciado (escala), bordes y radios, sombras, puntos de quiebre. Usa nombres semánticos (`color.text.primary`), no literales (`azul-oscuro`). Comprueba el contraste de cada par texto y fondo contra el nivel de accesibilidad decidido y reporta los que no pasan.

**`design-system.md`**:

1. Principios (tres a cinco, derivados del tipo de usuario y su contexto en `ux-design.md`).
2. Fundamentos: cómo usar color, tipografía, espaciado e iconografía.
3. Inventario de componentes. Recorre las historias y extrae las acciones y datos de cada pantalla. Tabla: componente | variantes | estados (normal, hover, foco, deshabilitado, cargando, error, vacío) | historias que lo usan | notas de accesibilidad.
4. Patrones de pantalla: listados con filtros, formularios, detalle, asistentes de varios pasos, tableros; los que aparezcan en las historias.
5. Contenido: tono, mensajes de error, confirmaciones, estados vacíos.
6. Reglas para pruebas: cada componente interactivo debe exponer un rol y un nombre accesible estables, y los que no puedan, un atributo `data-testid` con una convención de nombres que definas aquí. Esta sección la usan después la exploración web y la automatización.

**`preview.html`**: una sola página autocontenida que muestra los tokens y cada componente en sus estados, con el modo oscuro si se decidió. Sirve para que el cliente apruebe la identidad sin herramientas de diseño.

Registra como OQ lo que el cliente deba aprobar (colores, tipografía si no venían en la evidencia).

## 5. Modo REGENERAR

Conserva los nombres de tokens y componentes existentes: el código y las pruebas ya pueden depender de ellos. Si un nombre debe cambiar, déjalo como alias deprecado y documenta el cambio.

## 6. Cerrar

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas context-pack/ux-design.md context-pack/customer-background.md <carpeta de historias>/user-stories.md \
  --oq <OQ creadas> --resumen "<N> tokens, <M> componentes, contraste <ok o con fallas>"
```

Resume: componentes, fallas de contraste, decisiones aplicadas y lo que el cliente debe aprobar. Sugiere abrir `preview.html` en el navegador.
