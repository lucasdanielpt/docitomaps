import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildServer } from './server.js';

declare global {
  // eslint-disable-next-line no-var
  var __docitoFastify: Awaited<ReturnType<typeof buildServer>> | undefined;
}

/**
 * Adaptador Vercel → Fastify via inject (emit('request') falha em serverless).
 */
export async function handleVercelRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (!global.__docitoFastify) {
    global.__docitoFastify = await buildServer();
    await global.__docitoFastify.ready();
  }

  const app = global.__docitoFastify;
  const url = req.url ?? '/';
  const method = (req.method ?? 'GET').toUpperCase();
  const headers = { ...req.headers } as Record<string, string>;

  let payload: string | undefined;
  if (method !== 'GET' && method !== 'HEAD' && req.body != null) {
    payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    headers['content-type'] ??= 'application/json';
  }

  const response = await app.inject({
    method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS',
    url,
    headers,
    payload,
  });

  res.statusCode = response.statusCode;
  for (const [key, value] of Object.entries(response.headers)) {
    if (value === undefined) continue;
    res.setHeader(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  res.end(response.payload);
}
