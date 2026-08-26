const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../public/auth.js'), 'utf8');
const authControllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/authController.js'), 'utf8');

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

test('ausência de cookie de refresh é tratada como visitante sem sessão', () => {
  assert.match(authControllerSource, /if \(!token\) return sendSuccess\(res, null, 'Nenhuma sessão ativa para renovar\.'/);
  assert.match(source, /!result\.data\?\.token\) return false/);
});
