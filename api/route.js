module.exports = async function handler(req, res) {
  const { handleRoute } = require('./_lib/backend.cjs');
  return handleRoute(req, res);
};
