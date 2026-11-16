#!/usr/bin/env python3
"""Exporta historias y casos de prueba a CSV para importarlos en una herramienta de gestión.

No conoce el formato propio de cada herramienta: produce CSV con columnas claras que se mapean
en el asistente de importación de Jira, Zephyr, Xray, TestRail o Azure DevOps.

Uso:
  python3 .pipeline/scripts/export_cases.py casos --casos <archivo|carpeta>... --salida casos.csv [--pasos filas|celda] [--ids US-001 ...]
  python3 .pipeline/scripts/export_cases.py historias --historias <archivo|carpeta>... --salida historias.csv [--ids US-001 ...]

  --pasos filas   una fila por paso; los datos del caso se repiten en cada fila (Xray, Zephyr Scale, TestRail con pasos separados)
  --pasos celda   una fila por caso; pasos y resultados numerados dentro de una sola celda (por defecto)
  --ids           limita la exportación a esas historias (las de un lote)

Si existe .pipeline/state/sync.json, agrega la columna 'clave_externa' con la clave que cada
elemento ya tiene en la herramienta, para actualizar en vez de duplicar.
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path


from _raiz import raiz as _raiz_proyecto


def raiz():
    return _raiz_proyecto(obligatoria=False)


def leer(rutas):
    out = []
    for r in rutas:
        p = Path(r)
        out += sorted(p.rglob("*.md")) if p.is_dir() else [p]
    return "\n".join(f.read_text(encoding="utf-8") for f in out if f.exists() and not f.name.startswith("_"))


def bloques(texto, patron):
    return list(re.finditer(rf"^## ({patron}):\s*(.*?)\n(.*?)(?=^## |\Z)", texto, re.S | re.M))


def campo(cuerpo, nombre):
    m = re.search(rf"^- {nombre}:\s*(.*)$", cuerpo, re.M | re.I)
    return m.group(1).strip() if m else ""


def limpio(s):
    return re.sub(r"\[(?:CONFIRMADO|INFERIDO|POR CONFIRMAR)[^\]]*\]", "", s).replace("<br>", "\n").strip()


def pasos_de(cuerpo):
    """Filas de la tabla de pasos; si el caso está en Gherkin, cada línea Dado/Cuando/Entonces."""
    filas = []
    for m in re.finditer(r"^\|\s*(\d+)\s*\|(.*?)\|(.*?)\|\s*$", cuerpo, re.M):
        filas.append((m.group(1), limpio(m.group(2)), limpio(m.group(3))))
    if filas:
        return filas
    n = 0
    for linea in cuerpo.splitlines():
        m = re.match(r"\s*\*{0,2}(Dado|Dada|Dados|Cuando|Entonces|Y|Pero|Given|When|Then|And|But)\*{0,2}\b(.*)", linea)
        if m:
            n += 1
            texto = limpio(m.group(1) + m.group(2))
            es_resultado = m.group(1).lower() in ("entonces", "then")
            filas.append((str(n), "" if es_resultado else texto, texto if es_resultado else ""))
    return filas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("que", choices=["casos", "historias"])
    ap.add_argument("--casos", nargs="*")
    ap.add_argument("--historias", nargs="*")
    ap.add_argument("--salida", required=True)
    ap.add_argument("--pasos", choices=["filas", "celda"], default="celda")
    ap.add_argument("--ids", nargs="*")
    a = ap.parse_args()
    root = raiz()
    sync = {}
    if root and (root / ".pipeline" / "state" / "sync.json").exists():
        sync = json.loads((root / ".pipeline" / "state" / "sync.json").read_text(encoding="utf-8")).get("elementos", {})
    ids = set(a.ids or [])
    filas = []

    if a.que == "casos":
        if not a.casos:
            sys.exit("Indica --casos.")
        cab = ["id", "titulo", "historia", "criterios", "reglas", "tipo", "prioridad", "nivel", "precondiciones",
               "datos", "automatizable", "paso_numero", "paso", "resultado_esperado", "etiquetas", "clave_externa"]
        for m in bloques(leer(a.casos), r"TC-\d+-\d+"):
            tc, titulo, cuerpo = m.group(1), m.group(2).strip(), m.group(3)
            cubre = campo(cuerpo, "cubre")
            us = (re.search(r"US-\d+", cubre) or re.search(r"(\d+)", tc)).group(0)
            us = us if us.startswith("US-") else f"US-{us}"
            if ids and us not in ids:
                continue
            base = {"id": tc, "titulo": limpio(titulo), "historia": us, "criterios": ", ".join(re.findall(r"AC-[\d.]+", cubre)),
                    "reglas": ", ".join(re.findall(r"RN-\d+", campo(cuerpo, "reglas"))), "tipo": campo(cuerpo, "tipo"),
                    "prioridad": campo(cuerpo, "prioridad"), "nivel": campo(cuerpo, "nivel"),
                    "precondiciones": limpio(campo(cuerpo, "precondiciones")), "datos": limpio(campo(cuerpo, "datos")),
                    "automatizable": campo(cuerpo, "automatizable"), "etiquetas": " ".join(x for x in [us, campo(cuerpo, "tipo")] if x),
                    "clave_externa": sync.get(tc, {}).get("clave", "")}
            ps = pasos_de(cuerpo)
            if a.pasos == "filas" and ps:
                for n, paso, res in ps:
                    filas.append({**base, "paso_numero": n, "paso": paso, "resultado_esperado": res})
            else:
                filas.append({**base, "paso_numero": "",
                              "paso": "\n".join(f"{n}. {p}" for n, p, _ in ps if p),
                              "resultado_esperado": "\n".join(f"{n}. {r}" for n, _, r in ps if r)})
    else:
        if not a.historias:
            sys.exit("Indica --historias.")
        cab = ["id", "titulo", "epica", "modulo", "prioridad", "tipo", "descripcion", "criterios_de_aceptacion",
               "reglas", "dependencias", "etiquetas", "clave_externa"]
        for m in bloques(leer(a.historias), r"US-\d+"):
            us, titulo, cuerpo = m.group(1), m.group(2).strip(), m.group(3)
            if ids and us not in ids:
                continue
            desc = re.search(r"^\*\*Como\*\*.*$", cuerpo, re.M)
            criterios = re.findall(r"^\s*[-*]\s*(AC-[\d.]+:.*)$", cuerpo, re.M)
            filas.append({"id": us, "titulo": limpio(titulo), "epica": campo(cuerpo, "épica"), "modulo": campo(cuerpo, "módulo"),
                          "prioridad": campo(cuerpo, "prioridad"), "tipo": campo(cuerpo, "tipo"),
                          "descripcion": limpio(desc.group(0).replace("**", "")) if desc else "",
                          "criterios_de_aceptacion": "\n".join(limpio(c.replace("**", "")) for c in criterios),
                          "reglas": ", ".join(re.findall(r"RN-\d+", campo(cuerpo, "reglas"))),
                          "dependencias": campo(cuerpo, "depende de") or campo(cuerpo, "dependencias"), "etiquetas": campo(cuerpo, "épica"),
                          "clave_externa": sync.get(us, {}).get("clave", "")})

    if not filas:
        sys.exit("No encontré nada que exportar con esos archivos y filtros.")
    with open(a.salida, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cab, quoting=csv.QUOTE_ALL)
        w.writeheader()
        w.writerows(filas)
    unicos = len({x["id"] for x in filas})
    print(f"{unicos} {a.que} exportados en {len(filas)} filas a {a.salida}")
    con_clave = len({x["id"] for x in filas if x["clave_externa"]})
    if con_clave:
        print(f"{con_clave} ya tienen clave en la herramienta: impórtalos como actualización, no como nuevos.")


if __name__ == "__main__":
    main()
