(() => {
  const STORAGE_KEY = 'pagueon.device-security.v1';
  const SESSION_KEY = 'pagueon.device-unlocked';
  let pin = '';
  let setupFirstPin = '';
  let mode = 'unlock';
  let lockTimer;
  const config = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"lockTimeout":5,"hideValues":false,"biometricPreferred":false,"failedAttempts":0,"lockedUntil":0}');
  const save = (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  const bytesToHex = (bytes) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const hashPin = async (value, salt) => { const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']); return bytesToHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: Uint8Array.from(salt.match(/.{2}/g).map((byte) => parseInt(byte, 16))), iterations: 210000, hash: 'SHA-256' }, material, 256)); };
  const randomSalt = () => { const bytes = new Uint8Array(16); crypto.getRandomValues(bytes); return bytesToHex(bytes); };
  const emit = () => window.dispatchEvent(new CustomEvent('pagueon:security', { detail: config() }));
  const overlay = () => document.querySelector('#lockScreen');
  const base64UrlToBuffer = (value) => { const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='); return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)); };
  const bufferToBase64Url = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const api = () => location.port === '5500' ? 'http://localhost:3000/api/v1/auth' : '/api/v1/auth';
  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pagueon.token') || ''}` });

  function renderLock(message = '') {
    const security = config(); const locked = security.lockedUntil > Date.now(); const dots = Array.from({ length: 6 }, (_, index) => `<i class="pin-dot ${index < pin.length ? 'filled' : ''}"></i>`).join('');
    overlay().innerHTML = `<div class="lock-card"><div class="lock-logo">$</div><p class="eyebrow">Pague-On protegido</p><h1>${mode === 'setup' ? (setupFirstPin ? 'Confirme o PIN' : 'Crie seu PIN') : 'App bloqueado'}</h1><p class="lock-copy">${message || (locked ? `Tente novamente em ${Math.ceil((security.lockedUntil - Date.now()) / 60000)} min.` : mode === 'setup' ? 'Use de 4 a 6 dígitos.' : 'Digite seu PIN para continuar.')}</p>${mode !== 'setup' && security.biometricPreferred ? '<button class="biometric-button" data-biometric>◉ Usar biometria / Face ID</button><span class="lock-or">ou</span>' : ''}<div class="pin-dots">${dots}</div><div class="pin-pad">${[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map((key) => `<button data-pin-key="${key}" ${locked ? 'disabled' : ''}>${key}</button>`).join('')}</div>${mode === 'setup' ? '<button class="lock-secondary" data-lock-cancel>Cancelar</button>' : ''}</div>`;
    overlay().classList.add('show');
    overlay().querySelectorAll('[data-pin-key]').forEach((button) => button.onclick = () => enterKey(button.dataset.pinKey));
    overlay().querySelector('[data-biometric]')?.addEventListener('click', authenticateBiometric);
    overlay().querySelector('[data-lock-cancel]').onclick = () => { if (mode === 'setup') { pin = ''; setupFirstPin = ''; overlay().classList.remove('show'); } };
  }
  function unlock() { sessionStorage.setItem(SESSION_KEY, '1'); pin = ''; overlay().classList.remove('show'); resetTimer(); }
  async function enterKey(key) {
    if (key === '⌫') pin = pin.slice(0, -1); else if (key !== '✓' && pin.length < 6) pin += key;
    const minLength = 4;
    if ((key === '✓' || pin.length >= minLength) && pin.length >= minLength) {
      if (mode === 'setup') {
        if (!setupFirstPin) { setupFirstPin = pin; pin = ''; return renderLock('Repita o PIN para confirmar.'); }
        if (pin !== setupFirstPin) { pin = ''; setupFirstPin = ''; return renderLock('Os PINs não coincidem. Tente novamente.'); }
        const security = config(); security.salt = randomSalt(); security.pinHash = await hashPin(pin, security.salt); security.failedAttempts = 0; security.lockedUntil = 0; save(security); emit(); unlock(); return;
      }
      const security = config(); const correct = security.pinHash && (await hashPin(pin, security.salt)) === security.pinHash;
      if (correct) { security.failedAttempts = 0; security.lockedUntil = 0; save(security); emit(); return unlock(); }
      security.failedAttempts = (security.failedAttempts || 0) + 1; if (security.failedAttempts >= 3) security.lockedUntil = Date.now() + 5 * 60 * 1000; save(security); pin = ''; return renderLock(`PIN incorreto. ${Math.max(0, 3 - security.failedAttempts)} tentativa(s) restante(s).`);
    }
    renderLock();
  }
  async function authenticateBiometric() {
    if (!window.PublicKeyCredential) return renderLock('Biometria não é suportada neste navegador.');
    const token = localStorage.getItem('pagueon.token'); if (!token) return renderLock('Faça login na conta sincronizada para usar biometria.');
    try {
      const optionsResponse = await fetch(`${api()}/biometric/authentication/options`, { method: 'POST', headers: authHeaders() }); const optionsResult = await optionsResponse.json(); if (!optionsResponse.ok) throw new Error(optionsResult.error);
      const options = optionsResult.data; options.challenge = base64UrlToBuffer(options.challenge); options.allowCredentials = (options.allowCredentials || []).map((credential) => ({ ...credential, id: base64UrlToBuffer(credential.id) }));
      const credential = await navigator.credentials.get({ publicKey: options }); const response = { id: credential.id, rawId: bufferToBase64Url(credential.rawId), type: credential.type, response: { authenticatorData: bufferToBase64Url(credential.response.authenticatorData), clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON), signature: bufferToBase64Url(credential.response.signature), userHandle: credential.response.userHandle ? bufferToBase64Url(credential.response.userHandle) : undefined } };
      const verify = await fetch(`${api()}/biometric/authentication/verify`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ credential: response }) }); if (!verify.ok) throw new Error('Biometria não confirmada.'); unlock();
    } catch (error) { renderLock(error.message || 'Não foi possível usar a biometria.'); }
  }
  async function registerBiometric() {
    if (!window.PublicKeyCredential || !(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())) throw new Error('Biometria ou Face ID não está disponível neste dispositivo.');
    const token = localStorage.getItem('pagueon.token'); if (!token) throw new Error('Faça login na conta sincronizada antes de ativar biometria.');
    const response = await fetch(`${api()}/biometric/registration/options`, { method: 'POST', headers: authHeaders() }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível iniciar a biometria.'); const options = result.data; options.challenge = base64UrlToBuffer(options.challenge); options.user.id = base64UrlToBuffer(options.user.id); options.excludeCredentials = (options.excludeCredentials || []).map((credential) => ({ ...credential, id: base64UrlToBuffer(credential.id) }));
    const credential = await navigator.credentials.create({ publicKey: options }); const data = { id: credential.id, rawId: bufferToBase64Url(credential.rawId), type: credential.type, response: { clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON), attestationObject: bufferToBase64Url(credential.response.attestationObject), transports: credential.response.getTransports?.() || [] } };
    const verify = await fetch(`${api()}/biometric/registration/verify`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ credential: data }) }); const verified = await verify.json(); if (!verify.ok) throw new Error(verified.error || 'Não foi possível ativar a biometria.'); const security = config(); security.biometricPreferred = true; save(security); emit();
  }
  function setupPin() { mode = 'setup'; pin = ''; setupFirstPin = ''; renderLock(); }
  function lock() { if (!config().pinHash && !config().biometricPreferred) return; mode = 'unlock'; pin = ''; sessionStorage.removeItem(SESSION_KEY); renderLock(); }
  function resetTimer() { clearTimeout(lockTimer); const security = config(); if (!sessionStorage.getItem(SESSION_KEY) || (!security.pinHash && !security.biometricPreferred)) return; lockTimer = setTimeout(lock, Math.max(1, security.lockTimeout || 5) * 60 * 1000); }
  function augmentProfile() {
    const profile = document.querySelector('#profileView.show');
    if (!profile || profile.querySelector('[data-security-controls]')) return;
    const security = config();
    const section = document.createElement('section');
    section.className = 'profile-section'; section.dataset.securityControls = 'true';
    section.innerHTML = `<h2>⏱️ BLOQUEIO AUTOMÁTICO</h2><div class="settings-card"><div class="setting"><label>Bloquear após inatividade</label><select data-security-timeout aria-label="Tempo para bloquear">${[1,5,10,15,30,60].map((minutes) => `<option value="${minutes}" ${Number(security.lockTimeout || 5) === minutes ? 'selected' : ''}>${minutes} min</option>`).join('')}</select></div><button class="setting" data-lock-now><label>Bloquear agora</label><span class="chev">›</span></button></div>`;
    profile.querySelector('.signout')?.before(section);
    section.querySelector('[data-security-timeout]').addEventListener('change', (event) => { const value = config(); value.lockTimeout = Number(event.target.value); save(value); emit(); resetTimer(); });
    section.querySelector('[data-lock-now]').addEventListener('click', lock);
  }
  function init() { ['pointerdown','keydown','touchstart'].forEach((event) => window.addEventListener(event, resetTimer, { passive: true })); document.addEventListener('visibilitychange', () => { if (document.hidden) resetTimer(); }); document.addEventListener('click', (event) => { const control = event.target.closest('[data-toggle]'); if (!control || !['pin','biometric','hideValues'].includes(control.dataset.toggle)) return; event.preventDefault(); event.stopImmediatePropagation(); const key = control.dataset.toggle; if (key === 'pin') { const security = config(); if (security.pinHash) { delete security.pinHash; delete security.salt; security.failedAttempts = 0; security.lockedUntil = 0; save(security); emit(); } else setupPin(); } if (key === 'hideValues') { const security = config(); window.pagueOnLock.setHideValues(!security.hideValues); } if (key === 'biometric') { const security = config(); window.pagueOnLock.setBiometric(!security.biometricPreferred).catch((error) => alert(error.message)); } }, true); new MutationObserver(augmentProfile).observe(document.querySelector('#profileView'), { childList: true, subtree: true }); const security = config(); emit(); augmentProfile(); if ((security.pinHash || security.biometricPreferred) && !sessionStorage.getItem(SESSION_KEY)) lock(); else resetTimer(); }
  window.pagueOnLock = { setupPin, lock, resetTimer, registerBiometric, get config() { return config(); }, setHideValues(hideValues) { const security = config(); security.hideValues = hideValues; save(security); emit(); }, async setBiometric(enabled) { if (enabled) await registerBiometric(); else { const security = config(); security.biometricPreferred = false; save(security); emit(); } } };
  init();
})();
