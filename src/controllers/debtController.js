const debtService = require('../services/debtService');
const { debtCreateSchema, debtUpdateSchema, paySchema, idSchema, enums } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const HttpError = require('../utils/httpError');
const duplicateService = require('../services/duplicateService');
const currencyService = require('../services/currencyService');

function parseId(req) {
  return idSchema.parse(req.params).id;
}

function validateListQuery(query) {
  for (const [field, schema] of [['type', enums.debtType], ['status', enums.debtStatus], ['paymentType', enums.paymentType]]) {
    if (query[field] && !schema.safeParse(query[field]).success) {
      throw new HttpError(400, 'INVALID_QUERY', `Filtro ${field} inválido.`);
    }
  }
  return query;
}

async function list(req, res) {
  const debts = await debtService.listDebts(req.user.id, validateListQuery(req.query));
  return sendSuccess(res, serialize(debts));
}

async function getById(req, res) {
  const debt = await debtService.findDebt(req.user.id, parseId(req));
  return sendSuccess(res, serialize(debt));
}

async function create(req, res) {
  const input = debtCreateSchema.parse(req.body);
  const converted = await currencyService.convertDebtInput(input); const duplicates = await duplicateService.findDuplicates(req.user.id, converted);
  if (duplicates.length && !input.allowDuplicate) throw new HttpError(409, 'POSSIBLE_DUPLICATE', 'Encontramos uma conta muito parecida nos últimos 7 dias. Confirme antes de criar outra.');
  const debt = await debtService.createDebt(req.user.id, input);
  return sendSuccess(res, serialize(debt), 'Dívida criada com sucesso.', 201);
}

async function checkDuplicate(req, res) {
  const input = await currencyService.convertDebtInput(debtCreateSchema.parse(req.body));
  const duplicates = await duplicateService.findDuplicates(req.user.id, input);
  return sendSuccess(res, serialize(duplicates.map((item) => ({ ...item.debt, duplicateScore: item.score, descriptionSimilarity: item.descriptionSimilarity }))));
}

async function update(req, res) {
  const debt = await debtService.updateDebt(req.user.id, parseId(req), debtUpdateSchema.parse(req.body));
  return sendSuccess(res, serialize(debt), 'Dívida atualizada com sucesso.');
}

async function remove(req, res) {
  const result = await debtService.deleteDebt(req.user.id, parseId(req));
  return sendSuccess(res, result, 'Dívida excluída com sucesso.');
}

async function pay(req, res) {
  const input = paySchema.parse(req.body);
  const debt = await debtService.payDebt(req.user.id, parseId(req), input.paidAmount, input.goalId, input.cashAccountId);
  return sendSuccess(res, serialize(debt), 'Pagamento registrado com sucesso.');
}

async function payInstallment(req, res) {
  const debtId = parseId(req);
  const installmentId = idSchema.parse({ id: req.params.installmentId }).id;
  const input = paySchema.parse(req.body);
  const debt = await debtService.payInstallment(req.user.id, debtId, installmentId, input.paidAmount, input.cashAccountId);
  return sendSuccess(res, serialize(debt), 'Parcela marcada como paga.');
}

async function cancel(req, res) {
  const debt = await debtService.cancelRecurringDebt(req.user.id, parseId(req));
  return sendSuccess(res, serialize(debt), 'Recorrência cancelada com sucesso.');
}

async function installments(req, res) {
  const debt = await debtService.findDebt(req.user.id, parseId(req), { installments: { orderBy: { number: 'asc' } } });
  if (debt.paymentType !== 'INSTALLMENT') throw new HttpError(400, 'NOT_INSTALLMENT', 'Esta dívida não é parcelada.');
  return sendSuccess(res, serialize(debt.installments));
}

async function recurringHistory(req, res) {
  const debt = await debtService.findDebt(req.user.id, parseId(req), { recurringPayments: { orderBy: { dueDate: 'desc' } } });
  if (debt.paymentType !== 'RECURRING') throw new HttpError(400, 'NOT_RECURRING', 'Esta dívida não é recorrente.');
  return sendSuccess(res, serialize(debt.recurringPayments));
}

async function collect(req, res) {
  const debt = await debtService.findDebt(req.user.id, parseId(req), false);
  const collection = await debtService.createCollection(req.user, debt);
  return sendSuccess(res, collection, 'Cobrança preparada com sucesso.');
}

module.exports = { list, getById, create, checkDuplicate, update, remove, pay, payInstallment, cancel, installments, recurringHistory, collect };
