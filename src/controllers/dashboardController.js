const dashboardService = require('../services/dashboardService');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const { dashboardQuerySchema } = require('../utils/validators');

async function getDashboard(req, res) {
  const dashboard = await dashboardService.getDashboard(req.user);
  return sendSuccess(res, serialize(dashboard));
}

async function financial(req, res) {
  const { dashboard, timings } = await dashboardService.getFinancialDashboardWithTiming(req.user.id, dashboardQuerySchema.parse(req.query));
  const serverTiming = Object.entries(timings)
    .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
    .join(', ');
  if (serverTiming) res.set('Server-Timing', serverTiming);
  return sendSuccess(res, serialize(dashboard));
}

module.exports = { getDashboard, financial };
