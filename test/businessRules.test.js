const test = require('node:test');
const assert = require('node:assert/strict');
const { addMonths, nextDueDate, recurringPeriod } = require('../src/utils/dateHelpers');
const { calculateProfitMargin } = require('../src/utils/calculateProfit');
const { debtCreateSchema, saleCreateSchema, statementImportSchema, pushSubscriptionSchema, dashboardQuerySchema, financialTransferSchema } = require('../src/utils/validators');
const { applyToDebtInput } = require('../src/services/ruleService');
const { parseStatement, score } = require('../src/services/reconciliationService');
const { effectiveLimit } = require('../src/services/budgetService');
const { buildInstallments } = require('../src/services/debtService');
const { calculateInterest } = require('../src/services/interestCalculator');
const { duplicateScore, similarity } = require('../src/services/duplicateService');
const { convertAmount } = require('../src/services/currencyService');
const { rangeFor } = require('../src/services/dashboardService');

test('preserva o último dia válido ao avançar meses', () => {
  const januaryThirtyFirst = new Date('2026-01-31T00:00:00.000Z');
  assert.equal(addMonths(januaryThirtyFirst, 1).toISOString(), '2026-02-28T00:00:00.000Z');
  assert.equal(nextDueDate(januaryThirtyFirst, 'QUARTERLY').toISOString(), '2026-04-30T00:00:00.000Z');
});

test('calcula margem de lucro no backend', () => {
  assert.equal(calculateProfitMargin(25, 55), 54.55);
  assert.equal(calculateProfitMargin(10, 0), 0);
});

test('exige frequência para uma dívida recorrente', () => {
  const baseDebt = {
    type: 'PAYABLE',
    paymentType: 'RECURRING',
    description: 'Aluguel',
    category: 'RENT',
    counterparty: 'Imobiliária',
    totalAmount: 1200,
    startDate: '2026-09-05T00:00:00.000Z',
  };
  assert.equal(debtCreateSchema.safeParse(baseDebt).success, false);
  assert.equal(debtCreateSchema.safeParse({ ...baseDebt, frequency: 'MONTHLY' }).success, true);
});

test('identifica períodos recorrentes trimestrais', () => {
  assert.equal(recurringPeriod(new Date('2026-08-05T00:00:00.000Z'), 'QUARTERLY'), '2026-Q3');
});

test('venda delega o preço total ao backend e exige pelo menos um item', () => {
  const validSale = {
    customerId: '8adf1eb7-9a9d-4e88-83b6-51e2db0d72f6',
    items: [{ productId: '9e1c9a36-38d9-4f6f-a693-6fd1a5b87320', quantity: 2 }],
    paymentType: 'INSTALLMENT',
    totalInstallments: 2,
  };
  assert.equal(saleCreateSchema.safeParse(validSale).success, true);
  assert.equal(saleCreateSchema.safeParse({ ...validSale, items: [] }).success, false);
});

test('aplica regra de transporte antes de persistir a dívida', async () => {
  const result = await applyToDebtInput('unused-user', {
    type: 'RECEIVABLE', paymentType: 'SINGLE', description: 'Uber para entrega', category: 'OTHER', counterparty: 'Motorista', totalAmount: 42, startDate: new Date(), tags: [],
  }, [{ id: 'rule-transport', name: 'Transporte', triggerLogic: 'ALL', triggers: [{ type: 'DESCRIPTION_CONTAINS', operator: 'CONTAINS', value: 'uber' }], actions: [{ type: 'SET_CATEGORY', value: 'TRANSPORT' }, { type: 'SET_TYPE', value: 'PAYABLE' }, { type: 'ADD_TAG', value: 'mobilidade' }] }]);
  assert.equal(result.input.category, 'TRANSPORT');
  assert.equal(result.input.type, 'PAYABLE');
  assert.deepEqual(result.input.tags, ['mobilidade']);
  assert.deepEqual(result.applications.map((item) => item.name), ['Transporte']);
});

test('importa CSV e OFX de extrato e prioriza valor/data exatos', () => {
  const csv = parseStatement('extrato.csv', 'Data;Descrição;Valor\n15/08/2026;Uber;250,00\n16/08/2026;Aluguel;-1200,00');
  const ofx = parseStatement('extrato.ofx', '<OFX><STMTTRN><TRNTYPE>DEBIT\n<DTPOSTED>20260815\n<TRNAMT>-89.90\n<FITID>fit-1\n<NAME>Spotify\n</STMTTRN></OFX>');
  assert.equal(csv.length, 2);
  assert.equal(ofx[0].amount, -89.9);
  assert.equal(score({ amount: -1200, date: new Date('2026-08-15T00:00:00.000Z'), description: 'Aluguel' }, { totalAmount: 1200, paidAmount: 0, dueDate: new Date('2026-08-15T00:00:00.000Z'), counterparty: 'Imobiliária', description: 'Aluguel' }), 90);
});

