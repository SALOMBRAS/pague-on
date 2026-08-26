// Entry point serverless para a Vercel.
// Reexporta o app Express (src/app.js) — a Vercel provê o handler.
// NÃO chamamos src/server.js (que faria app.listen + cron interno), pois em
// serverless quem escuta é a plataforma. O cron interno fica desligado
// (ENABLE_INTERNAL_CRON=false) — notificações programadas exigem cron externo.
module.exports = require('../src/app');
