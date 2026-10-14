const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDir = path.join(__dirname, '..', 'public');
const css = fs.readFileSync(path.join(publicDir, 'mobile-shell.css'), 'utf8');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8');

test('mobile shell has safe areas, a 56px add action and no desktop sidebar', () => {
  assert.match(css, /@media \(max-width: 1023px\)/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /height: 56px/);
  assert.match(css, /\.side-nav, \.desk-top \{ display: none !important; \}/);
});

test('mobile navigation keeps home and summary before add, then stock and profile', () => {
  const nav = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.match(nav, /data-nav="home"/);
  assert.match(nav, /data-nav="caixa"[^>]*aria-label="Resumo"/);
  assert.match(nav, /id="centerAdd"/);
  assert.match(nav, /data-nav="stock"[^>]*aria-label="Estoque"/);
  assert.match(nav, /data-nav="profile"/);
  assert.ok(nav.indexOf('data-nav="home"') < nav.indexOf('id="centerAdd"'));
  assert.ok(nav.indexOf('data-nav="caixa"') < nav.indexOf('id="centerAdd"'));
  assert.ok(nav.indexOf('id="centerAdd"') < nav.indexOf('data-nav="stock"'));
  assert.ok(nav.indexOf('data-nav="stock"') < nav.indexOf('data-nav="profile"'));
  assert.doesNotMatch(nav, /data-nav="goals"/);
  assert.match(serviceWorker, /'\/mobile-shell\.css'/);
});
