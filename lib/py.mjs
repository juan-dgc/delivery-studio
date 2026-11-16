import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Ejecuta un proceso con tiempo límite: si se pasa, se mata y se informa (nunca deja la petición colgada). */
function exec(cmd, args, opts = {}, timeoutMs = 25000) {
  return new Promise((resolve) => {
    let out = '', err = '', listo = false;
    let p;
    const fin = (r) => { if (listo) return; listo = true; clearTimeout(t); clearTimeout(t2); resolve(r); };
    try { p = spawn(cmd, args, { ...opts, windowsHide: true }); } catch (e) { return resolve({ code: -1, stdout: '', stderr: String(e) }); }
    const t = setTimeout(() => {
      try { p.kill('SIGTERM'); } catch { /* ya terminó */ }
      fin({ code: -1, stdout: out, stderr: `${err}\nSe pasó del tiempo límite (${Math.round(timeoutMs / 1000)} s) y se detuvo.`.trim(), timeout: true });
    }, timeoutMs);
    const t2 = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* ya terminó */ } }, timeoutMs + 3000);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => fin({ code: -1, stdout: out, stderr: String(e) }));
    p.on('close', (code) => fin({ code, stdout: out, stderr: err }));
  });
}

let pyCache = null;
export async function findPython() {
  if (pyCache) return pyCache;
  for (const c of [['python3'], ['python'], ['py', '-3']]) {
    const r = await exec(c[0], [...c.slice(1), '--version'], {}, 8000);
    if (r.code === 0 && /Python 3/.test(r.stdout + r.stderr)) { pyCache = c; return c; }
  }
  return null;
}

export async function runPy(root, scriptArgs, timeoutMs = 25000) {
  const py = await findPython();
  if (!py) return { code: -1, stdout: '', stderr: 'No encontré Python 3.8 o superior (python3, python o py).' };
  return exec(py[0], [...py.slice(1), path.join('.pipeline', 'scripts', 'pipeline.py'), ...scriptArgs], {
    cwd: root,
    env: { ...process.env, DELIVERY_PROYECTO: root, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
  }, timeoutMs);
}

const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };

export const readManifest = (root) => readJson(path.join(root, '.pipeline', 'pipeline.json'), null);

const ESTADOS = 'NO_INICIADO|OMITIDO|COMPLETADO|DESACTUALIZADO|POR_REVISAR|PARCIAL|FALLIDO|EN_PROGRESO|SIN_META';
const RE_FILA = new RegExp(`^(\\d+[a-z]?-[a-z0-9-]+)(?: \\(opc\\.\\))?\\s+(${ESTADOS})\\s*(.*)$`);

/** Interpreta la salida de `pipeline.py status` (tabla de pasos y líneas de resumen). */
export function parseStatus(text) {
  const pasos = {};
  const resumen = { preguntasAbiertas: 0, altoImpacto: 0, respondidasSinIncorporar: 0, alcances: '', propuestas: '' };
  for (const linea of text.split(/\r?\n/)) {
    const m = RE_FILA.exec(linea.trim());
    if (m) { pasos[m[1]] = { estado: m[2], detalle: m[3].trim() }; continue; }
    const q = /^Preguntas abiertas:\s*(\d+)\s*\(alto impacto:\s*(\d+)\);\s*respondidas sin incorporar:\s*(\d+)/.exec(linea);
    if (q) { resumen.preguntasAbiertas = +q[1]; resumen.altoImpacto = +q[2]; resumen.respondidasSinIncorporar = +q[3]; continue; }
    const a = /^Alcances definidos:\s*(.*)$/.exec(linea);
    if (a) resumen.alcances = a[1];
    const d = /^Decisiones PROPUESTAS por validar:\s*(.*)$/.exec(linea);
    if (d) resumen.propuestas = d[1];
  }
  return { pasos, resumen };
}

function listDirs(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; }
}

/** Corridas por paso y alcance: outputs/<paso>/<alcance>/vN/_meta.json (y context-pack/_meta.json). */
export function scanRuns(root, manifest) {
  const out = {};
  for (const p of manifest?.pasos || []) {
    const lista = [];
    if (p.id === '00-context-pack') {
      const meta = readJson(path.join(root, 'context-pack', '_meta.json'), null);
      if (meta) lista.push({ alcance: 'proyecto', version: meta.version || 1, estado: meta.estado || 'SIN_META', resumen: meta.resumen || '', carpeta: 'context-pack' });
    } else {
      for (const alc of listDirs(path.join(root, 'outputs', p.id))) {
        const vs = listDirs(path.join(root, 'outputs', p.id, alc)).map((v) => /^v(\d+)$/.exec(v)).filter(Boolean).map((m) => +m[1]).sort((a, b) => a - b);
        if (!vs.length) continue;
        const v = vs[vs.length - 1];
        const meta = readJson(path.join(root, 'outputs', p.id, alc, `v${v}`, '_meta.json'), {});
        lista.push({ alcance: alc, version: v, estado: meta.estado || 'SIN_META', resumen: meta.resumen || '', carpeta: `outputs/${p.id}/${alc}/v${v}` });
      }
    }
    out[p.id] = lista;
  }
  return out;
}

function countFiles(dir, re) {
  try { return fs.readdirSync(dir).filter((f) => re.test(f)).length; } catch { return 0; }
}

function countInputs(dir) {
  let n = 0;
  const walk = (d) => {
    let es = [];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name !== 'sources.md') n++;
    }
  };
  walk(dir);
  return n;
}

export function readInfra(root, manifest) {
  const alcances = Object.keys(readJson(path.join(root, '.pipeline', 'state', 'alcances.json'), {}));
  return {
    initialized: !!manifest,
    inputs: countInputs(path.join(root, 'inputs')),
    evidence: countFiles(path.join(root, 'evidence'), /^EV-.*\.md$/),
    contextPack: fs.existsSync(path.join(root, 'context-pack', '_meta.json')),
    alcances,
  };
}
