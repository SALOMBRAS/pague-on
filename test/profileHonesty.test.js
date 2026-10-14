const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('perfil não exibe controles que apenas simulam uma ação', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'views', 'perfil.js'), 'utf8');
  const rendered = source.match(/function renderProfile\(\)\{([\s\S]*?)\nfunction profileAction/)?.[1] || '';
  assert.doesNotMatch(rendered, /Fazer upgrade|Trocar senha|Alterar foto|Suporte \/ Fale conosco|Backup na nuvem|Canal de envio|Notificações push|Som de alerta/);
});
