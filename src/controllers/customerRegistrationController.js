const service = require('../services/customerRegistrationService');
const audit = require('../services/auditService');
const { idSchema, customerSelfRegistrationSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');

async function create(req, res) { const result = await service.createInvite(req.user.id, idSchema.parse(req.params).id, req.actor.id); await audit.record({ eventType: 'customer_registration_link_created', req, actor: req.actor, workspaceOwnerId: req.user.id, targetId: idSchema.parse(req.params).id, targetType: 'customer' }); return sendSuccess(res, result, 'Link de cadastro criado.', 201); }
async function revoke(req, res) { const invite = await service.revokeInvite(req.user.id, idSchema.parse(req.params).id); await audit.record({ eventType: 'customer_registration_link_revoked', req, actor: req.actor, workspaceOwnerId: req.user.id, targetId: idSchema.parse(req.params).id, targetType: 'customer_registration_invite' }); return sendSuccess(res, invite, 'Link de cadastro revogado.'); }
async function details(req, res) { try { return sendSuccess(res, serialize(await service.details(req.params.token))); } catch (error) { if (error.status === 410) await service.registerFailedAttempt(req.params.token); throw error; } }
async function submit(req, res) { try { return sendSuccess(res, serialize(await service.submit(req.params.token, customerSelfRegistrationSchema.parse(req.body))), 'Cadastro enviado para análise.'); } catch (error) { if (error.status === 410 && error.message.includes('válido')) await service.registerFailedAttempt(req.params.token); throw error; } }
module.exports = { create, revoke, details, submit };