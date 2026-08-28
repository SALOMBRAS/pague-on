const test = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../../src/utils/httpError');
const authService = require('../../src/services/authService');
const { prisma, createTestUser, cleanup } = require('./helpers');

test('authRefresh: rotação gera nova sessão e reuso do token revogado revoga a família', async (t) => {
  const email = `refresh-${Date.now()}@pagueon.test`;
  const created = await authService.register({ name: 'Refresh Test', email, password: 'senha-segura-123' });
  t.after(() => cleanup(created.id));

  // login gera uma sessão com refreshToken
  const session = await authService.login({ identity: email, password: 'senha-segura-123' });
  assert.ok(session.refreshToken);
  assert.equal(session.user.id, created.id);
  const beforeVersion = (await prisma.user.findUnique({ where: { id: created.id } })).sessionVersion;

  // 1ª refresh: rotação normal (consuma o token, emite outro)
  const renewed = await authService.refresh(session.refreshToken);
  assert.ok(renewed.refreshToken);
  assert.notEqual(renewed.refreshToken, session.refreshToken);

  // reuso do MESMO token (já revogado) = comprometimento → revoga a família e invalida session.
  await assert.rejects(
    () => authService.refresh(session.refreshToken),
    (error) => error instanceof HttpError && error.status === 401 && error.code === 'INVALID_REFRESH_TOKEN',
  );

  // sessionVersion incrementou (access token antigo inválido) e família inteira revogada
  const after = await prisma.user.findUnique({ where: { id: created.id } });
  assert.ok(after.sessionVersion > beforeVersion, 'sessionVersion deve incrementar no reuso');

  const activeTokens = await prisma.refreshToken.count({ where: { userId: created.id, revokedAt: null } });
  assert.equal(activeTokens, 0, 'reuso deve revogar todos os refresh tokens ativos');
});
