#!/usr/bin/env python3
"""Resume uno o varios reportes JUnit XML de una ejecución automatizada.

Funciona con cualquier framework que exporte JUnit (Playwright, Cypress, WebdriverIO, pytest,
JUnit, NUnit). Extrae el ID del caso (TC-NNN-NN) y las etiquetas (@US-NNN, @P1) del nombre de
cada prueba, cuenta resultados y agrupa por caso. Si un caso aparece varias veces (reintentos o
navegadores), lo marca como inestable cuando hay resultados mixtos.

Uso: python3 .pipeline/scripts/summarize_results.py <junit.xml> [<otro.xml> ...] [--md resumen.md] [--json resumen.json]
"""
import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path


def leer(rutas):
    pruebas = []
    for r in rutas:
        try:
            raiz = ET.parse(r).getroot()
        except (ET.ParseError, FileNotFoundError) as e:
            print(f"No pude leer {r}: {e}", file=sys.stderr)
            continue
        for tc in raiz.iter("testcase"):
            nombre = tc.get("name", "")
            clase = tc.get("classname", "")
            texto = f"{clase} {nombre}"
            if tc.find("failure") is not None or tc.find("error") is not None:
                nodo = tc.find("failure") if tc.find("failure") is not None else tc.find("error")
                estado = "FALLIDO"
                mensaje = (nodo.get("message") or nodo.text or "").strip().splitlines()
                mensaje = mensaje[0][:200] if mensaje else ""
            elif tc.find("skipped") is not None:
                estado, mensaje = "OMITIDO", ""
            else:
                estado, mensaje = "APROBADO", ""
            m = re.search(r"TC-\d+-\d+", texto)
            pruebas.append({
                "tc": m.group(0) if m else None, "nombre": nombre, "archivo": clase, "estado": estado,
                "mensaje": mensaje, "segundos": float(tc.get("time") or 0),
                "us": sorted(set(re.findall(r"US-\d+", texto))),
                "prioridad": (re.search(r"@?(P[1-4])\b", texto) or [None, None])[1],
            })
    return pruebas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reportes", nargs="+")
    ap.add_argument("--md")
    ap.add_argument("--json")
    a = ap.parse_args()
    pruebas = leer(a.reportes)
    if not pruebas:
        sys.exit("No encontré pruebas en los reportes.")

    por_tc = defaultdict(list)
    sin_id = []
    for p in pruebas:
        (por_tc[p["tc"]] if p["tc"] else sin_id).append(p)
    casos = []
    for tc, ps in sorted(por_tc.items()):
        estados = {p["estado"] for p in ps}
        if estados == {"APROBADO"}:
            final = "APROBADO"
        elif "APROBADO" in estados and "FALLIDO" in estados:
            final = "INESTABLE"
        elif "FALLIDO" in estados:
            final = "FALLIDO"
        else:
            final = "OMITIDO"
        fallo = next((p["mensaje"] for p in ps if p["estado"] == "FALLIDO"), "")
        casos.append({"tc": tc, "estado": final, "ejecuciones": len(ps), "us": sorted({u for p in ps for u in p["us"]}),
                      "prioridad": next((p["prioridad"] for p in ps if p["prioridad"]), None),
                      "archivo": ps[0]["archivo"], "mensaje": fallo})

    conteo = defaultdict(int)
    for c in casos:
        conteo[c["estado"]] += 1
    total_s = sum(p["segundos"] for p in pruebas)
    res = {"pruebas": len(pruebas), "casos": len(casos), "por_estado": dict(conteo),
           "duracion_segundos": round(total_s, 1), "pruebas_sin_id_de_caso": [p["nombre"] for p in sin_id], "detalle": casos}

    md = ["# Resumen de ejecución", "",
          f"- Pruebas ejecutadas: {len(pruebas)} | casos: {len(casos)} | duración: {total_s/60:.1f} min",
          "- " + " | ".join(f"{k}: {v}" for k, v in sorted(conteo.items())), "",
          "| Caso | Prioridad | Historias | Estado | Ejecuciones | Primer error |", "|---|---|---|---|---|---|"]
    orden = {"FALLIDO": 0, "INESTABLE": 1, "OMITIDO": 2, "APROBADO": 3}
    for c in sorted(casos, key=lambda c: (orden[c["estado"]], c["prioridad"] or "P9", c["tc"])):
        md.append(f"| {c['tc']} | {c['prioridad'] or '-'} | {', '.join(c['us']) or '-'} | {c['estado']} | "
                  f"{c['ejecuciones']} | {c['mensaje'].replace('|', '/')[:120] or '-'} |")
    if sin_id:
        md += ["", "## Pruebas sin ID de caso en el nombre", ""] + [f"- {p['nombre']}" for p in sin_id]
    salida = "\n".join(md) + "\n"
    if a.md:
        Path(a.md).write_text(salida, encoding="utf-8")
    if a.json:
        Path(a.json).write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(salida if not a.md else f"Resumen escrito en {a.md}")


if __name__ == "__main__":
    main()
