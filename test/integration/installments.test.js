const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma, createTestUser, cleanup, saleService, installmentService } = require('./helpers');

test('installments: addExtraInstallment cria parcela extra e atualiza totais da sale e da debt', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const product = await prisma.product.create({
    data: { userId: user.id, name: `Produto ${user.id}`, costPrice: 10, sellingPrice: 20, profitMargin: 50, stockQuantity: 20 },
  });
  const customer = await prisma.customer.create({ data: { userId: user.id, name: `Cliente ${user.id}` } });

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

  const future = new Date('2030-01-15T00:00:00.000Z');
  const updated = await installmentService.addExtraInstallment(user.id, sale.id, 10, future);

  // nova parcela = max+1, PENDING
  const newInstallment = updated.debt.installments.find((item) => item.number === 3);
  assert.ok(newInstallment, 'deve existir uma 3ª parcela');
  assert.equal(newInstallment.status, 'PENDING');
  assert.equal(Number(newInstallment.amount), 10);

  // totais incrementados na sale
  assert.equal(Number(updated.totalAmount), 50);
  assert.equal(updated.totalInstallments, 3);
  assert.equal(Number(updated.remainingAmount), 50);

  // totais incrementados na debt
  const debt = await prisma.debt.findUnique({ where: { id: sale.debt.id } });
  assert.equal(Number(debt.totalAmount), 50);
  assert.equal(debt.totalInstallments, 3);
});
