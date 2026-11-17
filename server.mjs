import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { loadConfig, STUDIO_DIR } from './lib/config.mjs';
import { authStatus, startLogin, invalidarAuth } from './lib/auth.mjs';
import { findPython, runPy, readManifest } from './lib/py.mjs';
import { buildState, packPlan, invalidarStatus, claveAprobacion } from './lib/state.mjs';
import { RunManager } from './lib/runs.mjs';
import { Usage } from './lib/usage.mjs';
import { safeRel, tree, render, uniqueName, inside } from './lib/files.mjs';
import { TOKEN_FILE, codeHash, projKey } from './lib/ident.mjs';

const cfg = loadConfig();
const ROOT = cfg.project;
const TOKEN = crypto.randomBytes(18).toString('hex');
const CODE_HASH = codeHash();
const HOSTS = new Set([`127.0.0.1:${cfg.port}`, `localhost:${cfg.port}`]);
const ORIGINS = new Set([`http://127.0.0.1:${cfg.port}`, `http://localhost:${cfg.port}`]);
const PUBLIC = path.join(STUDIO_DIR, 'public');
const STATIC = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' };
const VENDOR_MARKED = path.join(STUDIO_DIR, 'node_modules', 'marked', 'lib', 'marked.esm.js');
const ROUTES_FILE = path.join(ROOT, '.delivery-ui', 'routes.json');
const STATIC_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) {
  console.error(`La carpeta del proyecto no existe: ${ROOT}`);
  process.exit(1);
}

// ---------------------------------------------------------------- SSE
const clients = new Set();
function broadcast(obj) {
  const data = `data: ${JSON.stringify(obj)}\n\n`;
  for (const c of clients) { try { c.write(data); } catch { clients.delete(c); } }
}
setInterval(() => { for (const c of clients) { try { c.write(': ping\n\n'); } catch { clients.delete(c); } } }, 20000).unref();

// El consumo se guarda dentro del proyecto: al compartir el estudio no viaja el gasto
// (ni los nombres ni las rutas) de los proyectos anteriores de quien lo armó.
const usage = new Usage(path.join(ROOT, '.delivery-ui', 'usage.json'), path.basename(ROOT), ROOT);
const runs = new RunManager({ cfg, root: ROOT, broadcast, usage });
let loginProc = null;

// ---------------------------------------------------------------- utilidades HTTP
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const text = (res, code, t) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(t); };
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const cookies = (h = '') => Object.fromEntries(h.split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, v.join('=')]));

// Las acciones que cambian el proyecto se atienden de una en una: dos peticiones a la vez
// no pueden pasar la validación de dependencias antes de que la primera quede registrada.
let cola = Promise.resolve();
function enSerie(fn) {
  const r = cola.then(fn, fn);
  cola = r.then(() => {}, () => {});
  return r;
}

function body(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('Cuerpo demasiado grande'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(Object.assign(new Error('JSON inválido'), { status: 400 })); } });
    req.on('error', reject);
  });
}

function openBrowser(url) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try { spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref(); } catch { /* el usuario abre la URL a mano */ }
}

const inputsDir = (sub) => path.join(ROOT, 'inputs', sub);
const SUBDIRS = ['documentos', 'audio', 'imagenes'];

// Copiar material del equipo al proyecto: nunca credenciales ni carpetas del sistema, y con tope.
const VETADO = /(^|[\\/])(\.ssh|\.aws|\.gnupg|\.gcloud|\.config[\\/](gcloud|gh|git)|\.docker|\.kube|\.npmrc|\.netrc|\.env|\.claude|\.cursor|Library[\\/](Keychains|Cookies|Application Support[\\/](Google|Firefox))|AppData[\\/]Roaming[\\/]Microsoft|System32|\.git)([\\/]|$)/i;
const MAX_IMPORT_BYTES = 4 * 1024 ** 3;
const MAX_IMPORT_ARCHIVOS = 3000;
/** Tamaño y número de archivos de una ruta, parando en cuanto pasa el tope. */
function medir(from) {
  let bytes = 0, archivos = 0;
  const walk = (d) => {
    if (archivos > MAX_IMPORT_ARCHIVOS || bytes > MAX_IMPORT_BYTES) return;
    let es = [];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.isFile()) { archivos++; try { bytes += fs.statSync(f).size; } catch { /* se ignora */ } }
      if (archivos > MAX_IMPORT_ARCHIVOS || bytes > MAX_IMPORT_BYTES) return;
    }
  };
  const st = fs.statSync(from);
  if (st.isDirectory()) walk(from); else { archivos = 1; bytes = st.size; }
  return { bytes, archivos };
}

