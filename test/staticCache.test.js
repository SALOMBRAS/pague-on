const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('assets estáticos usam CDN sem atrasar a atualização do service worker', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.match(app, /s-maxage=3600/);
  assert.match(app, /stale-while-revalidate=86400/);
  assert.match(app, /sw\\\.js/);
});
