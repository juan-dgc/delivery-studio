#!/usr/bin/env python3
"""Corte de presupuesto: horas presupuestadas frente a horas consumidas, con proyección.

No estima nada: solo suma lo que está en dos archivos de outputs/_presupuesto/ que mantiene el usuario
(o /delivery:track-budget con sus datos):

  presupuesto.csv   concepto,perfil,horas,tarifa     lo acordado; 'tarifa' puede ir vacía
  horas.csv         fecha,persona,perfil,concepto,horas,nota     lo trabajado; fecha AAAA-MM-DD

'concepto' es la unidad contra la que se controla: una fase, un sprint o una actividad (gestión, QA...).

Uso:
  python3 .pipeline/scripts/budget.py plantillas
  python3 .pipeline/scripts/budget.py corte [--hasta AAAA-MM-DD] [--avance 45] [--md salida.md] [--json salida.json]

--avance es el porcentaje de alcance terminado y aceptado (lo calcula quien invoca, con su fuente).
Con él se obtiene el índice de eficiencia y la proyección al cierre.
Sale con código 1 si hay filas que no se pueden leer.
"""
import argparse
import csv
import datetime
import json
import sys
from collections import defaultdict
from pathlib import Path

from _raiz import raiz


def num(texto, donde):
    try:
        return float(str(texto).strip().replace(",", "."))
    except ValueError:
        sys.exit(f"{donde}: '{texto}' no es un número.")


