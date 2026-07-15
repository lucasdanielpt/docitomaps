import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Copia apps/web/dist → dist na raiz do monorepo (deploy Vercel com Root Directory vazio). */
if (!process.env.VERCEL) {
  process.exit(0);
}

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webDist = resolve(webDir, 'dist');
const repoRoot = resolve(webDir, '../..');
const rootPkg = resolve(repoRoot, 'package.json');

let isMonorepoRoot = false;
try {
  const pkg = JSON.parse(readFileSync(rootPkg, 'utf8'));
  isMonorepoRoot = pkg.name === 'docitomapas';
} catch {
  isMonorepoRoot = false;
}

if (!isMonorepoRoot) {
  console.log('[vercel-sync-dist] Root Directory = apps/web, dist já está correto.');
  process.exit(0);
}

if (!existsSync(webDist)) {
  console.error('[vercel-sync-dist] apps/web/dist não encontrado.');
  process.exit(1);
}

const rootDist = resolve(repoRoot, 'dist');
rmSync(rootDist, { recursive: true, force: true });
cpSync(webDist, rootDist, { recursive: true });
console.log('[vercel-sync-dist] apps/web/dist → dist');
