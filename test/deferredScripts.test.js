const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('scripts do painel não bloqueiam a construção inicial do documento', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const bodyScripts = html.slice(html.indexOf('<body'));
  const scripts = [...bodyScripts.matchAll(/<script src="([^"]+)"([^>]*)><\/script>/g)];
  assert.ok(scripts.length >= 30);
  assert.ok(scripts.every(([, , attributes]) => /\bdefer\b/.test(attributes)));
});
