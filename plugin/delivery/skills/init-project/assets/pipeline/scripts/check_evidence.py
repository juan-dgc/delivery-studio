#!/usr/bin/env python3
"""Verificación de la evidencia: ¿la ingesta fue amplia o dejó información por fuera?

Para cada evidence/EV-NNN-*.md compara el tamaño de la fuente (su texto completo en
evidence/_texto/ o la transcripción) con lo que se extrajo, y revisa que el mapa de la
fuente no tenga bloques sin procesar. No juzga el contenido: señala dónde mirar.

Uso: python3 .pipeline/scripts/check_evidence.py [EV-007 ...] [--json salida.json]
Sale con código 1 si hay hallazgos BLOQUEANTES (solo en evidencias con formato 2).
"""
import argparse
import json
import re
import sys
from pathlib import Path

# Hechos esperados por cada 1.000 palabras de fuente. Por debajo del mínimo, la evidencia
# se marca DELGADA. Son umbrales de alerta, no metas: una fuente con mucho relleno puede
# quedar por debajo con razón, y entonces se justifica en "Mapa y cobertura".
MINIMO = {"audio": 6, "texto": 10, "documento": 10, "jira": 10, "enlace": 8}


from _raiz import raiz as _raiz_proyecto


def raiz():
    return _raiz_proyecto()


def frontmatter(t):
    if not t.startswith("---"):
        return {}
    datos = {}
    for linea in t.split("---", 2)[1].splitlines():
        if ":" in linea:
            k, v = linea.split(":", 1)
            datos[k.strip()] = v.split("#")[0].strip()
    return datos


