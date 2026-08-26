const service = require('../services/financialAccountService');
const audit = require('../services/auditService');
const { financialAccountCreateSchema, financialAccountUpdateSchema, financialStatementQuerySchema, financialTransferSchema, financialAdjustmentSchema, financialReversalSchema, financialClosingSchema, idSchema } = require('../utils/validators');
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
async function transfer(req, res) {
  const result = await service.transfer(req.user.id, financialTransferSchema.parse(req.body), req.actor.id);
  await audit.record({ eventType: 'financial_transfer_created', req, actor: req.actor, workspaceOwnerId: req.user.id, targetId: result.operationId, targetType: 'financial_transfer', payload: { fromAccountId: result.debit.accountId, toAccountId: result.credit.accountId, amount: result.debit.amount } });
  return sendSuccess(res, serialize(result), 'Transferência registrada com sucesso.', 201);
}
async function adjustment(req, res) {
  const movement = await service.adjustment(req.user.id, financialAdjustmentSchema.parse(req.body), req.actor.id);
  await audit.record({ eventType: 'financial_adjustment_created', req, actor: req.actor, workspaceOwnerId: req.user.id, targetId: movement.id, targetType: 'financial_movement', payload: { accountId: movement.accountId, reason: movement.description } });
  return sendSuccess(res, serialize(movement), 'Lançamento compensatório registrado.', 201);
}
async function reverse(req, res) {
  const movement = await service.reverseMovement(req.user.id, id(req), financialReversalSchema.parse(req.body).reason, req.actor.id);
  await audit.record({ eventType: 'financial_movement_reversed', req, actor: req.actor, workspaceOwnerId: req.user.id, targetId: movement.id, targetType: 'financial_movement', payload: { reversalOfId: movement.reversalOfId, reason: movement.description } });
  return sendSuccess(res, serialize(movement), 'Estorno registrado com sucesso.', 201);
}
async function close(req, res) {
  const closing = await service.closeAccount(req.user.id, financialClosingSchema.parse(req.body), req.actor.id);
  await audit.record({ eventType: 'financial_cash_closed', req, actor: req.actor, workspaceOwnerId: req.user.id, targetId: closing.id, targetType: 'financial_cash_closing', payload: { accountId: closing.accountId, closedThrough: closing.closedThrough, difference: closing.difference } });
  return sendSuccess(res, serialize(closing), 'Caixa fechado com sucesso.', 201);
}
async function closings(req, res) { return sendSuccess(res, serialize(await service.listClosings(req.user.id, req.query.accountId))); }

module.exports = { list, create, update, statement, transfer, adjustment, reverse, close, closings };
