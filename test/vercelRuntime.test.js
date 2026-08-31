const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('as functions da Vercel executam na mesma região do Supabase', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.deepEqual(config.regions, ['gru1']);
});

test('assets públicos recebem cache de CDN pela configuração da Vercel', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.match(config.routes[0].src, /css\|js/);
  assert.equal(config.routes[0].headers['Cache-Control'].includes('s-maxage=3600'), true);
  assert.equal(config.routes[0].continue, true);
  assert.equal(config.functions['api/index.js'].maxDuration, 30);
  assert.equal(config.functions['api/index.js'].memory, 1024);
  assert.ok(config.routes.some((route) => route.handle === 'filesystem'));
  assert.equal(config.routes.find((route) => route.dest === 'api/index.js' && route.src.includes('/app')).src, '/app$');
});
