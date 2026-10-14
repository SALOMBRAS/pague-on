const prisma = require('../config/database');
const HttpError = require('../utils/httpError');

const DEFAULT_SETTINGS = Object.freeze({
  simpleInterestEnabled: true,
  compoundInterestAllowed: false,
  modalityRates: { INSTALLMENT: 0, SIMPLE_INTEREST: 0, PRICE: 0, RENEWAL: 0 },
  latePenaltyType: 'PERCENTAGE',
  latePenaltyValue: 0,
  lateInterestRate: 0,
  gracePeriodDays: 0,
  paymentAllocationOrder: ['PENALTY', 'INTEREST', 'PRINCIPAL'],
  skipSundays: false,
  dueDateRule: 'KEEP',
  discountLimitPercent: 0,
  approvalLimits: { ADMIN: null, MANAGER: 0 },
  defaultCommission: { type: 'PERCENTAGE', rate: 0, base: 'TOTAL' },
  contractTemplates: {},
  messageTemplates: {},
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const mergeSettings = (settings) => ({ ...clone(DEFAULT_SETTINGS), ...(settings || {}), modalityRates: { ...DEFAULT_SETTINGS.modalityRates, ...(settings?.modalityRates || {}) }, approvalLimits: { ...DEFAULT_SETTINGS.approvalLimits, ...(settings?.approvalLimits || {}) }, defaultCommission: { ...DEFAULT_SETTINGS.defaultCommission, ...(settings?.defaultCommission || {}) }, contractTemplates: settings?.contractTemplates || {}, messageTemplates: settings?.messageTemplates || {} });

async function current(userId, db = prisma) {
  const version = await db.financialSettingsVersion.findFirst({ where: { userId }, orderBy: { version: 'desc' } });
  return { version: version?.version || 0, id: version?.id || null, settings: mergeSettings(version?.settings), createdAt: version?.createdAt || null };
}

async function save(userId, actorId, settings, reason, db = prisma) {
  const latest = await current(userId, db);
  return db.financialSettingsVersion.create({ data: { userId, createdById: actorId, version: latest.version + 1, settings: mergeSettings(settings), reason } });
}

async function listHolidays(userId, db = prisma) {
  return db.financialHoliday.findMany({ where: { userId }, orderBy: [{ date: 'asc' }, { name: 'asc' }] });
}

async function activeHolidayDates(userId, db = prisma) {
  const holidays = await db.financialHoliday.findMany({ where: { userId, isActive: true }, select: { date: true } });
  return holidays.map((item) => item.date);
}

async function createHoliday(userId, input, db = prisma) { return db.financialHoliday.create({ data: { ...input, userId } }); }
async function updateHoliday(userId, id, input, db = prisma) {
  const existing = await db.financialHoliday.findFirst({ where: { id, userId } });
  if (!existing) throw new HttpError(404, 'HOLIDAY_NOT_FOUND', 'Feriado não encontrado.');
  return db.financialHoliday.update({ where: { id }, data: input });
}
async function removeHoliday(userId, id, db = prisma) {
  const existing = await db.financialHoliday.findFirst({ where: { id, userId } });
  if (!existing) throw new HttpError(404, 'HOLIDAY_NOT_FOUND', 'Feriado não encontrado.');
  return db.financialHoliday.delete({ where: { id } });
}

function lateCharges(amount, settings, daysOverdue) {
  const value = Number(amount);
  const rules = mergeSettings(settings);
  if (!Number.isFinite(value) || value < 0) throw new HttpError(400, 'INVALID_AMOUNT', 'O valor deve ser zero ou positivo.');
  if (!Number.isInteger(daysOverdue) || daysOverdue < 0) throw new HttpError(400, 'INVALID_OVERDUE_DAYS', 'Dias de atraso inválidos.');
  if (!value || daysOverdue <= rules.gracePeriodDays) return { penalty: 0, interest: 0, total: value };
  const penalty = rules.latePenaltyType === 'FIXED' ? Number(rules.latePenaltyValue) : value * (Number(rules.latePenaltyValue) / 100);
  const interest = value * (Number(rules.lateInterestRate) / 100) * daysOverdue;
  return { penalty: Number(penalty.toFixed(2)), interest: Number(interest.toFixed(2)), total: Number((value + penalty + interest).toFixed(2)) };
}

module.exports = { DEFAULT_SETTINGS, mergeSettings, current, save, listHolidays, activeHolidayDates, createHoliday, updateHoliday, removeHoliday, lateCharges };
