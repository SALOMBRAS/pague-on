const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'public');
const wealth = fs.readFileSync(path.join(root, 'networth.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'wealth-overview.css'), 'utf8');

test('patrimônio prioriza resumo, distribuição e detalhes progressivos', () => {
  assert.match(wealth, /Patrimônio líquido/);
  assert.match(wealth, /DISTRIBUIÇÃO/);
  assert.match(wealth, /data-wealth-type/);
  assert.match(wealth, /Valor de hoje/);
  assert.match(wealth, /Valor pago/);
  assert.match(wealth, /wealth-detail-sheet/);
  assert.match(wealth, /data-asset-paid-value/);
  assert.match(wealth, /data-asset-acquired-at/);
  assert.match(css, /wealth-type-cards/);
  assert.match(css, /@media\(min-width:1024px\)/);
});
