// Delivery Studio: interfaz del panel. Sin dependencias; todo texto externo pasa por esc().
import { marked } from '/vendor/marked.js';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

marked.use({
  gfm: true,
  renderer: {
    html({ text }) { return esc(text); },
    image({ text }) { return esc(text || ''); },
    link({ href, tokens }) {
      const inner = this.parser.parseInline(tokens);
      return /^(https?:|mailto:)/i.test(href || '') ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner;
    },
  },
});
/**
 * Las skills nombran sus artefactos con siglas en inglés (OQ, RN, PROC...). Quien no diseñó el
 * pipeline no tiene por qué saberlas, así que al pintarlas se les pone el nombre en español
 * encima: el texto no se toca, solo gana una explicación al pasar el cursor.
 */
const SIGLAS = {
  OQ: 'pregunta abierta', EV: 'evidencia', US: 'historia de usuario', EP: 'épica',
  AC: 'criterio de aceptación', TC: 'caso de prueba', RN: 'regla de negocio',
  PROC: 'proceso de negocio', MOD: 'módulo', DEF: 'defecto', INT: 'integración',
  DEC: 'decisión', SC: 'solicitud de cambio', INC: 'incidente', CMP: 'compromiso',
  R: 'riesgo', AM: 'acción de mejora',
};
const RE_SIGLA = new RegExp(`\\b(${Object.keys(SIGLAS).join('|')})-(\\d{2,3}(?:\\.\\d+)?|NNN)\\b`, 'g');
const explicarSiglas = (html) => html.replace(RE_SIGLA, (m, sig) => `<abbr class="sig" title="${SIGLAS[sig]}">${m}</abbr>`);
const md = (t) => explicarSiglas(marked.parse(String(t ?? '')));
const DOC_RE = /^(outputs|context-pack|evidence|inputs)\/[^\s]+\.[A-Za-z0-9]{1,6}$/;

async function api(path, body) {
  const r = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-ds': '1', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 401) { avisoReinicio('y esta pestaña perdió su sesión'); throw Object.assign(new Error('La sesión de esta pestaña ya no vale.'), { status: 401 }); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { data: j, status: r.status });
  return j;
}

/**
 * El token y el código cambian en cada arranque del servidor, así que una pestaña vieja queda
 * muerta sin avisar. Se compara el código del servidor con el que se cargó.
 */
let codigoServidor = null;
function avisoViejo() {
  if (S.reinicio) return;
  S.reinicio = true;
  banner('El servidor está corriendo una versión anterior del código. Ciérralo y vuelve a abrirlo con iniciar.command para ver los cambios.', true, true);
}
function avisoReinicio(porQue) {
  if (S.reinicio) return;
  S.reinicio = true;
  banner(`El servidor se reinició ${porQue}. Recarga la página para seguir trabajando. <button class="primary sm" id="bRecargar">Recargar</button>`, true, true);
  $('#bRecargar')?.addEventListener('click', () => location.reload());
}
async function verVersion() {
  if (S.reinicio) return;
  try {
    const j = await (await fetch('/api/_id', { cache: 'no-store' })).json();
    if (j.app !== 'delivery-studio') return;
    // El proceso que corre quedó con código viejo: los archivos del disco ya cambiaron.
    if (j.disco && j.disco !== j.code) { avisoViejo(); return; }
    if (!codigoServidor) { codigoServidor = j.code; return; }
    if (j.code !== codigoServidor) avisoReinicio('con cambios en el código');
  } catch { /* apagado o reiniciando: el EventSource reintenta y se vuelve a comprobar */ }
}

const S = {
  lote: (() => { try { return localStorage.getItem('ds_lote') || ''; } catch { return ''; } })(), state: null, auth: null, runs: [], cur: null, events: [], curSummary: null, routes: { custom: [], open: [], current: null },  tree: [], authLog: [], loginBusy: false };
const ESTADO = { NO_INICIADO: 'Pendiente', COMPLETADO: 'Completado', DESACTUALIZADO: 'Desactualizado', POR_REVISAR: 'Por revisar', PARCIAL: 'Parcial', FALLIDO: 'Fallido', OMITIDO: 'Omitido', SIN_ESTADO: 'Disponible', EN_PROGRESO: 'En progreso', SIN_META: 'Sin meta' };
const RUN_ICON = {
  running: '<svg viewBox="0 0 24 24" class="spin"><circle cx="12" cy="12" r="8" opacity=".25"/><path d="M12 4a8 8 0 0 1 8 8"/></svg>',
  esperando: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></svg>',
  aprobada: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="m8.5 12.3 2.4 2.4 4.6-5"/></svg>',
  error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="m9.3 9.3 5.4 5.4M14.7 9.3l-5.4 5.4"/></svg>',
  cerrada: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M8.5 12h7"/></svg>',
};
const RUN_ESTADO = { running: 'Trabajando', esperando: 'Esperando', cerrada: 'Descartada', aprobada: 'Aprobada', error: 'Error' };
const HECHO = new Set(['COMPLETADO', 'OMITIDO']);

// ---------------------------------------------------------------- pestañas
function switchTab(name) {
  const prev = $('#tabs button.on')?.dataset.tab;
  if (name === 'docs' && prev !== 'docs') TREE_OPEN = null;
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('on', t.id === `tab-${name}`));
  $('#pageTitle').textContent = { resumen: 'Resumen', rutas: 'Rutas', ejecucion: 'Ejecución', docs: 'Documentos', insumos: 'Insumos', cuenta: 'Cuenta' }[name] || '';
  if (name === 'docs') loadTree();
  if (name === 'insumos') { loadTree().then(renderInputs); loadSources(); }
  if (name === 'cuenta') loadCuenta();
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) switchTab(b.dataset.tab); });

// ---------------------------------------------------------------- estado general
let stateTimer = null;
function reloadStateSoon() { clearTimeout(stateTimer); stateTimer = setTimeout(loadState, 350); }

async function loadState() {
  const q = S.lote ? `?lote=${encodeURIComponent(S.lote)}` : '';
  try { S.state = await api(`/api/state${q}`); } catch (e) { banner(`No pude leer el estado: ${e.message}`, true); return; }
  renderHeader(); renderRutas(); renderResumen(); renderBanner(); updateHead();
}

async function loadAuth() {
  try { S.auth = await api('/api/auth'); } catch { S.auth = { loggedIn: false, detail: 'sin datos', mode: '?' }; }
  renderHeader(); renderBanner();
}

function renderHeader() {
  const st = S.state; if (!st) return;
  $('#proj').innerHTML = `<b>${esc(st.nombre)}</b><small>${esc(st.root)}</small>`;
  $('#proj').title = st.root;
  const a = S.auth;
  const el = $('#auth');
  if (!a) { el.innerHTML = ''; return; }
  const modo = a.mode === 'apikey' ? 'API key' : 'Suscripción';
  el.innerHTML = `<span class="chip ${a.loggedIn ? 'ok' : 'bad'}">${esc(modo)}: ${a.loggedIn ? 'lista' : 'sin sesión'}</span>`
    + (a.mode === 'subscription' && !a.loggedIn ? `<button class="primary" id="btnLogin" ${S.loginBusy ? 'disabled' : ''}>Iniciar sesión</button>` : '');
  $('#btnLogin')?.addEventListener('click', startLogin);
  $('#runDot').hidden = !S.runs.some((r) => r.status === 'running');
}

function banner(msg, err = false, html = false) {
  const b = $('#banner');
  if (!msg) { b.hidden = true; return; }
  b.hidden = false; b.className = `banner${err ? ' err' : ''}`;
  if (html) b.innerHTML = msg; else b.textContent = msg;
}

function renderBanner() {
  if (S.reinicio) return; // el aviso de reinicio manda sobre los demás
  const st = S.state; if (!st) return;
  if (S.loginBusy) return banner(`Inicio de sesión en curso. ${S.authLog.slice(-3).map(esc).join(' · ')}`, false, true);
  if (!st.plugin.ok) return banner(`No encuentro el plugin en ${st.plugin.path}. Ajusta pluginPath en config.json.`, true);
  // Sin sesión ninguna skill puede trabajar: se avisa siempre, no solo con el chip de arriba.
  if (S.auth && !S.auth.loggedIn) {
    if (S.auth.mode === 'apikey') return banner('Falta la variable ANTHROPIC_API_KEY. Defínela y reinicia el servidor.', true);
    banner('No hay sesión de Claude: ningún paso puede ejecutarse hasta que inicies sesión. <button class="primary sm" id="bLogin2">Iniciar sesión</button>', true, true);
    $('#bLogin2')?.addEventListener('click', async () => { switchTab('cuenta'); await startLogin(); loadCuenta(); });
    return;
  }
  if (!st.infra.initialized) return banner('Este proyecto aún no está inicializado. Abre Rutas y ejecuta "Inicializar proyecto".');
  if (st.statusError) return banner(`pipeline.py status falló: ${st.statusError}`, true);
  banner('');
}

async function startLogin() {
  S.loginBusy = true; S.authLog = []; renderHeader(); renderBanner();
  try { await api('/api/auth/login', {}); } catch (e) { S.loginBusy = false; banner(e.message, true); renderHeader(); }
}

// ---------------------------------------------------------------- rutas
const uidc = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const allRoutes = () => [
  ...S.state.playlists.map((p) => ({ ...p, tipo: 'predefinida' })),
  ...S.routes.custom.map((r) => ({ ...r, tipo: 'propia', secuencia: true })),
];
const skillOf = (id) => S.state.skills.find((s) => s.skill === id);
const isDone = (s) => HECHO.has(s.estado) || s.estado === 'DESACTUALIZADO' || s.estado === 'POR_REVISAR';
const pending = (s) => ['NO_INICIADO', 'DESACTUALIZADO', 'PARCIAL', 'FALLIDO'].includes(s.estado);

function resolveRoute(o) {
  const base = allRoutes().find((r) => r.id === o.base);
  if (!base) return null;
  // la ruta abierta es una copia fija: si guardó sus skills, no cambia aunque la base cambie
  let ids = (o.skills && o.skills.length ? o.skills : base.skills).filter((id) => skillOf(id));
  if (!o.skills?.length && o.desde && ids.includes(o.desde)) ids = ids.slice(ids.indexOf(o.desde));
  return { ...o, nombre: o.nombre || base.nombre, descripcion: base.descripcion || '', secuencia: base.secuencia !== false, skills: ids };
}

/**
 * Selector del lote en el que estás trabajando. Los pasos por lote (historias, casos,
 * desarrollo, revisión, validación) se leen para ese lote: lo que corre en otro no bloquea aquí.
 */
