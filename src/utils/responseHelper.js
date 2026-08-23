function sendSuccess(res, data, message, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    ...(message ? { message } : {}),
  });
}

function sendError(res, error, code = 'INTERNAL_ERROR', status = 500) {
  return res.status(status).json({ success: false, error, code });
}

module.exports = { sendSuccess, sendError };
