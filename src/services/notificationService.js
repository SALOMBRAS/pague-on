const prisma = require('../config/database');
const { sendToUser } = require('./pushService');

async function createNotification(db, userId, { title, body, type, data }) {
  const notification = await db.notification.create({
    data: { userId, title, body, type, ...(data ? { data } : {}) },
  });
  // Em operações fora de transação, a entrega é assíncrona e não bloqueia o registro do histórico.
  if (db === prisma) sendToUser(userId, { title, body, type, data }).catch((error) => console.warn('Falha ao entregar push:', error.message));
  return notification;
}

module.exports = { createNotification };
