const service = require('../services/loanService');
const audit = require('../services/auditService');
const { loanConfigurationSchema, loanSimulationSchema, loanConfirmationSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const HttpError = require('../utils/httpError');
const owner = (req) => req.workspaceOwner?.id || req.user.id;
const canOverrideRate = (req) => ['ADMIN', 'MANAGER'].includes(req.actor?.role);
async function configurations(req, res) { return sendSuccess(res, serialize(await service.listConfigurations(owner(req)))); }
async function saveConfiguration(req, res) { if (req.actor?.role !== 'ADMIN') throw new HttpError(403, 'ADMIN_REQUIRED', 'Apenas administradores podem configurar fórmulas e revisão jurídica.'); const config = await service.saveConfiguration(owner(req), loanConfigurationSchema.parse(req.body)); await audit.record({ eventType: 'loan_configuration_updated', req, actor: req.actor, workspaceOwnerId: owner(req), targetId: config.id, targetType: 'loan_configuration', payload: { modality: config.modality, formulaVersion: config.formulaVersion, legalReviewReference: config.legalReviewReference } }); return sendSuccess(res, serialize(config), 'Modalidade de empréstimo configurada.'); }
async function customers(req, res) { return sendSuccess(res, serialize(await service.findCustomer(owner(req), req.query.q))); }
async function simulate(req, res) { const input = loanSimulationSchema.parse(req.body); return sendSuccess(res, serialize(await service.simulation(owner(req), input, { canOverrideRate: canOverrideRate(req) }))); }
async function create(req, res) { const result = await service.confirm(owner(req), req.actor, loanConfirmationSchema.parse(req.body), req); return sendSuccess(res, serialize(result), 'Empréstimo confirmado e registrado.', 201); }
module.exports = { configurations, saveConfiguration, customers, simulate, create };
