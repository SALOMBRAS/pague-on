const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma, createTestUser, cleanup, saleService, installmentService, reportService } = require('./helpers');

test('profitReport: uma venda parcelada conta lucro UMA vez (não por parcela)', async (t) => {
  const user = await createTestUser();
  t.after(() => cleanup(user.id));

  // produto custo 10 / venda 20 (lucro bruto 10 por unidade)
  const product = await prisma.product.create({
    data: { userId: user.id, name: 'Produto Lucro', costPrice: 10, sellingPrice: 20, profitMargin: 50, stockQuantity: 10, minStockAlert: 1 },
  });
  const customer = await prisma.customer.create({ data: { userId: user.id, name: 'Cliente', phone: '11999999999' } });

  // venda parcelada: 2 parcelas de 10, 1 unidade
  const sale = await saleService.createSale(user.id, {
    customerId: customer.id,
    paymentType: 'INSTALLMENT',
    totalInstallments: 2,
    frequency: 'MONTHLY',
    discount: 0,
    items: [{ productId: product.id, quantity: 1 }],
  });

  // paga as duas parcelas (ambas caem no período atual)
  for (const installment of sale.debt.installments) {
    await installmentService.payInstallment(user.id, installment.id, {});
  }

  const report = await reportService.profitReport(user.id, {});
  const entry = report.byProduct.find((item) => item.productId === product.id);

  assert.ok(entry, 'produto deve aparecer no relatório por produto');
  assert.equal(Number(entry.received), 20, 'recebido = 2 parcelas de 10');
  // lucro bruto = (20-10) * 1 unidade = 10 — NÃO 20 (que seria o bug de somar por parcela)
  assert.equal(Number(entry.estimatedProfit), 10, 'lucro estimado conta uma vez por venda, não por parcela');
});
