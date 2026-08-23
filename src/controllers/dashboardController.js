const dashboardService = require('../services/dashboardService');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');

async function getDashboard(req, res) {
  const dashboard = await dashboardService.getDashboard(req.user);
  return sendSuccess(res, serialize(dashboard));
}

module.exports = { getDashboard };
