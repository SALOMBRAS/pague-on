const purchaseService = require('../services/purchaseService');
const { purchaseCreateSchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');

async function list(req, res) {
  const purchases = await purchaseService.listPurchases(req.user.id, req.query);
  return sendSuccess(res, serialize(purchases));
}

async function create(req, res) {
  const result = await purchaseService.createPurchase(req.user.id, purchaseCreateSchema.parse(req.body));
  return sendSuccess(res, serialize(result), 'Compra registrada e estoque atualizado.', 201);
}

async function remove(req, res) {
  const id = idSchema.parse(req.params).id;
  const result = await purchaseService.deletePurchase(req.user.id, id);
  return sendSuccess(res, result, 'Compra excluída e estoque revertido.');
}

module.exports = { list, create, remove };
