import fs from 'node:fs';
import path from 'node:path';
import { readManifest, runPy, parseStatus, scanRuns, readInfra } from './py.mjs';

const HECHO = new Set(['COMPLETADO', 'OMITIDO', 'DESACTUALIZADO', 'POR_REVISAR']);

/**
 * Clave con la que se guarda la aprobación de una etapa. Los pasos del manifiesto marcados
 * por lote o por integración se aprueban por separado (cada sprint, cada INT-NN); los de
 * alcance "proyecto" tienen una sola aprobación.
 */
export function claveAprobacion(cfg, root, skill, args) {
  const sk = (cfg?.catalog?.skills || []).find((x) => x.skill === skill);
  const paso = sk?.paso ? (readManifest(root)?.pasos || []).find((x) => x.id === sk.paso) : null;
  const alc = paso?.alcance;
  if (!alc || alc === 'proyecto') return { clave: skill, alcance: null };
  const v = String(args || '').trim().split(/\s+/)[0] || (alc === 'lote' ? 'backlog' : '');
  return { clave: v ? `${skill}|${v}` : skill, alcance: v || null };
}

/** Alcance que el manifiesto le da al paso de una skill: proyecto, lote, integracion o null. */
export function alcanceDePaso(cfg, root, skill) {
  const sk = (cfg?.catalog?.skills || []).find((x) => x.skill === skill);
  if (!sk?.paso) return null;
  return (readManifest(root)?.pasos || []).find((x) => x.id === sk.paso)?.alcance || null;
}

/** Id del paso del manifiesto que le corresponde a una skill. */
export function pasoDeSkill(cfg, skill) {
  return (cfg?.catalog?.skills || []).find((x) => x.skill === skill)?.paso || null;
}

