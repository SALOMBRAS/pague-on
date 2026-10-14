const { buildInstallments } = require('./debtService');

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

function previewProductOperation(input) {
  const entryCents = toCents(input.downPaymentAmount);
  const installmentCents = toCents(input.installmentAmount);
  const financedCents = installmentCents * input.totalInstallments;
  const totalCents = entryCents + financedCents;
  const schedule = buildInstallments({
    totalAmount: fromCents(financedCents),
    totalInstallments: input.totalInstallments,
    installmentAmount: fromCents(installmentCents),
    startDate: input.firstDueDate,
    frequency: input.frequency,
  });

  return {
    type: 'PRODUCT',
    description: input.description,
    payment: {
      downPaymentAmount: fromCents(entryCents),
      installmentAmount: fromCents(installmentCents),
      totalInstallments: input.totalInstallments,
      financedAmount: fromCents(financedCents),
      totalAmount: fromCents(totalCents),
      remainingAmount: fromCents(financedCents),
      frequency: input.frequency,
      firstDueDate: schedule[0].dueDate,
    },
    schedule,
  };
}

module.exports = { previewProductOperation };
