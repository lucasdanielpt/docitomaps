import { setDefaultResultOrder } from 'node:dns';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { env, getCorsOrigins, hasOrsKey } from './config.js';
import { geocodeRoutes } from './routes/geocode.js';
import { routeRoutes } from './routes/route.js';
import { optimizeRoutes } from './routes/optimize.js';

// Node 18+ tenta IPv6 primeiro por padrão. Em macOS/redes NAT64, isso resulta em
// timeouts ao chamar api.openrouteservice.org via IPv4-mapped IPv6. Forçamos
// resolução IPv4-primeiro para evitar o problema em dev.
setDefaultResultOrder('ipv4first');

const isVercel = Boolean(process.env.VERCEL);

export async function buildServer() {
  const app = Fastify({
    logger: isVercel
      ? { level: env.LOG_LEVEL }
      : {
          level: env.LOG_LEVEL,
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss' },
          },
        },
    bodyLimit: 1 * 1024 * 1024,
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: getCorsOrigins(),
    credentials: false,
  });
  await app.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
  });

  app.get('/api/health', async () => ({
    ok: true,
    orsKeyConfigured: hasOrsKey,
    version: '1.0.0',
  }));

  await app.register(geocodeRoutes);
  await app.register(routeRoutes);
  await app.register(optimizeRoutes);

  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    if (!hasOrsKey) {
      app.log.warn(
        '⚠️  ORS_API_KEY não configurada. Endpoints /api/geocode, /api/route e /api/optimize retornarão 503 até a chave ser adicionada.',
      );
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isDirectRun) {
  void start();
}
