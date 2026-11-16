#!/usr/bin/env python3
"""Herramientas del kit de marca propia.

Comandos:
  colores <imagen> [--n 6]                 colores dominantes de un logo o documento (hex y proporción)
  paleta <hex_primario> [--tinta #0D1117]  deriva profundo, intermedio, cielo y tinte, con contrastes
  contraste <hex_texto> <hex_fondo>        relación de contraste WCAG
  logo-blanco <entrada> <salida>           versión monocroma blanca para fondos oscuros (PNG o SVG)
  tokens <marca.json> <salida.css>         genera tokens.css a partir de marca.json
  validar <carpeta del kit>                comprueba campos, archivos y contrastes, y lista pendientes

Requiere Pillow para las imágenes PNG o JPG (pip install pillow). Los SVG se procesan como texto.
"""
import argparse
import json
import re
import sys
from pathlib import Path

NEUTROS = {"tinta": "#0D1117", "gris_apoyo": "#5A5F66", "gris_claro": "#F2F4F7", "linea": "#E3E7EE",
           "gris_portada": "#8E949E", "divisor_portada": "#262D3A"}


# ---------------------------------------------------------------- color
def hex_rgb(h):
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        sys.exit(f"Color inválido: {h}")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_hex(rgb):
    return "#" + "".join(f"{max(0, min(255, round(c))):02X}" for c in rgb)


def mezclar(h, con, t):
    a, b = hex_rgb(h), hex_rgb(con)
    return rgb_hex(tuple(x + (y - x) * t for x, y in zip(a, b)))


