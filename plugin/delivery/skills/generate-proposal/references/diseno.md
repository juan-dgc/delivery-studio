# Componentes gráficos y especificaciones de diseño

Todo se dibuja de forma nativa (HTML y CSS, SVG o tablas), con texto seleccionable. No uses imágenes rasterizadas para tablas, diagramas ni gráficos, salvo el logo y los ornamentos de la portada. `assets/propuesta.css` ya implementa estas medidas; `assets/plantilla.html` muestra el marcado de cada componente. Usa esas clases y no inventes estilos nuevos: así todas las propuestas se ven iguales.

## Componentes y su clase

| Componente | Clase en la plantilla | Especificación |
|---|---|---|
| Tarjetas de datos (3) | `.tarjetas-datos > .tarjeta-dato` | Etiqueta en mayúsculas pequeñas, valor en negrita grande y una línea descriptiva. Primera en primario con texto blanco, segunda en oscuro con texto blanco, tercera en gris claro. |
| Tarjetas con ícono (3) | `.tarjetas-icono > .tarjeta-icono` | Borde superior grueso en primario, fondo gris claro, ícono lineal simple en primario (bandera, rayo, triángulo u otros geométricos), título en mayúsculas y texto breve. |
| Tablas de datos | `table.datos` | Encabezado oscuro con texto blanco en negrita, líneas finas, fondo alterno gris claro, subtotales (`tr.subtotal`) con tinte suave y negrita, numéricas a la derecha (`.num`), cifras clave en celda primaria (`td.destacado`), filas de grupo (`tr.grupo`) en mayúsculas pequeñas. |
| Diagrama de flujo | `.flujo > .fila`, `.fila.inversa`, `.bajada` | Tarjetas con rótulo "PASO N", título en negrita y descripción en gris. Se lee de izquierda a derecha y al final de la fila baja y continúa en sentido inverso (serpiente). El paso con la información final en primario (`.paso.final`), el paso humano de decisión en oscuro (`.paso.humano`). Pie de una línea explicando los colores. |
| Tarjetas de fase (4) | `.fases > .fase` | Número grande en primario, título en negrita, 2 o 3 líneas y las semanas en negrita pequeña. |
| Gantt | `table.gantt`, celdas `.c1` a `.c4`, `tr.hitos` | Primera columna con fases, una columna por semana, celdas con los tonos de marca (primario, intermedio, profundo, cielo), fila de hitos con ◆, leyenda (`.leyenda`) y nota gris. |
| Extensiones (3) | `.extensiones > .extension` | Tarjetas numeradas 01, 02, 03. |
| Tarjetas de pago | `.pagos > .pago` | Etiqueta en mayúsculas pequeñas, porcentaje grande en negrita y momento de pago, fondo gris claro. |
| Recuadro de compromiso | `.recuadro` | Tinte suave, borde izquierdo grueso en primario, frase inicial en negrita. |
| Firmas | `.firmas > .firma` | Dos columnas, línea superior oscura, campos entre corchetes. |
| Contacto | `.contacto` | Caja oscura a todo el ancho, logo blanco, divisor fino, rótulo "HABLEMOS", nombre en negrita, empresa y contacto. |
| Gráfico de datos | `figure.grafico` con SVG | Barras o líneas con la paleta de marca, etiquetas directas, sin cuadrícula pesada, pie con fuente y periodo. Usa `var(--primario)` y demás variables en los atributos `fill`; el script las resuelve. |

## Paleta

Viene del kit de marca (`tokens.css`). Si no hay kit, el script usa una neutra y lo avisa.

| Token | Uso |
|---|---|
| `--tinta` | Títulos, texto principal y fondos oscuros |
| `--gris-apoyo` | Texto secundario, encabezado y pie |
| `--primario` | Acentos, rellenos, bordes |
| `--profundo` | Primario oscurecido un 20 %; texto en color si el primario no tiene contraste |
| `--intermedio` | Primario aclarado un 15 % |
| `--cielo` | Primario aclarado un 40 %; subtítulo de portada |
| `--gris-claro` | Fondos de tarjetas y filas alternas |
| `--tinte` | Primario al 8 % sobre blanco; recuadros y subtotales |
| `--linea` | Bordes finos |
| `--gris-portada`, `--divisor-portada` | Textos pequeños y divisores sobre fondo oscuro |
| `--color-texto` | Lo calcula el script: primario si cumple 4,5 a 1 sobre blanco, si no profundo |

Todo texto debe tener un contraste mínimo de 4,5 a 1 contra su fondo.

## Tipografía y página

- Una sola familia sans serif (la del kit; Inter por defecto).
- Cuerpo de 10 pt con interlineado de 1,3. Título de sección de 28 pt en negrita. Subtítulo de 13 pt en negrita. Rótulo de sección de 8 pt en mayúsculas espaciadas.
- Tablas de 8,5 a 9 pt, tarjetas de 7,5 pt, notas de 7,5 a 8 pt en gris de apoyo.
- Carta (21,59 por 27,94 cm). Márgenes laterales de 1,8 cm, superior de 2,6 cm, inferior de 2,1 cm.
- **Encabezado** (interiores): logo pequeño a la izquierda, "Propuesta N° ... · Cliente" a la derecha en 8 pt, línea fina inferior.
- **Pie:** franja corta en primario, "Razón social · Documento confidencial" a la izquierda, número de página de dos dígitos a la derecha, empezando en 01 en la primera página interior.
- **Portada:** sin encabezado ni pie, fondo tinta a sangre, logo claro arriba a la izquierda, cuadrícula de puntos tenue arriba a la derecha, símbolo del logo muy grande y casi transparente abajo a la derecha (si el kit tiene símbolo), barra de acento sobre el título, título de 46 pt, subtítulo de 15 pt en cielo, cuadrícula de datos en tres columnas.

## Paginación

- Los títulos nunca quedan solos al final de una página.
- Las tablas no se parten por la mitad de una fila.
- El flujo, el Gantt y los bloques de tarjetas no se parten entre páginas.
- Ninguna página interior queda con menos del 40 % de contenido, salvo la última y la de próximos pasos.
- Si una sección se desborda por pocas líneas, acorta el texto antes de añadir una página.
