#!/usr/bin/env python3
"""Puntaje de la revisión de un entregable (/delivery:review-deliverable) o de una auditoría.

Lee un JSON con los chequeos calificados y calcula el puntaje ponderado, el veredicto y la
diferencia frente a la revisión de la versión anterior del mismo entregable.

Formato de entrada (lo escribe la skill), por ejemplo outputs/03-test-cases/login/v2/_review.json:
  {"entregable": "03-test-cases", "alcance": "login", "version": 2,
   "chequeos": [{"id": "RV-01", "nombre": "Trazabilidad", "peso": 100, "puntaje": 90,
                 "nota": "3 de 40 casos sin criterio", "critico": true}]}

Reglas del veredicto:
  RECHAZADO               un chequeo crítico por debajo de 60
  APROBADO                total de 90 o más y ningún chequeo por debajo de 75
  APROBADO CON HALLAZGOS  lo demás

Uso: python3 .pipeline/scripts/score_review.py <archivo _review.json> [--md salida.md]
Escribe en el mismo JSON los campos total, veredicto y anterior.
"""
import argparse
import json
import re
import sys
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("archivo")
    ap.add_argument("--md")
    a = ap.parse_args()
    f = Path(a.archivo)
    if not f.exists():
        sys.exit(f"No existe {f}")
    d = json.loads(f.read_text(encoding="utf-8"))
    ch = d.get("chequeos") or sys.exit("El archivo no tiene chequeos.")
    for c in ch:
        for k in ("id", "nombre", "peso", "puntaje"):
            if k not in c:
                sys.exit(f"Al chequeo {c.get('id', '?')} le falta '{k}'.")
        if not 0 <= c["puntaje"] <= 100:
            sys.exit(f"{c['id']}: el puntaje debe estar entre 0 y 100.")
        if not str(c.get("nota", "")).strip():
            sys.exit(f"{c['id']}: falta la nota que sustenta el puntaje.")
    total = round(sum(c["puntaje"] * c["peso"] for c in ch) / sum(c["peso"] for c in ch), 1)
    criticos = [c for c in ch if c.get("critico") and c["puntaje"] < 60]
    if criticos:
        veredicto = "RECHAZADO"
    elif total >= 90 and all(c["puntaje"] >= 75 for c in ch):
        veredicto = "APROBADO"
    else:
        veredicto = "APROBADO CON HALLAZGOS"

    # revisión de la versión anterior: .../vN/_review.json -> la más reciente de .../v(N-k)/
    anterior = None
    m = re.fullmatch(r"v(\d+)", f.parent.name)
    if m:
        for n in range(int(m.group(1)) - 1, 0, -1):
            cand = f.parent.parent / f"v{n}" / f.name
            if cand.exists():
                prev = json.loads(cand.read_text(encoding="utf-8"))
                anterior = {"version": n, "total": prev.get("total"),
                            "chequeos": {c["id"]: c["puntaje"] for c in prev.get("chequeos", [])}}
                break
    d.update({"total": total, "veredicto": veredicto, "anterior": anterior})
    f.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{'ID':<7} {'Peso':>4} {'Puntaje':>7} {'Antes':>6}  Chequeo")
    for c in ch:
        antes = (anterior or {}).get("chequeos", {}).get(c["id"])
        print(f"{c['id']:<7} {c['peso']:>4} {c['puntaje']:>7} {str(antes) if antes is not None else '-':>6}  "
              f"{c['nombre']}{' (crítico)' if c.get('critico') else ''}: {c['nota']}")
    delta = ""
    if anterior and anterior["total"] is not None:
        delta = f" ({total - anterior['total']:+.1f} frente a v{anterior['version']})"
    print(f"\nPuntaje total: {total} de 100{delta}")
    print(f"Veredicto: {veredicto}" + (" (críticos por debajo de 60: " + ", ".join(c["id"] for c in criticos) + ")" if criticos else ""))
    if a.md:
        md = "| ID | Chequeo | Peso | Puntaje | Nota |\n|---|---|---|---|---|\n"
        md += "".join(f"| {c['id']} | {c['nombre']} | {c['peso']} | {c['puntaje']} | {c['nota']} |\n" for c in ch)
        md += f"\n**Puntaje total: {total} de 100{delta}. Veredicto: {veredicto}.**\n"
        Path(a.md).write_text(md, encoding="utf-8")


if __name__ == "__main__":
    main()
