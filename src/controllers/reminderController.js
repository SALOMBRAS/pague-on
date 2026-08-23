const prisma = require('../config/database');
const { reminderCreateSchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const HttpError = require('../utils/httpError');

async function list(req, res) {
  const reminders = await prisma.reminder.findMany({ where: { userId: req.user.id }, include: { debt: true }, orderBy: { scheduledAt: 'desc' } });
  return sendSuccess(res, serialize(reminders));
}

async function create(req, res) {
  const input = reminderCreateSchema.parse(req.body);
  if (input.debtId) {
    const debt = await prisma.debt.findFirst({ where: { id: input.debtId, userId: req.user.id } });
    if (!debt) throw new HttpError(400, 'INVALID_DEBT', 'A dívida selecionada não existe.');
  }
  const reminder = await prisma.reminder.create({ data: { ...input, userId: req.user.id } });
  return sendSuccess(res, serialize(reminder), 'Lembrete agendado com sucesso.', 201);
}

async function remove(req, res) {
  const id = idSchema.parse(req.params).id;
  const result = await prisma.reminder.updateMany({ where: { id, userId: req.user.id, status: 'SCHEDULED' }, data: { status: 'CANCELLED' } });
  if (!result.count) throw new HttpError(404, 'REMINDER_NOT_FOUND', 'Lembrete agendado não encontrado.');
  return sendSuccess(res, { id }, 'Lembrete cancelado com sucesso.');
}

module.exports = { list, create, remove };
