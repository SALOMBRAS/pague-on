const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('link de cadastro de cliente aponta para uma página existente e segura', () => {
  const root = path.resolve(__dirname, '..');
  const page = fs.readFileSync(path.join(root, 'public', 'customer-registration.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public', 'customer-registration.js'), 'utf8');
  assert.match(page, /<script src="\/customer-registration\.js" defer><\/script>/);
  assert.match(script, /customer-registration\/\$\{encodeURIComponent\(token\)\}/);
  assert.match(script, /method: 'POST'/);
  assert.match(script, /textContent =/);
  assert.doesNotMatch(script, /innerHTML\s*=/);
});
