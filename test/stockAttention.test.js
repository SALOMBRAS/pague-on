const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'public');
const stock = fs.readFileSync(path.join(root, 'views', 'estoque.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'stock-attention.css'), 'utf8');

test('estoque mostra alertas antes do catálogo e preserva quantidade mínima', () => {
  assert.match(stock, /Reposição necessária/);
  assert.match(stock, /Baixo estoque/);
  assert.match(stock, /Valor parado/);
  assert.match(stock, /data-stock-alert/);
  assert.match(stock, /stockStaleDays/);
  assert.match(stock, /Atual <b>\$\{product\.stock\}/);
  assert.match(stock, /Mínimo <b>\$\{product\.alert\}/);
  assert.match(stock, /Registrar entrada/);
  assert.match(stock, /Registrar saída/);
  assert.match(css, /stock-product-card\.restock/);
  assert.match(css, /stock-product-card\.low/);
  assert.match(css, /@media \(max-width:1023px\)/);
});
