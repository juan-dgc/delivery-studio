#!/usr/bin/env python3
"""Calcula la estimación de la propuesta y genera la hoja interna.

Entrada: un JSON con fases, componentes y horas por perfil (formato abajo). Salida: estimacion.json con todas
las cifras y estimacion-interna.md con las tablas, en formato colombiano (punto de miles, coma decimal).
Todas las cifras de la propuesta deben salir de estimacion.json para que coincidan en todo el documento.

Formato de entrada:
{
  "moneda": "COP", "tarifa_hora": 125000, "iva_porcentaje": 19, "redondeo": 100000,
  "fases": [
    {"id": "F0", "nombre": "Descubrimiento", "opcional": false, "precio": "cerrado",
     "pagos": [100], "momentos_pago": ["Al aceptar el alcance"],
     "componentes": [{"nombre": "Talleres y prototipo", "horas": {"arquitectura": 24, "producto": 30, "pruebas": 8}}]}
  ],
  "recomendada": ["F0", "F1", "F2"],
  "paquete_horas": 40,
  "mantenimiento_anual_porcentaje": 18,
  "suscripcion": {"fijo_mensual": 2500000, "variable_unidad": 1200, "unidades_mes": 1500}
}
"precio" es "cerrado" o "ratificar" (se ratifica al terminar la Fase 0). "suscripcion" es opcional.

Uso: python3 estimar.py entrada.json --salida <carpeta>
"""
import argparse
import json
import math
import sys
from pathlib import Path


def redondear(valor, paso):
    return int(math.floor(valor / paso + 0.5) * paso)


def miles(n):
    return f"{int(round(n)):,}".replace(",", ".")


