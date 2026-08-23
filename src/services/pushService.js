const webPush = require('web-push');
const prisma = require('../config/database');

const VAPID_FIELDS = ['VAPID_SUBJECT', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];

function isConfigured() {
  return VAPID_FIELDS.every((field) => Boolean(process.env[field]));
}

function configure() {
  if (!isConfigured()) return false;
  webPush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return true;
}

function isAllowed(user, type) {
  if (!user.notificationEnabled) return false;
  if (['BUDGET_ALERT', 'BUDGET_EXCEEDED'].includes(type)) return user.budgetAlerts;
  if (type === 'STOCK_LOW') return user.stockAlerts;
  if (type === 'WEEKLY_DIGEST') return user.weeklyDigest;
  if (type === 'MONTHLY_DIGEST') return user.monthlyDigest;
  return true;
}

async function saveSubscription(userId, subscription) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: { userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, expirationTime: subscription.expirationTime || null },
    update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, expirationTime: subscription.expirationTime || null },
  });
}

async function removeSubscription(userId, endpoint) {
  const result = await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  return { removed: result.count > 0 };
}

async function sendToUser(userId, message) {
  if (!configure()) return { delivered: 0, skipped: 'VAPID_NOT_CONFIGURED' };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationEnabled: true, budgetAlerts: true, stockAlerts: true, weeklyDigest: true, monthlyDigest: true, notificationSound: true } });
  if (!user || !isAllowed(user, message.type)) return { delivered: 0, skipped: 'PREFERENCES_DISABLED' };
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    tag: `pagueon-${message.type || 'notification'}-${message.data?.debtId || message.data?.productId || Date.now()}`,
    type: message.type || 'SYSTEM',
    payload: message.data || {},
    silent: user.notificationSound === 'SILENT',
  });
  let delivered = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 60 * 60 * 24 });
      delivered += 1;
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => null);
      else console.warn('Falha ao enviar push:', error.statusCode || error.message);
    }
  }));
  return { delivered, subscriptions: subscriptions.length };
}

module.exports = { isConfigured, saveSubscription, removeSubscription, sendToUser };
