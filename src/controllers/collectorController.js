const collectorService = require('../services/collectorService');
const installmentService = require('../services/installmentService');
const audit = require('../services/auditService');
const HttpError = require('../utils/httpError');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const { idSchema, collectorCreateSchema, collectorUpdateSchema, collectorCustomerAssignmentSchema, collectorContactSchema, collectorCommissionQuerySchema, installmentPaySchema } = require('../utils/validators');

const id = (req) => idSchema.parse(req.params).id;
const ownerId = (req) => req.workspaceOwner?.id || req.user.id;
function requireManagement(req) { if (!['ADMIN', 'MANAGER'].includes(req.actor?.role)) throw new HttpError(403, 'MANAGEMENT_REQUIRED', 'Apenas administrador ou gerente autorizado pode gerenciar cobradores.'); }
function requireCollector(req) { if (req.actor?.role !== 'COLLECTOR') throw new HttpError(403, 'COLLECTOR_REQUIRED', 'Esta operação é exclusiva do cobrador.'); }

async function list(req, res) { requireManagement(req); return sendSuccess(res, serialize(await collectorService.listCollectors(ownerId(req)))); }
async function create(req, res) { requireManagement(req); const collector = await collectorService.createCollector(ownerId(req), collectorCreateSchema.parse(req.body)); await audit.record({ eventType: 'collector_created', req, actor: req.actor, workspaceOwnerId: ownerId(req), targetId: collector.id, targetType: 'collector', targetEmail: collector.email, payload: { commissionType: collector.commissionType, commissionBase: collector.commissionBase, commissionRate: collector.commissionRate } }); return sendSuccess(res, serialize(collector), 'Cobrador cadastrado com sucesso.', 201); }
async function update(req, res) { requireManagement(req); const collector = await collectorService.updateCollector(ownerId(req), id(req), collectorUpdateSchema.parse(req.body)); await audit.record({ eventType: 'collector_updated', req, actor: req.actor, workspaceOwnerId: ownerId(req), targetId: collector.id, targetType: 'collector', targetEmail: collector.email, payload: { isActive: collector.isActive, commissionType: collector.commissionType, commissionBase: collector.commissionBase, commissionRate: collector.commissionRate, permissions: collector.permissions } }); return sendSuccess(res, serialize(collector), 'Cobrador atualizado com sucesso.'); }
async function assign(req, res) { requireManagement(req); const result = await collectorService.assignCustomers(ownerId(req), id(req), collectorCustomerAssignmentSchema.parse(req.body).customerIds); await audit.record({ eventType: 'collector_customers_assigned', req, actor: req.actor, workspaceOwnerId: ownerId(req), targetId: result.collectorId, targetType: 'collector', payload: { assignedCustomerCount: result.assignedCustomerCount } }); return sendSuccess(res, result, 'Clientes vinculados ao cobrador.'); }
async function report(req, res) { requireManagement(req); return sendSuccess(res, serialize(await collectorService.commissionReport(ownerId(req), id(req), collectorCommissionQuerySchema.parse(req.query)))); }

async function myCustomers(req, res) { requireCollector(req); return sendSuccess(res, serialize(await collectorService.essentialCustomers(ownerId(req), req.actor.id))); }
async function myDebts(req, res) { requireCollector(req); return sendSuccess(res, serialize(await collectorService.assignedDebts(ownerId(req), req.actor.id))); }
async function myAgenda(req, res) { requireCollector(req); return sendSuccess(res, serialize(await collectorService.agenda(ownerId(req), req.actor.id))); }
async function myContacts(req, res) { requireCollector(req); return sendSuccess(res, serialize(await collectorService.listContacts(ownerId(req), req.actor.id, req.query.customerId))); }
async function addMyContact(req, res) { requireCollector(req); const contact = await collectorService.addContact(ownerId(req), req.actor.id, collectorContactSchema.parse(req.body)); await audit.record({ eventType: 'collector_contact_registered', req, actor: req.actor, workspaceOwnerId: ownerId(req), targetId: contact.id, targetType: 'collector_contact', payload: { customerId: contact.customerId, debtId: contact.debtId, installmentId: contact.installmentId, type: contact.type, promisedDate: contact.promisedDate } }); return sendSuccess(res, serialize(contact), 'Contato registrado com sucesso.', 201); }
async function myCommissions(req, res) { requireCollector(req); return sendSuccess(res, serialize(await collectorService.commissionReport(ownerId(req), req.actor.id, collectorCommissionQuerySchema.parse(req.query)))); }
async function recordMyPayment(req, res) { requireCollector(req); await collectorService.requireCollectorPermission(ownerId(req), req.actor.id, 'recordPayments'); const payment = await installmentService.payInstallment(ownerId(req), id(req), installmentPaySchema.parse(req.body), { role: 'COLLECTOR', actorId: req.actor.id }); await audit.record({ eventType: 'collector_payment_registered', req, actor: req.actor, workspaceOwnerId: ownerId(req), targetId: id(req), targetType: 'installment', payload: { paidAmount: payment.installment?.paidAmount, paymentMethod: payment.installment?.paymentMethod } }); return sendSuccess(res, serialize(payment), 'Recebimento registrado com sucesso.'); }

module.exports = { list, create, update, assign, report, myCustomers, myDebts, myAgenda, myContacts, addMyContact, myCommissions, recordMyPayment };
