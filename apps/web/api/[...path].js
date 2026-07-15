/** Catch-all Vercel → Fastify (CommonJS para incluir handler.cjs no deploy). */
module.exports = async function handler(req, res) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { handleVercelRequest } = require('./handler.cjs');
  return handleVercelRequest(req, res);
};
