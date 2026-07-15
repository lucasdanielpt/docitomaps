import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Copia apps/web/dist → dist na raiz (Vercel procura dist no Root Directory). */
if (!process.env.VERCEL) {
  process.exit(0);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webDist = resolve(repoRoot, 'apps/web/dist');
const rootDist = resolve(repoRoot, 'dist');

if (!existsSync(webDist)) {
  console.error('[vercel-sync-dist] apps/web/dist não encontrado.');
  process.exit(1);
}

rmSync(rootDist, { recursive: true, force: true });
cpSync(webDist, rootDist, { recursive: true });
console.log('[vercel-sync-dist] apps/web/dist → dist');
