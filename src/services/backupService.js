const crypto = require('crypto');
const prisma = require('../config/database');
const { serialize } = require('../utils/serializers');
const HttpError = require('../utils/httpError');

const VERSION = '1.0';
const list = (value, name) => { if (value === undefined) return []; if (!Array.isArray(value)) throw new HttpError(400, 'INVALID_BACKUP', `O campo ${name} do backup é inválido.`); return value; };
const asDate = (value, field) => { const date = new Date(value); if (!value || Number.isNaN(date.getTime())) throw new HttpError(400, 'INVALID_BACKUP', `Data inválida em ${field}.`); return date; };
const asNumber = (value, field, fallback = undefined) => { if (value === null || value === undefined || value === '') { if (fallback !== undefined) return fallback; throw new HttpError(400, 'INVALID_BACKUP', `Número inválido em ${field}.`); } const number = Number(value); if (!Number.isFinite(number)) throw new HttpError(400, 'INVALID_BACKUP', `Número inválido em ${field}.`); return number; };
const mapId = (map, id, name) => { const value = map.get(id); if (!value) throw new HttpError(400, 'INVALID_BACKUP', `Referência não encontrada: ${name}.`); return value; };

function encryptionKey() {
  const secret = process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(500, 'BACKUP_KEY_MISSING', 'Configure uma chave de backup segura no servidor.');
  return crypto.createHash('sha256').update(secret).digest();
}
function encrypt(payload) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}
function decrypt(snapshot) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(snapshot.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(snapshot.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(snapshot.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

async function createBackup(userId) {
  const [user, debts, products, purchases, customers, sales, reminders, notifications, cashFlows, rules, assets, bankStatements, budgets] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, currency: true, theme: true, notificationEnabled: true, reminderDefaultTime: true, dueReminderDays: true, budgetAlerts: true, stockAlerts: true, weeklyDigest: true, monthlyDigest: true, notificationSound: true, defaultMessage: true, duplicateSensitivity: true } }),
    prisma.debt.findMany({ where: { userId }, include: { installments: true, recurringPayments: true }, orderBy: { createdAt: 'asc' } }),
    prisma.product.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.purchase.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.customer.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.sale.findMany({ where: { userId }, include: { items: true }, orderBy: { createdAt: 'asc' } }),
    prisma.reminder.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.cashFlow.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.rule.findMany({ where: { userId }, include: { triggers: true, actions: true }, orderBy: { order: 'asc' } }),
    prisma.asset.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.bankStatement.findMany({ where: { userId }, include: { transactions: { orderBy: { createdAt: 'asc' } } }, orderBy: { importedAt: 'asc' } }),
    prisma.budget.findMany({ where: { userId }, orderBy: [{ year: 'asc' }, { month: 'asc' }, { category: 'asc' }] }),
  ]);
  return serialize({ version: VERSION, exportedAt: new Date().toISOString(), user, data: { debts, products, purchases, customers, sales, reminders, notifications, cashFlows, rules, assets, bankStatements, budgets } });
}

function validate(backup) {
  if (!backup || backup.version !== VERSION || !backup.data || typeof backup.data !== 'object') throw new HttpError(400, 'INVALID_BACKUP', 'Formato de backup inválido ou não suportado.');
  const data = backup.data;
  for (const name of ['debts', 'products', 'purchases', 'customers', 'sales', 'reminders', 'notifications', 'cashFlows', 'rules', 'assets', 'bankStatements', 'budgets']) list(data[name], name);
  return data;
}

async function clearUserData(tx, userId) {
  await tx.bankTransaction.deleteMany({ where: { userId } });
  await tx.bankStatement.deleteMany({ where: { userId } });
  await tx.budget.deleteMany({ where: { userId } });
  await tx.netWorthSnapshot.deleteMany({ where: { userId } });
  await tx.notification.deleteMany({ where: { userId } });
  await tx.reminder.deleteMany({ where: { userId } });
  await tx.cashFlow.deleteMany({ where: { userId } });
  await tx.rule.deleteMany({ where: { userId } });
  await tx.purchase.deleteMany({ where: { userId } });
  await tx.sale.deleteMany({ where: { userId } });
  await tx.debt.deleteMany({ where: { userId } });
  await tx.customer.deleteMany({ where: { userId } });
  await tx.product.deleteMany({ where: { userId } });
  await tx.asset.deleteMany({ where: { userId } });
}

