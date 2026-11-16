# Control de calidad (obligatorio antes de entregar)

`construir_pdf.py` hace las comprobaciones mecánicas y genera una imagen por página en `qc/`. Las de juicio las haces tú mirando cada imagen, una por una. Corrige y vuelve a construir hasta que todo pase. No entregues una versión con defectos conocidos.

## Lo que revisa el script

- Marcadores `{{...}}` sin llenar y variables de color sin resolver (detiene la construcción).
- Rayas largas y medias rayas, "lorem ipsum", TODO.
- Fuentes no incrustadas y peso mayor a 5 MB.
- Título y autor del PDF.
- Cantidad de páginas fuera de lo esperado.
- Lista de campos pendientes entre corchetes.

## Lo que revisas tú, en las imágenes

1. **Cifras:** cada cifra que aparece en más de un lugar (resumen, tablas, inversión, próximos pasos) es idéntica y coincide con `estimacion.json`. Ninguna cifra del cliente está sin fuente en la ficha de hechos.
2. **Marca:** la portada, el encabezado, el pie y la numeración siguen la especificación, y los colores son los del kit de marca y solo esos.
3. **Componentes:** tarjetas, tablas y diagramas con los mismos bordes, rellenos y tamaños de texto. Esto se cumple solo si usaste las clases de la plantilla.
4. **Paginación:** no hay títulos huérfanos, páginas casi vacías (menos del 40 % salvo la última y la de próximos pasos) ni elementos partidos entre páginas.
5. **Texto:** no hay palabras sueltas en inglés sin necesidad. El nombre del cliente, de sus personas, de sus sistemas y de sus procesos está bien escrito e igual en todo el documento.
6. **Pendientes:** los únicos textos pendientes son los campos entre corchetes que vas a declarar.

## Cómo corregir la paginación

- Si una sección se desborda por pocas líneas, acorta el texto.
- Si un bloque queda partido, muévelo o reduce su contenido; todos los componentes tienen `break-inside: avoid`.
- Si una página queda casi vacía, sube contenido de la siguiente sección solo si es de la misma sección. Si no, condensa la sección anterior.
