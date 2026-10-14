const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'public');
const caixa = fs.readFileSync(path.join(root, 'views', 'caixa.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'caixa-attention.css'), 'utf8');

test('caixa prioriza a fila de atenção e oferece filtros progressivos', () => {
  assert.match(caixa, /Fila de atenção/);
  assert.match(caixa, /Vencendo hoje/);
  assert.match(caixa, /Atrasadas/);
  assert.match(caixa, /data-attention/);
  assert.match(caixa, /Saldo atual/);
  assert.match(caixa, /Últimos 7 dias/);
  assert.match(caixa, /Ver todas as movimentações/);
  assert.match(caixa, /cash-filter-sheet/);
  assert.match(caixa, /cash-filter-sidebar/);
  assert.match(app, /data-cash-period/);
  assert.match(app, /bindCashPullToRefresh/);
  assert.match(css, /@media \(max-width:1023px\)/);
  assert.match(css, /@media \(min-width:1024px\)/);
});
