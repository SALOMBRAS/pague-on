const HttpError = require('../utils/httpError');

function apiAccessPolicy(req, _res, next) {
  const actor = req.actor;
  if (!actor || ['ADMIN', 'MANAGER'].includes(actor.role)) return next();
  const path = req.path;
  const isRead = req.method === 'GET';
  const collectorRead = isRead && (path === '/access/me' || path.startsWith('/people') || path.startsWith('/installments') || path.startsWith('/collectors/me'));
  const collectorWrite = req.method === 'POST' && path.startsWith('/collectors/me/');
  const clientRead = isRead && (path === '/access/me' || path.startsWith('/people') || path === '/installments/mine');
  if ((actor.role === 'COLLECTOR' && (collectorRead || collectorWrite)) || (actor.role === 'CLIENT' && clientRead)) return next();
  return next(new HttpError(403, 'FORBIDDEN', 'Seu perfil não possui permissão para esta operação.'));
}

module.exports = apiAccessPolicy;
