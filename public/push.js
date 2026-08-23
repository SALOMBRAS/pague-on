(() => {
  const STORAGE_KEY = 'pagueon.push-preferences.v1';
  const defaults = { dueReminderDays: 3, budgetAlerts: true, stockAlerts: true, weeklyDigest: true, monthlyDigest: false, notificationSound: 'DEFAULT', enabled: false };
  const preferences = () => ({ ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') });
  const save = (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  const apiBase = () => location.port === '5500' ? 'http://localhost:3000/api/v1' : '/api/v1';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pagueon.token') || ''}` });
  const hasSession = () => Boolean(localStorage.getItem('pagueon.token'));
  const notify = (message) => window.showToast ? window.showToast(message) : alert(message);
  const vapidKey = (value) => {
    const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  };

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase()}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error?.message || result.message || 'Não foi possível atualizar as notificações.');
    return result.data;
  }

  async function syncPreferences(value) {
    if (!hasSession()) return;
    await request('/auth/me', { method: 'PUT', body: JSON.stringify({ dueReminderDays: value.dueReminderDays, budgetAlerts: value.budgetAlerts, stockAlerts: value.stockAlerts, weeklyDigest: value.weeklyDigest, monthlyDigest: value.monthlyDigest, notificationSound: value.notificationSound, notificationEnabled: value.enabled }) });
  }

  async function enable() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('Seu navegador não oferece notificações para este app.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permita as notificações para ativar os lembretes.');
    const value = preferences(); value.enabled = true; save(value);
    if (hasSession()) {
      const config = await request('/push/config');
      if (config.configured && config.publicKey) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(config.publicKey) });
        await request('/push/subscribe', { method: 'POST', body: JSON.stringify(subscription.toJSON()) });
      }
      await syncPreferences(value);
    }
    refreshSettings();
    return value;
  }

  async function disable() {
    const value = preferences(); value.enabled = false; save(value);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription && hasSession()) await request('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) });
      await subscription?.unsubscribe();
      await syncPreferences(value);
    } catch (_error) { /* O consentimento local é removido mesmo sem conexão. */ }
    refreshSettings();
  }

  async function test() {
    const value = preferences();
    if (!value.enabled) await enable();
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('🔔 Pague-On', { body: 'Tudo pronto: seus lembretes estão ativos neste dispositivo.', tag: 'pagueon-test', data: { path: '#perfil' }, silent: value.notificationSound === 'SILENT' });
    if (hasSession()) request('/push/test', { method: 'POST' }).catch(() => null);
    notify('Notificação de teste enviada.');
  }

  async function updatePreference(key, input) {
    const value = preferences(); value[key] = input; save(value);
    try { await syncPreferences(value); } catch (error) { notify(error.message); }
  }

  function refreshSettings() {
    document.querySelector('[data-push-controls]')?.remove();
    queueMicrotask(renderSettings);
  }

  function toggle(label, key, checked) { return `<div class="push-setting"><span><label>${label}</label></span><input type="checkbox" data-push-toggle="${key}" ${checked ? 'checked' : ''}></div>`; }
  function renderSettings() {
    const profile = document.querySelector('#profileView.show');
    if (!profile) return;
    if (profile.querySelector('[data-push-controls]')) return;
    const value = preferences();
    const section = document.createElement('section'); section.className = 'profile-section'; section.dataset.pushControls = 'true';
    section.innerHTML = `<h2>🔔 NOTIFICAÇÕES INTELIGENTES</h2><div class="settings-card push-card"><div class="push-setting"><span><label>Notificações neste dispositivo</label><small>${value.enabled ? 'Ativadas com seu consentimento' : 'Ative para receber alertas'}</small></span><button class="push-state ${value.enabled ? 'on' : ''}" data-push-enable>${value.enabled ? 'Ativadas' : 'Ativar'}</button></div><div class="push-setting"><label>Lembretes de vencimento</label><select data-push-days>${[0,1,2,3,5,7].map((days) => `<option value="${days}" ${Number(value.dueReminderDays) === days ? 'selected' : ''}>${days === 0 ? 'No dia do vencimento' : `${days} dia${days > 1 ? 's' : ''} antes`}</option>`).join('')}</select></div>${toggle('Alertas de orçamento', 'budgetAlerts', value.budgetAlerts)}${toggle('Alertas de estoque', 'stockAlerts', value.stockAlerts)}${toggle('Resumo semanal (segunda, 8h)', 'weeklyDigest', value.weeklyDigest)}${toggle('Resumo mensal (dia 1, 9h)', 'monthlyDigest', value.monthlyDigest)}<div class="push-setting"><label>Som de notificação</label><select data-push-sound><option value="DEFAULT" ${value.notificationSound === 'DEFAULT' ? 'selected' : ''}>Padrão</option><option value="SILENT" ${value.notificationSound === 'SILENT' ? 'selected' : ''}>Silencioso</option></select></div><button class="push-test" data-push-test>Enviar notificação de teste</button></div>`;
    profile.querySelector('.signout')?.before(section);
    section.querySelector('[data-push-enable]').onclick = async () => { try { value.enabled ? await disable() : await enable(); } catch (error) { notify(error.message); } };
    section.querySelector('[data-push-days]').onchange = (event) => updatePreference('dueReminderDays', Number(event.target.value));
    section.querySelectorAll('[data-push-toggle]').forEach((input) => input.onchange = (event) => updatePreference(event.target.dataset.pushToggle, event.target.checked));
    section.querySelector('[data-push-sound]').onchange = (event) => updatePreference('notificationSound', event.target.value);
    section.querySelector('[data-push-test]').onclick = () => test().catch((error) => notify(error.message));
  }

  function addStyles() {
    const style = document.createElement('style'); style.textContent = `.push-card .push-setting{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 0;border-bottom:1px solid var(--line)}.push-card .push-setting:last-of-type{border-bottom:0}.push-setting label{font-size:13px;color:var(--text)}.push-setting small{display:block;margin-top:4px;color:var(--dim);font-size:10px}.push-setting select{min-height:34px;max-width:150px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);padding:0 8px}.push-setting input{accent-color:var(--green);width:19px;height:19px}.push-state,.push-test{border:1px solid var(--green);border-radius:9px;background:var(--green-bg);color:var(--green);font-weight:800;padding:8px 10px;font-size:11px}.push-state.on{border-color:var(--line);background:var(--surface);color:var(--muted)}.push-test{width:100%;margin-top:13px;background:var(--green);color:#062916}`; document.head.append(style);
  }
  addStyles();
  new MutationObserver(renderSettings).observe(document.querySelector('#profileView'), { childList: true, subtree: true });
  window.pagueOnPush = { enable, disable, test, preferences };
})();