test('acumula apenas saldo positivo no orçamento com rollover', () => {
  assert.equal(effectiveLimit({ limitAmount: 600 }, { rollover: true, limitAmount: 300, spentAmount: 120 }), 780);
  assert.equal(effectiveLimit({ limitAmount: 600 }, { rollover: true, limitAmount: 300, spentAmount: 450 }), 600);
});

test('atribui alta pontuação a uma dívida duplicada', () => {
  const existing = { counterparty: 'João Silva', totalAmount: 250, dueDate: new Date('2026-08-25T00:00:00.000Z'), description: 'Venda de tênis' };
  const candidate = { counterparty: 'joão silva', totalAmount: 250, startDate: new Date('2026-08-25T00:00:00.000Z'), description: 'Venda de tenis' };
  assert.equal(similarity(existing.description, candidate.description) > 0.8, true);
  assert.equal(duplicateScore(existing, candidate).score, 100);
});

test('converte valores para BRL preservando a taxa usada', () => {
  assert.equal(convertAmount(10, 5.5), 55);
  assert.equal(convertAmount(0, 5.5), 0);
});

test('valida a confirmação de importação de extrato', () => {
  const imported = statementImportSchema.parse({ fileName: 'agosto.csv', transactions: [{ date: '2026-08-20', description: 'Uber', amount: -25 }] });
  assert.equal(imported.transactions[0].amount, -25);
  assert.equal(statementImportSchema.safeParse({ fileName: 'vazio.csv', transactions: [] }).success, false);
});

test('valida uma assinatura push por dispositivo', () => {
  const subscription = pushSubscriptionSchema.safeParse({ endpoint: 'https://push.example.test/subscription/123', expirationTime: null, keys: { p256dh: 'chave-publica-do-dispositivo', auth: 'segredo-auth' } });
  assert.equal(subscription.success, true);
  assert.equal(pushSubscriptionSchema.safeParse({ endpoint: 'inválido', keys: {} }).success, false);
});

test('gera parcelas semanais e mensais preservando o dia de vencimento', () => {
  const weekly = buildInstallments({ totalAmount: 300, totalInstallments: 3, startDate: new Date('2026-08-21T00:00:00.000Z'), frequency: 'WEEKLY' });
  const monthly = buildInstallments({ totalAmount: 300, totalInstallments: 3, startDate: new Date('2026-01-31T00:00:00.000Z'), frequency: 'MONTHLY' });
  assert.deepEqual(weekly.map((item) => item.dueDate.toISOString().slice(0, 10)), ['2026-08-21', '2026-08-28', '2026-09-04']);
  assert.deepEqual(monthly.map((item) => item.dueDate.toISOString().slice(0, 10)), ['2026-01-31', '2026-02-28', '2026-03-31']);
});

test('calcula juros diário e composto apenas para parcela vencida', () => {
  const installment = { amount: 100, dueDate: new Date('2026-08-10T00:00:00.000Z'), status: 'PENDING' };
  assert.deepEqual(calculateInterest(installment, { interestType: 'DAILY', interestRate: 2 }, new Date('2026-08-15T00:00:00.000Z')), { interestAmount: 10, daysOverdue: 5, totalAmount: 110, rateApplied: 2 });
  assert.equal(calculateInterest(installment, { interestType: 'COMPOUND', interestRate: 10 }, new Date('2026-08-10T00:00:00.000Z')).interestAmount, 0);
});

test('valida o período personalizado do dashboard no backend', () => {
  assert.equal(dashboardQuerySchema.safeParse({ period: 'CUSTOM', startDate: '2026-08-01', endDate: '2026-08-31' }).success, true);
  assert.equal(dashboardQuerySchema.safeParse({ period: 'CUSTOM', startDate: '2026-08-31', endDate: '2026-08-01' }).success, false);
  assert.equal(dashboardQuerySchema.safeParse({ period: 'CUSTOM', startDate: '2026-08-01' }).success, false);
  const range = rangeFor({ period: 'CUSTOM', startDate: '2026-08-01', endDate: '2026-08-31' });
  assert.equal(range.start.toISOString(), '2026-08-01T00:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-08-31T23:59:59.999Z');
});

test('valida divisão de empréstimo e transferência entre caixas', () => {
  const accountA = '8adf1eb7-9a9d-4e88-83b6-51e2db0d72f6'; const accountB = '9e1c9a36-38d9-4f6f-a693-6fd1a5b87320';
  const loan = { type: 'RECEIVABLE', paymentType: 'SINGLE', description: 'Empréstimo Ana', category: 'LOAN', counterparty: 'Ana', totalAmount: 1000, startDate: '2026-08-26', cashAllocations: [{ accountId: accountA, amount: 500 }, { accountId: accountB, amount: 500 }] };
  assert.equal(debtCreateSchema.safeParse(loan).success, true);
  assert.equal(debtCreateSchema.safeParse({ ...loan, cashAllocations: [{ accountId: accountA, amount: 700 }] }).success, false);
  assert.equal(financialTransferSchema.safeParse({ fromAccountId: accountA, toAccountId: accountB, amount: 200 }).success, true);
  assert.equal(financialTransferSchema.safeParse({ fromAccountId: accountA, toAccountId: accountA, amount: 200 }).success, false);
});
