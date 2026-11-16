import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { authStatus, claudeBin } from '../lib/auth.mjs';
import { findPython } from '../lib/py.mjs';

const cfg = loadConfig();
const ok = (b) => (b ? 'OK     ' : 'FALTA  ');
const major = Number(process.versions.node.split('.')[0]);
console.log(`${ok(major >= 18)} Node ${process.versions.node} (se necesita 18.14 o superior)`);
const py = await findPython();
console.log(`${ok(!!py)} Python 3 ${py ? `(${py.join(' ')})` : '(necesario para los scripts del pipeline)'}`);
console.log(`${ok(cfg.pluginOk)} Plugin ${cfg.pluginPath}`);
const bin = claudeBin();
console.log(`${ok(bin !== 'claude' && fs.existsSync(bin))} Binario de Claude Code del SDK ${bin}`);
const a = await authStatus(cfg, cfg.project);
console.log(`${ok(a.loggedIn)} Acceso (${a.mode}): ${a.detail}${a.error ? ' | ' + a.error : ''}`);
console.log(`${ok(fs.existsSync(path.join(cfg.project, '.pipeline', 'pipeline.json')))} Proyecto inicializado en ${cfg.project} (si falta, usa "Inicializar proyecto" en la interfaz)`);
