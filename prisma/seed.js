require('dotenv').config();

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { addDays, addMonths, recurringPeriod, startOfUtcDay } = require('../src/utils/dateHelpers');
const { calculateProfitMargin } = require('../src/utils/calculateProfit');

const prisma = new PrismaClient();

async function main() {
  const email = 'teste@pagueon.com';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) await prisma.user.delete({ where: { id: existing.id } });

  const user = await prisma.user.create({
    data: {
      name: 'João Pague-On', email, password: await bcrypt.hash('123456', 12), phone: '11999999999', plan: 'PRO',
      defaultMessage: 'Olá [counterparty], tudo bem?\n\nO pagamento de [description], no valor de [amount], vence em [dueDate].\n\nAtt, [user.name]',
    },
  });

  const [maria, carlos, ana] = await Promise.all([
    prisma.customer.create({ data: { userId: user.id, name: 'Maria Oliveira', nickname: 'Maria', phone: '11988888888', email: 'maria@exemplo.com', notes: 'Cliente frequente; prefere PIX.' } }),
    prisma.customer.create({ data: { userId: user.id, name: 'Carlos Souza', nickname: 'Carlos', phone: '11977777777', email: 'carlos@exemplo.com', notes: 'Sempre paga em dia.' } }),
    prisma.customer.create({ data: { userId: user.id, name: 'Ana Paula', nickname: 'Ana', phone: '11966666666' } }),
  ]);
  const [camiseta, tenis, mesa] = await Promise.all([
    prisma.product.create({ data: { userId: user.id, name: 'Camiseta Preta', category: 'Roupas', costPrice: 25, sellingPrice: 55, profitMargin: calculateProfitMargin(25, 55), stockQuantity: 12, minStockAlert: 5 } }),
    prisma.product.create({ data: { userId: user.id, name: 'Tênis Nike Air', category: 'Calçados', costPrice: 180, sellingPrice: 350, profitMargin: calculateProfitMargin(180, 350), stockQuantity: 3, minStockAlert: 5 } }),
    prisma.product.create({ data: { userId: user.id, name: 'Mesa de Jantar 6L', category: 'Móveis', costPrice: 600, sellingPrice: 1500, profitMargin: calculateProfitMargin(600, 1500), stockQuantity: 2, minStockAlert: 1 } }),
  ]);

  const today = startOfUtcDay(); const firstInstallment = addDays(today, -14);
  const sale = await prisma.sale.create({
    data: {
      userId: user.id, customerId: maria.id, totalAmount: 100, paidAmount: 25, discount: 10, interestRate: 1, interestType: 'DAILY', paymentType: 'INSTALLMENT', totalInstallments: 4, installmentAmount: 25, frequency: 'WEEKLY', firstDueDate: firstInstallment, remainingAmount: 75, status: 'PARTIAL', description: 'Venda de 2 camisetas em 4 parcelas semanais.', soldAt: addDays(today, -15),
      items: { create: { productId: camiseta.id, name: camiseta.name, quantity: 2, unitPrice: 55, unitCost: 25, total: 110 } },
    },
  });
  await prisma.debt.create({
    data: {
      userId: user.id, saleId: sale.id, customerId: maria.id, type: 'RECEIVABLE', paymentType: 'INSTALLMENT', description: 'Camisetas para Maria', category: 'PRODUCT', counterparty: maria.name, counterpartyPhone: maria.phone, totalAmount: 100, paidAmount: 25, installmentAmount: 25, totalInstallments: 4, paidInstallments: 1, startDate: firstInstallment, dueDate: addDays(firstInstallment, 7), status: 'PARTIAL', productId: camiseta.id, quantity: 2,
      installments: { create: [
        { number: 1, amount: 25, totalAmount: 25, dueDate: firstInstallment, paidAt: firstInstallment, paidAmount: 25, paymentMethod: 'PIX', status: 'PAID', interestRateAtCreation: 1 },
        { number: 2, amount: 25, totalAmount: 25, dueDate: addDays(firstInstallment, 7), status: 'OVERDUE', daysOverdue: 7, interestRateAtCreation: 1 },
        { number: 3, amount: 25, totalAmount: 25, dueDate: addDays(firstInstallment, 14), status: 'PENDING', interestRateAtCreation: 1 },
        { number: 4, amount: 25, totalAmount: 25, dueDate: addDays(firstInstallment, 21), status: 'PENDING', interestRateAtCreation: 1 },
      ] },
    },
  });
  await prisma.product.update({ where: { id: camiseta.id }, data: { stockQuantity: { decrement: 2 } } });

  const mesaStart = addDays(today, 5);
  await prisma.debt.create({
    data: {
      userId: user.id, customerId: carlos.id, type: 'RECEIVABLE', paymentType: 'INSTALLMENT', description: 'Mesa de Jantar', category: 'PRODUCT', counterparty: carlos.name, counterpartyPhone: carlos.phone, totalAmount: 1500, installmentAmount: 250, totalInstallments: 6, startDate: mesaStart, dueDate: mesaStart, productId: mesa.id, quantity: 1,
      installments: { create: Array.from({ length: 6 }, (_item, index) => ({ number: index + 1, amount: 250, totalAmount: 250, dueDate: addMonths(mesaStart, index) })) },
    },
  });
  const overdueDate = addDays(today, -3);
  await prisma.debt.create({ data: { userId: user.id, customerId: ana.id, type: 'RECEIVABLE', paymentType: 'SINGLE', description: 'Venda de Tênis', category: 'PRODUCT', counterparty: ana.name, counterpartyPhone: ana.phone, totalAmount: 350, startDate: overdueDate, dueDate: overdueDate, status: 'OVERDUE', productId: tenis.id, quantity: 1 } });
  const recurringStart = addDays(today, 1);
  await prisma.debt.create({ data: { userId: user.id, type: 'PAYABLE', paymentType: 'RECURRING', description: 'Aluguel da Loja', category: 'RENT', counterparty: 'Imobiliária XYZ', totalAmount: 1200, frequency: 'MONTHLY', startDate: recurringStart, dueDate: recurringStart, repeatCount: 12, recurringPayments: { create: { period: recurringPeriod(recurringStart, 'MONTHLY'), dueDate: recurringStart, amount: 1200 } } } });
  await prisma.debt.create({ data: { userId: user.id, type: 'PAYABLE', paymentType: 'SINGLE', description: 'Fornecedor de camisetas', category: 'PRODUCT', counterparty: 'Confecções Norte', totalAmount: 430, startDate: addDays(today, 2), dueDate: addDays(today, 2), productId: camiseta.id, quantity: 10 } });

  await prisma.purchase.create({ data: { userId: user.id, productId: camiseta.id, quantity: 12, unitCost: 25, totalCost: 300, supplier: 'Confecções Norte', date: addDays(today, -5) } });
  await prisma.budget.createMany({ data: [
    { userId: user.id, category: 'PRODUCT', month: today.getUTCMonth() + 1, year: today.getUTCFullYear(), limitAmount: 600, spentAmount: 450, alertAt: 80 },
    { userId: user.id, category: 'TRANSPORT', month: today.getUTCMonth() + 1, year: today.getUTCFullYear(), limitAmount: 300, spentAmount: 280, alertAt: 80 },
  ] });
  await prisma.notification.createMany({ data: [
    { userId: user.id, title: 'Parcela atrasada', body: 'A 2ª parcela de Camisetas para Maria está atrasada.', type: 'DEBT_OVERDUE', data: { saleId: sale.id } },
    { userId: user.id, title: 'Estoque baixo', body: 'Tênis Nike Air está abaixo do estoque mínimo.', type: 'STOCK_LOW', data: { productId: tenis.id } },
  ] });
  console.log(`Seed concluído. Usuário: ${email} / senha: 123456`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
