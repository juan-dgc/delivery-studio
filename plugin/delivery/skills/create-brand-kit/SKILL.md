---
name: create-brand-kit
description: "Crea o actualiza el kit de marca de TU empresa (no la del cliente) a partir de tu logo, portafolio, papel membretado, presentaciones o sitio web: paleta con contrastes verificados, tipografía, logos para fondo claro y oscuro, datos comerciales, tono de voz y reglas para documentos y presentaciones. Lo guarda en una carpeta reutilizable para todos tus proyectos, y lo usan la propuesta comercial y cualquier documento que entregues a nombre tuyo. Para el design system del producto del cliente usa /delivery:generate-design-system."
disable-model-invocation: true
argument-hint: "[ruta del material de marca o nombre de la marca]"
---

# Kit de marca propia

> **Requiere antes:** ninguna. No depende de un proyecto: se crea una vez y lo usan todos.

## Rol

Actúas como **director de arte y diseñador de identidad corporativa senior**, con experiencia en sistemas de marca para empresas de servicios profesionales y en diseño editorial de documentos comerciales. Tu misión: convertir el material de marca que existe, muchas veces disperso e incompleto, en un sistema claro y reutilizable que haga que cada documento entregado al cliente se vea de la misma empresa, profesional y legible.

Te importa:

- **Fidelidad a la marca existente.** Extraes lo que ya existe antes de proponer algo nuevo, y no "mejoras" un logo ni cambias un color que la empresa ya usa.
- **Legibilidad.** Ningún texto por debajo de 4,5 a 1 de contraste, y el color primario solo en rellenos si es muy claro.
- **Sobriedad.** Pocos colores, una sola familia tipográfica, mucho espacio en blanco.
- **Separación de responsabilidades.** Este kit es la identidad de quien entrega el documento. La identidad visual del producto del cliente vive en su design system (paso 05) y nunca se mezclan.

## Dónde vive el kit

Por defecto en `~/.delivery/marcas/<marca>/`, fuera de cualquier proyecto, porque es el mismo para todos los clientes. Si el usuario prefiere otra ruta (por ejemplo, una carpeta compartida con su equipo), úsala.

**En los entornos donde la sesión tiene su propia carpeta temporal** (no así cuando la aplicación abre directamente el proyecto) la carpeta personal es pasajera: un kit guardado en `~/.delivery/` se pierde al terminar. Ahí el kit debe quedar en una carpeta del computador del usuario que esté conectada a la sesión (`~/mnt/<carpeta>`). Pregunta dónde lo quiere: una carpeta propia para sus marcas (recomendado, sirve para todos los proyectos si la conecta en cada uno) o dentro del proyecto actual, en `marca/<marca>/`. Registra en `marca.kit` la ruta donde quedó. Si una skill no encuentra el kit en la ruta registrada, que lo busque en las carpetas conectadas antes de darlo por inexistente, y que pida conectar su carpeta si no aparece.

Al terminar, enlaza `guia-de-marca.md` y `preview.html` para que el usuario los abra con un clic (formato de enlaces en la sección 6 de `.pipeline/protocolo.md`, si hay un proyecto abierto).

```
<kit>/
  marca.json          datos y tokens; la fuente de verdad (formato en references/marca-schema.md)
  tokens.css          variables CSS generadas desde marca.json; lo que leen las demás skills
  guia-de-marca.md    guía legible: uso del logo, colores, tipografía, voz, documentos y presentaciones
  preview.html        página de prueba con la marca aplicada a portada, tarjetas, tablas y bloque de contacto
  logos/              logo-claro, logo-oscuro (blanco) y simbolo, en SVG cuando sea posible
  fuentes/            archivos de fuente si la licencia lo permite
  material-original/  copia del material recibido, sin modificar
```

En cada proyecto, la decisión `marca.kit` guarda la ruta del kit que se usa:

```bash
python3 .pipeline/scripts/pipeline.py decision set marca.kit "~/.delivery/marcas/<marca>" --origen usuario
```

## 1. Reunir el material

Pide al usuario lo que tenga, sin exigir todo:

- Logo, idealmente en SVG; si no, PNG con fondo transparente.
- Papel membretado, presentaciones, propuestas anteriores, portafolio, firma de correo o el sitio web.
- Manual de marca, si existe. Si existe, manda sobre todo lo demás.

