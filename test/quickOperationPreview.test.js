const test = require('node:test');
const assert = require('node:assert/strict');

const { quickProductPreviewSchema } = require('../src/utils/validators');
const { previewProductOperation } = require('../src/services/quickOperationService');

test('o servidor calcula a prévia de produto com entrada e parcelas', () => {
  const input = quickProductPreviewSchema.parse({
    description: 'iPhone 14',
    downPaymentAmount: 1000,
    totalInstallments: 10,
    installmentAmount: 200,
    frequency: 'BIWEEKLY',
    firstDueDate: '2026-09-10',
  });
  const preview = previewProductOperation(input);

  assert.deepEqual(preview.payment, {
    downPaymentAmount: 1000,
    installmentAmount: 200,
    totalInstallments: 10,
    financedAmount: 2000,
    totalAmount: 3000,
    remainingAmount: 2000,
    frequency: 'BIWEEKLY',
    firstDueDate: new Date('2026-09-10T00:00:00.000Z'),
  });
  assert.deepEqual(preview.schedule.map((item) => item.dueDate.toISOString().slice(0, 10)), ['2026-09-10', '2026-09-24', '2026-10-08', '2026-10-22', '2026-11-05', '2026-11-19', '2026-12-03', '2026-12-17', '2026-12-31', '2027-01-14']);
});

test('a prévia rejeita dados extras e valor de parcela inválido', () => {
  const base = { description: 'iPhone 14', totalInstallments: 10, installmentAmount: 200, frequency: 'MONTHLY', firstDueDate: '2026-09-10' };
  assert.equal(quickProductPreviewSchema.safeParse({ ...base, installmentAmount: 0 }).success, false);
  assert.equal(quickProductPreviewSchema.safeParse({ ...base, ignoredByServer: true }).success, false);
});
