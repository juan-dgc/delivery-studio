#!/usr/bin/env python3
"""Trazabilidad del context pack a las historias y a los casos de prueba.

Responde dos preguntas que coverage.py no mira (ese cruza criterios AC con casos TC):

  1. Historias: cada regla de negocio (RN-NNN de domain.md), cada paso de proceso
     (PROC-NN.N de business-processes.md) y cada módulo en alcance (MOD-NN de scope.md),
     ¿termina en al menos una historia?
  2. Casos: cada regla que una historia declara en '- reglas:', y cada paso de proceso que
     declara en '- procesos:', ¿tiene al menos un caso de prueba que lo cite? Para las
     reglas, además, ¿hay al menos un caso negativo o de borde?

Lo que se deja fuera a propósito se declara, con su motivo, en una sección del artefacto:
  en user-stories.md:   '## Sin historia'   con líneas '- RN-012: fuera del alcance de esta fase'
  en test-cases.md:     '## Sin caso'       con líneas '- RN-012: se verifica en US-004'

Uso:
  python3 .pipeline/scripts/check_trace.py historias --historias <archivo|carpeta>... [--md salida.md] [--json salida.json]
  python3 .pipeline/scripts/check_trace.py casos --historias <...> --casos <archivo|carpeta>... [--ids US-001 US-002 ...]

Con --ids (o con el alcance de un lote) el chequeo de casos se limita a esas historias.
Sale con código 1 si hay brechas.
"""
import argparse
import json
import re
import sys
from pathlib import Path

RN = r"RN-\d+"
PASO = r"PROC-\d+\.\d+"
PROC = r"PROC-\d+"
MOD = r"MOD-\d+"


from _raiz import raiz as _raiz_proyecto


def raiz():
    return _raiz_proyecto()


def archivos(rutas):
    out = []
    for r in rutas:
        p = Path(r)
        out += sorted(p.rglob("*.md")) if p.is_dir() else [p]
    return [f for f in out if f.exists() and not f.name.startswith("_")]


def leer(rutas):
    return "\n".join(f.read_text(encoding="utf-8") for f in archivos(rutas))


def bloques(texto, patron):
    return list(re.finditer(rf"^## ({patron}):\s*(.*?)\n(.*?)(?=^## |\Z)", texto, re.S | re.M))


def campo(cuerpo, nombre):
    m = re.search(rf"^- {nombre}:\s*(.*)$", cuerpo, re.M | re.I)
    return m.group(1).strip() if m else ""


def seccion(texto, titulo):
    m = re.search(rf"^## {re.escape(titulo)}\s*\n(.*?)(?=^## |\Z)", texto, re.M | re.S)
    return m.group(1) if m else ""


def excluidos(texto, titulo):
    """IDs declarados fuera a propósito, con motivo de al menos unas palabras."""
    out = {}
    for m in re.finditer(rf"^\s*[-*]\s*({RN}|{PASO}|{PROC}|{MOD})\s*:\s*(.+)$", seccion(texto, titulo), re.M):
        if len(m.group(2).strip()) >= 8:
            out[m.group(1)] = m.group(2).strip()
    return out