def millones(n, moneda, corto=False):
    m = n / 1_000_000
    txt = f"{m:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if txt.endswith(",0"):
        txt = txt[:-2]
    return f"{moneda} {txt} M" if corto else f"{moneda} {txt} millones"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entrada")
    ap.add_argument("--salida", required=True)
    a = ap.parse_args()
    d = json.loads(Path(a.entrada).read_text(encoding="utf-8"))
    mon, tarifa = d.get("moneda", "COP"), d["tarifa_hora"]
    iva_pct, paso = d.get("iva_porcentaje", 19), d.get("redondeo", 100000)
    out = Path(a.salida)
    out.mkdir(parents=True, exist_ok=True)

    fases, perfiles = [], {}
    for f in d["fases"]:
        comps, total_f, horas_f = [], 0, 0
        for c in f["componentes"]:
            h = sum(c["horas"].values())
            precio = redondear(h * tarifa, paso)
            for perfil, x in c["horas"].items():
                perfiles[perfil] = perfiles.get(perfil, 0) + x
            comps.append({"nombre": c["nombre"], "horas": h, "horas_por_perfil": c["horas"], "precio": precio})
            total_f += precio
            horas_f += h
        pagos = f.get("pagos", [100])
        if sum(pagos) != 100:
            sys.exit(f"Los pagos de {f['id']} suman {sum(pagos)} %, no 100 %.")
        montos = [redondear(total_f * p / 100, paso) for p in pagos]
        montos[-1] = total_f - sum(montos[:-1])  # el último absorbe el redondeo para que la suma sea exacta
        fases.append({"id": f["id"], "nombre": f["nombre"], "opcional": f.get("opcional", False),
                      "precio_tipo": f.get("precio", "cerrado"), "horas": horas_f, "precio": total_f,
                      "componentes": comps, "pagos": [{"porcentaje": p, "monto": m, "momento": mo} for p, m, mo in
                                                       zip(pagos, montos, f.get("momentos_pago", [""] * len(pagos)))]})

    base = sum(f["precio"] for f in fases if not f["opcional"])
    completa = sum(f["precio"] for f in fases)
    rec_ids = d.get("recomendada") or [f["id"] for f in fases if not f["opcional"]]
    recomendada = sum(f["precio"] for f in fases if f["id"] in rec_ids)

    def con_iva(x):
        iva = round(x * iva_pct / 100)
        return {"antes_iva": x, "iva": iva, "total": x + iva}

    res = {"moneda": mon, "tarifa_hora": tarifa, "iva_porcentaje": iva_pct, "fases": fases,
           "horas_por_perfil": perfiles, "horas_totales": sum(perfiles.values()),
           "alcance_base": con_iva(base), "recomendada": {**con_iva(recomendada), "fases": rec_ids},
           "plataforma_completa": con_iva(completa),
           "paquete_horas": {"horas": d.get("paquete_horas", 40), "precio": d.get("paquete_horas", 40) * tarifa}}

    mant = d.get("mantenimiento_anual_porcentaje")
    if mant:
        anual = redondear(recomendada * mant / 100, paso)
        res["opcion_a"] = {"implementacion": recomendada, "mantenimiento_anual": anual,
                           "acumulado": {m: recomendada + anual * (m // 12) for m in (12, 24, 36)}}
    s = d.get("suscripcion")
    if s:
        mensual = s["fijo_mensual"] + s.get("variable_unidad", 0) * s.get("unidades_mes", 0)
        impl_b = s.get("implementacion", recomendada)
        res["opcion_b"] = {"implementacion": impl_b, "mensual_estimado": mensual,
                           "acumulado": {m: impl_b + mensual * m for m in (12, 24, 36)}}
    (out / "estimacion.json").write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")

    md = ["# Estimación interna (no se envía al cliente)", "",
          f"- Tarifa por hora: {mon} {miles(tarifa)} | IVA: {iva_pct} % | Redondeo: múltiplos de {miles(paso)}",
          f"- Horas totales: {miles(res['horas_totales'])} | por perfil: " + ", ".join(f"{k} {v}" for k, v in perfiles.items()), "",
          f"| Fase | Componente | Horas | Inversión ({mon}) | Precio |", "|---|---|---:|---:|---|"]
    for f in fases:
        for c in f["componentes"]:
            md.append(f"| {f['id']} {f['nombre']}{' (opcional)' if f['opcional'] else ''} | {c['nombre']} | {c['horas']} | {miles(c['precio'])} | {f['precio_tipo']} |")
        md.append(f"| **{f['id']} subtotal** | | **{f['horas']}** | **{miles(f['precio'])}** | |")
    for nombre, clave in [("Alcance base", "alcance_base"), ("Propuesta recomendada", "recomendada"), ("Plataforma completa", "plataforma_completa")]:
        v = res[clave]
        md.append(f"| **{nombre}** | antes de IVA {miles(v['antes_iva'])} · IVA {miles(v['iva'])} | | **{miles(v['total'])}** | con IVA |")
    md += ["", "## Pagos por fase", ""]
    for f in fases:
        md.append(f"- {f['id']}: " + "; ".join(f"{p['porcentaje']} % = {miles(p['monto'])}" + (f" ({p['momento']})" if p["momento"] else "") for p in f["pagos"]))
    md += ["", f"Paquete de {res['paquete_horas']['horas']} horas: {mon} {miles(res['paquete_horas']['precio'])}"]
    if "opcion_a" in res:
        md += ["", "## Modelos de pago (acumulado)", "", "| Mes | Opción A | Opción B |", "|---|---:|---:|"]
        for m in (12, 24, 36):
            b = miles(res["opcion_b"]["acumulado"][m]) if "opcion_b" in res else "-"
            md.append(f"| {m} | {miles(res['opcion_a']['acumulado'][m])} | {b} |")
    md += ["", "## Formatos listos para el documento", "",
           f"- En prosa: {millones(recomendada, mon)} antes de IVA",
           f"- En tarjeta: {millones(recomendada, mon, corto=True)}",
           f"- En tabla: {miles(recomendada)} (con el encabezado 'Inversión ({mon})')"]
    (out / "estimacion-interna.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
