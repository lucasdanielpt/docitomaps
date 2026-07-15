import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const MIME: Record<string, string> = {
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
};

/**
 * Em dev, vite-plugin-static-copy só copia no build — workers do Cesium
 * acabam recebendo index.html (SPA fallback) → "Unexpected token '<'".
 */
export function serveCesiumDev(baseUrlPath: string, cesiumBuildDir: string): Plugin {
  const normalizedBase = baseUrlPath.replace(/\/$/, '');

  return {
    name: 'docito-serve-cesium-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith(`${normalizedBase}/`)) {
          next();
          return;
        }

        const relative = url.slice(normalizedBase.length + 1);
        const filePath = path.join(cesiumBuildDir, relative);
        const resolvedBase = path.resolve(cesiumBuildDir);
        const resolvedFile = path.resolve(filePath);

        if (!resolvedFile.startsWith(resolvedBase)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        fs.readFile(resolvedFile, (err, data) => {
          if (err) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }
          const ext = path.extname(resolvedFile).toLowerCase();
          res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
          res.end(data);
        });
      });
    },
  };
}

export function resolveCesiumBuildDir(configDir: string): string {
  return path.resolve(configDir, 'node_modules/cesium/Build/Cesium');
}

export function cesiumConfigDirFromMeta(metaUrl: string): string {
  return path.dirname(fileURLToPath(metaUrl));
}
