import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Local: apps/web/scripts → repo root = ../../.. */
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const entry = path.join(repoRoot, 'apps/api/src/vercel.ts');
const sharedAlias = path.join(repoRoot, 'packages/shared/src/index.ts');

const outputs = [
  { outfile: path.join(repoRoot, 'api/handler.cjs'), format: 'cjs' },
  { outfile: path.join(repoRoot, 'apps/web/api/handler.cjs'), format: 'cjs' },
];

for (const { outfile, format } of outputs) {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format,
    outfile,
    alias: {
      '@docitomapas/shared': sharedAlias,
    },
    logLevel: 'info',
  });
  console.log(`[bundle-vercel-api] ${path.relative(repoRoot, outfile)}`);
}
