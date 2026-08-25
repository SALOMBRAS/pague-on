const prisma = require('../config/database');
const { calculateProfitMargin } = require('../utils/calculateProfit');

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

// Mappers payload local (front) -> shape do Prisma.
// O front envia nomes próprios (ex.: total/amount -> totalAmount, due -> dueDate),
// então convertemos campo a campo e NUNCA repassamos um campo que o schema não tem.
// `forCreate` injeta defaults seguros nos required enumerados quando o valor não
// vier no payload; em UPDATE isso ficaria em segundo plano e sobreescreveria o
// registro, então só mapeamos o que veio do cliente.
function mapDebtPayload(payload, { forCreate = true } = {}) {
  const p = payload || {};
  const mapped = {};

  const amount = p.total ?? p.amount ?? p.totalAmount;
  if (amount !== undefined && amount !== null) mapped.totalAmount = amount;
  if (p.due !== undefined || p.dueDate !== undefined) mapped.dueDate = p.due ?? p.dueDate;
  if (p.counterparty !== undefined) mapped.counterparty = p.counterparty;
  if (p.counterpartyPhone !== undefined) mapped.counterpartyPhone = p.counterpartyPhone;
  if (p.description !== undefined) mapped.description = p.description;
  if (p.category !== undefined) mapped.category = p.category;
  if (p.type !== undefined) mapped.type = p.type;
  if (p.paymentType !== undefined) mapped.paymentType = p.paymentType;
  if (p.status !== undefined) mapped.status = p.status;
  if (p.startDate !== undefined) mapped.startDate = p.startDate;
  if (p.frequency !== undefined) mapped.frequency = p.frequency;
  if (p.installmentAmount !== undefined) mapped.installmentAmount = p.installmentAmount;
  if (p.totalInstallments !== undefined) mapped.totalInstallments = p.totalInstallments;
  if (p.paidAmount !== undefined) mapped.paidAmount = p.paidAmount;
  if (p.productId !== undefined) mapped.productId = p.productId;
  if (p.quantity !== undefined) mapped.quantity = p.quantity;

  if (forCreate) {
    if (!mapped.type) mapped.type = 'RECEIVABLE';
    if (!mapped.paymentType) mapped.paymentType = 'SINGLE';
    if (!mapped.category) mapped.category = 'OTHER';
    if (!mapped.status) mapped.status = 'PENDING';
    // startDate/dueDate são required no schema sem default: tolera payloads que
    // só mandam um deles reaproveitando o outro.
    if (!mapped.dueDate && mapped.startDate) mapped.dueDate = mapped.startDate;
    if (!mapped.startDate && mapped.dueDate) mapped.startDate = mapped.dueDate;
  }
  return mapped;
}

function mapProductPayload(payload) {
  const p = payload || {};
  const mapped = {};

  if (p.name !== undefined) mapped.name = p.name;
  if (p.sellingPrice !== undefined) mapped.sellingPrice = p.sellingPrice;
  else if (p.price !== undefined) mapped.sellingPrice = p.price;
  if (p.costPrice !== undefined) mapped.costPrice = p.costPrice;
  else if (p.cost !== undefined) mapped.costPrice = p.cost;
  if (p.stockQuantity !== undefined) mapped.stockQuantity = p.stockQuantity;
  else if (p.stock !== undefined) mapped.stockQuantity = p.stock;
  if (p.category !== undefined) mapped.category = p.category;
  if (p.minStockAlert !== undefined) mapped.minStockAlert = p.minStockAlert;
  if (p.description !== undefined) mapped.description = p.description;
  if (p.image !== undefined) mapped.image = p.image;

  // profitMargin é required sem default no schema; derivamos do custo/venda como
  // o productService faz (usa 0 quando faltar um dos preços — mesmo do backend).
  if (mapped.costPrice !== undefined && mapped.sellingPrice !== undefined) {
    mapped.profitMargin = calculateProfitMargin(mapped.costPrice, mapped.sellingPrice);
  }
  return mapped;
}

function mapCustomerPayload(payload) {
  const p = payload || {};
  const mapped = {};

  if (p.name !== undefined) mapped.name = p.name;
  if (p.nickname !== undefined) mapped.nickname = p.nickname;
  if (p.phone !== undefined) mapped.phone = p.phone;
  if (p.email !== undefined) mapped.email = p.email;
  if (p.cpfCnpj !== undefined) mapped.cpfCnpj = p.cpfCnpj;
  if (p.address !== undefined) mapped.address = p.address;
  if (p.notes !== undefined) mapped.notes = p.notes;
  return mapped;
}

// Mapper por modelo. Entidades sem mapper (purchase, goal) seguem com o payload cru.
const PAYLOAD_MAPPERS = {
  debt: mapDebtPayload,
  product: mapProductPayload,
  customer: mapCustomerPayload,
};

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
    const mapper = PAYLOAD_MAPPERS[modelKey];

    try {
      await prisma.syncLog.create({ data: { userId, entity, recordId: String(recordId ?? ''), op } });

      if (modelKey && SUPPORTED_OPS.has(op) && data) {
        const model = prisma[modelKey];
        if (op === 'INSERT' || op === 'CREATE') {
          const mapped = mapper ? { ...mapper(data, { forCreate: true }), userId } : { ...data, userId };
          await model.create({ data: mapped });
        } else if (op === 'UPDATE') {
          const mapped = mapper ? mapper(data, { forCreate: false }) : data;
          await model.update({ where: { id: recordId }, data: mapped });
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
