// Entry point serverless para a Vercel.
// Reexporta o app Express (src/app) como handler default — a Vercel provê o
// handler HTTP. Não usamos src/server.js (que faria app.listen + cron interno);
// em serverless quem escuta é a plataforma. Cron interno fica desligado.
const app = require('../src/app');

export default function handler(req, res) {
  return app(req, res);
}