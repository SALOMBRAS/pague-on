const test = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../../src/utils/httpError');
const { prisma, createTestUser, cleanup, goalService } = require('./helpers');

test('goals: CRUD básico (create/get/list, update, remove)', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));

  const created = await goalService.createGoal(user.id, { name: 'Viagem', targetAmount: 1000, icon: '✈️', color: '#123456' });
  assert.ok(created.id);
  assert.equal(created.name, 'Viagem');
  assert.equal(Number(created.targetAmount), 1000);
  assert.equal(created.currentAmount, 0);
  assert.equal(created.progress, 0);

  const list = await goalService.listGoals(user.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, created.id);

  const updated = await goalService.updateGoal(user.id, created.id, { name: 'Viagem 2027', targetAmount: 2000 });
  assert.equal(updated.name, 'Viagem 2027');
  assert.equal(Number(updated.targetAmount), 2000);

  const removed = await goalService.removeGoal(user.id, created.id);
  assert.equal(removed.id, created.id);
  assert.equal((await goalService.listGoals(user.id)).length, 0);
});

test('goals: deposit/withdraw atualizam saldo e gravam transações; saque maior que saldo lança 400', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const goal = await goalService.createGoal(user.id, { name: 'Reserva', targetAmount: 500 });

  const afterDeposit = await goalService.deposit(user.id, goal.id, 200, 'primeiro aporte');
  assert.equal(afterDeposit.currentAmount, 200);
  await goalService.deposit(user.id, goal.id, 100);

  const txs = await prisma.goalTransaction.findMany({ where: { goalId: goal.id }, orderBy: { createdAt: 'asc' } });
  assert.equal(txs.length, 2);
  assert.equal(txs[0].type, 'DEPOSIT');
  assert.equal(Number(txs[0].amount), 200);
  assert.equal(txs[0].note, 'primeiro aporte');

  const afterWithdraw = await goalService.withdraw(user.id, goal.id, 150, 'resgate');
  assert.equal(afterWithdraw.currentAmount, 150);

  await assert.rejects(
    () => goalService.withdraw(user.id, goal.id, 500),
    (error) => error instanceof HttpError && error.status === 400 && error.code === 'INSUFFICIENT_BALANCE',
    'saque acima do saldo deve lançar HttpError 400 INSUFFICIENT_BALANCE',
  );

  const txs2 = await prisma.goalTransaction.findMany({ where: { goalId: goal.id } });
  assert.ok(txs2.some((tx) => tx.type === 'WITHDRAW'));
});

test('goals: atinge a meta e cria notificação GOAL_REACHED (sem duplicar)', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const goal = await goalService.createGoal(user.id, { name: 'Meta', targetAmount: 100 });

  const reached = await goalService.deposit(user.id, goal.id, 100);
  assert.equal(reached.currentAmount, 100);

  const notif = await prisma.notification.findFirst({ where: { userId: user.id, type: 'GOAL_REACHED' } });
  assert.ok(notif, 'deveria criar uma Notification tipo GOAL_REACHED');
  assert.equal(notif.data.goalId, goal.id);

  // depositar novamente (ainda >= alvo) não deve criar outra notificação
  await goalService.deposit(user.id, goal.id, 10);
  const count = await prisma.notification.count({ where: { userId: user.id, type: 'GOAL_REACHED' } });
  assert.equal(count, 1);
});

test('goals: limite de 3 cofrinhos no plano FREE; PRO não bloqueia', async (t) => {
  const freeUser = await createTestUser({ plan: 'FREE' });
  const proUser = await createTestUser({ plan: 'PRO' });
  t.after(() => cleanup(freeUser.id));
  t.after(() => cleanup(proUser.id));

  for (let i = 1; i <= 3; i += 1) {
    await goalService.createGoal(freeUser.id, { name: `Meta ${i}`, targetAmount: 100 });
  }
  await assert.rejects(
    () => goalService.createGoal(freeUser.id, { name: 'Meta 4', targetAmount: 100 }),
    (error) => error instanceof HttpError && error.status === 403 && error.code === 'FREE_GOAL_LIMIT',
    'a 4ª meta do plano FREE deve lançar HttpError 403 FREE_GOAL_LIMIT',
  );
  assert.equal((await goalService.listGoals(freeUser.id)).length, 3);

  // usuário PRO separado não herda o limite do FREE
  for (let i = 1; i <= 4; i += 1) {
    await goalService.createGoal(proUser.id, { name: `Pro ${i}`, targetAmount: 100 });
  }
  assert.equal((await goalService.listGoals(proUser.id)).length, 4);
});

test('goals: withProgress calcula progress e remaining corretos', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const goal = await goalService.createGoal(user.id, { name: 'Meta', targetAmount: 200, targetDate: '2030-12-31' });

  const parcial = await goalService.deposit(user.id, goal.id, 50);
  assert.equal(parcial.progress, 25);
  assert.equal(parcial.remaining, 150);

  const list = await goalService.listGoals(user.id);
  assert.equal(list[0].progress, 25);
  assert.equal(list[0].remaining, 150);
});
