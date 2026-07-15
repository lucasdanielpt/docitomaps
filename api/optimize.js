module.exports = async function handler(req, res) {
  const { handleOptimize } = require('./_lib/backend.cjs');
  return handleOptimize(req, res);
};
