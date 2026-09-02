const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('a nova operação mantém CTA único e diálogo acessível', () => {
  const html = read('public/index.html');
  const app = read('public/app.js');
  const quickOperation = read('public/quick-operation.js');

  assert.match(html, /Nova movimentação/);
  assert.match(html, /quick-operation\.css/);
  assert.match(html, /quick-operation\.js/);
  assert.match(app, /openPrimaryOperation/);
  assert.match(quickOperation, /aria-modal/);
  assert.match(quickOperation, /aria-live="assertive"/);
  assert.match(quickOperation, /data-type="PRODUCT"/);
  assert.match(quickOperation, /data-type="LOAN"/);
});

test('a tela pede prévia do servidor antes de criar a venda', () => {
  const quickOperation = read('public/quick-operation.js');
  assert.match(quickOperation, /quick-operations\/product-preview/);
  assert.match(quickOperation, /Confira a prévia e toque em salvar novamente/);
  assert.match(quickOperation, /pagueOnApi\.post\('\/sales'/);
  assert.match(quickOperation, /newCustomerName/);
});
