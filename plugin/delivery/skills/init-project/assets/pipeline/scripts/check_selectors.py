#!/usr/bin/env python3
"""Verifica selectors.json de una corrida de exploración web (paso 14).

Comprueba estructura, IDs únicos y bien formados, que cada caso de UI seleccionado en el
paso 13 esté mapeado, que cada elemento tenga selector y estabilidad, que los selectores
de estabilidad baja estén justificados y que no haya secretos.

Uso: python3 .pipeline/scripts/check_selectors.py <carpeta de la corrida> [--candidatos automation-candidates.md]
Sale con código 1 si hay errores.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ESTRATEGIAS = {"role", "label", "placeholder", "text", "title", "alt", "testid", "css", "xpath"}
ESTABILIDAD = {"alta", "media", "baja"}
FRAGIL = re.compile(r"nth-child|nth-of-type|:nth\(|\[\d+\]|\.css-[a-z0-9]+|\.jsx?-\w+|#[a-z]+-\d{3,}|\b[a-f0-9]{8,}\b", re.I)
SECRETO = re.compile(r"(password|contraseña|token|secret|bearer|cookie)\s*[:=]\s*\S+", re.I)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("carpeta")
    ap.add_argument("--candidatos")
    a = ap.parse_args()
    f = Path(a.carpeta) / "selectors.json"
    errores, avisos = [], []
    try:
        texto = f.read_text(encoding="utf-8")
        d = json.loads(texto)
    except FileNotFoundError:
        sys.exit(f"No existe {f}")
    except json.JSONDecodeError as e:
        sys.exit(f"selectors.json no es JSON válido: {e}")

    for campo in ["base_url", "explorado", "paginas", "casos"]:
        if campo not in d:
            errores.append(f"Falta el campo raíz '{campo}'.")
    if SECRETO.search(texto):
        errores.append("Parece haber una contraseña, token o cookie en el archivo.")

    ids_pg, ids_el, nombres_pg = set(), set(), set()
    casos_mapeados = set()
    total_el = baja = 0
    for p in d.get("paginas", []):
        pid = p.get("id", "?")
        if not re.fullmatch(r"PG-\d{2,}", pid):
            errores.append(f"ID de pantalla inválido: {pid}")
        if pid in ids_pg:
            errores.append(f"ID de pantalla repetido: {pid}")
        ids_pg.add(pid)
        nl = p.get("nombre_logico", "")
        if not re.fullmatch(r"[A-Z][A-Za-z0-9]*Page", nl):
            errores.append(f"{pid}: nombre_logico '{nl}' debe ser PascalCase y terminar en Page.")
        if nl in nombres_pg:
            errores.append(f"{pid}: nombre_logico '{nl}' repetido.")
        nombres_pg.add(nl)
        if not p.get("ruta"):
            avisos.append(f"{pid}: sin ruta.")
        casos_mapeados |= set(p.get("casos", []))
        nombres_el = set()
        for e in p.get("elementos", []):
            if e.get("obsoleto"):
                continue
            total_el += 1
            eid = e.get("id", "?")
            if not re.fullmatch(rf"{re.escape(pid)}\.E\d{{2,}}", eid):
                errores.append(f"{eid}: el ID debe ser {pid}.ENN.")
            if eid in ids_el:
                errores.append(f"ID de elemento repetido: {eid}")
            ids_el.add(eid)
            nle = e.get("nombre_logico", "")
            if not re.fullmatch(r"[a-z][A-Za-z0-9]*", nle):
                errores.append(f"{eid}: nombre_logico '{nle}' debe ser camelCase.")
            if nle in nombres_el:
                errores.append(f"{eid}: nombre_logico '{nle}' repetido en {pid}.")
            nombres_el.add(nle)
            loc = e.get("locator", "")
            if not loc:
                errores.append(f"{eid}: sin locator.")
            if e.get("estrategia") not in ESTRATEGIAS:
                errores.append(f"{eid}: estrategia '{e.get('estrategia')}' inválida.")
            if e.get("estabilidad") not in ESTABILIDAD:
                errores.append(f"{eid}: estabilidad '{e.get('estabilidad')}' inválida.")
            if e.get("estabilidad") == "baja":
                baja += 1
                if not e.get("notas"):
                    errores.append(f"{eid}: estabilidad baja sin explicación en notas.")
            if e.get("estrategia") in ("css", "xpath") and FRAGIL.search(loc):
                avisos.append(f"{eid}: el selector '{loc}' parece frágil (posición, clase generada o id dinámico).")
            if e.get("unico") is not True:
                avisos.append(f"{eid}: no se comprobó que sea único.")
            if e.get("contenedor") and e["contenedor"] not in {x.get("id") for x in p.get("elementos", [])}:
                errores.append(f"{eid}: contenedor {e['contenedor']} no existe en {pid}.")
    for n in d.get("navegacion", []):
        for k in ("desde", "hacia"):
            if n.get(k) not in ids_pg:
                errores.append(f"Navegación con pantalla inexistente: {n.get(k)}")

    casos_doc = {c.get("tc"): c for c in d.get("casos", [])}
    if a.candidatos:
        t = Path(a.candidatos).read_text(encoding="utf-8")
        sec = t.split("## Seleccionados", 1)[1] if "## Seleccionados" in t else ""
        sec = sec.split("\n## ", 1)[0]
        ui = [m.group(1) for m in re.finditer(r"^-\s*(TC-\d+-\d+)\s*\|\s*ui\b", sec, re.M | re.I)]
        for tc in ui:
            if tc not in casos_doc:
                errores.append(f"{tc} está seleccionado para UI pero no aparece en 'casos'.")
            elif tc not in casos_mapeados:
                avisos.append(f"{tc} no está en la lista 'casos' de ninguna pantalla.")
        print(f"Casos UI seleccionados: {len(ui)} | documentados: {sum(1 for tc in ui if tc in casos_doc)}")
    no_ejec = [tc for tc, c in casos_doc.items() if c.get("ejecutable") != "sí"]

    print(f"Pantallas: {len(ids_pg)} | elementos vigentes: {total_el} | estabilidad baja: {baja} | "
          f"casos no ejecutables o parciales: {len(no_ejec)}")
    for x in errores:
        print(f"[ERROR] {x}")
    for x in avisos:
        print(f"[AVISO] {x}")
    print("Resultado: " + ("CON ERRORES" if errores else "OK"))
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
