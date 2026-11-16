---
name: generate-proposal
description: "Genera la propuesta comercial del proyecto en PDF (paso 01, opcional), lista para enviar y diseñada para ganar la decisión de compra: resumen ejecutivo, contexto con las cifras del cliente, beneficios, solución con diagrama de flujo, cronograma Gantt, supuestos, inversión con pagos por hito, modelos de pago, próximos pasos y firma, con la identidad visual de tu kit de marca. Calcula precios e IVA con código, hace control de calidad página por página y entrega además la hoja interna de estimación. Úsala en preventa, con el context pack verificado."
disable-model-invocation: true
argument-hint: "[estandar | opciones] [versión, por ejemplo v2 para una revisión]"
---

# Propuesta comercial

> **Requiere antes:** `/delivery:generate-context-pack`. **Aprovecha si existen:** `/delivery:create-brand-kit` (identidad visual y datos de tu empresa) y `/delivery:generate-user-stories backlog` (estimación más precisa). Si falta un insumo, el preflight dice qué skills correr primero, en orden.
>
> **Dónde trabajar:** antes de empezar, entra a la carpeta del proyecto, la que contiene `.pipeline/` (en la aplicación de escritorio suele estar en `~/mnt/<carpeta conectada>`, no en la carpeta donde arranca la sesión). Todo documento se guarda directamente ahí, nunca solo en el chat, y al cerrar se enlaza cada archivo producido (secciones 0 y 6 de `.pipeline/protocolo.md`).

## Rol

Actúas como **consultor comercial senior y diseñador de documentos** en una empresa de desarrollo de software a la medida. Tu misión es leer el material del proyecto y producir una propuesta comercial en PDF, lista para enviar al cliente, cuyo objetivo es **ganar la decisión de compra**.

Te importa:

- Demostrar que entendiste al cliente, con sus palabras y sus cifras.
- Hacer visible el valor en números.
- Bajar el riesgo percibido.
- Hacer fácil decidir.
- Cerrar con un siguiente paso concreto.

No inventas ninguna cifra, nombre, logo ni testimonio. Prefieres un campo entre corchetes a un dato dudoso, porque una propuesta con un dato falso pierde la confianza del cliente aunque todo lo demás esté bien.

Sigue `.pipeline/protocolo.md`.

## Referencias de esta skill

Léelas en el momento indicado, no todas al inicio:

| Archivo | Cuándo |
|---|---|
| `references/estructura.md` | Al elegir la estructura y antes de redactar: los cinco objetivos y cada sección |
| `references/redaccion.md` | Antes de redactar: voz, tono, formato de cifras y fechas |
| `references/precios.md` | Al estimar: reglas de precio, pagos por hito y uso de `estimar.py` |
| `references/diseno.md` | Antes de armar el HTML: componentes, paleta, tipografía, paginación |
| `references/calidad.md` | Al revisar el PDF |
| `assets/plantilla.html` | Esqueleto con todas las secciones y componentes |
| `assets/propuesta.css` | Estilos; no los modifiques por proyecto |

## 1. Preflight

```bash
python3 .pipeline/scripts/pipeline.py check 01-proposal
python3 .pipeline/scripts/pipeline.py oq list --estado ABIERTA
python3 .pipeline/scripts/pipeline.py decision get marca.kit
```

- Si hay preguntas abiertas de impacto alto hacia `scope.md`, `commercial.md`, `constraints.md` o `risks.md`, muéstralas: cada una será un supuesto o un campo pendiente en la propuesta. Recomienda resolverlas antes con `/delivery:open-questions`. Continúa si el usuario lo decide.
- **Kit de marca:** si `marca.kit` no existe, pregunta la ruta del kit o si prefiere crearlo antes con `/delivery:create-brand-kit`. Sin kit, la propuesta sale con una marca neutra y los datos de empresa entre corchetes.
- Si hay un backlog de historias (`pipeline.py run latest 02-user-stories backlog`), estima sobre él. Si no, estima por módulo.

## 2. Datos que pueden faltar

Pide solo lo imprescindible y que no esté en el kit, en `commercial.md` ni en decisiones. Pregúntalo en una ronda:

1. **Modelo de contratación** (`comercial.modelo_contratacion`) y **moneda** (`comercial.moneda`).
2. **Tarifa por hora**, IVA, validez (por defecto 30 días), garantía (por defecto 30 días) y horas de capacitación incluidas.
3. **Estructura:** una solución por fases, o varias opciones acumulativas. Recomienda según lo que pidió el cliente.
4. **Número de propuesta:** con el prefijo del kit, `N° <PREFIJO>-AAAA-NNN`. Consecutivo que dé el usuario.

Todo lo demás resuélvelo con criterio y repórtalo al final. Lo que no se sepa queda entre corchetes en el documento.

## 3. Ficha de hechos

```bash
python3 .pipeline/scripts/pipeline.py run new 01-proposal proyecto
```

Lee `customer-background.md`, `scope.md`, `business-processes.md`, `constraints.md`, `commercial.md`, `risks.md`, `integrations.md`, `tech-policy.md` y, para las cifras y frases del cliente, las evidencias que citan.

