const multer = require('multer');
const { ZodError } = require('zod');
const { sendError } = require('../utils/responseHelper');

function notFoundHandler(_req, _res, next) {
  const error = new Error('Rota não encontrada.');
  error.status = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return sendError(res, 'Dados inválidos.', 'VALIDATION_ERROR', 400);
  }
  if (error instanceof multer.MulterError) {
    return sendError(res, error.message, 'UPLOAD_ERROR', 400);
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 'A imagem pode ter no máximo 5 MB.', 'UPLOAD_TOO_LARGE', 400);
  }
  if (error.code === 'P2002') return sendError(res, 'Este registro já existe.', 'DUPLICATE_RECORD', 409);
  if (error.code === 'P2025') return sendError(res, 'Registro não encontrado.', 'NOT_FOUND', 404);

  const status = error.status || 500;
  const code = error.code || 'INTERNAL_ERROR';
  if (status >= 500) console.error(error);
  return sendError(res, error.message || 'Ocorreu um erro inesperado.', code, status);
}

module.exports = { notFoundHandler, errorHandler };
