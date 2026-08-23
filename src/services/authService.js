const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { signToken } = require('../utils/jwt');
const { publicUser } = require('../utils/serializers');

const refreshLifetimeMs = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30) * 24 * 60 * 60 * 1000;
const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function issueSession(user) {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({ data: {
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshLifetimeMs),
  } });
  return { token: signToken(user.id), refreshToken, user: publicUser(user) };
}

async function register(input) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, 'EMAIL_IN_USE', 'Este e-mail já está em uso.');
  const password = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({ data: { ...input, password } });
  return issueSession(user);
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }
  return issueSession(user);
}

async function refresh(refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
    throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Sua sessão expirou. Entre novamente.');
  }
  const revoked = await prisma.refreshToken.updateMany({ where: { id: stored.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (revoked.count !== 1) throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Sua sessão expirou. Entre novamente.');
  return issueSession(stored.user);
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

async function changePassword(user, oldPassword, newPassword) {
  if (!(await bcrypt.compare(oldPassword, user.password))) {
    throw new HttpError(400, 'INVALID_PASSWORD', 'A senha atual está incorreta.');
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(newPassword, 12) } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

module.exports = { register, login, refresh, logout, changePassword };
