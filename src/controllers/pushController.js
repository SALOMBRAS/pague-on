const { pushSubscriptionSchema, pushUnsubscribeSchema } = require('../utils/validators');
const pushService = require('../services/pushService');
const { sendSuccess } = require('../utils/responseHelper');

async function config(_req, res) { return sendSuccess(res, { configured: pushService.isConfigured(), publicKey: pushService.isConfigured() ? process.env.VAPID_PUBLIC_KEY : null }); }
async function subscribe(req, res) { await pushService.saveSubscription(req.user.id, pushSubscriptionSchema.parse(req.body)); return sendSuccess(res, { subscribed: true }, 'Notificações ativadas neste dispositivo.', 201); }
async function unsubscribe(req, res) { return sendSuccess(res, await pushService.removeSubscription(req.user.id, pushUnsubscribeSchema.parse(req.body).endpoint), 'Dispositivo removido das notificações.'); }
async function test(req, res) { const result = await pushService.sendToUser(req.user.id, { title: '🔔 Pague-On', body: 'As notificações deste dispositivo estão funcionando.', type: 'SYSTEM', data: { path: '#perfil' } }); return sendSuccess(res, result, result.delivered ? 'Notificação de teste enviada.' : 'Preferências salvas. Configure as chaves VAPID para receber avisos em segundo plano.'); }

module.exports = { config, subscribe, unsubscribe, test };
