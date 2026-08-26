const test = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../../src/utils/httpError');
const { prisma, createTestUser, cleanup } = require('./helpers');
const loanService = require('../../src/services/loanService');
const financialAccountService = require('../../src/services/financialAccountService');

// Actor usado para originar empréstimos: ADMIN tem canOverrideRate e pode
// confirmar sem justificativa de taxa quando a taxa informada bate com a aprovada.
function actor(user) {
  return { id: user.id, email: user.email, role: 'ADMIN' };
}

async function seed(user) {
  const customer = await prisma.customer.create({
    data: {
      userId: user.id,
      name: `Cliente ${user.id}`,
      status: 'APPROVED',
      creditLimit: 5000,
      approvedInterestRate: 5,
    },
  });
  const account = await financialAccountService.createAccount(user.id, {
    name: 'Caixa empréstimos',
    type: 'CASH',
    openingBalance: 5000,
  });
  const configuration = await loanService.saveConfiguration(user.id, {
    modality: 'SIMPLE_INTEREST',
    displayName: 'Juros Simples 5%',
    formulaVersion: 'v1',
    legalReviewReference: 'LEG-001',
    skipSundays: false,
    holidayDates: [],
    isActive: true,
  });
  return { customer, account, configuration };
}

function loanInput(customer, configuration, account, overrides = {}) {
  return {
    customerId: customer.id,
    configurationId: configuration.id,
    modality: 'SIMPLE_INTEREST',
    principalAmount: 1000,
    interestRate: 5,
    totalInstallments: 2,
    frequency: 'MONTHLY',
    firstDueDate: '2030-01-10T00:00:00.000Z',
    releaseDate: new Date().toISOString(),
    cashAllocations: [{ accountId: account.id, amount: 1000 }],
    ...overrides,
  };
}

test('loans: saveConfiguration cria configuração e preenche formulaPolicy por padrão', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));

  const config = await loanService.saveConfiguration(user.id, {
    modality: 'INSTALLMENT',
    displayName: 'Parcelado',
    formulaVersion: 'v1',
    legalReviewReference: 'LEG-INST',
    isActive: true,
  });

  assert.ok(config.id);
  assert.equal(config.modality, 'INSTALLMENT');
  assert.match(config.formulaPolicy, /Principal distribuído sem juros/);

  // upsert: salvar novamente a mesma modalidade atualiza, não duplica
  const again = await loanService.saveConfiguration(user.id, {
    modality: 'INSTALLMENT',
    displayName: 'Parcelado atualizado',
    formulaVersion: 'v2',
    legalReviewReference: 'LEG-INST',
  });
  assert.equal(again.id, config.id);
  assert.equal(again.displayName, 'Parcelado atualizado');
  assert.equal(again.formulaVersion, 'v2');
});

test('loans: simulation calcula cronograma e devolve contraparte disponível', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { customer, configuration, account } = await seed(user);

  const result = await loanService.simulation(user.id, loanInput(customer, configuration, account));

  // 1000 @ 5% x 2 = 100 de juros → total 1100
  assert.equal(Number(result.totalPrincipal), 1000);
  assert.equal(Number(result.totalInterest), 100);
  assert.equal(Number(result.totalCost), 1100);
  assert.equal(result.schedule.length, 2);
  assert.equal(Number(result.customer.availableLimit), 5000);
  assert.match(result.contractPreview, /Principal: R\$ 1000\.00/);
});

test('loans: simulation bloqueia quando principal excede o limite disponível', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { customer, configuration, account } = await seed(user);

  await assert.rejects(
    () => loanService.simulation(user.id, loanInput(customer, configuration, account, { principalAmount: 6000 })),
    (error) => error instanceof HttpError && error.status === 409 && error.code === 'CREDIT_LIMIT_EXCEEDED',
    'principal acima do limite deve lançar HttpError 409 CREDIT_LIMIT_EXCEEDED',
  );
});

test('loans: confirm origina debt, parcelas, liberação, contrato e auditoria', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { customer, account, configuration } = await seed(user);

  const { debt, contract, preview } = await loanService.confirm(
    user.id,
    actor(user),
    loanInput(customer, configuration, account),
  );

  // debt com totais de SIMPLE_INTEREST
  assert.equal(debt.category, 'LOAN');
  assert.equal(debt.loanModality, 'SIMPLE_INTEREST');
  assert.equal(Number(debt.totalAmount), 1100);
  assert.equal(Number(debt.principalAmount), 1000);
  assert.equal(Number(debt.appliedInterestRate), 5);
  assert.equal(debt.totalInstallments, 2);
  assert.equal(debt.installments.length, 2);
  assert.equal(Number(debt.installments[0].amount), 500);
  assert.equal(Number(debt.installments[0].interestAmount), 50);
  assert.equal(Number(debt.installments[0].totalAmount), 550);

  // contrato gerado
  assert.ok(contract.id);
  assert.match(contract.contractNumber, /^EMP-/);
  assert.equal(contract.debtId, debt.id);

  // preview usado na origem
  assert.equal(Number(preview.totalCost), 1100);

  // liberação financeira lançada
  const movement = await prisma.financialMovement.findFirst({
    where: { userId: user.id, type: 'LOAN_DISBURSEMENT' },
  });
  assert.ok(movement, 'deve existir lançamento de LOAN_DISBURSEMENT');
  assert.equal(Number(movement.amount), 1000);
  assert.equal(movement.accountId, account.id);
  assert.equal(movement.debtId, debt.id);

  // auditoria de evento crítico gravada
  const audit = await prisma.auditLog.findFirst({
    where: { workspaceOwnerId: user.id, eventType: 'loan_originated' },
  });
  assert.ok(audit, 'deve existir evento de auditoria loan_originated');
  assert.equal(audit.targetId, debt.id);
  assert.equal(Number(audit.payload.principalAmount), 1000);
});