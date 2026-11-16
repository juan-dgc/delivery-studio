#!/usr/bin/env python3
"""Verificación determinista del context pack.

Revisa lo que se puede comprobar sin juicio: que existan todos los documentos, que tengan
frontmatter y todas las secciones de su plantilla, que no queden guías ni marcadores sin
llenar, que cada evidencia y pregunta citada exista, y cuenta las marcas de confianza.
También mide la profundidad: secciones delgadas y cuántos hechos de la evidencia (EV-NNN.N)
llegaron a algún documento del pack.

Uso: python3 .pipeline/scripts/check_pack.py [--docs a.md b.md] [--cobertura] [--json salida.json]
  --docs       revisa solo esos documentos (para cerrar una tanda)
  --cobertura  lista cada hecho de la evidencia que no se cita en ningún documento
Sale con código 1 si hay hallazgos BLOQUEANTES.
"""
import argparse
import json
import re
import sys
from pathlib import Path


AUTOMATICOS = {"active-context.md", "decisions.md", "open-questions.md", "context-pack-index.md"}
DOCS_NUEVOS = {"environments.md", "validation-tools.md", "test-severity-priority.md", "automation-standards.md"}
# Secciones agregadas en la versión 1.4: en un pack anterior su ausencia es aviso, no bloqueo.
SECCIONES_NUEVAS = {"Reglas recomendadas", "Restricciones y prohibiciones", "Ejemplos", "Excepciones",
                    "Inventario de módulos", "Tipos y archivos clave", "Convenciones observadas"}
# Secciones que pueden ser cortas sin que eso indique falta de profundidad.
SECCIONES_CORTAS = {"Propósito", "Historial", "Trazabilidad", "Excepciones", "Supuestos", "Pendientes",
                    "Reglas recomendadas", "Ejemplos", "Estado de esta política"}


from _raiz import raiz as _raiz_proyecto


def raiz():
    return _raiz_proyecto()


