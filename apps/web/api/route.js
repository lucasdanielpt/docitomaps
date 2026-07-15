module.exports = async function handler(req, res) {
  req.url = '/api/route';
  const { handleVercelRequest } = require('./handler.cjs');
  return handleVercelRequest(req, res);
};