def definidos(root):
    """IDs que el context pack define, con su texto para mostrarlo en el reporte."""
    cp = root / "context-pack"
    out = {"reglas": {}, "pasos": {}, "procesos": {}, "modulos": {}}

    def texto_de(linea, ident):
        return re.sub(r"[*|`\[\]]", "", linea.split(ident, 1)[1]).strip(" :.-")[:110]

    if (cp / "domain.md").exists():
        for linea in (cp / "domain.md").read_text(encoding="utf-8").splitlines():
            m = re.match(rf"^\s*(?:[-*]|\|)\s*\*{{0,2}}({RN})\b", linea)
            if m:
                out["reglas"].setdefault(m.group(1), texto_de(linea, m.group(1)))
    if (cp / "business-processes.md").exists():
        t = (cp / "business-processes.md").read_text(encoding="utf-8")
        futuro = seccion(t, "Procesos futuros (TO-BE)") or t
        for linea in futuro.splitlines():
            m = re.match(rf"^\s*(?:[-*]|\||\d+\.|#+)?\s*\*{{0,2}}({PASO})\b", linea)
            if m:
                out["pasos"].setdefault(m.group(1), texto_de(linea, m.group(1)))
                continue
            m = re.match(rf"^\s*(?:[-*]|\||#+)\s*\*{{0,2}}({PROC})\b", linea)
            if m:
                out["procesos"].setdefault(m.group(1), texto_de(linea, m.group(1)))
    if (cp / "scope.md").exists():
        t = (cp / "scope.md").read_text(encoding="utf-8")
        fuera = seccion(t, "Fuera de alcance")
        for linea in t.splitlines():
            m = re.match(rf"^\s*(?:[-*]|\|)\s*\*{{0,2}}({MOD})\b", linea)
            if m and m.group(1) not in fuera:
                out["modulos"].setdefault(m.group(1), texto_de(linea, m.group(1)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("modo", choices=["historias", "casos"])
    ap.add_argument("--historias", nargs="+", required=True)
    ap.add_argument("--casos", nargs="*")
    ap.add_argument("--ids", nargs="*", help="Limita el chequeo de casos a estas historias")
    ap.add_argument("--md")
    ap.add_argument("--json")
    a = ap.parse_args()
    root = raiz()
    defs = definidos(root)
    th = leer(a.historias)
    historias = {m.group(1): m for m in bloques(th, r"US-\d+")}
    if not historias:
        sys.exit("No encontré historias ('## US-NNN: ...') en --historias.")
    brechas, avisos, filas = [], [], []

    if a.modo == "historias":
        fuera = excluidos(th, "Sin historia")
        # un proceso sin pasos numerados se exige completo; con pasos, se exige cada paso
        con_pasos = {p.split(".")[0] for p in defs["pasos"]}
        exigidos = [("regla", k, v) for k, v in defs["reglas"].items()]
        exigidos += [("paso de proceso", k, v) for k, v in defs["pasos"].items()]
        exigidos += [("proceso", k, v) for k, v in defs["procesos"].items() if k not in con_pasos]
        exigidos += [("módulo", k, v) for k, v in defs["modulos"].items()]
        for tipo, ident, texto in exigidos:
            # PROC-01.1 no debe contarse como mención de PROC-01.10 ni PROC-01 como mención de PROC-01.2
            patron = rf"(?<![\w.-]){re.escape(ident)}(?![\d.]\d|\d)"
            usan = [us for us, m in historias.items() if re.search(patron, m.group(0))]
            if usan:
                estado = "cubierto"
            elif ident in fuera:
                estado = "excluido"
            else:
                estado = "BRECHA"
                brechas.append(f"{ident} ({tipo}) no tiene ninguna historia: {texto}")
            filas.append({"id": ident, "tipo": tipo, "texto": texto, "historias": usan, "estado": estado,
                          "motivo": fuera.get(ident, "")})
        citados = set(re.findall(rf"{RN}|{PASO}|{MOD}", th))
        conocidos = set(defs["reglas"]) | set(defs["pasos"]) | set(defs["modulos"])
        for x in sorted(citados - conocidos):
            avisos.append(f"Las historias citan {x}, que no está definido en el context pack.")
        sin_regla = [us for us, m in historias.items()
                     if not re.search(RN, campo(m.group(3), "reglas")) and "no funcional" not in campo(m.group(3), "tipo")]
        if defs["reglas"] and len(sin_regla) > len(historias) / 2:
            avisos.append(f"{len(sin_regla)} de {len(historias)} historias no declaran ninguna regla en '- reglas:'.")
        if not defs["reglas"]:
            avisos.append("domain.md no define reglas RN-NNN: no hay contra qué trazar. Revisa su sección 'Reglas de negocio'.")
        titulo = "Trazabilidad del context pack a las historias"
        cab = "| ID | Tipo | Qué dice | Historias | Estado |\n|---|---|---|---|---|\n"
        cuerpo = "".join(f"| {f['id']} | {f['tipo']} | {f['texto']} | {', '.join(f['historias']) or f['motivo'] or '-'} | {f['estado']} |\n"
                         for f in filas)
    else:
        if not a.casos:
            sys.exit("El modo casos necesita --casos.")
        tc = leer(a.casos)
        fuera = excluidos(tc, "Sin caso")
        casos = {}
        for m in bloques(tc, r"TC-\d+-\d+"):
            us = re.search(r"US-\d+", campo(m.group(3), "cubre") or "")
            us = us.group(0) if us else "US-" + m.group(1).split("-")[1]
            casos.setdefault(us, []).append((m.group(1), m.group(0), campo(m.group(3), "tipo").lower()))
        ids = set(a.ids) if a.ids else set(casos) & set(historias)
        for us in sorted(ids):
            if us not in historias:
                avisos.append(f"{us} está en el alcance pero no en las historias.")
                continue
            cuerpo_us = historias[us].group(3)
            exigidos = [("regla", x) for x in dict.fromkeys(re.findall(RN, campo(cuerpo_us, "reglas")))]
            exigidos += [("paso de proceso", x) for x in dict.fromkeys(re.findall(PASO, campo(cuerpo_us, "procesos")))]
            for tipo, ident in exigidos:
                patron = rf"(?<![\w.-]){re.escape(ident)}(?!\d)"
                usan = [(c, t) for c, texto, t in casos.get(us, []) if re.search(patron, texto)]
                negativo = any(("negativo" in t or "borde" in t) for _, t in usan)
                if usan:
                    estado = "cubierto"
                    if tipo == "regla" and not negativo:
                        estado = "solo positivo"
                        avisos.append(f"{us} / {ident}: tiene casos, pero ninguno negativo ni de borde que viole la regla.")
                elif ident in fuera:
                    estado = "excluido"
                else:
                    estado = "BRECHA"
                    brechas.append(f"{us} declara {ident} ({tipo}) y ningún caso suyo lo cita.")
                filas.append({"historia": us, "id": ident, "tipo": tipo, "casos": [c for c, _ in usan],
                              "estado": estado, "motivo": fuera.get(ident, "")})
        titulo = "Trazabilidad de reglas y procesos a los casos de prueba"
        cab = "| Historia | ID | Tipo | Casos | Estado |\n|---|---|---|---|---|\n"
        cuerpo = "".join(f"| {f['historia']} | {f['id']} | {f['tipo']} | {', '.join(f['casos']) or f['motivo'] or '-'} | {f['estado']} |\n"
                         for f in filas)

    total = len(filas)
    cubiertos = sum(1 for f in filas if f["estado"] in ("cubierto", "solo positivo"))
    excl = sum(1 for f in filas if f["estado"] == "excluido")
    pct = 100 * (cubiertos + excl) // total if total else 100
    resumen = (f"{titulo}: {cubiertos} cubiertos, {excl} excluidos con motivo, {len(brechas)} brechas "
               f"de {total} ({pct}%)")
    print(resumen + "\n")
    for b in brechas:
        print(f"[BRECHA] {b}")
    for x in avisos:
        print(f"[AVISO] {x}")
    if a.md:
        Path(a.md).write_text(f"# {titulo}\n\n{resumen}\n\n{cab}{cuerpo}\n" +
                              "".join(f"- BRECHA: {b}\n" for b in brechas) + "".join(f"- Aviso: {x}\n" for x in avisos),
                              encoding="utf-8")
    if a.json:
        Path(a.json).write_text(json.dumps({"resumen": resumen, "porcentaje": pct, "filas": filas,
                                            "brechas": brechas, "avisos": avisos}, ensure_ascii=False, indent=2),
                                encoding="utf-8")
    sys.exit(1 if brechas else 0)


if __name__ == "__main__":
    main()
