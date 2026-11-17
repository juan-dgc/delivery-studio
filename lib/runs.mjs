import { query } from '@anthropic-ai/claude-agent-sdk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sdkEnv } from './auth.mjs';
import { inside, insideReal } from './files.mjs';
import { claveAprobacion, alcanceDePaso, pasoDeSkill } from './state.mjs';

// Herramientas de solo lectura o de coordinación: nunca piden permiso.
const AUTO_TOOLS = new Set(['Read', 'Glob', 'Grep', 'Skill', 'TodoWrite', 'Agent', 'Task', 'ToolSearch', 'WebSearch', 'WebFetch', 'TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList']);
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const AGENT_TOOLS = new Set(['Task', 'Agent']);
/**
 * Explorar una aplicación son cientos de clics y lecturas: pedir permiso por cada uno haría el
 * paso inservible. Se permiten las acciones de navegar y leer, que es lo que hace la exploración.
 * Quedan fuera, y siguen preguntando, las que ejecutan código en la página o suben archivos.
 */
const BROWSER_OK = new Set(['browser_close', 'browser_resize', 'browser_console_messages', 'browser_handle_dialog',
  'browser_emulate_media', 'browser_find', 'browser_fill_form', 'browser_press_key', 'browser_type', 'browser_navigate',
  'browser_navigate_back', 'browser_network_requests', 'browser_network_request', 'browser_take_screenshot',
  'browser_snapshot', 'browser_click', 'browser_drag', 'browser_drop', 'browser_hover', 'browser_select_option',
  'browser_tabs', 'browser_wait_for']);
const nombreBrowser = (n) => /^mcp__[^_]*playwright[^_]*__(.+)$/i.exec(n)?.[1] || null;
// Comandos seguros siempre: scripts del pipeline y listados.
const ARG = "[^\\r\\n;&|`$<>]";
// Programas de solo inspección: no escriben, no descargan y no ejecutan nada más.
// `cat` era, con diferencia, el que más permisos pedía: el modelo prefiere leer varios archivos
// en un comando antes que uno por llamada. Leer ya estaba permitido sin preguntar con Read, Glob
// y Grep, así que pedir permiso por la terminal no protegía de nada: solo estorbaba. Aquí nada
// escribe, descarga ni ejecuta otra cosa (ARG excluye tuberías, redirecciones y encadenados, y
// find o sed destructivos caen en RISKY).
const LEER = '(?:cat|nl|more|type|head|tail|wc|stat|file|basename|dirname|du|find|grep|egrep|fgrep|rg|findstr|Get-Content|sed[ \\t]+-n|pdfinfo|pdftotext|ffprobe|identify|sips|mdls|which|command[ \\t]+-v|unzip[ \\t]+-l|tar[ \\t]+-tf|git[ \\t]+(?:status|log|diff|rev-parse|show))';
const SAFE_SHELL = new RegExp(
  `^[ \\t]*(?:(?:cd|pushd)[ \\t]+${ARG}+(?:&&|;)[ \\t]*)?(?:`
  + `(?:python3?|py(?:[ \\t]+-3)?)[ \\t]+["']?\\.pipeline[\\\\/]scripts[\\\\/][\\w.-]+\\.py["']?(?:[ \\t]+${ARG}*)?`
  + `|ls(?:[ \\t]+${ARG}*)?|pwd|dir(?:[ \\t]+${ARG}*)?`
  + `|mkdir[ \\t]+-p[ \\t]+${ARG}+`
  + `|${LEER}(?:[ \\t]+${ARG}*)?`
  + `)[ \\t]*$`, 'i');
// En modo automático se pregunta solo por esto.
const RISKY = /\bgit\s+(push|reset\s+--hard|clean|checkout\s+--\s|branch\s+-D)\b|\brm\s+-[a-z]*[rf]|\bsudo\b|\bmkfs\b|\bdd\s+if=|\bnpm\s+publish\b|\bgh\s+(pr\s+merge|repo\s+delete|release)\b|(curl|wget)[^|]*\|\s*(ba|z)?sh\b|\bRemove-Item\b[^|]*-Recurse|\bdel\s+\/[sq]\b|\brmdir\s+\/s\b|\bkubectl\b|\bterraform\s+apply\b|\bfind\b[^\r\n]*\s-(?:delete|exec|execdir|ok|okdir|fprint|fls)\b|\bsed\b[^\r\n]*\s-[a-z]*i\b/i;

// Lo que se guarda en memoria al arrancar: el disco conserva el historial completo.
const MAX_EVENTOS_MEM = 1500;
const MAX_RUNS_MEM = 80;

/**
 * Carpetas fuera del proyecto donde el usuario autorizó escribir. Solo salen de lo que él
 * escribe: el campo «Instrucciones adicionales» antes de ejecutar, o sus respuestas durante la
 * ejecución. Nunca de lo que diga la skill, porque entonces se autorizaría a sí misma.
 */
