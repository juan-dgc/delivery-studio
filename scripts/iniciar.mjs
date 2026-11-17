// Arranque en un solo paso: instala lo que falte, ubica el plugin, elige la carpeta del cliente y abre el servidor.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TOKEN_FILE, codeHash, projKey } from '../lib/ident.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAST = path.join(STUDIO, '.delivery-last.json');
const LOCAL = path.join(STUDIO, 'config.local.json');
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2));
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const expand = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);

async function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(q)).trim().replace(/^["']|["']$/g, '');
  rl.close();
  return a;
}

function pickFolder(prompt) {
  if (isMac) {
    const r = spawnSync('osascript', ['-e', `POSIX path of (choose folder with prompt "${prompt}")`], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().replace(/\/$/, '');
    return null; // cancelado
  }
  if (isWin) {
    // Mismo selector de carpetas que en Mac. Si PowerShell está restringido, se pregunta por terminal.
    const ps = `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = '${prompt.replace(/'/g, "''")}'; if ($d.ShowDialog() -eq 'OK') { Write-Output $d.SelectedPath }`;
    const r = spawnSync('powershell', ['-NoProfile', '-STA', '-Command', ps], { encoding: 'utf8' });
    if (r.error || r.status !== 0) return undefined; // sin selector disponible
    return r.stdout.trim() || null; // vacío = el usuario canceló
  }
  return undefined; // sin selector: preguntar en la terminal
}

// 1. Dependencias
if (!fs.existsSync(path.join(STUDIO, 'node_modules', '@anthropic-ai'))) {
  console.log('Primera vez: instalando dependencias (un minuto)...');
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd: STUDIO, stdio: 'inherit' });
  if (r.status !== 0) { console.error('No pude instalar las dependencias. Revisa tu conexión y vuelve a intentar.'); process.exit(1); }
}

// 2. Plugin: la copia viaja dentro de esta carpeta (plugin/delivery). Si falta, se busca y se copia.
const BUNDLED = path.join(STUDIO, 'plugin', 'delivery');
const isPlugin = (d) => !!d && fs.existsSync(path.join(d, '.claude-plugin', 'plugin.json'));
const sameDir = (a, b) => path.resolve(a) === path.resolve(b);
function findPluginSource() {
  const cfg = readJson(LOCAL, {});
  const home = os.homedir();
  const direct = [arg('plugin'), cfg.pluginSource, path.join(STUDIO, '..', 'automatizacion-proyectos', 'plugins', 'delivery')]
    .filter(Boolean).map((p) => path.resolve(STUDIO, expand(p)));
  for (const d of direct) if (isPlugin(d) && !sameDir(d, BUNDLED)) return d;
  const skip = new Set(['node_modules', '.git', 'Library', '.Trash']);
  const walk = (dir, depth) => {
    if (depth < 0) return null;
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    if (isPlugin(dir) && path.basename(dir) === 'delivery' && !sameDir(dir, BUNDLED)) return dir;
    for (const e of ents) if (e.isDirectory() && !skip.has(e.name) && !e.name.startsWith('.')) { const f = walk(path.join(dir, e.name), depth - 1); if (f) return f; }
    return null;
  };
  for (const base of ['Documents', 'Desktop', 'Downloads', 'Projects', 'dev']) { const f = walk(path.join(home, base), 5); if (f) return f; }
  return null;
}
function copyPlugin(from) {
  fs.rmSync(BUNDLED, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(BUNDLED), { recursive: true });
  fs.cpSync(from, BUNDLED, { recursive: true, filter: (f) => !/(^|[\\/])(\.DS_Store|\.git|node_modules)([\\/]|$)/.test(f) });
  const local = readJson(LOCAL, {});
  writeJson(LOCAL, { ...local, pluginSource: from });
  console.log(`Plugin copiado a plugin/delivery desde ${from}`);
}
const update = argv.includes('--actualizar-plugin');
if (update || !isPlugin(BUNDLED)) {
  let src = findPluginSource();
  if (!src && !isPlugin(BUNDLED)) {
    console.log('No encontré el plugin "delivery". Elige la carpeta que contiene .claude-plugin y skills.');
    let p = pickFolder('Elige la carpeta del plugin delivery (la que tiene .claude-plugin y skills)');
    if (p === undefined) p = expand(await ask('Ruta de la carpeta del plugin delivery: '));
    if (!isPlugin(p)) { console.error(`Esa carpeta no parece el plugin (falta .claude-plugin/plugin.json): ${p || '(ninguna)'}`); process.exit(1); }
    src = p;
  }
  if (src) copyPlugin(src);
  else console.log('Sin cambios: no encontré una fuente para actualizar el plugin.');
}
const plugin = BUNDLED;
const localCfg = readJson(LOCAL, {});
if (localCfg.pluginPath !== plugin) writeJson(LOCAL, { ...localCfg, pluginPath: plugin });

