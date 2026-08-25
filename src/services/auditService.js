const crypto = require('crypto');
const prisma = require('../config/database');

const sensitive = /password|token|secret|authorization|cookie|credential|cipher/i;
const hash = (value) => value ? crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex') : null;
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive.test(key)).map(([key, item]) => [key, sanitize(item)]));
}
function requestMeta(req) { return { ipAddress: String(req?.ip || req?.socket?.remoteAddress || '').slice(0, 64) || null, userAgent: String(req?.get?.('user-agent') || '').slice(0, 512) || null }; }
async function record({ eventType, req, actor = null, workspaceOwnerId = null, targetId = null, targetType = null, targetEmail = null, payload = null }) {
  try {
    await prisma.auditLog.create({ data: { eventType, workspaceOwnerId: workspaceOwnerId || actor?.workspaceOwnerId || actor?.id || null, actorId: actor?.id || null, actorEmailHash: hash(actor?.email), targetId, targetType, targetEmailHash: hash(targetEmail), payload: sanitize(payload), ...requestMeta(req) } });
  } catch (error) { console.warn(JSON.stringify({ event: 'audit_log_write_failed', eventType, error: error.code || error.name })); }
}

module.exports = { record, hash, sanitize };
