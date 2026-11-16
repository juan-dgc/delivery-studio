// Identidad del servidor: sirve para que el arranque sepa si el puerto lo ocupa este mismo programa,
// si su código cambió y si trabaja con el mismo proyecto.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { STUDIO_DIR } from './config.mjs';

export const TOKEN_FILE = path.join(STUDIO_DIR, '.delivery-token');

/** Huella del código que se carga al arrancar (server.mjs y lib/). La interfaz no cuenta: se sirve sin caché. */
export function codeHash() {
  const h = crypto.createHash('sha1');
  const files = ['server.mjs', ...fs.readdirSync(path.join(STUDIO_DIR, 'lib')).filter((f) => f.endsWith('.mjs')).sort().map((f) => `lib/${f}`)];
  for (const f of files) { h.update(f); try { h.update(fs.readFileSync(path.join(STUDIO_DIR, f))); } catch { /* archivo ausente */ } }
  return h.digest('hex').slice(0, 12);
}

/** Huella de la ruta del proyecto (no expone la ruta). */
export const projKey = (root) => crypto.createHash('sha1').update(path.resolve(root)).digest('hex').slice(0, 12);
