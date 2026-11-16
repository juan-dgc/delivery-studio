#!/usr/bin/env python3
"""Puntaje de la verificación del context pack, comparable entre versiones.

Combina dos fuentes:
  - los chequeos de PROGRAMA, que se calculan aquí desde el resultado de check_pack.py
    (context-pack/_verification-check.json);
  - los chequeos de JUICIO, que califica /delivery:verify-context-pack de 0 a 100 y deja en
    context-pack/_verification-judge.json:
        {"VC-06": {"puntaje": 85, "nota": "2 de 14 afirmaciones no coinciden con su evidencia"}, ...}

Cada chequeo tiene un peso. El puntaje total es el promedio ponderado. El resultado se agrega a
context-pack/_verification-history.json para ver si el pack mejora de una versión a otra.

Uso:
  python3 .pipeline/scripts/score_pack.py lista            muestra los chequeos y sus pesos
  python3 .pipeline/scripts/score_pack.py calcular [--md context-pack/_verification-scores.md] [--no-guardar]
  python3 .pipeline/scripts/score_pack.py historial        puntajes de las verificaciones anteriores
"""
import argparse
import datetime
import json
import re
import sys
from pathlib import Path

CHEQUEOS = [
    # id, tipo, peso, nombre, qué mide
    ("VC-01", "PROGRAMA", 100, "Estructura completa", "Documentos con frontmatter y todas las secciones de su plantilla, sin secciones vacías ni restos de guía"),
    ("VC-02", "PROGRAMA", 100, "Citas válidas", "Toda EV, OQ y DEC citada existe"),
    ("VC-03", "PROGRAMA", 100, "Cobertura de evidencia", "Porcentaje de hechos de la evidencia citados en el pack o descartados con motivo"),
    ("VC-04", "PROGRAMA", 60, "Secciones con contenido", "Proporción de secciones que no quedaron delgadas"),
    ("VC-05", "PROGRAMA", 40, "Índice y pendientes en orden", "El índice lista todos los documentos y cada [POR CONFIRMAR] tiene su OQ"),
    ("VC-06", "JUICIO", 100, "Fidelidad", "Lo marcado como confirmado dice lo mismo que la evidencia citada"),
    ("VC-07", "JUICIO", 100, "Sin inferencias disfrazadas", "Ninguna cifra, fecha, tecnología o plazo sin marca o con una marca que no lo respalda"),
    ("VC-08", "JUICIO", 80, "Consistencia entre documentos", "Mismos términos, módulos y reglas en todo el pack, sin contradicciones"),
    ("VC-09", "JUICIO", 100, "Sin pérdida de información", "Los hechos sin citar no incluyen reglas, cifras, excepciones ni pasos que debían estar"),
    ("VC-10", "JUICIO", 100, "Profundidad", "Los documentos conservan el detalle de la evidencia en vez de resumirlo"),
    ("VC-11", "JUICIO", 80, "Suficiencia para el siguiente paso", "Se puede cotizar, escribir historias, casos o automatizar con lo que hay"),
    ("VC-12", "JUICIO", 40, "Calidad de las preguntas abiertas", "Concretas, sin duplicados, con impacto y sugerencia"),
    ("VC-13", "JUICIO", 100, "Cumple de verdad", "El pack sirve para trabajar; no es un resumen de alto nivel que aparenta cumplir"),
]
ESTRUCTURA = r"Falta el frontmatter|Falta la sección|está vacía|comentario de guía|guía sin reemplazar|El documento no existe|plantilla"
CITAS = r"^Cita .* que no existe"
INDICE = r"El índice no menciona|sin OQ asociada"


from _raiz import raiz as _raiz_proyecto


def raiz():
    return _raiz_proyecto()


def leer(p, defecto=None):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else defecto