function rutasDelUsuario(texto) {
  const out = [];
  // Rutas absolutas de Unix o de Windows, con al menos dos niveles: ni «/» ni la carpeta personal.
  const re = /(?:^|[\s"'=(])((?:~|\/|[A-Za-z]:[\\/])[\w.~ -]*(?:[\\/][\w.-]+){1,}\/?)/g;
  for (const m of String(texto || '').matchAll(re)) {
    const bruta = m[1].replace(/[.,;:)]+$/, '').trim();
    const abs = path.resolve(bruta.replace(/^~/, os.homedir()));
    const partes = abs.split(path.sep).filter(Boolean);
    if (partes.length < 2) continue;                       // «/», «/Users», «C:\» no
    if (abs === os.homedir()) continue;                    // la carpeta personal entera, tampoco
    if (/(^|[\\/])\.(ssh|aws|gnupg|config|claude)([\\/]|$)/i.test(abs)) continue; // zonas de credenciales
    if (!out.includes(abs)) out.push(abs);
  }
  return out;
}

/** ¿Puede escribirse aquí sin preguntar? El proyecto, siempre; fuera, solo lo que el usuario abrió. */
function puedeEscribir(run, root, p) {
  if (insideReal(root, p)) return true;
  const abs = path.resolve(root, p);
  return (run.permitidas || []).some((base) => inside(base, abs) || abs === base);
}

/**
 * Un comando de la lista permitida solo pasa si trabaja dentro del proyecto. Sin esto, abrir
 * `cat` de par en par dejaría leer `~/.ssh/id_rsa` sin preguntar. Se permite el `cd` inicial a
 * la carpeta del proyecto, y se rechaza cualquier otra ruta absoluta o de inicio (~).
 */
function soloEnProyecto(root, cmd) {
  const m = /^[ \t]*(?:cd|pushd)[ \t]+("[^"\r\n]+"|'[^'\r\n]+'|[^\r\n;&|`$<>]+?)[ \t]*(?:&&|;)[ \t]*/i.exec(cmd);
  if (m) {
    const destino = m[1].replace(/^["']|["']$/g, '').trim();
    if (!inside(path.resolve(root), path.resolve(root, destino.replace(/^~/, os.homedir())))) return false;
  }
  const resto = m ? cmd.slice(m[0].length) : cmd;
  // ~ o una ruta que arranca en la raíz (o en una unidad de Windows) sale del proyecto
  return !/(^|[\s"'=])(~|\/|[A-Za-z]:[\\/])/.test(resto);
}

/**
 * Navegador ya instalado que puede usar Playwright, para no descargar un Chromium de cientos de
 * megas. Si no hay ninguno conocido se devuelve null y Playwright usa el suyo: entonces la skill
 * necesita `browser_install`, que pide permiso porque es una descarga grande.
 */
function canalInstalado() {
  const candidatos = process.platform === 'darwin'
    ? [['chrome', '/Applications/Google Chrome.app'], ['msedge', '/Applications/Microsoft Edge.app'], ['chromium', '/Applications/Chromium.app']]
    : process.platform === 'win32'
      ? [['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'], ['chrome', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'],
        ['msedge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'], ['msedge', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']]
      : [['chrome', '/usr/bin/google-chrome'], ['chrome', '/opt/google/chrome/chrome'], ['chromium', '/usr/bin/chromium'], ['chromium', '/usr/bin/chromium-browser'], ['msedge', '/usr/bin/microsoft-edge']];
  for (const [canal, ruta] of candidatos) { try { if (fs.existsSync(ruta)) return canal; } catch { /* siguiente */ } }
  return null;
}

/**
 * Programa que ejecuta un comando de terminal, saltando el `cd` inicial. Null si no se reconoce.
 * Se queda con el nombre del ejecutable, no con su ruta: en Windows `C:\\Python311\\python.exe`
 * debe recordarse como «python.exe» y nunca como «C», que autorizaría cualquier ruta del disco C.
 */
function programa(cmd) {
  const limpio = String(cmd || '').replace(/^[ \t]*(?:cd|pushd)[ \t]+(?:"[^"\r\n]*"|[^\r\n;&|`$<>]+?)[ \t]*(?:&&|;)[ \t]*/i, '').trim();
  const m = /^(?:"([^"\r\n]+)"|([^\s"'`;&|<>]+))/.exec(limpio);
  const ruta = m && (m[1] || m[2]);
  if (!ruta) return null;
  const nombre = ruta.split(/[\\/]/).pop();
  return nombre && /^[\w.+-]{1,40}$/.test(nombre) ? nombre : null;
}

const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const allow = (input) => ({ behavior: 'allow', updatedInput: input });

function summarize(name, input = {}) {
  if (SHELL_TOOLS.has(name)) return String(input.command || '').slice(0, 500);
  if (name === 'Skill') return `${input.skill || ''} ${input.args || ''}`.trim();
  if (input.file_path) return String(input.file_path);
  if (input.notebook_path) return String(input.notebook_path);
  if (input.pattern) return String(input.pattern);
  if (input.url) return String(input.url);
  if (input.query) return String(input.query);
  return JSON.stringify(input).slice(0, 300);
}

export class RunManager {
  constructor({ cfg, root, broadcast, usage }) {
    this.usage = usage || null;
    this.cfg = cfg;
    this.root = root;
    this.broadcast = broadcast;
    this.runs = new Map();
    this.dir = path.join(root, '.delivery-ui', 'runs');
    this.approvalsFile = path.join(root, '.delivery-ui', 'approvals.json');
    try { this.approvals = JSON.parse(fs.readFileSync(this.approvalsFile, 'utf8')); } catch { this.approvals = {}; }
    this.load();
    this.usage?.backfill(this.runs);
  }

  // ---------------------------------------------------------------- persistencia
  load() {
    let files = [];
    try {
      files = fs.readdirSync(this.dir).filter((f) => f.endsWith('.jsonl'))
        .map((f) => { let t = 0; try { t = fs.statSync(path.join(this.dir, f)).mtimeMs; } catch { /* se queda en 0 */ } return { f, t }; })
        .sort((a, b) => b.t - a.t).slice(0, MAX_RUNS_MEM).map((x) => x.f);
    } catch { return; }
    for (const f of files) {
      try {
        const lines = fs.readFileSync(path.join(this.dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
        const meta = lines.find((l) => l.type === 'run_start');
        if (!meta) continue;
        // El estado se deduce del historial completo, pero en memoria solo se queda la cola.
        const recortado = lines.length > MAX_EVENTOS_MEM;
        const enMem = recortado ? [meta, ...lines.slice(-MAX_EVENTOS_MEM)] : lines;
        const run = { ...meta.run, events: enMem, recortado, pending: new Map(), allowTools: new Set(), allowCmds: new Set(), files: new Set(meta.run.files || []), abort: null };
        const sid = [...lines].reverse().find((l) => l.type === 'init')?.sessionId;
        if (sid) run.sessionId = sid;
        run.permitidas = [...new Set(lines.filter((l) => l.type === 'user').flatMap((l) => rutasDelUsuario(l.text)))];
        run.subs = Object.fromEntries(lines.filter((l) => l.type === 'subagente' && l.subId).map((l) => [l.subId, l.nombre]));
        const realc = [...lines].reverse().find((l) => l.type === 'alcance');
        if (realc) { run.alcance = realc.alcance; run.clave = `${run.skill}|${realc.alcance}`; }
        const last = [...lines].reverse().find((l) => l.type === 'status')?.status;
        run.status = last === 'running' ? (run.sessionId ? 'esperando' : 'cerrada') : last || 'cerrada';
        for (const e of lines) if (e.type === 'file') run.files.add(e.path);
        const res = [...lines].reverse().find((l) => l.type === 'result');
        run.hasResult = !!res; run.lastOk = res ? !!res.ok : true;
        this.runs.set(run.id, run);
      } catch { /* línea dañada: se ignora esa corrida */ }
    }
  }

  persist(run, ev) {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.appendFileSync(path.join(this.dir, `${run.id}.jsonl`), JSON.stringify(ev) + '\n');
    } catch { /* el historial nunca debe tumbar una ejecución */ }
  }

  emit(run, ev) {
    const full = { ts: Date.now(), runId: run.id, ...ev };
    run.events.push(full);
    if (run.events.length > 6000) run.events.splice(1, 500);
    this.persist(run, full);
    this.broadcast({ type: 'run_event', runId: run.id, ev: full });
    return full;
  }

  setStatus(run, status) {
    run.status = status;
    this.emit(run, { type: 'status', status });
    this.broadcast({ type: 'runs_changed' });
    this.broadcast({ type: 'state_changed' });
  }

  // ---------------------------------------------------------------- consulta
  summary(run) {
    return {
      id: run.id, skill: run.skill, title: run.title, status: run.status, model: run.model, approval: run.approval, alcance: run.alcance || null,
      args: run.args || '', instruction: run.instruction || '', hasResult: !!run.hasResult, ok: run.lastOk !== false,
      aprobable: run.status === 'esperando' && !!run.hasResult && run.lastOk !== false,
      started: run.started, turnoDesde: run.turnoDesde || null, cost: run.cost || 0, turns: run.turns || 0, hasSession: !!run.sessionId, recortado: !!run.recortado,
      files: [...run.files], pending: [...run.pending.keys()].length,
      // Pregunta del registro que quedó sin respuesta tras un reinicio: se puede contestar igual.
      huerfana: run.pending.size === 0 && run.status !== 'running' && run.sessionId ? this.huerfana(run)?.id || null : null,
    };
  }
  list() { return [...this.runs.values()].sort((a, b) => b.started - a.started).map((r) => this.summary(r)); }
  get(id) { return this.runs.get(id); }
  /** Skills con una ejecución viva que aún no se aprobó: bloquean a las que dependen de ellas. */
  activos() {
    const out = {};
    for (const r of this.runs.values()) {
      if (r.status !== 'running' && r.status !== 'esperando') continue;
      (out[r.skill] ||= []).push({ runId: r.id, status: r.status, alcance: r.alcance || null });
    }
    return out;
  }
  /**
   * El lote se fija al lanzar, desde el argumento del comando, pero varias skills lo preguntan
   * dentro de la conversación. Cuando la corrida demuestra en qué lote está trabajando (abre la
   * corrida del paso o escribe el entregable en su carpeta), la etiqueta se corrige aquí: si no,
   * la tarjeta diría un lote y la aprobación se guardaría con otro.
   */
  /**
   * Una skill que se confunde repite su trabajo en carpetas nuevas en vez de avanzar (se vio con
   * una ingesta que rehízo los mismos documentos en _borrador/A, /B, /C...). No se corta la
   * ejecución, porque a veces repetir es legítimo, pero se avisa en cuanto el patrón es claro.
   */
  vigilarRepeticion(run, rel) {
    const nombre = rel.split('/').pop();
    if (!nombre) return;
    run.porNombre ||= new Map();
    const carpetas = run.porNombre.get(nombre) || new Set();
    carpetas.add(rel.slice(0, rel.length - nombre.length));
    run.porNombre.set(nombre, carpetas);
    if (carpetas.size !== 3) return; // se avisa una sola vez, al tercero
    this.emit(run, { type: 'hint', kind: 'repite', text: `«${nombre}» ya se escribió en ${carpetas.size} carpetas distintas (${[...carpetas].map((c) => c || './').join(', ')}). Puede estar repitiendo el trabajo en vez de avanzar.` });
  }

  reetiquetar(run, alc) {
    const v = String(alc || '').trim();
    if (!v || v === run.alcance) return;
    if (!/^[\w.-]{1,40}$/.test(v)) return;
    const esc = alcanceDePaso(this.cfg, this.root, run.skill);
    if (esc !== 'lote' && esc !== 'integracion') return; // los pasos de proyecto no llevan lote
    const antes = run.alcance || null;
    run.alcance = v;
    run.clave = `${run.skill}|${v}`;
    this.emit(run, { type: 'alcance', alcance: v, antes });
    this.broadcast({ type: 'runs_changed' });
    this.broadcast({ type: 'state_changed' });
  }

  /**
   * Muchas skills preguntan el alcance en vez de recibirlo como argumento. Si la respuesta nombra
   * un lote reconocible, la etiqueta se adelanta; cuando después escriba el entregable, se confirma.
   */
  alcanceDeRespuestas(run, answers) {
    for (const [preg, resp] of Object.entries(answers || {})) {
      if (!/alcance|lote|sprint|m[oó]dulo|[eé]pica/i.test(preg)) continue;
      const m = /\b((?:sprint|lote|mod|int|ep|epic)[-_]\d{1,3})\b/i.exec(String(resp || ''));
      if (!m) continue;
      this.reetiquetar(run, m[1].replace(/_/g, '-'));
      return;
    }
  }

  /** Lee el lote de lo que la corrida acaba de hacer: `pipeline.py run new <paso> <alc>` o un archivo en outputs/<paso>/<alc>/. */
  olfatearAlcance(run, { cmd = '', rel = '' } = {}) {
    const paso = pasoDeSkill(this.cfg, run.skill);
    if (!paso) return;
    if (cmd) {
      const m = new RegExp(`pipeline\\.py\\s+run\\s+new\\s+${paso}\\s+([\\w.-]+)`).exec(cmd)
        || new RegExp(`pipeline\\.py\\s+alcance\\s+(?:set|add)\\s+([\\w.-]+)`).exec(cmd);
      if (m) this.reetiquetar(run, m[1]);
    }
    if (rel) {
      const m = new RegExp(`^outputs/${paso}/([^/]+)/`).exec(rel);
      if (m) this.reetiquetar(run, m[1]);
    }
  }

  /**
   * Última ejecución de cada skill (por lote) que terminó en error y nadie ha descartado.
   * Sin esto el diagrama de pasos olvida el fallo: la skill vuelve a verse «Pendiente».
   */
  fallidos() {
    const ultima = {};
    for (const r of this.runs.values()) {
      const k = `${r.skill}|${r.alcance || ''}`;
      if (!ultima[k] || r.started > ultima[k].started) ultima[k] = r;
    }
    const out = {};
    for (const r of Object.values(ultima)) {
      if (r.status !== 'error') continue;
      (out[r.skill] ||= []).push({ runId: r.id, alcance: r.alcance || null, ts: r.started });
    }
    return out;
  }

  saveApprovals() {
    try { fs.mkdirSync(path.dirname(this.approvalsFile), { recursive: true }); fs.writeFileSync(this.approvalsFile, JSON.stringify(this.approvals, null, 2)); } catch { /* no tumba la ejecución */ }
  }
  /**
   * Repetir un paso restablece su aprobación y la de los pasos que dependen de él. No borra documentos.
   * Si el paso repetido es de un lote, solo se tocan las aprobaciones de ese lote y las de proyecto:
   * lo aprobado para otro sprint sigue en pie.
   */
  resetApprovals(skills, alcance = null) {
    let n = 0;
    for (const sk of skills) {
      for (const k of Object.keys(this.approvals)) {
        if (k !== sk && !k.startsWith(`${sk}|`)) continue;
        const alcK = k.includes('|') ? k.slice(sk.length + 1) : null;
        if (alcance && alcK && alcK !== alcance) continue;
        delete this.approvals[k]; n++;
      }
    }
    if (n) this.saveApprovals();
    return n;
  }
  approve(id) {
    const run = this.runs.get(id);
    if (!run) throw Object.assign(new Error('Ejecución no encontrada.'), { status: 404 });
    if (!(run.status === 'esperando' && run.hasResult && run.lastOk !== false)) throw Object.assign(new Error('Solo se puede aprobar cuando la skill ya respondió y no está trabajando.'), { status: 409 });
    const clave = run.clave || claveAprobacion(this.cfg, this.root, run.skill, run.args).clave;
    this.approvals[clave] = { runId: id, ts: Date.now(), args: run.args || '' };
    this.saveApprovals();
    this.emit(run, { type: 'approved' });
    this.setStatus(run, 'aprobada');
  }

  // ---------------------------------------------------------------- ciclo de vida
  start({ skill, args, instruction, model, approval, title, verNavegador }) {
    const vivas = [...this.runs.values()].filter((r) => r.status === 'running');
    if (vivas.some((r) => r.skill === skill)) throw Object.assign(new Error('Esa skill ya está trabajando. Espera a que termine o deténla.'), { status: 409 });
    if (vivas.length >= 3) throw Object.assign(new Error('Ya hay 3 skills trabajando a la vez. Espera a que termine alguna.'), { status: 409 });
    if (!this.cfg.pluginOk) throw Object.assign(new Error(`No encuentro el plugin en ${this.cfg.pluginPath}. Revisa pluginPath en config.json.`), { status: 400 });
    if (!/^[a-z0-9-]+$/.test(skill)) throw Object.assign(new Error('Nombre de skill inválido.'), { status: 400 });
    // La ejecución anterior de esta skill que esperaba aprobación queda reemplazada: no puede haber dos por aprobar.
    for (const r of [...this.runs.values()]) {
      if (r.skill === skill && r.status === 'esperando') { this.emit(r, { type: 'note', text: 'Reemplazada por una ejecución nueva de este paso.' }); this.close(r.id); }
    }
    const prompt = [`/${this.cfg.pluginName}:${skill}`, (args || '').trim(), (instruction || '').trim()].filter(Boolean).join(' ');
    const { clave, alcance } = claveAprobacion(this.cfg, this.root, skill, args);
    const run = {
      id: uid('run'), skill, title: title || skill, args: args || '', instruction: instruction || '', prompt, clave, alcance,
      model: model || this.cfg.defaultModel, approval: approval === 'auto' ? 'auto' : 'preguntar', verNavegador: !!verNavegador,
      permitidas: rutasDelUsuario(instruction),
      started: Date.now(), status: 'running', events: [], pending: new Map(), allowTools: new Set(), allowCmds: new Set(), files: new Set(), cost: 0, turns: 0, abort: null,
    };
    this.runs.set(run.id, run);
    this.emit(run, { type: 'run_start', run: { id: run.id, skill, title: run.title, args: run.args, instruction: run.instruction, prompt, clave, alcance, model: run.model, approval: run.approval, started: run.started } });
    this.emit(run, { type: 'user', text: prompt });
    this.turn(run, prompt);
    return this.summary(run);
  }

  reply(id, text) {
    const run = this.runs.get(id);
    if (!run) throw Object.assign(new Error('Ejecución no encontrada.'), { status: 404 });
    if (run.status === 'running') throw Object.assign(new Error('La skill sigue trabajando. Responde cuando pida algo o espera a que termine el turno.'), { status: 409 });
    if (run.status === 'aprobada') throw Object.assign(new Error('Esta etapa ya está aprobada. Ejecuta la skill de nuevo para hacer cambios.'), { status: 409 });
    if (!run.sessionId) throw Object.assign(new Error('Esta ejecución no tiene sesión para continuar.'), { status: 400 });
    this.emit(run, { type: 'user', text });
    this.abrirRutas(run, text);
    this.turn(run, text);
  }

  /** El usuario detiene la ejecución y escribe otra ruta: a partir de ahí también se escribe ahí. */
  abrirRutas(run, texto) {
    for (const r of rutasDelUsuario(texto)) {
      if (!(run.permitidas ||= []).includes(r)) {
        run.permitidas.push(r);
        this.emit(run, { type: 'note', text: `Autorizaste escribir en ${r} durante esta ejecución.` });
      }
    }
  }

  stop(id) {
    const run = this.runs.get(id);
    if (!run) return;
    for (const [qid, p] of run.pending) { p.resolve({ behavior: 'deny', message: 'Ejecución detenida por el usuario.', interrupt: true }); run.pending.delete(qid); }
    run.abort?.abort();
  }

  close(id) {
    const run = this.runs.get(id);
    if (!run) return;
    this.stop(id);
    if (run.status !== 'running') this.setStatus(run, 'cerrada');
  }

  /**
   * Una pregunta sin resolver del registro, cuando ya no hay nadie esperándola en memoria.
   * Pasa al reiniciar el servidor: la conversación del SDK sobrevive, la promesa no.
   */
  huerfana(run) {
    const resueltas = new Set(run.events.filter((e) => e.type === 'resolved').map((e) => e.id));
    return [...run.events].reverse().find((e) => e.type === 'question' && !resueltas.has(e.id)) || null;
  }

  /** Responde esa pregunta como un turno normal: el usuario no tiene que reescribirla a mano. */
  reanudarConRespuestas(run, qid, payload) {
    const q = this.huerfana(run);
    if (!q || q.id !== qid) throw Object.assign(new Error('Esa pregunta ya no está pendiente.'), { status: 404 });
    if (run.status === 'running') throw Object.assign(new Error('La skill está trabajando. Espera a que termine el turno.'), { status: 409 });
    if (!run.sessionId) throw Object.assign(new Error('Esta ejecución no tiene conversación que reanudar: vuelve a ejecutar el paso.'), { status: 400 });
    const texto = payload.skip
      ? 'No voy a responder esas preguntas ahora. Continúa con lo que puedas sin ellas, o detente y dime qué te falta.'
      : ['Se reinició el panel y tus preguntas quedaron sin respuesta. Estas son:', '',
        ...Object.entries(payload.answers || {}).map(([preg, resp]) => `- ${preg}\n  ${resp}`), '', 'Continúa desde aquí.'].join('\n');
    this.emit(run, { type: 'resolved', id: qid, kind: 'question', answers: payload.skip ? null : payload.answers });
    if (!payload.skip) this.alcanceDeRespuestas(run, payload.answers);
    this.emit(run, { type: 'user', text: texto });
    this.turn(run, texto);
    this.broadcast({ type: 'runs_changed' });
  }

  answer(runId, qid, payload) {
    const run = this.runs.get(runId);
    if (!run) throw Object.assign(new Error('Ejecución no encontrada.'), { status: 404 });
    const p = run.pending.get(qid);
    if (!p) return this.reanudarConRespuestas(run, qid, payload);
    run.pending.delete(qid);
    if (p.kind === 'question') {
      if (payload.skip) p.resolve({ behavior: 'deny', message: 'El usuario prefirió no responder estas preguntas ahora. Continúa con lo que puedas sin ellas, o detente y dile qué te falta.' });
      else p.resolve({ behavior: 'allow', updatedInput: { ...p.input, answers: payload.answers || {} } });
      this.emit(run, { type: 'resolved', id: qid, kind: 'question', answers: payload.skip ? null : payload.answers });
      if (!payload.skip) this.alcanceDeRespuestas(run, payload.answers);
    } else {
      if (payload.decision === 'allow') {
        if (payload.remember) {
          // En la terminal no se recuerda «Bash» entero, solo el programa concreto que se autorizó.
          if (SHELL_TOOLS.has(p.tool)) { const prog = programa(String(p.input?.command || '')); if (prog) (run.allowCmds ||= new Set()).add(prog); }
          else run.allowTools.add(p.tool);
        }
        p.resolve(allow(p.input));
      } else p.resolve({ behavior: 'deny', message: payload.message || 'El usuario no autorizó esta acción. Propón otra forma o pregúntale.' });
      this.emit(run, { type: 'resolved', id: qid, kind: 'permission', decision: payload.decision });
    }
    this.broadcast({ type: 'runs_changed' });
  }

  // ---------------------------------------------------------------- permisos
  async decide(run, name, input, opts) {
    if (name === 'AskUserQuestion') return this.ask(run, 'question', name, input, opts.signal, { questions: input.questions });
    if (AUTO_TOOLS.has(name) || run.allowTools?.has(name)) return allow(input);
    if (WRITE_TOOLS.has(name)) {
      const p = input.file_path || input.notebook_path;
      if (p && puedeEscribir(run, this.root, p)) return allow(input);
    }
    const cmd = SHELL_TOOLS.has(name) ? String(input.command || '') : '';
    // Un comando con salto de línea puede esconder una segunda orden detrás de una permitida: siempre se pregunta.
    const multi = /[\r\n]/.test(cmd);
    const variables = /\$[A-Za-z_{(]/.test(cmd);
    const peligroso = !!cmd && RISKY.test(cmd);      // hace algo que no se deshace
    const opaco = !!cmd && (multi || variables);     // no se puede saber qué hará sin ejecutarlo
    const riesgoso = peligroso || opaco;
    if (SHELL_TOOLS.has(name) && !riesgoso) {
      if (SAFE_SHELL.test(cmd) && soloEnProyecto(this.root, cmd)) return allow(input);
      if (run.approval === 'auto') return allow(input);
      // Un programa que el usuario ya autorizó en esta ejecución no se vuelve a preguntar.
      const prog = programa(cmd);
      if (prog && run.allowCmds?.has(prog)) return allow(input);
    }
    const nb = nombreBrowser(name);
    if (nb && BROWSER_OK.has(nb)) return allow(input);
    if (run.approval === 'auto' && nb) return allow(input);
    const motivo = peligroso ? 'Este comando hace algo que no se deshace. Léelo entero antes de permitirlo.'
      : variables && multi ? 'El comando guarda una orden en una variable y la reutiliza en varias líneas, así que no se puede saber qué va a ejecutar sin resolverla. Léelo entero.'
        : variables ? 'El comando usa una variable: lo que ejecute depende de su valor, que no se conoce de antemano.'
          : multi ? 'El comando tiene más de una línea: revísalas todas antes de permitirlo.' : '';
    return this.ask(run, 'permission', name, input, opts.signal, {
      tool: name, programa: riesgoso ? null : programa(cmd), summary: summarize(name, input),
      // El motivo del SDK viene en inglés; solo se usa si no tenemos uno propio.
      reason: motivo || opts.decisionReason || '', risky: peligroso, opaco: opaco && !peligroso,
    });
  }

  ask(run, kind, tool, input, signal, extra) {
    const id = uid(kind === 'question' ? 'q' : 'p');
    return new Promise((resolve) => {
      run.pending.set(id, { kind, tool, input, resolve });
      signal?.addEventListener('abort', () => {
        if (run.pending.delete(id)) resolve({ behavior: 'deny', message: 'Cancelado.' });
      }, { once: true });
      this.emit(run, { type: kind, id, ...extra });
      this.broadcast({ type: 'runs_changed' });
    });
  }

  hint(run, kind, text) {
    run.hinted ??= new Set();
    if (run.hinted.has(kind)) return;
    run.hinted.add(kind);
    this.emit(run, { type: 'hint', kind, text });
  }

  // ---------------------------------------------------------------- un turno
  async turn(run, prompt) {
    const ac = new AbortController();
    run.abort = ac;
    run.hinted = new Set();
    run.lastOk = true;
    run.lastText = '';
    run.pulso = 0; run.pulsoTs = 0;
    run.turnoDesde = Date.now(); // el reloj de actividad cuenta el turno, no la etapa entera
    this.setStatus(run, 'running');
    const options = {
      cwd: this.root,
      model: run.model,
      abortController: ac,
      plugins: [{ type: 'local', path: this.cfg.pluginPath }],
      settingSources: ['project'],
      permissionMode: 'default',
      canUseTool: (name, input, opts) => this.decide(run, name, input, opts),
      env: sdkEnv(this.cfg, this.root),
      stderr: (d) => { const t = String(d).trim(); if (/error|fail|denied|not logged|auth/i.test(t)) this.emit(run, { type: 'stderr', text: t.slice(0, 600) }); },
    };
    // Con un entregable grande (cientos de casos de prueba) el modelo puede pasar minutos
    // escribiendo un solo bloque sin que llegue ningún mensaje completo. Los eventos parciales
    // son la única forma de distinguir «pensando» de «colgado»; no se guardan en el historial,
    // solo se difunden como pulso.
    // El navegador lo pone la app, no el usuario: sin esto la skill no encuentra herramientas
    // browser_* y acaba mandándole instalar el MCP a mano en una terminal.
    const mcp = this.navegador(run);
    if (mcp) options.mcpServers = mcp;
    options.includePartialMessages = true;
    if (this.cfg.maxTurns) options.maxTurns = this.cfg.maxTurns;
    if (run.sessionId) options.resume = run.sessionId;
    let gotResult = false;
    try {
      for await (const m of query({ prompt, options })) {
        if (m.type === 'result') gotResult = true;
        this.handle(run, m);
      }
      this.setStatus(run, !run.lastOk ? 'error' : (run.sessionId || run.hasResult) ? 'esperando' : 'cerrada');
    } catch (e) {
      if (ac.signal.aborted) {
        this.emit(run, { type: 'note', text: 'Ejecución detenida.' });
        this.setStatus(run, run.sessionId ? 'esperando' : 'cerrada');
      } else {
        // El SDK lanza una excepción después de un resultado con error: ya lo mostramos en la tarjeta de resultado.
        if (!(gotResult && !run.lastOk && /returned an error result/i.test(String(e?.message)))) {
          this.emit(run, { type: 'error', text: String(e?.message || e).slice(0, 1200) });
          if (/log ?in|authenticat|credential/i.test(String(e?.message))) this.hint(run, 'auth', 'Parece que no hay sesión de Claude iniciada.');
        }
        this.setStatus(run, 'error');
      }
    } finally {
      run.abort = null;
      for (const [qid, p] of run.pending) { p.resolve({ behavior: 'deny', message: 'La ejecución terminó.' }); run.pending.delete(qid); }
      this.broadcast({ type: 'state_changed' });
      if (!gotResult && !ac.signal.aborted) this.broadcast({ type: 'runs_changed' });
    }
  }

  /**
   * MCP de Playwright para las skills marcadas con `navegador` en el catálogo. El perfil vive en
   * el proyecto, así que la sesión que el usuario inicie una vez queda guardada y las corridas
   * siguientes entran autenticadas. Usa el Chrome ya instalado en vez de descargar un Chromium.
   */
  navegador(run) {
    const sk = (this.cfg.catalog?.skills || []).find((x) => x.skill === run.skill);
    if (!sk?.navegador) return null;
    const cfgN = this.cfg.navegador || {};
    if (cfgN.habilitado === false) return null;
    const perfil = path.join(this.root, '.delivery-ui', 'navegador');
    try { fs.mkdirSync(perfil, { recursive: true }); } catch { /* si no se puede, el MCP usa uno temporal */ }
    const args = ['-y', '@playwright/mcp@latest', '--user-data-dir', perfil, '--test-id-attribute', cfgN.testId || 'data-testid'];
    // «auto» (lo normal): se usa el navegador que la persona ya tenga. Un canal fijo que no esté
    // instalado haría fallar el arranque del MCP, y la skill se quedaría sin navegador sin saber por qué.
    const canal = !cfgN.canal || cfgN.canal === 'auto' ? canalInstalado() : cfgN.canal;
    if (canal) args.push('--browser', canal);
    // Sin ventana salvo que el usuario quiera verlo: la primera vez la skill la pide para el login.
    if (!run.verNavegador && !cfgN.verVentana) args.push('--headless');
    const salida = path.join(this.root, '.delivery-ui', 'navegador-salidas');
    try { fs.mkdirSync(salida, { recursive: true }); } catch { /* opcional */ }
    args.push('--output-dir', salida);
    return { playwright: { type: 'stdio', command: process.platform === 'win32' ? 'npx.cmd' : 'npx', args } };
  }

  /** Señal de que la ejecución sigue produciendo. No entra al historial: se difunde y se olvida. */
  pulso(run, chars, modo) {
    run.pulso = (run.pulso || 0) + chars;
    const ahora = Date.now();
    if (ahora - (run.pulsoTs || 0) < 400) return; // como mucho dos veces por segundo
    run.pulsoTs = ahora;
    this.broadcast({ type: 'pulso', runId: run.id, chars: run.pulso, modo });
  }

  handle(run, m) {
    // Cada subagente trae el id de la herramienta que lo lanzó: así se sabe cuál de ellos habla.
    const subId = m.parent_tool_use_id || null;
    const sub = !!subId;
    switch (m.type) {
      case 'stream_event': {
        const e = m.event;
        if (e?.type === 'content_block_start') { run.pulso = 0; run.pulsoModo = e.content_block?.type === 'tool_use' ? 'herramienta' : 'texto'; }
        else if (e?.type === 'content_block_delta') {
          const d = e.delta || {};
          const n = (d.text || d.partial_json || d.thinking || '').length;
          if (n) this.pulso(run, n, run.pulsoModo || 'texto');
        }
        break;
      }
      case 'system':
        if (m.subtype === 'init') {
          run.sessionId = m.session_id;
          this.emit(run, { type: 'init', sessionId: m.session_id, model: m.model, tools: Array.isArray(m.tools) ? m.tools.length : undefined });
        }
        break;
      case 'assistant': {
        if (m.error) {
          const kind = ['authentication_failed', 'oauth_org_not_allowed', 'account_on_hold', 'verification_required', 'cloud_credential_error'].includes(m.error) ? 'auth' : ['rate_limit', 'billing_error', 'overloaded'].includes(m.error) ? 'limit' : 'error';
          this.hint(run, kind, m.error);
        }
        for (const b of m.message?.content || []) {
          if (b.type === 'text' && b.text?.trim()) { if (!sub) run.lastText = b.text; this.emit(run, { type: 'text', text: b.text, sub, subId, subNom: run.subs?.[subId] }); }
          else if (b.type === 'tool_use') {
            if (b.name === 'AskUserQuestion') continue; // se muestra como tarjeta de pregunta
            // El nombre de cada subagente se aprende aquí, al lanzarlo, y se reusa en todo lo que haga.
            if (AGENT_TOOLS.has(b.name) && b.id) {
              (run.subs ||= {})[b.id] = String(b.input?.description || b.input?.subagent_type || 'subagente').slice(0, 60);
              this.emit(run, { type: 'subagente', subId: b.id, nombre: run.subs[b.id], tarea: String(b.input?.prompt || '').slice(0, 300) });
            }
            this.emit(run, { type: 'tool', tool: b.name, summary: summarize(b.name, b.input), sub, subId, subNom: run.subs?.[subId] });
            if (SHELL_TOOLS.has(b.name)) this.olfatearAlcance(run, { cmd: String(b.input?.command || '') });
            const p = b.input?.file_path;
            if ((b.name === 'Write' || b.name === 'Edit') && p) {
              const abs = path.resolve(this.root, p);
              if (insideReal(this.root, p)) {
                const rel = path.relative(this.root, abs).split(path.sep).join('/');
                if (!run.files.has(rel)) { run.files.add(rel); this.emit(run, { type: 'file', path: rel }); }
                this.olfatearAlcance(run, { rel });
                this.vigilarRepeticion(run, rel);
              }
            }
          }
        }
        break;
      }
      case 'user': {
        const content = m.message?.content;
        if (Array.isArray(content)) {
          for (const b of content) {
            if (b.type === 'tool_result' && b.is_error) {
              const t = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
              this.emit(run, { type: 'tool_error', text: String(t).slice(0, 500), sub, subId, subNom: run.subs?.[subId] });
            }
          }
        }
        break;
      }
      case 'result': {
        run.cost = m.total_cost_usd ?? run.cost;
        try { this.usage?.record(run, m); } catch { /* el registro nunca tumba la ejecución */ }
        run.lastOk = !m.is_error;
        run.turns = (run.turns || 0) + (m.num_turns || 0);
        // Umbrales de atención, no límites: la ejecución sigue, pero el usuario se entera.
        for (const u of [5, 15, 40]) {
          if ((run.cost || 0) >= u && !(run.avisado || []).includes(u)) {
            (run.avisado ||= []).push(u);
            this.emit(run, { type: 'hint', kind: 'gasto', text: `Esta ejecución va por ≈ US$ ${(run.cost || 0).toFixed(2)} de equivalente API y ${run.turns} turnos. Si no la ves avanzar, deténla y revisa qué está haciendo.` });
          }
        }
        run.hasResult = true;
        let text = typeof m.result === 'string' ? m.result : '';
        if (!m.is_error && text.trim() && text.trim() === (run.lastText || '').trim()) text = ''; // ya se mostró como mensaje
        const errores = Array.isArray(m.errors) ? m.errors.join('\n') : '';
        this.emit(run, { type: 'result', ok: !m.is_error, subtype: m.subtype, cost: m.total_cost_usd, turns: m.num_turns, ms: m.duration_ms, text: (text || errores).slice(0, 30000), files: [...run.files] });
        if (m.is_error && /not logged in|please run \/login|authenticat|invalid api key/i.test(text + errores)) this.hint(run, 'auth', 'No hay sesión de Claude iniciada.');
        if (m.is_error && /usage limit|rate limit|limit reached|credit/i.test(text + errores)) this.hint(run, 'limit', 'Llegaste a un límite de uso.');
        break;
      }
      default:
        break;
    }
  }
}
