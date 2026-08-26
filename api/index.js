// Entry point serverless para a Vercel.
// Exporta o app Express (src/app) como handler default (formato que o
// @vercel/node roteia de forma confiável em produção).
// NÃO usamos src/server.js (que faria app.listen + cron interno) — em
// serverless quem escuta é a plataforma. Cron interno fica desligado.

const app = require('../src/app');
export default app;