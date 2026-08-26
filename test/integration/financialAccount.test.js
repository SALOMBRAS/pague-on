const test = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../../src/utils/httpError');
const { prisma, createTestUser, cleanup } = require('./helpers');
const financialAccountService = require('../../src/services/financialAccountService');

test('financialAccount: createAccount e transfer entre contas credita/dedita saldos', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));

  const origin = await financialAccountService.createAccount(user.id, { name: 'Caixa A', type: 'CASH', openingBalance: 1000 });
  const target = await financialAccountService.createAccount(user.id, { name: 'Banco B', type: 'BANK', openingBalance: 0 });

  const { operationId, debit, credit } = await financialAccountService.transfer(user.id, {
    fromAccountId: origin.id,
    toAccountId: target.id,
    amount: 250,
  });

  assert.equal(debit.type, 'TRANSFER_OUT');
  assert.equal(Number(debit.amount), 250);
  assert.equal(credit.type, 'TRANSFER_IN');
  assert.equal(Number(credit.amount), 250);
  assert.equal(debit.accountId, origin.id);
  assert.equal(credit.accountId, target.id);

  // saldos refletem a transferência
  const balanceOrigin = await prisma.financialAccount.findUnique({ where: { id: origin.id } });
  const balanceTarget = await prisma.financialAccount.findUnique({ where: { id: target.id } });
  assert.equal(Number(balanceOrigin.openingBalance), 1000);
  assert.equal(Number(balanceTarget.openingBalance), 0);

  const movements = await prisma.financialMovement.findMany({ where: { userId: user.id, operationId } });
  assert.equal(movements.length, 2);

  // statement consolida o extrato com balanceAfter
  const statement = await financialAccountService.statement(user.id);
  const originRows = statement.rows.filter((row) => row.accountId === origin.id);
  const targetRows = statement.rows.filter((row) => row.accountId === target.id);
  assert.equal(Number(originRows[0].balanceAfter), 750);
  assert.equal(Number(targetRows[0].balanceAfter), 250);
});

test('financialAccount: transfer entre a mesma conta lança HttpError 400', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const account = await financialAccountService.createAccount(user.id, { name: 'Caixa', type: 'CASH' });

  await assert.rejects(
    () => financialAccountService.transfer(user.id, { fromAccountId: account.id, toAccountId: account.id, amount: 100 }),
    (error) => error instanceof HttpError && error.status === 400 && error.code === 'SAME_FINANCIAL_ACCOUNT',
  );
});

test('financialAccount: adjustment compensatório altera o saldo de forma auditável', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const account = await financialAccountService.createAccount(user.id, { name: 'Caixa', type: 'CASH', openingBalance: 100 });

  // débito (saída) de 30
  const out = await financialAccountService.adjustment(user.id, {
    accountId: account.id,
    direction: 'DEBIT',
    amount: 30,
    reason: 'Ajuste de saída',
  });
  assert.equal(out.type, 'ADJUSTMENT');
  assert.equal(Number(out.amount), -30);
  assert.equal(out.origin, 'COMPENSATING_ADJUSTMENT');

  // crédito (entrada) de 15,1
  await financialAccountService.adjustment(user.id, {
    accountId: account.id,
    direction: 'CREDIT',
    amount: 15.1,
    reason: 'Ajuste de entrada',
  });

  const statement = await financialAccountService.statement(user.id, { accountId: account.id });
  assert.equal(statement.rows.length, 2);
  const lastBalance = statement.rows[statement.rows.length - 1].balanceAfter;
  assert.equal(Number(lastBalance), 85.1);
});

test('financialAccount: reverseMovement estorna um lançamento e bloqueia segundo estorno', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const account = await financialAccountService.createAccount(user.id, { name: 'Caixa', type: 'CASH', openingBalance: 100 });

  const adjusted = await financialAccountService.adjustment(user.id, { accountId: account.id, direction: 'DEBIT', amount: 40, reason: 'Saída' });
  const reversal = await financialAccountService.reverseMovement(user.id, adjusted.id, 'correção');
  assert.equal(reversal.type, 'REVERSAL');
  assert.equal(Number(reversal.amount), 40);
  assert.equal(reversal.reversalOfId, adjusted.id);
  assert.notEqual(reversal.id, adjusted.id);

  // segundo estorno do mesmo lançamento lança 409
  await assert.rejects(
    () => financialAccountService.reverseMovement(user.id, adjusted.id, 'de novo'),
    (error) => error instanceof HttpError && error.status === 409 && error.code === 'FINANCIAL_MOVEMENT_REVERSED',
  );

  // net: 100 - 40 + 40 = 100
  const statement = await financialAccountService.statement(user.id, { accountId: account.id });
  const lastBalance = statement.rows[statement.rows.length - 1].balanceAfter;
  assert.equal(Number(lastBalance), 100);
});

test('financialAccount: closeAccount calcula ledgerBalance e o período fechado bloqueia lançamento', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const account = await financialAccountService.createAccount(user.id, { name: 'Caixa', type: 'CASH', openingBalance: 100 });
  const occurredAt = new Date('2030-06-10T12:00:00.000Z');

  // lançamento de entrada no dia do fechamento
  await financialAccountService.recordMovement({
    userId: user.id,
    accountId: account.id,
    type: 'PAYMENT_RECEIVED',
    amount: 50,
    occurredAt,
    referenceId: `fm-prev-${account.id}`,
    description: 'Entrada antes do fechamento',
  });

  // fecha o caixa em 2030-06-10 com contagem=160 e contagem a conferir=150
  const closing = await financialAccountService.closeAccount(user.id, {
    accountId: account.id,
    closedThrough: '2030-06-10',
    countedBalance: 160,
  });
  assert.equal(Number(closing.ledgerBalance), 150); // 100 inicial + 50 entrada
  assert.equal(Number(closing.countedBalance), 160);
  assert.equal(Number(closing.difference), 10);

  // lançamento dentro do período fechado é bloqueado
  await assert.rejects(
    () => financialAccountService.recordMovement({
      userId: user.id,
      accountId: account.id,
      type: 'EXPENSE_PAID',
      amount: 20,
      occurredAt: new Date('2030-06-10T18:00:00.000Z'), // mesmo dia, já fechado
      referenceId: `fm-fechado-${account.id}`,
      description: 'Não pode entrar',
    }),
    (error) => error instanceof HttpError && error.status === 409 && error.code === 'FINANCIAL_PERIOD_CLOSED',
  );

  // lançamento em data posterior ao fechamento é aceito
  const later = await financialAccountService.recordMovement({
    userId: user.id,
    accountId: account.id,
    type: 'PAYMENT_RECEIVED',
    amount: 10,
    occurredAt: new Date('2030-06-11T12:00:00.000Z'),
    referenceId: `fm-depois-${account.id}`,
    description: 'Entrada no dia seguinte',
  });
  assert.ok(later.id);
});

test('financialAccount: recordMovement com referenceId duplicado lança HttpError 409', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const account = await financialAccountService.createAccount(user.id, { name: 'Caixa', type: 'CASH' });
  const args = {
    userId: user.id,
    accountId: account.id,
    type: 'PAYMENT_RECEIVED',
    amount: 10,
    referenceId: `dup-${account.id}`,
    description: 'referência única',
  };
  await financialAccountService.recordMovement(args);
  await assert.rejects(
    () => financialAccountService.recordMovement(args),
    (error) => error instanceof HttpError && error.status === 409 && error.code === 'DUPLICATE_REFERENCE',
  );
});