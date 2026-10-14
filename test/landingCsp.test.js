const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const landing = fs.readFileSync(path.join(root, 'public', 'landing.html'), 'utf8');
const landingScript = fs.readFileSync(path.join(root, 'public', 'landing.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');

test('landing mantém conteúdo e menu utilizáveis sem scripts inline', () => {
  assert.match(landing, /<script src="\/landing\.js" defer><\/script>/);
  assert.doesNotMatch(landing, /<script>\s*const reduceMotion/);
  assert.match(landing, />Controle suas finanças sem complicação<\/span>/);
  assert.match(landing, /id="menuToggle"/);
  assert.match(landing, /class="menu-bars"/);
  assert.match(landing, /\.menu-bars i/);
  assert.match(landingScript, /menuToggle\?\.addEventListener\('click'/);
  assert.match(landingScript, /toggleDrawer\(true\)/);
});

test('CSP não depende mais de CDN de terceiros (ícones e OCR self-hosted)', () => {
  assert.doesNotMatch(app, /https:\/\/unpkg\.com/);
  assert.doesNotMatch(app, /https:\/\/cdn\.jsdelivr\.net/);
  assert.match(app, /scriptSrc:\s*\["'self'"\]/);
  assert.match(app, /connectSrc:\s*\["'self'"\]/);
});

test('painel financeiro tem carregamento acessível e respeita redução de movimento', () => {
  const dashboard = fs.readFileSync(path.join(root, 'public', 'dashboard-financial.js'), 'utf8');
  assert.match(dashboard, /Preparando seu resumo/);
  assert.match(dashboard, /role="status" aria-live="polite"/);
  assert.match(dashboard, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(dashboard, /data-financial-loading-status/);
  assert.match(dashboard, /margin:0 auto 13px/);
  assert.match(dashboard, /pagueon:financial-dashboard-settled/);
});
