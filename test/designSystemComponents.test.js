const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDir = path.join(__dirname, '..', 'public');
const css = fs.readFileSync(path.join(publicDir, 'design-system.css'), 'utf8');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8');

test('design system exposes accessible dark neon primitives', () => {
  for (const selector of ['.po-button', '.po-card', '.po-field', '.po-input', '.po-badge', '.po-skeleton', '.po-empty']) {
    assert.ok(css.includes(selector), `missing ${selector}`);
  }
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /aria-invalid/);
  assert.match(css, /prefers-reduced-motion/);
});

test('the component stylesheet is part of the application and offline shell', () => {
  assert.match(html, /href="\/design-system\.css"/);
  assert.match(serviceWorker, /'\/design-system\.css'/);
});
