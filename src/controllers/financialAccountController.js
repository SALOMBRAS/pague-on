const service = require('../services/financialAccountService');
const audit = require('../services/auditService');
const { financialAccountCreateSchema, financialAccountUpdateSchema, financialStatementQuerySchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');

const id = (req) => idSchema.parse(req.params).id;

async function list(req, res) { return sendSuccess(res, serialize(await service.listWithBalances(req.user.id))); }
async function create(req, res) {
  const account = await service.createAccount(req.user.id, financialAccountCreateSchema.parse(req.body));
  await audit.record({ eventType: 'financial_account_created', req, actor: req.actor, workspaceOwnerId: req.user.id, targetId: account.id, targetType: 'financial_account', payload: { type: account.type, includeInAvailability: account.includeInAvailability } });
  return sendSuccess(res, serialize(account), 'Caixa cadastrado com sucesso.', 201);
}
async function update(req, res) {
  const account = await service.updateAccount(req.user.id, id(req), financialAccountUpdateSchema.parse(req.body));
  await audit.record({ eventType: 'financial_account_updated', req, actor: req.actor, workspaceOwnerId: req.user.id, targetId: account.id, targetType: 'financial_account', payload: { isActive: account.isActive, includeInAvailability: account.includeInAvailability } });
  return sendSuccess(res, serialize(account), 'Caixa atualizado com sucesso.');
}
async function statement(req, res) { return sendSuccess(res, serialize(await service.statement(req.user.id, financialStatementQuerySchema.parse(req.query)))); }

module.exports = { list, create, update, statement };
