#!/usr/bin/env python3
"""Construye el PDF de la propuesta desde propuesta.html y el kit de marca, y prepara el control de calidad.

Pasos:
  1. Incrusta tokens.css del kit y propuesta.css en el HTML y resuelve las variables de color.
  2. Llena los marcadores de marca ({{NOMBRE_COMERCIAL}}, {{CORREO}}...) desde marca.json y pone los logos.
  3. Escribe un HTML autocontenido (imágenes en base64) y lo convierte a PDF con WeasyPrint
     (recomendado) o Chrome vía Playwright (respaldo: no muestra el logo del encabezado).
  4. Fija título y autor, renderiza cada página como PNG y revisa: marcadores sin llenar, rayas largas
     o medias rayas, lorem ipsum, fuentes incrustadas, peso y cantidad de páginas.

Uso:
  python3 construir_pdf.py propuesta.html --kit ~/.delivery/marcas/<marca> --salida Propuesta.pdf \\
      --encabezado "Propuesta N° ARS-2026-001 · Cliente" [--qc carpeta] [--motor auto|weasyprint|chrome]
Sin --kit usa una marca neutra y lo advierte.
"""
import argparse
import base64
import json
import mimetypes
import re
import shutil
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
CSS_PROPUESTA = AQUI.parent / "assets" / "propuesta.css"
NEUTRO = {"primario": "#1F6FEB", "tinta": "#0D1117", "gris_apoyo": "#5A5F66", "gris_claro": "#F2F4F7",
          "linea": "#E3E7EE", "gris_portada": "#8E949E", "divisor_portada": "#262D3A"}
RAYAS = "—–"


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mezclar(h, con, t):
    a, b = hex_rgb(h), hex_rgb(con)
    return "#" + "".join(f"{round(x + (y - x) * t):02X}" for x, y in zip(a, b))


