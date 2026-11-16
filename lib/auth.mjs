import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Ruta del binario de Claude Code que trae el SDK (no hace falta instalar el CLI). */
export function claudeBin() {
  const req = createRequire(import.meta.url);
  const plat = process.platform;
  const arch = process.arch;
  const exe = plat === 'win32' ? 'claude.exe' : 'claude';
  for (const name of [`${plat}-${arch}`, `${plat}-${arch}-musl`]) {
    try {
      const dir = path.dirname(req.resolve(`@anthropic-ai/claude-agent-sdk-${name}/package.json`));
      const p = path.join(dir, exe);
      if (fs.existsSync(p)) return p;
    } catch { /* siguiente */ }
  }
  return 'claude';
}

/** Entorno que ve el SDK. En modo suscripción se quitan las claves de API para que no se cobre por tokens. */
export function sdkEnv(cfg, root) {
  const env = { ...process.env, DELIVERY_PROYECTO: root, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
  if (cfg.authMode === 'subscription') {
    for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY']) delete env[k];
  }
  return env;
}

/** El CLI pinta su salida para una terminal: sin color y con ancho amplio, el JSON llega de una pieza. */
const envPlano = (env) => ({ ...env, NO_COLOR: '1', FORCE_COLOR: '0', TERM: 'dumb', COLUMNS: '1000' });

/** Saca el objeto JSON de una salida que puede traer códigos de color o texto alrededor. */
export function leerJson(txt) {
  const limpio = String(txt || '').replace(/\u001B\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '');
  const i = limpio.indexOf('{'), f = limpio.lastIndexOf('}');
  if (i < 0 || f <= i) return null;
  const crudo = limpio.slice(i, f + 1);
  try { return JSON.parse(crudo); } catch { /* puede venir partido por el ancho de la terminal */ }
  // Segundo intento: la terminal pudo cortar líneas largas; se recomponen las que no terminan en , { [ o "
  const unido = crudo.split('\n').reduce((a, l) => {
    const t = l.trimEnd();
    if (!a.length) return [t];
    const prev = a[a.length - 1];
    if (/[,{[]$/.test(prev.trimEnd()) || /^\s*["}\]]/.test(t) || /^\s*"/.test(t)) a.push(t);
    else a[a.length - 1] = prev.trimEnd() + t.trimStart();
    return a;
  }, []).join('\n');
  try { return JSON.parse(unido); } catch { return null; }
}

function exec(bin, args, env, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let out = '', err = '';
    let p;
    try { p = spawn(bin, args, { env, windowsHide: true }); } catch (e) { return resolve({ code: -1, out, err: String(e) }); }
    const t = setTimeout(() => { try { p.kill(); } catch {} }, timeoutMs);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => { clearTimeout(t); resolve({ code: -1, out, err: String(e) }); });
    p.on('close', (code) => { clearTimeout(t); resolve({ code, out, err }); });
  });
}

/** El estado de sesión lanza un proceso, así que se guarda un rato. invalidarAuth() lo borra tras un login. */
let cacheAuth = { key: null, ts: 0, val: null };
const TTL_AUTH = 45000;
export function invalidarAuth() { cacheAuth = { key: null, ts: 0, val: null }; }

export async function authStatus(cfg, root) {
  const key = `${cfg.authMode}|${root}`;
  if (cacheAuth.key === key && Date.now() - cacheAuth.ts < TTL_AUTH) return cacheAuth.val;
  const val = await leerAuth(cfg, root);
  cacheAuth = { key, ts: Date.now(), val };
  return val;
}

async function leerAuth(cfg, root) {
  if (cfg.authMode === 'apikey') {
    return { mode: 'apikey', loggedIn: !!process.env.ANTHROPIC_API_KEY, detail: process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY definida' : 'Falta ANTHROPIC_API_KEY' };
  }
  const r = await exec(claudeBin(), ['auth', 'status', '--json'], envPlano(sdkEnv(cfg, root)));
  const j = leerJson(r.out);
  if (!j) {
    return { mode: 'subscription', loggedIn: false, detail: 'No se pudo leer el estado de sesión',
      error: (r.err || r.out || 'sin salida').replace(/\u001B\[[0-9;?]*[A-Za-z]/g, '').slice(0, 400) };
  }
  return { mode: 'subscription', loggedIn: !!j.loggedIn, detail: j.loggedIn ? (j.email || j.authMethod || 'sesión iniciada') : 'Sin sesión de Claude',
    info: { email: j.email || null, org: j.orgName || null, plan: j.planTier || j.subscriptionType || null,
      metodo: j.authMethod || null, proveedor: j.apiProvider || null, expira: j.loginExpiresAt || null } };
}

/** Inicia el login con la suscripción. Devuelve el proceso para que el servidor reenvíe su salida a la interfaz. */
export function startLogin(cfg, root, onLine, onDone) {
  invalidarAuth();
  const p = spawn(claudeBin(), ['auth', 'login', '--claudeai'], { env: envPlano(sdkEnv(cfg, root)), windowsHide: true });
  const feed = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach(onLine);
  p.stdout.on('data', feed);
  p.stderr.on('data', feed);
  p.on('error', (e) => { onLine(String(e)); onDone(-1); });
  p.on('close', (code) => { invalidarAuth(); onDone(code); });
  return p;
}
