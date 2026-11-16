# Formato de selectors.json

Este archivo lo producen `explore-web-app` y lo consumen `scaffold-automation-framework` (genera un page object por pantalla) y `automate-test-cases` (usa los elementos por su nombre lógico). Respeta los nombres de campos: el verificador `check_selectors.py` y las otras skills dependen de ellos.

Los selectores se escriben con la sintaxis de Playwright en JavaScript o TypeScript (`getByRole('button', { name: 'Guardar' })`) como notación neutral. El paso 15 los traduce al lenguaje elegido (Python, Java, C#).

```json
{
  "version": 1,
  "base_url": "https://staging.cliente.com",
  "explorado": "2026-11-03",
  "alcance": "sprint-01",
  "roles_explorados": ["vendedor", "gerente"],
  "convencion_test_id": "data-testid",
  "paginas": [
    {
      "id": "PG-01",
      "nombre": "Inicio de sesión",
      "nombre_logico": "LoginPage",
      "ruta": "/login",
      "titulo": "Ingresar | Cotizador",
      "requiere_rol": null,
      "historias": ["US-001"],
      "casos": ["TC-001-01", "TC-001-02"],
      "captura": "evidencia/PG-01.png",
      "obsoleto": false,
      "elementos": [
        {
          "id": "PG-01.E01",
          "nombre_logico": "campoUsuario",
          "tipo": "campo",
          "rol": "textbox",
          "nombre_accesible": "Usuario",
          "locator": "getByLabel('Usuario')",
          "estrategia": "label",
          "alternativas": ["getByRole('textbox', { name: 'Usuario' })", "#username"],
          "contenedor": null,
          "unico": true,
          "estabilidad": "alta",
          "dinamico": false,
          "usado_en": ["TC-001-01", "TC-001-02"],
          "notas": "",
          "obsoleto": false,
          "historial": []
        }
      ],
      "esperas": [
        {
          "descripcion": "Spinner mientras valida credenciales",
          "locator": "getByRole('progressbar')",
          "condicion": "desaparece"
        }
      ]
    }
  ],
  "navegacion": [
    { "desde": "PG-01", "hacia": "PG-02", "accion": "PG-01.E03" }
  ],
  "casos": [
    {
      "tc": "TC-001-01",
      "paginas": ["PG-01", "PG-02"],
      "ejecutable": "sí",
      "verificado_completo": true,
      "discrepancias": [],
      "oq": []
    }
  ]
}
```

## Un solo mapa para todo el proyecto

Cada lote guarda su propio `selectors.json` con las pantallas que tocan sus casos, pero los IDs son del proyecto, no del lote: la misma pantalla lleva el mismo `id` y el mismo `nombre_logico` en todos los lotes, y una pantalla nueva recibe el siguiente ID libre de todo el proyecto. `python3 .pipeline/scripts/merge_selectors.py` une los archivos de todos los lotes, da el siguiente ID libre y detecta choques; el framework (paso 15) genera los page objects desde ese mapa unido.

## Campos

**Pantalla**: `id` (`PG-NN`, estable), `nombre` (como la llama el usuario), `nombre_logico` (nombre de clase del page object, en PascalCase y terminado en `Page`), `ruta` (relativa a `base_url`; con parámetros como `/cotizaciones/:id`), `requiere_rol` (rol con el que se exploró, o `null`), `historias` y `casos` que la usan.

**Elemento**:
- `id`: `PG-NN.ENN`, estable entre versiones.
- `nombre_logico`: nombre de la propiedad en el page object, en camelCase, describiendo función y no apariencia (`botonGuardar`, no `botonAzul`).
- `tipo`: campo, boton, enlace, lista, opcion, casilla, radio, tabla, fila, celda, mensaje, titulo, dialogo, menu, pestana, imagen, otro.
- `locator`: el selector principal. `estrategia`: role, label, placeholder, text, title, alt, testid, css o xpath.
- `alternativas`: otros selectores válidos, del más al menos robusto.
- `contenedor`: `id` de otro elemento que acota este (por ejemplo, la fila dentro de una tabla), o `null`.
- `unico`: si se comprobó que apunta a un solo elemento.
- `estabilidad`: alta, media o baja. Si es baja, `notas` debe explicar por qué y sugerir un `data-testid`.
- `dinamico`: si aparece solo después de una acción o carga asíncrona.
- `usado_en`: casos que lo usan.
- `historial`: en regeneraciones, `{ "version": 2, "cambio": "nuevo selector por cambio de etiqueta" }`.

**Caso**: `ejecutable` (sí, parcial, no), `verificado_completo` (`false` si no se ejecutaron pasos que cambian datos), `discrepancias` (texto libre, una por entrada) y `oq` (IDs registrados).

Nunca incluyas en este archivo contraseñas, tokens, cookies ni datos personales reales.
