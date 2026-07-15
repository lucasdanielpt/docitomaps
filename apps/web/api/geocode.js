module.exports = async function handler(req, res) {
  const { handleGeocode } = require('./_lib/backend.cjs');
  return handleGeocode(req, res);
};
