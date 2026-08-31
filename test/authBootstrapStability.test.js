const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('sessão tem timeout, diagnóstico seguro e coordenação de refresh entre abas', () => {
  const auth = read('public/auth.js');

  assert.match(auth, /AUTH_TIMEOUT_MS = 12_000/);
  assert.match(auth, /requestWithTimeout/);
  assert.match(auth, /navigator\.locks\?\.request/);
  assert.match(auth, /pagueon\.auth\.refresh\.lock/);
  assert.match(auth, /\[AUTH\]/);
  assert.match(auth, /fetchWithAuth\(`\$\{apiBase\(\)\}\/auth\/me`/);
  assert.doesNotMatch(auth, /console\.(?:info|log)\([^\n]*(?:password|refreshToken|Authorization)/i);
});

test('bootstrap não duplica dashboard/perfil e dados offline são vinculados ao dono', () => {
  const app = read('public/app.js');

  assert.match(app, /let remoteHydration = null/);
  assert.match(app, /if\(remoteHydration\)return remoteHydration/);
  assert.match(app, /ownerId/);
  assert.match(app, /snapshot\?\.ownerId!==currentUserId/);
  assert.doesNotMatch(app, /window\.pagueOnApi\.get\('\/dashboard'\)/);
  assert.doesNotMatch(app, /window\.pagueOnApi\.get\('\/auth\/me'\)/);
  assert.match(app, /function scheduleRemoteHydration\(\)/);
  assert.match(app, /window\.setTimeout\(\(\)=>\{remoteHydrationTimer=null;hydrateRemote\(\);\},700\)/);
});

test('dashboard termina em erro após timeout e PWA troca a versão do shell', () => {
  const api = read('public/api.js');
  const dashboard = read('public/dashboard-financial.js');
  const worker = read('public/sw.js');
  const offline = read('public/offline.js');

  assert.match(api, /REQUEST_TIMEOUT_MS = 12_000/);
  assert.match(api, /API_TIMEOUT/);
  assert.match(dashboard, /window\.pagueOnApi\.get/);
  assert.match(dashboard, /setAttribute\('aria-busy', 'false'\)/);
  assert.match(dashboard, /Tentar novamente/);
  assert.match(dashboard, /inFlight/);
  assert.match(worker, /pagueon-shell-v24/);
  assert.doesNotMatch(offline, /navigator\.serviceWorker\.register/);
});
