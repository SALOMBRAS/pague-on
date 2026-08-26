const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../public/auth.js'), 'utf8');

// Regressão: o handler de submit resolve o botão por querySelector('[type=submit]'),
// que casa com o ATRIBUTO — não com o type implícito de <button> dentro de <form>.
// Sem o atributo, submit era null e o clique morria num TypeError silencioso
// (login e cadastro não funcionavam, sem mensagem de erro na tela).
test('todo botão .auth-primary declara type="submit"', () => {
  const buttons = source.match(/<button class="auth-primary"[^>]*>/g) || [];
  assert.ok(buttons.length >= 4, `esperava os 4 botões primários, achei ${buttons.length}`);
  for (const button of buttons) {
    assert.match(button, /type="submit"/, `botão sem type="submit": ${button}`);
  }
});