def secciones(texto):
    """Devuelve {titulo: contenido} de los encabezados de nivel 2."""
    partes = re.split(r"^## (.+)$", texto, flags=re.M)
    return {partes[i].strip(): partes[i + 1].strip() for i in range(1, len(partes) - 1, 2)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="Guarda los hallazgos en este archivo JSON")
    ap.add_argument("--docs", nargs="*", help="Revisa solo estos documentos")
    ap.add_argument("--cobertura", action="store_true", help="Lista los hechos de la evidencia sin citar")
    a = ap.parse_args()
    root = raiz()
    man = json.loads((root / ".pipeline" / "pipeline.json").read_text(encoding="utf-8"))
    cp = root / man["context_pack"]["carpeta"]
    plantillas = root / ".pipeline" / "plantillas" / "context-pack"
    evidencias = {m.group(1) for f in (root / "evidence").glob("EV-*.md")
                  if (m := re.match(r"(EV-\d+)", f.name))} if (root / "evidence").exists() else set()
    oq_txt = (cp / "open-questions.md").read_text(encoding="utf-8") if (cp / "open-questions.md").exists() else ""
    oqs = set(re.findall(r"^### (OQ-\d+):", oq_txt, re.M))
    dec_txt = (cp / "decisions.md").read_text(encoding="utf-8") if (cp / "decisions.md").exists() else ""
    decs = set(re.findall(r"^### (DEC-\d+):", dec_txt, re.M))

    hallazgos, resumen, delgadas = [], [], {}

    def h(nivel, doc, msg):
        hallazgos.append({"nivel": nivel, "documento": doc, "hallazgo": msg})

    nombres = [d["archivo"] for d in man["context_pack"]["documentos"]]
    plan = {}
    if (cp / "_plan.json").exists():
        plan = {d["archivo"]: d for d in json.loads((cp / "_plan.json").read_text(encoding="utf-8"))["documentos"]}
    solo = set(a.docs or [])
    parcial = False  # hay documentos sin generar: la cobertura todavía no es definitiva
    for nombre in nombres:
        f = cp / nombre
        if not f.exists():
            if nombre == "active-context.md":
                h("AVISO", nombre, "No existe: ejecuta 'pipeline.py status --write-active'.")
            elif plan and nombre not in plan and nombre not in AUTOMATICOS:
                if not solo:
                    h("AVISO", nombre, "No generado: quedó fuera de los perfiles elegidos. "
                                       f"Para sumarlo: pipeline.py pack plan --docs {nombre}")
            elif plan and nombre in plan and plan[nombre]["estado"] != "hecho":
                parcial = True
                if not solo:
                    h("AVISO", nombre, f"Pendiente: está en la tanda {plan[nombre]['tanda']} del plan.")
            elif nombre == "context-pack-index.md" and solo:
                pass
            elif nombre in DOCS_NUEVOS:
                h("AVISO", nombre, "Documento nuevo en la versión 1.4, aún no generado. "
                                   f"Genéralo con /delivery:generate-context-pack {nombre}")
            else:
                h("BLOQUEANTE", nombre, "El documento no existe.")
            continue
        if solo and nombre not in solo:
            continue
        if nombre in ("active-context.md", "decisions.md", "open-questions.md"):
            continue  # los mantiene pipeline.py; solo se verifican sus referencias desde otros documentos
        t = f.read_text(encoding="utf-8")
        if not t.startswith("---") or "when_to_read:" not in t.split("---", 2)[1]:
            h("BLOQUEANTE", nombre, "Falta el frontmatter con when_to_read.")
        for marca, msg in [(r"<!-- Guía", "quedaron comentarios de guía de la plantilla"),
                           (r"AAAA-MM-DD", "quedó la fecha de la plantilla sin llenar"),
                           (r"\{\{", "quedaron marcadores {{...}}"),
                           (r"\bTODO\b|\bTBD\b", "hay TODO o TBD")]:
            if re.search(marca, t):
                h("BLOQUEANTE", nombre, msg.capitalize() + ".")
        sec = secciones(t)
        tpl = plantillas / nombre
        if tpl.exists():
            for s in secciones(tpl.read_text(encoding="utf-8")):
                if s not in sec:
                    if s in SECCIONES_NUEVAS:
                        h("AVISO", nombre, f"Falta la sección '{s}' (agregada en la versión 1.4): "
                                           "se completa al regenerar el documento.")
                    else:
                        h("BLOQUEANTE", nombre, f"Falta la sección '{s}'.")
        for s, cuerpo in sec.items():
            limpio = re.sub(r"<!--.*?-->", "", cuerpo, flags=re.S).strip()
            if not limpio:
                h("BLOQUEANTE", nombre, f"La sección '{s}' está vacía (escribe 'No aplica: motivo' o un [POR CONFIRMAR]).")
            elif (s not in SECCIONES_CORTAS and nombre != "context-pack-index.md" and len(limpio) < 200
                  and not re.match(r"(No aplica|Ningun[ao])", limpio) and "[POR CONFIRMAR" not in limpio):
                delgadas.setdefault(nombre, []).append(s)
        traza = sec.get("Trazabilidad", "")
        if nombre != "context-pack-index.md" and not re.search(r"EV-\d+|DEC-\d+|OQ-\d+", traza):
            h("AVISO", nombre, "La trazabilidad no cita ninguna EV, DEC ni OQ.")
        for ev in sorted(set(re.findall(r"EV-\d+", t)) - evidencias):
            h("BLOQUEANTE", nombre, f"Cita {ev}, que no existe en evidence/.")
        for oq in sorted(set(re.findall(r"OQ-\d+", t)) - oqs):
            h("BLOQUEANTE", nombre, f"Cita {oq}, que no existe en open-questions.md.")
        for dc in sorted(set(re.findall(r"DEC-\d+", t)) - decs):
            h("BLOQUEANTE", nombre, f"Cita {dc}, que no existe en decisions.md.")
        sin_id = len(re.findall(r"\[POR CONFIRMAR\]", t))
        if sin_id:
            h("AVISO", nombre, f"{sin_id} marcas [POR CONFIRMAR] sin OQ asociada.")
        conf = len(re.findall(r"\[CONFIRMADO", t))
        inf = len(re.findall(r"\[INFERIDO", t))
        pend = len(re.findall(r"\[POR CONFIRMAR", t))
        total = conf + inf + pend
        if total and inf / total > 0.5:
            h("AVISO", nombre, f"Más de la mitad de las afirmaciones son inferidas ({inf} de {total}).")
        resumen.append({"documento": nombre, "confirmado": conf, "inferido": inf, "por_confirmar": pend,
                        "bytes": f.stat().st_size})

    for nombre, ss in delgadas.items():
        h("AVISO", nombre, f"Secciones delgadas (menos de 200 caracteres, sin 'No aplica' ni pregunta abierta): "
                           + ", ".join(ss) + ". Revisa si la evidencia tiene más detalle.")

    # Cobertura: qué hechos de la evidencia llegaron a algún documento
    todo_el_pack = ""
    for nombre in nombres + ["_no-incorporado.md"]:
        if (cp / nombre).exists():
            todo_el_pack += (cp / nombre).read_text(encoding="utf-8") + "\n"
    citadas = set(re.findall(r"EV-\d+", todo_el_pack))
    hechos_citados = set(re.findall(r"EV-\d+\.\d+", todo_el_pack))
    hechos, texto_hecho = {}, {}
    if (root / "evidence").exists():
        for f in sorted((root / "evidence").glob("EV-*.md")):
            for m in re.finditer(r"^\s*[-*] \*{0,2}(EV-\d+\.\d+)\*{0,2}:\s*(.*)$", f.read_text(encoding="utf-8"), re.M):
                hechos.setdefault(m.group(1).split(".")[0], []).append(m.group(1))
                texto_hecho[m.group(1)] = m.group(2).strip()
    cobertura = []
    for ev in sorted(hechos):
        ids = hechos[ev]
        faltan = [x for x in ids if x not in hechos_citados]
        cobertura.append({"evidencia": ev, "hechos": len(ids), "citados": len(ids) - len(faltan), "sin_citar": faltan})
    total_h = sum(c["hechos"] for c in cobertura)
    total_c = sum(c["citados"] for c in cobertura)
    if not solo:
        for ev in sorted(evidencias - citadas):
            h("AVISO", "evidence/", f"{ev} no se cita en ningún documento: revisa si su información quedó fuera del pack.")
        for c in cobertura:
            if c["sin_citar"] and c["evidencia"] in citadas:
                pct = 100 * c["citados"] // c["hechos"]
                h("AVISO", "evidence/", f"{c['evidencia']}: {len(c['sin_citar'])} de {c['hechos']} hechos sin citar ({pct}% cubierto). "
                                        "Incorpóralos o regístralos en context-pack/_no-incorporado.md con el motivo."
                                        + (" Cobertura parcial: faltan documentos por generar." if parcial else ""))

    idx = cp / "context-pack-index.md"
    if idx.exists():
        it = idx.read_text(encoding="utf-8")
        for nombre in nombres:
            if nombre != "context-pack-index.md" and nombre not in it:
                h("AVISO" if nombre in DOCS_NUEVOS and not (cp / nombre).exists() else "BLOQUEANTE",
                  "context-pack-index.md", f"El índice no menciona {nombre}.")

    bloq = [x for x in hallazgos if x["nivel"] == "BLOQUEANTE"]
    print(f"{'Documento':<26} {'CONF':>5} {'INF':>5} {'PEND':>5} {'KB':>6}")
    for r in resumen:
        print(f"{r['documento']:<26} {r['confirmado']:>5} {r['inferido']:>5} {r['por_confirmar']:>5} {r['bytes']/1024:>6.1f}")
    print(f"\nEvidencias en evidence/: {len(evidencias)} | OQ registradas: {len(oqs)} | Decisiones: {len(decs)}")
    if total_h:
        print(f"Cobertura de evidencia: {total_c} de {total_h} hechos citados ({100 * total_c // total_h}%)"
              + (" [parcial: faltan documentos del plan]" if parcial else ""))
    print(f"Hallazgos: {len(bloq)} bloqueantes, {len(hallazgos) - len(bloq)} avisos\n")
    for x in sorted(hallazgos, key=lambda x: (x["nivel"] != "BLOQUEANTE", x["documento"])):
        print(f"[{x['nivel']}] {x['documento']}: {x['hallazgo']}")
    if a.cobertura:
        print("\nHechos de la evidencia sin citar en el context pack:")
        for c in cobertura:
            for x in c["sin_citar"]:
                print(f"  {x}: {texto_hecho[x][:160]}")
        if total_h == total_c:
            print("  ninguno")
    if a.json:
        Path(a.json).write_text(json.dumps({"resumen": resumen, "hallazgos": hallazgos, "cobertura": cobertura}, ensure_ascii=False, indent=2),
                                encoding="utf-8")
    sys.exit(1 if bloq else 0)


if __name__ == "__main__":
    main()