async function restoreBackup(userId, backup, mode = 'MERGE') {
  const data = validate(backup);
  if (!['MERGE', 'REPLACE'].includes(mode)) throw new HttpError(400, 'INVALID_RESTORE_MODE', 'Escolha MERGE ou REPLACE para a restauração.');
  const result = await prisma.$transaction(async (tx) => {
    if (mode === 'REPLACE') await clearUserData(tx, userId);
    const productIds = new Map(); const customerIds = new Map(); const debtIds = new Map(); const saleIds = new Map();
    for (const source of list(data.products, 'products')) {
      const record = await tx.product.create({ data: { userId, name: String(source.name || ''), category: source.category ? String(source.category) : null, costPrice: asNumber(source.costPrice, 'product.costPrice', 0), sellingPrice: asNumber(source.sellingPrice, 'product.sellingPrice', 0), profitMargin: asNumber(source.profitMargin, 'product.profitMargin', 0), stockQuantity: Math.trunc(asNumber(source.stockQuantity, 'product.stockQuantity', 0)), minStockAlert: source.minStockAlert === null ? null : Math.trunc(asNumber(source.minStockAlert, 'product.minStockAlert', 5)), image: source.image ? String(source.image) : null, description: source.description ? String(source.description) : null, isActive: source.isActive !== false } });
      productIds.set(source.id, record.id);
    }
    for (const source of list(data.assets, 'assets')) await tx.asset.create({ data: { userId, name: String(source.name || ''), type: source.type, value: asNumber(source.value, 'asset.value'), currency: source.currency ? String(source.currency).slice(0, 3) : 'BRL', isLiquid: source.isLiquid !== false, description: source.description ? String(source.description) : null } });
    for (const source of list(data.customers, 'customers')) { const record = await tx.customer.create({ data: { userId, name: String(source.name || ''), phone: source.phone ? String(source.phone) : null, email: source.email ? String(source.email) : null, notes: source.notes ? String(source.notes) : null, isActive: source.isActive !== false } }); customerIds.set(source.id, record.id); }
    for (const source of list(data.debts, 'debts')) {
      const record = await tx.debt.create({ data: { userId, type: source.type, paymentType: source.paymentType, description: String(source.description || ''), category: source.category, counterparty: String(source.counterparty || ''), counterpartyPhone: source.counterpartyPhone ? String(source.counterpartyPhone) : null, customerId: source.customerId ? mapId(customerIds, source.customerId, 'cliente da conta') : null, totalAmount: asNumber(source.totalAmount, 'debt.totalAmount'), paidAmount: asNumber(source.paidAmount, 'debt.paidAmount', 0), installmentAmount: source.installmentAmount === null || source.installmentAmount === undefined ? null : asNumber(source.installmentAmount, 'debt.installmentAmount'), totalInstallments: source.totalInstallments === null || source.totalInstallments === undefined ? null : Math.trunc(asNumber(source.totalInstallments, 'debt.totalInstallments')), paidInstallments: Math.trunc(asNumber(source.paidInstallments, 'debt.paidInstallments', 0)), frequency: source.frequency || null, startDate: asDate(source.startDate, 'debt.startDate'), dueDate: asDate(source.dueDate, 'debt.dueDate'), endDate: source.endDate ? asDate(source.endDate, 'debt.endDate') : null, repeatCount: source.repeatCount === null || source.repeatCount === undefined ? null : Math.trunc(asNumber(source.repeatCount, 'debt.repeatCount')), status: source.status, isActive: source.isActive !== false, paidAt: source.paidAt ? asDate(source.paidAt, 'debt.paidAt') : null, productId: source.productId ? mapId(productIds, source.productId, 'produto da conta') : null, quantity: source.quantity === null || source.quantity === undefined ? null : Math.trunc(asNumber(source.quantity, 'debt.quantity')), tags: Array.isArray(source.tags) ? source.tags.map(String).slice(0, 30) : [] } });
      debtIds.set(source.id, record.id);
      for (const installment of list(source.installments, 'debt.installments')) await tx.installment.create({ data: { debtId: record.id, number: Math.trunc(asNumber(installment.number, 'installment.number')), amount: asNumber(installment.amount, 'installment.amount'), dueDate: asDate(installment.dueDate, 'installment.dueDate'), paidAt: installment.paidAt ? asDate(installment.paidAt, 'installment.paidAt') : null, paidAmount: installment.paidAmount === null || installment.paidAmount === undefined ? null : asNumber(installment.paidAmount, 'installment.paidAmount'), status: installment.status } });
      for (const payment of list(source.recurringPayments, 'debt.recurringPayments')) await tx.recurringPayment.create({ data: { debtId: record.id, period: String(payment.period), dueDate: asDate(payment.dueDate, 'recurringPayment.dueDate'), paidAt: payment.paidAt ? asDate(payment.paidAt, 'recurringPayment.paidAt') : null, amount: payment.amount === null || payment.amount === undefined ? null : asNumber(payment.amount, 'recurringPayment.amount'), status: payment.status } });
    }
    for (const source of list(data.bankStatements, 'bankStatements')) {
      const statement = await tx.bankStatement.create({ data: { userId, fileName: String(source.fileName || 'extrato'), accountName: source.accountName ? String(source.accountName) : null, importedAt: source.importedAt ? asDate(source.importedAt, 'bankStatement.importedAt') : new Date() } });
      for (const transaction of list(source.transactions, 'bankStatement.transactions')) await tx.bankTransaction.create({ data: { userId, statementId: statement.id, externalId: transaction.externalId ? String(transaction.externalId) : null, fingerprint: String(transaction.fingerprint || `${transaction.date}|${transaction.description}|${transaction.amount}`), date: asDate(transaction.date, 'bankTransaction.date'), description: String(transaction.description || '').slice(0, 500), amount: asNumber(transaction.amount, 'bankTransaction.amount'), balance: transaction.balance === null || transaction.balance === undefined ? null : asNumber(transaction.balance, 'bankTransaction.balance'), status: transaction.status || 'PENDING', matchedDebtId: transaction.matchedDebtId ? mapId(debtIds, transaction.matchedDebtId, 'conta conciliada') : null, matchConfidence: transaction.matchConfidence === null || transaction.matchConfidence === undefined ? null : Math.trunc(asNumber(transaction.matchConfidence, 'bankTransaction.matchConfidence')), confirmedAt: transaction.confirmedAt ? asDate(transaction.confirmedAt, 'bankTransaction.confirmedAt') : null } });
    }
    for (const source of list(data.budgets, 'budgets')) await tx.budget.upsert({ where: { userId_category_month_year: { userId, category: source.category, month: Math.trunc(asNumber(source.month, 'budget.month')), year: Math.trunc(asNumber(source.year, 'budget.year')) } }, create: { userId, category: source.category, month: Math.trunc(asNumber(source.month, 'budget.month')), year: Math.trunc(asNumber(source.year, 'budget.year')), limitAmount: asNumber(source.limitAmount, 'budget.limitAmount'), spentAmount: asNumber(source.spentAmount, 'budget.spentAmount', 0), rollover: Boolean(source.rollover), alertAt: Math.trunc(asNumber(source.alertAt, 'budget.alertAt', 80)) }, update: { limitAmount: asNumber(source.limitAmount, 'budget.limitAmount'), spentAmount: asNumber(source.spentAmount, 'budget.spentAmount', 0), rollover: Boolean(source.rollover), alertAt: Math.trunc(asNumber(source.alertAt, 'budget.alertAt', 80)) } });
    for (const source of list(data.sales, 'sales')) { const record = await tx.sale.create({ data: { userId, customerId: source.customerId ? mapId(customerIds, source.customerId, 'cliente da venda') : null, totalAmount: asNumber(source.totalAmount, 'sale.totalAmount'), paidAmount: asNumber(source.paidAmount, 'sale.paidAmount', 0), discount: asNumber(source.discount, 'sale.discount', 0), status: source.status, notes: source.notes ? String(source.notes) : null, soldAt: asDate(source.soldAt, 'sale.soldAt') } }); saleIds.set(source.id, record.id); for (const item of list(source.items, 'sale.items')) await tx.saleItem.create({ data: { saleId: record.id, productId: mapId(productIds, item.productId, 'produto da venda'), name: String(item.name || ''), quantity: Math.trunc(asNumber(item.quantity, 'saleItem.quantity')), unitPrice: asNumber(item.unitPrice, 'saleItem.unitPrice'), unitCost: asNumber(item.unitCost, 'saleItem.unitCost'), total: asNumber(item.total, 'saleItem.total') } }); }
    for (const source of list(data.debts, 'debts')) if (source.saleId) await tx.debt.update({ where: { id: mapId(debtIds, source.id, 'conta') }, data: { saleId: mapId(saleIds, source.saleId, 'venda da conta') } });
    for (const source of list(data.purchases, 'purchases')) await tx.purchase.create({ data: { userId, productId: mapId(productIds, source.productId, 'produto da compra'), quantity: Math.trunc(asNumber(source.quantity, 'purchase.quantity')), unitCost: asNumber(source.unitCost, 'purchase.unitCost'), totalCost: asNumber(source.totalCost, 'purchase.totalCost'), supplier: source.supplier ? String(source.supplier) : null, date: asDate(source.date, 'purchase.date'), notes: source.notes ? String(source.notes) : null } });
    for (const source of list(data.reminders, 'reminders')) await tx.reminder.create({ data: { userId, debtId: source.debtId ? mapId(debtIds, source.debtId, 'conta do lembrete') : null, type: source.type, scheduledAt: asDate(source.scheduledAt, 'reminder.scheduledAt'), sentAt: source.sentAt ? asDate(source.sentAt, 'reminder.sentAt') : null, message: source.message ? String(source.message) : null, status: source.status } });
    for (const source of list(data.notifications, 'notifications')) await tx.notification.create({ data: { userId, title: String(source.title || ''), body: String(source.body || ''), type: source.type, read: Boolean(source.read), data: source.data || undefined } });
    for (const source of list(data.cashFlows, 'cashFlows')) await tx.cashFlow.upsert({ where: { userId_date: { userId, date: asDate(source.date, 'cashFlow.date') } }, create: { userId, date: asDate(source.date, 'cashFlow.date'), totalIn: asNumber(source.totalIn, 'cashFlow.totalIn', 0), totalOut: asNumber(source.totalOut, 'cashFlow.totalOut', 0), balance: asNumber(source.balance, 'cashFlow.balance', 0) }, update: { totalIn: asNumber(source.totalIn, 'cashFlow.totalIn', 0), totalOut: asNumber(source.totalOut, 'cashFlow.totalOut', 0), balance: asNumber(source.balance, 'cashFlow.balance', 0) } });
    for (const source of list(data.rules, 'rules')) await tx.rule.create({ data: { userId, name: String(source.name || ''), order: Math.trunc(asNumber(source.order, 'rule.order', 0)), isActive: source.isActive !== false, triggerLogic: source.triggerLogic || 'ALL', triggers: { create: list(source.triggers, 'rule.triggers').map((trigger) => ({ type: trigger.type, value: String(trigger.value || ''), operator: trigger.operator || 'EQUALS' })) }, actions: { create: list(source.actions, 'rule.actions').map((action) => ({ type: action.type, value: String(action.value || '') })) } } });
    if (backup.user) await tx.user.update({ where: { id: userId }, data: { currency: backup.user.currency || undefined, theme: backup.user.theme || undefined, notificationEnabled: typeof backup.user.notificationEnabled === 'boolean' ? backup.user.notificationEnabled : undefined, reminderDefaultTime: backup.user.reminderDefaultTime ?? undefined, dueReminderDays: backup.user.dueReminderDays ?? undefined, budgetAlerts: typeof backup.user.budgetAlerts === 'boolean' ? backup.user.budgetAlerts : undefined, stockAlerts: typeof backup.user.stockAlerts === 'boolean' ? backup.user.stockAlerts : undefined, weeklyDigest: typeof backup.user.weeklyDigest === 'boolean' ? backup.user.weeklyDigest : undefined, monthlyDigest: typeof backup.user.monthlyDigest === 'boolean' ? backup.user.monthlyDigest : undefined, notificationSound: backup.user.notificationSound || undefined, defaultMessage: backup.user.defaultMessage ?? undefined, duplicateSensitivity: backup.user.duplicateSensitivity ?? undefined } });
    return { debts: debtIds.size, products: productIds.size, assets: list(data.assets, 'assets').length, purchases: list(data.purchases, 'purchases').length, customers: customerIds.size, sales: saleIds.size, rules: list(data.rules, 'rules').length, bankStatements: list(data.bankStatements, 'bankStatements').length, budgets: list(data.budgets, 'budgets').length };
  }, { timeout: 30000 });
  return { mode, ...result };
}

