const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const tokens = fs.readFileSync(path.join(__dirname, '..', 'public', 'tokens.css'), 'utf8');
const theme = fs.readFileSync(path.join(__dirname, '..', 'public', 'theme.js'), 'utf8');

test('the default theme is the Pague On Dark Neon palette', () => {
  assert.match(tokens, /--neon-canvas:\s*#0a0a0a;/i);
  assert.match(tokens, /--neon-surface:\s*#141414;/i);
  assert.match(tokens, /--neon-elevated:\s*#1e1e1e;/i);
  assert.match(tokens, /--neon-primary:\s*#76ff03;/i);
  assert.match(tokens, /--neon-secondary:\s*#00e5ff;/i);
  assert.match(tokens, /--bg:\s*var\(--neon-canvas\);/);
});

test('tokens preserve compatible semantic aliases and accessibility foundations', () => {
  for (const token of ['--pague-primary', '--color-brand', '--focus-ring', '--font-sans', '--z-modal']) {
    assert.ok(tokens.includes(token), `missing ${token}`);
  }
  assert.match(tokens, /font-variant-numeric:\s*tabular-nums/);
  assert.match(tokens, /prefers-reduced-motion/);
  assert.match(tokens, /:focus-visible/);
  assert.match(tokens, /\.sr-only/);
});

test('theme bootstrap uses dark neon before the application renders', () => {
  assert.match(theme, /saved === 'light' \|\| saved === 'dark'\) \? saved : 'dark'/);
  assert.match(theme, /#0a0a0a/);
  assert.match(theme, /#76ff03/);
});
