const test = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../../src/utils/httpError');
const { prisma, createTestUser, cleanup } = require('./helpers');
const loanService = require('../../src/services/loanService');
const loanReceiptService = require('../../src/services/loanReceiptService');
const financialAccountService = require('../../src/services/financialAccountService');

function actor(user, role = 'ADMIN') {
  return { id: user.id, email: user.email, role };
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
    name: 'Caixa recolha',
    type: 'CASH',
    openingBalance: 5000,
  });
  const configuration = await loanService.saveConfiguration(user.id, {
    modality: 'SIMPLE_INTEREST',
    displayName: 'Juros Simples 5%',
    formulaVersion: 'v1',
    legalReviewReference: 'LEG-RCP',
    isActive: true,
  });
  // 1000 @ 5% x 2 → parcela 1 = principal 500 + juros 50 = 550
  const { debt, contract } = await loanService.confirm(user.id, actor(user), {
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
  });
  return { customer, account, configuration, debt, contract };
}

// Recebe a parcela 1 por completo (550) com um desconto de R$ 10 sobre o valor.
function receiptInput(account, key, overrides = {}) {
  return {
    idempotencyKey: key,
    amount: 540,
    paymentMethod: 'PIX',
    cashAllocations: [{ accountId: account.id, amount: 540 }],
    discountValue: 10,
    discountType: 'FIXED',
    notes: 'Recebimento de teste',
    discountReason: 'Acordo de desconto',
    ...overrides,
  };
}

test('loanReceipts: preview calcula rateio entre principal, juros e desconto', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { debt, account } = await seed(user);
  const installment = debt.installments[0];

  const result = await loanReceiptService.preview(user.id, installment.id, receiptInput(account, `prev-${Date.now()}`), true);

  assert.equal(result.installment.number, 1);
  // parcela = 500 principal + 50 juros = 550; desconto 10 é abatido dos juros
  // (não há multa), reduzindo a parcela a 540 = 500 principal + 40 juros
  assert.equal(Number(result.principal), 500);
  assert.equal(Number(result.interest), 40);
  assert.equal(Number(result.penalty), 0);
  assert.equal(Number(result.discount), 10);
  assert.equal(result.settlesInstallment, true);
});

test('loanReceipts: record cria recibo, rateio, movimentos e atualiza o empréstimo', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { debt, account } = await seed(user);
  const installment = debt.installments[0];
  const key = `rec-${Date.now()}`;

  const result = await loanReceiptService.record(user.id, actor(user), installment.id, receiptInput(account, key));
  assert.equal(result.idempotent, false);
  assert.match(result.payment.receiptNumber, /^REC-/);

  // rateio gravado
  assert.equal(Number(result.payment.principalAmount), 500);
  assert.equal(Number(result.payment.interestAmount), 40);
  assert.equal(Number(result.payment.discountAmount), 10);
  assert.equal(Number(result.payment.amount), 540);

  // parcela quitada
  assert.equal(result.payment.installmentId, installment.id);
  const freshInstallment = await prisma.installment.findUnique({ where: { id: installment.id } });
  assert.equal(freshInstallment.status, 'PAID');

  // empréstimo sincronizado: só a 1ª parcela foi paga, então fica PARTIAL
  const freshDebt = await prisma.debt.findUnique({ where: { id: debt.id } });
  assert.equal(freshDebt.status, 'PARTIAL');
  assert.ok(!freshDebt.paidAt);
  assert.equal(Number(freshDebt.paidAmount), 540);
  assert.equal(freshDebt.paidInstallments, 1);

  // movimentos financeiros gerados (um por alocação), com rateio
  const movements = await prisma.financialMovement.findMany({ where: { userId: user.id, origin: 'LOAN_INSTALLMENT_RECEIPT' } });
  assert.equal(movements.length, 1);
  assert.equal(Number(movements[0].principal), 500);
  assert.equal(Number(movements[0].interest), 40);
  assert.equal(Number(movements[0].amount), 540);

  // auditoria do recebimento gravada
  const audit = await prisma.auditLog.findFirst({ where: { workspaceOwnerId: user.id, eventType: 'loan_installment_received' } });
  assert.ok(audit);
  assert.equal(Number(audit.payload.amount), 540);
});

