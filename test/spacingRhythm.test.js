const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDir = path.join(__dirname, '..', 'public');
const index = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(publicDir, 'spacing-rhythm.css'), 'utf8');

test('loads the shared spacing rhythm after feature styles', () => {
  assert.match(index, /<link rel="stylesheet" href="\/spacing-rhythm\.css">/);
  assert.ok(index.indexOf('/spacing-rhythm.css') > index.indexOf('/reports.css'));
});

test('keeps mobile pages, section titles, and controls on a consistent rhythm', () => {
  assert.match(styles, /--page-gutter: clamp\(16px, 4vw, 28px\)/);
  assert.match(styles, /--section-gap: 32px/);
  assert.match(styles, /--touch-target: 44px/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /\.dash-section, \.wealth-section, \.profile-section, \.stock-section/);
  assert.match(styles, /\.top-actions button, \.top-actions \.icon, \.dash-link, \.stock-tab/);
});
