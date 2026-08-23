const prisma = require('../config/database');
const { sendSuccess } = require('../utils/responseHelper');
const HttpError = require('../utils/httpError');
const currencyService = require('../services/currencyService');
const notificationJobs = require('../services/notificationJobsService');
const interestCalculator = require('../services/interestCalculator');

function assertCronSecret(req) {
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) throw new HttpError(401, 'INVALID_CRON_SECRET', 'Credencial de cron inválida.');
}

async function checkReminders(req, res) {
  assertCronSecret(req);
  const now = new Date();
  const candidates = await prisma.debt.findMany({
    where: { isActive: true, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
    include: { user: true },
  });
  const dueDebts = candidates.filter((debt) => {
    if (!debt.user.notificationEnabled || debt.user.reminderDefaultTime === null) return false;
    const diffMinutes = (debt.dueDate.getTime() - now.getTime()) / 60000;
    return diffMinutes >= 0 && diffMinutes <= debt.user.reminderDefaultTime;
  });
  let created = 0;
  for (const debt of dueDebts) {
    const existing = await prisma.reminder.findFirst({
      where: { userId: debt.userId, debtId: debt.id, status: 'SCHEDULED', scheduledAt: { gte: new Date(now.getTime() - 3600000) } },
    });
    if (existing) continue;
    await prisma.$transaction([
      prisma.notification.create({
        data: { userId: debt.userId, title: 'Vencimento próximo', body: `${debt.description} vence em breve.`, type: 'DEBT_DUE', data: { debtId: debt.id } },
      }),
      prisma.reminder.create({
        data: { userId: debt.userId, debtId: debt.id, scheduledAt: now, message: `${debt.description} vence em breve.`, status: 'SCHEDULED' },
      }),
    ]);
    created += 1;
  }
  return sendSuccess(res, { checked: candidates.length, created }, 'Lembretes verificados com sucesso.');
}

async function updateExchangeRates(req, res) { assertCronSecret(req); return sendSuccess(res, await currencyService.updateExchangeRates(), 'Cotações atualizadas.'); }
async function runNotifications(req, res) { assertCronSecret(req); return sendSuccess(res, await notificationJobs.runDailyNotifications(), 'Notificações diárias processadas.'); }
async function weeklyDigest(req, res) { assertCronSecret(req); return sendSuccess(res, await notificationJobs.runDigest('WEEKLY_DIGEST'), 'Resumo semanal processado.'); }
async function monthlyDigest(req, res) { assertCronSecret(req); return sendSuccess(res, await notificationJobs.runDigest('MONTHLY_DIGEST'), 'Resumo mensal processado.'); }
async function recalculateInterest(req, res) { assertCronSecret(req); return sendSuccess(res, await interestCalculator.recalculateAllInterest(), 'Juros recalculados.'); }

module.exports = { checkReminders, updateExchangeRates, runNotifications, weeklyDigest, monthlyDigest, recalculateInterest };
