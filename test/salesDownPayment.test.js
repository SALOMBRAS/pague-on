const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateSaleAmounts } = require('../src/services/saleService');
const { saleCreateSchema } = require('../src/utils/validators');

const accountId = '9e1c9a36-38d9-4f6f-a693-6fd1a5b87320';

test('calcula entrada e saldo de venda em centavos sem alterar o total contratado', () => {
  assert.deepEqual(calculateSaleAmounts(3000, 0, 1000), {
    subtotal: 3000,
    discount: 0,
    totalAmount: 3000,
    downPaymentAmount: 1000,
    remainingAmount: 2000,
  });
  assert.deepEqual(calculateSaleAmounts(10.01, 0.01, 5), {
    subtotal: 10.01,
    discount: 0.01,
    totalAmount: 10,
    downPaymentAmount: 5,
    remainingAmount: 5,
  });
  assert.throws(() => calculateSaleAmounts(100, 0, 100.01), /entrada/i);
});

test('aceita item por descrição livre e exige caixa quando a venda possui entrada', () => {
  const freeDescription = {
    productName: 'iPhone 14',
    quantity: 1,
    unitPrice: 3000,
    paymentType: 'INSTALLMENT',
    totalInstallments: 10,
    downPaymentAmount: 1000,
  };

  assert.equal(saleCreateSchema.safeParse(freeDescription).success, false);
  assert.equal(saleCreateSchema.safeParse({ ...freeDescription, cashAccountId: accountId, paymentMethod: 'PIX' }).success, true);
  assert.equal(saleCreateSchema.safeParse({
    items: [{ name: 'Serviço de instalação', quantity: 1, unitPrice: 250 }],
    paymentType: 'SINGLE',
  }).success, true);
});
