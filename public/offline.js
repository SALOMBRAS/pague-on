(() => {
  const DB_NAME = 'pagueon-local';
  const DB_VERSION = 1;
  const STATE_KEY = 'current-state';
  let database;
  let status = navigator.onLine ? 'online' : 'offline';

  const request = (value) => new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
  const completed = (transaction) => new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });

  async function open() {
    if (database) return database;
    const opening = indexedDB.open(DB_NAME, DB_VERSION);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains('appState')) db.createObjectStore('appState', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('syncQueue')) { const queue = db.createObjectStore('syncQueue', { keyPath: 'id' }); queue.createIndex('createdAt', 'createdAt', { unique: false }); }
      if (!db.objectStoreNames.contains('syncMeta')) db.createObjectStore('syncMeta', { keyPath: 'key' });
    };
    database = await request(opening);
    return database;
  }

  function renderConnectionStatus() {
    const labels = { online: '● Online', offline: '● Offline', syncing: '◌ Sincronizando', local: '● Salvo neste dispositivo' };
    document.querySelectorAll('[data-connection-status]').forEach((node) => { node.textContent = labels[status] || labels.online; node.dataset.status = status; });
  }
  function setStatus(next) { status = next; renderConnectionStatus(); window.dispatchEvent(new CustomEvent('pagueon:connection', { detail: { status } })); }
  function operationId() { return globalThis.crypto?.randomUUID?.() || `op-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

  async function readState() { const db = await open(); const tx = db.transaction('appState', 'readonly'); const result = await request(tx.objectStore('appState').get(STATE_KEY)); await completed(tx); return result?.value || null; }
  async function commit(snapshot, changes = []) {
    const db = await open(); const tx = db.transaction(['appState', 'syncQueue'], 'readwrite');
    tx.objectStore('appState').put({ key: STATE_KEY, value: snapshot, savedAt: new Date().toISOString() });
    const queue = tx.objectStore('syncQueue');
    changes.forEach((change) => queue.put({ id: operationId(), entity: change.entity, action: change.action, payload: change.payload, baseRevision: change.baseRevision ?? null, createdAt: new Date().toISOString(), retryCount: 0 }));
    await completed(tx);
    if (navigator.onLine) sync().catch(() => undefined);
  }
  async function queueItems() { const db = await open(); const tx = db.transaction('syncQueue', 'readonly'); const items = await request(tx.objectStore('syncQueue').getAll()); await completed(tx); return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
  async function deviceId() { const db = await open(); const tx = db.transaction('syncMeta', 'readwrite'); const store = tx.objectStore('syncMeta'); let record = await request(store.get('deviceId')); if (!record) { record = { key: 'deviceId', value: operationId() }; store.put(record); } await completed(tx); return record.value; }
  async function sync() {
    if (!navigator.onLine) return setStatus('offline');
    const token = window.pagueOnAuth?.getToken?.() || '';
    if (!token) return setStatus('local');
    const changes = await queueItems(); if (!changes.length) return setStatus('online'); setStatus('syncing');
    try {
      const response = await fetch('/api/v1/sync/push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ changes, deviceId: await deviceId() }) });
      if (!response.ok) throw new Error('Sync indisponível.');
      const result = await response.json(); const processed = new Set(result?.data?.processedIds || []); const db = await open(); const tx = db.transaction('syncQueue', 'readwrite'); changes.filter((change) => processed.has(change.id)).forEach((change) => tx.objectStore('syncQueue').delete(change.id)); await completed(tx); setStatus('online');
    } catch (_error) { setStatus('offline'); }
  }
  async function boot({ hydrate } = {}) { await open(); const snapshot = await readState(); if (snapshot) hydrate?.(snapshot); renderConnectionStatus(); window.addEventListener('online', () => sync().catch(() => undefined)); window.addEventListener('offline', () => setStatus('offline')); if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined); if (navigator.onLine) sync().catch(() => undefined); }
  window.pagueOnOffline = { boot, commit, sync, renderConnectionStatus, get status() { return status; } };
})();
