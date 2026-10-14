const test = require('node:test');
const assert = require('node:assert/strict');
const { reportDefinitions, reportRange } = require('../src/services/reportService');
const { reportKeySchema, reportQuerySchema } = require('../src/utils/validators');

test('catálogo cobre todos os relatórios financeiros obrigatórios', () => {
  assert.equal(Object.keys(reportDefinitions).length, 21);
  for (const key of ['loans-active', 'loans-paid', 'loans-overdue', 'result-projection', 'collector-commissions', 'cash-statement', 'customer-history']) {
    assert.ok(reportDefinitions[key], `relatório ${key} deve existir`);
  }
});

test('filtros de relatórios aceitam períodos curtos e exigem datas no personalizado', () => {
  assert.equal(reportQuerySchema.parse({ period: 'NEXT_15' }).period, 'NEXT_15');
  assert.throws(() => reportQuerySchema.parse({ period: 'CUSTOM' }));
  assert.throws(() => reportKeySchema.parse({ reportKey: 'unknown-report' }));
});

test('período de projeção começa hoje e termina no número solicitado de dias', () => {
  const range = reportRange({ period: 'NEXT_7' });
  assert.equal(range.startDate.getUTCHours(), 0);
  assert.equal(Math.floor((range.endDate - range.startDate) / 86400000), 6);
});

test('projeção de resultado declara que principal não é receita', () => {
  assert.match(reportDefinitions['result-projection'].description, /principal/i);
});