function selectorLote() {
  const lotes = S.state?.infra?.alcances || [];
  if (!lotes.length && !S.lote) return '';
  const opts = [['', 'Todos los lotes'], ['backlog', 'backlog (todo)'], ...lotes.map((v) => [v, v])];
  if (S.lote && !opts.some(([v]) => v === S.lote)) opts.push([S.lote, S.lote]);
  return `<label class="lotepick">Trabajando en<select id="loteCur">${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === S.lote ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
}

/** Algunas rutas (p. ej. «Nueva etapa») proponen el lote por defecto de cada paso. */
function argDefault(skill) {
  const o = S.routes.open.find((x) => x.id === S.routes.current);
  const base = o && allRoutes().find((r) => r.id === o.base);
  return base?.args?.[skill] || '';
}

async function saveRoutes() {
  try { S.routes = await api('/api/routes', S.routes); } catch (e) { banner(`No pude guardar las rutas: ${e.message}`, true); }
}
async function loadRoutes() {
  try { S.routes = await api('/api/routes'); } catch { /* sin rutas guardadas */ }
}

function renderRutas() {
  const st = S.state; if (!st) return;
  const open = S.routes.open.map(resolveRoute).filter(Boolean);
  $('#chooser').hidden = open.length > 0;
  $('#routeView').hidden = open.length === 0;
  if (!open.length) return renderChooser();

  if (!open.some((o) => o.id === S.routes.current)) S.routes.current = open[0].id;
  const cur = open.find((o) => o.id === S.routes.current);
  const corriendo = new Set(S.runs.filter((r) => r.status === 'running').map((r) => r.skill));

  const doneSeg = (o) => o.skills.map(skillOf).filter((x) => x && x.estado !== 'SIN_ESTADO' && !x.opcional).every((x) => isDone(x) && !x.activa);
  $('#rtabs').innerHTML = (open.length > 1 ? '<span class="rlabel">Tramos de tu camino</span>' : '<span class="rlabel">Tu ruta</span>') + open.map((o, n) => {
    const live = o.skills.some((id) => corriendo.has(id)), ok = doneSeg(o);
    return `<div class="rtab ${o.id === cur.id ? 'on' : ''} ${ok ? 'ok' : ''}" data-rid="${esc(o.id)}"><span class="tn">${ok ? '✓' : n + 1}</span><span>${esc(o.nombre)}${o.desde ? ` <small>desde ${esc(skillOf(o.desde)?.nombre || o.desde)}</small>` : ''}</span>${live ? '<i class="dot"></i>' : ''}<button class="x icon-btn" data-close="${esc(o.id)}" title="Quitar este tramo" aria-label="Quitar este tramo">×</button></div>`;
  }).join('') + '<button class="ghost addroute" id="addRoute">+ Continuar con otra ruta</button>' + selectorLote();
  renderSugerencia(open, cur);

  const r = st.resumen, i = st.infra;
  const kpi = (l, v, sub = '', cls = '', sm = false) => `<div class="kpi ${cls}"><div class="l">${esc(l)}</div><div class="v ${sm ? 'sm' : ''}">${esc(v)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;
  const k = [
    kpi('Insumos', i.inputs, 'archivos en inputs/'),
    kpi('Evidencias', i.evidence, 'citables, una por fuente'),
    kpi('Preguntas abiertas', r.preguntasAbiertas, r.altoImpacto ? `${r.altoImpacto} de impacto alto` : 'sin impacto alto', r.altoImpacto ? 'warn' : ''),
  ];
  if (r.respondidasSinIncorporar) k.push(kpi('Respondidas sin incorporar', r.respondidasSinIncorporar, 'pendientes de pasar al paquete de contexto', 'info'));
  if (i.initialized) k.push(`<div class="kpi click" data-lotes role="button" tabindex="0" title="Definir o editar los lotes de historias"><div class="l">Lotes</div><div class="v">${i.alcances.length}</div><div class="s">${esc(i.alcances.join(', ') || 'definir lotes')}</div></div>`);
  if (r.propuestas) k.push(kpi('Decisiones por validar', r.propuestas, '', 'warn', true));
  $('#summary').innerHTML = k.join('');
  $('#pdesc').textContent = cur.descripcion || '';

  const skills = cur.skills.map(skillOf).filter(Boolean);
  const medibles = skills.filter((s) => s.estado !== 'SIN_ESTADO');
  const hechos = medibles.filter((s) => isDone(s) && !s.activa).length;
  $('.progress').hidden = !cur.secuencia || !medibles.length;
  $('#bar').style.width = medibles.length ? `${(hechos / medibles.length) * 100}%` : '0';
  $('#barTxt').textContent = `${hechos} de ${medibles.length} pasos con entregable`;

  const porAprobar = cur.secuencia ? skills.find((s) => s.activa && s.activa.status === 'esperando') : null;
  const next = cur.secuencia && !porAprobar ? skills.find((s) => s.listo && pending(s) && !s.opcional && !s.activa) : null;
  renderNextAction(cur, skills, porAprobar, next, corriendo);
  const flow = $('#flow');
  flow.className = `flow ${cur.secuencia ? 'seq' : 'nofl'}`;
  flow.innerHTML = skills.map((s, idx) => {
    const run = corriendo.has(s.skill);
    const apr = s.activa && !run;
    const bloq = !s.listo && !apr && !run;
    const fail = !run && !apr && s.fallo;
    const cls = ['node', run || apr ? '' : s.estado, bloq ? 'blocked' : '', next?.skill === s.skill ? 'upnext' : '', run ? 'running' : '', apr ? 'toapprove' : '', s.aprobada && isDone(s) && !s.activa ? 'approved' : '', fail ? 'failed' : ''].join(' ');
    const label = run ? 'Trabajando' : apr ? 'Por aprobar' : fail ? 'Con error' : bloq ? 'Bloqueada' : s.aprobada && isDone(s) ? 'Aprobada' : ESTADO[s.estado] || s.estado;
    // Dos bloqueos distintos: uno lo resuelves tú con un clic (aprobar), el otro necesita trabajo antes.
    const porApr = s.faltan.some((f) => f.porAprobar);
    const falta = bloq && s.faltan.length ? `<div class="miss ${porApr ? 'act' : ''}">${porApr ? 'Aprueba' : 'Falta'}: ${s.faltan.map((f) => esc(f.nombre)).join(', ')}</div>` : '';
    const err = fail ? `<div class="miss bad">La última ejecución terminó con error. Ábrela para ver qué pasó.</div>` : '';
    const scopes = s.corridas.length ? `<div class="chips">${s.corridas.map((c) => `<span title="${esc(c.estado)}">${esc(c.alcance)} v${c.version}</span>`).join('')}</div>` : '';
    const tag = next?.skill === s.skill ? 'Siguiente' : '';
    const lotesApr = s.aprobada?.lotes?.length ? `<div class="chips">${s.aprobada.lotes.map((l) => `<span class="ap ${S.lote && l !== S.lote ? 'otro' : ''}" title="Etapa aprobada para ${esc(l)}">✓ ${esc(l)}</span>`).join('')}</div>` : '';
    return `<div class="${cls}" data-skill="${esc(s.skill)}" tabindex="0" role="button">
      ${tag ? `<span class="next-tag">${tag}</span>` : ''}
      <div class="head"><span class="num" aria-hidden="true">${cur.secuencia ? idx + 1 : '•'}</span><div class="ttl"><div class="t">${cur.secuencia ? `<span class="vh">Paso ${idx + 1} de ${skills.length}: </span>` : ''}${esc(s.nombre)}</div></div></div>
      <div class="p">${esc(s.produce || '')}</div>${falta}${err}${lotesApr}${scopes}${s.skill === 'generate-context-pack' && S.state.pack?.pendientes > 0 ? `<div class="chips"><span class="pk">Tanda ${S.state.pack.tandaActual} de ${S.state.pack.tandas} · ${S.state.pack.hechos}/${S.state.pack.total} documentos</span></div>` : ''}
      <div class="foot"><span class="badge">${esc(label)}</span>${s.opcional ? '<span class="opt">opcional</span>' : ''}</div>
    </div>`;
  }).join('');
  layoutFlow();
}

/** Vagones en serpentina: la fila par va a la derecha, la impar a la izquierda, y al final de cada fila la flecha baja al paso siguiente. */
function layoutFlow() {
  const flow = $('#flow'); if (!flow.classList.contains('seq')) return;
  const w = flow.clientWidth || 900, MIN = 270, GAP = 48;
  const cols = Math.max(1, Math.min(4, Math.floor((w + GAP) / (MIN + GAP))));
  flow.style.setProperty('--cols', cols);
  const nodes = [...flow.children], last = nodes.length - 1;
  nodes.forEach((n, i) => {
    const row = Math.floor(i / cols), pos = i % cols, col = cols === 1 ? 0 : row % 2 === 0 ? pos : cols - 1 - pos;
    n.style.gridRow = row + 1; n.style.gridColumn = col + 1;
    n.classList.remove('to-r', 'to-l', 'to-d');
    if (i === last) return;
    n.classList.add(cols === 1 || pos === cols - 1 ? 'to-d' : row % 2 === 0 ? 'to-r' : 'to-l');
  });
}
new ResizeObserver(() => layoutFlow()).observe($('#flow'));

function renderNextAction(cur, skills, porAprobar, next, corriendo) {
  const box = $('#nextAction');
  const run = skills.find((s) => corriendo.has(s.skill));
  const goRun = (skill, status) => S.runs.find((r) => r.skill === skill && r.status === status)?.id || '';
  let h = '';
  if (!cur.secuencia) { box.innerHTML = ''; return; }
  if (run) h = `<div class="next"><div class="tx"><div class="k">En ejecución</div><div class="tt">${esc(run.nombre)} está trabajando</div><div class="ds">Puedes seguir viendo su avance o abrir otra ruta mientras tanto.</div></div><button class="primary" data-go-run="${esc(goRun(run.skill, 'running'))}">Ver ejecución</button></div>`;
  else if (porAprobar) h = `<div class="next review"><div class="tx"><div class="k">Requiere tu aprobación</div><div class="tt">${esc(porAprobar.nombre)}</div><div class="ds">Revisa lo que generó y apruébalo para desbloquear los pasos que dependen de él.</div></div><button class="primary" data-go-run="${esc(goRun(porAprobar.skill, 'esperando'))}">Revisar y aprobar</button></div>`;
  else if (skills.find((x) => x.fallo)) { const f = skills.find((x) => x.fallo); h = `<div class="next err"><div class="tx"><div class="k">Terminó con error</div><div class="tt">${esc(f.nombre)}</div><div class="ds">La última ejecución no llegó a entregar nada. Mira el error y vuelve a intentarlo.</div></div><button class="danger primary" data-go-run="${esc(f.fallo.runId)}">Ver el error</button></div>`; }
  else if (next) h = `<div class="next"><div class="tx"><div class="k">Siguiente paso</div><div class="tt">${esc(next.nombre)}</div><div class="ds">${esc(next.produce || '')}</div></div><button class="primary" data-open-skill="${esc(next.skill)}">Ejecutar</button></div>`;
  else if (skills.length && skills.every((s) => isDone(s) || s.opcional || s.estado === 'SIN_ESTADO')) h = `<div class="next done"><div class="tx"><div class="k">Ruta al día</div><div class="tt">No quedan pasos pendientes en esta ruta</div><div class="ds">Abre otra ruta o vuelve a ejecutar un paso si cambió la información.</div></div></div>`;
  else h = `<div class="next"><div class="tx"><div class="k">Sin paso disponible</div><div class="tt">Hay pasos bloqueados</div><div class="ds">Revisa lo que les falta: aparece en cada tarjeta.</div></div></div>`;
  box.innerHTML = h;
}
$('#nextAction').addEventListener('click', async (e) => {
  const g = e.target.closest('[data-go-run]'); if (g && g.dataset.goRun) { await loadRuns(); switchTab('ejecucion'); return selectRun(g.dataset.goRun); }
  const o = e.target.closest('[data-open-skill]'); if (o) openDrawer(o.dataset.openSkill);
});
/** Un paso con ejecución viva (trabajando o por aprobar) abre esa ejecución; no una segunda. Los demás abren el panel de ejecución. */
async function openNode(skillId) {
  const s = S.state.skills.find((x) => x.skill === skillId); if (!s) return;
  if (s.activa?.runId) { await loadRuns(); switchTab('ejecucion'); return selectRun(s.activa.runId); }
  return openDrawer(skillId);
}
$('#flow').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('node')) { e.preventDefault(); openNode(e.target.dataset.skill); } });

$('#rtabs').addEventListener('change', async (e) => {
  if (e.target.id !== 'loteCur') return;
  S.lote = e.target.value;
  try { localStorage.setItem('ds_lote', S.lote); } catch { /* sin memoria del navegador, no importa */ }
  await loadState();
});
$('#rtabs').addEventListener('click', async (e) => {
  const x = e.target.closest('[data-close]');
  if (x) { S.routes.open = S.routes.open.filter((o) => o.id !== x.dataset.close); await saveRoutes(); return renderRutas(); }
  if (e.target.closest('#addRoute')) return openAddRoute();
  const t = e.target.closest('.rtab');
  if (t) { S.routes.current = t.dataset.rid; saveRoutes(); renderRutas(); }
});
$('#flow').addEventListener('click', (e) => { const n = e.target.closest('.node'); if (n) openNode(n.dataset.skill); });

function renderChooser() {
  const box = $('#chooser');
  box.innerHTML = `<h2>¿Qué quieres hacer?</h2><p class="muted">Elige una ruta: será tu camino, con sus pasos fijos. Init-project solo sugerirá una cuando corra; tú decides. Después, para retomar más adelante, agregas otro tramo desde donde quedaste.</p>
    <div class="rcards">${allRoutes().map((r) => routeCard(r)).join('')}<div class="rcard build" data-build><h4>Armar mi propia ruta</h4><p class="muted">Elige las skills y su orden.</p></div></div>`;
}
function routeCard(r, extra = '') {
  const names = r.skills.map((id) => skillOf(id)?.nombre).filter(Boolean);
  return `<div class="rcard" data-base="${esc(r.id)}"><h4>${esc(r.nombre)}</h4><p class="muted">${esc(r.descripcion || '')}</p>
    <div class="steps">${names.slice(0, 6).map((n) => `<span>${esc(n)}</span>`).join('')}${names.length > 6 ? `<span>+${names.length - 6}</span>` : ''}</div>${extra}</div>`;
}
$('#chooser').addEventListener('click', (e) => {
  if (e.target.closest('[data-build]')) return openBuilder();
  const c = e.target.closest('[data-base]'); if (c) openRoute(c.dataset.base);
});

async function openRoute(base, desde = null) {
  const r = allRoutes().find((x) => x.id === base); if (!r) return;
  let ids = r.skills.filter((id) => skillOf(id));
  if (desde && ids.includes(desde)) ids = ids.slice(ids.indexOf(desde));
  // un tramo nuevo no repite lo que ya está hecho antes de su primer paso pendiente
  if (S.routes.open.length && !desde && !r.repite) {
    const first = ids.findIndex((id) => { const s = skillOf(id); return s && pending(s) && !s.opcional; });
    if (first > 0) ids = ids.slice(first);
  }
  const o = { id: uidc(), base, desde: desde || null, nombre: '', skills: ids, creada: new Date().toISOString() };
  S.routes.open.push(o); S.routes.current = o.id;
  await saveRoutes(); closeModal(); switchTab('rutas'); renderRutas();
}

/** init-project solo sugiere: el usuario decide si adopta la ruta sugerida o sigue con la suya. */
function renderSugerencia(open, cur) {
  const box = $('#suggest'); const sg = S.state.sugerencia;
  const ya = sg?.ruta && open.some((o) => o.base === sg.ruta);
  if (!sg || !sg.ruta || ya || S.routes.ignorarSugerencia === sg.ruta) { box.replaceChildren(); return; }
  box.innerHTML = `<div class="next sug"><div class="tx"><div class="k">Init sugiere</div><div class="tt">Por la etapa «${esc(sg.etapa)}», la ruta «${esc(sg.nombre)}»</div><div class="ds">Es solo una sugerencia. Tu ruta actual sigue igual.</div></div><button class="sec" data-sg-add="${esc(sg.ruta)}">Agregar como siguiente tramo</button><button class="sm" data-sg-no="${esc(sg.ruta)}">Ignorar</button></div>`;
}
$('#suggest').addEventListener('click', async (e) => {
  const a = e.target.closest('[data-sg-add]'); if (a) return openRoute(a.dataset.sgAdd);
  const n = e.target.closest('[data-sg-no]'); if (n) { S.routes.ignorarSugerencia = n.dataset.sgNo; await saveRoutes(); renderRutas(); }
});

// ---- ventana modal
const FOCO = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function openModal(html) {
  if (!S.focoPrevio) S.focoPrevio = document.activeElement;
  $('#mbox').innerHTML = html;
  $('#modal').hidden = false;
  ($('#mbox').querySelector(FOCO) || $('#mbox')).focus?.();
}
function closeModal() {
  B = null; $('#modal').hidden = true; $('#mbox').innerHTML = '';
  const f = S.focoPrevio; S.focoPrevio = null;
  if (f && document.contains(f)) f.focus?.();
  if (S.modalResolve) { const r = S.modalResolve; S.modalResolve = null; r(false); }
}
function cerrarDrawer() {
  const d = $('#drawer');
  if (d.hidden) return;
  d.hidden = true;
  const f = S.focoDrawer; S.focoDrawer = null;
  if (f && document.contains(f)) f.focus?.();
}
// Escape cierra lo de encima: primero el desplegable, luego el modal, luego el panel.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (DD) return; // lo atiende el manejador de los desplegables
    if ($('#tipSkill')) { e.preventDefault(); return cerrarTip(); }
    if (!$('#modal').hidden) { e.preventDefault(); return closeModal(); }
    if (!$('#drawer').hidden) { e.preventDefault(); return cerrarDrawer(); }
    return;
  }
  // El foco no se sale del modal mientras está abierto.
  if (e.key !== 'Tab' || $('#modal').hidden) return;
  const f = [...$('#mbox').querySelectorAll(FOCO)].filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const primero = f[0], ultimo = f[f.length - 1];
  if (!$('#mbox').contains(document.activeElement)) { e.preventDefault(); return primero.focus(); }
  if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
});
/** Confirmación con el estilo de la app: devuelve true si el usuario acepta. */
const ICON_WARN = '<svg class="warnic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.6h.01"/></svg>';
function confirmModal({ title, body, ok = 'Continuar', tone = 'warn' }) {
  return new Promise((resolve) => {
    S.modalResolve = resolve;
    openModal(`<div class="cm"><div class="cm-h ${tone}">${ICON_WARN}<h3>${esc(title)}</h3></div><div class="cm-b">${body}</div>
      <div class="cm-f"><button type="button" data-cm-no>Cancelar</button><button type="button" class="${tone} primary" data-cm-ok>${esc(ok)}</button></div></div>`);
    $('[data-cm-ok]', $('#mbox')).addEventListener('click', () => { S.modalResolve = null; closeModal(); resolve(true); });
    $('[data-cm-no]', $('#mbox')).addEventListener('click', () => closeModal());
    $('[data-cm-ok]', $('#mbox')).focus();
  });
}

