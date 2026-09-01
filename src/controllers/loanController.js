const service = require('../services/loanService');
const audit = require('../services/auditService');
const { loanConfigurationSchema, loanSimulationSchema, loanConfirmationSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const HttpError = require('../utils/httpError');
const financialSettings = require('../services/financialSettingsService');
const { financialSettingsUpdateSchema, financialHolidaySchema } = require('../utils/validators');
const owner = (req) => req.workspaceOwner?.id || req.user.id;
const canOverrideRate = (req) => ['ADMIN', 'MANAGER'].includes(req.actor?.role);
async function configurations(req, res) { return sendSuccess(res, serialize(await service.listConfigurations(owner(req)))); }
async function saveConfiguration(req, res) { if (req.actor?.role !== 'ADMIN') throw new HttpError(403, 'ADMIN_REQUIRED', 'Apenas administradores podem configurar fórmulas e revisão jurídica.'); const input = loanConfigurationSchema.parse(req.body); const previous = (await service.listConfigurations(owner(req))).find((item) => item.modality === input.modality) || null; const config = await service.saveConfiguration(owner(req), input); await audit.record({ eventType: 'loan_configuration_updated', req, actor: req.actor, workspaceOwnerId: owner(req), targetId: config.id, targetType: 'loan_configuration', payload: { previous, current: config, reason: input.reason } }); return sendSuccess(res, serialize(config), 'Modalidade de empréstimo configurada.'); }
async function customers(req, res) { return sendSuccess(res, serialize(await service.findCustomer(owner(req), req.query.q))); }
async function simulate(req, res) { const input = loanSimulationSchema.parse(req.body); return sendSuccess(res, serialize(await service.simulation(owner(req), input, { canOverrideRate: canOverrideRate(req) }))); }
async function create(req, res) { const result = await service.confirm(owner(req), req.actor, loanConfirmationSchema.parse(req.body), req); return sendSuccess(res, serialize(result), 'Empréstimo confirmado e registrado.', 201); }
async function getSettings(req, res) { return sendSuccess(res, serialize(await financialSettings.current(owner(req)))); }
async function updateSettings(req, res) {
  if (req.actor?.role !== 'ADMIN') throw new HttpError(403, 'ADMIN_REQUIRED', 'Apenas administradores podem alterar regras financeiras.');
  const input = financialSettingsUpdateSchema.parse(req.body);
  const previous = await financialSettings.current(owner(req));
  const saved = await financialSettings.save(owner(req), req.actor.id, input.settings, input.reason);
  await audit.record({ eventType: 'financial_settings_updated', req, actor: req.actor, workspaceOwnerId: owner(req), targetId: saved.id, targetType: 'financial_settings_version', payload: { previousVersion: previous.version, newVersion: saved.version, previousSettings: previous.settings, newSettings: saved.settings, reason: input.reason } });
  return sendSuccess(res, serialize(saved), 'Configurações financeiras versionadas e registradas.');
}
async function holidays(req, res) { return sendSuccess(res, serialize(await financialSettings.listHolidays(owner(req)))); }
async function createHoliday(req, res) {
  if (req.actor?.role !== 'ADMIN') throw new HttpError(403, 'ADMIN_REQUIRED', 'Apenas administradores podem alterar o calendário.');
  const input = financialHolidaySchema.parse(req.body); const { reason, ...holidayInput } = input; const holiday = await financialSettings.createHoliday(owner(req), holidayInput);
  await audit.record({ eventType: 'financial_holiday_created', req, actor: req.actor, workspaceOwnerId: owner(req), targetId: holiday.id, targetType: 'financial_holiday', payload: { holiday: { date: holiday.date, type: holiday.type, name: holiday.name, region: holiday.region, isActive: holiday.isActive }, reason: input.reason } });
  return sendSuccess(res, serialize(holiday), 'Feriado cadastrado. Use a regra de vencimento para decidir como tratá-lo.', 201);
}
async function updateHoliday(req, res) {
  if (req.actor?.role !== 'ADMIN') throw new HttpError(403, 'ADMIN_REQUIRED', 'Apenas administradores podem alterar o calendário.');
  const input = financialHolidaySchema.parse(req.body);
  const before = (await financialSettings.listHolidays(owner(req))).find((item) => item.id === req.params.id);
  const holiday = await financialSettings.updateHoliday(owner(req), req.params.id, { date: input.date, type: input.type, name: input.name, region: input.region, isActive: input.isActive });
  await audit.record({ eventType: 'financial_holiday_updated', req, actor: req.actor, workspaceOwnerId: owner(req), targetId: holiday.id, targetType: 'financial_holiday', payload: { previous: before, current: holiday, reason: input.reason } });
  return sendSuccess(res, serialize(holiday), 'Feriado atualizado.');
}
async function deleteHoliday(req, res) {
  if (req.actor?.role !== 'ADMIN') throw new HttpError(403, 'ADMIN_REQUIRED', 'Apenas administradores podem alterar o calendário.');
  const reason = String(req.body?.reason || '').trim(); if (reason.length < 5) throw new HttpError(400, 'CHANGE_REASON_REQUIRED', 'Informe a justificativa da alteração.');
  const holiday = await financialSettings.removeHoliday(owner(req), req.params.id);
  await audit.record({ eventType: 'financial_holiday_deleted', req, actor: req.actor, workspaceOwnerId: owner(req), targetId: holiday.id, targetType: 'financial_holiday', payload: { previous: holiday, reason } });
  return sendSuccess(res, serialize(holiday), 'Feriado removido.');
}
module.exports = { configurations, saveConfiguration, customers, simulate, create, getSettings, updateSettings, holidays, createHoliday, updateHoliday, deleteHoliday };
