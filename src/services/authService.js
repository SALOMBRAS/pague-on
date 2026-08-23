const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { signToken } = require('../utils/jwt');
const { publicUser } = require('../utils/serializers');

const refreshLifetimeMs = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30) * 24 * 60 * 60 * 1000;
const resetLifetimeMs = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30) * 60 * 1000;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
};

async function findByIdentity(identity) {
  const phone = normalizePhone(identity);
  return prisma.user.findFirst({ where: { OR: [{ email: identity }, ...(phone ? [{ phoneNormalized: phone }, { phone: identity }] : [])] } });
}

async function issueSession(user) {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + refreshLifetimeMs) } });
  return { token: signToken(user.id, user.sessionVersion), refreshToken, user: publicUser(user) };
}

async function register(input) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, 'EMAIL_IN_USE', 'Este e-mail já está em uso.');
  const phoneNormalized = normalizePhone(input.phone);
  if (phoneNormalized && await prisma.user.findUnique({ where: { phoneNormalized } })) throw new HttpError(409, 'PHONE_IN_USE', 'Este telefone já está em uso.');
  const user = await prisma.user.create({ data: { ...input, phoneNormalized, password: await bcrypt.hash(input.password, 12) } });
  return issueSession(user);
}

async function login({ identity, password }) {
  const user = await findByIdentity(identity);
  if (!user || !(await bcrypt.compare(password, user.password))) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Usuário, e-mail ou telefone e senha inválidos.');
  return issueSession(user);
}

async function refresh(refreshToken) {
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) }, include: { user: true } });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Sua sessão expirou. Entre novamente.');
  const revoked = await prisma.refreshToken.updateMany({ where: { id: stored.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (revoked.count !== 1) throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Sua sessão expirou. Entre novamente.');
  return issueSession(stored.user);
}

async function logout(userId) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

async function changePassword(user, oldPassword, newPassword) {
  if (!(await bcrypt.compare(oldPassword, user.password))) throw new HttpError(400, 'INVALID_PASSWORD', 'A senha atual está incorreta.');
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(newPassword, 12), sessionVersion: { increment: 1 } } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

async function deliverPasswordReset(user, token) {
  const endpoint = process.env.PASSWORD_RESET_DELIVERY_WEBHOOK_URL;
  const baseUrl = process.env.PASSWORD_RESET_BASE_URL;
  if (!endpoint || !baseUrl) return;
  const resetUrl = `${baseUrl.replace(/\/$/, '')}/index.html?reset=${encodeURIComponent(token)}`;
  try { await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'password_reset', to: user.email, name: user.name, resetUrl }) }); } catch (_error) { console.warn(JSON.stringify({ event: 'password_reset_delivery_failed', userId: user.id })); }
}

async function requestPasswordReset(identity) {
  const user = await findByIdentity(identity);
  if (!user) return { accepted: true };
  const token = crypto.randomBytes(48).toString('base64url');
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, OR: [{ usedAt: { not: null } }, { expiresAt: { lte: new Date() } }] } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + resetLifetimeMs) } }),
  ]);
  await deliverPasswordReset(user, token);
  return { accepted: true };
}

async function resetPassword(token, newPassword) {
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw new HttpError(400, 'INVALID_RESET_TOKEN', 'O link de recuperação é inválido ou expirou.');
  const used = await prisma.passwordResetToken.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count !== 1) throw new HttpError(400, 'INVALID_RESET_TOKEN', 'O link de recuperação já foi utilizado.');
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { password: await bcrypt.hash(newPassword, 12), sessionVersion: { increment: 1 } } }),
    prisma.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

module.exports = { register, login, refresh, logout, changePassword, requestPasswordReset, resetPassword, normalizePhone };
