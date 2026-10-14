const saleService = require('../services/saleService');
const { saleCreateSchema, saleUpdateSchema, paymentCreateSchema, paySchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const HttpError = require('../utils/httpError');
const interestCalculator = require('../services/interestCalculator');

function parseId(req) { return idSchema.parse(req.params).id; }

async function list(req, res) {
  if (req.query.status && !['PENDING', 'PARTIAL', 'PAID', 'CANCELLED'].includes(req.query.status)) {
    throw new HttpError(400, 'INVALID_QUERY', 'Filtro status inválido.');
  }
  const sales = await saleService.listSales(req.user.id, req.query);
  return sendSuccess(res, serialize(sales));
}

async function getById(req, res) {
  const sale = await saleService.saleDetail(req.user.id, parseId(req));
  return sendSuccess(res, serialize(sale));
}

async function create(req, res) {
  const sale = await saleService.createSale(req.user.id, saleCreateSchema.parse(req.body), { actor: req.actor, req });
  return sendSuccess(res, serialize(sale), 'Venda registrada, estoque atualizado e cobrança criada.', 201);
}

async function update(req, res) {
  const sale = await saleService.updateSale(req.user.id, parseId(req), saleUpdateSchema.parse(req.body));
  return sendSuccess(res, serialize(sale), 'Venda atualizada com sucesso.');
}

async function cancel(req, res) {
  const sale = await saleService.cancelSale(req.user.id, parseId(req));
  return sendSuccess(res, serialize(sale), 'Venda cancelada e estoque devolvido.');
}

async function pay(req, res) {
  const payment = paySchema.parse(req.body);
  const debt = await saleService.paySale(req.user.id, parseId(req), payment);
  return sendSuccess(res, serialize(debt), 'Pagamento da venda registrado com sucesso.');
}
async function recalculate(req, res) { const sale = await saleService.findOwnedSale(req.user.id, parseId(req)); return sendSuccess(res, await interestCalculator.recalculateSaleInterest(sale.id), 'Juros recalculados com sucesso.'); }

module.exports = { list, getById, create, update, cancel, pay, recalculate };
