const crypto = require('crypto');
const prisma = require('../config/database');

const sensitive = /password|token|secret|authorization|cookie|credential|cipher/i;
// Eventos financeiros/legais que NÃO podem ser perdidos em silêncio: se a escrita falhar,
// relançamos para o caller (tipicamente dentro de uma $transaction) decidir o rollback.
const criticalEvents = new Set(['loan_originated', 'loan_installment_received', 'loan_installment_receipt_reversed', 'loan_configuration_updated', 'financial_settings_updated', 'financial_holiday_created', 'financial_holiday_updated', 'financial_holiday_deleted']);
const hash = (value) => value ? crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex') : null;
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive.test(key)).map(([key, item]) => [key, sanitize(item)]));
}
function requestMeta(req) { return { ipAddress: String(req?.ip || req?.socket?.remoteAddress || '').slice(0, 64) || null, userAgent: String(req?.get?.('user-agent') || '').slice(0, 512) || null }; }
async function record({ eventType, req, actor = null, workspaceOwnerId = null, targetId = null, targetType = null, targetEmail = null, payload = null }) {
  const critical = criticalEvents.has(eventType);
  try {
    await prisma.auditLog.create({ data: { eventType, workspaceOwnerId: workspaceOwnerId || actor?.workspaceOwnerId || actor?.id || null, actorId: actor?.id || null, actorEmailHash: hash(actor?.email), targetId, targetType, targetEmailHash: hash(targetEmail), payload: sanitize(payload), ...requestMeta(req) } });
  } catch (error) {
    const detail = JSON.stringify({ event: 'audit_log_write_failed', eventType, error: error.code || error.name, message: error.message });
    if (critical) {
      console.error(detail);
      throw new Error(`Falha ao registrar evento de auditoria crítico (${eventType}). Operação abortada para não prosseguir sem rastro.`);
    }
    console.error(detail);
  }
}

module.exports = { record, hash, sanitize, criticalEvents };