// ---------------------------------------------------------------- rutas
async function route(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  if (STATIC[p] && m === 'GET') {
    const f = path.join(PUBLIC, STATIC[p]);
    res.writeHead(200, { 'Content-Type': STATIC_TYPES[path.extname(f)], 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(f));
  }

  if (p === '/vendor/marked.js' && m === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'max-age=3600' });
    return res.end(fs.readFileSync(VENDOR_MARKED));
  }

  if (p === '/api/routes') {
    if (m === 'GET') {
      let r = { custom: [], open: [], current: null };
      try { r = { ...r, ...JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8')) }; } catch { /* sin rutas guardadas */ }
      return json(res, 200, r);
    }
    if (m === 'POST') {
      const b = await body(req, 200_000);
      const known = new Set(cfg.catalog.skills.map((x) => x.skill));
      const str = (v, n) => String(v ?? '').slice(0, n);
      const clean = (r) => ({ id: str(r.id, 60), nombre: str(r.nombre, 80), descripcion: str(r.descripcion, 300), skills: (Array.isArray(r.skills) ? r.skills : []).filter((x) => known.has(x)).slice(0, 60) });
      const custom = (Array.isArray(b.custom) ? b.custom : []).slice(0, 50).map(clean).filter((r) => r.id && r.skills.length);
      const open = (Array.isArray(b.open) ? b.open : []).slice(0, 20).map((o) => ({ id: str(o.id, 60), base: str(o.base, 60), desde: known.has(o.desde) ? o.desde : null, nombre: str(o.nombre, 80), skills: (Array.isArray(o.skills) ? o.skills : []).filter((x) => known.has(x)).slice(0, 60), creada: str(o.creada, 30) })).filter((o) => o.id && o.base);
      const out = { custom, open, current: open.some((o) => o.id === b.current) ? b.current : open[0]?.id || null, ignorarSugerencia: str(b.ignorarSugerencia, 80) };
      fs.mkdirSync(path.dirname(ROUTES_FILE), { recursive: true });
      fs.writeFileSync(ROUTES_FILE, JSON.stringify(out, null, 2));
      return json(res, 200, out);
    }
  }

  if (p.startsWith('/f/') && (m === 'GET' || m === 'HEAD')) {
    const rel = decodeURIComponent(p.slice(3));
    const abs = safeRel(ROOT, rel);
    if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return text(res, 404, 'No encontrado');
    const r = render(abs);
    const h = { 'Content-Type': r.type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
    if (r.sandbox) h['Content-Security-Policy'] = "sandbox allow-same-origin; default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src data:";
    if (r.download) h['Content-Disposition'] = `attachment; filename="${encodeURIComponent(r.download)}"`;
    // Lo renderizado va en memoria; lo pesado (imagen, PDF, audio, binario) en flujo y por tramos,
    // para no cargar un archivo de gigas y para que el audio se pueda adelantar.
    if (!r.file) { res.writeHead(200, h); return res.end(m === 'HEAD' ? undefined : r.body); }
    const total = fs.statSync(r.file).size;
    h['Accept-Ranges'] = 'bytes';
    const rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (rg && (rg[1] || rg[2])) {
      const ini = rg[1] ? Number(rg[1]) : Math.max(0, total - Number(rg[2]));
      const fin = rg[1] && rg[2] ? Math.min(Number(rg[2]), total - 1) : total - 1;
      if (!(ini >= 0 && ini <= fin && fin < total)) { res.writeHead(416, { 'Content-Range': `bytes */${total}` }); return res.end(); }
      res.writeHead(206, { ...h, 'Content-Range': `bytes ${ini}-${fin}/${total}`, 'Content-Length': fin - ini + 1 });
      if (m === 'HEAD') return res.end();
      return fs.createReadStream(r.file, { start: ini, end: fin }).pipe(res);
    }
    res.writeHead(200, { ...h, 'Content-Length': total });
    if (m === 'HEAD') return res.end();
    return fs.createReadStream(r.file).pipe(res);
  }

  if (p === '/api/state' && m === 'GET') return json(res, 200, await buildState(cfg, ROOT, runs, (url.searchParams.get('lote') || '').slice(0, 40)));
  if (p === '/api/auth' && m === 'GET') return json(res, 200, await authStatus(cfg, ROOT));
  if (p === '/api/account' && m === 'GET') {
    const a = await authStatus(cfg, ROOT);
    return json(res, 200, { ia: 'Claude (Anthropic)', via: 'Claude Agent SDK', ...a, modelo: cfg.models.find((x) => x.id === cfg.defaultModel)?.label || cfg.defaultModel, uso: usage.summary(cfg.models) });
  }
  if (p === '/api/tree' && m === 'GET') return json(res, 200, tree(ROOT));

  if (p === '/api/events' && m === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ type: 'hello' })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (p === '/api/runs' && m === 'GET') return json(res, 200, runs.list());
  const mr = /^\/api\/runs\/([\w-]+)$/.exec(p);
  if (mr && m === 'GET') {
    const run = runs.get(mr[1]);
    return run ? json(res, 200, { summary: runs.summary(run), events: run.events }) : json(res, 404, { error: 'No existe esa ejecución' });
  }

  if (p === '/api/auth/login' && m === 'POST') {
    if (cfg.authMode !== 'subscription') return json(res, 400, { error: 'El panel está en modo API key.' });
    if (loginProc) return json(res, 409, { error: 'Ya hay un inicio de sesión en curso.' });
    loginProc = startLogin(cfg, ROOT, (line) => broadcast({ type: 'auth_log', line }), async (code) => {
      loginProc = null;
      invalidarAuth();
      broadcast({ type: 'auth_done', code, status: await authStatus(cfg, ROOT) });
    });
    return json(res, 200, { ok: true });
  }

  if (p === '/api/run' && m === 'POST') {
    const b = await body(req);
    const sk = cfg.catalog.skills.find((s) => s.skill === b.skill);
    if (!sk) return json(res, 400, { error: 'Skill desconocida.' });
    // Lo primero, siempre: sin sesión la skill no puede trabajar. Se avisa antes de arrancar
    // para que el paso no quede marcado con un error que no es suyo.
    {
      const a = await authStatus(cfg, ROOT);
      if (!a.loggedIn) {
        return json(res, 412, {
          error: cfg.authMode === 'apikey'
            ? 'Falta ANTHROPIC_API_KEY. Defínela y vuelve a abrir el estudio.'
            : 'No hay sesión de Claude. Inicia sesión arriba a la derecha y vuelve a ejecutar.',
          sinSesion: true, modo: cfg.authMode,
        });
      }
    }
    return enSerie(async () => {
    invalidarStatus();
    {
      const st = await buildState(cfg, ROOT, runs, claveAprobacion(cfg, ROOT, b.skill, b.args).alcance || '');
      const s = st.skills.find((x) => x.skill === b.skill);
      if (s && !s.listo) return json(res, 409, { error: 'Faltan pasos previos.', faltan: s.faltan });
    }
    if (b.reset) {
      // la skill y todas las que dependen de ella (directa o indirectamente) vuelven a quedar sin aprobar
      const dep = new Set([b.skill]);
      for (let grow = true; grow;) { grow = false; for (const x of cfg.catalog.skills) if (!dep.has(x.skill) && (x.requiere || []).some((r) => dep.has(r))) { dep.add(x.skill); grow = true; } }
      runs.resetApprovals([...dep], claveAprobacion(cfg, ROOT, b.skill, b.args).alcance);
    }
    const model = cfg.models.some((x) => x.id === b.model) ? b.model : cfg.defaultModel;
    const out = runs.start({ skill: b.skill, args: b.args, instruction: b.instruction, model, approval: b.approval, title: sk.nombre, verNavegador: !!b.verNavegador });
    invalidarStatus();
    return json(res, 200, out);
    });
  }
  if (p === '/api/reply' && m === 'POST') { const b = await body(req); runs.reply(b.runId, String(b.text || '').slice(0, 20000)); return json(res, 200, { ok: true }); }
  if (p === '/api/stop' && m === 'POST') { const b = await body(req); runs.stop(b.runId); return json(res, 200, { ok: true }); }
  if (p === '/api/approve' && m === 'POST') {
    const b = await body(req);
    const r = runs.get(b.runId), pk = r?.skill === 'generate-context-pack' ? packPlan(ROOT) : null;
    if (pk && pk.pendientes > 0) return json(res, 409, { error: `Quedan ${pk.pendientes} documentos del plan (tanda ${pk.tandaActual} de ${pk.tandas}). Sigue con la tanda siguiente en esta conversación, o cambia el plan para quitarlos, antes de aprobar.` });
    runs.approve(b.runId); invalidarStatus(); return json(res, 200, { ok: true }); }
  if (p === '/api/close' && m === 'POST') { const b = await body(req); runs.close(b.runId); invalidarStatus(); return json(res, 200, { ok: true }); }
  if (p === '/api/answer' && m === 'POST') { const b = await body(req); runs.answer(b.runId, b.id, b); return json(res, 200, { ok: true }); }

  if (p === '/api/upload' && m === 'POST') {
    const dir = url.searchParams.get('dir');
    if (!SUBDIRS.includes(dir)) return json(res, 400, { error: 'Carpeta destino inválida.' });
    const target = inputsDir(dir);
    fs.mkdirSync(target, { recursive: true });
    const name = uniqueName(target, url.searchParams.get('name') || 'archivo');
    const dest = path.join(target, name);
    const max = 2 * 1024 ** 3;
    let n = 0;
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(dest);
      req.on('data', (c) => { n += c.length; if (n > max) { req.destroy(); out.destroy(); fs.rm(dest, { force: true }, () => {}); reject(Object.assign(new Error('Archivo demasiado grande (máx. 2 GB).'), { status: 413 })); } });
      req.pipe(out);
      out.on('finish', resolve);
      out.on('error', reject);
      req.on('error', reject);
    });
    broadcast({ type: 'files_changed' });
    return json(res, 200, { ok: true, path: `inputs/${dir}/${name}` });
  }

  if (p === '/api/import' && m === 'POST') {
    const b = await body(req);
    if (!SUBDIRS.includes(b.dir)) return json(res, 400, { error: 'Carpeta destino inválida.' });
    const from = path.resolve(String(b.from || '').replace(/^~/, process.env.HOME || process.env.USERPROFILE || '~').replace(/^["']|["']$/g, ''));
    if (VETADO.test(from)) return json(res, 400, { error: 'Esa carpeta guarda credenciales o datos del sistema: no se copia al proyecto.' });
    if (!fs.existsSync(from)) return json(res, 400, { error: `No existe: ${from}` });
    if (inside(path.resolve(ROOT), from)) return json(res, 400, { error: 'Ese archivo ya está dentro del proyecto.' });
    const med = medir(from);
    if (med.archivos > MAX_IMPORT_ARCHIVOS) return json(res, 400, { error: `Son más de ${MAX_IMPORT_ARCHIVOS} archivos. Copia una subcarpeta más pequeña.` });
    if (med.bytes > MAX_IMPORT_BYTES) return json(res, 400, { error: `Son ${(med.bytes / 1024 ** 3).toFixed(1)} GB y el tope es ${MAX_IMPORT_BYTES / 1024 ** 3} GB. Copia una subcarpeta más pequeña.` });
    const target = inputsDir(b.dir);
    fs.mkdirSync(target, { recursive: true });
    const name = uniqueName(target, path.basename(from));
    if (fs.statSync(from).isDirectory()) fs.cpSync(from, path.join(target, name), { recursive: true });
    else fs.copyFileSync(from, path.join(target, name));
    broadcast({ type: 'files_changed' });
    return json(res, 200, { ok: true, path: `inputs/${b.dir}/${name}` });
  }

  // F3: lo que antes solo se podía hacer con /delivery:pipeline-status en una conversación.
  if (p === '/api/lotes') {
    if (!readManifest(ROOT)) return json(res, 400, { error: 'El proyecto aún no está inicializado.' });
    if (m === 'GET') {
      const r = await runPy(ROOT, ['alcance', 'list'], 15000);
      const lotes = (r.stdout || '').split(/\r?\n/).map((l) => /^(\S+)\s+(\d+) historias \((\S+) a (\S+)\)/.exec(l.trim()))
        .filter(Boolean).map((x) => ({ nombre: x[1], historias: +x[2], desde: x[3], hasta: x[4] }));
      return json(res, 200, { lotes, salida: (r.stdout || r.stderr || '').slice(0, 2000) });
    }
    if (m === 'POST') {
      const b = await body(req, 100_000);
      const modo = ['set', 'add', 'remove'].includes(b.modo) ? b.modo : 'set';
      const nombre = String(b.nombre || '').trim();
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/.test(nombre)) return json(res, 400, { error: 'Nombre de lote inválido: usa letras, números, punto, guion o guion bajo.' });
      const items = String(b.items || '').split(/[\s,]+/).filter(Boolean);
      if (!items.length) return json(res, 400, { error: 'Indica al menos una historia (por ejemplo US-001 US-002, o US-001..US-010).' });
      if (items.length > 600) return json(res, 400, { error: 'Son demasiadas historias en una sola operación.' });
      const mal = items.find((x) => !/^[A-Za-z]{2,4}-\d{1,5}(\.\.[A-Za-z]{2,4}-\d{1,5}|\.\.\d{1,5})?$/.test(x));
      if (mal) return json(res, 400, { error: `No entiendo «${mal}». Usa IDs como US-001, o rangos como US-001..US-010.` });
      const args = ['alcance', modo, nombre, ...items, '--origen', 'Delivery Studio'];
      if (b.permitirRepetidas) args.push('--permitir-repetidas');
      const r = await runPy(ROOT, args, 20000);
      invalidarStatus();
      if (r.code !== 0) return json(res, 400, { error: (r.stderr || r.stdout || 'No se pudo guardar el lote.').trim().slice(0, 400) });
      broadcast({ type: 'state_changed' });
      return json(res, 200, { ok: true, mensaje: (r.stdout || '').trim().slice(0, 400) });
    }
  }

  if (p === '/api/paso-omitido' && m === 'POST') {
    const b = await body(req);
    const man = readManifest(ROOT);
    if (!man) return json(res, 400, { error: 'El proyecto aún no está inicializado.' });
    const paso = (man.pasos || []).find((x) => x.id === String(b.paso || ''));
    if (!paso) return json(res, 400, { error: 'Ese paso no existe en el manifiesto.' });
    const omitir = b.omitir !== false;
    if (omitir && !paso.opcional) return json(res, 400, { error: 'Ese paso no es opcional: no se puede omitir.' });
    const args = omitir ? ['skip', paso.id, '--motivo', String(b.motivo || '').slice(0, 200)] : ['unskip', paso.id];
    const r = await runPy(ROOT, args, 15000);
    invalidarStatus();
    if (r.code !== 0) return json(res, 400, { error: (r.stderr || r.stdout || 'No se pudo cambiar el paso.').trim().slice(0, 400) });
    broadcast({ type: 'state_changed' });
    return json(res, 200, { ok: true, mensaje: (r.stdout || '').trim().slice(0, 200) });
  }

  if (p === '/api/sources') {
    const f = path.join(ROOT, 'inputs', 'sources.md');
    if (m === 'GET') return json(res, 200, { exists: fs.existsSync(f), text: fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '' });
    if (m === 'POST') {
      const b = await body(req, 500_000);
      if (!fs.existsSync(path.dirname(f))) return json(res, 400, { error: 'inputs/ no existe: inicializa el proyecto primero.' });
      fs.writeFileSync(f, String(b.text ?? ''), 'utf8');
      return json(res, 200, { ok: true });
    }
  }

  return text(res, 404, 'No encontrado');
}

const server = http.createServer(async (req, res) => {
  try {
    const host = String(req.headers.host || '').toLowerCase();
    if (!HOSTS.has(host)) return text(res, 403, 'Host no permitido');
    const url = new URL(req.url, `http://${host}`);
    // Identidad sin token: el arranque la usa para decidir si reutiliza o reinicia este servidor. No expone rutas ni datos.
    if (url.pathname === '/api/_id' && req.method === 'GET') {
      const activas = [...runs.runs.values()].filter((r) => r.status === 'running').length;
      return json(res, 200, { app: 'delivery-studio', code: CODE_HASH, disco: codeHash(), proj: projKey(ROOT), activas });
    }
    const qt = url.searchParams.get('token');
    if (qt && safeEq(qt, TOKEN)) {
      res.writeHead(302, { 'Set-Cookie': `ds_token=${TOKEN}; HttpOnly; SameSite=Strict; Path=/`, Location: '/' });
      return res.end();
    }
    if (!safeEq(cookies(req.headers.cookie).ds_token || '', TOKEN)) return text(res, 401, 'Abre la dirección que imprimió el servidor al iniciar (incluye el token).');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.headers.origin;
      if (origin && !ORIGINS.has(origin)) return text(res, 403, 'Origen no permitido');
      if (req.headers['x-ds'] !== '1') return text(res, 403, 'Falta el encabezado x-ds');
    }
    await route(req, res, url);
  } catch (e) {
    if (!res.headersSent) json(res, e.status || 500, { error: e.message || String(e) });
    else res.end();
  }
});

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `El puerto ${cfg.port} ya está en uso. Usa --port <otro>.` : e);
  process.exit(1);
});

