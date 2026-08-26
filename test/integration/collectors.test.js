const test = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../../src/utils/httpError');
const { prisma, createTestUser, cleanup } = require('./helpers');
const collectorService = require('../../src/services/collectorService');

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createCollector(owner, overrides = {}) {
  return collectorService.createCollector(owner.id, {
    name: 'Cobrador',
    email: `cobrador-${unique()}@pagueon.test`,
    phone: '11999990000',
    password: 'secret123',
    isActive: true,
    commissionType: 'PERCENTAGE',
    commissionRate: 5,
    commissionBase: 'TOTAL',
    permissions: { registerContacts: true },
    ...overrides,
  });
}

// Cria uma debt + parcela mínimas para as FKs de CollectorCommission (Restrict).
async function seedDebt(owner, customer) {
  return prisma.debt.create({
    data: {
      userId: owner.id,
      type: 'RECEIVABLE',
      paymentType: 'INSTALLMENT',
      category: 'LOAN',
      description: 'Dívida de teste',
      counterparty: customer.name,
      customerId: customer.id,
      totalAmount: 200,
      principalAmount: 200,
      totalInstallments: 1,
      frequency: 'MONTHLY',
      startDate: new Date(),
      dueDate: new Date('2030-01-10T00:00:00.000Z'),
      installments: {
        create: [{ number: 1, amount: 200, totalAmount: 200, dueDate: new Date('2030-01-10T00:00:00.000Z'), interestRateAtCreation: 0 }],
      },
    },
    include: { installments: true },
  });
}

test('collectors: createCollector cria cobrador e atualiza perfil', async (t) => {
  const owner = await createTestUser();
  t.after(() => cleanup(owner.id));

  const collector = await createCollector(owner);

  assert.ok(collector.id);
  assert.equal(collector.isActive, true);
  assert.equal(collector.commissionType, 'PERCENTAGE');
  assert.equal(Number(collector.commissionRate), 5);
  assert.equal(collector.customerCount, 0);

  const list = await collectorService.listCollectors(owner.id);
  assert.ok(list.some((item) => item.id === collector.id));

  const updated = await collectorService.updateCollector(owner.id, collector.id, {
    commissionRate: 10,
    notes: 'chefe de carteira',
  });
  assert.equal(Number(updated.commissionRate), 10);
  assert.equal(updated.notes, 'chefe de carteira');
});

test('collectors: assignCustomers vincula clientes ao cobrador e valida contagem', async (t) => {
  const owner = await createTestUser();
  t.after(() => cleanup(owner.id));
  const collector = await createCollector(owner);

  const c1 = await prisma.customer.create({ data: { userId: owner.id, name: 'Cliente A' } });
  const c2 = await prisma.customer.create({ data: { userId: owner.id, name: 'Cliente B' } });

  const result = await collectorService.assignCustomers(owner.id, collector.id, [c1.id, c2.id]);
  assert.equal(result.assignedCustomerCount, 2);
  const assigned = await collectorService.essentialCustomers(owner.id, collector.id);
  assert.equal(assigned.length, 2);

  // re-atribuir lista menor desvincula os que saíram
  await collectorService.assignCustomers(owner.id, collector.id, [c1.id]);
  const assigned2 = await collectorService.essentialCustomers(owner.id, collector.id);
  assert.equal(assigned2.length, 1);
  assert.equal(assigned2[0].id, c1.id);

  // atribuir cliente de outro espaço lança 404
  const otherUser = await createTestUser();
  t.after(() => cleanup(otherUser.id));
  const otherCustomer = await prisma.customer.create({ data: { userId: otherUser.id, name: 'Outro espaço' } });
  await assert.rejects(
    () => collectorService.assignCustomers(owner.id, collector.id, [otherCustomer.id]),
    (error) => error instanceof HttpError && error.status === 404 && error.code === 'CUSTOMER_NOT_FOUND',
  );
});

test('collectors: recordCommission grava comissão percentual e commissionReport consolida', async (t) => {
  const owner = await createTestUser();
  t.after(() => cleanup(owner.id));
  const collector = await createCollector(owner, { commissionType: 'PERCENTAGE', commissionRate: 10, commissionBase: 'TOTAL' });
  const customer = await prisma.customer.create({ data: { userId: owner.id, name: 'Cliente Comissão' } });
  const debt = await seedDebt(owner, customer);

  await prisma.$transaction((tx) =>
    collectorService.recordCommission(tx, {
      workspaceOwnerId: owner.id,
      collectorId: collector.id,
      customerId: customer.id,
      debtId: debt.id,
      installmentId: debt.installments[0].id,
      paymentAmount: 200,
      principal: 200,
      interest: 0,
      penalty: 0,
    }),
  );

  const report = await collectorService.commissionReport(owner.id, collector.id);
  assert.equal(report.entries.length, 1);
  assert.equal(Number(report.totals.paymentAmount), 200);
  assert.equal(Number(report.totals.commissionAmount), 20); // 10% de 200
  assert.equal(Number(report.totals.reversedAmount), 0);

  // estorno de comissões da parcela marca como REVERSED
  await prisma.$transaction((tx) => collectorService.reverseCommissionsForInstallment(tx, debt.installments[0].id, 'estorno de teste'));
  const report2 = await collectorService.commissionReport(owner.id, collector.id);
  assert.equal(report2.entries[0].status, 'REVERSED');
  assert.equal(Number(report2.totals.reversedAmount), 20);
});

test('collectors: calculateCommission de tipo FIXO ignora o montante pago', async (t) => {
  const owner = await createTestUser();
  t.after(() => cleanup(owner.id));
  const collector = await createCollector(owner, { commissionType: 'FIXED', commissionRate: 15, commissionBase: 'TOTAL' });

  assert.equal(collector.commissionType, 'FIXED');
  assert.equal(Number(collector.commissionRate), 15);

  const calc = collectorService.calculateCommission({
    commissionType: 'FIXED',
    commissionRate: 15,
    commissionBase: 'TOTAL',
    paymentAmount: 200,
  });
  assert.equal(Number(calc.commissionAmount), 15); // fixa não depende do montante
});

test('collectors: commissionReport não grava comissão sem collector ativo/vinculado', async (t) => {
  const owner = await createTestUser();
  t.after(() => cleanup(owner.id));
  const customer = await prisma.customer.create({ data: { userId: owner.id, name: 'Cliente sem cobrador' } });
  const debt = await seedDebt(owner, customer);

  // sem collectorId → retorna null (não cria registro)
  const created = await prisma.$transaction((tx) =>
    collectorService.recordCommission(tx, {
      workspaceOwnerId: owner.id,
      collectorId: null,
      customerId: customer.id,
      debtId: debt.id,
      installmentId: debt.installments[0].id,
      paymentAmount: 200,
    }),
  );
  assert.equal(created, null);
});