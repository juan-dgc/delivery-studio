#!/usr/bin/env python3
"""Escaneo estático de seguridad de un repositorio: señales, no veredictos.

Busca patrones que suelen indicar que un control de .pipeline/seguridad-base.md no se cumple:
secretos en el código o en el historial de Git, tokens en almacenamiento del navegador, SQL
armado con concatenación, CORS abierto, HTML sin sanear, hashes débiles, cookies sin atributos,
verificación TLS desactivada, y archivos que deberían estar en .gitignore.

Cada señal lleva el control (SB-NN), archivo y línea. Los valores de los secretos se enmascaran:
nunca se imprimen completos. Una señal hay que confirmarla leyendo el código; que no haya señales
no demuestra que el control se cumpla (la autorización, por ejemplo, no se detecta con patrones).

Uso:
  python3 .pipeline/scripts/security_scan.py <repositorio> [--historial] [--rutas src api] [--json salida.json]
  --historial   revisa también los cambios del historial de Git en busca de secretos (más lento)
  --rutas       limita el escaneo a estas carpetas del repositorio
No modifica nada. Sale con código 1 si hay señales de nivel crítico.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

IGNORAR_DIR = {".git", "node_modules", "vendor", "dist", "build", ".next", ".nuxt", "out", "target", "bin", "obj",
               "__pycache__", ".venv", "venv", "coverage", ".pipeline", "playwright-report", "test-results"}
IGNORAR_EXT = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".pdf", ".zip", ".gz", ".woff", ".woff2", ".ttf",
               ".eot", ".mp4", ".mp3", ".lock", ".map", ".min.js", ".snap"}
CODIGO = {".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".py", ".rb", ".php", ".java", ".kt", ".cs", ".go",
          ".rs", ".sql", ".html", ".swift", ".dart"}
PRUEBA = re.compile(r"(^|/)(tests?|__tests__|spec|specs|e2e|fixtures|mocks?|examples?|docs?)/|\.(test|spec)\.|\.example$|\.sample$|\.md$", re.I)

# (control, nivel, nombre, patrón, solo en código)
SECRETOS = [
    ("SB-01", "crítico", "Llave privada", r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----"),
    ("SB-01", "crítico", "Clave de acceso de AWS", r"\bAKIA[0-9A-Z]{16}\b"),
    ("SB-01", "crítico", "Token de GitHub", r"\bgh[pousr]_[A-Za-z0-9]{36,}\b"),
    ("SB-01", "crítico", "Clave secreta de Stripe", r"\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b"),
    ("SB-01", "crítico", "Clave de API de Google", r"\bAIza[0-9A-Za-z_\-]{35}\b"),
    ("SB-01", "crítico", "Token de Slack", r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"),
    ("SB-01", "crítico", "Clave de un proveedor de IA", r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_\-]{32,}\b"),
    ("SB-04", "crítico", "Clave de servicio de la base de datos", r"(?i)\b(?:service[_-]?role|supabase[_-]?service)[A-Za-z_]*\s*[:=]\s*['\"][A-Za-z0-9._\-]{20,}['\"]"),
    ("SB-01", "crítico", "Cadena de conexión con contraseña", r"\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp)://[^\s:@/'\"]+:[^\s@/'\"${}<>]{4,}@"),
    ("SB-01", "alto", "Secreto asignado en el código",
     r"(?i)\b(?:api[_-]?key|secret|passwd|password|contrasena|token|client[_-]?secret|private[_-]?key)\w*\s*[:=]\s*['\"][^'\"\s${}<>]{12,}['\"]"),
]
PATRONES = [
    ("SB-05", "alto", "Token en almacenamiento del navegador",
     r"(?i)(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\(\s*['\"][^'\"]*(?:token|jwt|session|auth|secret)"),
    ("SB-15", "crítico", "SQL armado con datos interpolados",
     r"(?i)(?:execute|query|raw|prepare)\w*\s*\(\s*(?:f['\"]|[`'\"][^`'\"]*\b(?:select|insert|update|delete)\b[^`'\"]*(?:\$\{|['\"]\s*\+|%s['\"]\s*%))"),
    ("SB-15", "alto", "Consulta SQL concatenada", r"(?i)['\"]\s*(?:select|insert into|update|delete from)\b[^'\"]*['\"]\s*(?:\+|\.format\(|%\s*\()"),
    ("SB-26", "alto", "CORS abierto a cualquier origen",
     r"(?i)(?:Access-Control-Allow-Origin['\"]?\s*[:,]\s*['\"]\*|origin\s*:\s*(?:['\"]\*['\"]|true\b)|allow_origins\s*=\s*\[\s*['\"]\*|AllowAnyOrigin\s*\()"),
    ("SB-18", "alto", "HTML insertado sin sanear", r"dangerouslySetInnerHTML|\bv-html\s*=|\.innerHTML\s*=(?!=)|\|\s*safe\b|\bhtml_safe\b|\{@html\b"),
    ("SB-18", "crítico", "Ejecución dinámica de código", r"(?<![\w.])eval\s*\(|new\s+Function\s*\(|(?<![\w.])exec\s*\(\s*(?:request|req|input|params)"),
    ("SB-07", "alto", "Hash rápido cerca de una contraseña", r"(?i)(?:md5|sha1|sha256)\s*\(.{0,60}(?:pass|pwd|contrasen)|(?:pass|pwd|contrasen).{0,60}(?:md5|sha1)\s*\("),
    ("SB-06", "medio", "Cookie sin protección explícita", r"(?i)(?:httpOnly|http_only|HttpOnly)\s*[:=]\s*false|(?:secure)\s*[:=]\s*false\b"),
    ("SB-28", "alto", "Verificación TLS desactivada",
     r"(?i)rejectUnauthorized\s*:\s*false|verify\s*=\s*False|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['\"]?0|InsecureSkipVerify\s*:\s*true"),
    ("SB-34", "medio", "Error interno devuelto al cliente",
     r"(?i)(?:res\.(?:send|json)|return\s+(?:Response|JsonResponse|jsonify))\s*\([^)]{0,80}(?:err(?:or)?\.stack|traceback|\.stack\b|str\(e\)|e\.message|err\.message)"),
    ("SB-08", "medio", "Depuración activada", r"(?i)\bDEBUG\s*=\s*True\b|app\.run\([^)]*debug\s*=\s*True"),
    ("SB-13", "medio", "Asignación masiva desde la petición",
     r"(?i)(?:\.create|\.update|\.insert|\.upsert|\.findByIdAndUpdate|\.assign)\w*\s*\(\s*(?:\{\s*\.\.\.)?(?:req\.body|request\.(?:json|data|POST)|\*\*request)"),
    ("SB-04", "crítico", "Clave de servicio usada en código de cliente", r"(?i)(?:NEXT_PUBLIC_|VITE_|REACT_APP_|PUBLIC_)\w*(?:SERVICE|SECRET|PRIVATE)\w*"),
]
SENSIBLES = re.compile(r"(^|/)(\.env(\.(?!example|sample|template)[\w.-]+)?|id_rsa|id_ed25519|.*\.pem|.*\.p12|.*\.pfx|credentials\.json|serviceAccount.*\.json|.*\.keystore)$", re.I)
PLACEHOLDER = re.compile(r"(?i)(example|ejemplo|changeme|cambiar|your[_-]|tu[_-]|xxxx|\*\*\*\*|placeholder|dummy|fake|<[^>]+>|process\.env|os\.environ|getenv|\$\{)")


def enmascarar(linea, m):
    valor = m.group(0)
    visible = valor[:6] + "…" + f"[{len(valor)} caracteres]"
    return (linea[:m.start()] + visible + linea[m.end():]).strip()[:160]


def archivos(repo, rutas):
    bases = [repo / r for r in rutas] if rutas else [repo]
    for base in bases:
        if not base.exists():
            continue
        for f in base.rglob("*"):
            if not f.is_file() or any(p in IGNORAR_DIR for p in f.relative_to(repo).parts):
                continue
            if f.suffix.lower() in IGNORAR_EXT or f.name.endswith(".min.js"):
                continue
            try:
                if f.stat().st_size > 1_000_000:
                    continue
            except OSError:
                continue
            yield f


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("repo")
    ap.add_argument("--historial", action="store_true")
    ap.add_argument("--rutas", nargs="*")
    ap.add_argument("--json")
    a = ap.parse_args()
    repo = Path(a.repo).resolve()
    if not repo.is_dir():
        sys.exit(f"No existe la carpeta {repo}")
    senales = []

    def senal(control, nivel, nombre, archivo, linea, texto, nota=""):
        senales.append({"control": control, "nivel": nivel, "senal": nombre, "archivo": archivo, "linea": linea,
                        "texto": texto, "nota": nota})

    revisados = 0
    for f in archivos(repo, a.rutas):
        rel = f.relative_to(repo).as_posix()
        if SENSIBLES.search(rel):
            senal("SB-02", "alto", "Archivo sensible dentro del repositorio", rel, 0, "",
                  "Comprueba que está en .gitignore y que nunca se subió")
        try:
            lineas = f.read_text(encoding="utf-8", errors="ignore").splitlines()
        except OSError:
            continue
        revisados += 1
        es_prueba = bool(PRUEBA.search(rel))
        for n, linea in enumerate(lineas, 1):
            if len(linea) > 2000:
                continue
            for control, nivel, nombre, patron in SECRETOS:
                m = re.search(patron, linea)
                if m and not PLACEHOLDER.search(m.group(0)):
                    senal(control, "bajo" if es_prueba else nivel, nombre, rel, n, enmascarar(linea, m),
                          "En archivo de pruebas o documentación: confirma que no es un secreto real" if es_prueba else "")
                    break
            if f.suffix.lower() in CODIGO and not es_prueba:
                for control, nivel, nombre, patron in PATRONES:
                    if re.search(patron, linea):
                        senal(control, nivel, nombre, rel, n, linea.strip()[:160])

    # .gitignore y archivos sensibles ya versionados
    gi = repo / ".gitignore"
    if (repo / ".git").exists():
        if not gi.exists() or not re.search(r"^\.env", gi.read_text(encoding="utf-8", errors="ignore"), re.M):
            senal("SB-02", "medio", ".gitignore no excluye los archivos .env", ".gitignore", 0, "")
        try:
            versionados = subprocess.run(["git", "-C", str(repo), "ls-files"], capture_output=True, text=True, timeout=60).stdout.splitlines()
            for v in versionados:
                if SENSIBLES.search(v):
                    senal("SB-02", "crítico", "Archivo sensible versionado en Git", v, 0, "",
                          "Rota los secretos que contenga, luego sácalo del repositorio y del historial (SB-03)")
        except (OSError, subprocess.SubprocessError):
            pass
        if a.historial:
            try:
                log = subprocess.run(["git", "-C", str(repo), "log", "-p", "--all", "--no-color", "-U0", "--format=@@commit %h"],
                                     capture_output=True, text=True, timeout=300, errors="ignore").stdout
                commit, vistos = "", set()
                for linea in log.splitlines():
                    if linea.startswith("@@commit "):
                        commit = linea.split()[1]
                    elif linea.startswith("+") and not linea.startswith("+++") and len(linea) < 2000:
                        for control, nivel, nombre, patron in SECRETOS[:-1]:
                            m = re.search(patron, linea)
                            if m and not PLACEHOLDER.search(m.group(0)) and (nombre, m.group(0)) not in vistos:
                                vistos.add((nombre, m.group(0)))
                                senal("SB-02", "crítico", f"{nombre} en el historial de Git", f"commit {commit}", 0,
                                      enmascarar(linea[1:], re.search(patron, linea[1:]) or m),
                                      "Aunque ya no esté en el código, sigue en el historial: rota, revoca y purga (SB-03)")
                                break
                nombres = subprocess.run(["git", "-C", str(repo), "log", "--all", "--name-only", "--format="],
                                         capture_output=True, text=True, timeout=120, errors="ignore").stdout.splitlines()
                actuales = set(versionados)
                for v in sorted({n for n in nombres if n and SENSIBLES.search(n)} - actuales):
                    senal("SB-02", "crítico", "Archivo sensible que estuvo versionado", v, 0, "",
                          "Ya no está en el árbol, pero sigue en el historial: rota lo que contenía y purga (SB-03)")
            except (OSError, subprocess.SubprocessError, NameError):
                print("Aviso: no se pudo leer el historial de Git.", file=sys.stderr)

    orden = {"crítico": 0, "alto": 1, "medio": 2, "bajo": 3}
    senales.sort(key=lambda s: (orden[s["nivel"]], s["control"], s["archivo"], s["linea"]))
    cuenta = {n: sum(1 for s in senales if s["nivel"] == n) for n in orden}
    print(f"Archivos revisados: {revisados}. Señales: " + ", ".join(f"{v} de nivel {k}" for k, v in cuenta.items()))
    print("Son señales para confirmar leyendo el código, no hallazgos definitivos.\n")
    for s in senales:
        donde = s["archivo"] + (f":{s['linea']}" if s["linea"] else "")
        print(f"[{s['nivel'].upper()}] {s['control']} {s['senal']} en {donde}" + (f"\n    {s['texto']}" if s["texto"] else "")
              + (f"\n    {s['nota']}" if s["nota"] else ""))
    if a.json:
        Path(a.json).write_text(json.dumps({"revisados": revisados, "cuenta": cuenta, "senales": senales},
                                           ensure_ascii=False, indent=2), encoding="utf-8")
    sys.exit(1 if cuenta["crítico"] else 0)


if __name__ == "__main__":
    main()
