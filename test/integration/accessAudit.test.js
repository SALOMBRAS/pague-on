const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma, createTestUser, cleanup } = require('./helpers');
const audit = require('../../src/services/auditService');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

test('accessAudit: hash normaliza e faz hash SHA-256 do email', async () => {
  // normalização: trim + lowerCase, então o hash de " User@Ex.com " deve
  // igualar o hash direto de "user@ex.com"
  const expected = sha256('user@ex.com');
  assert.equal(audit.hash('  User@Ex.com  '), expected);
  assert.equal(audit.hash('user@ex.com'), expected);
  assert.equal(audit.hash(123), sha256('123')); // valores não-string são stringificados
  assert.equal(audit.hash(''), null); // vazio → null
  assert.equal(audit.hash(undefined), null);
});

test('accessAudit: sanitize remove campos sensíveis recursivamente', async () => {
  const payload = {
    contractId: 'abc',
    email: 'user@ex.com',
    user: {
      password: 'segredo',
      token: 'tok-123',
      apiSecret: 'x',
      authorization: 'Bearer y',
      name: 'João',
      nested: { cookies: 'a=b', ok: true },
    },
    list: [{ token: 't', age: 2 }],
    plain: 'mantido',
  };
  const clean = audit.sanitize(payload);

  assert.ok(clean.contractId, 'contractId');
  assert.equal(clean.email, 'user@ex.com');
  assert.equal(clean.plain, 'mantido');
  assert.equal(clean.user.name, 'João');
  assert.equal(clean.user.nested.ok, true);
  assert.equal(clean.list[0].age, 2);
  // campos sensíveis removidos em todos os níveis
  assert.ok(!('password' in clean.user));
  assert.ok(!('token' in clean.user));
  assert.ok(!('apiSecret' in clean.user));
  assert.ok(!('authorization' in clean.user));
  assert.ok(!('cookies' in clean.user.nested));
  assert.ok(!('token' in clean.list[0]));
});

test('accessAudit: record grava evento com actorEmailHash e payload sanitizado', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));

  await audit.record({
    eventType: 'member_created',
    actor: { id: user.id, email: '  Owner@Test.COM ' },
    workspaceOwnerId: user.id,
    targetId: user.id,
    targetType: 'user',
    targetEmail: 'owner@test.com',
    payload: { role: 'ADMIN', token: 'deve-ser-removido', password: 'x' },
  });

  const row = await prisma.auditLog.findFirst({ where: { workspaceOwnerId: user.id, eventType: 'member_created' } });
  assert.ok(row);
  assert.equal(row.actorEmailHash, sha256('owner@test.com'));
  assert.equal(row.targetEmailHash, sha256('owner@test.com'));
  assert.equal(row.actorId, user.id);
  assert.equal(row.payload.role, 'ADMIN');
  assert.ok(!('token' in row.payload));
  assert.ok(!('password' in row.payload));
});

test('accessAudit: evento não crítico não relança quando o insert falha', async () => {
  // workspaceOwnerId inexistente → FK violada no insert → evento não crítico
  // apenas loga e retorna undefined, sem relançar.
  const fakeWorkspace = crypto.randomUUID();
  const result = await audit.record({
    eventType: 'member_created',
    actor: { id: fakeWorkspace, email: 'x@x.com' },
    workspaceOwnerId: fakeWorkspace,
    payload: { a: 1 },
  });
  assert.equal(result, undefined);
});

test('accessAudit: evento crítico relança erro quando o insert falha', async () => {
  const fakeWorkspace = crypto.randomUUID();
  await assert.rejects(
    () => audit.record({
      eventType: 'loan_originated', // crítico
      actor: { id: fakeWorkspace, email: 'x@x.com' },
      workspaceOwnerId: fakeWorkspace,
      targetId: fakeWorkspace,
      payload: { a: 1 },
    }),
    (error) => error instanceof Error && /crítico/.test(error.message),
    'evento crítico deve relançar para abortar a operação',
  );
});