async function saveCloudBackup(userId) {
  const backup = await createBackup(userId); const raw = JSON.stringify(backup); const encrypted = encrypt(raw);
  const snapshot = await prisma.backupSnapshot.create({ data: { userId, version: VERSION, exportedAt: new Date(backup.exportedAt), sizeBytes: Buffer.byteLength(raw), ...encrypted } });
  const old = await prisma.backupSnapshot.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: 5, select: { id: true } });
  if (old.length) await prisma.backupSnapshot.deleteMany({ where: { id: { in: old.map((item) => item.id) } } });
  return { id: snapshot.id, version: snapshot.version, exportedAt: snapshot.exportedAt, sizeBytes: snapshot.sizeBytes };
}
async function cloudStatus(userId) { const latest = await prisma.backupSnapshot.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, version: true, exportedAt: true, sizeBytes: true, createdAt: true } }); return { latest }; }
async function restoreCloudBackup(userId, id, mode) { const snapshot = await prisma.backupSnapshot.findFirst({ where: { id, userId } }); if (!snapshot) throw new HttpError(404, 'BACKUP_NOT_FOUND', 'Backup não encontrado.'); return restoreBackup(userId, JSON.parse(decrypt(snapshot)), mode); }

module.exports = { VERSION, createBackup, restoreBackup, saveCloudBackup, cloudStatus, restoreCloudBackup };
