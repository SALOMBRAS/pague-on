const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDir = path.join(__dirname, '..', 'public');
const css = fs.readFileSync(path.join(publicDir, 'desktop-shell.css'), 'utf8');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8');

test('desktop shell starts at 1024px and uses a dedicated fixed sidebar', () => {
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /width: 256px/);
  assert.match(css, /\.desk-top/);
  assert.match(css, /position: sticky/);
  assert.match(css, /#mainView/);
});

test('desktop shell uses vector branding and remains available offline', () => {
  assert.match(html, /href="\/desktop-shell\.css"/);
  assert.match(html, /<div class="brand"><i aria-hidden="true"><svg/);
  assert.doesNotMatch(html, /<div class="brand"><i>🪙/);
  assert.match(serviceWorker, /'\/desktop-shell\.css'/);
});
