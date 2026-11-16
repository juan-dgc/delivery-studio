import { query } from '@anthropic-ai/claude-agent-sdk';
import fs from 'node:fs';
import path from 'node:path';
import { sdkEnv } from './auth.mjs';
import { inside, insideReal } from './files.mjs';
import { claveAprobacion, alcanceDePaso, pasoDeSkill } from './state.mjs';

// Herramientas de solo lectura o de coordinación: nunca piden permiso.
const AUTO_TOOLS = new Set(['Read', 'Glob', 'Grep', 'Skill', 'TodoWrite', 'Agent', 'Task', 'ToolSearch', 'WebSearch', 'WebFetch', 'TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList']);
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
// Comandos seguros siempre: scripts del pipeline y listados.
const SAFE_SHELL = /^[ \t]*(?:(?:cd|pushd)[ \t]+[^\r\n;&|`$<>]+(?:&&|;)[ \t]*)?(?:(?:python3?|py(?:[ \t]+-3)?)[ \t]+["']?\.pipeline[\\/]scripts[\\/][\w.-]+\.py["']?(?:[ \t]+[^\r\n;&|`$<>]*)?|ls(?:[ \t]+[^\r\n;&|`$<>]*)?|pwd|dir(?:[ \t]+[^\r\n;&|`$<>]*)?)[ \t]*$/i;
// En modo automático se pregunta solo por esto.
const RISKY = /\bgit\s+(push|reset\s+--hard|clean|checkout\s+--\s|branch\s+-D)\b|\brm\s+-[a-z]*[rf]|\bsudo\b|\bmkfs\b|\bdd\s+if=|\bnpm\s+publish\b|\bgh\s+(pr\s+merge|repo\s+delete|release)\b|(curl|wget)[^|]*\|\s*(ba|z)?sh\b|\bRemove-Item\b[^|]*-Recurse|\bdel\s+\/[sq]\b|\brmdir\s+\/s\b|\bkubectl\b|\bterraform\s+apply\b/i;

// Lo que se guarda en memoria al arrancar: el disco conserva el historial completo.
const MAX_EVENTOS_MEM = 1500;
const MAX_RUNS_MEM = 80;

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
        const run = { ...meta.run, events: enMem, recortado, pending: new Map(), allowTools: new Set(), files: new Set(meta.run.files || []), abort: null };
        const sid = [...lines].reverse().find((l) => l.type === 'init')?.sessionId;
        if (sid) run.sessionId = sid;
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
      started: run.started, cost: run.cost || 0, turns: run.turns || 0, hasSession: !!run.sessionId, recortado: !!run.recortado,
      files: [...run.files], pending: [...run.pending.keys()].length,
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
  start({ skill, args, instruction, model, approval, title }) {
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
      model: model || this.cfg.defaultModel, approval: approval === 'auto' ? 'auto' : 'preguntar',
      started: Date.now(), status: 'running', events: [], pending: new Map(), allowTools: new Set(), files: new Set(), cost: 0, turns: 0, abort: null,
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
    this.turn(run, text);
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

  answer(runId, qid, payload) {
    const run = this.runs.get(runId);
    const p = run?.pending.get(qid);
    if (!p) throw Object.assign(new Error('Esa pregunta ya no está pendiente.'), { status: 404 });
    run.pending.delete(qid);
    if (p.kind === 'question') {
      if (payload.skip) p.resolve({ behavior: 'deny', message: 'El usuario prefirió no responder estas preguntas ahora. Continúa con lo que puedas sin ellas, o detente y dile qué te falta.' });
      else p.resolve({ behavior: 'allow', updatedInput: { ...p.input, answers: payload.answers || {} } });
      this.emit(run, { type: 'resolved', id: qid, kind: 'question', answers: payload.skip ? null : payload.answers });
      if (!payload.skip) this.alcanceDeRespuestas(run, payload.answers);
    } else {
      if (payload.decision === 'allow') {
        if (payload.remember && !SHELL_TOOLS.has(p.tool)) run.allowTools.add(p.tool);
        p.resolve(allow(p.input));
      } else p.resolve({ behavior: 'deny', message: payload.message || 'El usuario no autorizó esta acción. Propón otra forma o pregúntale.' });
      this.emit(run, { type: 'resolved', id: qid, kind: 'permission', decision: payload.decision });
    }
    this.broadcast({ type: 'runs_changed' });
  }

  // ---------------------------------------------------------------- permisos
  async decide(run, name, input, opts) {
    if (name === 'AskUserQuestion') return this.ask(run, 'question', name, input, opts.signal, { questions: input.questions });
    if (AUTO_TOOLS.has(name) || run.allowTools.has(name)) return allow(input);
    if (WRITE_TOOLS.has(name)) {
      const p = input.file_path || input.notebook_path;
      if (p && insideReal(this.root, p)) return allow(input);
    }
    const cmd = SHELL_TOOLS.has(name) ? String(input.command || '') : '';
    // Un comando con salto de línea puede esconder una segunda orden detrás de una permitida: siempre se pregunta.
    const multi = /[\r\n]/.test(cmd);
    const riesgoso = !!cmd && (multi || RISKY.test(cmd));
    if (SHELL_TOOLS.has(name) && !riesgoso) {
      if (SAFE_SHELL.test(cmd)) return allow(input);
      if (run.approval === 'auto') return allow(input);
    }
    if (run.approval === 'auto' && /^mcp__[^_]*playwright/i.test(name)) return allow(input);
    return this.ask(run, 'permission', name, input, opts.signal, { tool: name, summary: summarize(name, input), reason: opts.decisionReason || (multi ? 'El comando tiene más de una línea: revisa todas antes de permitirlo.' : ''), risky: riesgoso });
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

  handle(run, m) {
    const sub = !!m.parent_tool_use_id;
    switch (m.type) {
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
          if (b.type === 'text' && b.text?.trim()) { if (!sub) run.lastText = b.text; this.emit(run, { type: 'text', text: b.text, sub }); }
          else if (b.type === 'tool_use') {
            if (b.name === 'AskUserQuestion') continue; // se muestra como tarjeta de pregunta
            this.emit(run, { type: 'tool', tool: b.name, summary: summarize(b.name, b.input), sub });
            if (SHELL_TOOLS.has(b.name)) this.olfatearAlcance(run, { cmd: String(b.input?.command || '') });
            const p = b.input?.file_path;
            if ((b.name === 'Write' || b.name === 'Edit') && p) {
              const abs = path.resolve(this.root, p);
              if (insideReal(this.root, p)) {
                const rel = path.relative(this.root, abs).split(path.sep).join('/');
                if (!run.files.has(rel)) { run.files.add(rel); this.emit(run, { type: 'file', path: rel }); }
                this.olfatearAlcance(run, { rel });
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
              this.emit(run, { type: 'tool_error', text: String(t).slice(0, 500), sub });
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
