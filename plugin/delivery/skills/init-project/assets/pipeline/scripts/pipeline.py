#!/usr/bin/env python3
"""Estado del pipeline: corridas versionadas, decisiones, preguntas abiertas y fuentes.

Solo usa la biblioteca estándar de Python 3.8+. Ejecútalo desde cualquier carpeta del
proyecto; busca hacia arriba la carpeta que contiene .pipeline/pipeline.json.

Uso rápido:
  pipeline.py status [--write-active]
  pipeline.py check <paso>
  pipeline.py run new <paso> <alcance>
  pipeline.py run finish <carpeta> --estado COMPLETADO --entradas a.md b.md --oq OQ-001 --resumen "..."
  pipeline.py run latest <paso> [<alcance>]
  pipeline.py skip <paso> --motivo "..." | unskip <paso>
  pipeline.py decision list | get <clave> | set <clave> <valor> [--estado CONFIRMADA|PROPUESTA] [--origen ...] [--motivo ...] [--afecta ...]
  pipeline.py oq list [--estado ABIERTA] [--paso <paso>] | add ... | answer <OQ> --respuesta "..." | set <OQ> <estado> | show <OQ>
  pipeline.py sources list | sources mark <ruta> <EV-NNN>
  pipeline.py ids <US|EP|MOD|RN|...>
  pipeline.py run all-latest <paso> | run accept <carpeta> --motivo "..."
  pipeline.py diff-historias <historias-anterior.md> <historias-nueva.md>
  pipeline.py impacto [--md impacto.md] [--json impacto.json]
  pipeline.py alcance list | get <nombre> | set|add|remove <nombre> US-001..US-010 US-015 [--origen ...]
  pipeline.py raiz                                   carpeta raíz del proyecto (ruta absoluta)
  pipeline.py indice [carpeta]                       regenera outputs/INDICE.md e index.html; lista los archivos de una carpeta
  pipeline.py alcance contexto <nombre> [--json f]   dependencias y funcionalidades relacionadas fuera del lote
  pipeline.py alcance dependencias                   comprueba el orden de los lotes contra las dependencias
"""
import argparse
import os
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path

ESTADOS_RUN = {"EN_PROGRESO", "COMPLETADO", "PARCIAL", "FALLIDO"}
ESTADOS_OQ = {"ABIERTA", "RESPONDIDA", "INCORPORADA", "DESCARTADA"}
ESTADOS_DEC = {"CONFIRMADA", "PROPUESTA", "REEMPLAZADA"}
CAMPOS_OQ = ["estado", "impacto", "origen", "bloquea", "destino", "contexto", "sugerencia", "respuesta", "respondida"]
NO_RASTREAR = {"decisions.md", "open-questions.md", "active-context.md", "context-pack-index.md", "_meta.json", "progress.md"}
CAMPOS_DEC = ["valor", "estado", "origen", "motivo", "afecta", "fecha"]


# ---------------------------------------------------------------- utilidades
def ahora():
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def hoy():
    return dt.date.today().isoformat()


from _raiz import raiz as _raiz_proyecto


def raiz():
    return _raiz_proyecto()


ROOT = None


def R(*partes):
    return ROOT.joinpath(*partes)


def rel(p):
    try:
        return Path(p).resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return Path(p).as_posix()


def huella(p):
    p = R(p) if not Path(p).is_absolute() else Path(p)
    if not p.exists():
        return None
    if p.is_dir():
        h = hashlib.sha256()
        for f in sorted(x for x in p.rglob("*") if x.is_file() and x.name != "_meta.json"):
            h.update(rel(f).encode())
            h.update(f.read_bytes())
        return h.hexdigest()[:16]
    return hashlib.sha256(p.read_bytes()).hexdigest()[:16]


def manifiesto():
    return json.loads(R(".pipeline", "pipeline.json").read_text(encoding="utf-8"))


def pasos():
    return {p["id"]: p for p in manifiesto()["pasos"]}


def paso_o_salir(pid):
    ps = pasos()
    if pid not in ps:
        cands = [k for k in ps if k.startswith(pid) or pid in k]
        if len(cands) == 1:
            return ps[cands[0]]
        sys.exit(f"Paso desconocido: {pid}. Pasos: {', '.join(ps)}")
    return ps[pid]


def leer_json(p, defecto):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return defecto


