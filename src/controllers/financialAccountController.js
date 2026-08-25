const service = require('../services/financialAccountService');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
async function list(req, res) { return sendSuccess(res, serialize(await service.listWithBalances(req.user.id))); }
module.exports = { list };
