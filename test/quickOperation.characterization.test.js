const test = require('node:test');
const assert = require('node:assert/strict');

const { buildInstallments } = require('../src/services/debtService');
const { calculateSchedule } = require('../src/services/loanService');
const {
  customerCreateSchema,
  debtCreateSchema,
  installmentReceiptSchema,
  loanConfirmationSchema,
} = require('../src/utils/validators');

const customerId = '8adf1eb7-9a9d-4e88-83b6-51e2db0d72f6';
const accountId = '9e1c9a36-38d9-4f6f-a693-6fd1a5b87320';
const configurationId = '3cd3a0ef-913c-4ec8-a14d-5735ec6a1b40';

test('cadastro rápido de cliente mantém somente nome e telefone como dados iniciais suficientes', () => {
  assert.equal(customerCreateSchema.safeParse({ name: 'João da Silva' }).success, true);
  assert.equal(customerCreateSchema.safeParse({ name: 'João da Silva', phone: '11999999999' }).success, true);
  assert.equal(customerCreateSchema.safeParse({ name: 'J' }).success, false);
});

test('parcelamento divide centavos sem perder nem criar saldo', () => {
  const schedule = buildInstallments({
    totalAmount: 10,
    totalInstallments: 3,
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    frequency: 'MONTHLY',
  });

  assert.deepEqual(schedule.map((item) => item.amount), [3.33, 3.33, 3.34]);
  assert.equal(schedule.reduce((sum, item) => sum + item.amount, 0), 10);
});

test('quinzenal existente representa intervalo de catorze dias', () => {
  const schedule = buildInstallments({
    totalAmount: 300,
    totalInstallments: 3,
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    frequency: 'BIWEEKLY',
  });

  assert.deepEqual(schedule.map((item) => item.dueDate.toISOString().slice(0, 10)), ['2026-09-01', '2026-09-15', '2026-09-29']);
});

test('empréstimo exige divisão de caixa que concilie com o principal', () => {
  const input = {
    type: 'RECEIVABLE',
    paymentType: 'INSTALLMENT',
    description: 'Empréstimo rápido',
    category: 'LOAN',
    customerId,
    totalAmount: 1000,
    totalInstallments: 2,
    frequency: 'MONTHLY',
    startDate: '2026-09-01',
    cashAllocations: [{ accountId, amount: 1000 }],
  };

  assert.equal(debtCreateSchema.safeParse(input).success, true);
  assert.equal(debtCreateSchema.safeParse({ ...input, cashAllocations: [{ accountId, amount: 999.98 }] }).success, false);
});

test('confirmação de empréstimo continua exigindo consentimento contratual', () => {
  const input = {
    customerId,
    configurationId,
    modality: 'INSTALLMENT',
    principalAmount: 1000,
    totalInstallments: 2,
    frequency: 'MONTHLY',
    releaseDate: '2026-09-01',
    firstDueDate: '2026-09-15',
    cashAllocations: [{ accountId, amount: 1000 }],
  };

  assert.equal(loanConfirmationSchema.safeParse(input).success, false);
  assert.equal(loanConfirmationSchema.safeParse({ ...input, contractConsent: true }).success, true);
});

test('prévia Price e recebimento mantêm valores e caixa conciliáveis', () => {
  const simulation = calculateSchedule({
    modality: 'PRICE',
    principalAmount: 1000,
    interestRate: 2,
    totalInstallments: 3,
    frequency: 'MONTHLY',
    firstDueDate: '2026-09-15',
  }, { skipSundays: false, holidayDates: [] });

  assert.equal(simulation.totalPrincipal, 1000);
  assert.equal(simulation.schedule.reduce((sum, item) => sum + item.total, 0), simulation.totalCost);

  assert.equal(installmentReceiptSchema.safeParse({
    amount: 100,
    idempotencyKey: 'c0a80101-0000-4000-8000-000000000001',
    paymentMethod: 'PIX',
    cashAllocations: [{ accountId, amount: 100 }],
  }).success, true);
});
