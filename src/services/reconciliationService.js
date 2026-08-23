const crypto = require('crypto');
const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { updateDailyCashFlow } = require('./debtService');
const { syncBudgetForDebt } = require('./budgetService');

const MAX_TRANSACTIONS = 5000;
const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normalize = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cents = (value) => Math.round(Number(value) * 100);
const utcDate = (year, month, day) => new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
const daysBetween = (left, right) => Math.abs(Date.UTC(left.getUTCFullYear(), left.getUTCMonth(), left.getUTCDate()) - Date.UTC(right.getUTCFullYear(), right.getUTCMonth(), right.getUTCDate())) / 86400000;

function parseDate(value) {
  const raw = clean(value);
  let match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) return utcDate(match[1], match[2], match[3]);
  match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return utcDate(match[1], match[2], match[3]);
  match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) return utcDate(match[3], match[2], match[1]);
  throw new HttpError(400, 'INVALID_STATEMENT_DATE', `Data inválida no extrato: ${raw}.`);
}

function parseAmount(value) {
  const raw = clean(value).replace(/R\$/gi, '').replace(/\s/g, '');
  if (!raw) return 0;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/[^0-9.-]/g, '');
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) throw new HttpError(400, 'INVALID_STATEMENT_AMOUNT', `Valor inválido no extrato: ${value}.`);
  return Number(amount.toFixed(2));
}

function splitCsvLine(line, delimiter) {
  const result = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; } else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { result.push(value.trim()); value = ''; } else value += char;
  }
  result.push(value.trim()); return result;
}

function parseCsv(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new HttpError(400, 'INVALID_CSV', 'O CSV precisa ter cabeçalho e ao menos uma transação.');
  const headerLine = lines[0]; const delimiter = [';', ',', '\t'].sort((a, b) => headerLine.split(b).length - headerLine.split(a).length)[0];
  const headers = splitCsvLine(headerLine, delimiter).map(normalize);
  const locate = (...names) => headers.findIndex((header) => names.some((name) => header === name || header.includes(name)));
  const dateIndex = locate('data', 'date', 'dtposted'); const descriptionIndex = locate('descricao', 'descricao transacao', 'historico', 'description', 'memo', 'name');
  const amountIndex = locate('valor', 'amount', 'valor da transacao'); const debitIndex = locate('debito', 'debit', 'saidas'); const creditIndex = locate('credito', 'credit', 'entradas'); const balanceIndex = locate('saldo', 'balance'); const externalIdIndex = locate('id', 'fitid', 'identificador', 'documento');
  if (dateIndex < 0 || descriptionIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) throw new HttpError(400, 'INVALID_CSV_COLUMNS', 'O CSV deve conter data, descrição e valor (ou débito/crédito).');
  return lines.slice(1).map((line, index) => {
    const columns = splitCsvLine(line, delimiter); let amount = amountIndex >= 0 ? parseAmount(columns[amountIndex]) : 0;
    if (amountIndex < 0) amount = parseAmount(columns[creditIndex]) - Math.abs(parseAmount(columns[debitIndex]));
    return { date: parseDate(columns[dateIndex]), description: clean(columns[descriptionIndex]).slice(0, 500), amount, balance: balanceIndex >= 0 && columns[balanceIndex] ? parseAmount(columns[balanceIndex]) : null, externalId: externalIdIndex >= 0 ? clean(columns[externalIdIndex]).slice(0, 200) || null : null, row: index + 2 };
  }).filter((item) => item.description && item.amount);
}

