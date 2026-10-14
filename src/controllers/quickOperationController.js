const { quickProductPreviewSchema } = require('../utils/validators');
const { previewProductOperation } = require('../services/quickOperationService');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');

function previewProduct(req, res) {
  const preview = previewProductOperation(quickProductPreviewSchema.parse(req.body));
  return sendSuccess(res, serialize(preview));
}

module.exports = { previewProduct };
