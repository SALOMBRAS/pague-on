const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../../src/utils/httpError');
const { prisma, createTestUser, cleanup } = require('./helpers');
const customerRegistration = require('../../src/services/customerRegistrationService');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const tokenOf = (invite) => invite.link.split('token=')[1];

async function createCustomer(user) {
  return prisma.customer.create({ data: { userId: user.id, name: `Cliente ${user.id}` } });
}

test('customerRegistration: createInvite cria convite com token e hash no banco', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const customer = await createCustomer(user);

  const invite = await customerRegistration.createInvite(user.id, customer.id, user.id);
  const token = tokenOf(invite);

  assert.ok(invite.id);
  assert.ok(token);
  // expira em ~7 dias
  const days = (new Date(invite.expiresAt) - new Date()) / (24 * 60 * 60 * 1000);
  assert.ok(days > 6.9 && days < 7.1);

  // só o hash do token fica no banco
  const row = await prisma.customerRegistrationInvite.findUnique({ where: { id: invite.id } });
  assert.equal(row.tokenHash, sha256(token));
  assert.notEqual(row.tokenHash, token);
});

test('customerRegistration: submit marca usado, sobrescreve o customer e invalida o token', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const customer = await createCustomer(user);
  const invite = await customerRegistration.createInvite(user.id, customer.id, user.id);
  const token = tokenOf(invite);

  const updated = await customerRegistration.submit(token, { name: 'Novo Nome', phone: '11999998888' });
  assert.equal(updated.id, customer.id, 'deve sobrescrever o mesmo customer');
  assert.equal(updated.name, 'Novo Nome');
  assert.equal(updated.status, 'PENDING_REVIEW');

  const row = await prisma.customerRegistrationInvite.findUnique({ where: { id: invite.id } });
  assert.ok(row.usedAt, 'invite deve ser marcado como usado');
  assert.ok(row.submittedAt);

  // token já usado → 410
  await assert.rejects(
    () => customerRegistration.submit(token, { name: 'De novo' }),
    (error) => error instanceof HttpError && error.status === 410 && error.code === 'REGISTRATION_LINK_INVALID',
  );
});

test('customerRegistration: revokeInvite invalida o convite', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const customer = await createCustomer(user);
  const invite = await customerRegistration.createInvite(user.id, customer.id, user.id);
  const token = tokenOf(invite);

  const result = await customerRegistration.revokeInvite(user.id, invite.id);
  assert.equal(result.revoked, true);

  await assert.rejects(
    () => customerRegistration.submit(token, { name: 'X' }),
    (error) => error instanceof HttpError && error.status === 410,
  );
});

test('customerRegistration: registerFailedAttempt revoga convite após MAX_ATTEMPTS tentativas', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const customer = await createCustomer(user);
  const invite = await customerRegistration.createInvite(user.id, customer.id, user.id);
  const token = tokenOf(invite);

  for (let i = 0; i < customerRegistration.MAX_ATTEMPTS; i += 1) {
    await customerRegistration.registerFailedAttempt(token);
  }
  const row = await prisma.customerRegistrationInvite.findUnique({ where: { id: invite.id } });
  assert.equal(row.attempts, customerRegistration.MAX_ATTEMPTS);
  assert.ok(row.revokedAt, 'convite deve ser revogado após o limite de tentativas');

  await assert.rejects(
    () => customerRegistration.submit(token, { name: 'X' }),
    (error) => error instanceof HttpError && error.status === 410,
  );
});

test('customerRegistration: details retorna o nome do cliente com o token válido', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const customer = await createCustomer(user);
  const invite = await customerRegistration.createInvite(user.id, customer.id, user.id);
  const token = tokenOf(invite);

  const result = await customerRegistration.details(token);
  assert.equal(result.customer.name, customer.name);
  assert.ok(result.expiresAt);
});