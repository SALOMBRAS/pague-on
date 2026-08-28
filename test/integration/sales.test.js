const test = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../../src/utils/httpError');
const { prisma, createTestUser, cleanup, saleService, installmentService, debtService } = require('./helpers');

async function seed(user) {
  const product = await prisma.product.create({
    data: {
      userId: user.id,
      name: `Produto ${user.id}`,
      costPrice: 10,
      sellingPrice: 20,
      profitMargin: 50,
      stockQuantity: 20,
      minStockAlert: 5,
    },
  });
  const customer = await prisma.customer.create({
    data: { userId: user.id, name: `Cliente ${user.id}`, phone: '11999999999' },
  });
  return { product, customer };
}

test('sales: updateSale sem parcelas pagas atualiza campos permitidos', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { product, customer } = await seed(user);

  const sale = await saleService.createSale(user.id, {
    customerId: customer.id,
    paymentType: 'INSTALLMENT',
    totalInstallments: 2,
    frequency: 'MONTHLY',
    discount: 0,
    items: [{ productId: product.id, quantity: 2 }],
  });
  assert.equal(Number(sale.totalAmount), 40);
  assert.equal(Number(sale.paidAmount), 0);

  const updated = await saleService.updateSale(user.id, sale.id, { description: 'Venda editada' });
  assert.equal(updated.description, 'Venda editada');
  assert.equal(Number(updated.totalAmount), 40, 'totais financeiros não devem mudar em edição simples');
  assert.equal(Number(updated.paidAmount), 0);
});

test('sales: updateSale bloqueia (409) quando já há parcela paga', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { product, customer } = await seed(user);

  const sale = await saleService.createSale(user.id, {
    customerId: customer.id,
    paymentType: 'INSTALLMENT',
    totalInstallments: 2,
    frequency: 'MONTHLY',
    discount: 0,
    items: [{ productId: product.id, quantity: 2 }],
  });
  const firstInstallment = sale.debt.installments[0];
  await installmentService.payInstallment(user.id, firstInstallment.id, {});

  await assert.rejects(
    () => saleService.updateSale(user.id, sale.id, { description: 'tentar editar' }),
    (error) => error instanceof HttpError && error.status === 409,
    'editar venda com parcela paga deve lançar HttpError 409',
  );
});

test('sales: pagamento de venda única atualiza remainingAmount (não fica stale)', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));
  const { product, customer } = await seed(user);

  const sale = await saleService.createSale(user.id, {
    customerId: customer.id,
    paymentType: 'SINGLE',
    discount: 0,
    items: [{ productId: product.id, quantity: 1 }],
  });
  assert.equal(Number(sale.totalAmount), 20);
  assert.equal(Number(sale.remainingAmount), 20, 'venda nova deve ter remainingAmount = total');

  // Paga metade pelo caminho de dívida única (debtService.payDebt ->
  // updateLinkedSalePayment) — era o caminho que deixava remainingAmount stale.
  const debt = await prisma.debt.findFirst({ where: { saleId: sale.id } });
  await debtService.payDebt(user.id, debt.id, 10);

  const fresh = await saleService.saleDetail(user.id, sale.id);
  assert.equal(Number(fresh.paidAmount), 10);
  assert.equal(Number(fresh.remainingAmount), 10, 'remainingAmount deve ser total - pago');
  assert.equal(fresh.status, 'PARTIAL');
});
