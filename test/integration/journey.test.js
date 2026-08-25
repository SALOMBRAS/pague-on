const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma, createTestUser, cleanup, saleService, installmentService, dashboardService } = require('./helpers');

test('journey: venda parcelada → pagamento da 1ª parcela reflete no estado e no dashboard', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));

  // 1. oferta um produto
  const product = await prisma.product.create({
    data: { userId: user.id, name: `Produto J ${user.id}`, costPrice: 10, sellingPrice: 20, profitMargin: 50, stockQuantity: 20 },
  });
  // 2. cria um cliente
  const customer = await prisma.customer.create({ data: { userId: user.id, name: `Cliente J ${user.id}` } });

  // 3. venda parcelada em 2x de R$20 → total R$40, gera Debt + Installments
  const sale = await saleService.createSale(user.id, {
    customerId: customer.id,
    paymentType: 'INSTALLMENT',
    totalInstallments: 2,
    frequency: 'MONTHLY',
    discount: 0,
    items: [{ productId: product.id, quantity: 2 }],
  });
  assert.equal(Number(sale.totalAmount), 40);
  assert.equal(sale.debt.installments.length, 2);

  // 4. paga a 1ª parcela
  const first = sale.debt.installments[0];
  const payment = await installmentService.payInstallment(user.id, first.id, {});
  assert.equal(payment.installment.status, 'PAID');
  assert.equal(Number(payment.installment.paidAmount), 20);

  // 5. o estado refletiu
  const freshSale = await saleService.saleDetail(user.id, sale.id);
  assert.equal(Number(freshSale.paidAmount), 20);
  assert.equal(freshSale.status, 'PARTIAL');
  assert.equal(Number(freshSale.remainingAmount), 20);

  const debt = await prisma.debt.findUnique({ where: { id: sale.debt.id } });
  assert.equal(Number(debt.paidAmount), 20);
  assert.equal(Number(debt.paidInstallments), 1);
  assert.equal(debt.status, 'PARTIAL');

  // 6. dashboard reflete o saldo a receber
  const dashboard = await dashboardService.getDashboard(user);
  assert.equal(dashboard.balance.toReceive, 20);
  assert.equal(dashboard.balance.liquid, 20);
});
