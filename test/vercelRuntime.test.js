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
  assert.equal(config.headers[0].headers[0].key, 'Cache-Control');
  assert.match(config.headers[0].headers[0].value, /s-maxage=3600/);
});