const quitarToken = () => { try { if (JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).pid === process.pid) fs.rmSync(TOKEN_FILE, { force: true }); } catch { /* ya no existe */ } };
process.on('exit', quitarToken);
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => process.exit(0));

server.listen(cfg.port, '127.0.0.1', async () => {
  // El token queda en un archivo solo legible por tu usuario, para que un arranque posterior pueda reabrir esta misma sesión.
  try { fs.writeFileSync(TOKEN_FILE, JSON.stringify({ pid: process.pid, port: cfg.port, token: TOKEN }), { mode: 0o600 }); } catch { /* sin reuso, no es grave */ }
  const url = `http://127.0.0.1:${cfg.port}/?token=${TOKEN}`;
  const py = await findPython();
  const auth = await authStatus(cfg, ROOT);
  console.log('\nDelivery Studio');
  console.log(`  Proyecto : ${ROOT}`);
  console.log(`  Plugin   : ${cfg.pluginOk ? cfg.pluginPath : `NO ENCONTRADO en ${cfg.pluginPath} (ajusta pluginPath en config.json)`}`);
  console.log(`  Python   : ${py ? py.join(' ') : 'NO ENCONTRADO (necesario para los scripts del pipeline)'}`);
  console.log(`  Acceso   : ${cfg.authMode === 'apikey' ? 'API key' : 'suscripción de Claude'} (${auth.loggedIn ? 'listo' : 'sin sesión: usa el botón de la interfaz o npm run login'})`);
  console.log(`\nAbre: ${url}\n`);
  if (cfg.open) openBrowser(url);
});
