import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const VISIBLE_ROOTS = ['outputs', 'context-pack', 'evidence', 'inputs'];
const HIDDEN = new Set(['_meta.json', '.DS_Store', 'node_modules', '__pycache__', '.git']);

export function inside(root, p) {
  const r = path.resolve(p);
  return r === root || r.startsWith(root + path.sep);
}

/**
 * Como inside(), pero resolviendo enlaces simbólicos: un enlace dentro del proyecto que apunte
 * afuera no cuenta como dentro. Sirve para rutas que todavía no existen (una escritura nueva):
 * sube hasta el primer antecesor real y vuelve a bajar sobre su ruta real.
 */
export function insideReal(root, p) {
  const raiz = path.resolve(root);
  const abs = path.resolve(raiz, p);
  if (!inside(raiz, abs)) return false;
  let real; try { real = fs.realpathSync(raiz); } catch { return false; }
  let d = abs, resto = '';
  for (;;) {
    try { return inside(real, path.resolve(fs.realpathSync(d), resto)); }
    catch {
      const up = path.dirname(d);
      if (up === d) return false;
      resto = resto ? path.join(path.basename(d), resto) : path.basename(d);
      d = up;
    }
  }
}

/** Resuelve una ruta relativa dentro de las carpetas visibles del proyecto; devuelve null si no es válida. */
export function safeRel(root, rel) {
  if (!rel || rel.includes('\0')) return null;
  const clean = rel.replace(/\\/g, '/').replace(/^\/+/, '');
  const top = clean.split('/')[0];
  if (!VISIBLE_ROOTS.includes(top) && clean !== 'CLAUDE.md') return null;
  const abs = path.resolve(root, clean);
  if (!inside(root, abs)) return null;
  try {
    const real = fs.realpathSync(abs);
    if (!inside(fs.realpathSync(root), real)) return null;
  } catch { return null; }
  return abs;
}

export function tree(root) {
  let count = 0;
  let recortado = false;
  const walk = (abs, rel, depth) => {
    let es = [];
    try { es = fs.readdirSync(abs, { withFileTypes: true }); } catch { return []; }
    es = es.filter((e) => !HIDDEN.has(e.name) && !e.name.startsWith('.'));
    // INDICE.md e index.html (los dos los genera pipeline.py con el mismo contenido): se muestra solo el HTML.
    if (es.some((e) => e.name === 'index.html')) es = es.filter((e) => e.name.toLowerCase() !== 'indice.md');
    es.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name, 'es', { numeric: true }) : a.isDirectory() ? -1 : 1));
    const out = [];
    for (const e of es) {
      if (++count > 4000 || depth > 8) { recortado = true; break; }
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) out.push({ name: e.name, path: r, dir: true, children: walk(path.join(abs, e.name), r, depth + 1) });
      else {
        let st; try { st = fs.statSync(path.join(abs, e.name)); } catch { continue; }
        out.push({ name: e.name, path: r, dir: false, size: st.size, mtime: st.mtimeMs });
      }
    }
    return out;
  };
  const nodos = VISIBLE_ROOTS.map((r) => ({ name: r, path: r, dir: true, children: walk(path.join(root, r), r, 1) }));
  return { nodos, recortado };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const PAGE_CSS = `
:root{color-scheme:dark}
html{background:#0A0D18}
body{font:15px/1.65 Inter,system-ui,-apple-system,Segoe UI,sans-serif;max-width:940px;margin:0 auto;padding:32px 32px 72px;color:#F4F6FF;background:radial-gradient(900px 520px at 0 0,rgba(61,90,254,.16),transparent 60%),#0A0D18;min-height:100vh}
a{color:#8DB2FF;text-underline-offset:3px}a:hover{color:#fff}
h1,h2,h3,h4{color:#F4F6FF;line-height:1.25;margin:1.6em 0 .5em}h1{font-size:1.75em;margin-top:0;border-bottom:1px solid #2F3956;padding-bottom:.3em}h2{font-size:1.3em;border-bottom:1px solid #232B44;padding-bottom:.25em}h3{font-size:1.08em}
p,li{color:#E3E8F6}.d,.a{color:#A3ADC2;opacity:1}
section{background:#141A2C;border:1px solid #2F3956;border-radius:12px;padding:14px 18px;margin:12px 0}section h3{margin-top:0}
ul,ol{padding-left:1.3em}
table{border-collapse:collapse;margin:1em 0;display:block;overflow:auto}th,td{border:1px solid #2F3956;padding:7px 12px;text-align:left;vertical-align:top}th{background:#1B2238}tbody tr:nth-child(even){background:#101526}
code{background:#1B2238;padding:.1em .4em;border-radius:5px;font-size:.92em;font-family:"JetBrains Mono",ui-monospace,Menlo,monospace}pre{background:#080B14;border:1px solid #232B44;padding:12px 14px;border-radius:10px;overflow:auto}pre code{background:none;padding:0}
blockquote{margin:1em 0;padding:.1em 1em;border-left:3px solid #4A67FF;color:#C3CAD9}img{max-width:100%}hr{border:0;border-top:1px solid #2F3956}
::selection{background:#4A67FF88}
`;

