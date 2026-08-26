// Entry point serverless para a Vercel.
// Exporta o app Express (src/app) como handler default.
// Se o app falhar ao carregar no boot, devolve o erro como resposta (produção)
// em vez de FUNCTION_INVOCATION_FAILED opaco.

let app;
try {
  app = require('../src/app');
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('[vercel-handler] falha ao carregar o app:', error && error.stack ? error.stack : String(error));
  app = function bootFailedHandler(_req, res) {
    res.status(500).json({ error: 'BOOT_FAILED', message: error ? error.message : 'unknown', stack: error ? error.stack : undefined });
  };
}

export default function handler(req, res) {
  return app(req, res);
}