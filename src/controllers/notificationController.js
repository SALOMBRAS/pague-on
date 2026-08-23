const prisma = require('../config/database');
const { idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const HttpError = require('../utils/httpError');

async function list(req, res) {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id, ...(req.query.unreadOnly === 'true' ? { read: false } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return sendSuccess(res, serialize(notifications));
}

async function markRead(req, res) {
  const id = idSchema.parse(req.params).id;
  const notification = await prisma.notification.findFirst({ where: { id, userId: req.user.id } });
  if (!notification) throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Notificação não encontrada.');
  const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
  return sendSuccess(res, serialize(updated), 'Notificação marcada como lida.');
}

async function markAllRead(req, res) {
  const result = await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  return sendSuccess(res, { count: result.count }, 'Notificações marcadas como lidas.');
}

async function remove(req, res) {
  const id = idSchema.parse(req.params).id;
  const result = await prisma.notification.deleteMany({ where: { id, userId: req.user.id } });
  if (!result.count) throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Notificação não encontrada.');
  return sendSuccess(res, { id }, 'Notificação excluída com sucesso.');
}

module.exports = { list, markRead, markAllRead, remove };