function csvToRows(text, max = 2000) {
  const rows = []; rows.recortado = false; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length && rows.length < max; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',' || c === ';') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  rows.recortado = rows.length >= max;
  return rows;
}

const page = (title, body) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PAGE_CSS}</style></head><body>${body}</body></html>`;

/** Un HTML que ya define su propio fondo (documento con marca) se respeta tal cual; el resto recibe el tema oscuro para que se lea. */
const FONDO_PROPIO = /(?:^|[}\s,;>])(?:html|body|:root)\s*(?:[,\s][^{]*)?\{[^}]*\bbackground(?:-color|-image)?\s*:|<body[^>]*(?:bgcolor|style\s*=\s*["'][^"']*background)/i;
function themeHtml(name, t) {
  if (FONDO_PROPIO.test(t)) return t;
  if (!/<html[\s>]|<body[\s>]/i.test(t)) return page(name, t);
  const tema = `<meta charset="utf-8"><style>${PAGE_CSS}body{color:#F4F6FF!important}html,body{background-color:#0A0D18!important}</style>`;
  if (/<\/head>/i.test(t)) return t.replace(/<\/head>/i, tema + '</head>');
  return /<head[^>]*>/i.test(t) ? t.replace(/<head[^>]*>/i, (m) => m + tema) : t.replace(/<html[^>]*>/i, (m) => `${m}<head>${tema}</head>`);
}

const TEXTUAL = new Set(['.json', '.yml', '.yaml', '.sql', '.txt', '.log', '.ts', '.js', '.py', '.feature', '.xml', '.ini', '.toml', '.sh', '.env', '.css']);

export const MIME = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
};

/** Tope de lo que se renderiza en memoria; por encima se envía en flujo como texto plano. */
const MAX_TEXTO = 8 * 1024 * 1024;

/**
 * Devuelve cómo servir un archivo: {body} para lo que se renderiza (Markdown, CSV, texto),
 * {file} para lo que va en flujo (imágenes, PDF, audio, binarios y textos enormes).
 */
export function render(abs) {
  const ext = path.extname(abs).toLowerCase();
  const name = path.basename(abs);
  let size = 0; try { size = fs.statSync(abs).size; } catch { /* se intenta igual */ }
  const renderizable = ext === '.md' || ext === '.html' || ext === '.htm' || ext === '.csv' || TEXTUAL.has(ext);
  if (renderizable && size > MAX_TEXTO) return { type: 'text/plain; charset=utf-8', file: abs, sandbox: true };
  if (ext === '.md') return { type: 'text/html; charset=utf-8', body: page(name, marked.parse(fs.readFileSync(abs, 'utf8'))), sandbox: true };
  if (ext === '.html' || ext === '.htm') return { type: 'text/html; charset=utf-8', body: themeHtml(name, fs.readFileSync(abs, 'utf8')), sandbox: true };
  if (ext === '.csv') {
    const rows = csvToRows(fs.readFileSync(abs, 'utf8'));
    const recortado = rows.recortado;
    const head = rows.shift() || [];
    const html = `<table><thead><tr>${head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      + (recortado ? '<p class="a">Se muestran las primeras 2.000 filas. Abre el archivo para verlo completo.</p>' : '');
    return { type: 'text/html; charset=utf-8', body: page(name, html), sandbox: true };
  }
  if (TEXTUAL.has(ext)) {
    let t = fs.readFileSync(abs, 'utf8');
    if (ext === '.json') { try { t = JSON.stringify(JSON.parse(t), null, 2); } catch {} }
    return { type: 'text/html; charset=utf-8', body: page(name, `<pre>${esc(t)}</pre>`), sandbox: true };
  }
  if (MIME[ext]) return { type: MIME[ext], file: abs, sandbox: ext === '.svg' };
  return { type: 'application/octet-stream', file: abs, download: name };
}

export function uniqueName(dir, name) {
  const base = path.basename(name).replace(/[\\/:*?"<>|\0]/g, '_').replace(/^\.+/, '') || 'archivo';
  const ext = path.extname(base), stem = base.slice(0, base.length - ext.length);
  let cand = base, i = 1;
  while (fs.existsSync(path.join(dir, cand))) cand = `${stem} (${i++})${ext}`;
  return cand;
}
