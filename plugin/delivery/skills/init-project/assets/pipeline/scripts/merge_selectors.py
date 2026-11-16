#!/usr/bin/env python3
"""Une los selectors.json de todos los lotes en un solo mapa de pantallas del proyecto.

Cada lote explora las pantallas que tocan sus casos, pero la aplicación es una sola: el inicio de
sesión que exploró sprint-01 es el mismo que usa sprint-03. Este script toma la última versión de
la exploración de cada lote (outputs/14-web-exploration/<lote>/vN/selectors.json), las une por ID
de pantalla y detecta choques:

  - el mismo ID (PG-03) usado para dos pantallas distintas;
  - la misma pantalla (misma ruta o mismo nombre lógico) con dos IDs distintos;
  - el mismo ID de elemento con nombres lógicos distintos.

Cuando una pantalla aparece en varios lotes, se queda con la exploración más reciente de cada
elemento y suma historias y casos de todos.

Uso:
  python3 .pipeline/scripts/merge_selectors.py                    resumen: pantallas, de qué lote viene cada una, siguiente ID libre
  python3 .pipeline/scripts/merge_selectors.py --salida <archivo>  escribe el selectors.json unificado
  python3 .pipeline/scripts/merge_selectors.py --excluir sprint-03 no cuenta ese lote (para ver qué había antes de explorarlo)
Sale con código 1 si hay choques.
"""
import argparse
import json
import re
import sys
from pathlib import Path


from _raiz import raiz as _raiz_proyecto


def raiz():
    return _raiz_proyecto()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida")
    ap.add_argument("--excluir", nargs="*", default=[])
    a = ap.parse_args()
    root = raiz()
    base = root / "outputs" / "14-web-exploration"
    fuentes = []
    if base.exists():
        for lote in sorted(p for p in base.iterdir() if p.is_dir() and p.name not in a.excluir):
            versiones = sorted((int(m.group(1)), v) for v in lote.iterdir()
                               if (m := re.fullmatch(r"v(\d+)", v.name)) and (v / "selectors.json").exists())
            if versiones:
                f = versiones[-1][1] / "selectors.json"
                try:
                    fuentes.append((lote.name, f, json.loads(f.read_text(encoding="utf-8"))))
                except json.JSONDecodeError as e:
                    sys.exit(f"{f} no es JSON válido: {e}")
    if not fuentes:
        print("No hay exploraciones todavía: la primera empieza en PG-01.")
        return
    fuentes.sort(key=lambda x: x[2].get("explorado", ""))  # la más reciente al final: manda

    paginas, choques, origen = {}, [], {}
    por_logico, por_ruta = {}, {}
    navegacion, casos = {}, {}
    for lote, f, d in fuentes:
        for pg in d.get("paginas", []):
            pid = pg["id"]
            for clave, indice, etiqueta in ((pg.get("nombre_logico"), por_logico, "nombre lógico"), (pg.get("ruta"), por_ruta, "ruta")):
                if clave and clave in indice and indice[clave] != pid:
                    choques.append(f"La pantalla con {etiqueta} '{clave}' tiene dos IDs: {indice[clave]} y {pid} ({lote}). "
                                   "Es la misma pantalla: debe conservar el primer ID.")
                elif clave:
                    indice.setdefault(clave, pid)
            if pid not in paginas:
                paginas[pid] = json.loads(json.dumps(pg))
                origen[pid] = [lote]
                continue
            previa = paginas[pid]
            if previa.get("nombre_logico") != pg.get("nombre_logico"):
                choques.append(f"{pid} es '{previa.get('nombre_logico')}' en {origen[pid][0]} y '{pg.get('nombre_logico')}' en {lote}: "
                               "dos pantallas distintas con el mismo ID.")
                continue
            origen[pid].append(lote)
            elementos = {e["id"]: e for e in previa.get("elementos", [])}
            for e in pg.get("elementos", []):
                if e["id"] in elementos and elementos[e["id"]].get("nombre_logico") != e.get("nombre_logico"):
                    choques.append(f"{e['id']} es '{elementos[e['id']].get('nombre_logico')}' y '{e.get('nombre_logico')}' ({lote}).")
                    continue
                usado = sorted(set(elementos.get(e["id"], {}).get("usado_en", [])) | set(e.get("usado_en", [])))
                elementos[e["id"]] = {**e, "usado_en": usado}
            nueva = {**previa, **{k: v for k, v in pg.items() if k not in ("elementos", "historias", "casos")}}
            nueva["elementos"] = [elementos[k] for k in sorted(elementos)]
            nueva["historias"] = sorted(set(previa.get("historias", [])) | set(pg.get("historias", [])))
            nueva["casos"] = sorted(set(previa.get("casos", [])) | set(pg.get("casos", [])))
            paginas[pid] = nueva
        for n in d.get("navegacion", []):
            navegacion[(n.get("desde"), n.get("hacia"), n.get("accion"))] = n
        for c in d.get("casos", []):
            casos[c["tc"]] = c

    numeros = [int(re.search(r"\d+", p).group()) for p in paginas]
    siguiente = f"PG-{max(numeros) + 1:02d}"
    print(f"{len(paginas)} pantallas en {len(fuentes)} lote(s): {', '.join(l for l, _, _ in fuentes)}")
    print(f"{'ID':<7} {'Nombre lógico':<28} {'Ruta':<26} {'Elem':>4}  Lotes")
    for pid in sorted(paginas, key=lambda p: int(re.search(r"\d+", p).group())):
        pg = paginas[pid]
        vivos = sum(1 for e in pg.get("elementos", []) if not e.get("obsoleto"))
        print(f"{pid:<7} {str(pg.get('nombre_logico', ''))[:28]:<28} {str(pg.get('ruta', ''))[:26]:<26} {vivos:>4}  {', '.join(origen[pid])}")
    print(f"\nSiguiente ID libre para una pantalla nueva: {siguiente}")
    for c in choques:
        print(f"[CHOQUE] {c}")
    if a.salida:
        ultimo = fuentes[-1][2]
        unido = {"version": ultimo.get("version", 1), "base_url": ultimo.get("base_url"), "explorado": ultimo.get("explorado"),
                 "alcance": "proyecto", "lotes": [l for l, _, _ in fuentes],
                 "roles_explorados": sorted({r for _, _, d in fuentes for r in d.get("roles_explorados", [])}),
                 "convencion_test_id": ultimo.get("convencion_test_id"),
                 "paginas": [paginas[k] for k in sorted(paginas, key=lambda p: int(re.search(r"\d+", p).group()))],
                 "navegacion": list(navegacion.values()), "casos": [casos[k] for k in sorted(casos)]}
        Path(a.salida).write_text(json.dumps(unido, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Mapa unificado en {a.salida}")
    sys.exit(1 if choques else 0)


if __name__ == "__main__":
    main()
