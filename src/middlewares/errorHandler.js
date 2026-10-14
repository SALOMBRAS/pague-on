const multer = require('multer');
const { ZodError } = require('zod');
const { sendError } = require('../utils/responseHelper');
const audit = require('../services/auditService');

function notFoundHandler(_req, _res, next) {
  const error = new Error('Rota não encontrada.');
  error.status = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

function validationMessage(issue) {
  if (issue.code === 'custom') return issue.message;
  if (issue.code === 'invalid_string' && issue.validation === 'email') return 'Informe um e-mail válido.';
  if (issue.code === 'invalid_type' || issue.code === 'too_small' || issue.code === 'too_big') return 'Informe um valor válido para este campo.';
  return 'Revise este campo.';
}

async function errorHandler(error, req, res, _next) {
  if (error instanceof ZodError) {
    const fields = error.issues.slice(0, 10).map((issue) => ({ path: issue.path.map(String).join('.') || 'form', message: validationMessage(issue) }));
    await audit.record({ eventType: 'validation_failed', req, actor: req.actor, workspaceOwnerId: req.user?.id, targetType: 'request', payload: { method: req.method, route: req.path, fields: fields.map((field) => field.path) } });
    return sendError(res, 'Revise os campos informados.', 'VALIDATION_ERROR', 400, { fields });
  }
  if (error instanceof multer.MulterError) {
    return sendError(res, error.message, 'UPLOAD_ERROR', 400);
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 'A imagem pode ter no máximo 5 MB.', 'UPLOAD_TOO_LARGE', 400);
  }
  if (error.code === 'P1000' || error.code === 'P1001' || error.code === 'P1017' || /ECIRCUITBREAKER|authentication failures/i.test(error.message || '')) {
    return sendError(res, 'Não foi possível conectar ao banco de dados agora. Verifique a conexão configurada e tente novamente.', 'DATABASE_UNAVAILABLE', 503);
  }
  if (error.code === 'P2002') return sendError(res, 'Este registro já existe.', 'DUPLICATE_RECORD', 409);
  if (error.code === 'P2025') return sendError(res, 'Registro não encontrado.', 'NOT_FOUND', 404);

  const status = error.status || 500;
  const code = error.code || 'INTERNAL_ERROR';
  if (status >= 500) console.error(error);
  // 5xx não mapeado: devolve mensagem genérica (não vaza detalhe de schema/banco).
  // HttpError/4xx têm `status < 500` e message própria — essas mantêm a mensagem.
  if (status >= 500) return sendError(res, 'Ocorreu um erro inesperado. Tente novamente.', code, status);
  return sendError(res, error.message || 'Ocorreu um erro inesperado.', code, status);
}

module.exports = { notFoundHandler, errorHandler };
