const assert = require('node:assert/strict');
const test = require('node:test');

const { isOverdueForDashboard } = require('../src/services/dashboardService');

test('dashboard deriva vencimento sem precisar atualizar o banco', () => {
  const today = new Date('2026-08-31T00:00:00.000Z');
  assert.equal(isOverdueForDashboard({ isActive: true, status: 'PENDING', dueDate: new Date('2026-08-30T23:59:59.999Z') }, today), true);
  assert.equal(isOverdueForDashboard({ isActive: true, status: 'PAID', dueDate: new Date('2026-08-01T00:00:00.000Z') }, today), false);
  assert.equal(isOverdueForDashboard({ isActive: false, status: 'PENDING', dueDate: new Date('2026-08-01T00:00:00.000Z') }, today), false);
});