// 3. Carpeta del cliente
let project = arg('project') ? path.resolve(expand(arg('project'))) : null;
const last = readJson(LAST, {}).project;
if (!project) {
  if (last && fs.existsSync(last)) {
    if (isMac) {
      const r = spawnSync('osascript', ['-e', `button returned of (display dialog "Continuar con el proyecto:\\n${last.replace(/"/g, '')}" buttons {"Otra carpeta", "Continuar"} default button "Continuar")`], { encoding: 'utf8' });
      project = r.stdout.trim() === 'Continuar' ? last : null;
    } else if (isWin) {
      const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Continuar con el proyecto:' + [char]10 + '${last.replace(/'/g, "''")}', 'Delivery Studio', 'YesNo', 'Question')`;
      const r = spawnSync('powershell', ['-NoProfile', '-STA', '-Command', ps], { encoding: 'utf8' });
      if (r.error || r.status !== 0) { const a = await ask(`Proyecto anterior: ${last}\nEnter para continuar o escribe otra ruta: `); project = a ? path.resolve(expand(a)) : last; }
      else project = r.stdout.trim() === 'Yes' ? last : null;
    } else {
      const a = (await ask(`Proyecto anterior: ${last}\nEnter para continuar o escribe otra ruta: `));
      project = a ? path.resolve(expand(a)) : last;
    }
  }
  if (!project) {
    let p = pickFolder('Elige o crea la carpeta del cliente (botón Nueva carpeta)');
    if (p === undefined) p = expand(await ask('Ruta de la carpeta del cliente (se crea si no existe): '));
    if (!p) { console.error('No se eligió ninguna carpeta.'); process.exit(1); }
    project = path.resolve(p);
  }
}
fs.mkdirSync(project, { recursive: true });
writeJson(LAST, { project });

// 4. Servidor: si el puerto ya lo ocupa este mismo programa, reutilizarlo o reiniciarlo en lugar de fallar
const PORT = Number(arg('port') || process.env.PORT || readJson(LOCAL, {}).port || readJson(path.join(STUDIO, 'config.json'), {}).port || 3737);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const openBrowser = (u) => {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [u]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', u]] : ['xdg-open', [u]];
  try { spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref(); } catch { /* abre la URL a mano */ }
};

/** libre | propio {code,proj,activas} | propio-anterior (versión sin identidad) | ajeno */
async function sondear() {
  let r;
  try { r = await fetch(`http://127.0.0.1:${PORT}/api/_id`, { signal: AbortSignal.timeout(2000) }); }
  catch (e) { return String(e?.cause?.code || e?.code || '') === 'ECONNREFUSED' ? { tipo: 'libre' } : { tipo: 'ajeno' }; }
  const t = await r.text().catch(() => '');
  if (r.ok) { try { const j = JSON.parse(t); if (j.app === 'delivery-studio') return { tipo: 'propio', ...j }; } catch { /* no es JSON */ } }
  if (r.status === 401 && t.includes('imprimió el servidor')) return { tipo: 'propio-anterior' };
  return { tipo: 'ajeno' };
}
/** PID del servidor en este puerto: primero el que dejó escrito, y si no, lo que diga el sistema. */
function pidEnPuerto() {
  const t = readJson(TOKEN_FILE, null);
  if (t && t.port === PORT && t.pid) { try { process.kill(t.pid, 0); return t.pid; } catch { /* ya no corre */ } }
  if (process.platform === 'win32') {
    const r = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' }).stdout || '';
    const l = r.split(/\r?\n/).find((x) => new RegExp(`:${PORT}\\s+\\S+\\s+LISTENING\\s+(\\d+)`).test(x));
    const pid = l && Number(/LISTENING\s+(\d+)/.exec(l)?.[1]);
    return pid || null;
  }
  const r = spawnSync('lsof', ['-nP', `-iTCP:${PORT}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
  const pid = Number((r.stdout || '').split('\n')[0]);
  if (!pid) return null;
  const cmd = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).stdout || '';
  return /server\.mjs/.test(cmd) ? pid : null;
}
async function detener(pid) {
  try { process.kill(pid, 'SIGTERM'); } catch { return true; }
  for (let i = 0; i < 40; i++) { await sleep(150); if ((await sondear()).tipo === 'libre') return true; }
  return false;
}
function urlDeSesion() {
  const t = readJson(TOKEN_FILE, null);
  return t && t.port === PORT && t.token ? `http://127.0.0.1:${PORT}/?token=${t.token}` : `http://127.0.0.1:${PORT}/`;
}

const forzar = argv.includes('--reiniciar');
const est = await sondear();
if (est.tipo === 'ajeno') {
  console.error(`El puerto ${PORT} lo usa otro programa (no es Delivery Studio). Ciérralo o arranca con --port <otro>.`);
  process.exit(1);
}
if (est.tipo === 'propio') {
  const mismoProyecto = est.proj === projKey(project);
  const mismoCodigo = est.code === codeHash();
  if (est.activas > 0 && (!mismoProyecto || !mismoCodigo || forzar)) {
    if (!mismoProyecto) {
      console.error(`Delivery Studio ya está abierto con otro proyecto y tiene ${est.activas} ejecución(es) trabajando.\nEspera a que terminen (o deténlas en la interfaz) y vuelve a iniciar.`);
      process.exit(1);
    }
    console.log(`Delivery Studio ya está abierto y tiene ${est.activas} ejecución(es) trabajando, así que no lo reinicio.\nLo abro tal como está${mismoCodigo ? '' : '; los cambios de código se aplican en el próximo arranque sin ejecuciones activas'}.`);
    openBrowser(urlDeSesion());
    process.exit(0);
  }
  if (mismoProyecto && mismoCodigo && !forzar) {
    console.log('Delivery Studio ya está en marcha con este proyecto. Abro la interfaz sin reiniciar.');
    openBrowser(urlDeSesion());
    process.exit(0);
  }
  console.log(forzar ? 'Reiniciando Delivery Studio...' : !mismoProyecto ? 'Estaba abierto con otro proyecto. Reiniciando con el elegido...' : 'El código cambió desde el último arranque. Reiniciando...');
  const pid = pidEnPuerto();
  if (!pid) { console.error(`No pude identificar el proceso que usa el puerto ${PORT}. Ciérralo a mano e intenta de nuevo.`); process.exit(1); }
  if (!(await detener(pid))) { console.error(`No pude detener el servidor anterior (PID ${pid}). Ciérralo a mano e intenta de nuevo.`); process.exit(1); }
} else if (est.tipo === 'propio-anterior') {
  const pid = pidEnPuerto();
  if (!pid) { console.error(`El puerto ${PORT} lo ocupa una versión anterior de Delivery Studio y no pude identificar su proceso. Ciérrala a mano e intenta de nuevo.`); process.exit(1); }
  console.log('Hay una versión anterior de Delivery Studio abierta. La reinicio (solo ocurre esta vez)...');
  if (!(await detener(pid))) { console.error(`No pude detener el servidor anterior (PID ${pid}). Ciérralo a mano e intenta de nuevo.`); process.exit(1); }
}

const r = spawnSync(process.execPath, [path.join(STUDIO, 'server.mjs'), '--project', project, '--plugin', plugin, ...argv.filter((a, i) => !['--project', '--plugin'].includes(argv[i - 1]) && !['--project', '--plugin', '--actualizar-plugin', '--reiniciar'].includes(a))], { stdio: 'inherit' });
process.exit(r.status ?? 0);
