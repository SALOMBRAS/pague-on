const prisma = require('../config/database');
const { createNotification } = require('./notificationService');
const { sendToUser } = require('./pushService');

function dayStart(value = new Date()) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; }
function addDays(value, days) { const date = new Date(value); date.setDate(date.getDate() + days); return date; }
function money(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

async function createAndDeliver(userId, message, reminder) {
  const notification = await prisma.$transaction(async (tx) => {
    const created = await createNotification(tx, userId, message);
    if (reminder) await tx.reminder.create({ data: { userId, debtId: reminder.debtId || null, scheduledAt: new Date(), sentAt: new Date(), message: message.body, status: 'SENT' } });
    return created;
  });
  await sendToUser(userId, message);
  return notification;
}

async function runDueNotifications() {
  const today = dayStart();
  const debts = await prisma.debt.findMany({ where: { isActive: true, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, include: { user: true } });
  let created = 0;
  for (const debt of debts) {
    if (!debt.user.notificationEnabled) continue;
    const due = dayStart(debt.dueDate);
    const daysUntilDue = Math.round((due - today) / 86400000);
    const isDue = daysUntilDue === debt.user.dueReminderDays;
    const isOverdue = daysUntilDue < 0;
    if (!isDue && !isOverdue) continue;
    const alreadySent = await prisma.reminder.findFirst({ where: { userId: debt.userId, debtId: debt.id, status: 'SENT', sentAt: { gte: today } } });
    if (alreadySent) continue;
    const type = isOverdue ? 'DEBT_OVERDUE' : 'DEBT_DUE';
    const message = isOverdue
      ? { title: '⚠️ Dívida em atraso', body: `${debt.counterparty}: ${debt.description} está atrasada há ${Math.abs(daysUntilDue)} dia(s).`, type, data: { debtId: debt.id, path: '#caixa' } }
      : { title: debt.user.dueReminderDays === 1 ? '⏰ Dívida vence amanhã' : '⏰ Vencimento próximo', body: `${debt.counterparty}: ${debt.description} vence em ${debt.user.dueReminderDays} dia(s) (${money(debt.totalAmount)}).`, type, data: { debtId: debt.id, path: '#caixa' } };
    await createAndDeliver(debt.userId, message, { debtId: debt.id });
    created += 1;
  }
  return { checked: debts.length, created };
}

async function runStockAlerts() {
  const today = dayStart();
  const products = await prisma.product.findMany({ where: { isActive: true, minStockAlert: { not: null } }, include: { user: true } });
  let created = 0;
  for (const product of products) {
    if (!product.user.notificationEnabled || !product.user.stockAlerts || product.stockQuantity > product.minStockAlert) continue;
    const existing = await prisma.notification.findFirst({ where: { userId: product.userId, type: 'STOCK_LOW', createdAt: { gte: today }, data: { path: ['productId'], equals: product.id } } });
    if (existing) continue;
    const message = { title: '📦 Estoque baixo', body: `${product.name} está com apenas ${product.stockQuantity} unidade(s).`, type: 'STOCK_LOW', data: { productId: product.id, path: '#stock' } };
    await createAndDeliver(product.userId, message);
    created += 1;
  }
  return { checked: products.length, created };
}

async function runDigest(kind) {
  const now = new Date();
  const start = kind === 'WEEKLY_DIGEST' ? addDays(dayStart(now), -7) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const users = await prisma.user.findMany({ where: { notificationEnabled: true, ...(kind === 'WEEKLY_DIGEST' ? { weeklyDigest: true } : { monthlyDigest: true }) }, select: { id: true } });
  let created = 0;
  for (const user of users) {
    const existing = await prisma.notification.findFirst({ where: { userId: user.id, type: kind, createdAt: { gte: start } } });
    if (existing) continue;
    const totals = await prisma.cashFlow.aggregate({ where: { userId: user.id, date: { gte: start, lte: now } }, _sum: { totalIn: true, totalOut: true } });
    const totalIn = Number(totals._sum.totalIn || 0); const totalOut = Number(totals._sum.totalOut || 0);
    const title = kind === 'WEEKLY_DIGEST' ? '📊 Resumo da semana' : '📅 Balanço do mês';
    const message = { title, body: `${money(totalIn)} em entradas e ${money(totalOut)} em saídas.`, type: kind, data: { path: '#home' } };
    await createAndDeliver(user.id, message);
    created += 1;
  }
  return { checked: users.length, created };
}

async function runDailyNotifications() {
  const [due, stock] = await Promise.all([runDueNotifications(), runStockAlerts()]);
  return { due, stock };
}

module.exports = { runDueNotifications, runStockAlerts, runDigest, runDailyNotifications };