def lum(h):
    def c(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (c(v) for v in hex_rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def variables_css(texto):
    return {m.group(1): m.group(2).strip() for m in re.finditer(r"--([\w-]+)\s*:\s*([^;]+);", texto)}


def data_uri(ruta):
    tipo = mimetypes.guess_type(str(ruta))[0] or "application/octet-stream"
    return f"data:{tipo};base64," + base64.b64encode(Path(ruta).read_bytes()).decode()


def logo_encabezado(ruta, destino):
    """Logo de unos 92 por 32 px para el encabezado. Devuelve la ruta del archivo o None."""
    ruta = Path(ruta)
    if ruta.suffix.lower() == ".svg":
        t = ruta.read_text(encoding="utf-8")
        t = re.sub(r'(<svg\b[^>]*?)\s(width|height)="[^"]*"', r"\1", t, count=2)
        t = t.replace("<svg", '<svg width="92" height="32" preserveAspectRatio="xMinYMid meet"', 1)
        destino = destino.with_suffix(".svg")
        destino.write_text(t, encoding="utf-8")
        return destino
    try:
        from PIL import Image
    except ImportError:
        return ruta
    im = Image.open(ruta)
    im.thumbnail((92, 32))
    destino = destino.with_suffix(".png")
    im.save(destino)
    return destino


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("html")
    ap.add_argument("--kit")
    ap.add_argument("--salida", required=True)
    ap.add_argument("--encabezado", required=True, help='Texto del encabezado, p. ej. "Propuesta N° ARS-2026-001 · Cliente"')
    ap.add_argument("--qc", help="Carpeta para las imágenes de cada página (por defecto, junto al PDF en qc/)")
    ap.add_argument("--motor", default="auto", choices=["auto", "weasyprint", "chrome"])
    a = ap.parse_args()

    origen = Path(a.html).resolve()
    salida = Path(a.salida).resolve()
    trabajo = salida.parent / "_build"
    trabajo.mkdir(parents=True, exist_ok=True)
    avisos, errores = [], []

    # --- marca
    marca, kit = {}, None
    if a.kit:
        kit = Path(a.kit).expanduser().resolve()
        if (kit / "marca.json").exists():
            marca = json.loads((kit / "marca.json").read_text(encoding="utf-8"))
        else:
            errores.append(f"No existe {kit / 'marca.json'}")
    else:
        avisos.append("Sin kit de marca: se usa una marca neutra. Crea uno con /delivery:create-brand-kit.")
    tokens_txt = (kit / "tokens.css").read_text(encoding="utf-8") if kit and (kit / "tokens.css").exists() else ""
    vars_ = variables_css(tokens_txt)
    prim = vars_.get("primario") or marca.get("colores", {}).get("primario") or NEUTRO["primario"]
    base = {k.replace("_", "-"): v for k, v in NEUTRO.items()}
    base.update({"primario": prim, "profundo": mezclar(prim, "#000000", .2), "intermedio": mezclar(prim, "#FFFFFF", .15),
                 "cielo": mezclar(prim, "#FFFFFF", .4), "tinte": mezclar(prim, "#FFFFFF", .92),
                 "fuente": '"Inter", Helvetica, Arial, sans-serif'})
    base.update(vars_)
    base["color-texto"] = base["primario"] if contraste(base["primario"], "#FFFFFF") >= 4.5 else base["profundo"]
    if base["color-texto"] != base["primario"]:
        avisos.append(f"El primario {base['primario']} no alcanza 4,5 a 1 sobre blanco: los textos en color usan el profundo.")

    # --- HTML y CSS
    html = origen.read_text(encoding="utf-8")
    css = CSS_PROPUESTA.read_text(encoding="utf-8")
    fuentes_css = "\n".join(l for l in tokens_txt.splitlines() if l.startswith("@font-face"))
    if kit:
        fuentes_css = re.sub(r'url\("([^"]+)"\)', lambda m: f'url("{data_uri(kit / m.group(1))}")'
                             if (kit / m.group(1)).exists() else m.group(0), fuentes_css)
    pie = f"{marca.get('razon_social') or marca.get('nombre_comercial') or '[Razón social]'} · Documento confidencial"
    css = css.replace("{{ENCABEZADO}}", a.encabezado.replace('"', "'")).replace("{{PIE}}", pie.replace('"', "'"))

    logos = marca.get("logos", {})
    enc = None
    if kit and logos.get("claro") and (kit / logos["claro"]).exists():
        enc = logo_encabezado(kit / logos["claro"], trabajo / "logo-encabezado")
    if enc:
        css = css.replace('url("kit-logo-encabezado")', f'url("{data_uri(enc)}")')
    else:
        nombre = (marca.get("nombre_comercial") or "[Nombre comercial]").replace('"', "'")
        css = css.replace('content: url("kit-logo-encabezado");', f'content: "{nombre}"; font-family: var(--fuente); font-weight: 700; font-size: 9pt;')
    estilos = f"<style>\n{fuentes_css}\n:root {{ {' '.join(f'--{k}: {v};' for k, v in base.items())} }}\n{css}\n</style>"
    html = re.sub(r'<link[^>]+href="tokens\.css"[^>]*>\s*', "", html)
    html = re.sub(r'<link[^>]+href="propuesta\.css"[^>]*>', estilos, html)

    def poner_logo(m):
        tipo = m.group(1)
        archivo = logos.get(tipo) or (logos.get("oscuro") if tipo == "simbolo" else None)
        if tipo == "simbolo" and not logos.get("simbolo"):
            return ""  # sin símbolo no hay marca de agua
        if kit and archivo and (kit / archivo).exists():
            return m.group(0).replace(f'data-logo="{tipo}"', f'data-logo="{tipo}" src="{data_uri(kit / archivo)}"')
        if tipo == "simbolo":
            return ""
        return f'<span class="logo-texto">{marca.get("nombre_comercial", "[Nombre comercial]")}</span>'
    html = re.sub(r'<img\b[^>]*data-logo="(\w+)"[^>]*>', poner_logo, html)

    reemplazos = {
        "NOMBRE_COMERCIAL": marca.get("nombre_comercial"), "RAZON_SOCIAL": marca.get("razon_social"),
        "DESCRIPTOR": marca.get("descriptor"), "PROPUESTA_DE_VALOR": marca.get("propuesta_valor"),
        "FRASE_DE_COMPROMISO": marca.get("frase_compromiso"), "NIT": marca.get("nit"),
        "FIRMANTE_NOMBRE": marca.get("firmante", {}).get("nombre"), "FIRMANTE_CARGO": marca.get("firmante", {}).get("cargo"),
        "CORREO": marca.get("contacto", {}).get("correo"), "TELEFONO": marca.get("contacto", {}).get("telefono"),
        "SITIO_WEB": marca.get("contacto", {}).get("sitio_web"),
    }
    etiquetas = {"NOMBRE_COMERCIAL": "Nombre comercial", "RAZON_SOCIAL": "Razón social", "DESCRIPTOR": "Descriptor",
                 "PROPUESTA_DE_VALOR": "Propuesta de valor", "FRASE_DE_COMPROMISO": "Frase de compromiso", "NIT": "NIT",
                 "FIRMANTE_NOMBRE": "Nombre de quien firma", "FIRMANTE_CARGO": "Cargo de quien firma", "CORREO": "Correo",
                 "TELEFONO": "Teléfono", "SITIO_WEB": "Sitio web"}
    for k, v in reemplazos.items():
        pendiente = not v or str(v).startswith("[")
        html = html.replace("{{" + k + "}}", f"[{etiquetas[k]} por completar]" if pendiente else v)

    for _ in range(5):  # resuelve var(--x), también dentro de atributos SVG y de @page
        nuevo = re.sub(r"var\(--([\w-]+)\)", lambda m: base.get(m.group(1), m.group(0)), html)
        if nuevo == html:
            break
        html = nuevo
    sin_resolver = sorted(set(re.findall(r"var\(--([\w-]+)\)", html)))
    if sin_resolver:
        errores.append("Variables sin valor: " + ", ".join(sin_resolver))
    marcadores = sorted(set(re.findall(r"\{\{[A-Z0-9_]+\}\}", re.sub(r"<!--.*?-->", "", html, flags=re.S))))
    if marcadores:
        errores.append("Marcadores sin llenar: " + ", ".join(marcadores))

    final = salida.with_suffix(".html")
    final.write_text(html, encoding="utf-8")
    if errores:
        for e in errores:
            print(f"[ERROR] {e}")
        print(f"HTML intermedio en {final}. Corrige y vuelve a ejecutar.")
        sys.exit(1)

    # --- render
    motor = a.motor
    if motor == "auto":
        try:
            import weasyprint  # noqa: F401
            motor = "weasyprint"
        except Exception:
            motor = "chrome"
            avisos.append("WeasyPrint no está disponible: se usa Chrome, que no muestra el logo del encabezado. "
                          "Para el resultado completo: pip install weasyprint (en macOS también brew install pango).")
    if motor == "chrome" and not any("Chrome" in x for x in avisos):
        avisos.append("Con Chrome no aparece el logo del encabezado. Para el resultado completo usa WeasyPrint.")
    try:
        if motor == "weasyprint":
            import weasyprint
            weasyprint.HTML(string=html, base_url=str(origen.parent)).write_pdf(str(salida))
        else:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                try:
                    nav = p.chromium.launch()
                except Exception:
                    nav = p.chromium.launch(channel="chrome")
                pag = nav.new_page()
                pag.goto(final.as_uri())
                pag.pdf(path=str(salida), prefer_css_page_size=True, print_background=True)
                nav.close()
    except Exception as e:
        print(f"[ERROR] No se pudo generar el PDF con {motor}: {e}")
        print(f"El HTML autocontenido está en {final}: ábrelo en el navegador e imprime como PDF con 'Gráficos de fondo' activado.")
        sys.exit(1)

    # --- metadatos
    titulo = re.search(r"<title>(.*?)</title>", html, re.S)
    try:
        from pypdf import PdfReader, PdfWriter
        w = PdfWriter(clone_from=str(salida))
        w.add_metadata({"/Title": titulo.group(1).strip() if titulo else "Propuesta comercial",
                        "/Author": marca.get("nombre_comercial", "")})
        with open(salida, "wb") as f:
            w.write(f)
    except ImportError:
        avisos.append("pypdf no está instalado: revisa que el título y el autor del PDF queden definidos.")

    # --- control de calidad
    qc = Path(a.qc).resolve() if a.qc else salida.parent / "qc"
    if qc.exists():
        shutil.rmtree(qc)
    qc.mkdir(parents=True)
    paginas = 0
    if shutil.which("pdftoppm"):
        subprocess.run(["pdftoppm", "-r", "70", "-png", str(salida), str(qc / "pagina")], check=False)
        paginas = len(list(qc.glob("pagina-*.png")))
    else:
        avisos.append("Sin pdftoppm (poppler): no se generaron imágenes de las páginas; revisa el PDF a mano.")
    texto = ""
    if shutil.which("pdftotext"):
        texto = subprocess.run(["pdftotext", "-layout", str(salida), "-"], capture_output=True, text=True).stdout
    else:
        try:
            from pypdf import PdfReader
            texto = "\n".join(p.extract_text() or "" for p in PdfReader(str(salida)).pages)
        except Exception:
            pass
    hallazgos = []
    for ch in RAYAS:
        n = texto.count(ch)
        if n:
            hallazgos.append(f"{n} rayas largas o medias rayas (U+{ord(ch):04X}): usa comas, puntos o 'a' en rangos")
    for patron, msg in [(r"\{\{", "marcadores {{...}} visibles"), (r"(?i)lorem ipsum", "texto lorem ipsum"),
                        (r"(?i)\b(TODO|TBD)\b", "TODO o TBD")]:
        if re.search(patron, texto):
            hallazgos.append(msg)
    pendientes = sorted(set(re.findall(r"\[[^\]\n]{3,60}\]", texto)))
    if shutil.which("pdffonts"):
        f = subprocess.run(["pdffonts", str(salida)], capture_output=True, text=True).stdout.splitlines()[2:]
        sin = [l.split()[0] for l in f if len(l.split()) > 4 and l.split()[-5] == "no"]
        if sin:
            hallazgos.append("Fuentes sin incrustar: " + ", ".join(sin))
    peso = salida.stat().st_size / 1024 / 1024
    if peso > 5:
        hallazgos.append(f"El PDF pesa {peso:.1f} MB (máximo 5 MB): reduce imágenes")

    print(f"PDF: {salida} | motor: {motor} | páginas: {paginas or '?'} | {peso:.2f} MB")
    print(f"Imágenes para revisar: {qc}/pagina-*.png")
    print(f"HTML autocontenido: {final}")
    if pendientes:
        print("Campos pendientes entre corchetes: " + "; ".join(pendientes))
    for x in avisos:
        print(f"[AVISO] {x}")
    for x in hallazgos:
        print(f"[REVISAR] {x}")
    if paginas and not 10 <= paginas <= 14:
        print(f"[REVISAR] {paginas} páginas: la estructura estándar apunta a portada más 10 a 13 páginas interiores.")
    shutil.rmtree(trabajo, ignore_errors=True)


if __name__ == "__main__":
    main()