def leer(p, columnas):
    if not p.exists():
        sys.exit(f"Falta {p.name} en outputs/_presupuesto/. Créalo con: budget.py plantillas")
    with p.open(encoding="utf-8-sig", newline="") as f:
        filas = [{k.strip().lower(): (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(f)]
    faltan = [c for c in columnas if filas and c not in filas[0]]
    if faltan:
        sys.exit(f"{p.name}: faltan las columnas {', '.join(faltan)}.")
    return [r for r in filas if any(r.values())]


def fmt(n):
    return f"{n:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".").replace(",0", "")


def tabla(titulo, filas_pres, filas_cons):
    claves = sorted(set(filas_pres) | set(filas_cons))
    out = []
    for k in claves:
        p, c = filas_pres.get(k, 0.0), filas_cons.get(k, 0.0)
        if p == 0:
            estado = "SIN PRESUPUESTO"
        elif c > p:
            estado = "EXCEDIDO"
        elif c >= 0.85 * p:
            estado = "POR AGOTARSE"
        else:
            estado = "en rango"
        out.append({titulo: k, "presupuesto": p, "consumido": c, "saldo": p - c,
                    "porcentaje": round(100 * c / p, 1) if p else None, "estado": estado})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("accion", choices=["plantillas", "corte"])
    ap.add_argument("--hasta")
    ap.add_argument("--avance", type=float)
    ap.add_argument("--md")
    ap.add_argument("--json")
    a = ap.parse_args()
    base = raiz() / "outputs" / "_presupuesto"
    fp, fh = base / "presupuesto.csv", base / "horas.csv"

    if a.accion == "plantillas":
        base.mkdir(parents=True, exist_ok=True)
        for f, cab in ((fp, "concepto,perfil,horas,tarifa\n"), (fh, "fecha,persona,perfil,concepto,horas,nota\n")):
            if f.exists():
                print(f"Ya existe, no se toca: {f}")
            else:
                f.write_text(cab, encoding="utf-8")
                print(f"Creado: {f}")
        return

    pres = leer(fp, ["concepto", "perfil", "horas"])
    horas = leer(fh, ["fecha", "perfil", "concepto", "horas"])
    if not pres:
        sys.exit("presupuesto.csv no tiene filas: sin presupuesto no hay contra qué comparar.")
    hasta = datetime.date.fromisoformat(a.hasta) if a.hasta else datetime.date.today()
    avisos = []
    p_perfil, p_concepto, tarifas = defaultdict(float), defaultdict(float), {}
    for i, r in enumerate(pres, 2):
        h = num(r["horas"], f"presupuesto.csv fila {i}")
        p_perfil[r["perfil"]] += h
        p_concepto[r["concepto"]] += h
        if r.get("tarifa"):
            t = num(r["tarifa"], f"presupuesto.csv fila {i}")
            if tarifas.get(r["perfil"], t) != t:
                avisos.append(f"El perfil '{r['perfil']}' tiene más de una tarifa en presupuesto.csv; el costo no se calcula.")
                tarifas[r["perfil"]] = None
            else:
                tarifas[r["perfil"]] = t
    c_perfil, c_concepto, por_semana, fuera = defaultdict(float), defaultdict(float), defaultdict(float), 0
    for i, r in enumerate(horas, 2):
        try:
            fecha = datetime.date.fromisoformat(r["fecha"])
        except ValueError:
            sys.exit(f"horas.csv fila {i}: la fecha '{r['fecha']}' no tiene el formato AAAA-MM-DD.")
        if fecha > hasta:
            fuera += 1
            continue
        h = num(r["horas"], f"horas.csv fila {i}")
        c_perfil[r["perfil"]] += h
        c_concepto[r["concepto"]] += h
        lunes = fecha - datetime.timedelta(days=fecha.weekday())
        por_semana[lunes.isoformat()] += h
    for k in sorted(set(c_perfil) - set(p_perfil)):
        avisos.append(f"Hay horas del perfil '{k}', que no está en el presupuesto.")
    for k in sorted(set(c_concepto) - set(p_concepto)):
        avisos.append(f"Hay horas en el concepto '{k}', que no está en el presupuesto.")
    if fuera:
        avisos.append(f"{fuera} fila(s) de horas posteriores al {hasta.isoformat()} no se contaron.")

    total_p, total_c = sum(p_perfil.values()), sum(c_perfil.values())
    res = {"corte": hasta.isoformat(), "presupuesto_horas": total_p, "consumido_horas": total_c,
           "saldo_horas": total_p - total_c, "consumido_porcentaje": round(100 * total_c / total_p, 1),
           "por_perfil": tabla("perfil", p_perfil, c_perfil), "por_concepto": tabla("concepto", p_concepto, c_concepto),
           "por_semana": dict(sorted(por_semana.items())), "avisos": avisos}
    semanas = sorted(por_semana)[-4:]
    if semanas:
        res["ritmo_semanal"] = round(sum(por_semana[s] for s in semanas) / len(semanas), 1)
        if res["ritmo_semanal"] > 0 and total_p > total_c:
            res["semanas_de_saldo"] = round((total_p - total_c) / res["ritmo_semanal"], 1)
    con_tarifa = all(tarifas.get(k) for k in p_perfil) and all(tarifas.get(k) for k in c_perfil)
    if con_tarifa:
        res["presupuesto_costo"] = sum(num(r["horas"], "") * tarifas[r["perfil"]] for r in pres)
        res["consumido_costo"] = sum(c_perfil[k] * tarifas[k] for k in c_perfil)
    elif any(tarifas.values()):
        avisos.append("No todos los perfiles tienen tarifa: el corte va solo en horas.")
    if a.avance is not None:
        if not 0 <= a.avance <= 100:
            sys.exit("--avance debe estar entre 0 y 100.")
        ganado = total_p * a.avance / 100
        res["avance_porcentaje"] = a.avance
        res["valor_ganado_horas"] = round(ganado, 1)
        if total_c > 0 and a.avance > 0:
            res["indice_eficiencia"] = round(ganado / total_c, 2)
            res["proyeccion_al_cierre_horas"] = round(total_c / (a.avance / 100), 1)
            res["desviacion_proyectada_horas"] = round(res["proyeccion_al_cierre_horas"] - total_p, 1)

    lineas = [f"Corte al {res['corte']}: {fmt(total_c)} de {fmt(total_p)} horas ({res['consumido_porcentaje']}%), saldo {fmt(total_p - total_c)}."]
    if "ritmo_semanal" in res:
        lineas.append(f"Ritmo de las últimas {len(semanas)} semana(s): {fmt(res['ritmo_semanal'])} h por semana"
                      + (f"; el saldo alcanza para {res['semanas_de_saldo']} semana(s) a ese ritmo." if "semanas_de_saldo" in res else "."))
    if "indice_eficiencia" in res:
        lineas.append(f"Avance {a.avance}%: valor ganado {fmt(res['valor_ganado_horas'])} h, índice de eficiencia {res['indice_eficiencia']} "
                      f"(1 = según lo presupuestado; menos de 1 = cuesta más). Proyección al cierre: {fmt(res['proyeccion_al_cierre_horas'])} h "
                      f"({res['desviacion_proyectada_horas']:+} h frente al presupuesto).")
    if "consumido_costo" in res:
        lineas.append(f"Costo: {fmt(res['consumido_costo'])} de {fmt(res['presupuesto_costo'])}.")
    print("\n".join(lineas) + "\n")

    def md_tabla(nombre, filas):
        t = f"| {nombre.capitalize()} | Presupuesto (h) | Consumido (h) | Saldo (h) | % | Estado |\n|---|---|---|---|---|---|\n"
        for f in filas:
            pct = f"{f['porcentaje']}%" if f["porcentaje"] is not None else "-"
            t += f"| {f[nombre]} | {fmt(f['presupuesto'])} | {fmt(f['consumido'])} | {fmt(f['saldo'])} | {pct} | {f['estado']} |\n"
        return t

    cuerpo = md_tabla("perfil", res["por_perfil"]) + "\n" + md_tabla("concepto", res["por_concepto"])
    print(cuerpo)
    for x in avisos:
        print(f"[AVISO] {x}")
    if a.md:
        Path(a.md).write_text("\n\n".join(lineas) + "\n\n" + cuerpo + "\n" + "".join(f"- Aviso: {x}\n" for x in avisos), encoding="utf-8")
    if a.json:
        Path(a.json).write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