/** Aprobaciones registradas de una skill, con el lote de cada una. */
export function aprobacionesDe(approvals, skill) {
  return Object.entries(approvals || {})
    .filter(([k]) => k === skill || k.startsWith(`${skill}|`))
    .map(([k, v]) => ({ alcance: k.includes('|') ? k.slice(skill.length + 1) : null, ...v }))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

/**
 * Estado de cada skill del catálogo, con las mismas reglas de "se puede ejecutar ahora" que pipeline.py status:
 * dependencias del manifiesto del proyecto + dependencias propias de las skills que no son pasos.
 */
const RUTA_POR_ETAPA = [[/etapa\s*2|segunda etapa|fase\s*2|ampliaci|adicional/i, 'etapa-2'], [/preventa/i, 'preventa'], [/sistema existente|pruebas/i, 'pruebas-existente'], [/evolutiv|cambio/i, 'cambio'], [/ejecuci/i, 'sprint']];
/** Lo que init-project dejó decidido en decisions.md. Es solo una sugerencia: el usuario elige la ruta. */
function sugerenciaInit(root, playlists) {
  try {
    const t = fs.readFileSync(path.join(root, 'context-pack', 'decisions.md'), 'utf8');
    const blocks = t.split(/\n### /).slice(1);
    const b = blocks.find((x) => /^DEC-\d+: proyecto\.etapa/.test(x) && !/- estado: REEMPLAZADA/.test(x));
    const etapa = b && /- valor: (.+)/.exec(b)?.[1]?.trim();
    if (!etapa) return null;
    const id = RUTA_POR_ETAPA.find(([re]) => re.test(etapa))?.[1];
    const r = playlists.find((x) => x.id === id);
    return r ? { etapa, ruta: r.id, nombre: r.nombre } : { etapa, ruta: null, nombre: null };
  } catch { return null; }
}

/** Avance del plan por tandas del paquete de contexto (context-pack/_plan.json). null si no hay plan. */
export function packPlan(root) {
  try {
    const plan = JSON.parse(fs.readFileSync(path.join(root, 'context-pack', '_plan.json'), 'utf8'));
    const docs = plan.documentos || [];
    if (!docs.length) return null;
    const pend = docs.filter((d) => d.estado !== 'hecho');
    const tandas = Math.max(...docs.map((d) => d.tanda || 1));
    const actual = pend.length ? Math.min(...pend.map((d) => d.tanda || 1)) : tandas;
    return { total: docs.length, hechos: docs.length - pend.length, pendientes: pend.length, tandas, tandaActual: actual, docsTanda: pend.filter((d) => (d.tanda || 1) === actual).map((d) => d.archivo) };
  } catch { return null; }
}

function listarIntegraciones(root) {
  try {
    const t = fs.readFileSync(path.join(root, 'context-pack', 'integrations.md'), 'utf8');
    return [...new Set(t.match(/\bINT-\d+\b/g) || [])].sort();
  } catch { return []; }
}

/**
 * `pipeline.py status` se consulta en cada carga de estado y cada evento la dispara,
 * así que el resultado se guarda un instante. invalidarStatus() lo borra tras una acción del usuario.
 */
let cacheStatus = { root: null, ts: 0, val: null };
const TTL_STATUS = 1200;
export function invalidarStatus() { cacheStatus = { root: null, ts: 0, val: null }; }

async function statusDe(root) {
  if (cacheStatus.root === root && Date.now() - cacheStatus.ts < TTL_STATUS) return cacheStatus.val;
  const r = await runPy(root, ['status'], 15000);
  const val = r.code === 0 ? { status: parseStatus(r.stdout), error: null }
    : { status: null, error: (r.timeout ? 'pipeline.py status se pasó del tiempo límite. Revisa que no esté esperando una respuesta en la terminal.' : (r.stderr || r.stdout).trim()).slice(0, 400) };
  cacheStatus = { root, ts: Date.now(), val };
  return val;
}

export async function buildState(cfg, root, runMgr, lote = '') {
  const vivos = runMgr?.activos() || {};
  // Una ejecución de otro lote no bloquea el lote que estás mirando.
  const activos = {};
  for (const [sk, lista] of Object.entries(vivos)) {
    const propias = lista.filter((r) => !r.alcance || !lote || r.alcance === lote);
    if (propias.length) activos[sk] = propias.find((r) => r.status === 'running') || propias[0];
  }
  // Un fallo del lote de al lado tampoco se mete en el lote que estás mirando.
  const malos = runMgr?.fallidos() || {};
  const fallos = {};
  for (const [sk, lista] of Object.entries(malos)) {
    const propias = lista.filter((r) => !r.alcance || !lote || r.alcance === lote);
    if (propias.length) fallos[sk] = propias.sort((a, b) => b.ts - a.ts)[0];
  }
  const aprobadas = runMgr?.approvals || {};
  const manifest = readManifest(root);
  const infra = readInfra(root, manifest);
  let status = { pasos: {}, resumen: { preguntasAbiertas: 0, altoImpacto: 0, respondidasSinIncorporar: 0, alcances: '', propuestas: '' } };
  let statusError = null;
  if (manifest) {
    const r = await statusDe(root);
    if (r.status) status = r.status; else statusError = r.error;
  }
  const runs = manifest ? scanRuns(root, manifest) : {};
  const pasos = Object.fromEntries((manifest?.pasos || []).map((p) => [p.id, p]));
  const porPaso = Object.fromEntries(cfg.catalog.skills.filter((s) => s.paso).map((s) => [s.paso, s.skill]));
  const catalogo = Object.fromEntries(cfg.catalog.skills.map((s) => [s.skill, s]));

  const estadoDe = (s) => {
    if (s.skill === 'init-project') return infra.initialized ? 'COMPLETADO' : 'NO_INICIADO';
    if (s.skill === 'ingest-sources') return infra.evidence > 0 ? 'COMPLETADO' : 'NO_INICIADO';
    if (s.paso && pasos[s.paso]) return status.pasos[s.paso]?.estado || 'NO_INICIADO';
    return 'SIN_ESTADO';
  };

  const estados = Object.fromEntries(cfg.catalog.skills.map((s) => [s.skill, estadoDe(s)]));

  const cumple = (dep, opcional) => {
    if (activos[dep]) return false; // ejecución sin aprobar
    const e = estados[dep];
    if (HECHO.has(e)) return true;
    if (opcional && e === 'NO_INICIADO') return true;
    if (dep === 'generate-context-pack' && e === 'PARCIAL') return true;
    if (e === 'SIN_ESTADO') return true;
    return false;
  };

  const skills = cfg.catalog.skills.map((s) => {
    const faltan = [];
    const agrega = (dep) => { if (dep !== s.skill && !faltan.includes(dep)) faltan.push(dep); };
    if ((!infra.initialized || activos['init-project']) && !['init-project', 'create-brand-kit'].includes(s.skill)) agrega('init-project');
    for (const dep of s.requiere || []) if (!cumple(dep, false)) agrega(dep);
    if (s.paso && pasos[s.paso]) {
      for (const d of pasos[s.paso].depende_de || []) {
        const depSkill = porPaso[d];
        if (!depSkill) continue; // paso sin skill en el catálogo
        if (!cumple(depSkill, !!pasos[d]?.opcional)) agrega(depSkill);
      }
    }
    const paso = s.paso ? pasos[s.paso] : null;
    return {
      ...s,
      estado: estados[s.skill],
      listo: faltan.length === 0,
      faltan: faltan.map((f) => ({ skill: f, nombre: catalogo[f]?.nombre || f, estado: estados[f], porAprobar: !!activos[f] })),
      activa: activos[s.skill] || null,
      fallo: activos[s.skill] ? null : fallos[s.skill] || null,
      aprobada: (() => {
        const todas = aprobacionesDe(aprobadas, s.skill);
        const l = lote ? todas.filter((x) => !x.alcance || x.alcance === lote) : todas;
        return l.length ? { ts: l[0].ts, runId: l[0].runId, lotes: todas.map((x) => x.alcance).filter(Boolean), deEsteLote: !!l.length } : null;
      })(),
      opcional: !!paso?.opcional,
      efectosReales: !!paso?.efectos_reales,
      alcance: paso?.alcance || null,
      detalle: status.pasos[s.paso]?.detalle || '',
      corridas: s.paso ? runs[s.paso] || [] : [],
    };
  });

  return {
    lote,
    root,
    nombre: root.split(/[\\/]/).filter(Boolean).pop(),
    infra: { ...infra, integraciones: listarIntegraciones(root) },
    sugerencia: sugerenciaInit(root, cfg.catalog.playlists),
    pack: packPlan(root),
    resumen: status.resumen,
    statusError,
    skills,
    playlists: cfg.catalog.playlists,
    models: cfg.models,
    defaultModel: cfg.defaultModel,
    plugin: { ok: cfg.pluginOk, path: cfg.pluginPath, name: cfg.pluginName },
    authMode: cfg.authMode,
  };
}