def seccion(t, titulo):
    m = re.search(rf"^## {re.escape(titulo)}\s*\n(.*?)(?=^## |\Z)", t, re.M | re.S)
    return m.group(1).strip() if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*", help="Evidencias a revisar (por defecto, todas)")
    ap.add_argument("--json")
    a = ap.parse_args()
    root = raiz()
    carpeta = root / "evidence"
    if not carpeta.exists():
        sys.exit("No existe evidence/: ejecuta /delivery:ingest-sources")
    hallazgos, filas = [], []

    def h(nivel, ev, msg):
        hallazgos.append({"nivel": nivel, "evidencia": ev, "hallazgo": msg})

    for f in sorted(carpeta.glob("EV-*.md")):
        ev = re.match(r"(EV-\d+)", f.name).group(1)
        if a.ids and ev not in a.ids:
            continue
        t = f.read_text(encoding="utf-8")
        fm = frontmatter(t)
        tipo = fm.get("tipo", "?")
        nuevo = fm.get("formato") == "2"
        hechos = re.findall(r"^\s*[-*] \*{0,2}(EV-\d+\.\d+)\*{0,2}:", t, re.M)
        sin_ubicacion = len(re.findall(r"^\s*[-*] \*{0,2}EV-\d+\.\d+\*{0,2}:(?!.*\([^()]*\)\s*$).*$", t, re.M))

        # tamaño de la fuente
        palabras = None
        ruta_texto = fm.get("texto_completo", "")
        if ruta_texto and ruta_texto.lower() not in ("no aplica", "ninguno", "-"):
            p = root / ruta_texto
            if p.exists():
                palabras = len(p.read_text(encoding="utf-8", errors="ignore").split())
            else:
                h("BLOQUEANTE" if nuevo else "AVISO", ev, f"texto_completo apunta a {ruta_texto}, que no existe.")
        elif fm.get("fuente", "").lower().endswith((".txt", ".md", ".csv", ".eml")) and (root / fm["fuente"]).exists():
            palabras = len((root / fm["fuente"]).read_text(encoding="utf-8", errors="ignore").split())
        elif nuevo and tipo in MINIMO:
            h("BLOQUEANTE", ev, "Falta texto_completo en el frontmatter: sin el texto de la fuente no se puede "
                                "comprobar que la extracción fue completa.")

        densidad = round(len(hechos) * 1000 / palabras, 1) if palabras else None
        estado = "ok"
        if not hechos:
            estado = "SIN HECHOS"
            h("BLOQUEANTE" if nuevo else "AVISO", ev, "No tiene ningún hecho con ID (EV-NNN.N).")
        elif densidad is not None and tipo in MINIMO and palabras >= 300 and densidad < MINIMO[tipo]:
            estado = "DELGADA"
            h("AVISO", ev, f"{len(hechos)} hechos para {palabras} palabras de fuente ({densidad} por cada 1.000; "
                           f"se espera al menos {MINIMO[tipo]} en fuentes de tipo {tipo}). Vuelve a pasar por la fuente "
                           "bloque por bloque o justifica en 'Mapa y cobertura' por qué hay tan poco.")

        # mapa de la fuente
        mapa = seccion(t, "Mapa y cobertura")
        bloques = sin_procesar = 0
        if mapa is None:
            if nuevo:
                h("BLOQUEANTE", ev, "Falta la sección 'Mapa y cobertura'.")
        else:
            for fila in re.findall(r"^\|(.+)\|\s*$", mapa, re.M):
                celdas = [c.strip() for c in fila.split("|")]
                if len(celdas) < 3 or set(celdas[0]) <= set("-: ") or celdas[0].lower() in ("bloque", "#"):
                    continue
                bloques += 1
                cantidad = re.search(r"\d+", celdas[2])
                nota = celdas[3] if len(celdas) > 3 else ""
                if (not cantidad or int(cantidad.group()) == 0) and len(nota) < 8:
                    sin_procesar += 1
            if nuevo and not bloques:
                h("BLOQUEANTE", ev, "'Mapa y cobertura' no tiene la tabla de bloques de la fuente.")
            if sin_procesar:
                h("BLOQUEANTE" if nuevo else "AVISO", ev,
                  f"{sin_procesar} bloque(s) del mapa sin hechos y sin motivo: procésalos o explica por qué no aportan.")
        if sin_ubicacion and len(hechos) and sin_ubicacion / len(hechos) > 0.3:
            h("AVISO", ev, f"{sin_ubicacion} de {len(hechos)} hechos no terminan con su ubicación entre paréntesis "
                           "(minuto, página, ruta o clave).")
        if nuevo and seccion(t, "Temas para el context pack") is None:
            h("BLOQUEANTE", ev, "Falta 'Temas para el context pack': sin esa sección ningún documento la recibe.")
        filas.append({"evidencia": ev, "tipo": tipo, "palabras_fuente": palabras, "hechos": len(hechos),
                      "por_mil": densidad, "bloques": bloques, "estado": estado})

    print(f"{'Evidencia':<10} {'Tipo':<12} {'Palabras':>9} {'Hechos':>7} {'x1000':>6} {'Bloques':>8}  Estado")
    for r in filas:
        print(f"{r['evidencia']:<10} {r['tipo']:<12} {str(r['palabras_fuente'] or '-'):>9} {r['hechos']:>7} "
              f"{str(r['por_mil'] or '-'):>6} {r['bloques']:>8}  {r['estado']}")
    bloq = [x for x in hallazgos if x["nivel"] == "BLOQUEANTE"]
    print(f"\n{len(filas)} evidencias, {sum(r['hechos'] for r in filas)} hechos en total")
    print(f"Hallazgos: {len(bloq)} bloqueantes, {len(hallazgos) - len(bloq)} avisos\n")
    for x in sorted(hallazgos, key=lambda x: (x["nivel"] != "BLOQUEANTE", x["evidencia"])):
        print(f"[{x['nivel']}] {x['evidencia']}: {x['hallazgo']}")
    if a.json:
        Path(a.json).write_text(json.dumps({"evidencias": filas, "hallazgos": hallazgos}, ensure_ascii=False, indent=2),
                                encoding="utf-8")
    sys.exit(1 if bloq else 0)


if __name__ == "__main__":
    main()
