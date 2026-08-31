const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDir = path.join(__dirname, '..', 'public');
const css = fs.readFileSync(path.join(publicDir, 'desktop-financial-dashboard.css'), 'utf8');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8');

test('financial dashboard has a desktop-only dark neon treatment', () => {
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /#homeView \.financial-filters/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /var\(--glow-primary\)/);
});

test('financial dashboard style is delivered in the online and offline shell', () => {
  assert.match(html, /href="\/desktop-financial-dashboard\.css"/);
  assert.match(serviceWorker, /'\/desktop-financial-dashboard\.css'/);
});
