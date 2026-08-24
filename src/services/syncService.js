const prisma = require('../config/database');

// Mapa de entidade (nome que o front envia em `change.entity`) -> modelo prisma.
// Inclui formas singular e plural para tolerar variações no payload.
const ENTITY_MODELS = {
  debt: 'debt',
  debts: 'debt',
  product: 'product',
  products: 'product',
  purchase: 'purchase',
  purchases: 'purchase',
  customer: 'customer',
  customers: 'customer',
  goal: 'goal',
  goals: 'goal',
};

const SUPPORTED_OPS = new Set(['INSERT', 'CREATE', 'UPDATE', 'DELETE']);

/**
 * Aplica as mudanças sincronizadas do dispositivo e registra cada tentativa
 * num SyncLog (append-only, por usuário). Um item que falha não derruba a
 * fila nem é descartado: fica no array de erros para o cliente reenviar depois.
 *
 * @param {string} userId
 * @param {Array<{id?:string, entity:string, action?:string, op?:string, recordId?:string, payload?:object, data?:object}>} changes
 * @returns {Promise<{applied:number, processedIds:string[], errors:Array<object>}>}
 */
async function push(userId, changes = []) {
  const processedIds = [];
  const errors = [];

  for (const change of changes) {
    const entity = change.entity;
    const op = (change.op || change.action || '').toUpperCase();
    const recordId = change.recordId || change.payload?.id || change.data?.id;
    const data = change.data ?? change.payload;
    const modelKey = ENTITY_MODELS[entity];

    try {
      await prisma.syncLog.create({ data: { userId, entity, recordId: String(recordId ?? ''), op } });

      if (modelKey && SUPPORTED_OPS.has(op) && data) {
        const model = prisma[modelKey];
        if (op === 'INSERT' || op === 'CREATE') {
          await model.create({ data: { ...data, userId } });
        } else if (op === 'UPDATE') {
          await model.update({ where: { id: recordId }, data });
        } else if (op === 'DELETE') {
          await model.delete({ where: { id: recordId } });
        }
      }
      processedIds.push(change.id || recordId);
    } catch (error) {
      errors.push({ id: change.id || null, entity, recordId, op, message: error.message });
    }
  }

  return { applied: processedIds.length, processedIds, errors };
}

/**
 * Retorna as mudanças registradas para o usuário desde a marca `since`
 * (string ISO opcional), na ordem em que foram aplicadas.
 *
 * @param {string} userId
 * @param {string} [since]
 * @returns {Promise<Array<{entity:string, recordId:string, op:string, appliedAt:Date}>>}
 */
async function pull(userId, since) {
  const sinceDate = since ? new Date(since) : null;
  const where = {
    userId,
    ...(sinceDate && !Number.isNaN(sinceDate.getTime()) ? { appliedAt: { gt: sinceDate } } : {}),
  };
  const logs = await prisma.syncLog.findMany({ where, orderBy: { appliedAt: 'asc' } });
  return logs.map(({ entity, recordId, op, appliedAt }) => ({ entity, recordId, op, appliedAt }));
}

module.exports = { push, pull };