function tag(block, name) { const found = block.match(new RegExp(`<${name}>\\s*([^<\\r\\n]+)`, 'i')); return found ? clean(found[1]) : ''; }
function parseOfx(content) {
  const blocks = content.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi) || [];
  if (!blocks.length) throw new HttpError(400, 'INVALID_OFX', 'Não encontramos transações no arquivo OFX.');
  return blocks.map((block, index) => {
    const type = tag(block, 'TRNTYPE'); const amount = parseAmount(tag(block, 'TRNAMT')); const signed = /^(DEBIT|PAYMENT|FEE|DIRECTDEBIT|CHECK)$/i.test(type) ? -Math.abs(amount) : amount;
    return { date: parseDate(tag(block, 'DTPOSTED')), description: clean(tag(block, 'NAME') || tag(block, 'MEMO') || type).slice(0, 500), amount: signed, balance: null, externalId: tag(block, 'FITID').slice(0, 200) || null, row: index + 1 };
  }).filter((item) => item.description && item.amount);
}

function parseStatement(fileName, content) {
  const extension = fileName.toLowerCase().split('.').pop();
  const records = extension === 'ofx' || /<OFX>/i.test(content) ? parseOfx(content) : parseCsv(content);
  if (!records.length) throw new HttpError(400, 'EMPTY_STATEMENT', 'Nenhuma transação válida foi encontrada no extrato.');
  if (records.length > MAX_TRANSACTIONS) throw new HttpError(400, 'STATEMENT_TOO_LARGE', `O limite é de ${MAX_TRANSACTIONS} transações por extrato.`);
  return records;
}

function fingerprint(item) { return crypto.createHash('sha256').update([item.externalId || '', item.date.toISOString().slice(0, 10), normalize(item.description), cents(item.amount)].join('|')).digest('hex'); }
function descriptionScore(bank, debt) {
  const bankWords = new Set(normalize(bank.description).split(/[^a-z0-9]+/).filter((word) => word.length > 2));
  const appWords = normalize(`${debt.counterparty} ${debt.description}`).split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  if (!appWords.length) return 0; const shared = appWords.filter((word) => bankWords.has(word)).length;
  return Math.min(20, Math.round((shared / Math.min(appWords.length, 4)) * 20));
}
function score(bank, debt) {
  const amountDiff = Math.abs(Math.abs(Number(bank.amount)) - (Number(debt.totalAmount) - Number(debt.paidAmount))); const dayDiff = daysBetween(bank.date, debt.dueDate);
  if (amountDiff >= 1 || dayDiff > 7) return 0;
  return (amountDiff < 0.01 ? 50 : 25) + (dayDiff <= 1 ? 30 : dayDiff <= 3 ? 20 : 10) + descriptionScore(bank, debt);
}
const statementInclude = { transactions: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }], include: { matchedDebt: { select: { id: true, type: true, description: true, counterparty: true, totalAmount: true, paidAmount: true, dueDate: true, status: true } } } } };

async function importStatement(userId, input) {
  const items = parseStatement(input.fileName, input.content);
  const unique = new Map(items.map((item) => [fingerprint(item), item]));
  const existing = await prisma.bankTransaction.findMany({ where: { userId, fingerprint: { in: [...unique.keys()] } }, select: { fingerprint: true } });
  const seen = new Set(existing.map((item) => item.fingerprint)); const records = [...unique.entries()].filter(([key]) => !seen.has(key));
  const statement = await prisma.$transaction(async (tx) => {
    const created = await tx.bankStatement.create({ data: { userId, fileName: input.fileName, accountName: input.accountName || null } });
    if (records.length) await tx.bankTransaction.createMany({ data: records.map(([key, item]) => ({ userId, statementId: created.id, externalId: item.externalId, fingerprint: key, date: item.date, description: item.description, amount: item.amount, balance: item.balance })) });
    return tx.bankStatement.findUnique({ where: { id: created.id }, include: statementInclude });
  });
  return { statement, imported: records.length, skipped: items.length - records.length };
}

