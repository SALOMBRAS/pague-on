const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDir = path.join(__dirname, '..', 'public');
const script = fs.readFileSync(path.join(publicDir, 'financial-settings.js'), 'utf8');
const css = fs.readFileSync(path.join(publicDir, 'financial-settings.css'), 'utf8');

test('financial settings workspace exposes versioned rules, templates and holidays', () => {
  assert.match(script, /Configurações financeiras/);
  assert.match(script, /\/loans\/settings/);
  assert.match(script, /\/loans\/settings\/holidays/);
  assert.match(script, /Justificativa/);
  assert.match(script, /Cada salvamento cria uma nova versão/);
  assert.match(script, /paymentAllocationOrder/);
  assert.match(script, /compoundInterestAllowed/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
