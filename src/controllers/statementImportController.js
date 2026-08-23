const service = require('../services/statementImportService');
const { statementImportSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
async function create(req, res) { return sendSuccess(res, await service.importTransactions(req.user.id, statementImportSchema.parse(req.body)), 'Extrato importado com sucesso.', 201); }
module.exports = { create };
