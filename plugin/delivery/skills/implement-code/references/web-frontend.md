# Guía: frontend web

Aplica a aplicaciones web de una sola página o con renderizado en servidor (React, Angular, Vue, Next.js, Svelte u otro). Si `coding-standards.md` o el código existente dicen otra cosa, mandan ellos: esta guía cubre lo que no esté definido.

## Estructura

- Organiza por funcionalidad (módulo del dominio), no por tipo de archivo: `cotizaciones/` con sus pantallas, componentes, llamadas y pruebas juntos. Los componentes compartidos del design system van aparte.
- Separa tres capas: componentes de presentación (sin lógica de negocio), estado y lógica de la pantalla, y cliente de API (una función por operación del contrato, con los tipos generados o escritos desde el OpenAPI).
- Una pantalla por ruta, con el nombre de la pantalla que usa `ux-design.md`.

## Datos y estado

- Todas las llamadas pasan por el cliente de API; ningún componente llama a `fetch` directamente.
- Cada pantalla que carga datos maneja los cuatro estados: cargando, vacío, error y con datos. El design system define cómo se ven.
- Estado del servidor (lo que viene de la API) separado del estado de la interfaz (filtros, pestañas). Usa la librería que defina `tech-policy.md`; si no hay, la más simple que resuelva la caché y la revalidación.
- No guardes tokens en `localStorage` si la arquitectura define cookies seguras; sigue el mecanismo de autenticación del paso 07.

## Formularios

- Validación en el cliente con las mismas reglas del contrato (obligatorios, longitudes, formatos, rangos), para responder rápido; la validación del servidor sigue siendo la que manda.
- Muestra los errores que devuelve la API en el campo correspondiente cuando el error lo identifica.
- Deshabilita el envío mientras se procesa, para evitar envíos dobles.

## Accesibilidad y pruebas

- Elementos nativos con su rol (`button`, `a`, `input` con `label`), nunca un `div` clicable.
- Todo control interactivo con nombre accesible visible o `aria-label`.
- Agrega `data-testid` (o el atributo de la convención del design system) a los elementos sin rol y nombre únicos: filas de tablas, contenedores de resultados, mensajes dinámicos.
- Navegación con teclado y foco visible; contraste según el nivel de accesibilidad decidido.
- Pruebas de componentes para la lógica de presentación no trivial (formateos, condiciones de visibilidad por rol).

## Seguridad en el cliente

- Nunca confíes en el cliente para autorizar: ocultar un botón no reemplaza la verificación en el servidor.
- No interpoles HTML sin sanitizar; usa los mecanismos del framework.
- Ninguna llave o secreto en el código del frontend: todo lo que llega al navegador es público.

## Internacionalización

Si `ux-design.md` define más de un idioma o formatos regionales, todos los textos van en archivos de traducción desde el inicio, y fechas, números y monedas con el formato regional.