def luminancia(h):
    def canal(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (canal(c) for c in hex_rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def derivar(primario, tinta=NEUTROS["tinta"]):
    return {
        "primario": primario.upper(),
        "profundo": mezclar(primario, "#000000", 0.20),
        "intermedio": mezclar(primario, "#FFFFFF", 0.15),
        "cielo": mezclar(primario, "#FFFFFF", 0.40),
        "tinte": mezclar(primario, "#FFFFFF", 0.92),
        **NEUTROS, "tinta": tinta.upper(),
    }


def pixeles_de(img):
    """Pixeles como lista de tuplas, compatible con Pillow anterior y posterior a la versión 14."""
    f = getattr(img, "get_flattened_data", None)
    return list(f()) if f else list(img.getdata())


# ---------------------------------------------------------------- comandos
def cmd_colores(a):
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Falta Pillow: pide permiso y ejecuta pip install pillow")
    if a.imagen.lower().endswith(".svg"):
        texto = Path(a.imagen).read_text(encoding="utf-8", errors="ignore")
        vistos = {}
        for h in re.findall(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b", texto):
            hx = rgb_hex(hex_rgb(h))
            vistos[hx] = vistos.get(hx, 0) + 1
        for hx, n in sorted(vistos.items(), key=lambda x: -x[1])[:a.n]:
            print(f"{hx}  apariciones: {n}")
        return
    img = Image.open(a.imagen).convert("RGBA")
    img.thumbnail((300, 300))
    pixeles = [p[:3] for p in pixeles_de(img) if p[3] > 200]
    utiles = [p for p in pixeles if not (min(p) > 235 or max(p) < 20)]  # sin casi blanco ni casi negro
    if not utiles:
        print("La imagen es casi toda blanca, negra o transparente: el logo parece monocromo.")
        utiles = pixeles
    muestra = Image.new("RGB", (len(utiles), 1))
    muestra.putdata(utiles)
    q = muestra.quantize(colors=a.n, method=Image.Quantize.MEDIANCUT)
    paleta = q.getpalette()
    conteo = sorted(q.getcolors(), reverse=True)
    total = sum(c for c, _ in conteo)
    for c, i in conteo:
        rgb = paleta[i * 3:i * 3 + 3]
        print(f"{rgb_hex(rgb)}  {100 * c / total:5.1f} %")


def cmd_paleta(a):
    p = derivar(a.primario, a.tinta)
    print(json.dumps(p, indent=2))
    print("\nContrastes (mínimo 4,5 a 1 para texto):")
    for nombre in ("primario", "profundo", "intermedio"):
        sobre_blanco = contraste(p[nombre], "#FFFFFF")
        texto_blanco = contraste("#FFFFFF", p[nombre])
        print(f"  {nombre:<11} como texto sobre blanco: {sobre_blanco:4.1f} {'ok' if sobre_blanco >= 4.5 else 'NO: úsalo solo en rellenos y bordes'}"
              f" | texto blanco encima: {texto_blanco:4.1f} {'ok' if texto_blanco >= 4.5 else 'NO'}")
    print(f"  cielo sobre tinta (subtítulo de portada): {contraste(p['cielo'], p['tinta']):4.1f}")
    print(f"  gris_portada sobre tinta: {contraste(p['gris_portada'], p['tinta']):4.1f}")


def cmd_contraste(a):
    r = contraste(a.texto, a.fondo)
    print(f"{r:.2f} a 1  {'cumple AA para texto normal' if r >= 4.5 else ('solo texto grande' if r >= 3 else 'no cumple')}")


def cmd_logo_blanco(a):
    ent, sal = Path(a.entrada), Path(a.salida)
    sal.parent.mkdir(parents=True, exist_ok=True)
    if ent.suffix.lower() == ".svg":
        t = ent.read_text(encoding="utf-8")
        t = re.sub(r'(fill|stroke)\s*=\s*"(?!none)[^"]*"', r'\1="#FFFFFF"', t)
        t = re.sub(r"(fill|stroke)\s*:\s*(?!none)[^;\"']+", r"\1:#FFFFFF", t)
        sal.write_text(t, encoding="utf-8")
        print(f"{sal} (SVG recoloreado; revisa que no haya imágenes incrustadas)")
        return
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Falta Pillow: pide permiso y ejecuta pip install pillow")
    img = Image.open(ent).convert("RGBA")
    datos = []
    origen = pixeles_de(img)
    tiene_alfa = any(p[3] < 250 for p in origen)
    for r, g, b, al in origen:
        if not tiene_alfa:
            # sin transparencia: el fondo casi blanco pasa a transparente
            al = 0 if min(r, g, b) > 235 else 255
        datos.append((255, 255, 255, al))
    img.putdata(datos)
    img.save(sal.with_suffix(".png"))
    print(f"{sal.with_suffix('.png')} ({'usó la transparencia original' if tiene_alfa else 'quitó el fondo blanco'})")


def cmd_tokens(a):
    m = json.loads(Path(a.marca).read_text(encoding="utf-8"))
    c = {**derivar(m["colores"]["primario"]), **{k: v for k, v in m["colores"].items() if isinstance(v, str) and v}}
    t = m.get("tipografia", {})
    fam = ", ".join([f'"{t.get("familia", "Inter")}"'] + [f'"{x}"' if " " in x else x for x in t.get("respaldo", ["Helvetica", "Arial", "sans-serif"])])
    lineas = ["/* Generado por brand_tools.py desde marca.json. No lo edites a mano: cambia marca.json y regénéralo. */"]
    for f in t.get("archivos", []):
        lineas.append(f'@font-face {{ font-family: "{t.get("familia", "Inter")}"; src: url("{f["ruta"]}"); '
                      f'font-weight: {f.get("peso", 400)}; font-style: {f.get("estilo", "normal")}; }}')
    lineas.append(":root {")
    for k, v in c.items():
        lineas.append(f"  --{k.replace('_', '-')}: {v};")
    for i, h in enumerate(m["colores"].get("secundarios", []), 1):
        lineas.append(f"  --secundario-{i}: {h};")
    lineas.append(f"  --fuente: {fam};")
    for k, v in m.get("logos", {}).items():
        if v:
            lineas.append(f'  --logo-{k}: url("{v}");')
    lineas.append("}")
    Path(a.salida).write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print(f"{a.salida} con {len(c)} colores")


def cmd_validar(a):
    kit = Path(a.carpeta)
    f = kit / "marca.json"
    if not f.exists():
        sys.exit(f"No existe {f}")
    m = json.loads(f.read_text(encoding="utf-8"))
    pendientes, errores = [], []
    for campo in ["nombre_comercial", "razon_social", "descriptor", "propuesta_valor", "frase_compromiso", "prefijo"]:
        if not m.get(campo) or str(m.get(campo)).startswith("["):
            pendientes.append(campo)
    for campo in ["nombre", "cargo"]:
        if not m.get("firmante", {}).get(campo):
            pendientes.append(f"firmante.{campo}")
    for campo in ["correo", "telefono", "sitio_web"]:
        if not m.get("contacto", {}).get(campo):
            pendientes.append(f"contacto.{campo}")
    prim = m.get("colores", {}).get("primario")
    if not prim:
        errores.append("Falta colores.primario")
    for k, v in m.get("logos", {}).items():
        if v and not (kit / v).exists():
            errores.append(f"El logo {k} apunta a {v}, que no existe")
    if not m.get("logos", {}).get("claro") and not m.get("logos", {}).get("oscuro"):
        pendientes.append("logos (se usará el nombre en texto)")
    if prim:
        p = derivar(prim)
        if contraste(p["primario"], "#FFFFFF") < 4.5:
            print(f"Aviso: el primario {prim} no alcanza 4,5 a 1 sobre blanco; los textos en color usarán el profundo {p['profundo']}.")
    if not (kit / "tokens.css").exists():
        pendientes.append("tokens.css (ejecuta el comando tokens)")
    print(f"Kit: {m.get('nombre_comercial', '?')} | primario {prim}")
    for e in errores:
        print(f"[ERROR] {e}")
    for x in pendientes:
        print(f"[PENDIENTE] {x}")
    print("Resultado: " + ("CON ERRORES" if errores else ("COMPLETO" if not pendientes else "USABLE CON PENDIENTES")))
    sys.exit(1 if errores else 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    s = ap.add_subparsers(dest="cmd", required=True)
    x = s.add_parser("colores"); x.add_argument("imagen"); x.add_argument("--n", type=int, default=6)
    x = s.add_parser("paleta"); x.add_argument("primario"); x.add_argument("--tinta", default=NEUTROS["tinta"])
    x = s.add_parser("contraste"); x.add_argument("texto"); x.add_argument("fondo")
    x = s.add_parser("logo-blanco"); x.add_argument("entrada"); x.add_argument("salida")
    x = s.add_parser("tokens"); x.add_argument("marca"); x.add_argument("salida")
    x = s.add_parser("validar"); x.add_argument("carpeta")
    a = ap.parse_args()
    {"colores": cmd_colores, "paleta": cmd_paleta, "contraste": cmd_contraste, "logo-blanco": cmd_logo_blanco,
     "tokens": cmd_tokens, "validar": cmd_validar}[a.cmd](a)


if __name__ == "__main__":
    main()
