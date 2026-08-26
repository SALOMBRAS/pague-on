const service = require('../services/customerRegistrationService');
const audit = require('../services/auditService');
const { idSchema, customerSelfRegistrationSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
async function create(req, res) { const result = await service.createInvite(req.user.id, idSchema.parse(req.params).id, req.actor.id); await audit.record({ eventType: 'customer_registration_link_created', req, actor: req.actor, workspaceOwnerId: req.user.id, targetId: idSchema.parse(req.params).id, targetType: 'customer' }); return sendSuccess(res, result, 'Link de cadastro criado.', 201); }
async function details(req, res) { return sendSuccess(res, serialize(await service.details(req.params.token))); }
async function submit(req, res) { return sendSuccess(res, serialize(await service.submit(req.params.token, customerSelfRegistrationSchema.parse(req.body))), 'Cadastro enviado para análise.'); }
module.exports = { create, details, submit };
