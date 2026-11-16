# Formato de marca.json

Es la fuente de verdad del kit. `tokens.css` se genera desde aquí, y las skills de documentos leen ambos. Los campos que no se conozcan van como `"[Por completar]"`, nunca inventados.

```json
{
  "version": 1,
  "actualizado": "2026-11-03",
  "nombre_comercial": "Nombre Comercial",
  "razon_social": "Nombre Comercial S.A.S.",
  "nit": "[Por completar]",
  "descriptor": "Desarrollo de software a la medida",
  "propuesta_valor": "Construimos software que se adapta a cómo trabaja tu empresa, no al revés.",
  "frase_compromiso": "Nos comprometemos con resultados medibles y una comunicación clara en cada fase.",
  "prefijo": "NCO",
  "idioma": "es-CO",
  "firmante": { "nombre": "Nombre Apellido", "cargo": "Gerente comercial" },
  "contacto": { "correo": "contacto@empresa.com", "telefono": "+57 300 000 0000", "sitio_web": "empresa.com" },
  "colores": {
    "primario": "#1F6FEB",
    "profundo": "",
    "intermedio": "",
    "cielo": "",
    "tinte": "",
    "tinta": "#0D1117",
    "gris_apoyo": "#5A5F66",
    "gris_claro": "#F2F4F7",
    "linea": "#E3E7EE",
    "gris_portada": "#8E949E",
    "divisor_portada": "#262D3A",
    "secundarios": []
  },
  "tipografia": {
    "familia": "Inter",
    "respaldo": ["Helvetica", "Arial", "sans-serif"],
    "archivos": [
      { "ruta": "fuentes/Inter-Regular.woff2", "peso": 400 },
      { "ruta": "fuentes/Inter-Bold.woff2", "peso": 700 }
    ]
  },
  "logos": {
    "claro": "logos/logo-claro.svg",
    "oscuro": "logos/logo-oscuro.svg",
    "simbolo": "logos/simbolo.svg"
  },
  "voz": {
    "rasgos": ["profesional", "cercano", "seguro", "concreto"],
    "usar": ["proponemos", "construimos", "ajustamos"],
    "evitar": ["líder", "innovador", "el mejor", "cabe destacar"]
  },
  "documentos": {
    "formato": "carta",
    "tarifa_hora": "[Por completar]",
    "moneda": "COP",
    "iva_porcentaje": 19,
    "validez_dias": 30,
    "garantia_dias": 30,
    "horas_capacitacion": "[Por completar]",
    "mantenimiento_anual_porcentaje": 18
  },
  "fuentes": ["material-original/papel-membretado.pdf", "https://empresa.com"],
  "pendientes": ["nit", "documentos.tarifa_hora"]
}
```

## Reglas

- **Colores derivados vacíos:** `tokens` los calcula desde el primario (profundo = primario oscurecido 20 %, intermedio = aclarado 15 %, cielo = aclarado 40 %, tinte = primario al 8 % sobre blanco). Llénalos solo si la marca define los suyos.
- **Neutros:** si la marca trae los suyos, reemplaza los de este ejemplo.
- **Logos:** rutas relativas a la carpeta del kit. `oscuro` es la versión para fondos oscuros (normalmente blanca). Si no hay logo, deja los tres vacíos: los documentos usarán el nombre comercial en texto.
- **Archivos de fuente:** solo si la licencia permite incrustarlos. Si la lista está vacía, los documentos usan la fuente instalada en el sistema.
- **Datos comerciales:** viven aquí porque son de la empresa, no del proyecto. `tarifa_hora` puede quedar pendiente si se prefiere definirla por proyecto en `commercial.md`.
