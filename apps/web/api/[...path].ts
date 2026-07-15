import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildServer } from '../../api/src/server.js';

declare global {
  // eslint-disable-next-line no-var
  var __docitoFastify: Awaited<ReturnType<typeof buildServer>> | undefined;
}

/**
 * Encaminha /api/* para o Fastify (mesmas rotas do dev local).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!global.__docitoFastify) {
    global.__docitoFastify = await buildServer();
    await global.__docitoFastify.ready();
  }
  global.__docitoFastify.server.emit('request', req, res);
}
