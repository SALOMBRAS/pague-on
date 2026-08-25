const prisma = require('../config/database');
const { verifyToken } = require('../utils/jwt');
const HttpError = require('../utils/httpError');

async function authMiddleware(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new HttpError(401, 'AUTH_REQUIRED', 'Token de autenticação não informado.');
    }

    const payload = verifyToken(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new HttpError(401, 'INVALID_TOKEN', 'Sessão inválida ou expirada.');
    if (payload.sv !== user.sessionVersion) throw new HttpError(401, 'INVALID_TOKEN', 'Esta sessão foi encerrada. Entre novamente.');
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new HttpError(401, 'INVALID_TOKEN', 'Sessão inválida ou expirada.'));
      return;
    }
    next(error);
  }
}

module.exports = authMiddleware;