def escribir_json(p, datos):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def una_linea(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


# ---------------------------------------------------------------- corridas
def bitacora(evento, detalle):
    """Agrega una línea a context-pack/progress.md, la bitácora del proyecto.

    La escriben los propios comandos (corridas, decisiones, preguntas, lotes) y las skills con
    'pipeline.py nota'. Nunca se reescribe: solo crece, agrupada por día.
    """
    import datetime
    f = carpeta_contexto() / "progress.md"
    try:
        f.parent.mkdir(parents=True, exist_ok=True)
        t = f.read_text(encoding="utf-8") if f.exists() else (
            "# Bitácora del proyecto\n\nHistorial de lo que se ha hecho, en orden. La escribe el pipeline; "
            "el estado actual está en active-context.md.\n")
        dia = f"## {hoy()}"
        if dia not in t:
            t = t.rstrip("\n") + f"\n\n{dia}\n"
        hora = datetime.datetime.now().strftime("%H:%M")
        t = t.rstrip("\n") + f"\n- {hora} | {evento} | {una_linea(detalle)}\n"
        f.write_text(t, encoding="utf-8")
    except OSError:
        pass  # la bitácora nunca debe hacer fallar un comando


def carpeta_contexto():
    return R(manifiesto()["context_pack"]["carpeta"])


def corridas(pid):
    """Lista de corridas de un paso: dicts con alcance, version, carpeta, meta."""
    out = []
    if pid == "00-context-pack":
        meta = leer_json(carpeta_contexto() / "_meta.json", None)
        if meta:
            out.append({"alcance": "proyecto", "version": meta.get("version", 1), "carpeta": carpeta_contexto(), "meta": meta})
        return out
    base = R("outputs", pid)
    if not base.exists():
        return out
    for alc in sorted(x for x in base.iterdir() if x.is_dir()):
        for v in alc.iterdir():
            m = re.fullmatch(r"v(\d+)", v.name)
            if v.is_dir() and m:
                out.append({"alcance": alc.name, "version": int(m.group(1)), "carpeta": v,
                            "meta": leer_json(v / "_meta.json", {"estado": "SIN_META"})})
    return sorted(out, key=lambda c: (c["alcance"], c["version"]))


def ultima(pid, alcance=None, solo_completadas=True):
    cs = [c for c in corridas(pid) if alcance in (None, c["alcance"])]
    if solo_completadas:
        cs = [c for c in cs if c["meta"].get("estado") == "COMPLETADO"]
    return cs[-1] if cs else None


RE_HISTORIAS = re.compile(r"outputs/02-user-stories/([^/]+)/v(\d+)/user-stories\.md$")


def bloques_historias(ruta):
    """{US-NNN: (titulo, huella del bloque, épica)} de un archivo de historias."""
    f = R(ruta) if not Path(ruta).is_absolute() else Path(ruta)
    if not f.exists():
        return {}
    texto = f.read_text(encoding="utf-8")
    out, epica = {}, ""
    for m in re.finditer(r"^## ((?:US|EP)-\d+):\s*(.*?)\n(.*?)(?=^## |\Z)", texto, re.S | re.M):
        ident, titulo, cuerpo = m.group(1), m.group(2).strip(), m.group(3)
        if ident.startswith("EP-"):
            epica = ident
            continue
        normal = re.sub(r"[ \t]+", " ", f"{titulo}\n{cuerpo}".strip())
        ep = re.search(r"^- épica:\s*(EP-\d+)", cuerpo, re.M | re.I)
        out[ident] = (titulo, hashlib.sha256(normal.encode()).hexdigest()[:12], ep.group(1) if ep else epica)
    return out


def comparar_historias(viejo, nuevo):
    """Devuelve (nuevas, modificadas, retiradas) entre dos dicts de bloques_historias o de huellas."""
    hv = {k: (v[1] if isinstance(v, (list, tuple)) else v) for k, v in viejo.items()}
    hn = {k: (v[1] if isinstance(v, (list, tuple)) else v) for k, v in nuevo.items()}
    nuevas = sorted(set(hn) - set(hv), key=lambda x: int(x[3:]))
    retiradas = sorted(set(hv) - set(hn), key=lambda x: int(x[3:]))
    modificadas = sorted((k for k in set(hv) & set(hn) if hv[k] != hn[k]), key=lambda x: int(x[3:]))
    return nuevas, modificadas, retiradas


def razones(meta, profundidad=0):
    """Motivos por los que un artefacto dejó de estar vigente, como lista de (tipo, texto).

    tipo 'duro': cambió algo que el artefacto usó de verdad (sus historias, una decisión, su alcance,
    otro artefacto). Hay que regenerar. tipo 'suave': solo cambió un documento del context pack;
    puede o no afectar, y el usuario decide (regenerar o marcar como revisado con 'run accept').
    """
    out = []
    vigentes = {i["titulo"]: i["id"] for i in leer_registro("decisions.md", "DEC", CAMPOS_DEC) if i["estado"] != "REEMPLAZADA"}
    if "alcance_historias" in meta:
        actual = historias_de(meta.get("alcance", ""))
        antes = set(meta["alcance_historias"])
        if actual is not None and set(actual) != antes:
            mas, menos = set(actual) - antes, antes - set(actual)
            out.append(("duro", f"cambió el alcance {meta['alcance']} (+{len(mas)} -{len(menos)} historias)"))
    for clave, dec in meta.get("decisiones_usadas", {}).items():
        if vigentes.get(clave) != dec:
            out.append(("duro", f"cambió la decisión {clave} ({dec} -> {vigentes.get(clave, 'ninguna')})"))
    cp = manifiesto()["context_pack"]["carpeta"] + "/"
    for e in meta.get("entradas", []):
        ruta = e["ruta"]
        mh = RE_HISTORIAS.search(ruta)
        if mh and "historias_usadas" in meta:
            # detección por historia: solo cuentan las historias que este artefacto usó
            u = ultima("02-user-stories", mh.group(1))
            destino = rel(u["carpeta"] / "user-stories.md") if u else ruta
            actuales = bloques_historias(destino)
            usadas = meta["historias_usadas"]
            _, modificadas, retiradas = comparar_historias(usadas, {k: v for k, v in actuales.items() if k in usadas})
            retiradas = [x for x in retiradas if x not in actuales]
            if modificadas or retiradas:
                lista = modificadas + retiradas
                out.append(("duro", f"cambiaron historias que usa: {', '.join(lista[:6])}{'...' if len(lista) > 6 else ''}"
                                    + (f" ({len(retiradas)} retiradas)" if retiradas else "")))
            if "alcance_historias" not in meta and meta.get("paso") != "02-user-stories":
                nuevas = [k for k in actuales if k not in usadas]
                if nuevas:
                    out.append(("duro", f"hay {len(nuevas)} historias nuevas en el backlog ({nuevas[0]}...)"))
            continue
        actual = huella(ruta)
        if actual is None:
            out.append(("duro", f"ya no existe {ruta}"))
            continue
        if actual != e.get("huella"):
            out.append(("suave" if ruta.startswith(cp) else "duro", f"cambió {ruta}"))
        m = re.match(r"outputs/([^/]+)/([^/]+)/v(\d+)/", ruta)
        if m:
            u = ultima(m.group(1), m.group(2))
            if u and u["version"] > int(m.group(3)):
                out.append(("duro", f"{m.group(1)}/{m.group(2)} tiene v{u['version']} (se usó v{m.group(3)})"))
            elif profundidad < 10:
                base = R("outputs", m.group(1), m.group(2), f"v{m.group(3)}", "_meta.json")
                if any(t == "duro" for t, _ in razones(leer_json(base, {}), profundidad + 1)):
                    out.append(("duro", f"depende de {m.group(1)}/{m.group(2)} v{m.group(3)}, que está desactualizado"))
    return out


def razones_desactualizado(meta, profundidad=0):
    return [t for _, t in razones(meta, profundidad)]


def estado_corrida(c):
    est = c["meta"].get("estado", "SIN_META")
    if est != "COMPLETADO":
        return est, []
    rz = razones(c["meta"])
    if any(t == "duro" for t, _ in rz):
        return "DESACTUALIZADO", rz
    if rz:
        return "POR_REVISAR", rz
    return "COMPLETADO", []


def estado_paso(p):
    pid = p["id"]
    if pid in leer_json(R(".pipeline", "state", "skipped.json"), {}):
        return "OMITIDO", []
    cs = corridas(pid)
    if not cs:
        return "NO_INICIADO", []
    por_alcance = {}
    for c in cs:
        por_alcance[c["alcance"]] = c
    detalle, estados = [], []
    for alc, c in sorted(por_alcance.items()):
        est, rz = estado_corrida(c)
        if rz:
            detalle.append(f"{alc} v{c['version']} {est.lower().replace('_', ' ')}: " + "; ".join(t for _, t in rz[:3]))
        else:
            detalle.append(f"{alc}: v{c['version']} {est}")
        estados.append(est)
    for prioridad in ["FALLIDO", "DESACTUALIZADO", "EN_PROGRESO", "PARCIAL", "POR_REVISAR", "SIN_META", "COMPLETADO"]:
        if prioridad in estados:
            return prioridad, detalle
    return estados[-1], detalle


def faltantes(pid, vistos=None):
    """Pasos obligatorios que faltan antes de pid, en orden de ejecución."""
    ps = pasos()
    vistos = vistos if vistos is not None else []
    for d in ps[pid]["depende_de"]:
        est, _ = estado_paso(ps[d])
        if est in ("COMPLETADO", "OMITIDO", "DESACTUALIZADO", "POR_REVISAR"):
            continue
        if ps[d]["opcional"] and est == "NO_INICIADO":
            continue
        if d == "00-context-pack" and est == "PARCIAL":
            continue
        faltantes(d, vistos)
        if d not in vistos:
            vistos.append(d)
    return vistos


def comando(pid):
    p = pasos()[pid]
    return f"{manifiesto().get('prefijo_comandos', '/')}{p['skill']}" if p.get("skill") else f"(sin skill: {pid})"


def cmd_run(a):
    if a.accion == "new":
        p = paso_o_salir(a.paso)
        alcance = re.sub(r"[^a-zA-Z0-9._-]+", "-", a.alcance or "proyecto").strip("-").lower()
        if p["id"] == "00-context-pack":
            sys.exit("El context pack no usa run new: escribe en context-pack/ y cierra con 'run finish context-pack'.")
        hermanos = [x.name for x in R("outputs", p["id"]).glob("*") if x.is_dir() and x.name != alcance] \
            if R("outputs", p["id"]).exists() else []
        if alcance not in ("acumulado", "proyecto"):
            lotes = [x for x in hermanos if x not in ("backlog", "acumulado", "proyecto")]
            if alcance == "backlog" and lotes:
                print(f"AVISO: {p['id']} ya tiene corridas por lote ({', '.join(sorted(lotes)[:5])}). Generarlo para todo el "
                      "backlog duplicaría artefactos con los mismos IDs. Confirma con el usuario antes de seguir; "
                      "para una vista de conjunto usa el alcance 'acumulado' si la skill lo ofrece.", file=sys.stderr)
            elif alcance != "backlog" and "backlog" in hermanos and p["id"] != "02-user-stories":
                print(f"AVISO: {p['id']} ya tiene una corrida para todo el backlog. Generarlo también para {alcance} "
                      "duplicaría artefactos con los mismos IDs. Confirma con el usuario antes de seguir.", file=sys.stderr)
        base = R("outputs", p["id"], alcance)
        n = max([int(x.name[1:]) for x in base.glob("v*") if re.fullmatch(r"v\d+", x.name)] or [0]) + 1
        carpeta = base / f"v{n}"
        carpeta.mkdir(parents=True)
        previa = base / f"v{n-1}" if n > 1 else None
        escribir_json(carpeta / "_meta.json", {
            "paso": p["id"], "alcance": alcance, "version": n, "estado": "EN_PROGRESO",
            "modo": "REGENERAR" if previa else "GENERAR", "version_previa": rel(previa) if previa else None,
            "inicio": ahora(), "fin": None, "entradas": [], "oq_creadas": [], "resumen": ""})
        print(rel(carpeta))
        if previa:
            print(f"Modo REGENERAR: la versión previa está en {rel(previa)}")
    elif a.accion == "finish":
        if a.estado not in ESTADOS_RUN - {"EN_PROGRESO"}:
            sys.exit("Estado inválido. Usa COMPLETADO, PARCIAL o FALLIDO.")
        carpeta = R(a.carpeta)
        es_cp = carpeta.resolve() == carpeta_contexto().resolve()
        meta = leer_json(carpeta / "_meta.json", {})
        if es_cp:
            meta = {"paso": "00-context-pack", "alcance": "proyecto",
                    "version": int(meta.get("version", 0)) + 1, "inicio": meta.get("inicio") or ahora()}
        if not meta:
            sys.exit(f"No hay _meta.json en {a.carpeta}. ¿Creaste la corrida con 'run new'?")
        entradas = []
        for e in a.entradas or []:
            if Path(e).name in NO_RASTREAR:
                continue  # cambian con cada pregunta o decisión; rastrearlos marcaría todo como desactualizado
            h = huella(e)
            if h is None:
                print(f"Aviso: la entrada {e} no existe; no se registra.", file=sys.stderr)
                continue
            entradas.append({"ruta": rel(R(e)), "huella": h})
        vigentes = {i["titulo"]: i["id"] for i in leer_registro("decisions.md", "DEC", CAMPOS_DEC) if i["estado"] != "REEMPLAZADA"}
        requeridas = pasos().get(meta.get("paso"), {}).get("decisiones_requeridas", [])
        meta["decisiones_usadas"] = {k: vigentes[k] for k in requeridas if k in vigentes}
        definicion = historias_de(meta.get("alcance", ""))
        if definicion is not None:
            meta["alcance_historias"] = definicion
        for e in entradas:
            if RE_HISTORIAS.search(e["ruta"]):
                bloques = bloques_historias(e["ruta"])
                ids = definicion if definicion is not None else list(bloques)
                meta["historias_usadas"] = {k: bloques[k][1] for k in ids if k in bloques}
        meta.update({"estado": a.estado, "fin": ahora(), "entradas": entradas,
                     "oq_creadas": a.oq or [], "resumen": una_linea(a.resumen)})
        if a.estado == "COMPLETADO":
            vacios = [f.name for f in carpeta.glob("*.md") if f.stat().st_size < 200]
            if vacios and not es_cp:
                print(f"Aviso: archivos casi vacíos: {', '.join(vacios)}", file=sys.stderr)
        escribir_json(carpeta / "_meta.json", meta)
        print(f"Corrida cerrada: {rel(carpeta)} -> {a.estado} ({len(entradas)} entradas registradas)")
        try:
            generar_indice()
            listar_para_enlazar(carpeta)
        except Exception as ex:
            print(f"Aviso: no se pudo actualizar el índice ({ex}).")
        bitacora(f"{meta.get('paso', '?')} {meta.get('alcance', '')} v{meta.get('version', '?')}".replace("  ", " "),
                 f"{a.estado}. {a.resumen or ''}" + (f" OQ: {', '.join(a.oq)}" if a.oq else ""))
        escribir_active_context(silencioso=True)
    elif a.accion == "latest":
        p = paso_o_salir(a.paso)
        u = ultima(p["id"], a.alcance)
        if not u:
            sys.exit(f"No hay corridas COMPLETADAS de {p['id']}" + (f" para {a.alcance}" if a.alcance else "")
                     + f". Ejecuta primero {comando(p['id'])}" + (f" {a.alcance}" if a.alcance else "") + ".")
        print(rel(u["carpeta"]))
    elif a.accion == "all-latest":
        p = paso_o_salir(a.paso)
        vistas = {}
        for c in corridas(p["id"]):
            if c["meta"].get("estado") == "COMPLETADO" and c["alcance"] not in ("acumulado",):
                vistas[c["alcance"]] = c
        if not vistas:
            sys.exit(f"No hay corridas COMPLETADAS de {p['id']}. Ejecuta primero {comando(p['id'])}.")
        for alc, c in sorted(vistas.items()):
            est, rz = estado_corrida(c)
            print(f"{rel(c['carpeta'])}\t{est}" + (f"\t{rz[0][1]}" if rz else ""))
    elif a.accion == "accept":
        carpeta = R(a.carpeta)
        meta = leer_json(carpeta / "_meta.json", None) or sys.exit(f"No hay _meta.json en {a.carpeta}")
        cp = manifiesto()["context_pack"]["carpeta"] + "/"
        renovadas = []
        for e in meta.get("entradas", []):
            h = huella(e["ruta"])
            if e["ruta"].startswith(cp) and h and h != e.get("huella"):
                e["huella"] = h
                renovadas.append(e["ruta"])
        meta.setdefault("revisiones", []).append({"fecha": ahora(), "motivo": una_linea(a.motivo), "documentos": renovadas})
        escribir_json(carpeta / "_meta.json", meta)
        duros = [t for t, x in razones(meta) if t == "duro"]
        print(f"{rel(carpeta)}: marcado como revisado ({len(renovadas)} documentos del context pack aceptados)."
              + (" Sigue DESACTUALIZADO por otros motivos: hay que regenerarlo." if duros else ""))


# ---------------------------------------------------------------- registros en markdown
def archivo_registro(nombre):
    return carpeta_contexto() / nombre


ENCABEZADOS = {
    "decisions.md": ("---\nwhen_to_read: |\n  Antes de elegir una herramienta, tecnología, formato o enfoque. Si la decisión ya existe aquí,\n"
                     "  úsala y no vuelvas a preguntarla.\n---\n\n# Registro de decisiones\n\n"
                     "Cada decisión tiene una clave estable (por ejemplo `automatizacion.framework`) que las skills consultan.\n"
                     "Estados: CONFIRMADA (la tomó el usuario o la evidencia), PROPUESTA (la sugirió una skill y falta validarla),\n"
                     "REEMPLAZADA (hay una más nueva). Este archivo lo mantiene `pipeline.py decision`; edítalo con cuidado.\n\n## Registro\n"),
    "open-questions.md": ("---\nwhen_to_read: |\n  Antes de generar o regenerar cualquier artefacto: revisa las preguntas abiertas que bloquean tu paso\n"
                          "  y las respondidas que todavía no se han incorporado.\n---\n\n# Preguntas abiertas\n\n"
                          "Estados: ABIERTA, RESPONDIDA (hay respuesta pero aún no se llevó al documento destino),\n"
                          "INCORPORADA (la respuesta ya vive en el documento destino), DESCARTADA.\n"
                          "Este archivo lo mantiene `pipeline.py oq` y la skill /delivery:open-questions.\n\n## Registro\n"),
}


def leer_registro(nombre, prefijo, campos):
    f = archivo_registro(nombre)
    if not f.exists():
        return []
    texto = f.read_text(encoding="utf-8")
    items = []
    for m in re.finditer(rf"^### ({prefijo}-\d+): (.*?)\n(.*?)(?=^### |\Z)", texto, re.S | re.M):
        d = {"id": m.group(1), "titulo": m.group(2).strip()}
        for c in campos:
            mm = re.search(rf"^- {c}:[ \t]*(.*)$", m.group(3), re.M)
            d[c] = mm.group(1).strip() if mm else ""
        items.append(d)
    return items


def escribir_registro(nombre, items, campos):
    f = archivo_registro(nombre)
    if f.exists():
        texto = f.read_text(encoding="utf-8")
        corte = texto.find("## Registro")
        cabeza = texto[:corte] + "## Registro\n" if corte >= 0 else texto.rstrip() + "\n\n## Registro\n"
    else:
        cabeza = ENCABEZADOS[nombre]
    cuerpo = "".join(
        f"\n### {it['id']}: {it['titulo']}\n" + "".join(f"- {c}: {it.get(c, '')}\n" for c in campos) for it in items)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(cabeza + cuerpo, encoding="utf-8")


def siguiente_id(items, prefijo):
    n = max([int(i["id"].split("-")[1]) for i in items] or [0]) + 1
    return f"{prefijo}-{n:03d}"


def cmd_decision(a):
    items = leer_registro("decisions.md", "DEC", CAMPOS_DEC)
    vigentes = {i["titulo"]: i for i in items if i["estado"] != "REEMPLAZADA"}
    if a.accion == "list":
        if not items:
            print("Sin decisiones registradas.")
        for i in items:
            print(f"{i['id']}  {i['titulo']} = {i['valor']}  [{i['estado']}]")
    elif a.accion == "get":
        i = vigentes.get(a.clave)
        if not i:
            print(f"FALTA {a.clave}")
            sys.exit(1)
        print(f"{i['valor']}  [{i['estado']}, {i['id']}]")
    elif a.accion == "set":
        if a.estado not in ESTADOS_DEC - {"REEMPLAZADA"}:
            sys.exit("Estado inválido: usa CONFIRMADA o PROPUESTA.")
        previa = vigentes.get(a.clave)
        if previa:
            if previa["valor"] == a.valor and previa["estado"] == a.estado:
                print(f"Sin cambios: {previa['id']} ya tiene ese valor.")
                return
            previa["estado"] = "REEMPLAZADA"
        nuevo = {"id": siguiente_id(items, "DEC"), "titulo": a.clave, "valor": una_linea(a.valor), "estado": a.estado,
                 "origen": una_linea(a.origen or "usuario"), "motivo": una_linea(a.motivo),
                 "afecta": una_linea(a.afecta), "fecha": hoy()}
        items.append(nuevo)
        escribir_registro("decisions.md", items, CAMPOS_DEC)
        print(f"{nuevo['id']} {a.clave} = {nuevo['valor']} [{a.estado}]" + (f" (reemplaza {previa['id']})" if previa else ""))
        bitacora("decisión", f"{nuevo['id']} {a.clave} = {nuevo['valor']} [{a.estado}]"
                 + (f", reemplaza {previa['id']} ({previa['valor']})" if previa else ""))


def cmd_oq(a):
    items = leer_registro("open-questions.md", "OQ", CAMPOS_OQ)
    por_id = {i["id"]: i for i in items}
    if a.accion == "list":
        sel = [i for i in items
               if (not a.estado or i["estado"] == a.estado)
               and (not a.paso or a.paso in i["bloquea"] or a.paso in i["origen"])]
        if not sel:
            print("Sin preguntas con ese filtro.")
        orden = {"alto": 0, "medio": 1, "bajo": 2}
        for i in sorted(sel, key=lambda x: (orden.get(x["impacto"], 3), x["id"])):
            print(f"{i['id']}  [{i['estado']}, impacto {i['impacto'] or '?'}, destino {i['destino'] or '?'}]  {i['titulo']}")
    elif a.accion == "show":
        i = por_id.get(a.id) or sys.exit(f"No existe {a.id}")
        print(f"{i['id']}: {i['titulo']}")
        for c in CAMPOS_OQ:
            print(f"  {c}: {i[c]}")
    elif a.accion == "add":
        if not a.pregunta:
            sys.exit("Falta --pregunta")
        dup = [i for i in items if i["estado"] in ("ABIERTA", "RESPONDIDA")
               and una_linea(i["titulo"]).lower() == una_linea(a.pregunta).lower()]
        if dup:
            print(f"Ya existe: {dup[0]['id']}")
            return
        nuevo = {"id": siguiente_id(items, "OQ"), "titulo": una_linea(a.pregunta), "estado": "ABIERTA",
                 "impacto": a.impacto or "medio", "origen": a.origen or "", "bloquea": a.bloquea or "",
                 "destino": a.destino or "", "contexto": una_linea(a.contexto), "sugerencia": una_linea(a.sugerencia),
                 "respuesta": "", "respondida": ""}
        items.append(nuevo)
        escribir_registro("open-questions.md", items, CAMPOS_OQ)
        print(nuevo["id"])
    elif a.accion == "answer":
        i = por_id.get(a.id) or sys.exit(f"No existe {a.id}")
        i.update({"respuesta": una_linea(a.respuesta), "estado": "RESPONDIDA", "respondida": hoy()})
        escribir_registro("open-questions.md", items, CAMPOS_OQ)
        print(f"{a.id} -> RESPONDIDA")
        bitacora("pregunta respondida", f"{a.id}: {i['titulo']} -> {a.respuesta}")
    elif a.accion == "set":
        if a.nuevo_estado not in ESTADOS_OQ:
            sys.exit(f"Estado inválido. Usa: {', '.join(sorted(ESTADOS_OQ))}")
        i = por_id.get(a.id) or sys.exit(f"No existe {a.id}")
        i["estado"] = a.nuevo_estado
        escribir_registro("open-questions.md", items, CAMPOS_OQ)
        print(f"{a.id} -> {a.nuevo_estado}")
        if a.nuevo_estado != "ABIERTA":
            bitacora("pregunta", f"{a.id} pasa a {a.nuevo_estado}: {i['titulo']}")


# ---------------------------------------------------------------- fuentes
def cmd_sources(a):
    reg_path = R("evidence", "_sources.json")
    reg = leer_json(reg_path, {})
    if a.accion == "list":
        entradas = R("inputs")
        archivos = sorted(f for f in entradas.rglob("*") if f.is_file() and not f.name.startswith(".")) if entradas.exists() else []
        nuevos = cambiados = 0
        for f in archivos:
            r, h = rel(f), huella(f)
            if r not in reg:
                print(f"NUEVO      {r}")
                nuevos += 1
            elif reg[r]["huella"] != h:
                print(f"CAMBIADO   {r}  (antes {reg[r]['evidencia']})")
                cambiados += 1
        for r in reg:
            if not R(r).exists() and not r.startswith(("repo:", "jira:", "url:")):
                print(f"ELIMINADO  {r}  ({reg[r]['evidencia']})")
        externas = [r for r in reg if r.startswith(("repo:", "jira:", "url:"))]
        print(f"\n{len(archivos)} archivos en inputs/: {nuevos} nuevos, {cambiados} cambiados. "
              f"Fuentes externas ya ingeridas: {len(externas)}.")
    elif a.accion == "mark":
        clave = a.ruta if a.ruta.startswith(("repo:", "jira:", "url:")) else rel(R(a.ruta))
        h = huella(a.ruta) if not clave.startswith(("repo:", "jira:", "url:")) else ahora()
        reg[clave] = {"huella": h, "evidencia": a.evidencia, "fecha": ahora()}
        escribir_json(reg_path, reg)
        print(f"{clave} -> {a.evidencia}")
        bitacora("fuente ingerida", f"{clave} -> {a.evidencia}")


# ---------------------------------------------------------------- alcances
ARCHIVO_ALCANCES = ("state", "alcances.json")


def expandir(items):
    """Convierte 'US-001..US-010', 'US-3', 'US-004,US-007' en una lista ordenada de IDs US-NNN."""
    out = set()
    for it in items:
        for parte in re.split(r"[,\s]+", it.strip()):
            if not parte:
                continue
            m = re.fullmatch(r"US-(\d+)\.\.(?:US-)?(\d+)", parte, re.I)
            if m:
                a, b = sorted((int(m.group(1)), int(m.group(2))))
                out |= {f"US-{n:03d}" for n in range(a, b + 1)}
            elif re.fullmatch(r"US-\d+", parte, re.I):
                out.add(f"US-{int(parte.split('-')[1]):03d}")
            else:
                sys.exit(f"No entiendo '{parte}'. Usa IDs como US-004 o rangos como US-001..US-010.")
    return sorted(out, key=lambda x: int(x.split("-")[1]))


def alcances():
    return leer_json(R(".pipeline", *ARCHIVO_ALCANCES), {})


def historias_de(alcance):
    a = alcances().get(alcance)
    return a["historias"] if a else None


def historias_detalle():
    """Todas las historias conocidas con sus relaciones: {US: {titulo, depende, modulo, epica, reglas, procesos}}.

    Parte del backlog y lo completa con las corridas de historias de cada lote (la más reciente manda).
    """
    vistas = {}
    for c in corridas("02-user-stories"):
        if c["meta"].get("estado") == "COMPLETADO":
            vistas[c["alcance"]] = c
    orden = (["backlog"] if "backlog" in vistas else []) + sorted(k for k in vistas if k != "backlog")
    out = {}
    for alc in orden:
        for arch in sorted(vistas[alc]["carpeta"].glob("*.md")):
            if arch.name.startswith("_"):
                continue
            texto = arch.read_text(encoding="utf-8")
            for m in re.finditer(r"^## (US-\d+):\s*(.*?)\n(.*?)(?=^## |\Z)", texto, re.S | re.M):
                cuerpo = m.group(3)

                def campo(nombre):
                    x = re.search(rf"^- {nombre}:\s*(.*)$", cuerpo, re.M | re.I)
                    return x.group(1) if x else ""
                out[m.group(1)] = {
                    "titulo": m.group(2).strip(),
                    "depende": sorted(set(re.findall(r"US-\d+", campo("depende de") + " " + campo("dependencias"))) - {m.group(1)}),
                    "modulo": sorted(set(re.findall(r"MOD-\d+", campo("módulo")))),
                    "epica": (re.findall(r"EP-\d+", campo("épica")) or [""])[0],
                    "reglas": sorted(set(re.findall(r"RN-\d+", campo("reglas")))),
                    "procesos": sorted(set(re.findall(r"PROC-\d+(?:\.\d+)?", campo("procesos")))),
                }
    return out


def lote_de_cada_historia():
    """{US: lote} y la posición de cada lote según el orden en que se registraron."""
    datos = alcances()
    posicion = {k: i for i, k in enumerate(datos)}
    return {us: k for k, v in datos.items() for us in v["historias"]}, posicion


def cmd_alcance_contexto(a):
    """Qué hay que mirar fuera de un lote para trabajarlo bien: dependencias, dependientes y funcionalidades relacionadas."""
    propias = historias_de(a.nombre)
    if propias is None:
        sys.exit(f"NO DEFINIDO {a.nombre}. Regístralo con: pipeline.py alcance set {a.nombre} US-001..US-010")
    det = historias_detalle()
    if not det:
        sys.exit("No hay historias generadas. Ejecuta primero /delivery:generate-user-stories.")
    lote, pos = lote_de_cada_historia()
    propias_set = set(propias)
    avisos, depende, dependientes, relacionadas = [], [], [], {}

    def donde(us):
        return lote.get(us, "sin lote")

    for us in propias:
        if us not in det:
            avisos.append(f"{us} está en el lote pero no existe en las historias generadas.")
            continue
        for d in det[us]["depende"]:
            if d in propias_set:
                continue
            if d not in det:
                avisos.append(f"{us} depende de {d}, que no existe en las historias.")
            elif d not in lote:
                avisos.append(f"{us} depende de {d}, que no está en ningún lote: no hay cuándo se construya ni se pruebe.")
                depende.append((us, d))
            else:
                if pos[lote[d]] > pos.get(a.nombre, -1):
                    avisos.append(f"ORDEN: {us} depende de {d}, que está en {lote[d]}, un lote posterior a {a.nombre}.")
                depende.append((us, d))
    for us, info in det.items():
        if us in propias_set:
            continue
        for d in info["depende"]:
            if d in propias_set:
                dependientes.append((us, d))
        # misma regla o mismo paso de proceso: la relación fuerte entre funcionalidades
        for mia in propias:
            if mia not in det:
                continue
            comun = sorted((set(info["reglas"]) & set(det[mia]["reglas"])) | (set(info["procesos"]) & set(det[mia]["procesos"])))
            if comun:
                r = relacionadas.setdefault(us, {"comparte": set(), "con": set()})
                r["comparte"] |= set(comun)
                r["con"].add(mia)
    mods = {m for us in propias if us in det for m in det[us]["modulo"]}
    mismo_modulo = sorted(us for us, info in det.items() if us not in propias_set and us not in relacionadas
                          and set(info["modulo"]) & mods)

    otros_lotes = sorted({donde(d) for _, d in depende} | {donde(u) for u, _ in dependientes}
                         | {donde(u) for u in relacionadas} - {"sin lote"}, key=lambda k: pos.get(k, 999))
    otros_lotes = [k for k in otros_lotes if k != "sin lote" and k != a.nombre]
    artefactos = {}
    for k in otros_lotes:
        for p in manifiesto()["pasos"]:
            if p["alcance"] != "lote" or p["id"] == "02-user-stories":
                continue
            cs = [c for c in corridas(p["id"]) if c["alcance"] == k and c["meta"].get("estado") in ("COMPLETADO", "PARCIAL")]
            if cs:
                artefactos.setdefault(k, []).append(rel(cs[-1]["carpeta"]))

    if a.json:
        escribir_json(Path(a.json), {
            "lote": a.nombre, "historias": propias,
            "depende_de": [{"historia": u, "de": d, "lote": donde(d)} for u, d in depende],
            "dependen_de_este_lote": [{"historia": u, "de": d, "lote": donde(u)} for u, d in dependientes],
            "relacionadas": [{"historia": u, "lote": donde(u), "comparte": sorted(r["comparte"]), "con": sorted(r["con"])}
                             for u, r in sorted(relacionadas.items())],
            "mismo_modulo": mismo_modulo, "artefactos_de_otros_lotes": artefactos, "avisos": avisos})
    print(f"Lote {a.nombre}: {len(propias)} historias ({', '.join(propias)})\n")
    print("1. SE TRABAJAN (se leen completas y se producen artefactos): las historias del lote.\n")
    print("2. DE REFERENCIA (se leen, no se producen artefactos para ellas):")
    print("   a) Historias de las que este lote depende:")
    for u, d in depende:
        print(f"      {u} depende de {d} [{donde(d)}] {det.get(d, {}).get('titulo', '')}")
    if not depende:
        print("      ninguna fuera del lote")
    print("   b) Historias de otros lotes que dependen de este (lo que cambie aquí puede afectarlas):")
    for u, d in dependientes:
        print(f"      {u} [{donde(u)}] depende de {d}: {det[u]['titulo']}")
    if not dependientes:
        print("      ninguna")
    print("   c) Funcionalidades relacionadas (comparten una regla de negocio o un paso de proceso):")
    for u, r in sorted(relacionadas.items()):
        print(f"      {u} [{donde(u)}] comparte {', '.join(sorted(r['comparte']))} con {', '.join(sorted(r['con']))}: {det[u]['titulo']}")
    if not relacionadas:
        print("      ninguna")
    if mismo_modulo:
        print(f"   d) Mismo módulo, sin regla ni proceso en común ({len(mismo_modulo)}): {', '.join(mismo_modulo[:30])}"
              + (" ..." if len(mismo_modulo) > 30 else ""))
        print("      Solo consúltalas si una historia del lote toca la misma pantalla o el mismo dato.")
    print("\n3. ARTEFACTOS DE OTROS LOTES A CONSULTAR para esas historias de referencia:")
    for k, rutas in artefactos.items():
        print(f"   {k}:")
        for r in rutas:
            print(f"      {r}")
    if not artefactos:
        print("   ninguno todavía")
    print("\n4. NO SE LEE: el resto del backlog y los artefactos de los demás lotes.")
    if avisos:
        print("\nAVISOS:")
        for x in avisos:
            print(f"   - {x}")


def cmd_alcance_dependencias(a):
    """Revisa el orden de todos los lotes contra las dependencias entre historias."""
    det = historias_detalle()
    if not det:
        sys.exit("No hay historias generadas. Ejecuta primero /delivery:generate-user-stories.")
    lote, pos = lote_de_cada_historia()
    problemas, avisos = [], []
    con_dep = sum(1 for i in det.values() if i["depende"])
    for us, info in sorted(det.items()):
        for d in info["depende"]:
            if d not in det:
                problemas.append(f"{us} depende de {d}, que no existe.")
            elif us in lote and d not in lote:
                problemas.append(f"{us} ({lote[us]}) depende de {d}, que no está en ningún lote.")
            elif us in lote and pos[lote[d]] > pos[lote[us]]:
                problemas.append(f"{us} ({lote[us]}) depende de {d}, que está en un lote posterior ({lote[d]}).")
    # ciclos
    estado = {}

    def visitar(u, camino):
        estado[u] = 1
        for d in det.get(u, {}).get("depende", []):
            if estado.get(d) == 1:
                ciclo = camino[camino.index(d):] + [d] if d in camino else [u, d]
                problemas.append("Dependencia circular: " + " -> ".join(ciclo))
            elif d in det and d not in estado:
                visitar(d, camino + [d])
        estado[u] = 2
    for u in sorted(det):
        if u not in estado:
            visitar(u, [u])
    sin_lote = sorted(u for u in det if u not in lote)
    if con_dep == 0:
        avisos.append("Ninguna historia declara '- depende de:'. Si las hay, regenera las historias para que queden registradas.")
    if sin_lote and lote:
        avisos.append(f"{len(sin_lote)} historias sin lote: {', '.join(sin_lote[:20])}" + (" ..." if len(sin_lote) > 20 else ""))
    print(f"{len(det)} historias, {con_dep} con dependencias, {len(alcances())} lotes.")
    for x in problemas:
        print(f"[PROBLEMA] {x}")
    for x in avisos:
        print(f"[AVISO] {x}")
    if not problemas:
        print("El orden de los lotes respeta las dependencias.")
    sys.exit(1 if problemas else 0)


def cmd_alcance(a):
    if a.accion == "contexto":
        return cmd_alcance_contexto(a)
    if a.accion == "dependencias":
        return cmd_alcance_dependencias(a)
    datos = alcances()
    if a.accion == "list":
        if not datos:
            print("Sin alcances definidos. Los alcances 'proyecto' y 'backlog' no necesitan definición.")
        for k, v in datos.items():
            h = v["historias"]
            print(f"{k:<16} {len(h):>3} historias ({h[0]} a {h[-1]})  origen: {v.get('origen', '?')}  {v.get('fecha', '')}")
    elif a.accion == "get":
        h = historias_de(a.nombre)
        if h is None:
            print(f"NO DEFINIDO {a.nombre}")
            sys.exit(1)
        print(" ".join(h))
    elif a.accion in ("set", "add", "remove"):
        nombre = re.sub(r"[^a-zA-Z0-9._-]+", "-", a.nombre).strip("-").lower()
        if nombre in ("proyecto", "backlog", "acumulado"):
            sys.exit(f"'{nombre}' es un alcance reservado: no se define con una lista.")
        nuevos = expandir(a.items)
        previas = set(datos.get(nombre, {}).get("historias", []))
        if a.accion == "set":
            final = set(nuevos)
        elif a.accion == "add":
            final = previas | set(nuevos)
        else:
            final = previas - set(nuevos)
        otros = {x: k for k, v in datos.items() if k != nombre for x in v["historias"]}
        repetidas = sorted(x for x in final if x in otros)
        if repetidas and not a.permitir_repetidas:
            sys.exit("Estas historias ya están en otro alcance: " + ", ".join(f"{x} ({otros[x]})" for x in repetidas[:10])
                     + ". Usa --permitir-repetidas si es intencional.")
        datos[nombre] = {"historias": sorted(final, key=lambda x: int(x.split("-")[1])),
                         "origen": una_linea(a.origen or "usuario"), "fecha": hoy()}
        escribir_json(R(".pipeline", *ARCHIVO_ALCANCES), datos)
        cambio = len(final) - len(previas)
        print(f"{nombre}: {len(final)} historias ({'+' if cambio >= 0 else ''}{cambio}). "
              + ("Los artefactos de este alcance quedarán DESACTUALIZADOS." if previas and final != previas else ""))
        orden = sorted(final)
        bitacora("lote", f"{nombre}: {len(orden)} historias ({'+' if cambio >= 0 else ''}{cambio}), {orden[0]} a {orden[-1]}" if orden
                 else f"{nombre}: vacío")


# ---------------------------------------------------------------- comparación de backlog e impacto
def lote_de(us):
    return [k for k, v in alcances().items() if us in v["historias"]]


def diff_backlog(ruta_a, ruta_b):
    a, b = bloques_historias(ruta_a), bloques_historias(ruta_b)
    nuevas, modificadas, retiradas = comparar_historias(a, b)
    texto_b = R(ruta_b).read_text(encoding="utf-8") if R(ruta_b).exists() else ""
    for k in list(modificadas):
        bloque = re.search(rf"^## {k}:.*?(?=^## |\Z)", texto_b, re.S | re.M)
        if bloque and re.search(r"retirad[ao] en v\d", bloque.group(0), re.I):
            modificadas.remove(k)
            retiradas.append(k)
    return a, b, nuevas, modificadas, sorted(retiradas, key=lambda x: int(x[3:]))


def estimacion(ruta, us):
    texto = R(ruta).read_text(encoding="utf-8") if R(ruta).exists() else ""
    bloque = re.search(rf"^## {us}:.*?(?=^## |\Z)", texto, re.S | re.M)
    m = re.search(r"^- estimación:\s*(.+)$", bloque.group(0), re.M | re.I) if bloque else None
    return m.group(1).strip() if m else "sin estimar"


def cmd_diff(a):
    _, b, nuevas, modificadas, retiradas = diff_backlog(a.anterior, a.nueva)
    for titulo, lista in [("Nuevas", nuevas), ("Modificadas", modificadas), ("Retiradas", retiradas)]:
        print(f"{titulo}: {len(lista)}")
        for k in lista:
            lote = ", ".join(lote_de(k)) or "sin lote"
            nombre = b[k][0] if k in b else ""
            print(f"  {k}  {nombre[:60]}  [{lote}]")


def cmd_impacto(a):
    lineas = ["# Impacto del cambio", "", f"Generado: {ahora()}", ""]
    datos = {"backlog": None, "context_pack": {}, "artefactos": [], "historias_sin_lote": []}
    vers = sorted([c for c in corridas("02-user-stories") if c["alcance"] == "backlog"
                   and c["meta"].get("estado") == "COMPLETADO"], key=lambda c: c["version"])
    if len(vers) >= 2:
        va, vb = vers[-2], vers[-1]
        ra, rb = rel(va["carpeta"] / "user-stories.md"), rel(vb["carpeta"] / "user-stories.md")
        _, b, nuevas, modificadas, retiradas = diff_backlog(ra, rb)
        datos["backlog"] = {"de": ra, "a": rb, "nuevas": nuevas, "modificadas": modificadas, "retiradas": retiradas}
        lineas += [f"## Backlog: v{va['version']} -> v{vb['version']}", "",
                   f"- Nuevas: {len(nuevas)} | modificadas: {len(modificadas)} | retiradas: {len(retiradas)}", "",
                   "| Historia | Cambio | Lote | Estimación | Título |", "|---|---|---|---|---|"]
        for tipo, lista in [("nueva", nuevas), ("modificada", modificadas), ("retirada", retiradas)]:
            for k in lista:
                lineas.append(f"| {k} | {tipo} | {', '.join(lote_de(k)) or 'sin lote'} | {estimacion(rb, k)} | "
                              f"{(b[k][0] if k in b else '')[:60]} |")
        datos["historias_sin_lote"] = [k for k in b if not lote_de(k)] if alcances() else []
        lineas.append("")
    else:
        lineas += ["## Backlog", "", "Solo hay una versión del backlog: no hay cambios de historias que comparar.", ""]
    por_doc = {}
    filas = []
    for p in manifiesto()["pasos"]:
        vistos = {}
        for c in corridas(p["id"]):
            vistos[c["alcance"]] = c
        for alc, c in sorted(vistos.items()):
            est, rz = estado_corrida(c)
            if est in ("DESACTUALIZADO", "POR_REVISAR"):
                filas.append((p["id"], alc, c["version"], est, rz))
                datos["artefactos"].append({"paso": p["id"], "alcance": alc, "version": c["version"], "estado": est,
                                            "skill": comando(p["id"]), "razones": [t for _, t in rz]})
                for tipo, t in rz:
                    m = re.match(r"cambió (context-pack/\S+)", t)
                    if m:
                        por_doc.setdefault(m.group(1), []).append(f"{p['id']}/{alc}")
    datos["context_pack"] = por_doc
    lineas += ["## Documentos del context pack que cambiaron", ""]
    lineas += [f"- {d}: afecta {len(v)} artefactos ({', '.join(v[:6])}{'...' if len(v) > 6 else ''})" for d, v in sorted(por_doc.items())] \
        or ["- ninguno"]
    lineas += ["", "## Artefactos afectados, en orden de regeneración", "",
               "| # | Paso | Alcance | Versión | Estado | Skill | Motivo |", "|---|---|---|---|---|---|---|"]
    for i, (pid, alc, v, est, rz) in enumerate(filas, 1):
        cmd = comando(pid) + ("" if alc == "proyecto" else f" {alc}")
        lineas.append(f"| {i} | {pid} | {alc} | v{v} | {est} | `{cmd}` | {'; '.join(t for _, t in rz)[:120]} |")
    if not filas:
        lineas.append("| - | ninguno | | | | | |")
    if datos["historias_sin_lote"]:
        lineas += ["", f"## Historias sin lote asignado: {len(datos['historias_sin_lote'])}", "",
                   ", ".join(datos["historias_sin_lote"][:40])]
    salida = "\n".join(lineas) + "\n"
    if a.md:
        Path(a.md).write_text(salida, encoding="utf-8")
    if a.json:
        Path(a.json).write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(salida if not a.md else f"Impacto escrito en {a.md}")


# ---------------------------------------------------------------- IDs
def cmd_ids(a):
    """Mayor ID usado de un prefijo (US, EP, MOD, RN...) en outputs/ y context-pack/, y el siguiente libre."""
    pref = a.prefijo.upper().rstrip("-")
    usados = set()
    for carpeta in [R("outputs"), carpeta_contexto()]:
        if carpeta.exists():
            for f in carpeta.rglob("*.md"):
                usados |= {int(n) for n in re.findall(rf"\b{pref}-(\d+)\b", f.read_text(encoding="utf-8", errors="ignore"))}
    ultimo = max(usados or [0])
    ancho = 2 if pref in ("EP", "MOD", "R") else 3
    print(f"último: {pref}-{ultimo:0{ancho}d} | siguiente: {pref}-{ultimo + 1:0{ancho}d} | usados: {len(usados)}")


# ---------------------------------------------------------------- status / check
def documentos_flojos(nombres):
    out = []
    for n in nombres:
        f = carpeta_contexto() / n
        if not f.exists():
            out.append(f"{n} (no existe: genéralo con /delivery:generate-context-pack {n})")
            continue
        t = f.read_text(encoding="utf-8")
        pend = len(re.findall(r"\[POR CONFIRMAR", t))
        if re.search(r"^estado:\s*esqueleto", t, re.M):
            out.append(f"{n} (esqueleto)")
        elif pend >= 5:
            out.append(f"{n} ({pend} puntos por confirmar)")
    return out


def cmd_check(a):
    p = paso_o_salir(a.paso)
    ps = pasos()
    print(f"Preflight de {p['id']}: {p['nombre']}")
    print(f"  alcance: {p['alcance']} | opcional: {'sí' if p['opcional'] else 'no'} | efectos reales: {'sí' if p['efectos_reales'] else 'no'}")
    bloqueos = 0
    print("\nDependencias:")
    if not p["depende_de"]:
        print("  ninguna")
    for d in p["depende_de"]:
        est, det = estado_paso(ps[d])
        if est == "COMPLETADO":
            marca = "ok"
        elif est == "OMITIDO":
            marca = "omitido por decisión del usuario"
        elif est == "DESACTUALIZADO":
            marca = "AVISO: se puede usar, pero heredarás información vieja"
        elif est == "POR_REVISAR":
            marca = "AVISO: cambió el context pack desde que se generó; revisa si sigue vigente"
        elif ps[d]["opcional"] and est == "NO_INICIADO":
            marca = "opcional, no ejecutado"
        elif d == "00-context-pack" and est == "PARCIAL":
            marca = "AVISO: el context pack tiene tandas pendientes; mira abajo si ya existen los documentos que lee este paso"
        else:
            marca = "PENDIENTE"
            bloqueos += 1
        print(f"  {d}: {est} ({marca})")
        for x in det:
            if "desactualizado" in x or "por revisar" in x:
                print(f"      {x}")
        u = ultima(d)
        if u:
            print(f"      última versión: {rel(u['carpeta'])}")
    print("\nContext pack que lee este paso:")
    flojos = documentos_flojos(p["lee_context_pack"])
    print("  " + ", ".join(p["lee_context_pack"]) if p["lee_context_pack"] else "  (ninguno específico)")
    for f in flojos:
        print(f"  atención: {f}")
    docs_faltan = [n for n in p["lee_context_pack"] if not (carpeta_contexto() / n).exists()]
    print("\nDecisiones requeridas:")
    decs = {i["titulo"]: i for i in leer_registro("decisions.md", "DEC", CAMPOS_DEC) if i["estado"] != "REEMPLAZADA"}
    faltan = []
    for k in p["decisiones_requeridas"]:
        if k in decs:
            print(f"  {k} = {decs[k]['valor']} [{decs[k]['estado']}]")
        else:
            print(f"  {k}: FALTA, hay que preguntarla")
            faltan.append(k)
    if not p["decisiones_requeridas"]:
        print("  ninguna")
    print("\nPreguntas abiertas que afectan este paso:")
    oqs = [i for i in leer_registro("open-questions.md", "OQ", CAMPOS_OQ)
           if (p["id"] in i["bloquea"] or p["id"] in i["origen"]) and i["estado"] in ("ABIERTA", "RESPONDIDA")]
    for i in oqs:
        print(f"  {i['id']} [{i['estado']}, {i['impacto']}] {i['titulo']}")
    if not oqs:
        print("  ninguna")
    respondidas = [i for i in oqs if i["estado"] == "RESPONDIDA"]
    previa = ultima(p["id"], None, solo_completadas=False)
    print("\nModo sugerido: " + ("REGENERAR (ya hay versiones previas)" if previa else "GENERAR (primera vez)"))
    if respondidas:
        print(f"Hay {len(respondidas)} respuestas sin incorporar: corre /delivery:open-questions para llevarlas al context pack antes de regenerar.")
    print("\nResultado: " + ("LISTO" if not bloqueos else f"BLOQUEADO por {bloqueos} dependencia(s)")
          + (f"; faltan {len(faltan)} decisión(es) por preguntar" if faltan else ""))
    if docs_faltan and (carpeta_contexto() / "_meta.json").exists():
        print(f"Faltan {len(docs_faltan)} documento(s) del context pack que este paso lee. Genéralos antes con:")
        print("  /delivery:generate-context-pack " + " ".join(docs_faltan))
    orden = faltantes(p["id"])
    if orden:
        print("Ejecuta primero, en este orden:")
        for i, d in enumerate(orden, 1):
            print(f"  {i}. {comando(d)}  ({pasos()[d]['nombre']})")


def cmd_status(a):
    ps = manifiesto()["pasos"]
    print(f"{'Paso':<26} {'Estado':<15} Detalle")
    print("-" * 90)
    listos = []
    estados = {}
    for p in ps:
        est, det = estado_paso(p)
        estados[p["id"]] = est
        etiqueta = p["id"] + (" (opc.)" if p["opcional"] else "")
        print(f"{etiqueta:<26} {est:<15} {'; '.join(det)[:90]}")
    for p in ps:
        if estados[p["id"]] in ("NO_INICIADO", "DESACTUALIZADO", "POR_REVISAR", "PARCIAL", "FALLIDO"):
            ok = all(estados[d] in ("COMPLETADO", "OMITIDO", "DESACTUALIZADO", "POR_REVISAR") or (pasos()[d]["opcional"] and estados[d] == "NO_INICIADO")
                     for d in p["depende_de"])
            if ok:
                listos.append(p)
    oqs = leer_registro("open-questions.md", "OQ", CAMPOS_OQ)
    abiertas = [i for i in oqs if i["estado"] == "ABIERTA"]
    resp = [i for i in oqs if i["estado"] == "RESPONDIDA"]
    print(f"\nPreguntas abiertas: {len(abiertas)} (alto impacto: {sum(1 for i in abiertas if i['impacto'] == 'alto')}); "
          f"respondidas sin incorporar: {len(resp)}")
    defs = alcances()
    if defs:
        print("Alcances definidos: " + "; ".join(f"{k} ({len(v['historias'])} historias)" for k, v in defs.items()))
    props = [i for i in leer_registro("decisions.md", "DEC", CAMPOS_DEC) if i["estado"] == "PROPUESTA"]
    if props:
        print(f"Decisiones PROPUESTAS por validar: {', '.join(i['titulo'] for i in props)}")
    print("\nSe pueden ejecutar ahora:")
    for p in listos:
        skill = f"{manifiesto().get('prefijo_comandos', '/')}{p['skill']}" if p["skill"] else "(skill aún no creada)"
        print(f"  {p['id']:<26} {skill}  [{estados[p['id']]}]")
    if not listos:
        print("  nada: revisa bloqueos arriba")
    if a.write_active:
        escribir_active_context()


def escribir_active_context(silencioso=False):
    if not carpeta_contexto().exists():
        return
    ps = manifiesto()["pasos"]
    filas = []
    for p in ps:
        est, det = estado_paso(p)
        if est != "NO_INICIADO":
            u = ultima(p["id"])
            filas.append(f"| {p['id']} | {est} | {rel(u['carpeta']) if u else '-'} |")
    oqs = leer_registro("open-questions.md", "OQ", CAMPOS_OQ)
    altas = [i for i in oqs if i["estado"] == "ABIERTA" and i["impacto"] == "alto"]
    decs = [i for i in leer_registro("decisions.md", "DEC", CAMPOS_DEC) if i["estado"] != "REEMPLAZADA"]
    txt = ["---", "when_to_read: |", "  Al empezar cualquier sesión: resume en qué va el proyecto. Lo genera pipeline.py, no lo edites a mano.",
           f"actualizado: {ahora()}", "---", "", "# Contexto activo", "", "## Estado de los pasos", "",
           "| Paso | Estado | Última versión completada |", "|---|---|---|", *(filas or ["| (ninguno) | - | - |"]), "",
           "## Preguntas abiertas de alto impacto", ""]
    txt += [f"- {i['id']}: {i['titulo']} (bloquea: {i['bloquea'] or '?'})" for i in altas] or ["- ninguna"]
    txt += ["", "## Decisiones vigentes", ""]
    txt += [f"- {i['titulo']} = {i['valor']} [{i['estado']}]" for i in decs] or ["- ninguna"]
    (carpeta_contexto() / "active-context.md").write_text("\n".join(txt) + "\n", encoding="utf-8")
    if not silencioso:
        print("\nactive-context.md actualizado.")


def cmd_skip(a, omitir=True):
    p = paso_o_salir(a.paso)
    f = R(".pipeline", "state", "skipped.json")
    s = leer_json(f, {})
    if omitir:
        if not p["opcional"]:
            print(f"Aviso: {p['id']} no es opcional; los pasos que dependen de él quedarán sin su insumo.", file=sys.stderr)
        s[p["id"]] = {"motivo": una_linea(a.motivo), "fecha": hoy()}
    else:
        s.pop(p["id"], None)
    escribir_json(f, s)
    print(f"{p['id']} {'OMITIDO' if omitir else 'reactivado'}")
    bitacora("paso omitido" if omitir else "paso reactivado", f"{p['id']}" + (f": {a.motivo}" if omitir else ""))


# ---------------------------------------------------------------- CLI
# ---------------------------------------------------------------- plan del context pack

DOCS_AUTOMATICOS = {"active-context.md", "decisions.md", "open-questions.md", "context-pack-index.md"}


def ruta_plan():
    return carpeta_contexto() / "_plan.json"


def docs_del_pack():
    """Documentos que escribe generate-context-pack, en el orden del manifiesto."""
    return [d["archivo"] for d in manifiesto()["context_pack"]["documentos"] if d["archivo"] not in DOCS_AUTOMATICOS]


def docs_de_perfil(perfil):
    """Anclas más los documentos que leen los pasos del perfil que no están omitidos."""
    cp = manifiesto()["context_pack"]
    omitidos = set(leer_json(R(".pipeline", "state", "skipped.json"), {}))
    necesarios = set(cp.get("anclas", []))
    ps = pasos()
    for pid in perfil["pasos"]:
        if pid in ps and pid not in omitidos:
            necesarios |= set(ps[pid]["lee_context_pack"])
    return [d for d in docs_del_pack() if d in necesarios]


def evidencias_por_documento():
    """Lee 'Temas para el context pack' de cada evidencia: {documento: [EV-NNN, ...]}."""
    mapa = {}
    carpeta = R("evidence")
    if not carpeta.exists():
        return mapa
    for f in sorted(carpeta.glob("EV-*.md")):
        m = re.match(r"(EV-\d+)", f.name)
        t = f.read_text(encoding="utf-8")
        bloque = re.search(r"^## Temas para el context pack\s*\n(.*?)(?=^## |\Z)", t, re.M | re.S)
        if not m or not bloque:
            continue
        for doc in set(re.findall(r"[\w-]+\.md", bloque.group(1))):
            mapa.setdefault(doc, []).append(m.group(1))
    return mapa


def cmd_pack(a):
    cp = manifiesto()["context_pack"]
    perfiles = {p["id"]: p for p in cp.get("perfiles", [])}
    todos = docs_del_pack()
    plan = leer_json(ruta_plan(), {"perfiles": [], "documentos": [], "creado": hoy()})
    por_doc = {d["archivo"]: d for d in plan["documentos"]}
    ev = evidencias_por_documento()

    def existe(doc):
        return (carpeta_contexto() / doc).exists()

    if a.accion == "perfiles":
        print("Perfiles de actividad y los documentos que necesita cada uno:\n")
        for p in perfiles.values():
            ds = docs_de_perfil(p)
            print(f"{p['id']}: {p['nombre']} ({len(ds)} documentos)")
            print("  pasos: " + ", ".join(p["pasos"]))
            print("  documentos: " + ", ".join(ds))
        print(f"\ntodo: los {len(todos)} documentos")
        sin_ev = [d for d in todos if d not in ev]
        if sin_ev:
            print("\nSin evidencia que los alimente (quedarían delgados): " + ", ".join(sin_ev))
        return

    if a.accion == "plan":
        pedidos = []
        if a.todo:
            pedidos = list(todos)
            plan["perfiles"] = ["todo"]
        for pid in (a.perfiles or "").split(","):
            pid = pid.strip()
            if not pid:
                continue
            if pid not in perfiles:
                sys.exit(f"Perfil desconocido: {pid}. Perfiles: {', '.join(perfiles)}")
            pedidos += docs_de_perfil(perfiles[pid])
            if pid not in plan["perfiles"]:
                plan["perfiles"].append(pid)
        for d in a.docs or []:
            if d not in todos:
                sys.exit(f"{d} no es un documento del context pack. Documentos: {', '.join(todos)}")
            pedidos.append(d)
        if not pedidos:
            sys.exit("Indica --perfiles a,b, --todo o --docs documento.md ...")
        # las anclas siempre van primero
        pedidos = [d for d in todos if d in set(pedidos) | set(cp.get("anclas", []))]
        nuevos = [d for d in pedidos if d not in por_doc or (a.rehacer and d in (a.docs or []))]
        tam = a.tanda or cp.get("tanda_max", 5)
        if nuevos:  # tandas parejas: 16 documentos van en 4 de 4, no en 3 de 5 y una de 1
            cuantas = -(-len(nuevos) // tam)
            tam = -(-len(nuevos) // cuantas)
        base = max([d["tanda"] for d in plan["documentos"]], default=0)
        for d in a.docs or []:
            if a.rehacer and d in por_doc:
                plan["documentos"].remove(por_doc[d])
        for i, d in enumerate(nuevos):
            plan["documentos"].append({"archivo": d, "tanda": base + 1 + i // tam,
                                       "estado": "pendiente", "hecho": None})
        escribir_json(ruta_plan(), plan)
        print(f"Plan guardado en {rel(ruta_plan())}: {len(nuevos)} documento(s) nuevo(s) en el plan.")
        a.accion = "status"

    if a.accion == "done":
        if not plan["documentos"]:
            sys.exit("No hay plan. Crea uno con: pipeline.py pack plan --perfiles ...")
        for d in a.docs:
            if d not in por_doc:
                sys.exit(f"{d} no está en el plan.")
            if not existe(d):
                sys.exit(f"{d} no existe en {rel(carpeta_contexto())}: no se puede marcar como hecho.")
            por_doc[d]["estado"] = "hecho"
            por_doc[d]["hecho"] = hoy()
        escribir_json(ruta_plan(), plan)
        pendientes = [d for d in plan["documentos"] if d["estado"] != "hecho"]
        print(f"Marcados: {', '.join(a.docs)}. Pendientes en el plan: {len(pendientes)}.")
        bitacora("context pack", f"escritos {', '.join(a.docs)}; quedan {len(pendientes)} en el plan")
        return

    if a.accion == "next":
        pendientes = [d for d in plan["documentos"] if d["estado"] != "hecho"]
        if not plan["documentos"]:
            sys.exit("No hay plan. Crea uno con: pipeline.py pack plan --perfiles ...")
        if not pendientes:
            print("Plan completo: no quedan tandas pendientes.")
            fuera = [d for d in todos if d not in por_doc]
            if fuera:
                print("Fuera del plan (no generados): " + ", ".join(fuera))
            return
        n = min(d["tanda"] for d in pendientes)
        total = max(d["tanda"] for d in plan["documentos"])
        print(f"Tanda {n} de {total}:")
        for d in [x for x in pendientes if x["tanda"] == n]:
            fuentes = ev.get(d["archivo"], [])
            print(f"  {d['archivo']}: " + (f"{len(fuentes)} evidencias ({', '.join(fuentes)})" if fuentes
                                             else "SIN evidencia que lo alimente: quedará delgado, con preguntas abiertas"))
        resto = sorted({d["tanda"] for d in pendientes} - {n})
        if resto:
            print("Después: " + "; ".join(f"tanda {t}: " + ", ".join(x["archivo"] for x in pendientes if x["tanda"] == t)
                                            for t in resto))
        return

    # status
    if not plan["documentos"]:
        print("No hay plan de context pack. Crea uno con: pipeline.py pack plan --perfiles ... | --todo")
        return
    print("Perfiles elegidos: " + (", ".join(plan["perfiles"]) or "(documentos sueltos)"))
    for n in sorted({d["tanda"] for d in plan["documentos"]}):
        ds = [d for d in plan["documentos"] if d["tanda"] == n]
        hechos = sum(1 for d in ds if d["estado"] == "hecho")
        print(f"Tanda {n} ({hechos}/{len(ds)} hechos):")
        for d in ds:
            print(f"  [{'x' if d['estado'] == 'hecho' else ' '}] {d['archivo']}")
    fuera = [d for d in todos if d not in {x["archivo"] for x in plan["documentos"]}]
    if fuera:
        print("Fuera del plan (no se generan): " + ", ".join(fuera))
        print("Para sumar alguno: pipeline.py pack plan --docs <documento.md> o --perfiles <perfil>")


def cmd_sync(a):
    """Registro de qué historia o caso corresponde a qué clave en la herramienta del cliente."""
    f = R(".pipeline", "state", "sync.json")
    d = leer_json(f, {"herramienta": "", "elementos": {}})
    if a.accion == "set":
        if not re.fullmatch(r"(US-\d+|TC-\d+-\d+|EP-\d+|DEF-\d+)", a.id):
            sys.exit("El ID debe ser de una historia (US-NNN), un caso (TC-NNN-NN), una épica (EP-NN) o un defecto (DEF-NNN).")
        d["elementos"][a.id] = {"clave": a.clave, "url": a.url or "", "version": a.version or "", "fecha": hoy()}
        if a.herramienta:
            d["herramienta"] = a.herramienta
        escribir_json(f, d)
        print(f"{a.id} -> {a.clave}")
    elif a.accion == "get":
        e = d["elementos"].get(a.id)
        print(f"{e['clave']}  {e.get('url', '')}".strip() if e else f"SIN SINCRONIZAR {a.id}")
    elif a.accion == "remove":
        d["elementos"].pop(a.id, None)
        escribir_json(f, d)
        print(f"{a.id} quitado del registro")
    else:
        if not d["elementos"]:
            print("Nada sincronizado todavía.")
            return
        print(f"Herramienta: {d.get('herramienta') or '?'}. {len(d['elementos'])} elementos sincronizados.")
        for k in sorted(d["elementos"]):
            e = d["elementos"][k]
            print(f"{k:<12} {e['clave']:<14} {e.get('version', ''):<6} {e.get('fecha', '')}  {e.get('url', '')}")


# ---------------------------------------------------------------- índice de entregables

OCULTOS = {"_meta.json", ".DS_Store"}


def archivos_de(carpeta, limite=40):
    """Archivos de una corrida para enlazar: primero los documentos, sin carpetas de evidencia."""
    carpeta = Path(carpeta)
    if not carpeta.exists():
        return []
    fs = [f for f in sorted(carpeta.rglob("*")) if f.is_file() and f.name not in OCULTOS
          and not any(p in ("qc", "evidencia", "node_modules", "__pycache__") for p in f.relative_to(carpeta).parts[:-1])]
    orden = {".pdf": 0, ".md": 1, ".html": 2, ".csv": 3, ".json": 4, ".sql": 4, ".yml": 4, ".yaml": 4}
    fs.sort(key=lambda f: (f.name.startswith("_"), orden.get(f.suffix.lower(), 9), f.name))
    return fs[:limite]


def generar_indice(silencioso=True):
    """Escribe outputs/INDICE.md y outputs/index.html: un solo lugar para abrir cualquier entregable."""
    import html
    import datetime
    out = R("outputs")
    out.mkdir(exist_ok=True)
    secciones = []  # (titulo, [(nombre, detalle, [(etiqueta, ruta relativa a outputs/)])])

    def enlace(f):
        return (f.name, os.path.relpath(f, out).replace(os.sep, "/"))

    # 1. Entregables del pipeline, en el orden del manifiesto
    filas = []
    for p in manifiesto()["pasos"]:
        if p["id"] == "00-context-pack":
            continue
        ultimas = {}
        for c in corridas(p["id"]):
            ultimas[c["alcance"]] = c
        for alc, c in sorted(ultimas.items()):
            est, _ = estado_corrida(c)
            meta = c["meta"]
            detalle = f"{est} · v{c['version']} · {meta.get('fecha', meta.get('cerrado', ''))}".rstrip(" ·")
            if meta.get("resumen"):
                detalle += f" · {una_linea(meta['resumen'])}"
            nombre = f"{p['id']} {p['nombre']}" + ("" if alc == "proyecto" else f" · {alc}")
            filas.append((nombre, detalle, [enlace(f) for f in archivos_de(c["carpeta"])]))
    secciones.append(("Entregables del pipeline", filas))

    # 2. Context pack
    cp = carpeta_contexto()
    filas = []
    if cp.exists():
        principales = [f for f in sorted(cp.glob("*.md")) if not f.name.startswith("_")]
        primero = ["context-pack-index.md", "active-context.md", "progress.md", "decisions.md", "open-questions.md"]
        principales.sort(key=lambda f: (primero.index(f.name) if f.name in primero else 99, f.name))
        if principales:
            filas.append(("Documentos del context pack", f"{len(principales)} documentos", [enlace(f) for f in principales]))
        verif = [f for f in sorted(cp.glob("_verification-*.md")) + sorted(cp.glob("_no-incorporado.md"))]
        if verif:
            filas.append(("Verificación del context pack", "", [enlace(f) for f in verif]))
    secciones.append(("Contexto del proyecto", filas))

    # 3. Informes, cambios, cuestionarios y sincronizaciones
    filas = []
    nombres = {"_informes": "Informe de avance", "_cambios": "Análisis de cambio", "_cuestionarios": "Cuestionario para el cliente",
               "_sync": "Sincronización con la herramienta", "_reuniones": "Reuniones y compromisos",
               "_solicitudes-cambio": "Solicitud de cambio", "_uat": "Aceptación del cliente (UAT)",
               "_incidentes": "Incidente", "_riesgos": "Riesgos",
               "_arranque": "Arranque del proyecto", "_plan-proyecto": "Plan del proyecto", "_releases": "Salida a producción",
               "_cierres": "Cierre de sprint", "_presupuesto": "Presupuesto (interno)"}
    for sub, etiqueta in nombres.items():
        base = out / sub
        if not base.exists():
            continue
        sueltos = [f for f in sorted(base.iterdir()) if f.is_file() and f.name not in OCULTOS]
        if sueltos:
            filas.append((etiqueta, "", [enlace(f) for f in reversed(sueltos)]))
        for d in sorted((x for x in base.iterdir() if x.is_dir()), reverse=True):
            filas.append((f"{etiqueta} · {d.name}", "", [enlace(f) for f in archivos_de(d)]))
    secciones.append(("Informes y otros documentos", filas))

    ahora = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    md = ["# Índice de entregables", "", f"Actualizado: {ahora}. Lo genera el pipeline en cada cierre; no lo edites a mano.", ""]
    for titulo, filas in secciones:
        if not filas:
            continue
        md += [f"## {titulo}", ""]
        for nombre, detalle, enlaces in filas:
            md.append(f"### {nombre}")
            if detalle:
                md.append(detalle)
            md.append("")
            md += [f"- [{n}]({r.replace(' ', '%20')})" for n, r in enlaces] or ["- (sin archivos)"]
            md.append("")
    (out / "INDICE.md").write_text("\n".join(md), encoding="utf-8")

    e = html.escape
    cuerpo = []
    for titulo, filas in secciones:
        if not filas:
            continue
        cuerpo.append(f"<h2>{e(titulo)}</h2>")
        for nombre, detalle, enlaces in filas:
            cuerpo.append(f"<section><h3>{e(nombre)}</h3>" + (f"<p class='d'>{e(detalle)}</p>" if detalle else "") + "<ul>"
                          + "".join(f"<li><a href='{e(r.replace(' ', '%20'))}'>{e(n)}</a></li>" for n, r in enlaces) + "</ul></section>")
    pagina = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Entregables del proyecto</title><style>
:root{{color-scheme:light dark}}body{{font:15px/1.5 system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 16px}}
h1{{font-size:24px;margin-bottom:4px}}h2{{font-size:18px;margin-top:32px;border-bottom:1px solid #8884;padding-bottom:4px}}
h3{{font-size:15px;margin:0 0 2px}}section{{border:1px solid #8884;border-radius:8px;padding:10px 14px;margin:10px 0}}
.d,.a{{opacity:.75;font-size:13px;margin:0 0 6px}}ul{{margin:4px 0 0;padding-left:18px;columns:2}}a{{text-decoration:none}}a:hover{{text-decoration:underline}}
@media (max-width:600px){{ul{{columns:1}}}}</style></head><body>
<h1>Entregables del proyecto</h1><p class="a">Actualizado: {ahora}. Lo genera el pipeline en cada cierre.</p>
{chr(10).join(cuerpo) or "<p>Aún no hay entregables.</p>"}
</body></html>"""
    (out / "index.html").write_text(pagina, encoding="utf-8")
    if not silencioso:
        print(f"Índice actualizado: {(out / 'INDICE.md').resolve()}")
        print(f"Para abrirlo en el navegador: {(out / 'index.html').resolve()}")


def listar_para_enlazar(carpeta):
    """Imprime las rutas absolutas de los archivos de una corrida, para que la skill las enlace al cerrar."""
    fs = archivos_de(carpeta)
    if fs:
        print("Archivos guardados en el proyecto (enlázalos en el cierre):")
        for f in fs:
            print(f"  {f.resolve()}")
    print(f"Índice de todos los entregables: {R('outputs', 'INDICE.md').resolve()}")


def cmd_indice(a):
    generar_indice(silencioso=False)
    if a.carpeta:
        c = R(a.carpeta) if not Path(a.carpeta).is_absolute() else Path(a.carpeta)
        if not c.exists():
            sys.exit(f"No existe {a.carpeta}")
        listar_para_enlazar(c)


def cmd_raiz(a):
    print(ROOT)


def cmd_nota(a):
    bitacora(a.skill or "nota", a.texto)
    print("Anotado en context-pack/progress.md")
    try:
        generar_indice()
    except Exception as ex:  # el índice nunca debe hacer fallar el cierre
        print(f"Aviso: no se pudo actualizar el índice ({ex}).")


def main():
    global ROOT
    try:
        import signal
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # permite usar | head sin traceback (no existe en Windows)
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("status"); s.add_argument("--write-active", action="store_true")
    s = sub.add_parser("check"); s.add_argument("paso")

    s = sub.add_parser("run"); rs = s.add_subparsers(dest="accion", required=True)
    x = rs.add_parser("new"); x.add_argument("paso"); x.add_argument("alcance", nargs="?", default="proyecto")
    x = rs.add_parser("finish"); x.add_argument("carpeta"); x.add_argument("--estado", required=True)
    x.add_argument("--entradas", nargs="*"); x.add_argument("--oq", nargs="*"); x.add_argument("--resumen", default="")
    x = rs.add_parser("latest"); x.add_argument("paso"); x.add_argument("alcance", nargs="?")
    x = rs.add_parser("all-latest"); x.add_argument("paso")
    x = rs.add_parser("accept"); x.add_argument("carpeta"); x.add_argument("--motivo", required=True)

    s = sub.add_parser("skip"); s.add_argument("paso"); s.add_argument("--motivo", default="")
    s = sub.add_parser("unskip"); s.add_argument("paso")

    s = sub.add_parser("decision"); ds = s.add_subparsers(dest="accion", required=True)
    ds.add_parser("list")
    x = ds.add_parser("get"); x.add_argument("clave")
    x = ds.add_parser("set"); x.add_argument("clave"); x.add_argument("valor")
    x.add_argument("--estado", default="CONFIRMADA"); x.add_argument("--origen"); x.add_argument("--motivo", default="")
    x.add_argument("--afecta", default="")

    s = sub.add_parser("oq"); qs = s.add_subparsers(dest="accion", required=True)
    x = qs.add_parser("list"); x.add_argument("--estado"); x.add_argument("--paso")
    x = qs.add_parser("show"); x.add_argument("id")
    x = qs.add_parser("add")
    for c in ["pregunta", "origen", "bloquea", "destino", "impacto", "contexto", "sugerencia"]:
        x.add_argument(f"--{c}", default="")
    x = qs.add_parser("answer"); x.add_argument("id"); x.add_argument("--respuesta", required=True)
    x = qs.add_parser("set"); x.add_argument("id"); x.add_argument("nuevo_estado")

    s = sub.add_parser("ids"); s.add_argument("prefijo")
    s = sub.add_parser("diff-historias"); s.add_argument("anterior"); s.add_argument("nueva")
    s = sub.add_parser("impacto"); s.add_argument("--md"); s.add_argument("--json")
    s = sub.add_parser("alcance"); als = s.add_subparsers(dest="accion", required=True)
    als.add_parser("list"); als.add_parser("dependencias")
    x = als.add_parser("contexto"); x.add_argument("nombre"); x.add_argument("--json")
    x = als.add_parser("get"); x.add_argument("nombre")
    for acc in ("set", "add", "remove"):
        x = als.add_parser(acc); x.add_argument("nombre"); x.add_argument("items", nargs="+")
        x.add_argument("--origen", default=""); x.add_argument("--permitir-repetidas", action="store_true")
    s = sub.add_parser("sync"); sy = s.add_subparsers(dest="accion", required=True)
    sy.add_parser("list")
    x = sy.add_parser("get"); x.add_argument("id")
    x = sy.add_parser("remove"); x.add_argument("id")
    x = sy.add_parser("set"); x.add_argument("id"); x.add_argument("clave"); x.add_argument("--url")
    x.add_argument("--version"); x.add_argument("--herramienta")
    sub.add_parser("raiz")
    s = sub.add_parser("indice"); s.add_argument("carpeta", nargs="?")
    s = sub.add_parser("nota"); s.add_argument("texto"); s.add_argument("--skill", default="")
    s = sub.add_parser("pack"); pk = s.add_subparsers(dest="accion", required=True)
    pk.add_parser("perfiles"); pk.add_parser("next"); pk.add_parser("status")
    x = pk.add_parser("plan"); x.add_argument("--perfiles"); x.add_argument("--todo", action="store_true")
    x.add_argument("--docs", nargs="*"); x.add_argument("--tanda", type=int); x.add_argument("--rehacer", action="store_true")
    x = pk.add_parser("done"); x.add_argument("docs", nargs="+")
    s = sub.add_parser("sources"); ss = s.add_subparsers(dest="accion", required=True)
    ss.add_parser("list")
    x = ss.add_parser("mark"); x.add_argument("ruta"); x.add_argument("evidencia")

    a = ap.parse_args()
    ROOT = raiz()
    {"status": cmd_status, "check": cmd_check, "run": cmd_run, "decision": cmd_decision, "oq": cmd_oq,
     "sources": cmd_sources, "pack": cmd_pack, "nota": cmd_nota, "raiz": cmd_raiz, "indice": cmd_indice, "sync": cmd_sync, "ids": cmd_ids, "alcance": cmd_alcance, "diff-historias": cmd_diff, "impacto": cmd_impacto, "skip": lambda a: cmd_skip(a, True), "unskip": lambda a: cmd_skip(a, False)}[a.cmd](a)


if __name__ == "__main__":
    main()