/** Confirmación que además pide un texto. Devuelve la cadena, o null si se canceló. */
function pedirTexto({ title, body, ok = 'Guardar', label, placeholder = '', valor = '', tone = 'warn' }) {
  return new Promise((resolve) => {
    S.modalResolve = () => resolve(null);
    openModal(`<div class="cm"><div class="cm-h ${tone}">${ICON_WARN}<h3>${esc(title)}</h3></div>
      <div class="cm-b">${body}<label>${esc(label)}<input id="cmTxt" value="${esc(valor)}" placeholder="${esc(placeholder)}"></label></div>
      <div class="cm-f"><button type="button" data-cm-no>Cancelar</button><button type="button" class="${tone} primary" data-cm-ok>${esc(ok)}</button></div></div>`);
    const val = () => $('#cmTxt', $('#mbox'))?.value.trim() || '';
    $('[data-cm-ok]', $('#mbox')).addEventListener('click', () => { const v = val(); S.modalResolve = null; closeModal(); resolve(v); });
    $('[data-cm-no]', $('#mbox')).addEventListener('click', () => closeModal());
    $('#cmTxt', $('#mbox')).focus();
  });
}

/** ¿Ejecutar este paso es repetirlo? Si sí, avisa qué se restablece. Devuelve {ok, reset}. */
async function confirmRerun(s, argsValue) {
  const st = S.state;
  const yaHecho = (isDone(s) || s.aprobada) && !s.activa;
  const lotes = s.corridas.map((c) => c.alcance);
  const nuevoLote = s.arg && argsValue && !lotes.includes(argsValue.trim());
  if (!yaHecho || nuevoLote) return { ok: true, reset: false };
  const o = S.routes.open.find((x) => x.id === S.routes.current);
  const orden = (o ? resolveRoute(o)?.skills : null) || st.skills.map((x) => x.skill);
  const idx = orden.indexOf(s.skill);
  const despues = new Set(idx >= 0 ? orden.slice(idx + 1) : []);
  for (let grow = true; grow;) { grow = false; for (const x of st.skills) if (!despues.has(x.skill) && x.skill !== s.skill && (x.requiere || []).some((r) => r === s.skill || despues.has(r))) { despues.add(x.skill); grow = true; } }
  const afectados = st.skills.filter((x) => despues.has(x.skill) && (isDone(x) || x.aprobada) && x.estado !== 'SIN_ESTADO');
  const lista = afectados.length
    ? `<p>Estos pasos ya estaban hechos y quedarán <b>por revisar</b> hasta que el flujo avance de nuevo:</p><ul class="cm-l">${afectados.map((x) => `<li>${esc(x.nombre)}</li>`).join('')}</ul>`
    : '<p>No hay pasos posteriores hechos que se vean afectados.</p>';
  const ok = await confirmModal({
    title: `Vas a repetir «${s.nombre}»`,
    body: `<p>Este paso ya se ejecutó. Al repetirlo, el flujo se restablece desde aquí y deberás aprobarlo de nuevo.</p>${lista}<p class="cm-n">No se borra ningún documento: los actuales se toman como base de la nueva versión.</p>`,
    ok: 'Repetir desde aquí',
  });
  return { ok, reset: ok };
}

