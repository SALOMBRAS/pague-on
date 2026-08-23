const debtService = require('../services/debtService');
const { paymentCreateSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');

async function create(req, res) {
  const payment = paymentCreateSchema.parse(req.body);
  const debt = payment.installmentId
    ? await debtService.payInstallment(req.user.id, payment.debtId, payment.installmentId, payment.paidAmount)
    : await debtService.payDebt(req.user.id, payment.debtId, payment.paidAmount);
  return sendSuccess(res, serialize(debt), 'Pagamento registrado com sucesso.');
}

module.exports = { create };
