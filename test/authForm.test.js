const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../public/auth.js'), 'utf8');
const authControllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/authController.js'), 'utf8');
const appSource = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
const errorHandlerSource = fs.readFileSync(path.resolve(__dirname, '../src/middlewares/errorHandler.js'), 'utf8');

// Regressão: o handler de submit resolve o botão por querySelector('[type=submit]'),
// que casa com o ATRIBUTO — não com o type implícito de <button> dentro de <form>.
// Sem o atributo, submit era null e o clique morria num TypeError silencioso
// (login e cadastro não funcionavam, sem mensagem de erro na tela).
test('o gerador do botão principal declara type="submit"', () => {
  assert.match(source, /<button class="auth-primary" type="submit"/);
});

test('mantém a referência do formulário durante chamadas assíncronas', () => {
  assert.match(source, /const submittedForm = event\.currentTarget/);
  assert.match(source, /actionError\(submittedForm,/);
  assert.match(source, /element\?\.querySelector\('\.auth-error'\)/);
});

test('exibe conflitos de cadastro, bloqueia reenvio e anuncia o erro', () => {
  assert.match(source, /EMAIL_IN_USE: 'Este e-mail já está em uso/);
  assert.match(source, /PHONE_IN_USE: 'Este telefone já está em uso/);
  assert.match(source, /data-loading-label/);
  assert.match(source, /tabindex="-1"/);
  assert.match(source, /aria-invalid/);
});

test('cadastro concluído direciona a pessoa para o login, sem abrir sessão', () => {
  assert.match(source, /else if \(mode === 'register'\) show\('login', result\.message/);
  assert.match(authControllerSource, /sendSuccess\(res, \{ user \}, 'Conta criada com sucesso\. Entre com seu e-mail e senha para continuar\.'/);
  assert.doesNotMatch(authControllerSource, /async function register[^\n]*sendSession/);
});

test('ausência de cookie de refresh é tratada como visitante sem sessão', () => {
  assert.match(authControllerSource, /if \(!token\) return sendSuccess\(res, null, 'Nenhuma sessão ativa para renovar\.'/);
  assert.match(source, /!result\.data\?\.token\) return false/);
});

test('aceita apenas previews da Vercel pertencentes ao projeto', () => {
  assert.ok(appSource.includes('const vercelProjectOrigin = /^https:\\/\\/pague-on-git-'));
  assert.match(appSource, /vercelProjectOrigin\.test\(origin\)/);
  assert.match(appSource, /CORS_ORIGIN_FORBIDDEN/);
});

test('limitador global protege somente a API, não a tela de login', () => {
  assert.match(appSource, /app\.use\('\/api\/v1', rateLimit\(/);
  assert.doesNotMatch(appSource, /app\.use\(rateLimit\(/);
});

test('indisponibilidade do banco não expõe detalhes do Prisma na tela', () => {
  assert.match(errorHandlerSource, /ECIRCUITBREAKER\|authentication failures/i);
  assert.match(errorHandlerSource, /DATABASE_UNAVAILABLE/);
});

test('permite iniciar localmente com o ambiente seguro da Vercel', () => {
  assert.match(appSource, /DOTENV_CONFIG_PATH \|\| '\.env'/);
  assert.match(appSource, /override: Boolean\(process\.env\.DOTENV_CONFIG_PATH\)/);
});
