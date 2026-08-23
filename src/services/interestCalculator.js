const prisma = require('../config/database');

function round(value) { return Number(Number(value || 0).toFixed(2)); }
function midnight(value) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; }

function calculateInterest(installment, sale, referenceDate = new Date()) {
  if (installment.status === 'PAID') return { interestAmount: 0, daysOverdue: 0, totalAmount: Number(installment.amount) };
  const dueDate = midnight(installment.dueDate); const today = midnight(referenceDate);
  const daysOverdue = Math.max(0, Math.floor((today - dueDate) / 86400000));
  const principal = Number(installment.amount); const rate = Number(sale.interestRate || 0);
  if (!daysOverdue || !rate || sale.interestType === 'NONE') return { interestAmount: 0, daysOverdue, totalAmount: principal };
  const periods = daysOverdue / 30;
  const interest = {
    SIMPLE: principal * (rate / 100) * periods,
    COMPOUND: principal * ((1 + rate / 100) ** periods - 1),
    DAILY: principal * (rate / 100) * daysOverdue,
    FIXED_FEE: rate,
  }[sale.interestType] || 0;
  const interestAmount = round(interest);
  return { interestAmount, daysOverdue, totalAmount: round(principal + interestAmount), rateApplied: rate };
}

async function recalculateSaleInterest(saleId, referenceDate = new Date()) {
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { debt: { include: { installments: true } } } });
  if (!sale?.debt) return { totalInterest: 0, installments: [] };
  const calculations = sale.debt.installments.map((installment) => ({ installment, calc: calculateInterest(installment, sale, referenceDate) }));
  await prisma.$transaction(async (tx) => {
    for (const { installment, calc } of calculations) {
      if (installment.status === 'PAID') continue;
      await tx.installment.update({ where: { id: installment.id }, data: { interestAmount: calc.interestAmount, totalAmount: calc.totalAmount, daysOverdue: calc.daysOverdue, status: calc.daysOverdue && installment.status !== 'PARTIAL' ? 'OVERDUE' : installment.status === 'PARTIAL' ? 'PARTIAL' : 'PENDING' } });
    }
    await tx.sale.update({ where: { id: sale.id }, data: { totalInterest: round(calculations.reduce((sum, entry) => sum + (entry.installment.status === 'PAID' ? Number(entry.installment.interestAmount || 0) : entry.calc.interestAmount), 0)) } });
  });
  return { totalInterest: round(calculations.reduce((sum, entry) => sum + entry.calc.interestAmount, 0)), installments: calculations.map(({ installment, calc }) => ({ id: installment.id, number: installment.number, ...calc })) };
}

async function recalculateAllInterest() {
  const sales = await prisma.sale.findMany({ where: { status: { in: ['PENDING', 'PARTIAL'] }, interestType: { not: 'NONE' } }, select: { id: true } });
  await Promise.all(sales.map((sale) => recalculateSaleInterest(sale.id)));
  return { checked: sales.length };
}

module.exports = { calculateInterest, recalculateSaleInterest, recalculateAllInterest };