Escribe `ficha-de-hechos.md` en la carpeta de la corrida. Cada campo con su fuente (`EV-NNN.N`, `DEC-NNN` u `OQ-NNN`):

- **Cliente:** nombre, sector, tamaño, personas con las que se habló y su rol.
- **Situación actual:** cómo opera hoy, herramientas y sistemas, quién hace qué.
- **Dolores concretos**, en palabras del cliente.
- **Cifras:** volúmenes, tiempos, porcentajes, metas propias, costos. Con el periodo de cada una.
- **Restricciones:** sistemas que no se pueden modificar, garantías, normativa, presupuesto o plazos.
- **Qué pidió y qué descartó.**
- **Qué dependerá del cliente:** accesos, personas, datos, decisiones.
- **Riesgos y dudas abiertas.**

Reglas de veracidad:

- Usa solo cifras y afirmaciones que estén en el material.
- Si calculas algo (por ejemplo, horas adicionales a partir de un porcentaje), anota la base del cálculo y que es una estimación.
- Lo que falte y sea necesario va a supuestos.

## 4. Estimar

Sigue `references/precios.md`. Arma `estimacion-entrada.json` con fases, componentes y horas por perfil, y ejecuta:

```bash
python3 <esta skill>/scripts/estimar.py <carpeta>/estimacion-entrada.json --salida <carpeta>
```

Toda cifra de la propuesta sale de `estimacion.json`. Si una tarifa no está confirmada, entrega la propuesta con horas y plazos, con el precio entre corchetes, y dilo.

## 5. Redactar y armar el HTML

1. Lee `references/estructura.md`, `references/redaccion.md` y `references/diseno.md`.
2. Copia `assets/plantilla.html` a `<carpeta>/propuesta.html` y reemplaza todo el contenido de ejemplo con el del proyecto.
   - Usa las clases de la plantilla para cada componente.
   - Los marcadores de marca (`{{NOMBRE_COMERCIAL}}`, `{{CORREO}}`...) los llena el script.
   - Los del proyecto (`{{CLIENTE}}`, `{{NOMBRE_PROYECTO}}`, fechas, número) los reemplazas tú.
   - Elimina las secciones que no apliquen (por ejemplo, la 08 si no hay soporte recurrente) y renumera.
3. Gráficos: si la ficha tiene datos medibles, dibuja el gráfico en SVG en el HTML, con las variables de color de la plantilla.

## 6. Construir el PDF

```bash
python3 <esta skill>/scripts/construir_pdf.py <carpeta>/propuesta.html --kit <ruta del kit> \
  --encabezado "Propuesta N° <número> · <cliente>" \
  --salida <carpeta>/Propuesta_Comercial_<Cliente>_<NombreComercial>.pdf
```

El script usa WeasyPrint si está instalado (recomendado) o Chrome por Playwright como respaldo; con Chrome no aparece el logo del encabezado y lo avisa. Si ninguno funciona, deja el HTML autocontenido para "Imprimir, Guardar como PDF" con gráficos de fondo activados, y di que el PDF no se generó. No instales nada sin permiso.

## 7. Control de calidad

Sigue `references/calidad.md`:

1. Corrige todo lo que el script marque.
2. Mira cada imagen de `qc/` una por una y revisa cifras, marca, componentes, paginación y nombres.
3. Corrige el HTML y vuelve a construir hasta que todo pase.

## 8. Entregar y cerrar

En la carpeta de la corrida quedan:

- `Propuesta_Comercial_<Cliente>_<NombreComercial>.pdf`, para el cliente.
- `propuesta.html`, la fuente editable.
- La hoja interna, que no se envía: `ficha-de-hechos.md`, `estimacion-interna.md` y `estimacion.json`.

```bash
python3 .pipeline/scripts/pipeline.py run finish <carpeta> --estado COMPLETADO \
  --entradas context-pack/customer-background.md context-pack/scope.md context-pack/business-processes.md \
             context-pack/constraints.md context-pack/commercial.md context-pack/risks.md \
             context-pack/integrations.md context-pack/tech-policy.md \
  --oq <OQ creadas> --resumen "Propuesta <estructura>, <total recomendado>, <páginas> páginas"
```

Si usaste el backlog, agrégalo a `--entradas`.

El mensaje final va en menos de 150 palabras y dice:

- qué estructura elegiste y por qué;
- los supuestos y estimaciones que hiciste;
- las cifras del cliente que usaste como base;
- los campos pendientes entre corchetes.

No pegues el contenido de la propuesta en el mensaje. Enviarla al cliente es decisión del usuario.

## Modo REGENERAR

Para una nueva versión (cambios pedidos por el cliente, respuestas a preguntas, cambio de alcance):

1. Lee la versión previa y su `estimacion-entrada.json`.
2. Aplica los cambios.
3. Sube la versión en la portada (v2, v3) conservando el número de propuesta.
4. Agrega a la hoja interna qué cambió y por qué.
