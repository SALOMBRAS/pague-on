const service = require('../services/installmentService');
const { installmentPaySchema, addExtraSchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const id = (req) => idSchema.parse(req.params).id;
async function pay(req, res) { return sendSuccess(res, serialize(await service.payInstallment(req.user.id, id(req), installmentPaySchema.parse(req.body))), 'Pagamento da parcela registrado.'); }
async function unpay(req, res) { return sendSuccess(res, serialize(await service.unpayInstallment(req.user.id, id(req))), 'Pagamento da parcela desfeito.'); }
async function remind(req, res) { return sendSuccess(res, await service.remindInstallment(req.user.id, id(req)), 'Cobrança preparada.'); }
async function extra(req, res) { const { amount, dueDate } = addExtraSchema.parse(req.body); return sendSuccess(res, serialize(await service.addExtraInstallment(req.user.id, id(req), amount, dueDate)), 'Parcela extra adicionada.'); }
async function overdue(req, res) { return sendSuccess(res, serialize(await service.overdueInstallments(req.user.id))); }
module.exports = { pay, unpay, remind, extra, overdue };
