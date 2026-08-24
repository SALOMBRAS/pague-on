const goalService = require('../services/goalService');
const { sendSuccess } = require('../utils/responseHelper');

async function list(req, res) { return sendSuccess(res, await goalService.listGoals(req.user.id)); }
async function create(req, res) { return sendSuccess(res, await goalService.createGoal(req.user.id, req.body), 'Cofrinho criado com sucesso.', 201); }
async function update(req, res) { return sendSuccess(res, await goalService.updateGoal(req.user.id, req.params.id, req.body), 'Cofrinho atualizado com sucesso.'); }
async function remove(req, res) { await goalService.removeGoal(req.user.id, req.params.id); return sendSuccess(res, null, 'Cofrinho removido com sucesso.'); }
async function deposit(req, res) { return sendSuccess(res, await goalService.deposit(req.user.id, req.params.id, req.body.amount, req.body.note), 'Depósito realizado com sucesso.'); }
async function withdraw(req, res) { return sendSuccess(res, await goalService.withdraw(req.user.id, req.params.id, req.body.amount, req.body.note), 'Resgate realizado com sucesso.'); }

module.exports = { list, create, update, remove, deposit, withdraw };
