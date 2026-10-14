const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const validators = fs.readFileSync(path.join(root, 'src', 'utils', 'validators.js'), 'utf8');
const sales = fs.readFileSync(path.join(root, 'src', 'services', 'saleService.js'), 'utf8');

test('venda avulsa aceita nome e telefone sem criar Customer', () => {
  assert.match(validators, /counterparty: z\.string\(\)\.trim\(\)\.min\(2\)/);
  assert.match(validators, /counterpartyPhone: z\.string\(\)\.trim\(\)\.max\(30\)/);
  assert.match(sales, /const counterparty = customer\?\.name \|\| input\.counterparty/);
  assert.match(sales, /counterpartyPhone,/);
});
