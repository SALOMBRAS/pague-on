// Versão deliberada do shell: obriga a troca atômica do cache depois da
// correção do bootstrap de autenticação, evitando que mobile execute JS antigo.
const CACHE_NAME = 'pagueon-shell-v24';
const APP_SHELL = [
  '/',
  '/index.html',
  '/landing.html',
  '/app',
  '/manifest.webmanifest',
  '/tokens.css',
  '/design-system.css',
  '/app.css',
  '/ui-enhancements.css',
  '/mobile-fintech.css',
  '/desktop-dashboard.css',
  '/desktop-shell.css',
  '/mobile-shell.css',
  '/desktop-financial-dashboard.css',
  '/onboarding.css',
  '/theme.js',
  '/icons.js',
  '/ui-components.js',
  '/app.js',
  '/offline.js',
  '/pwa-install.js',
  '/api.js',
  '/auth.js',
  '/quick-operation.js',
  '/quick-operation.css',
  '/security.js',
  '/export.js',
  '/scanner.js',
  '/widget.js',
  '/onboarding.js',
  '/networth.js',
  '/reconciliation.js',
  '/budget.js',
  '/duplicate.js',
  '/currency.js',
  '/statement-import.js',
  '/push.js',
  '/people.js',
  '/dashboard-financial.js',
  '/dashboard-financial-charts.js',
  '/financial-accounts.js',
  '/goals.js',
  '/collectors.js',
  '/loan-origination.js',
  '/loan-receipts.js',
  '/views/caixa.js',
  '/views/estoque.js',
  '/views/metas.js',
  '/views/perfil.js',
  '/views/regras.js',
  '/views/notificacoes.js',
  '/views/busca.js',
  '/views/forms.js',
  '/icons/pague-on.svg',
  '/icons/pague-on-maskable.svg',
];

// Um asset ausente não pode abortar a instalação inteira: cache.addAll() rejeita
// tudo se UMA url falhar, e o app ficaria sem shell offline por causa de um 404.
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))); self.skipWaiting(); });
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())));

// Só entra no cache resposta que veio inteira. Antes um 404 era cacheado como
// qualquer outra, e o erro grudava até o CACHE_NAME mudar.
const cacheable = (response) => response && response.ok && response.type !== 'opaque';
const store = (request, response) => { if (cacheable(response)) { const clone = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)); } return response; };

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Cross-origin não passa por aqui. A CSP do documento tem connect-src 'self',
  // então um fetch() do worker para fonts.googleapis.com é bloqueado — e o
  // fallback devolvia HTML no lugar do CSS, que o navegador recusa por MIME.
  // Fora do worker o mesmo <link> é regido por style-src, que permite as fontes.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Navegação (documento): rede primeiro; se falhar, cai no cache do app shell.
  // Nunca devolve undefined — se não houver nada em cache, retorna um Response
  // mínimo em vez de "Failed to convert value to 'Response'".
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request)
      .then((response) => store(request, response))
      .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/').then((root) => root || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })))));
    return;
  }

  // Assets: rede primeiro, cache como plano B. Nunca retornar undefined.
  event.respondWith(fetch(request)
    .then((response) => store(request, response))
    .catch(() => caches.match(request).then((cached) => cached || new Response('', { status: 504, headers: { 'Content-Type': 'text/plain' } }))));
});