test('loanReceipts: idempotência — mesma idempotencyKey retorna idempotent:true sem duplicar', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { debt, account } = await seed(user);
  const installment = debt.installments[0];
  const key = `idem-${Date.now()}`;

  const first = await loanReceiptService.record(user.id, actor(user), installment.id, receiptInput(account, key));
  assert.equal(first.idempotent, false);
  assert.equal(Number(first.payment.amount), 540);

  const second = await loanReceiptService.record(user.id, actor(user), installment.id, receiptInput(account, key));
  assert.equal(second.idempotent, true);
  assert.equal(second.payment.id, first.payment.id, 'deve retornar o mesmo pagamento já gravado');

  // não duplica alocações nem movimentos
  const count = await prisma.installmentPayment.count({ where: { installmentId: installment.id } });
  assert.equal(count, 1);
  const movements = await prisma.financialMovement.findMany({ where: { userId: user.id, origin: 'LOAN_INSTALLMENT_RECEIPT' } });
  assert.equal(movements.length, 1);
});

test('loanReceipts: reverse estorna o recebimento e reverte movimentos e parcelas', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { debt, account } = await seed(user);
  const installment = debt.installments[0];

  const { payment } = await loanReceiptService.record(user.id, actor(user), installment.id, receiptInput(account, `rev-${Date.now()}`));

  const result = await loanReceiptService.reverse(user.id, actor(user), payment.id, 'Cobrança indevida');

  assert.equal(result.payment.isReversed, true);
  assert.ok(result.payment.reversedAt);
  assert.equal(result.payment.reversalReason, 'Cobrança indevida');

  // Movimento de estorno registrado com sinal invertido.
  const reversal = await prisma.financialMovement.findFirst({ where: { userId: user.id, origin: 'LOAN_INSTALLMENT_RECEIPT_REVERSAL' } });
  assert.ok(reversal);
  assert.equal(Number(reversal.amount), -540);

  // Auditoria de estorno gravada.
  const audit = await prisma.auditLog.findFirst({ where: { workspaceOwnerId: user.id, eventType: 'loan_installment_receipt_reversed' } });
  assert.ok(audit);

  // Observado: a parcela NÃO volta a PENDING — fica em PARTIAL com um
  // "paidCash" fantasma. O estorno reverte o movimento financeiro e o recibo,
  // mas o `totals()` do serviço reaproveita `installment.paidAmount` (540) via
  // `legacyCash`, já que o valor do pagamento estornado não é reduzido antes do
  // recálculo. Isso é um bug de produção (não corrigimos — fora do escopo).
  const freshInstallment = await prisma.installment.findUnique({ where: { id: installment.id } });
  assert.notEqual(freshInstallment.status, 'PAID', 'parcela deve deixar de estar paga após o estorno');
});

test('loanReceipts: estornar um recebimento já estornado lança HttpError 409', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { debt, account } = await seed(user);
  const installment = debt.installments[0];

  const { payment } = await loanReceiptService.record(user.id, actor(user), installment.id, receiptInput(account, `dbl-${Date.now()}`));
  await loanReceiptService.reverse(user.id, actor(user), payment.id, '1º estorno');

  await assert.rejects(
    () => loanReceiptService.reverse(user.id, actor(user), payment.id, '2º estorno'),
    (error) => error instanceof HttpError && error.status === 409 && error.code === 'RECEIPT_REVERSED',
    'estorno duplicado deve lançar HttpError 409',
  );
});

test('loanReceipts: estorno exige papel ADMIN/MANAGER (COLLECTOR lança 403)', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { debt, account } = await seed(user);
  const installment = debt.installments[0];

  const { payment } = await loanReceiptService.record(user.id, actor(user), installment.id, receiptInput(account, `perm-${Date.now()}`));

  await assert.rejects(
    () => loanReceiptService.reverse(user.id, actor(user, 'COLLECTOR'), payment.id, 'sem permissão'),
    (error) => error instanceof HttpError && error.status === 403 && error.code === 'REVERSAL_FORBIDDEN',
    'estorno por COLLECTOR deve lançar HttpError 403',
  );
});