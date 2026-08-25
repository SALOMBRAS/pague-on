const dashboardService = require('../services/dashboardService');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const { dashboardQuerySchema } = require('../utils/validators');

async function getDashboard(req, res) {
  const dashboard = await dashboardService.getDashboard(req.user);
  return sendSuccess(res, serialize(dashboard));
}

async function financial(req, res) { return sendSuccess(res, serialize(await dashboardService.getFinancialDashboard(req.user.id, dashboardQuerySchema.parse(req.query)))); }

module.exports = { getDashboard, financial };