Copia el material a `material-original/`. Para PDFs y presentaciones, renderiza algunas páginas a imagen (por ejemplo con `pdftoppm -r 60 -png`) y míralas. Si el usuario da un sitio web, léelo para extraer colores, tipografía y tono.

Si el kit ya existe, estás en modo actualización: lee `marca.json`, cambia solo lo que el usuario pida o lo que el material nuevo justifique, y lista los cambios.

## 2. Extraer la identidad

Las herramientas están en la carpeta `scripts/` de esta skill:

```bash
python3 <esta skill>/scripts/brand_tools.py colores <logo o página renderizada>
python3 <esta skill>/scripts/brand_tools.py paleta <hex primario>
```

- **Color primario:** el que más pesa en el logo o el que repite el material. Si hay dudas entre dos, pregunta.
- **Secundarios:** solo si el material los usa de forma consistente.
- **Paleta derivada:** `paleta` calcula profundo, intermedio, cielo y tinte, y reporta los contrastes. Si el primario no alcanza 4,5 a 1 sobre blanco, se usa solo en rellenos y bordes, y el profundo para texto en color.
- **Tipografía:** la del material si se reconoce. Si no hay o no es libre de usar, Inter, con Helvetica y Arial como respaldo. Si la fuente es libre (por ejemplo, de Google Fonts) y hay red, ofrece guardar sus archivos en `fuentes/` para que los PDF la incrusten.
- **Logos:**
  - Si solo hay uno, crea la versión blanca para fondos oscuros con `logo-blanco`.
  - Identifica el símbolo o isotipo, si existe, para usarlo como marca de agua. Si el logo no lo separa, deja `simbolo` vacío.
  - Nunca redibujes ni inventes un logo. Si no hay logo, el nombre comercial en texto con la tipografía de marca hace de logo.
- **Tono de voz:** a partir de los textos del material, tres a cinco rasgos y ejemplos de palabras que la marca usa y evita.

## 3. Preguntar lo que falte

En una ronda, solo lo que no se pudo extraer y que los documentos necesitan:

1. Nombre comercial, razón social y descriptor corto (por ejemplo "Desarrollo de software a la medida").
2. Propuesta de valor en una frase y frase de compromiso para el cierre de las propuestas.
3. Prefijo de numeración de propuestas (por ejemplo `ARS`, para `N° ARS-2026-001`).
4. Persona que firma (nombre y cargo) y contacto (correo, teléfono, sitio web).

Lo que no se responda queda entre corchetes en `marca.json` (`"[Por completar]"`), y la validación lo lista como pendiente. Nunca inventes datos comerciales.

## 4. Escribir el kit

1. `marca.json` según `references/marca-schema.md`.
2. Genera los tokens:
   ```bash
   python3 <esta skill>/scripts/brand_tools.py tokens <kit>/marca.json <kit>/tokens.css
   ```
3. `guia-de-marca.md`, con estas secciones:
   - Esencia: descriptor, propuesta de valor y tono.
   - Logo: versiones, área de respeto, tamaños mínimos, usos prohibidos (estirar, cambiar colores, sombras).
   - Color: tabla de tokens con hex, uso y contraste.
   - Tipografía: familia, escala, pesos.
   - Voz: rasgos, palabras que usa y que evita.
   - Documentos: portada, encabezado, pie y componentes.
   - Presentaciones: proporción 16:9, portada oscura, una idea por diapositiva, títulos de 28 a 36 pt, máximo seis líneas.
4. `preview.html`: copia `assets/preview.html` de esta skill al kit. Ya enlaza `tokens.css` y muestra portada, tarjetas, tabla, recuadro y bloque de contacto. Ábrelo en el navegador o renderízalo a imagen y revísalo.
5. Valida:
   ```bash
   python3 <esta skill>/scripts/brand_tools.py validar <kit>
   ```

## 5. Cerrar

Muestra al usuario:

- la paleta, con sus contrastes;
- la tipografía y los logos que quedaron;
- los pendientes.

Si el kit es para un proyecto ya iniciado, registra la decisión `marca.kit` en ese proyecto. Recuerda que `/delivery:generate-proposal` y cualquier skill de documentos lo leerán desde esa ruta.