const DEFAULT_WIDGET = { enabled: false, balance: true, receive: true, pay: true, urgent: true, upcoming: false, addDebt: true, collect: true, interval: 15 };
const widgetDb = () => new Promise((resolve, reject) => { const open = indexedDB.open('pagueon-local', 1); open.onupgradeneeded = () => { const db = open.result; if (!db.objectStoreNames.contains('appState')) db.createObjectStore('appState', { keyPath: 'key' }); if (!db.objectStoreNames.contains('syncQueue')) db.createObjectStore('syncQueue', { keyPath: 'id' }); if (!db.objectStoreNames.contains('syncMeta')) db.createObjectStore('syncMeta', { keyPath: 'key' }); }; open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
async function widgetStoredState() { const db = await widgetDb(); const transaction = db.transaction(['appState', 'syncMeta'], 'readonly'); const app = transaction.objectStore('appState').get('current-state'); const settings = transaction.objectStore('syncMeta').get('widgetConfig'); const [state, config] = await Promise.all([new Promise((resolve, reject) => { app.onsuccess = () => resolve(app.result?.value); app.onerror = () => reject(app.error); }), new Promise((resolve, reject) => { settings.onsuccess = () => resolve(settings.result?.value); settings.onerror = () => reject(settings.error); })]); return { snapshot: state, config: { ...DEFAULT_WIDGET, ...(config || {}) } }; }
function widgetTotals(snapshot) { const now = new Date(); const debts = snapshot?.debts || []; return debts.reduce((totals, debt) => { if (debt.status === 'PAID' || debt.status === 'CANCELLED') return totals; const amount = Number(debt.totalAmount ?? debt.amount ?? debt.total ?? 0); if (debt.type === 'RECEIVABLE') totals.receive += amount; else totals.pay += amount; const due = new Date(debt.dueDate || debt.due); const days = Math.ceil((due - now) / 86400000); if (Number.isFinite(days) && days <= 3) totals.urgent += 1; if (Number.isFinite(days) && days >= 0 && days <= 7) totals.upcoming += 1; return totals; }, { receive: 0, pay: 0, urgent: 0, upcoming: 0 }); }
const widgetMoney = (value) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function showWidget(snapshot, suppliedConfig) { const stored = suppliedConfig ? { snapshot, config: { ...DEFAULT_WIDGET, ...suppliedConfig } } : await widgetStoredState(); const config = stored.config; if (!config.enabled) return; const totals = widgetTotals(snapshot || stored.snapshot); const parts = []; if (config.balance) parts.push(`💰 Saldo: R$ ${widgetMoney(totals.receive - totals.pay)}`); if (config.receive) parts.push(`📥 R$ ${widgetMoney(totals.receive)}`); if (config.pay) parts.push(`📤 R$ ${widgetMoney(totals.pay)}`); if (config.urgent && totals.urgent) parts.push(`⚠️ ${totals.urgent} urgente${totals.urgent > 1 ? 's' : ''}`); if (config.upcoming && totals.upcoming) parts.push(`📅 ${totals.upcoming} próximo${totals.upcoming > 1 ? 's' : ''}`); await self.registration.showNotification('Pague-On', { body: parts.join('  | ') || 'Seu resumo financeiro está atualizado.', tag: 'pagueon-widget', requireInteraction: true, silent: true, actions: [{ action: 'open', title: 'Abrir' }, ...(config.addDebt ? [{ action: 'add-debt', title: '+ Dívida' }] : []), ...(config.collect ? [{ action: 'collect', title: 'Cobrar' }] : [])], data: { type: 'widget' } }); }
self.addEventListener('message', (event) => { if (event.data?.type === 'update-widget') event.waitUntil(showWidget(event.data.snapshot, event.data.config)); });
self.addEventListener('periodicsync', (event) => { if (event.tag === 'update-widget') event.waitUntil(showWidget()); });
self.addEventListener('notificationclick', (event) => { if (event.notification.tag !== 'pagueon-widget') return; event.notification.close(); const target = event.action === 'add-debt' ? '/index.html#add-debt' : event.action === 'collect' ? '/index.html#urgent' : '/index.html'; event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => { const existing = windows.find((client) => new URL(client.url).origin === self.location.origin); return existing ? existing.navigate(target).then(() => existing.focus()) : clients.openWindow(target); })); });
self.addEventListener('push', (event) => { let data = {}; try { data = event.data?.json() || {}; } catch (_error) { data = { body: event.data?.text() || '' }; } event.waitUntil(self.registration.showNotification(data.title || 'Pague-On', { body: data.body || 'Você tem uma atualização financeira.', tag: data.tag || 'pagueon-notification', data: data.payload || {}, silent: Boolean(data.silent), actions: [{ action: 'view', title: 'Ver' }, { action: 'dismiss', title: 'Ignorar' }] })); });
self.addEventListener('notificationclick', (event) => { if (event.notification.tag === 'pagueon-widget') return; event.notification.close(); if (event.action === 'dismiss') return; const path = event.notification.data?.path || '/index.html#home'; const target = path.startsWith('/') ? path : `/index.html${path}`; event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => { const existing = windows.find((client) => new URL(client.url).origin === self.location.origin); return existing ? existing.navigate(target).then(() => existing.focus()) : clients.openWindow(target); })); });
