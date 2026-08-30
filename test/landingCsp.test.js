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

test('CSP permite a conexão auxiliar do CDN de ícones já autorizado', () => {
  assert.match(app, /connectSrc:\s*\[[^\]]*https:\/\/unpkg\.com[^\]]*\]/s);
});