def programa(check):
    hs = check.get("hallazgos", [])
    docs = max(1, len(check.get("resumen", [])))

    def cuenta(patron, nivel=None):
        return sum(1 for h in hs if re.search(patron, h["hallazgo"]) and (nivel is None or h["nivel"] == nivel))

    out = {}
    n = cuenta(ESTRUCTURA, "BLOQUEANTE")
    otros = sum(1 for h in hs if h["nivel"] == "BLOQUEANTE") - n - cuenta(CITAS, "BLOQUEANTE") - cuenta(INDICE, "BLOQUEANTE")
    n += max(0, otros)
    out["VC-01"] = (max(0, 100 - 10 * n), f"{n} problema(s) de estructura bloqueantes")
    n = cuenta(CITAS)
    out["VC-02"] = (max(0, 100 - 20 * n), f"{n} cita(s) a evidencias, preguntas o decisiones que no existen")
    cob = check.get("cobertura", [])
    total = sum(c["hechos"] for c in cob)
    citados = sum(c["citados"] for c in cob)
    out["VC-03"] = ((100 * citados // total) if total else 0,
                    f"{citados} de {total} hechos citados" if total else "La evidencia no tiene hechos con ID")
    delgadas = sum(h["hallazgo"].split(":", 1)[1].split(". Revisa")[0].count(",") + 1
                   for h in hs if h["hallazgo"].startswith("Secciones delgadas"))
    out["VC-04"] = (max(0, 100 - round(100 * delgadas / (docs * 8))), f"{delgadas} sección(es) delgada(s) en {docs} documentos")
    n = cuenta(INDICE)
    out["VC-05"] = (max(0, 100 - 15 * n), f"{n} problema(s) de índice o de pendientes sin OQ")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("accion", choices=["lista", "calcular", "historial"])
    ap.add_argument("--md")
    ap.add_argument("--no-guardar", action="store_true")
    a = ap.parse_args()

    if a.accion == "lista":
        print(f"{'ID':<6} {'Tipo':<9} {'Peso':>4}  Chequeo")
        for i, tipo, peso, nombre, que in CHEQUEOS:
            print(f"{i:<6} {tipo:<9} {peso:>4}  {nombre}: {que}")
        return

    cp = raiz() / "context-pack"
    hist_f = cp / "_verification-history.json"
    historial = leer(hist_f, [])
    if a.accion == "historial":
        if not historial:
            print("Aún no hay verificaciones con puntaje.")
        for h in historial:
            print(f"{h['fecha']}  pack v{h.get('version_pack', '?')}  {h['total']:>5}  {h['veredicto']}")
        return

    check = leer(cp / "_verification-check.json")
    if check is None:
        sys.exit("Falta context-pack/_verification-check.json: ejecuta check_pack.py --cobertura --json context-pack/_verification-check.json")
    juicio = leer(cp / "_verification-judge.json", {})
    prog = programa(check)
    filas, faltan = [], []
    for i, tipo, peso, nombre, _ in CHEQUEOS:
        if tipo == "PROGRAMA":
            puntaje, nota = prog[i]
        elif i in juicio:
            puntaje, nota = int(juicio[i]["puntaje"]), juicio[i].get("nota", "")
            if not 0 <= puntaje <= 100:
                sys.exit(f"{i}: el puntaje debe estar entre 0 y 100.")
        else:
            faltan.append(i)
            continue
        filas.append({"id": i, "tipo": tipo, "peso": peso, "nombre": nombre, "puntaje": puntaje, "nota": nota})
    if faltan:
        sys.exit("Faltan chequeos de juicio en context-pack/_verification-judge.json: " + ", ".join(faltan))

    total = round(sum(f["puntaje"] * f["peso"] for f in filas) / sum(f["peso"] for f in filas), 1)
    bloqueantes = sum(1 for h in check.get("hallazgos", []) if h["nivel"] == "BLOQUEANTE")
    criticos = [f for f in filas if f["peso"] == 100 and f["puntaje"] < 60]
    if bloqueantes or criticos:
        veredicto = "RECHAZADO"
    elif total >= 90 and all(f["puntaje"] >= 75 for f in filas):
        veredicto = "APROBADO"
    else:
        veredicto = "APROBADO CON HALLAZGOS"

    meta = leer(cp / "_meta.json", {})
    anterior = historial[-1] if historial else None
    print(f"{'ID':<6} {'Tipo':<9} {'Peso':>4} {'Puntaje':>7} {'Antes':>6}  Chequeo")
    for f in filas:
        antes = (anterior or {}).get("chequeos", {}).get(f["id"])
        print(f"{f['id']:<6} {f['tipo']:<9} {f['peso']:>4} {f['puntaje']:>7} {str(antes) if antes is not None else '-':>6}  "
              f"{f['nombre']}: {f['nota']}")
    delta = f" ({total - anterior['total']:+.1f} frente a la verificación del {anterior['fecha']})" if anterior else ""
    print(f"\nPuntaje total: {total} de 100{delta}")
    print(f"Veredicto: {veredicto}"
          + (f" ({bloqueantes} hallazgo(s) bloqueante(s))" if bloqueantes else "")
          + (" (chequeos críticos por debajo de 60: " + ", ".join(f["id"] for f in criticos) + ")" if criticos else ""))

    if a.md:
        md = "| ID | Chequeo | Tipo | Peso | Puntaje | Nota |\n|---|---|---|---|---|---|\n"
        md += "".join(f"| {f['id']} | {f['nombre']} | {f['tipo']} | {f['peso']} | {f['puntaje']} | {f['nota']} |\n" for f in filas)
        md += f"\n**Puntaje total: {total} de 100{delta}. Veredicto: {veredicto}.**\n"
        Path(a.md).write_text(md, encoding="utf-8")
    if not a.no_guardar:
        historial.append({"fecha": datetime.date.today().isoformat(), "version_pack": meta.get("version"),
                          "total": total, "veredicto": veredicto, "chequeos": {f["id"]: f["puntaje"] for f in filas}})
        hist_f.write_text(json.dumps(historial, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
