const currencyService = require('../services/currencyService');
const { currencyConvertSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
async function list(_req, res) { return sendSuccess(res, serialize(await currencyService.listCurrencies())); }
async function convert(req, res) { return sendSuccess(res, serialize(await currencyService.convert(currencyConvertSchema.parse(req.query)))); }
async function refresh(_req, res) { return sendSuccess(res, await currencyService.updateExchangeRates(), 'Cotações atualizadas.'); }
module.exports = { list, convert, refresh };
