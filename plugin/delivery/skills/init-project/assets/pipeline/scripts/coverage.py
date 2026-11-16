#!/usr/bin/env python3
"""Matriz de cobertura entre historias de usuario (US/AC) y casos de prueba (TC).

Lee los formatos que producen /delivery:generate-user-stories y /delivery:generate-test-cases:
  historias:  '## US-001: Título' y criterios '- AC-001.1: ...'
  casos:      '## TC-001-01: Título' con una línea '- cubre: US-001 (AC-001.1, AC-001.2)'
              y opcionalmente '- tipo: positivo|negativo|borde|...' y '- prioridad: P1'

Uso: python3 .pipeline/scripts/coverage.py --historias <archivo|carpeta>... --casos <archivo|carpeta>... \
        [--alcances .pipeline/state/alcances.json] [--md matriz.md] [--json cobertura.json]

Modo acumulado: pasa en --casos las carpetas de todos los lotes (por ejemplo las de
'pipeline.py run all-latest 03-test-cases') y --alcances para clasificar las historias sin casos
entre brecha real (su lote ya tiene casos) y pendiente (su lote aún no se trabaja).
"""
import argparse
import json
import re
import sys
from pathlib import Path


def archivos(rutas):
    out = []
    for r in rutas:
        p = Path(r)
        out += sorted(p.rglob("*.md")) if p.is_dir() else [p]
    return [f for f in out if f.exists() and not f.name.startswith("_")]


def bloques(texto, patron):
    return list(re.finditer(rf"^## ({patron}):\s*(.*?)\n(.*?)(?=^## |\Z)", texto, re.S | re.M))


