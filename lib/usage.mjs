import fs from 'node:fs';
import path from 'node:path';

/**
 * Registro de consumo del estudio, de todos los proyectos: usage.json junto al servidor.
 * El SDK informa el costo y los tokens acumulados por sesión, así que cada ejecución guarda su último valor.
 * El costo es el equivalente a precio de API: con suscripción no se cobra por token.
 */
const num = (x) => (Number.isFinite(x) ? x : 0);

export class Usage {
  constructor(file, projectName, projectPath) {
    this.file = file;
    this.project = projectName;
    this.projectPath = projectPath || projectName;
    this.data = this.leer();
  }

  leer() {
    try { const d = JSON.parse(fs.readFileSync(this.file, 'utf8')); if (!d.runs) d.runs = {}; return d; } catch { return { runs: {} }; }
  }

  /**
   * Se escribe fusionando con lo que haya en disco y con archivo temporal más renombrado:
   * dos estudios abiertos a la vez (otro proyecto, otro puerto) no se pisan el registro.
   */
  save() {
    try {
      const disco = this.leer();
      for (const [id, r] of Object.entries(this.data.runs)) {
        const prev = disco.runs[id];
        if (!prev || (r.updated || 0) >= (prev.updated || 0)) disco.runs[id] = r;
      }
      this.data = disco;
      const tmp = `${this.file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(disco));
      fs.renameSync(tmp, this.file);
    } catch { /* el registro nunca debe tumbar una ejecución */ }
  }

  /** Guarda el acumulado de una ejecución a partir del mensaje `result` del SDK. */
  record(run, m) {
    const byModel = {};
    for (const [model, u] of Object.entries(m.modelUsage || {})) {
      byModel[model] = { input: num(u.inputTokens), output: num(u.outputTokens), cacheRead: num(u.cacheReadInputTokens), cacheWrite: num(u.cacheCreationInputTokens), cost: num(u.costUSD) };
    }
    if (!Object.keys(byModel).length && m.usage) {
      byModel[run.model || 'desconocido'] = { input: num(m.usage.input_tokens), output: num(m.usage.output_tokens), cacheRead: num(m.usage.cache_read_input_tokens), cacheWrite: num(m.usage.cache_creation_input_tokens), cost: num(m.total_cost_usd) };
    }
    const prev = this.data.runs[run.id];
    this.data.runs[run.id] = {
      project: this.project, projectPath: this.projectPath, skill: run.skill, model: run.model, started: run.started, updated: Date.now(),
      cost: num(m.total_cost_usd ?? prev?.cost), tokens: Object.keys(byModel).length ? byModel : prev?.tokens || null,
    };
    this.save();
  }

  /** Ejecuciones anteriores a este registro: solo se conoce su costo (el último `result`). */
  backfill(runs) {
    let n = 0;
    for (const r of runs.values()) {
      if (this.data.runs[r.id]) continue;
      const res = [...(r.events || [])].reverse().find((e) => e.type === 'result' && typeof e.cost === 'number');
      if (!res) continue;
      this.data.runs[r.id] = { project: this.project, projectPath: this.projectPath, skill: r.skill, model: r.model, started: r.started, updated: res.ts, cost: res.cost, tokens: null };
      n++;
    }
    if (n) this.save();
  }

  summary(models = []) {
    const label = Object.fromEntries(models.map((m) => [m.id, m.label]));
    const zero = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, runs: 0 });
    const total = zero(), mes = zero(), porModelo = {}, porProyecto = {};
    const ahora = new Date(), ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
    let sinTokens = 0;
    const add = (t, tk, cost) => { t.input += tk.input; t.output += tk.output; t.cacheRead += tk.cacheRead; t.cacheWrite += tk.cacheWrite; t.cost += cost; };
    for (const r of Object.values(this.data.runs)) {
      const tks = r.tokens ? Object.entries(r.tokens) : [];
      if (!tks.length) sinTokens++;
      const enMes = (r.started || 0) >= ini;
      // El costo de la ejecución (total_cost_usd) se suma una sola vez; los tokens, de todos sus modelos.
      const tk = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      for (const [, u] of tks) { tk.input += u.input; tk.output += u.output; tk.cacheRead += u.cacheRead; tk.cacheWrite += u.cacheWrite; }
      const costo = num(r.cost);
      const pk = r.projectPath || r.project || 'sin proyecto';
      const pnombre = r.project || pk;
      total.runs++; if (enMes) mes.runs++;
      porProyecto[pk] ||= { ...zero(), nombre: pnombre }; porProyecto[pk].runs++;
      add(total, tk, costo); if (enMes) add(mes, tk, costo); add(porProyecto[pk], tk, costo);
      if (!tks.length) {
        const k = label[r.model] || r.model || 'sin modelo';
        porModelo[k] ||= zero(); porModelo[k].runs++; porModelo[k].cost += costo;
        continue;
      }
      for (const [model, u] of tks) {
        const k = label[model] || model;
        porModelo[k] ||= zero(); porModelo[k].runs++;
        add(porModelo[k], u, num(u.cost));
      }
    }
    const lista = (o) => Object.entries(o).map(([k, v]) => ({ nombre: v.nombre || k, ...v })).sort((a, b) => b.cost - a.cost);
    return { total, mes, porModelo: lista(porModelo), porProyecto: lista(porProyecto), sinTokens, desde: Math.min(...Object.values(this.data.runs).map((r) => r.started || Date.now()), Date.now()) };
  }
}
