const service = require('../services/syncService');
const { sendSuccess } = require('../utils/responseHelper');

async function push(req, res) {
  const result = await service.push(req.user.id, req.body?.changes || []);
  return sendSuccess(res, result, 'Sincronização concluída.');
}

async function pull(req, res) {
  const result = await service.pull(req.user.id, req.query.since);
  return sendSuccess(res, result);
}

module.exports = { push, pull };