def campo(cuerpo, nombre):
    m = re.search(rf"^- {nombre}:\s*(.*)$", cuerpo, re.M | re.I)
    return m.group(1).strip() if m else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--historias", nargs="+", required=True)
    ap.add_argument("--casos", nargs="+", required=True)
    ap.add_argument("--alcances", help="alcances.json para el modo acumulado")
    ap.add_argument("--md")
    ap.add_argument("--json")
    a = ap.parse_args()

    us, nombres_ep = {}, {}
    for f in archivos(a.historias):
        epica = ""
        for b in bloques(f.read_text(encoding="utf-8"), r"(?:US|EP)-\d+"):
            if b.group(1).startswith("EP-"):
                epica = b.group(1)
                nombres_ep[epica] = b.group(2).strip()
                continue
            acs = re.findall(r"^\s*-\s*\**(AC-\d+\.\d+)\**:", b.group(3), re.M)
            us[b.group(1)] = {"titulo": b.group(2).strip(), "acs": acs, "prioridad": campo(b.group(3), "prioridad"),
                              "epica": campo(b.group(3), "épica") or epica or "sin épica", "archivo": f.as_posix()}
    tcs, origen_tc, lotes_con_casos = {}, {}, set()
    for f in archivos(a.casos):
        mlote = re.search(r"outputs/03-test-cases/([^/]+)/v\d+", f.resolve().as_posix())
        lote = mlote.group(1) if mlote else f.parent.as_posix()
        lotes_con_casos.add(lote)
        for b in bloques(f.read_text(encoding="utf-8"), r"TC-\d+-\d+"):
            cubre = campo(b.group(3), "cubre")
            origen_tc.setdefault(b.group(1), []).append(lote)
            tcs[b.group(1)] = {"titulo": b.group(2).strip(), "us": re.findall(r"US-\d+", cubre),
                               "acs": re.findall(r"AC-\d+\.\d+", cubre), "tipo": campo(b.group(3), "tipo").lower(),
                               "prioridad": campo(b.group(3), "prioridad")}
    if not us:
        sys.exit("No encontré historias con el formato '## US-NNN: título'.")

    todos_ac = {ac for u in us.values() for ac in u["acs"]}
    huerfanos, refs_rotas = [], []
    for tid, t in tcs.items():
        malas = [x for x in t["us"] if x not in us] + [x for x in t["acs"] if x not in todos_ac]
        if not t["us"] and not t["acs"]:
            huerfanos.append(tid)
        elif malas:
            refs_rotas.append((tid, malas))

    filas, sin_cobertura, sin_negativo = [], [], []
    for uid, u in us.items():
        casos_us = [tid for tid, t in tcs.items() if uid in t["us"] or any(ac in u["acs"] for ac in t["acs"])]
        cubiertos = {ac for tid in casos_us for ac in tcs[tid]["acs"] if ac in u["acs"]}
        # un TC que cubre la US sin listar AC se interpreta como cobertura general, no de cada AC
        faltan = [ac for ac in u["acs"] if ac not in cubiertos]
        tipos = {tcs[t]["tipo"] for t in casos_us}
        if casos_us and not tipos & {"negativo", "borde", "error"}:
            sin_negativo.append(uid)
        sin_cobertura += [(uid, ac) for ac in faltan]
        pct = 100 * len(cubiertos) / len(u["acs"]) if u["acs"] else (100 if casos_us else 0)
        filas.append({"us": uid, "titulo": u["titulo"], "prioridad": u["prioridad"], "acs": len(u["acs"]),
                      "acs_cubiertos": len(cubiertos), "pct": round(pct), "casos": casos_us, "faltan": faltan})

    lote_us = {}
    if a.alcances and Path(a.alcances).exists():
        for nombre, v in json.loads(Path(a.alcances).read_text(encoding="utf-8")).items():
            for h in v.get("historias", []):
                lote_us.setdefault(h, nombre)
    sin_casos = [f["us"] for f in filas if not f["casos"]]
    clasif = {"brecha": [], "pendiente": [], "sin_lote": []}
    if a.alcances:
        for h in sin_casos:
            lote = lote_us.get(h)
            clasif["sin_lote" if not lote else ("brecha" if lote in lotes_con_casos else "pendiente")].append(h)
    duplicados = {t: l for t, l in origen_tc.items() if len(l) > 1}
    por_ep = {}
    for f in filas:
        e = por_ep.setdefault(us[f["us"]]["epica"], {"historias": 0, "con_casos": 0, "acs": 0, "cubiertos": 0})
        e["historias"] += 1
        e["con_casos"] += 1 if f["casos"] else 0
        e["acs"] += f["acs"]
        e["cubiertos"] += f["acs_cubiertos"]
    total_ac = sum(f["acs"] for f in filas)
    cub_ac = sum(f["acs_cubiertos"] for f in filas)
    res = {
        "historias": len(us), "criterios": total_ac, "criterios_cubiertos": cub_ac,
        "cobertura_criterios_pct": round(100 * cub_ac / total_ac) if total_ac else 0,
        "historias_sin_casos": [f["us"] for f in filas if not f["casos"]],
        "historias_sin_caso_negativo": sin_negativo,
        "criterios_sin_cobertura": [f"{u} {ac}" for u, ac in sin_cobertura],
        "casos": len(tcs), "casos_huerfanos": huerfanos,
        "casos_con_referencias_rotas": [f"{t}: {', '.join(m)}" for t, m in refs_rotas],
        "historias_sin_criterios": [u for u, x in us.items() if not x["acs"]],
        "por_epica": por_ep, "lotes_con_casos": sorted(lotes_con_casos),
        "historias_sin_casos_clasificadas": clasif if a.alcances else None,
        "casos_duplicados_entre_lotes": duplicados,
        "matriz": filas,
    }

    md = ["# Matriz de cobertura US/TC", "",
          f"- Historias: {res['historias']} | criterios: {total_ac} | casos: {res['casos']}",
          f"- Cobertura de criterios de aceptación: {res['cobertura_criterios_pct']}% ({cub_ac} de {total_ac})", "",
          f"- Lotes con casos: {', '.join(sorted(lotes_con_casos))}", "",
          "## Cobertura por épica", "", "| Épica | Historias | Con casos | Criterios cubiertos | % |", "|---|---|---|---|---|"]
    for ep, e in sorted(por_ep.items()):
        pct = round(100 * e["cubiertos"] / e["acs"]) if e["acs"] else 0
        md.append(f"| {ep} {nombres_ep.get(ep, '')[:40]} | {e['historias']} | {e['con_casos']} | {e['cubiertos']}/{e['acs']} | {pct}% |")
    if a.alcances:
        md += ["", "## Historias sin casos, por motivo", "",
               f"- Brecha real (su lote ya tiene casos): {len(clasif['brecha'])} {', '.join(clasif['brecha'][:20])}",
               f"- Pendientes (su lote aún no tiene casos): {len(clasif['pendiente'])}",
               f"- Sin lote asignado: {len(clasif['sin_lote'])} {', '.join(clasif['sin_lote'][:20])}"]
    if duplicados:
        md += ["", "## Casos duplicados entre lotes", ""] + [f"- {t}: {', '.join(l)}" for t, l in sorted(duplicados.items())]
    md += ["", "## Matriz por historia", "",
           "| Historia | Prioridad | Criterios cubiertos | % | Casos | Criterios sin caso |", "|---|---|---|---|---|---|"]
    for f in filas:
        md.append(f"| {f['us']} {f['titulo'][:50]} | {f['prioridad'] or '-'} | {f['acs_cubiertos']}/{f['acs']} | {f['pct']}% | "
                  f"{', '.join(f['casos']) or '**ninguno**'} | {', '.join(f['faltan']) or '-'} |")
    for titulo, clave in [("Historias sin casos", "historias_sin_casos"),
                          ("Historias sin caso negativo o de borde", "historias_sin_caso_negativo"),
                          ("Historias sin criterios de aceptación", "historias_sin_criterios"),
                          ("Casos huérfanos (no indican qué cubren)", "casos_huerfanos"),
                          ("Casos con referencias a US o AC inexistentes", "casos_con_referencias_rotas")]:
        md += ["", f"## {titulo}", ""] + ([f"- {x}" for x in res[clave]] or ["- ninguno"])
    salida = "\n".join(md) + "\n"
    if a.md:
        Path(a.md).write_text(salida, encoding="utf-8")
    if a.json:
        Path(a.json).write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(salida if not a.md else f"Matriz escrita en {a.md}")
    print(f"Cobertura de criterios: {res['cobertura_criterios_pct']}% | sin casos: {len(res['historias_sin_casos'])} | "
          f"huérfanos: {len(huerfanos)} | referencias rotas: {len(refs_rotas)} | duplicados entre lotes: {len(duplicados)}")


if __name__ == "__main__":
    main()
