const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma, createTestUser, cleanup, syncService } = require('./helpers');

const ISO = '2026-09-01T00:00:00.000Z';

test('sync: push CREATE de debt grava a dívida mapeada e um SyncLog', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const description = `Teste sync ${user.id}`;
  const change = {
    id: 'local-debt-1',
    entity: 'debt',
    action: 'CREATE',
    recordId: 'local-debt-1',
    payload: {
      type: 'RECEIVABLE',
      paymentType: 'SINGLE',
      description,
      category: 'PRODUCT',
      counterparty: 'Maria',
      totalAmount: 100,
      dueDate: ISO,
      startDate: ISO,
    },
  };

  const result = await syncService.push(user.id, [change]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.applied, 1);
  assert.deepEqual(result.processedIds, ['local-debt-1']);

  const log = await prisma.syncLog.findFirst({ where: { userId: user.id } });
  assert.ok(log, 'um SyncLog deve ter sido gravado');
  assert.equal(log.entity, 'debt');
  assert.equal(log.recordId, 'local-debt-1');
  assert.equal(log.op, 'CREATE');

  const debt = await prisma.debt.findFirst({ where: { userId: user.id, description } });
  assert.ok(debt, 'a Debt deve ter sido criada no banco');
  assert.equal(Number(debt.totalAmount), 100);
  assert.equal(debt.status, 'PENDING');
  assert.equal(debt.type, 'RECEIVABLE');
  assert.equal(debt.paymentType, 'SINGLE');
  assert.equal(debt.category, 'PRODUCT');
  assert.equal(debt.counterparty, 'Maria');
});

test('sync: push CREATE de product deriva profitMargin', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const name = `Caneta teste ${user.id}`;
  const result = await syncService.push(user.id, [{
    id: 'local-prod-1',
    entity: 'product',
    action: 'CREATE',
    recordId: 'local-prod-1',
    payload: { name, costPrice: 2, sellingPrice: 5, stockQuantity: 10 },
  }]);

  assert.equal(result.applied, 1);
  assert.deepEqual(result.errors, []);

  const product = await prisma.product.findFirst({ where: { userId: user.id, name } });
  assert.ok(product, 'o product deve ter sido criado');
  assert.equal(Number(product.profitMargin), 60.0); // (5-2)/5 * 100
  assert.equal(product.stockQuantity, 10);
});

test('sync: push UPDATE de debt atualiza sem forçar defaults/enums', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const debt = await prisma.debt.create({
    data: {
      userId: user.id,
      type: 'PAYABLE',
      paymentType: 'INSTALLMENT',
      description: 'Descrição original',
      category: 'SERVICE',
      counterparty: 'Fornecedor',
      totalAmount: 300,
      startDate: new Date(ISO),
      dueDate: new Date(ISO),
      status: 'PAID',
    },
  });

  const result = await syncService.push(user.id, [{
    entity: 'debt',
    op: 'UPDATE',
    recordId: debt.id,
    payload: { description: 'Descrição atualizada', counterparty: 'João' },
  }]);
  assert.equal(result.applied, 1);
  assert.deepEqual(result.errors, []);

  const updated = await prisma.debt.findUnique({ where: { id: debt.id } });
  assert.equal(updated.description, 'Descrição atualizada');
  assert.equal(updated.counterparty, 'João');
  // em UPDATE o mapper NÃO injeta defaults: enums e valores não enviados
  // permanecem como estavam no registro.
  assert.equal(updated.status, 'PAID');
  assert.equal(updated.type, 'PAYABLE');
  assert.equal(updated.paymentType, 'INSTALLMENT');
  assert.equal(updated.category, 'SERVICE');
  assert.equal(Number(updated.totalAmount), 300);
});

test('sync: push com payload de debt incompleto vai para erros e não aplica', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const before = await prisma.debt.count({ where: { userId: user.id } });

  const result = await syncService.push(user.id, [{
    id: 'inv-1',
    entity: 'debt',
    action: 'CREATE',
    recordId: 'inv-1',
    payload: { type: 'RECEIVABLE' }, // faltam description, counterparty, totalAmount e as datas
  }]);

  assert.equal(result.applied, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].id, 'inv-1');
  assert.equal((await prisma.debt.count({ where: { userId: user.id } })), before, 'nenhuma Debt deve ser criada');
});

test('sync: pull retorna os SyncLogs gravados respeitando since', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const since = new Date(Date.now() - 1000).toISOString();

  await syncService.push(user.id, [{
    id: 'pull-1',
    entity: 'debt',
    action: 'CREATE',
    recordId: 'pull-1',
    payload: {
      type: 'RECEIVABLE',
      paymentType: 'SINGLE',
      description: `Pull ${user.id}`,
      category: 'OTHER',
      counterparty: 'Ana',
      totalAmount: 10,
      dueDate: ISO,
      startDate: ISO,
    },
  }]);

  const logs = await syncService.pull(user.id, since);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].entity, 'debt');
  assert.equal(logs[0].recordId, 'pull-1');
  assert.equal(logs[0].op, 'CREATE');
  assert.ok(logs[0].appliedAt instanceof Date);
});
