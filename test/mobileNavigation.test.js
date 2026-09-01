const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const goalsSource = fs.readFileSync(path.resolve(__dirname, '../public/goals.js'), 'utf8');
const reportsSource = fs.readFileSync(path.resolve(__dirname, '../public/reports.js'), 'utf8');
const collectorsSource = fs.readFileSync(path.resolve(__dirname, '../public/collectors.js'), 'utf8');
const budgetSource = fs.readFileSync(path.resolve(__dirname, '../public/budget.js'), 'utf8');

// Regressão P4: no mobile o bottom-nav tem 5 itens e não expõe Metas, Relatórios,
// Cobradores e Orçamentos. Cada módulo deve adicionar seu atalho no Perfil para
// que as 8 telas do desktop sejam alcançáveis em ≤2 toques.

test('Metas tem atalho no Perfil que navega para a tela de metas', () => {
  assert.match(goalsSource, /data-goals-open/);
  assert.match(goalsSource, /pagueOnAppActions\?\.navigate\('goals'\)/);
  assert.match(goalsSource, /profile-section/);
  assert.match(goalsSource, /MutationObserver\(profileEntry\)/);
});

test('Relatórios mantém o atalho no Perfil', () => {
  assert.match(reportsSource, /addProfileLink/);
  assert.match(reportsSource, /profile-section/);
});

test('Cobradores mantém o atalho no Perfil', () => {
  assert.match(collectorsSource, /data-open-collectors/);
  assert.match(collectorsSource, /profile-section/);
});

test('Orçamentos mantém o atalho no Perfil', () => {
  assert.match(budgetSource, /data-budget-open/);
  assert.match(budgetSource, /profile-section/);
});
