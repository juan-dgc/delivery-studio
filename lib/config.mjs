import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const STUDIO_DIR = path.resolve(here, '..');

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function expand(p) {
  return p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

export function parseArgs(argv) {
  const out = { flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    if (['no-open', 'api-key'].includes(k)) out.flags.add(k);
    else out[k] = argv[++i];
  }
  return out;
}

/** Configuración: config.json + config.local.json (opcional, no se comparte) + argumentos. */
export function loadConfig(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const cfg = {
    ...readJson(path.join(STUDIO_DIR, 'config.json'), {}),
    ...readJson(path.join(STUDIO_DIR, 'config.local.json'), {}),
  };
  cfg.port = Number(args.port || process.env.PORT || cfg.port || 3737);
  cfg.project = path.resolve(expand(args.project) || process.cwd());
  if (cfg.project === STUDIO_DIR) { console.error('Falta la carpeta del cliente. Usa: npm start (te deja elegirla) o --project <carpeta>.'); process.exit(1); }
  cfg.pluginPath = path.resolve(STUDIO_DIR, expand(args.plugin) || expand(cfg.pluginPath) || './plugin/delivery');
  if (args.flags.has('api-key')) cfg.authMode = 'apikey';
  cfg.authMode = cfg.authMode === 'apikey' ? 'apikey' : 'subscription';
  cfg.open = !args.flags.has('no-open');
  const plugin = readJson(path.join(cfg.pluginPath, '.claude-plugin', 'plugin.json'), null);
  cfg.pluginOk = !!plugin;
  cfg.pluginName = plugin?.name || 'delivery';
  cfg.catalog = readJson(path.join(STUDIO_DIR, 'catalog.json'), { skills: [], playlists: [] });
  // La explicación de cada skill vive en su SKILL.md; aquí solo se lee, no se duplica en el catálogo.
  for (const s of cfg.catalog.skills) {
    try {
      const md = fs.readFileSync(path.join(cfg.pluginPath, 'skills', s.skill, 'SKILL.md'), 'utf8');
      const fm = md.startsWith('---') ? md.slice(3, md.indexOf('\n---', 3)) : '';
      const linea = fm.split('\n').find((l) => l.startsWith('description:'));
      if (!linea) continue;
      let d = linea.slice('description:'.length).trim();
      if (d.startsWith('"') ) d = d.slice(1, d.endsWith('"') ? -1 : undefined);
      d = d.replace(/\\"/g, '"').trim();
      if (d) s.descripcion = d;
    } catch { /* sin SKILL.md: el catálogo basta */ }
  }
  return cfg;
}
