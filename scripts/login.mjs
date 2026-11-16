import { spawn } from 'node:child_process';
import { loadConfig } from '../lib/config.mjs';
import { claudeBin, sdkEnv } from '../lib/auth.mjs';

const cfg = loadConfig();
const args = process.argv.includes('--console') ? ['auth', 'login', '--console'] : ['auth', 'login', '--claudeai'];
console.log('Se abrirá el navegador para iniciar sesión con tu cuenta de Claude (suscripción).');
spawn(claudeBin(), args, { stdio: 'inherit', env: sdkEnv({ ...cfg, authMode: 'subscription' }, cfg.project) }).on('close', (c) => process.exit(c ?? 0));
