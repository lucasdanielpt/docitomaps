import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { env, hasOrsKey } from './config.js';
import { geocodeRoutes } from './routes/geocode.js';
import { routeRoutes } from './routes/route.js';
import { optimizeRoutes } from './routes/optimize.js';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
    },
    bodyLimit: 1 * 1024 * 1024,
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
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
        '⚠️  ORS_API_KEY não configurada. Endpoints /api/geocode, /api/route e /api/optimize retornarão 503 até a chave ser adicionada em apps/api/.env',
      );
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