async function matchStatement(userId, statementId) {
  const statement = await prisma.bankStatement.findFirst({ where: { id: statementId, userId }, include: { transactions: { where: { status: { in: ['PENDING', 'MATCHED'] } }, orderBy: { date: 'asc' } } } });
  if (!statement) throw new HttpError(404, 'STATEMENT_NOT_FOUND', 'Extrato não encontrado.');
  const debts = await prisma.debt.findMany({ where: { userId, isActive: true, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, orderBy: { dueDate: 'asc' } }); const used = new Set();
  await prisma.$transaction(statement.transactions.map((transaction) => {
    const direction = Number(transaction.amount) >= 0 ? 'RECEIVABLE' : 'PAYABLE';
    const candidates = debts.filter((debt) => debt.type === direction && !used.has(debt.id)).map((debt) => ({ debt, confidence: score(transaction, debt) })).filter((candidate) => candidate.confidence >= 35).sort((a, b) => b.confidence - a.confidence);
    const candidate = candidates[0]; if (candidate) used.add(candidate.debt.id);
    return prisma.bankTransaction.update({ where: { id: transaction.id }, data: candidate ? { matchedDebtId: candidate.debt.id, matchConfidence: candidate.confidence, status: 'MATCHED' } : { matchedDebtId: null, matchConfidence: null, status: 'PENDING' } });
  }));
  return getStatement(userId, statementId);
}

async function getStatement(userId, statementId) {
  const statement = await prisma.bankStatement.findFirst({ where: { id: statementId, userId }, include: statementInclude });
  if (!statement) throw new HttpError(404, 'STATEMENT_NOT_FOUND', 'Extrato não encontrado.'); return statement;
}
async function listStatements(userId) { return prisma.bankStatement.findMany({ where: { userId }, include: { _count: { select: { transactions: true } } }, orderBy: { importedAt: 'desc' } }); }

async function confirmDecisions(userId, input) {
  await getStatement(userId, input.statementId);
  return prisma.$transaction(async (tx) => {
    const applied = [];
    for (const decision of input.decisions) {
      const transaction = await tx.bankTransaction.findFirst({ where: { id: decision.transactionId, statementId: input.statementId, userId } });
      if (!transaction) throw new HttpError(404, 'BANK_TRANSACTION_NOT_FOUND', 'Transação bancária não encontrada.');
      if (['CONFIRMED', 'IGNORED', 'CREATED'].includes(transaction.status)) continue;
      if (decision.action === 'IGNORE') { await tx.bankTransaction.update({ where: { id: transaction.id }, data: { status: 'IGNORED', matchedDebtId: null, matchConfidence: null, confirmedAt: new Date() } }); applied.push({ id: transaction.id, action: decision.action }); continue; }
      if (decision.action === 'CONFIRM') {
        const debtId = decision.debtId || transaction.matchedDebtId; const debt = debtId ? await tx.debt.findFirst({ where: { id: debtId, userId }, select: { id: true } }) : null;
        if (!debt) throw new HttpError(400, 'MATCH_REQUIRED', 'Escolha uma conta do app antes de confirmar.');
        await tx.bankTransaction.update({ where: { id: transaction.id }, data: { status: 'CONFIRMED', matchedDebtId: debt.id, confirmedAt: new Date() } }); applied.push({ id: transaction.id, action: decision.action, debtId: debt.id }); continue;
      }
      const amount = Math.abs(Number(transaction.amount)); const type = Number(transaction.amount) >= 0 ? 'RECEIVABLE' : 'PAYABLE';
      const debt = await tx.debt.create({ data: { userId, type, paymentType: 'SINGLE', description: transaction.description, category: 'OTHER', counterparty: transaction.description, totalAmount: amount, paidAmount: amount, startDate: transaction.date, dueDate: transaction.date, status: 'PAID', isActive: false, paidAt: transaction.date } });
      await updateDailyCashFlow(tx, userId, type, amount, transaction.date);
      await syncBudgetForDebt(userId, debt, tx);
      await tx.bankTransaction.update({ where: { id: transaction.id }, data: { status: 'CREATED', matchedDebtId: debt.id, matchConfidence: 100, confirmedAt: new Date() } }); applied.push({ id: transaction.id, action: decision.action, debtId: debt.id });
    }
    return applied;
  });
}

module.exports = { parseStatement, fingerprint, importStatement, matchStatement, confirmDecisions, getStatement, listStatements, score };