/** Los argumentos conocidos se eligen de una lista; solo lo desconocido (p. ej. el nombre del proyecto) es texto libre. */
function argSpec(s) {
  const a = (s.arg || '').trim(); if (!a) return null;
  const st = S.state, lotes = st.infra.alcances || [], def = argDefault(s.skill) || (/^\[(sprint|lote)/i.test(a) ? S.lote : '');
  if (/^\[sprint/i.test(a)) return { tipo: 'uno', label: 'Sprint', opts: lotes.filter((x) => /^sprint/i.test(x)).map((v) => [v, v]), def, vacio: 'Ninguno', nota: 'Aún no hay sprints registrados.' };
  if (/^\[lote/i.test(a)) return { tipo: 'uno', label: 'Lote', opts: [['backlog', 'backlog (todo)'], ...lotes.map((v) => [v, v])], def, vacio: 'Ninguno (todo el proyecto)' };
  if (/INT-NN/i.test(a)) return { tipo: 'uno', label: 'Integración', opts: (st.infra.integraciones || []).map((v) => [v, v]), def, vacio: 'Ninguna', nota: 'No hay integraciones listadas en integrations.md.' };
  if (/^<paso>/i.test(a)) return { tipo: 'uno', label: 'Paso a revisar', opts: st.skills.filter((x) => x.paso).map((x) => [x.paso, x.nombre]), def, vacio: 'Elige un paso' };
  if (/ampliar/i.test(a)) return { tipo: 'uno', label: 'Modo', opts: [['ampliar', 'Ampliar con material nuevo']], def, vacio: 'Normal (solo lo nuevo o cambiado)' };
  if (/documentos/i.test(a)) {
    const cp = (S.tree || []).find((n) => n.name === 'context-pack');
    const docs = (cp?.children || []).filter((n) => !n.dir && /\.md$/.test(n.name)).map((n) => n.name.replace(/\.md$/, ''));
    return { tipo: 'multi', label: 'Documentos', opts: docs.map((v) => [v, v]), def, nota: 'Sin selección se generan los que correspondan.' };
  }
  return { tipo: 'texto', label: a, def };
}
function argHtml(sp) {
  if (!sp) return '';
  if (sp.tipo === 'texto') return `<label>${esc(sp.label)}<input id="dArgs" placeholder="${esc(sp.label)}" value="${esc(sp.def)}"></label>`;
  if (sp.tipo === 'multi') return `<div class="field"><span class="lbl">${esc(sp.label)} <span class="muted">(opcional, varios)</span></span>${sp.opts.length ? `<div class="dd multi" id="dArgs" data-ph="Ninguno (sin argumento)"><div class="dd-t" tabindex="0" role="combobox" aria-haspopup="listbox" aria-expanded="false"><span class="dd-v"></span><svg class="dd-c" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></div><div class="dd-p" role="listbox" hidden><div class="dd-act"><span data-all>Todos</span><span data-none>Ninguno</span></div>${sp.opts.map(([v, t]) => `<label class="dd-o"><input type="checkbox" value="${esc(v)}" ${sp.def.split(/\s+/).includes(v) ? 'checked' : ''}><span class="ck"></span><span class="tx">${esc(t)}</span></label>`).join('')}</div></div>` : ''}${sp.nota ? `<p class="muted sm">${esc(sp.nota)}</p>` : ''}</div>`;
  const dis = sp.opts.length ? '' : 'disabled';
  return `<label>${esc(sp.label)}<select id="dArgs" ${dis}><option value="">${esc(sp.vacio)}</option>${sp.opts.map(([v, t]) => `<option value="${esc(v)}" ${v === sp.def ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>${!sp.opts.length && sp.nota ? `<p class="muted sm">${esc(sp.nota)}</p>` : ''}`;
}
const argValue = () => { const el = $('#dArgs'); if (!el) return ''; return el.matches('.dd.multi') ? [...(el._p || el).querySelectorAll('input:checked')].map((i) => i.value).join(' ') : el.value.trim(); };
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });

function openAddRoute() {
  const routes = allRoutes();
  openModal(`<button class="x" data-mclose>×</button><h3>Agregar ruta</h3>
    <p class="muted">Un tramo nuevo continúa tu camino: por defecto arranca en el primer paso pendiente y no repite lo ya hecho.</p>
    <div class="rlist">${routes.map((r) => {
      const ids = r.skills.filter((id) => skillOf(id));
      const first = ids.find((id) => { const s = skillOf(id); return s && pending(s) && !s.opcional; });
      return `<div class="ritem" data-base="${esc(r.id)}"><div class="grow"><b>${esc(r.nombre)}</b> <span class="muted">${r.tipo === 'propia' ? '· mía' : ''}</span><div class="muted">${esc(r.descripcion || '')}</div>
        <label class="inl">Empezar en <select data-desde>
          <option value="" ${r.repite ? 'selected' : ''}>el principio</option>
          ${first && !r.repite ? `<option value="${esc(first)}" selected>primer paso pendiente: ${esc(skillOf(first).nombre)}</option>` : ''}
          ${ids.map((id) => `<option value="${esc(id)}">${esc(skillOf(id).nombre)}</option>`).join('')}</select></label></div>
        <div class="col"><button class="primary sm" data-go>Abrir</button>${r.tipo === 'propia' ? '<button class="sm" data-edit>Editar</button><button class="danger sm" data-del>Borrar</button>' : ''}</div></div>`;
    }).join('')}</div>
    <div class="row"><button data-build>Armar una ruta nueva</button></div>`);
}

$('#mbox').addEventListener('click', async (e) => {
  if (e.target.closest('[data-mclose]')) return closeModal();
  if (e.target.closest('[data-build]') && !e.target.closest('.rcard')) return openBuilder();
  const it = e.target.closest('.ritem'); if (!it) return;
  const base = it.dataset.base;
  if (e.target.closest('[data-go]')) return openRoute(base, it.querySelector('[data-desde]').value || null);
  if (e.target.closest('[data-edit]')) return openBuilder(base);
  if (e.target.closest('[data-del]')) {
    S.routes.custom = S.routes.custom.filter((r) => r.id !== base);
    S.routes.open = S.routes.open.filter((o) => o.base !== base);
    await saveRoutes(); renderRutas(); return openAddRoute();
  }
});

// ---- pestaña Resumen: el estado del proyecto de un vistazo, fuera del camino
function renderResumen() {
  const st = S.state; if (!st) return;
  const pasos = st.skills.filter((s) => s.paso);
  const cuenta = { hechos: 0, aprobar: 0, trabajando: 0, bloqueados: 0, omitidos: 0, listos: 0, error: 0 };
  for (const s of pasos) {
    if (s.estado === 'OMITIDO') cuenta.omitidos++;
    else if (s.activa?.status === 'running') cuenta.trabajando++;
    else if (s.activa?.status === 'esperando') cuenta.aprobar++;
    else if (s.fallo) cuenta.error++;
    else if (isDone(s)) cuenta.hechos++;
    else if (s.listo) cuenta.listos++;
    else cuenta.bloqueados++;
  }
  const medibles = pasos.length - cuenta.omitidos;
  const pct = medibles ? Math.round((cuenta.hechos / medibles) * 100) : 0;
  $('#resHead').innerHTML = `<div class="rsum">
      <div><h2>${esc(st.proyecto || st.root?.split('/').pop() || 'Proyecto')}</h2><p class="muted">${esc(st.root || '')}</p></div>
      <div class="rpct"><div class="n">${pct}<small>%</small></div><div class="muted">${cuenta.hechos} de ${medibles} pasos con entregable</div></div>
    </div>`;

  // Barra apilada: el reparto del pipeline con los mismos colores del diagrama de pasos.
  const tramos = [
    ['hechos', cuenta.hechos, 'con entregable'],
    ['aprobar', cuenta.aprobar, 'esperando tu aprobación'],
    ['error', cuenta.error, 'con error'],
    ['trabajando', cuenta.trabajando, 'trabajando ahora'],
    ['listos', cuenta.listos, 'listos para ejecutar'],
    ['bloq', cuenta.bloqueados, 'esperan pasos previos'],
    ['omit', cuenta.omitidos, 'omitidos'],
  ].filter(([, v]) => v > 0);
  const totalT = tramos.reduce((a, [, v]) => a + v, 0) || 1;
  const barra = `<div class="stack">${tramos.map(([k, v, t]) => `<i class="t-${k}" style="width:${(v / totalT) * 100}%" title="${v} ${esc(t)}"></i>`).join('')}</div>`;
  const linea = (k, n, v) => `<div class="rl"><span class="dot t-${k}"></span><span class="v">${v}</span><span>${esc(n)}</span></div>`;

  const siguientes = pasos.filter((s) => s.listo && !isDone(s) && !s.activa && !s.fallo && s.estado !== 'OMITIDO').slice(0, 4);
  const esperando = pasos.filter((s) => s.activa?.status === 'esperando');
  const conError = pasos.filter((s) => s.fallo);
  const ICO = {
    pipeline: '<svg viewBox="0 0 24 24"><path d="M4 7h10M4 12h16M4 17h7"/><circle cx="18" cy="7" r="2"/><circle cx="14" cy="17" r="2"/></svg>',
    sigue: '<svg viewBox="0 0 24 24"><polygon points="7 4 19 12 7 20 7 4"/></svg>',
    entorno: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  };
  $('#resBody').innerHTML = `<div class="rgrid">
    <div class="acard"><h3><span class="ic azul">${ICO.pipeline}</span>Pipeline</h3>
      ${barra}
      <div class="rlines">
        ${cuenta.hechos ? linea('hechos', 'con entregable', cuenta.hechos) : ''}
        ${linea('aprobar', 'esperando tu aprobación', cuenta.aprobar)}
        ${cuenta.error ? linea('error', 'con error', cuenta.error) : ''}
        ${cuenta.trabajando ? linea('trabajando', 'trabajando ahora', cuenta.trabajando) : ''}
        ${linea('listos', 'listos para ejecutar', cuenta.listos)}
        ${linea('bloq', 'esperan pasos previos', cuenta.bloqueados)}
        ${cuenta.omitidos ? linea('omit', 'omitidos', cuenta.omitidos) : ''}
      </div>
    </div>
    <div class="acard"><h3><span class="ic verde">${ICO.sigue}</span>Qué sigue</h3>
      <div class="rlines">
      ${conError.length ? `<p class="rk">Terminó con error</p><ul class="nextlist">${conError.map((s) => `<li><button class="sm danger" data-res-err="${esc(s.fallo.runId)}">${esc(s.nombre)}</button></li>`).join('')}</ul>` : ''}
      ${esperando.length ? `<p class="rk">Pendiente de tu aprobación</p><ul class="nextlist">${esperando.map((s) => `<li><button class="sm" data-res-run="${esc(s.skill)}">${esc(s.nombre)}</button></li>`).join('')}</ul>` : ''}
      ${siguientes.length ? `<p class="rk">Puedes ejecutar ahora</p><ul class="nextlist">${siguientes.map((s) => `<li><button class="sm" data-res-paso="${esc(s.skill)}">${esc(s.nombre)}</button></li>`).join('')}</ul>`
        : (esperando.length || conError.length ? '' : '<p class="muted">Nada listo para ejecutar. Mira los pasos bloqueados en Rutas.</p>')}
      </div>
    </div>
    <div class="acard"><h3><span class="ic morado">${ICO.entorno}</span>Entorno</h3>
      <dl class="kv2">
        <dt>Plugin</dt><dd>${st.plugin?.ok ? '<span class="ok">cargado</span>' : '<span class="warn">no encontrado</span>'}</dd>
        <dt>Sesión</dt><dd>${S.auth?.loggedIn ? `<span class="ok">${esc(S.auth.detail || 'activa')}</span>` : '<span class="warn">sin sesión</span>'}</dd>
        <dt>Lote actual</dt><dd>${esc(S.lote || 'todos')}</dd>
        <dt>Preguntas abiertas</dt><dd>${st.resumen?.altoImpacto ? `<span class="warn">${st.resumen.preguntasAbiertas}</span>` : (st.resumen?.preguntasAbiertas ?? 0)}</dd>
      </dl>
    </div>
  </div>`;
  $$('#resBody [data-res-err]').forEach((b) => b.addEventListener('click', () => { switchTab('ejecucion'); selectRun(b.dataset.resErr); }));
  $$('#resBody [data-res-run]').forEach((b) => b.addEventListener('click', () => { switchTab('ejecucion'); const r = S.runs.find((x) => x.skill === b.dataset.resRun && x.status === 'esperando'); if (r) selectRun(r.id); }));
  $$('#resBody [data-res-paso]').forEach((b) => b.addEventListener('click', () => { switchTab('rutas'); openDrawer(b.dataset.resPaso); }));
}

// ---- lotes de historias (alcances del pipeline)
async function openLotes() {
  openModal('<button class="x" data-mclose>×</button><h3>Lotes de historias</h3><p class="muted">Cargando…</p>');
  let d = { lotes: [] };
  try { d = await api('/api/lotes'); } catch (e) {
    return openModal(`<button class="x" data-mclose>×</button><h3>Lotes de historias</h3><p class="muted">${esc(e.message)}</p>`);
  }
  pintarLotes(d);
}
function pintarLotes(d) {
  const filas = d.lotes.length
    ? `<table class="ut"><thead><tr><th>Lote</th><th>Historias</th><th>Rango</th><th></th></tr></thead><tbody>${d.lotes.map((l) => `<tr><td>${esc(l.nombre)}</td><td>${l.historias}</td><td class="muted">${esc(l.desde)} a ${esc(l.hasta)}</td><td><button class="sm" data-ed="${esc(l.nombre)}">Editar</button></td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">Todavía no hay lotes. «backlog» (todo) y «proyecto» funcionan sin definirse.</p>';
  openModal(`<button class="x" data-mclose>×</button><h3>Lotes de historias</h3>
    <p class="muted">Un lote agrupa historias para trabajar por partes: cada paso por lote (historias, casos, desarrollo) se ejecuta y se aprueba por separado.</p>
    ${filas}
    <h4 class="sep">Crear o cambiar un lote</h4>
    <label>Nombre<input id="loNom" placeholder="sprint-01"></label>
    <label>Historias<input id="loIt" placeholder="US-001 US-002 US-005  o  US-001..US-010"></label>
    <label>Qué hacer<select id="loModo"><option value="set">Dejar exactamente estas</option><option value="add">Agregar estas</option><option value="remove">Quitar estas</option></select></label>
    <div class="row"><button class="primary" id="loSave">Guardar lote</button><span class="muted" id="loMsg"></span></div>`);
  $('#loSave').addEventListener('click', async () => {
    const nombre = $('#loNom').value.trim(), items = $('#loIt').value.trim(), modo = $('#loModo').value;
    $('#loMsg').textContent = 'Guardando…';
    try {
      const r = await api('/api/lotes', { nombre, items, modo });
      $('#loMsg').textContent = r.mensaje || 'Listo.';
      reloadStateSoon();
      const nd = await api('/api/lotes');
      pintarLotes(nd);
      $('#loMsg').textContent = r.mensaje || 'Listo.';
    } catch (e) { $('#loMsg').textContent = e.message; }
  });
  $$('#mbox [data-ed]').forEach((b) => b.addEventListener('click', () => { $('#loNom').value = b.dataset.ed; $('#loIt').focus(); }));
}
$('#summary').addEventListener('click', (e) => { if (e.target.closest('[data-lotes]')) openLotes(); });
$('#summary').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-lotes]')) { e.preventDefault(); openLotes(); } });

// ---- tooltip de información de un paso (icono ⓘ del constructor de rutas)
function cerrarTip() {
  $('#tipSkill')?.remove();
  $$('.binfo[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
let tipTs = 0;
function toggleTip(btn) {
  tipTs = Date.now();
  const id = btn.dataset.info, mismo = $('#tipSkill')?.dataset.skill === id;
  cerrarTip();
  if (mismo) return;
  const s = skillOf(id); if (!s) return;
  const deps = (s.requiere || []).map((d) => skillOf(d)?.nombre || d);
  const rol = s.paso
    ? `Paso ${s.paso.split('-')[0]} del pipeline${s.opcional ? ' (opcional)' : ''}. En una ruta se desbloquea cuando sus dependencias tienen entregable.`
    : 'No es un paso del pipeline: se usa cuando hace falta y no bloquea ni desactualiza otros pasos.';
  const kv = (k, v) => (v ? `<div class="tkv"><b>${k}</b><span>${esc(v)}</span></div>` : '');
  const tip = el(`<div id="tipSkill" class="skilltip" role="tooltip" data-skill="${esc(id)}">
    <h5>${esc(s.nombre)}</h5>
    <p class="trol">${esc(rol)}</p>
    ${s.descripcion ? `<p>${esc(s.descripcion)}</p>` : ''}
    ${kv('Entrega', s.produce)}
    ${kv('Necesita', s.insumo || 'Nada previo')}
    ${deps.length ? kv('Antes va', deps.join(', ')) : ''}
  </div>`);
  const host = $('#mbox');
  host.appendChild(tip);
  btn.setAttribute('aria-expanded', 'true');
  const rb = btn.getBoundingClientRect(), rh = host.getBoundingClientRect();
  const w = 330;
  let x = rb.right - rh.left + host.scrollLeft + 8;
  if (rb.right + 8 + w > rh.left + host.clientWidth) x = Math.max(8, rb.left - rh.left + host.scrollLeft - w - 8);
  let y = rb.top - rh.top + host.scrollTop - 6;
  const maxY = host.scrollTop + host.clientHeight - tip.offsetHeight - 8;
  tip.style.left = `${x}px`; tip.style.top = `${Math.max(8, Math.min(y, maxY))}px`;
}
// el tooltip se ancla al icono: si la columna se desplaza, se cierra.
// El propio clic puede desplazar la columna para ver el icono: ese primer desplazamiento no cuenta.
$('#mbox').addEventListener('scroll', (e) => {
  if (e.target?.closest?.('#tipSkill')) return; // el scroll interno del tooltip no lo cierra
  if (Date.now() - tipTs > 300) cerrarTip();
}, true);

// ---- constructor de rutas propias
let B = null;
function openBuilder(editId = null) {
  const prev = editId ? S.routes.custom.find((r) => r.id === editId) : null;
  B = { id: prev?.id || null, nombre: prev?.nombre || '', skills: [...(prev?.skills || [])] };
  renderBuilder();
}
function renderBuilder() {
  const st = S.state;
  const groups = [...new Set(st.skills.map((s) => s.grupo))];
  const sel = new Set(B.skills);
  const problemas = problemasRuta(B.skills);
  const hint = (id) => {
    const p = problemas.find((x) => x.id === id);
    return p ? `<small class="warn">Antes necesita: ${p.m.map((m) => esc(skillOf(m)?.nombre || m)).join(', ')}</small>` : '';
  };
  openModal(`<button class="x" data-mclose>×</button><h3>${B.id ? 'Editar ruta' : 'Armar mi ruta'}</h3>
    <label>Nombre<input id="bName" value="${esc(B.nombre)}" placeholder="Ej.: Preventa rápida"></label>
    <label>Partir de una ruta existente (opcional)<select id="bBase"><option value="">Vacía</option>${allRoutes().map((r) => `<option value="${esc(r.id)}">${esc(r.nombre)}</option>`).join('')}</select></label>
    <div class="bcols">
      <div class="bcol"><h4>Skills disponibles</h4>${groups.map((g) => `<div class="g">${esc(g)}</div>${st.skills.filter((s) => s.grupo === g).map((s) => `<div class="bs ${sel.has(s.skill) ? 'used' : ''}" data-add="${esc(s.skill)}"><button type="button" class="icon-btn binfo" data-info="${esc(s.skill)}" title="Qué hace este paso" aria-expanded="false" aria-label="Qué hace ${esc(s.nombre)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/></svg></button><span class="bn">${esc(s.nombre)}</span><b>${sel.has(s.skill) ? '✓' : '+'}</b></div>`).join('')}`).join('')}</div>
      <div class="bcol"><h4>Mi ruta (${B.skills.length})</h4>${B.skills.length ? B.skills.map((id, i) => `<div class="bs" data-i="${i}"><span>${i + 1}. ${esc(skillOf(id)?.nombre || id)}${hint(id)}</span><span class="bctl"><button class="icon-btn" data-up title="Subir" aria-label="Subir">↑</button><button class="icon-btn" data-down title="Bajar" aria-label="Bajar">↓</button><button class="icon-btn" data-rm title="Quitar" aria-label="Quitar">✕</button></span></div>`).join('') : '<p class="muted">Agrega skills con el botón +.</p>'}</div>
    </div>
    <div class="row"><button class="primary" id="bSave" ${bMotivos(problemas).length ? 'disabled' : ''}>Guardar y abrir</button>${problemas.length ? '<button class="warn primary" id="bFix">Agregar lo que falta</button>' : ''}<span class="muted" id="bMsg">${esc(bMotivos(problemas).join(' '))}</span></div>`);
}
/** Por qué todavía no se puede guardar la ruta (lista vacía = se puede). */
function bMotivos(problemas) {
  const m = [];
  if (!(B.nombre || '').trim()) m.push('Ponle un nombre a la ruta.');
  if (!B.skills.length) m.push('Agrega al menos un paso.');
  if (problemas.length) m.push(`${problemas.length === 1 ? 'Un paso tiene' : problemas.length + ' pasos tienen'} dependencias sin resolver: agrégalas antes de ese paso o quítalo.`);
  return m;
}
/** Dependencias de un paso (según el estado real del proyecto) que no están hechas ni van antes en la ruta. */
function problemasRuta(lista) {
  const out = [];
  lista.forEach((id, i) => {
    const m = (skillOf(id)?.faltan || []).map((f) => f.skill).filter((d) => d !== id && !lista.slice(0, i).includes(d));
    if (m.length) out.push({ id, i, m });
  });
  return out;
}
/** Inserta, antes de cada paso, las dependencias que le faltan (o mueve antes las que estaban después). */
function completarRuta() {
  for (let g = 0; g < 80; g++) {
    const p = problemasRuta(B.skills)[0]; if (!p) break;
    const dep = p.m[0], j = B.skills.indexOf(dep);
    if (j >= 0) B.skills.splice(j, 1);
    B.skills.splice(B.skills.indexOf(p.id), 0, dep);
  }
}
$('#mbox').addEventListener('input', (e) => {
  if (e.target.id !== 'bName' || !B) return;
  B.nombre = e.target.value;
  const m = bMotivos(problemasRuta(B.skills));
  $('#bSave').disabled = m.length > 0; $('#bMsg').textContent = m.join(' ');
});
$('#mbox').addEventListener('change', (e) => {
  if (e.target.id === 'bBase' && B && e.target.value) {
    const r = allRoutes().find((x) => x.id === e.target.value);
    if (r) { B.skills = r.skills.filter(skillOf); if (!B.nombre) B.nombre = `${r.nombre} (mía)`; renderBuilder(); }
  }
});
$('#mbox').addEventListener('click', async (e) => {
  const inf = e.target.closest('[data-info]');
  if (inf) return toggleTip(inf);
  if (!e.target.closest('#tipSkill')) cerrarTip();
  if (!B) return;
  const add = e.target.closest('[data-add]');
  if (add) { const id = add.dataset.add; B.skills = B.skills.includes(id) ? B.skills.filter((x) => x !== id) : [...B.skills, id]; return renderBuilder(); }
  const row = e.target.closest('.bs[data-i]');
  if (row) {
    const i = Number(row.dataset.i);
    if (e.target.closest('[data-rm]')) B.skills.splice(i, 1);
    else if (e.target.closest('[data-up]') && i > 0) [B.skills[i - 1], B.skills[i]] = [B.skills[i], B.skills[i - 1]];
    else if (e.target.closest('[data-down]') && i < B.skills.length - 1) [B.skills[i + 1], B.skills[i]] = [B.skills[i], B.skills[i + 1]];
    else return;
    return renderBuilder();
  }
  if (e.target.id === 'bFix') { completarRuta(); return renderBuilder(); }
  if (e.target.id === 'bSave') {
    if (bMotivos(problemasRuta(B.skills)).length) return renderBuilder();
    const nombre = (B.nombre || '').trim();
    const id = B.id || `mia-${uidc()}`;
    const r = { id, nombre, descripcion: `${B.skills.length} pasos, armada por ti`, skills: B.skills };
    S.routes.custom = [...S.routes.custom.filter((x) => x.id !== id), r];
    if (!B.id) { const o = { id: uidc(), base: id, desde: null, nombre: '' }; S.routes.open.push(o); S.routes.current = o.id; }
    B = null; await saveRoutes(); closeModal(); switchTab('rutas'); renderRutas();
  }
});

// ---------------------------------------------------------------- panel de ejecución de una skill
async function openDrawer(skillId) {
  S.focoDrawer = document.activeElement;
  if (!S.tree?.length) await loadTree();
  const st = S.state, s = st.skills.find((x) => x.skill === skillId); if (!s) return;
  const sugerido = st.models.find((m) => m.tier === s.tier)?.id || st.defaultModel;
  const alcances = ['backlog', ...st.infra.alcances];
  const faltan = s.faltan.length
    ? `<ul class="req">${s.faltan.map((f) => `<li><span class="n">✗</span> ${esc(f.nombre)} <span class="muted">(${f.porAprobar ? 'falta aprobar la etapa' : esc(ESTADO[f.estado] || f.estado)})</span></li>`).join('')}</ul>`
    : '<p class="muted">Requisitos cumplidos.</p>';
  const corridas = s.corridas.length
    ? `<div class="dl">${s.corridas.map((c) => `<a data-open="${esc(c.carpeta)}">Ver ${esc(c.alcance)} v${c.version} (${esc(ESTADO[c.estado] || c.estado)})</a>`).join('')}</div>` : '';
  $('#dBody').innerHTML = `
    <h2>${esc(s.nombre)}</h2>
    <div class="kv">
      <b>Estado</b><span>${esc(ESTADO[s.estado] || s.estado)}${s.detalle ? ` <span class="muted">· ${esc(s.detalle)}</span>` : ''}</span>
      <b>Necesita</b><span>${esc(s.insumo || 'Nada previo')}</span>
      <b>Entrega</b><span>${esc(s.produce || '')}</span>
      ${s.aprobada?.lotes?.length ? `<b>Aprobada para</b><span>${s.aprobada.lotes.map(esc).join(', ')}</span>` : ''}
      ${s.efectosReales ? '<b>Ojo</b><span>Actúa sobre repositorios o entornos reales. Por defecto pregunta antes de cada acción.</span>' : ''}
    </div>
    <h4>Pasos previos</h4>${faltan}${corridas}
    ${s.skill === 'generate-context-pack' && st.pack?.pendientes > 0 ? `<p class="packnote"><b>Hay un plan por tandas a medias:</b> ${st.pack.hechos} de ${st.pack.total} documentos escritos, sigue la tanda ${st.pack.tandaActual} de ${st.pack.tandas}. Ejecutar continúa donde quedó, pero en una conversación nueva que no recuerda lo escrito. Si aún tienes abierta la conversación anterior en Ejecución, es mejor seguir allí.</p>` : ''}
    ${argHtml(argSpec(s))}
    <label>Instrucciones adicionales (opcional)<textarea id="dInstr" rows="3" placeholder="Ej.: enfócate en el módulo de pagos"></textarea></label>
    <label>Modelo<select id="dModel">${st.models.map((m) => `<option value="${esc(m.id)}" ${m.id === sugerido ? 'selected' : ''}>${esc(m.label)}${m.id === sugerido ? ' (sugerido)' : ''}</option>`).join('')}</select></label>
    <label>Permisos<select id="dAppr">
      <option value="auto" ${s.efectosReales ? '' : 'selected'}>Automático: pregunta solo lo riesgoso</option>
      <option value="preguntar" ${s.efectosReales ? 'selected' : ''}>Preguntar antes de cada comando</option>
    </select></label>
    ${s.listo ? '' : `<p class="lockmsg"><span class="lockic"></span>Este paso está bloqueado: completa y aprueba los pasos previos para poder ejecutarlo.</p>`}
    <div class="row"><button class="primary" id="dRun" ${!S.auth?.loggedIn || !s.listo || S.runs.some((r) => r.status === 'running' && r.skill === s.skill) ? 'disabled' : ''} ${!S.auth?.loggedIn ? 'title="Primero inicia sesión con tu cuenta de Claude"' : ''}>${isDone(s) && !s.activa ? 'Repetir paso' : 'Ejecutar'}</button>${s.opcional && s.paso ? `<button id="dSkip" class="ghost">${s.estado === 'OMITIDO' ? 'Reactivar este paso' : 'Omitir este paso'}</button>` : ''}<span id="dMsg" class="muted">${!S.auth?.loggedIn ? '<span class="nosesion">Sin sesión de Claude: inicia sesión arriba a la derecha.</span>' : ''}</span></div>`;
  $('#drawer').hidden = false;
  ($('#dBody').querySelector(FOCO) || $('#dClose')).focus?.();
  $$('#dBody [data-open]').forEach((a) => a.addEventListener('click', () => { cerrarDrawer(); openFolder(a.dataset.open); }));
  $('#dSkip')?.addEventListener('click', async () => {
    const omitir = s.estado !== 'OMITIDO';
    let motivo = '';
    if (omitir) {
      motivo = await pedirTexto({ title: `Omitir «${s.nombre}»`, body: '<p>El paso queda marcado como omitido y deja de pedirse. Los que dependen de él siguen adelante sin su entregable. Puedes reactivarlo cuando quieras.</p>', ok: 'Omitir el paso', label: 'Motivo (queda en la bitácora)', placeholder: 'Ej.: el cliente ya tiene design system' });
      if (motivo === null) return;
    }
    $('#dMsg').textContent = omitir ? 'Omitiendo…' : 'Reactivando…';
    try { await api('/api/paso-omitido', { paso: s.paso, omitir, motivo }); cerrarDrawer(); await loadState(); }
    catch (e) { $('#dMsg').textContent = e.message; }
  });
  $('#dRun').addEventListener('click', async () => {
    const args = argValue();
    const rr = await confirmRerun(s, args); if (!rr.ok) return;
    $('#dMsg').textContent = 'Iniciando…';
    try {
      const run = await api('/api/run', {
        skill: s.skill, args, instruction: $('#dInstr').value, model: $('#dModel').value,
        approval: $('#dAppr').value, reset: rr.reset,
      });
      cerrarDrawer();
      await loadRuns(); switchTab('ejecucion'); await selectRun(run.id);
    } catch (e) {
      if (e.data?.sinSesion) return avisoSinSesion(e.message, '#dMsg');
      $('#dMsg').textContent = e.data?.faltan ? `Faltan: ${e.data.faltan.map((f) => f.nombre).join(', ')}` : e.message;
    }
  });
}
$('#dClose').addEventListener('click', cerrarDrawer);

// ---------------------------------------------------------------- ejecuciones
async function loadRuns() {
  try { S.runs = await api('/api/runs'); } catch { return; }
  renderRuns(); renderHeader(); renderRutas();
}

/** Skills de la ruta que el usuario tiene abierta, para filtrar la lista de ejecuciones. */
function skillsRutaAbierta() {
  const abiertas = (S.routes?.open || []).map(resolveRoute).filter(Boolean);
  const cur = abiertas.find((x) => x.id === S.routes?.current);
  return cur && cur.skills.length ? new Set(cur.skills) : null;
}

/**
 * Una ejecución pertenece a una skill y a un lote, no a una ruta (la misma skill está en
 * varias rutas). Por eso la lista se agrupa por lote, y la ruta abierta es solo un filtro.
 */
function renderRuns() {
  const box = $('#runs');
  const deRuta = skillsRutaAbierta();
  const filtro = deRuta
    ? `<label class="rfiltro"><input type="checkbox" id="soloRuta" ${S.soloRuta ? 'checked' : ''}>Solo los pasos de mi ruta</label>`
    : '';
  if (!S.runs.length) { box.innerHTML = `${filtro}<p class="muted vacio">Aún no hay ejecuciones.</p>`; return; }
  // la ejecución abierta nunca se esconde: si no, el registro de la derecha quedaría huérfano
  const lista = S.soloRuta && deRuta ? S.runs.filter((r) => deRuta.has(r.skill) || r.id === S.cur) : S.runs;
  if (!lista.length) { box.innerHTML = `${filtro}<p class="muted vacio">Ninguna ejecución es de esta ruta.</p>`; return; }
  const m = Object.fromEntries((S.state?.models || []).map((x) => [x.id, x.label]));
  const grupos = new Map();
  for (const r of lista) { const k = r.alcance || ''; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(r); }
  const varios = grupos.size > 1;
  box.innerHTML = filtro + [...grupos].map(([k, rs]) => {
    const viva = rs.some((r) => r.status === 'running' || r.status === 'esperando');
    const cab = varios
      ? `<div class="rgrupo"><span class="gn">${esc(k || 'Proyecto')}</span><span class="gc">${rs.length}</span>${viva ? '<i class="dot"></i>' : ''}</div>`
      : '';
    return cab + rs.map((r) => tarjetaRun(r, m, varios)).join('');
  }).join('');
}

function tarjetaRun(r, m, agrupado) {
  const lote = !agrupado && r.alcance ? `<span class="pill lt">${esc(r.alcance)}</span>` : '';
  return `<div class="run st-${esc(r.status)} ${r.id === S.cur ? 'on' : ''}" data-id="${esc(r.id)}" tabindex="0" role="button">
    <span class="rst" aria-hidden="true">${RUN_ICON[r.status] || RUN_ICON.cerrada}</span>
    <div class="rbody"><div class="a">${esc(r.title)}</div>
      <div class="b"><span class="pill">${esc(RUN_ESTADO[r.status] || r.status)}</span>${r.pending ? '<span class="pill q">espera tu respuesta</span>' : ''}${lote}</div>
      <div class="b dim">${esc(m[r.model] || r.model)} · ${new Date(r.started).toLocaleString()}</div></div></div>`;
}
$('#runs').addEventListener('change', (e) => { if (e.target.id === 'soloRuta') { S.soloRuta = e.target.checked; renderRuns(); } });
$('#runs').addEventListener('click', (e) => { const r = e.target.closest('.run'); if (r) selectRun(r.dataset.id); });
$('#runs').addEventListener('keydown', (e) => { const r = e.target.closest('.run'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectRun(r.dataset.id); } });

async function selectRun(id) {
  S.cur = id;
  const d = await api(`/api/runs/${id}`);
  S.events = d.events; S.curSummary = d.summary;
  renderRuns(); renderLog();
}

function nearBottom(el) { return el.scrollHeight - el.scrollTop - el.clientHeight < 120; }

function renderLog() {
  const head = $('#logHead'), body = $('#logBody');
  const sm = S.curSummary;
  if (!sm) { head.textContent = ''; body.innerHTML = '<p class="muted">Elige una skill en Rutas y pulsa Ejecutar.</p>'; $('#composer').hidden = true; return; }
  const resolved = new Map(S.events.filter((e) => e.type === 'resolved').map((e) => [e.id, e]));
  body.innerHTML = '';
  if (sm.recortado) body.append(el('<div class="tool">Historial largo: se muestra la parte final. El archivo completo está en .delivery-ui/runs/.</div>'));
  for (const ev of S.events) colocar(body, ev, nodesFor(ev, resolved));
  renderOptions();
  updateHead();
  body.scrollTop = body.scrollHeight;
}

/**
 * Un entregable grande puede tener al modelo escribiendo diez o quince minutos sin que llegue
 * nada al registro, y desde fuera eso no se distingue de una ejecución colgada. Esta barra
 * responde a la única pregunta que importa entonces: ¿sigue haciendo algo?
 */
const PULSO = { chars: 0, modo: '', ts: 0 };
let latidoTimer = null;
const transcurrido = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
};
function pintarLatido() {
  const sm = S.curSummary, caja = $('#latido');
  if (!caja) return;
  clearInterval(latidoTimer); latidoTimer = null;
  if (!sm || sm.status !== 'running') { caja.hidden = true; caja.innerHTML = ''; return; }
  caja.hidden = false;
  // Desde cuándo lleva trabajando ESTE turno. «started» es cuándo se creó la etapa, que puede
  // haber pasado la noche esperando tu respuesta: contar desde ahí daría horas de «trabajando».
  const desde = sm.turnoDesde || S.events.filter((e) => e.type === 'status' && e.status === 'running').at(-1)?.ts || sm.started || Date.now();
  const ultimo = () => Math.max(PULSO.ts || 0, S.events.at(-1)?.ts || 0, desde);
  const pinta = () => {
    const quieto = Date.now() - ultimo();
    const escribiendo = PULSO.ts && Date.now() - PULSO.ts < 2500;
    const detalle = escribiendo
      ? `escribiendo ${nf.format(PULSO.chars)} caracteres${PULSO.modo === 'herramienta' ? ' en una herramienta' : ''}`
      : quieto > 150000 ? `sin novedades desde hace ${transcurrido(quieto)}. Sigue conectada: con un entregable grande es normal que pase minutos escribiendo un solo bloque.`
      : `último movimiento hace ${transcurrido(quieto)}`;
    caja.innerHTML = `<span class="lp ${escribiendo ? 'on' : ''}" aria-hidden="true"></span><b>Trabajando ${transcurrido(Date.now() - desde)}</b><span class="muted">${esc(detalle)}</span>`;
  };
  pinta();
  latidoTimer = setInterval(pinta, 1000);
}

function updateHead() {
  const sm = S.curSummary; if (!sm) return;
  const m = Object.fromEntries((S.state?.models || []).map((x) => [x.id, x.label]));
  const cost = sm.cost ? ` · equivalente API ≈ US$ ${sm.cost.toFixed(2)} (referencia, no se cobra)` : '';
  const pk = S.state?.pack, esPack = sm.skill === 'generate-context-pack' && !!pk, packPend = esPack && pk.pendientes > 0;
  const packChip = esPack ? `<span class="chip pk">${packPend ? `Tanda ${pk.tandaActual} de ${pk.tandas} · ${pk.hechos}/${pk.total} documentos` : `Plan completo · ${pk.total} documentos`}</span>` : '';
  const loteChip = sm.alcance ? `<span class="chip lt">${esc(sm.alcance)}</span>` : '';
  $('#logHead').innerHTML = `<span>${esc(sm.title)}</span><span class="chip">${esc(RUN_ESTADO[sm.status] || sm.status)}</span>${loteChip}${packChip}<span class="muted normal">${esc(m[sm.model] || sm.model)}${esc(cost)}</span>`;
  pintarLatido();
  $('#composer').hidden = false;
  const fin = sm.status === 'aprobada' || sm.status === 'cerrada';
  $('#composer').hidden = sm.status === 'aprobada';
  $('#btnStop').hidden = sm.status !== 'running';
  $('#composer button[type=submit]').disabled = sm.status === 'running' || !sm.hasSession || fin;
  $('#replyText').disabled = sm.status === 'running' || fin;
  const ok = sm.status === 'esperando' && sm.hasResult && sm.ok !== false;
  $('#btnApprove').disabled = !ok || packPend;
  $('#btnApprove').title = packPend ? `Quedan ${pk.pendientes} documentos del plan (tanda ${pk.tandaActual} de ${pk.tandas}). Sigue con la tanda siguiente, o cambia el plan para quitarlos.` : ok ? 'Da por buena esta etapa y desbloquea las que dependen de ella' : 'Se habilita cuando la skill ya respondió';
  const nx = $('#btnNext');
  nx.hidden = !(packPend && sm.status === 'esperando' && sm.hasSession && !sm.pending);
  if (!nx.hidden) nx.textContent = `Continuar con la tanda ${pk.tandaActual} de ${pk.tandas}`;
  $('#btnFresh').disabled = sm.status === 'running';
  $('#btnFresh').title = sm.status === 'running' ? 'Espera a que termine o deténla' : 'Empieza la misma skill con contexto limpio';
  $('#btnClose').disabled = ['running', 'cerrada', 'aprobada'].includes(sm.status);
  $('#btnClose').title = sm.status === 'cerrada' ? 'Esta ejecución ya fue descartada' : sm.status === 'aprobada' ? 'Esta etapa ya está aprobada: para cambiarla, repite el paso' : sm.status === 'running' ? 'Detén la ejecución antes de descartarla' : 'Cierra esta ejecución sin aprobarla';
}

function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

/**
 * Varios subagentes trabajando a la vez se leían como un solo hilo que repetía cosas parecidas,
 * que es justo lo que parece un ciclo. Cada uno tiene ahora su bloque, con su nombre y su cuenta.
 */
function colocar(body, ev, nodos) {
  if (!nodos.length) return;
  if (ev.type === 'subagente') {
    const caja = el(`<div class="subbox" data-sub="${esc(ev.subId)}"></div>`);
    caja.append(...nodos);
    if (ev.tarea) caja.append(el(`<div class="tool">${esc(ev.tarea)}</div>`));
    body.append(caja);
    return;
  }
  const caja = ev.subId ? body.querySelector(`.subbox[data-sub="${CSS.escape(ev.subId)}"]`) : null;
  (caja || body).append(...nodos);
  if (caja) {
    const n = caja.querySelectorAll('.tool, .msg').length;
    const cab = caja.querySelector('.subhead .muted');
    if (cab) cab.textContent = `${n} paso${n === 1 ? '' : 's'}`;
  }
}

function nodesFor(ev, resolved) {
  switch (ev.type) {
    case 'user': {
      const m = /^\/[\w-]+:([a-z0-9-]+)(?:\s+([\s\S]*))?$/.exec(ev.text || '');
      if (!m) return [el(`<div class="msg user">${esc(ev.text)}</div>`)];
      const nombre = skillOf(m[1])?.nombre || m[1], extra = (m[2] || '').trim();
      return [el(`<div class="runhead"><span class="rh-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M10.5 9l4 3-4 3z"/></svg></span><div><div><b>Ejecutando</b> <span class="rh-n">${esc(nombre)}</span></div>${extra ? `<div class="rh-d">Con: ${esc(extra)}</div>` : ''}</div></div>`)];
    }
    case 'init': return [el(`<div class="tool">Sesión iniciada${ev.model ? ` · ${esc(ev.model)}` : ''}</div>`)];
    case 'text': return [el(`<div class="msg md ${ev.sub ? 'sub' : ''}">${md(ev.text)}</div>`)];
    case 'tool': return [el(`<div class="tool"><b>${esc(ev.tool)}</b> ${esc(ev.summary)}</div>`)];
    case 'subagente': return [el(`<div class="subhead" data-sub="${esc(ev.subId)}"><span class="si" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg></span><b>${esc(ev.nombre)}</b><span class="muted">trabaja aparte</span></div>`)];
    case 'tool_error': return [el(`<div class="tool err">${esc(ev.text)}</div>`)];
    case 'stderr': return [el(`<div class="tool err">${esc(ev.text)}</div>`)];
    case 'note': return [el(`<div class="tool">${esc(ev.text)}</div>`)];
    case 'alcance': return [el(`<div class="tool">Lote de la ejecución: <b>${esc(ev.alcance)}</b>${ev.antes ? ` (antes ${esc(ev.antes)})` : ''}</div>`)];
    case 'error': return [el(`<div class="card2 risky"><h5>Error</h5><div class="msg">${esc(ev.text)}</div></div>`)];
    case 'hint': {
      const txt = ev.kind === 'auth' ? 'No hay sesión de Claude válida. Usa "Iniciar sesión" arriba a la derecha y vuelve a intentar.'
        : ev.kind === 'limit' ? 'Llegaste a un límite de uso. Espera al reinicio de tu plan o prueba con un modelo más liviano.'
        : ev.kind === 'repite' || ev.kind === 'gasto' ? ev.text : `Aviso: ${ev.text}`;
      return [el(`<div class="card2 p"><h5>${esc(txt)}</h5></div>`)];
    }
    case 'question': return [questionCard(ev, resolved.get(ev.id) || null)];
    case 'permission': return [permissionCard(ev, resolved.get(ev.id) || null)];
    case 'resolved': return [];
    case 'result': return [resultCard(ev)];
    default: return [];
  }
}

function questionCard(ev, done) {
  const live = !done && S.curSummary?.status === 'running';
  // Ya respondida: la tarjeta pasa a verde y conserva marcado lo que eligió el usuario.
  const dadas = done?.answers || null, omitida = !!done && !done.answers;
  const c = el(`<div class="card2 ${dadas ? 'ok' : omitida ? '' : 'q'}" data-qid="${esc(ev.id)}"></div>`);
  (ev.questions || []).forEach((q, qi) => {
    const type = q.multiSelect ? 'checkbox' : 'radio';
    const resp = dadas ? String(dadas[q.question] ?? '').split(',').map((x) => x.trim()).filter(Boolean) : [];
    const libres = resp.filter((r) => !(q.options || []).some((o) => o.label === r));
    c.append(el(`<div><h5>${esc(q.header || 'Pregunta')}</h5><div>${esc(q.question)}</div>
      ${(q.options || []).map((o) => `<label class="opt ${resp.includes(o.label) ? 'elegida' : ''}"><input type="${type}" name="q${qi}" value="${esc(o.label)}" class="auto" ${resp.includes(o.label) ? 'checked' : ''} ${live ? '' : 'disabled'}> ${esc(o.label)}${o.description ? `<small>${esc(o.description)}</small>` : ''}</label>`).join('')}
      <label class="opt ${libres.length ? 'elegida' : ''}">Otra respuesta: <input type="text" data-other="${qi}" value="${esc(libres.join(', '))}" ${live ? '' : 'disabled'}></label></div>`));
  });
  if (live) {
    const row = el('<div class="row"><button class="primary">Enviar respuestas</button><button class="ghost" data-skip>Omitir</button><span class="muted" data-msg></span></div>');
    c.append(row);
    row.querySelector('.primary').addEventListener('click', async () => {
      const answers = {};
      for (const [qi, q] of (ev.questions || []).entries()) {
        const sel = $$(`input[name=q${qi}]:checked`, c).map((i) => i.value);
        const other = $(`[data-other="${qi}"]`, c).value.trim();
        if (other) sel.push(other);
        if (!sel.length) { row.querySelector('[data-msg]').textContent = 'Responde todas las preguntas u omite.'; return; }
        answers[q.question] = sel.join(', ');
      }
      await sendAnswer(ev.id, { answers }, row);
    });
    row.querySelector('[data-skip]').addEventListener('click', () => sendAnswer(ev.id, { skip: true }, row));
  } else c.append(el(`<div class="resuelta ${dadas ? 'si' : ''}">${dadas ? '✓ Respuestas enviadas' : omitida ? 'Omitida: no respondiste estas preguntas' : 'Respondida'}</div>`));
  return c;
}

function permissionCard(ev, done) {
  const live = !done && S.curSummary?.status === 'running';
  const c = el(`<div class="card2 ${ev.risky ? 'risky' : 'p'}" data-qid="${esc(ev.id)}"><h5>${ev.risky ? 'Acción riesgosa: ' : ''}La skill quiere usar ${esc(ev.tool)}</h5><div class="tool pre">${esc(ev.summary)}</div>${ev.reason ? `<div class="muted">${esc(ev.reason)}</div>` : ''}</div>`);
  if (live) {
    const shell = ev.tool === 'Bash' || ev.tool === 'PowerShell';
    const recordar = shell ? (ev.programa ? `Permitir «${esc(ev.programa)}» siempre en esta ejecución` : '') : 'Permitir siempre en esta ejecución';
    const row = el(`<div class="row"><button class="primary" data-a>Permitir</button>${recordar ? `<button data-r>${recordar}</button>` : ''}<button class="danger" data-d>Denegar</button><span class="muted" data-msg></span></div>`);
    c.append(row);
    row.querySelector('[data-a]').addEventListener('click', () => sendAnswer(ev.id, { decision: 'allow' }, row));
    row.querySelector('[data-r]')?.addEventListener('click', () => sendAnswer(ev.id, { decision: 'allow', remember: true }, row));
    row.querySelector('[data-d]').addEventListener('click', () => sendAnswer(ev.id, { decision: 'deny' }, row));
  } else {
    const d = done?.decision;
    c.append(el(`<div class="resuelta ${d === 'allow' ? 'si' : d === 'deny' ? 'no' : ''}">${d === 'allow' ? '✓ Permitida' : d === 'deny' ? '✕ Denegada' : 'Resuelta'}</div>`));
    if (d === 'allow') c.classList.add('ok');
  }
  return c;
}

async function sendAnswer(id, payload, row) {
  try { await api('/api/answer', { runId: S.cur, id, ...payload }); } catch (e) { row.querySelector('[data-msg]').textContent = e.message; }
}

function resultCard(ev) {
  const bad = !ev.ok;
  const files = (ev.files || []).filter((f) => /^(outputs|context-pack|evidence)\//.test(f));
  const meta = [ev.turns ? `${ev.turns} turnos` : '', ev.ms ? `${Math.round(ev.ms / 1000)} s` : '', ev.cost ? `equivalente API ≈ US$ ${ev.cost.toFixed(2)} (referencia)` : ''].filter(Boolean).join(' · ');
  const c = el(`<div class="card2 res ${bad ? 'bad' : ''}"><h5>${bad ? 'Terminó con error' : 'Turno terminado'}</h5>${ev.text ? `<div class="msg md">${md(ev.text)}</div>` : ''}<div class="muted">${esc(meta)}</div>
    ${files.length ? `<div class="files"><h5 class="sep">Archivos en el proyecto</h5>${files.map((f) => `<a data-f="${esc(f)}">${esc(f)}</a>`).join('')}</div>` : ''}</div>`);
  $$('[data-f]', c).forEach((a) => a.addEventListener('click', () => openDoc(a.dataset.f)));
  return c;
}

$('#composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = $('#replyText').value.trim(); if (!t || !S.cur) return;
  try { await api('/api/reply', { runId: S.cur, text: t }); $('#replyText').value = ''; } catch (err) { banner(err.message, true); }
});
$('#btnNext').addEventListener('click', async () => {
  try { await api('/api/reply', { runId: S.cur, text: 'Continuar con la tanda siguiente.' }); } catch (err) { banner(err.message, true); }
});
$('#btnStop').addEventListener('click', () => api('/api/stop', { runId: S.cur }));
$('#btnClose').addEventListener('click', async () => {
  const ok = await confirmModal({ title: 'Descartar esta ejecución', body: '<p>No aprueba la etapa y no desbloquea las siguientes. Los documentos que ya generó se conservan.</p>', ok: 'Descartar', tone: 'danger' });
  if (ok) await api('/api/close', { runId: S.cur });
});
$('#btnApprove').addEventListener('click', async () => {
  try { await api('/api/approve', { runId: S.cur }); } catch (e) { banner(e.message, true); }
});
$('#btnFresh').addEventListener('click', async () => {
  const sm = S.curSummary; if (!sm) return;
  const sk = S.state.skills.find((x) => x.skill === sm.skill);
  const pk = S.state.pack;
  if (sm.skill === 'generate-context-pack' && pk?.pendientes > 0) {
    const ok = await confirmModal({ title: 'Empezar una conversación nueva', body: `<p>El plan sigue en la tanda ${pk.tandaActual} de ${pk.tandas} (${pk.pendientes} documentos pendientes) y continuará donde quedó. Pero la conversación nueva no recuerda lo ya escrito: tendrá que releer los documentos desde el disco.</p><p>Lo más seguro para la calidad es seguir en esta misma conversación con «Continuar con la tanda».</p>`, ok: 'Empezar de nuevo', tone: 'warn' });
    if (!ok) return;
    try { const run = await api('/api/run', { skill: sm.skill, args: 'continuar', instruction: sm.instruction, model: sm.model, approval: sm.approval }); await loadRuns(); await selectRun(run.id); } catch (e) { banner(e.message, true); }
    return;
  }
  const rr = sk ? await confirmRerun(sk, sm.args || '') : { ok: true, reset: false }; if (!rr.ok) return;
  try {
    const run = await api('/api/run', { skill: sm.skill, args: sm.args, instruction: sm.instruction, model: sm.model, approval: sm.approval, reset: rr.reset });
    await loadRuns(); await selectRun(run.id);
  } catch (e) { if (e.data?.sinSesion) avisoSinSesion(e.message); else banner(e.message, true); }
});

/**
 * Sin sesión ninguna skill puede trabajar, así que el paso ni siquiera arranca: no se marca
 * como fallido, porque el error no es suyo. Se avisa y se ofrece iniciar sesión ahí mismo.
 */
function avisoSinSesion(msg, destino) {
  if (destino) $(destino).innerHTML = `<span class="nosesion">${esc(msg)}</span>`;
  banner(`${esc(msg)} <button class="primary sm" id="bLogin">Iniciar sesión</button>`, true, true);
  $('#bLogin')?.addEventListener('click', async () => { switchTab('cuenta'); await startLogin(); loadCuenta(); });
}

// Opciones numeradas al final de la respuesta: se muestran como botones.
function parseOptions(text) {
  const lines = String(text || '').split('\n');
  let end = -1, start = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*\d+[.)]\s+\S/.test(lines[i])) { if (end < 0) end = i; start = i; }
    else if (end >= 0 && lines[i].trim() === '') { if (start === i + 1 && i > 0 && /^\s*\d+[.)]\s+\S/.test(lines[i - 1])) continue; break; }
    else if (end >= 0 && /^\s{2,}\S/.test(lines[i])) continue;
    else if (end >= 0) break;
  }
  if (end < 0) return [];
  const items = [];
  for (let i = start; i <= end; i++) {
    const m = /^\s*(\d+)[.)]\s+(.*)$/.exec(lines[i]);
    if (m) items.push({ n: Number(m[1]), text: m[2].trim() });
    else if (items.length && lines[i].trim()) items[items.length - 1].text += ` ${lines[i].trim()}`;
  }
  if (items.length < 2 || items.some((it, i) => it.n !== i + 1)) return []; // 1, 2, 3...: una lista cualquiera no es un menú
  if (items.some((it) => it.text.length > 160)) return []; // párrafos numerados, no opciones
  if ((lines.slice(0, start).join('\n').match(/```/g) || []).length % 2) return []; // dentro de un bloque de código
  const cola = lines.slice(end + 1).filter((l) => l.trim());
  if (cola.length > 2 || cola.join(' ').length > 200) return []; // la lista tiene que cerrar la respuesta
  const prev = lines.slice(0, start).filter((l) => l.trim()).slice(-2).join(' ');
  if (!/(\?|¿|seguimos|elige|elegir|escoge|opciones|prefieres|quieres|cuál|cómo|qué hacemos)/i.test(prev)) return [];
  const plain = (t) => t.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
  return items.slice(0, 6).map((it) => {
    const full = plain(it.text);
    const bold = /^\*\*(.+?)\*\*/.exec(it.text);
    const lead = bold ? plain(bold[1]).replace(/[.:]$/, '') : full;
    const label = lead.length > 80 ? `${lead.slice(0, 77)}…` : lead;
    return { n: it.n, label, full };
  });
}
function renderOptions() {
  $('#opts')?.remove();
  const sm = S.curSummary;
  if (!sm || sm.status !== 'esperando') return;
  const last = [...S.events].reverse().find((e) => (e.type === 'text' && !e.sub) || e.type === 'result');
  if (!last || S.events.some((e, i) => e.type === 'question' && i > S.events.indexOf(last))) return;
  const txt = last.type === 'result' && !last.text ? [...S.events].reverse().find((e) => e.type === 'text' && !e.sub)?.text : last.text;
  const opts = parseOptions(txt);
  if (!opts.length) return;
  const box = el(`<div id="opts" class="opts"><div class="muted">Responder con una opción:</div>${opts.map((o) => `<button data-n="${o.n}">${o.n}. ${esc(o.label)}</button>`).join('')}</div>`);
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const o = opts.find((x) => x.n === Number(b.dataset.n));
    box.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    try { await api('/api/reply', { runId: S.cur, text: `Opción ${o.n}: ${o.full}` }); } catch (err) { banner(err.message, true); box.querySelectorAll('button').forEach((x) => { x.disabled = false; }); }
  });
  $('#logBody').append(box);
}
// Rutas de archivos en código se abren en el visor.
document.addEventListener('click', (e) => { const c = e.target.closest('.md code'); if (c && DOC_RE.test(c.textContent.trim())) openDoc(c.textContent.trim()); });

// ---------------------------------------------------------------- documentos
/** INDICE.md e index.html tienen el mismo contenido: se muestra solo el HTML. */
function sinDuplicados(nodes) {
  return nodes.map((n) => !n.dir ? n : { ...n, children: sinDuplicados(n.children.filter((c) => !(c.name.toLowerCase() === 'indice.md' && n.children.some((x) => x.name === 'index.html')))) });
}
async function loadTree() {
  try {
    const d = await api('/api/tree');
    const nodos = Array.isArray(d) ? d : d.nodos || [];
    S.treeRecortado = !Array.isArray(d) && !!d.recortado;
    S.tree = sinDuplicados(nodos);
  } catch { return; }
  renderTree();
}

const I = (d) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  inputs: I('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),
  evidence: I('<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5M8.5 10.5h4M10.5 8.5v4"/>'),
  'context-pack': I('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5M3 17.5 12 22l9-4.5"/>'),
  outputs: I('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>'),
  md: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  table: I('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>'),
  code: I('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12"/>'),
  json: I('<path d="M9 4C7 4 7 5 7 7s0 3-2 5c2 2 2 3 2 5s0 3 2 3M15 4c2 0 2 1 2 3s0 3 2 5c-2 2-2 3-2 5s0 3-2 3"/>'),
  html: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>'),
  pdf: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8.5 17v-4h1.7a1.2 1.2 0 0 1 0 2.4H8.5"/>'),
  image: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>'),
  audio: I('<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>'),
  file: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
};
const EXT = { md: 'md', txt: 'md', csv: 'table', tsv: 'table', xlsx: 'table', json: 'json', yml: 'json', yaml: 'json', xml: 'json', html: 'html', htm: 'html', pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', mp3: 'audio', wav: 'audio', m4a: 'audio', py: 'code', js: 'code', ts: 'code', sql: 'code', feature: 'code', sh: 'code' };
const fileIcon = (name) => ICON[EXT[(name.split('.').pop() || '').toLowerCase()] || 'file'];
const LABEL = { inputs: 'Insumos', evidence: 'Evidencia', 'context-pack': 'Paquete de contexto', outputs: 'Entregables' };
const countFiles = (n) => (n.dir ? n.children.reduce((a, c) => a + countFiles(c), 0) : 1);

// Carpetas abiertas del árbol. Vive mientras estás en Documentos; al volver a entrar se reinicia.
let TREE_OPEN = null;
function renderTree() {
  if (TREE_OPEN === null) TREE_OPEN = new Set(S.tree.filter((n) => n.name === 'outputs' || n.name === 'context-pack').map((n) => n.path));
  const box = $('#tree'); box.innerHTML = '';
  const mk = (n, _defOpen, top) => {
    const open = n.dir && TREE_OPEN.has(n.path);
    if (n.dir) {
      const root = top ? ` root r-${esc(n.name)}` : '';
      const wrap = el(`<div><div class="d${root}" tabindex="0" role="button">${top ? ICON[n.name] || ICON.folder : ICON.folder}<span class="nm" ${top ? `title="${esc(n.name)}/"` : ''}>${esc(top ? LABEL[n.name] || n.name : n.name)}</span>${top ? `<span class="cnt">${countFiles(n)}</span>` : ''}<span class="car">${open ? '▾' : '▸'}</span></div><div class="kids" ${open ? '' : 'hidden'}></div></div>`);
      const kids = $('.kids', wrap);
      n.children.forEach((c) => kids.append(mk(c, false, false)));
      if (!n.children.length) kids.append(el('<div class="muted empty">vacío</div>'));
      const toggle = () => { kids.hidden = !kids.hidden; $('.car', wrap).textContent = kids.hidden ? '▸' : '▾'; if (kids.hidden) TREE_OPEN.delete(n.path); else TREE_OPEN.add(n.path); };
      $('.d', wrap).addEventListener('click', toggle);
      $('.d', wrap).addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      return wrap;
    }
    const f = el(`<div class="f" title="${esc(n.path)}" tabindex="0" role="button">${fileIcon(n.name)}<span class="nm">${esc(n.name)}</span></div>`);
    f.addEventListener('click', () => openDoc(n.path));
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDoc(n.path); });
    return f;
  };
  S.tree.forEach((n) => box.append(mk(n, n.name === 'outputs' || n.name === 'context-pack', true)));
  if (S.treeRecortado) box.append(el('<div class="muted empty">El proyecto tiene muchos archivos: la lista está recortada. Abre las carpetas en Finder para verlo completo.</div>'));
}

function openDoc(path) {
  switchTab('docs');
  $('#frame').src = `/f/${path.split('/').map(encodeURIComponent).join('/')}`;
  $('#vpath').textContent = path;
  const a = $('#vopen'); a.hidden = false; a.href = $('#frame').src;
  $$('#tree .f').forEach((f) => f.classList.toggle('on', f.title === path));
}

async function openFolder(carpeta) {
  await loadTree();
  const find = (nodes) => { for (const n of nodes) { if (n.path === carpeta) return n; if (n.dir) { const r = find(n.children); if (r) return r; } } return null; };
  const dir = find(S.tree);
  const files = [];
  const walk = (n) => n.dir ? n.children.forEach(walk) : files.push(n);
  if (dir) walk(dir);
  const pick = files.find((f) => /\.pdf$/i.test(f.name)) || files.find((f) => /\.md$/i.test(f.name) && !f.name.startsWith('_')) || files.find((f) => /\.html?$/i.test(f.name)) || files[0];
  if (pick) openDoc(pick.path); else switchTab('docs');
}
$('#vrefresh').addEventListener('click', () => { loadTree(); const f = $('#frame'); if (f.src) f.src = f.src; });
document.addEventListener('click', (e) => { const a = e.target.closest('[data-open]'); if (a && !a.closest('#dBody')) openFolder(a.dataset.open); });

// ---------------------------------------------------------------- insumos
function renderInputs() {
  const root = S.tree.find((n) => n.name === 'inputs');
  const box = $('#inputsList');
  const files = [];
  const walk = (n) => n.dir ? n.children.forEach(walk) : files.push(n);
  if (root) walk(root);
  box.innerHTML = files.length ? files.map((f) => `<div>${esc(f.path.replace(/^inputs\//, ''))} <span class="muted">(${(f.size / 1024).toFixed(0)} KB)</span></div>`).join('') : '<div>Aún no hay archivos.</div>';
}

async function upload(files) {
  const dir = $('#upDir').value, msg = $('#upMsg');
  for (const f of files) {
    msg.textContent = `Subiendo ${f.name}…`;
    try {
      const r = await fetch(`/api/upload?dir=${encodeURIComponent(dir)}&name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'x-ds': '1' }, body: f });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      msg.textContent = `Guardado en ${j.path}`;
    } catch (e) { msg.textContent = `Error: ${e.message}`; return; }
  }
  await loadTree(); renderInputs(); reloadStateSoon();
}
$('#upFile').addEventListener('change', (e) => upload([...e.target.files]));
const drop = $('#drop');
['dragover', 'dragenter'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => upload([...e.dataTransfer.files]));
$('#impBtn').addEventListener('click', async () => {
  const from = $('#impPath').value.trim(); if (!from) return;
  try { const j = await api('/api/import', { from, dir: $('#upDir').value }); $('#upMsg').textContent = `Copiado a ${j.path}`; await loadTree(); renderInputs(); reloadStateSoon(); }
  catch (e) { $('#upMsg').textContent = `Error: ${e.message}`; }
});

async function loadSources() {
  try { const j = await api('/api/sources'); $('#sources').value = j.text; $('#sources').disabled = !j.exists; } catch { /* sin proyecto */ }
}
$('#srcSave').addEventListener('click', async () => {
  try { await api('/api/sources', { text: $('#sources').value }); $('#srcMsg').textContent = 'Guardado.'; } catch (e) { $('#srcMsg').textContent = e.message; }
});

// ---------------------------------------------------------------- eventos en vivo
function connect() {
  const es = new EventSource('/api/events');
  es.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.type === 'pulso') { if (d.runId === S.cur) { PULSO.chars = d.chars; PULSO.modo = d.modo; PULSO.ts = Date.now(); } return; }
    if (d.type === 'run_event') { avisoDeEvento(d.runId, d.ev); onRunEvent(d); }
    else if (d.type === 'runs_changed') loadRuns();
    else if (d.type === 'state_changed') { reloadStateSoon(); if ($('#tab-docs').classList.contains('on')) loadTree(); }
    else if (d.type === 'files_changed') { loadTree().then(renderInputs); }
    else if (d.type === 'auth_log') { S.authLog.push(d.line); renderBanner(); renderAcctLog(); }
    else if (d.type === 'auth_done') { S.loginBusy = false; S.auth = d.status; renderHeader(); renderBanner(); if ($('#tab-cuenta').classList.contains('on')) loadCuenta(); }
  };
  es.onerror = () => { verVersion(); }; // el navegador reintenta solo; aquí se comprueba si el servidor cambió
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) verVersion(); });
setTimeout(verVersion, 1500);

// ---------------------------------------------------------------- avisos
/**
 * La app avisa cuando necesita al usuario: una pregunta, un permiso o una etapa terminada.
 * Suena siempre (corto y discreto) y, si el permiso está dado, manda notificación del sistema
 * cuando la ventana no está a la vista. Se apaga desde Cuenta.
 */
const AVISOS = { sonido: localStorage.getItem('ds-sonido') !== '0', push: localStorage.getItem('ds-push') === '1' };
let audioCtx = null;
/**
 * El navegador suspende el audio cuando la pestaña lleva rato oculta, y mientras está suspendido
 * su reloj no avanza: programar el tono con el reloj congelado lo deja sin sonar. Por eso se espera
 * a que vuelva antes de programarlo. Es la razón de que el primer aviso sonara y el segundo no.
 */
async function pitido(agudo = false) {
  if (!AVISOS.sonido) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') await audioCtx.resume();
    if (audioCtx.state !== 'running') return;
    const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(agudo ? 880 : 620, t);
    o.frequency.setValueAtTime(agudo ? 1175 : 780, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.36);
  } catch { /* sin audio disponible: quedan la notificación y el título */ }
}
// Un clic cualquiera revive el audio: así el aviso suena aunque el navegador lo hubiera dormido.
document.addEventListener('click', () => { if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {}); }, true);
let tituloBase = document.title, parpadeo = null;
function marcarTitulo(txt) {
  clearInterval(parpadeo);
  if (!txt) { document.title = tituloBase; return; }
  let on = false;
  document.title = `${txt} · ${tituloBase}`;
  parpadeo = setInterval(() => { on = !on; document.title = on ? tituloBase : `${txt} · ${tituloBase}`; }, 1400);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) marcarTitulo(''); });
window.addEventListener('focus', () => marcarTitulo(''));

let avisoN = 0;
function avisar(titulo, cuerpo, agudo = false) {
  pitido(agudo);
  if (document.hidden) marcarTitulo(titulo);
  if (!AVISOS.push || !('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    // Cada aviso lleva su propia etiqueta y pide volver a sonar: con una etiqueta fija, el
    // navegador reemplaza la anterior en silencio y el segundo aviso pasa desapercibido.
    const n = new Notification(titulo, { body: cuerpo, tag: `ds-${++avisoN}`, renotify: true, requireInteraction: true });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* el navegador la rechazó */ }
}

/** Qué eventos merecen sacar al usuario de lo que está haciendo. */
function avisoDeEvento(runId, ev) {
  const r = S.runs.find((x) => x.id === runId), quien = r?.title || 'Una skill';
  if (ev.type === 'question') return avisar('Te están preguntando', `${quien} necesita tu respuesta para continuar.`, true);
  if (ev.type === 'permission') return avisar('Piden tu permiso', `${quien} quiere usar ${ev.tool}.`, true);
  if (ev.type === 'status' && ev.status === 'esperando') return avisar('Etapa terminada', `${quien} terminó y espera tu revisión.`);
  if (ev.type === 'status' && ev.status === 'error') return avisar('Terminó con error', `${quien} no pudo terminar.`);
}

function onRunEvent({ runId, ev }) {
  if (runId !== S.cur) return;
  S.events.push(ev);
  if (ev.type === 'alcance' && S.curSummary) S.curSummary.alcance = ev.alcance;

  if (ev.type === 'status' && ev.status === 'running' && S.curSummary) { S.curSummary.turnoDesde = ev.ts; PULSO.ts = 0; PULSO.chars = 0; }
  if (ev.type === 'status' && S.curSummary) { S.curSummary.status = ev.status; if (ev.status !== 'running') renderLog(); else updateHead(); renderRuns(); return; }
  if (ev.type === 'resolved') { renderLog(); return; }
  if (ev.type === 'result' && S.curSummary) { S.curSummary.cost = ev.cost || S.curSummary.cost; }
  if (ev.type === 'init' && S.curSummary) S.curSummary.hasSession = true;
  if (ev.type === 'result' && S.curSummary) { S.curSummary.hasResult = true; S.curSummary.ok = ev.ok; }
  $('#opts')?.remove();
  const body = $('#logBody'); const stick = nearBottom(body);
  const resolved = new Map(S.events.filter((e) => e.type === 'resolved').map((e) => [e.id, e]));
  colocar(body, ev, nodesFor(ev, resolved));
  if (stick) body.scrollTop = body.scrollHeight;
  updateHead();
}

(async function init() {
  await verVersion();
  setInterval(() => { if (document.visibilityState === 'visible') verVersion(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verVersion(); });
  await loadRoutes();
  await loadState();
  await Promise.all([loadAuth(), loadRuns()]);
  const running = S.runs.find((r) => r.status === 'running') || S.runs[0];
  if (running) { await selectRun(running.id); if (running.status === 'running') switchTab('ejecucion'); }
  connect();
})();

// ---------------------------------------------------------------- listas desplegables con el estilo de la app
let DD = null;
function ddLabel(dd) {
  const v = $('.dd-v', dd), sel = dd._sel;
  if (dd.classList.contains('multi')) {
    const on = [...dd._p.querySelectorAll('input:checked')].map((i) => i.closest('.dd-o').querySelector('.tx').textContent.trim());
    v.textContent = !on.length ? (dd.dataset.ph || 'Ninguno') : on.length <= 2 ? on.join(', ') : `${on.length} seleccionados`;
    v.classList.toggle('ph', !on.length);
  } else {
    const o = sel.options[sel.selectedIndex];
    v.textContent = o ? o.textContent : '';
    v.classList.toggle('ph', !sel.value);
  }
  dd.classList.toggle('off', !!sel?.disabled);
}
function ddPlace(dd) {
  const t = $('.dd-t', dd).getBoundingClientRect(), p = dd._p;
  p.style.top = p.style.bottom = p.style.maxHeight = ''; p.style.minWidth = `${Math.max(t.width, 180)}px`; p.style.left = `${t.left}px`;
  const h = p.scrollHeight + 2, below = innerHeight - t.bottom - 14, above = t.top - 14;
  if (h > below && above > below) { p.style.bottom = `${innerHeight - t.top + 4}px`; p.style.maxHeight = `${Math.min(h, above, 320)}px`; }
  else { p.style.top = `${t.bottom + 4}px`; p.style.maxHeight = `${Math.min(h, below, 320)}px`; }
  const pr = p.getBoundingClientRect(); if (pr.right > innerWidth - 8) p.style.left = `${Math.max(8, innerWidth - 8 - pr.width)}px`;
}
function ddOpen(dd) {
  if (dd.classList.contains('off')) return;
  ddClose();
  const p = dd._p, sel = dd._sel;
  if (sel) p.innerHTML = [...sel.options].map((o) => `<div class="dd-o ${o.value === sel.value ? 'on' : ''}" role="option" data-v="${esc(o.value)}" aria-selected="${o.value === sel.value}"><span class="tx">${esc(o.textContent)}</span></div>`).join('');
  document.body.append(p); p.hidden = false; dd.classList.add('open'); $('.dd-t', dd).setAttribute('aria-expanded', 'true');
  DD = dd; dd._i = -1; ddPlace(dd);
  p.querySelector('.dd-o.on')?.scrollIntoView({ block: 'nearest' });
}
function ddClose() {
  if (!DD) return;
  const dd = DD; DD = null;
  dd._p.hidden = true; dd.append(dd._p); dd.classList.remove('open'); $('.dd-t', dd).setAttribute('aria-expanded', 'false');
  dd._p.querySelectorAll('.hi').forEach((x) => x.classList.remove('hi'));
}
function enhanceSelect(sel) {
  if (sel.dataset.dd) return; sel.dataset.dd = '1';
  const dd = document.createElement('div'); dd.className = 'dd';
  dd.innerHTML = '<div class="dd-t" tabindex="0" role="combobox" aria-haspopup="listbox" aria-expanded="false"><span class="dd-v"></span><svg class="dd-c" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></div><div class="dd-p" role="listbox" hidden></div>';
  dd._sel = sel; dd._p = $('.dd-p', dd); dd._p._dd = dd;
  sel.after(dd); ddLabel(dd);
}
function initMulti(dd) {
  dd.dataset.init = '1'; dd._p = $('.dd-p', dd); dd._p._dd = dd;
  dd._p.addEventListener('change', () => ddLabel(dd));
  ddLabel(dd);
}
const ddScan = () => { $$('select:not([data-dd])').forEach(enhanceSelect); $$('.dd.multi:not([data-init])').forEach(initMulti); };
new MutationObserver(ddScan).observe(document.body, { childList: true, subtree: true });
document.addEventListener('mousedown', (e) => { if (DD && !DD.contains(e.target) && !DD._p.contains(e.target)) ddClose(); });
document.addEventListener('click', (e) => {
  const t = e.target.closest('.dd-t');
  if (t) { const dd = t.parentElement; return DD === dd ? ddClose() : ddOpen(dd); }
  const p = e.target.closest('.dd-p'); if (!p) return;
  const dd = p._dd;
  if (e.target.closest('[data-all]')) { p.querySelectorAll('input').forEach((i) => { i.checked = true; }); return ddLabel(dd); }
  if (e.target.closest('[data-none]')) { p.querySelectorAll('input').forEach((i) => { i.checked = false; }); return ddLabel(dd); }
  const o = e.target.closest('.dd-o[data-v]');
  if (o && dd._sel) { dd._sel.value = o.dataset.v; dd._sel.dispatchEvent(new Event('change', { bubbles: true })); ddLabel(dd); ddClose(); $('.dd-t', dd).focus(); }
});
document.addEventListener('keydown', (e) => {
  const tr = e.target.closest?.('.dd-t'); const dd = tr ? tr.parentElement : DD; if (!dd) return;
  if (e.key === 'Escape' && DD) { e.stopPropagation(); e.preventDefault(); const d = DD; ddClose(); $('.dd-t', d).focus(); return; }
  if (!tr) return;
  const open = DD === dd;
  if (!open && ['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); return ddOpen(dd); }
  if (!open) return;
  const items = [...dd._p.querySelectorAll('.dd-o')];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); dd._i = Math.max(0, Math.min(items.length - 1, (dd._i < 0 ? items.findIndex((x) => x.classList.contains('on')) : dd._i) + (e.key === 'ArrowDown' ? 1 : -1)));
    items.forEach((x, n) => x.classList.toggle('hi', n === dd._i)); items[dd._i]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault(); const it = items[dd._i];
    if (dd.classList.contains('multi')) { if (e.key === ' ' && it) { const c = it.querySelector('input'); c.checked = !c.checked; ddLabel(dd); } else ddClose(); }
    else if (it) it.click(); else ddClose();
  } else if (e.key === 'Tab') ddClose();
}, true);
addEventListener('scroll', (e) => { if (DD && !DD._p.contains(e.target)) ddClose(); }, true);
addEventListener('resize', ddClose);
ddScan();

// ---------------------------------------------------------------- cuenta y consumo
const nf = new Intl.NumberFormat('es-CO');
const usd = (x) => `US$ ${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PLAN = { free: 'Gratis', pro: 'Pro', max: 'Max', max_5x: 'Max 5x', max_20x: 'Max 20x', team: 'Team', enterprise: 'Enterprise' };
const totTok = (t) => t.input + t.output + t.cacheRead + t.cacheWrite;
const linkify = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
function renderAcctLog() {
  const box = $('#acctLog'); if (!box) return;
  box.innerHTML = S.loginBusy && S.authLog.length ? S.authLog.slice(-6).map((l) => `<div>${linkify(l)}</div>`).join('') : '';
}
async function loadCuenta() {
  const box = $('#cuenta');
  box.innerHTML = '<p class="muted">Cargando la cuenta…</p>';
  try {
    S.cuenta = await api('/api/account');
    pintarCuenta(box);
  } catch (e) {
    box.innerHTML = `<div class="acard"><h3>No pude mostrar la cuenta</h3><p class="muted">${esc(e.message || String(e))}</p><div class="row"><button class="ghost" id="acctRetry">Reintentar</button></div></div>`;
    $('#acctRetry')?.addEventListener('click', loadCuenta);
  }
}
/** Cuándo caduca la sesión, en palabras, y si conviene avisar. */
function caducidad(iso) {
  if (!iso) return null;
  const t = Date.parse(iso); if (!Number.isFinite(t)) return null;
  const dias = Math.round((t - Date.now()) / 86400000);
  const fecha = new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  if (dias < 0) return { txt: `caducó el ${fecha}`, avisa: true };
  if (dias === 0) return { txt: `hoy (${fecha})`, avisa: true };
  return { txt: `${fecha} · en ${dias} ${dias === 1 ? 'día' : 'días'}`, avisa: dias <= 7 };
}
function pintarCuenta(box) {
  const a = S.cuenta, u = a.uso, inf = a.info || {};
  const cad = caducidad(inf.expira);
  const plan = inf.plan ? (PLAN[String(inf.plan).toLowerCase()] || inf.plan) : null;
  const metodo = a.mode === 'apikey' ? 'API key' : a.loggedIn && inf.metodo && inf.metodo !== 'none' ? `Suscripción (${inf.metodo})` : 'Suscripción';
  const fila = (k, v) => (v ? `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>` : '');
  const tabla = (titulo, rows, col) => rows.length ? `<h4>${esc(titulo)}</h4><table class="ut"><thead><tr><th>${esc(col)}</th><th>Ejecuciones</th><th>Tokens</th><th>Equivalente API</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.nombre)}</td><td>${nf.format(r.runs)}</td><td>${totTok(r) ? nf.format(totTok(r)) : '<span class="muted">sin dato</span>'}</td><td>≈ ${usd(r.cost)}</td></tr>`).join('')}</tbody></table>` : '';
  const ICOC = {
    conexion: '<svg viewBox="0 0 24 24"><path d="M9 17a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-1 1"/><path d="M15 7a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l1-1"/></svg>',
    consumo: '<svg viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-6M22 19H2"/></svg>',
    avisos: '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  };
  // Reparto del consumo por modelo, con la misma barra apilada del Resumen.
  const totCost = u.porModelo.reduce((x, m) => x + m.cost, 0);
  const barraU = totCost > 0 ? `<div class="stack mod">${u.porModelo.map((m, i) => `<i class="m${i % 4}" style="width:${(m.cost / totCost) * 100}%" title="${esc(m.nombre)}: ≈ ${usd(m.cost)}"></i>`).join('')}</div>
    <div class="leg">${u.porModelo.map((m, i) => `<span><i class="m${i % 4}"></i>${esc(m.nombre)} ${Math.round((m.cost / totCost) * 100)}%</span>`).join('')}</div>` : '';
  box.innerHTML = `<div class="acct">
    <section class="acard conexion">
      <div class="ah"><h3><span class="ic azul">${ICOC.conexion}</span>Conexión</h3><span class="chip ${a.loggedIn ? 'ok' : 'bad'}">${a.loggedIn ? 'Conectada' : 'Sin sesión'}</span></div>
      <dl class="kv2">
        ${fila('IA', `${a.ia} · ${a.via}`)}
        ${fila('Cuenta', inf.email || (a.loggedIn ? a.detail : ''))}
        ${fila('Plan', plan)}
        ${fila('Organización', inf.org)}
        ${fila('Acceso', metodo)}
        ${fila('Modelo predeterminado', a.modelo)}
        ${cad ? `<dt>La sesión caduca</dt><dd class="${cad.avisa ? 'warn' : ''}">${esc(cad.txt)}</dd>` : ''}
        ${a.loggedIn ? '' : fila('Estado', a.detail)}
      </dl>
      <div class="row"><button class="primary" id="acctReconnect" ${a.mode !== 'subscription' || S.loginBusy ? 'disabled' : ''}>${S.loginBusy ? 'Conectando…' : 'Reconectar con Claude'}</button><button class="ghost" id="acctRefresh">Actualizar</button></div>
      ${a.mode !== 'subscription' ? '<p class="muted sm">En modo API key no hay sesión que reconectar: revisa la variable ANTHROPIC_API_KEY y reinicia el servidor.</p>' : '<p class="muted sm">Abre el enlace que aparezca abajo para iniciar sesión de nuevo con tu cuenta de Claude.</p>'}
      <div class="acctlog" id="acctLog"></div>
    </section>
    <section class="acard avisos">
      <div class="ah"><h3><span class="ic morado">${ICOC.avisos}</span>Avisos</h3></div>
      <p class="muted sm">Cuando una skill te pregunta algo, pide un permiso o termina una etapa, la app te avisa aunque estés en otra ventana.</p>
      <label class="check"><input type="checkbox" id="avSonido" ${AVISOS.sonido ? 'checked' : ''}><span>Sonido</span></label>
      <label class="check"><input type="checkbox" id="avPush" ${AVISOS.push ? 'checked' : ''}><span>Notificación del sistema${'Notification' in window ? '' : ' (este navegador no las admite)'}</span></label>
      <p class="muted sm" id="avMsg"></p>
    </section>
    <section class="acard consumo">
      <div class="ah"><h3><span class="ic verde">${ICOC.consumo}</span>Consumo</h3></div>
      <div class="big">
        <div><div class="l">Tokens totales</div><div class="v">${nf.format(totTok(u.total))}</div></div>
        <div><div class="l">Equivalente API</div><div class="v">≈ ${usd(u.total.cost)}</div><div class="s">referencia, no se cobra</div></div>
        <div><div class="l">Este mes</div><div class="v sm">≈ ${usd(u.mes.cost)}</div><div class="s">${nf.format(totTok(u.mes))} tokens · ${nf.format(u.mes.runs)} ${u.mes.runs === 1 ? 'ejecución' : 'ejecuciones'}</div></div>
      </div>
      ${barraU}
      <p class="muted sm">Entrada ${nf.format(u.total.input)} · Salida ${nf.format(u.total.output)} · Caché leída ${nf.format(u.total.cacheRead)} · Caché escrita ${nf.format(u.total.cacheWrite)}</p>
      ${tabla('Por modelo', u.porModelo, 'Modelo')}
      <p class="muted sm">«Equivalente API» es lo que costaría a precio de API, igual que el valor que ves en cada ejecución (referencia, no se cobra): con suscripción no se cobra por token. Es solo el consumo de ${esc(u.proyecto || 'este proyecto')}: el registro vive en su carpeta y no mezcla otros proyectos.${u.sinTokens ? ` ${nf.format(u.sinTokens)} ${u.sinTokens === 1 ? 'ejecución anterior al registro de tokens solo tiene' : 'ejecuciones anteriores al registro de tokens solo tienen'} costo, sin tokens.` : ''}</p>
    </section>
  </div>`;
  $('#avSonido')?.addEventListener('change', (e) => { AVISOS.sonido = e.target.checked; localStorage.setItem('ds-sonido', e.target.checked ? '1' : '0'); if (e.target.checked) pitido(); });
  $('#avPush')?.addEventListener('change', async (e) => {
    const msg = $('#avMsg');
    if (!e.target.checked) { AVISOS.push = false; localStorage.setItem('ds-push', '0'); msg.textContent = ''; return; }
    if (!('Notification' in window)) { e.target.checked = false; msg.textContent = 'Este navegador no admite notificaciones del sistema.'; return; }
    const r = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (r !== 'granted') { e.target.checked = false; AVISOS.push = false; localStorage.setItem('ds-push', '0'); msg.textContent = 'El navegador no dio permiso. Actívalo en los ajustes del sitio.'; return; }
    AVISOS.push = true; localStorage.setItem('ds-push', '1'); msg.textContent = 'Listo: te avisará cuando la ventana no esté a la vista.';
  });
  $('#acctReconnect')?.addEventListener('click', async () => { await startLogin(); loadCuenta(); });
  $('#acctRefresh').addEventListener('click', async () => { await loadAuth(); loadCuenta(); });
  renderAcctLog();
}
