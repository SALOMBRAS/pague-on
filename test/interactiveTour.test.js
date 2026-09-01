const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDir = path.join(__dirname, '..', 'public');
const tour = fs.readFileSync(path.join(publicDir, 'onboarding.js'), 'utf8');
const css = fs.readFileSync(path.join(publicDir, 'onboarding.css'), 'utf8');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8');

test('tour keeps separate, short desktop and mobile step sets (5 steps)', () => {
  assert.match(tour, /const mobileSteps = \[/);
  assert.match(tour, /const desktopSteps = \[/);
  assert.match(tour, /MOBILE_QUERY = '\(max-width: 1023px\)'/);
  assert.match(tour, /data-nav="stock"/);
  assert.match(tour, /pagueon_tour_completed_v6/);
  assert.match(tour, /Bem-vindo ao Pague-On/);
  assert.match(tour, /Adicione uma conta/);
  assert.match(tour, /Acompanhe o caixa/);
  assert.match(tour, /Controle o estoque/);
  assert.match(tour, /Tudo no Perfil/);
  assert.match(tour, /pagueOnAuth\?\.getUser/);
  assert.match(tour, /autoStartedFor/);
  assert.match(tour, /pagueon:auth/);
  assert.match(tour, /Como usar o Pague-On/);
});

test('tour is non-blocking: skippable, no inert, keyboard accessible', () => {
  assert.match(tour, /aria-modal/);
  assert.match(tour, /ArrowRight/);
  assert.match(tour, /ArrowLeft/);
  assert.match(tour, /data-tour-skip/);
  assert.match(tour, /Escape.*stop/);
  assert.doesNotMatch(tour, /window\.confirm\(/);
  assert.doesNotMatch(tour, /app\.inert/);
  assert.doesNotMatch(tour, /Conclua este guia rápido para liberar o painel/);
  assert.match(css, /\.onboarding-skip/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /var\(--bg\) 82%/);
  assert.match(css, /width 480ms/);
  assert.match(tour, /function ensureOverlay\(\)/);
  assert.match(tour, /window\.requestAnimationFrame\(applyPosition\)/);
  assert.match(tour, /onboarding-ambient/);
  assert.match(css, /onboarding-actions button:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /onboarding-ambient-drift 16s ease-in-out/);
  assert.match(css, /animation: none/);
  assert.match(tour, /pague-mascot-user-v3\.png/);
  assert.match(css, /\.onboarding-mascot/);
});

test('tour CSS is present in the application and its offline shell', () => {
  assert.match(html, /href="\/onboarding\.css"/);
  assert.match(html, /href="\/financial-settings\.css"/);
  assert.match(serviceWorker, /'\/onboarding\.css'/);
  assert.match(serviceWorker, /'\/financial-settings\.css'/);
  assert.match(serviceWorker, /'\/financial-settings\.js'/);
  assert.match(serviceWorker, /'\/assets\/pague-mascot-v1\.png'/);
  assert.match(serviceWorker, /'\/assets\/pague-mascot-dollar-v2\.png'/);
  assert.match(serviceWorker, /'\/assets\/pague-mascot-user-v3\.png'/);
});
