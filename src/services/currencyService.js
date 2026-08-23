const prisma = require('../config/database');
const HttpError = require('../utils/httpError');

const DEFAULTS = { BRL: ['Real brasileiro', 'R$', 1], USD: ['Dólar americano', 'US$', 5.4], EUR: ['Euro', '€', 5.85], GBP: ['Libra esterlina', '£', 6.9], ARS: ['Peso argentino', 'ARS$', 0.005], CAD: ['Dólar canadense', 'CA$', 3.95] };
const round = (value) => Number(Number(value).toFixed(2));
function convertAmount(amount, rateToBRL, from = 'BRL', to = 'BRL') { const inBrl = Number(amount) * Number(rateToBRL); return to === 'BRL' ? round(inBrl) : round(inBrl); }

async function ensureCurrencies(db = prisma) {
  await Promise.all(Object.entries(DEFAULTS).map(([code, [name, symbol, rateToBRL]]) => db.currency.upsert({ where: { code }, create: { code, name, symbol, rateToBRL }, update: {} })));
}
async function listCurrencies() { await ensureCurrencies(); return prisma.currency.findMany({ orderBy: { code: 'asc' } }); }
async function getCurrency(code) { await ensureCurrencies(); const currency = await prisma.currency.findUnique({ where: { code } }); if (!currency) throw new HttpError(400, 'UNSUPPORTED_CURRENCY', `A moeda ${code} não é suportada.`); return currency; }
async function refreshCurrency(code) {
  if (code === 'BRL') return prisma.currency.upsert({ where: { code: 'BRL' }, create: { code: 'BRL', ...Object.fromEntries([['name', DEFAULTS.BRL[0]], ['symbol', DEFAULTS.BRL[1]], ['rateToBRL', 1]]), updatedAt: new Date() }, update: { rateToBRL: 1, updatedAt: new Date() } });
  const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(code)}/BRL`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new HttpError(502, 'EXCHANGE_RATE_UNAVAILABLE', 'Não foi possível atualizar a cotação desta moeda.');
  const data = await response.json(); const rate = Number(data.rate); if (!Number.isFinite(rate) || rate <= 0) throw new HttpError(502, 'EXCHANGE_RATE_INVALID', 'A cotação recebida é inválida.');
  const fallback = DEFAULTS[code] || [code, code, rate]; return prisma.currency.upsert({ where: { code }, create: { code, name: fallback[0], symbol: fallback[1], rateToBRL: rate }, update: { rateToBRL: rate } });
}
async function updateExchangeRates() { await ensureCurrencies(); const codes = Object.keys(DEFAULTS); const results = await Promise.allSettled(codes.map((code) => refreshCurrency(code))); return { updated: results.filter((item) => item.status === 'fulfilled').length, failed: results.filter((item) => item.status === 'rejected').length }; }
async function convert(input) {
  const from = await getCurrency(input.from); const to = await getCurrency(input.to);
  const brl = Number(input.amount) * Number(from.rateToBRL); const converted = input.to === 'BRL' ? brl : brl / Number(to.rateToBRL);
  return { amount: Number(input.amount), from: input.from, to: input.to, convertedAmount: round(converted), rate: input.from === input.to ? 1 : input.to === 'BRL' ? Number(from.rateToBRL) : Number(from.rateToBRL) / Number(to.rateToBRL), updatedAt: from.updatedAt > to.updatedAt ? from.updatedAt : to.updatedAt };
}
async function convertDebtInput(input) {
  const code = input.currency || 'BRL'; const currency = await getCurrency(code); const rate = Number(currency.rateToBRL); const originalAmount = Number(input.totalAmount);
  return { ...input, currency: code, originalAmount, exchangeRate: rate, totalAmount: round(originalAmount * rate), installmentAmount: input.installmentAmount ? round(Number(input.installmentAmount) * rate) : input.installmentAmount };
}

module.exports = { DEFAULTS, convertAmount, ensureCurrencies, listCurrencies, getCurrency, refreshCurrency, updateExchangeRates, convert, convertDebtInput };
