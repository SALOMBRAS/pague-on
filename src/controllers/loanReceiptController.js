const service = require('../services/loanReceiptService');
const { idSchema, installmentReceiptPreviewSchema, installmentReceiptSchema, installmentReceiptReversalSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const { fileUrl } = require('../middlewares/uploadMiddleware');
const HttpError = require('../utils/httpError');
const owner = (req) => req.workspaceOwner?.id || req.user.id;
const id = (req, key = 'id') => idSchema.parse({ id: req.params[key] }).id;
const canDiscount = (req) => ['ADMIN', 'MANAGER'].includes(req.actor?.role);
async function details(req, res) { return sendSuccess(res, serialize(await service.details(owner(req), id(req, 'debtId')))); }
async function preview(req, res) { return sendSuccess(res, serialize(await service.preview(owner(req), id(req, 'installmentId'), installmentReceiptPreviewSchema.parse(req.body), canDiscount(req)))); }
async function receive(req, res) { const result = await service.record(owner(req), req.actor, id(req, 'installmentId'), installmentReceiptSchema.parse(req.body), req); return sendSuccess(res, serialize(result), result.idempotent ? 'Recebimento já havia sido registrado.' : 'Recebimento registrado e recibo gerado.', result.idempotent ? 200 : 201); }
async function reverse(req, res) { return sendSuccess(res, serialize(await service.reverse(owner(req), req.actor, id(req, 'paymentId'), installmentReceiptReversalSchema.parse(req.body).reason, req)), 'Estorno registrado.'); }
async function uploadProof(req, res) { if (!req.file) throw new HttpError(400, 'PAYMENT_PROOF_REQUIRED', 'Envie o comprovante no campo image.'); await service.preview(owner(req), id(req, 'installmentId'), { amount: 0.01 }, canDiscount(req)); return sendSuccess(res, { proofUrl: fileUrl(req.file) }, 'Comprovante anexado.'); }
module.exports = { details, preview, receive, reverse, uploadProof };
