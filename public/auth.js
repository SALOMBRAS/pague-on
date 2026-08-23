(() => {
  const apiBase = () => location.port === '5500' ? 'http://localhost:3000/api/v1' : '/api/v1';
  const keys = { token: 'pagueon.token', legacyToken: 'pagueon_token', refresh: 'pagueon.refresh_token', user: 'pagueon.user', legacyUser: 'pagueon_user' };
  const rawFetch = window.fetch.bind(window);
  let refreshing = null;

  const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_error) { return null; } };
  const getToken = () => localStorage.getItem(keys.token) || localStorage.getItem(keys.legacyToken);
  const getRefreshToken = () => localStorage.getItem(keys.refresh);
  const getUser = () => readJson(keys.user) || readJson(keys.legacyUser);
  const setSession = ({ token, refreshToken, user }) => {
    localStorage.setItem(keys.token, token); localStorage.setItem(keys.legacyToken, token);
    if (refreshToken) localStorage.setItem(keys.refresh, refreshToken);
    localStorage.setItem(keys.user, JSON.stringify(user)); localStorage.setItem(keys.legacyUser, JSON.stringify(user));
  };
  const clearSession = () => Object.values(keys).forEach((key) => localStorage.removeItem(key));
  const isAuthEndpoint = (url) => /\/auth\/(login|register|refresh|logout)$/.test(new URL(url, location.href).pathname);
  const isApiRequest = (url) => new URL(url, location.href).pathname.startsWith('/api/v1/');

  async function renew() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    if (!refreshing) refreshing = rawFetch(`${apiBase()}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Sessão expirada');
        setSession(result.data); return true;
      }).catch(() => false).finally(() => { refreshing = null; });
    return refreshing;
  }

  async function fetchWithAuth(input, options = {}, retried = false) {
    const url = input instanceof Request ? input.url : input;
    const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
    if (isApiRequest(url) && !isAuthEndpoint(url) && getToken() && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${getToken()}`);
    const response = await rawFetch(input, { ...options, headers });
    if (response.status === 401 && isApiRequest(url) && !isAuthEndpoint(url) && !retried && await renew()) return fetchWithAuth(input, options, true);
    if (response.status === 401 && isApiRequest(url) && !isAuthEndpoint(url)) endSession();
    return response;
  }

  function mountShell() {
    if (!document.getElementById('pagueon-auth-base')) { const style = document.createElement('style'); style.id = 'pagueon-auth-base'; style.textContent = `#auth-shell{position:fixed;z-index:500;inset:0;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 10%,#1e40af55,transparent 32%),radial-gradient(circle at 85% 95%,#05966938,transparent 30%),#0f172a;color:#fff;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.auth-card{width:min(100%,420px);padding:32px;border:1px solid rgba(255,255,255,.14);border-radius:24px;background:rgba(25,33,52,.94);box-shadow:0 24px 80px #0009}.auth-brand{display:flex;align-items:center;gap:12px;margin-bottom:28px}.auth-mark{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#059669;color:#062916;font-weight:900;font-size:19px}.auth-brand b{font-size:17px}.auth-brand small{display:block;color:#b9c5d6;font-size:12px;margin-top:2px}.auth-card h1{margin:0;font-size:26px;letter-spacing:-.6px}.auth-card>p{margin:8px 0 24px;color:#cbd5e1;line-height:1.5;font-size:14px}.auth-field{display:grid;gap:7px;margin-top:15px}.auth-field label{font-size:13px;font-weight:700}.auth-field input{width:100%;min-height:48px;border:1px solid #526176;border-radius:12px;padding:0 13px;background:#101a34;color:#fff;font-size:16px}.auth-field input:focus{outline:3px solid #60a5fa88;border-color:#60a5fa}.auth-actions{display:grid;gap:10px;margin-top:24px}.auth-primary,.auth-secondary{min-height:48px;border-radius:12px;padding:0 14px;font-size:14px;font-weight:800;cursor:pointer;transition:opacity .16s ease,transform .16s ease}.auth-primary{border:0;background:#059669;color:#031b11}.auth-secondary{border:1px solid #526176;background:transparent;color:#fff}.auth-primary:active,.auth-secondary:active{transform:scale(.98)}.auth-primary:disabled{opacity:.6;cursor:wait}.auth-switch{margin:19px 0 0;color:#cbd5e1;text-align:center;font-size:13px}.auth-link{border:0;padding:2px;background:transparent;color:#6ea8ff;font-weight:800;text-decoration:underline;cursor:pointer}.auth-error{margin:0 0 16px;padding:12px;border:1px solid #f87171;border-radius:12px;background:#451d28;color:#fee2e2;font-size:13px;line-height:1.4}.auth-error[hidden]{display:none}.auth-help{margin-top:18px;color:#94a3b8;text-align:center;font-size:12px;line-height:1.5}.auth-session{position:fixed;z-index:60;top:max(12px,env(safe-area-inset-top));right:max(12px,calc((100vw - 620px)/2 + 12px));display:flex;align-items:center;gap:8px;padding:7px 8px 7px 12px;border:1px solid #303030;border-radius:999px;background:#111e;color:#fff;font-size:12px;backdrop-filter:blur(10px)}.auth-session button{min-height:32px;border:0;border-radius:9px;padding:0 10px;background:#263449;color:#fff;font-weight:700;cursor:pointer}@media(max-width:420px){#auth-shell{padding:16px}.auth-card{padding:26px 20px}}@media(prefers-reduced-motion:reduce){.auth-primary,.auth-secondary{transition:none}}`; document.head.append(style); }
    if (!document.getElementById('pagueon-auth-polish')) {
      const polishedStyles = document.createElement('link');
      polishedStyles.id = 'pagueon-auth-polish'; polishedStyles.rel = 'stylesheet'; polishedStyles.href = '/auth-enhancements.css?v=ui23';
      document.head.append(polishedStyles);
    }
    const existing = document.getElementById('auth-shell'); if (existing) return existing;
    const shell = document.createElement('section'); shell.id = 'auth-shell'; shell.setAttribute('aria-live', 'polite'); document.body.append(shell); return shell;
  }

  function showAuth(mode = 'login', message = '') {
    const shell = mountShell(); shell.hidden = false;
    const register = mode === 'register';
    shell.innerHTML = `<form class="auth-card" novalidate><div class="auth-brand"><span class="auth-mark" aria-hidden="true">P</span><div><b>Pague-On</b><small>Seu financeiro, no controle.</small></div></div><h1>${register ? 'Crie sua conta' : 'Que bom ter você de volta'}</h1><p>${register ? 'Comece a organizar vendas, contas e estoque em um só lugar.' : 'Entre para acompanhar suas finanças com segurança.'}</p><div class="auth-error" role="alert" tabindex="-1" ${message ? '' : 'hidden'}>${message}</div>${register ? '<div class="auth-field"><label for="auth-name">Nome completo</label><input id="auth-name" name="name" autocomplete="name" required minlength="2"></div>' : ''}<div class="auth-field"><label for="auth-email">E-mail</label><input id="auth-email" name="email" type="email" autocomplete="email" inputmode="email" required></div><div class="auth-field"><label for="auth-password">Senha</label><input id="auth-password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" required minlength="6"></div>${register ? '<div class="auth-field"><label for="auth-confirm">Confirme a senha</label><input id="auth-confirm" name="confirm" type="password" autocomplete="new-password" required minlength="6"></div><div class="auth-field"><label for="auth-phone">Telefone <small>(opcional)</small></label><input id="auth-phone" name="phone" type="tel" autocomplete="tel"></div>' : ''}<div class="auth-actions"><button class="auth-primary" type="submit">${register ? 'Criar conta' : 'Entrar'}</button></div><p class="auth-switch">${register ? 'Já tem conta?' : 'Ainda não tem conta?'} <button class="auth-link" type="button" data-switch>${register ? 'Entrar' : 'Criar conta'}</button></p><p class="auth-help">Use seu gerenciador de senhas se quiser. Colar senha é permitido.</p></form>`;
    shell.querySelector('[data-switch]').onclick = () => showAuth(register ? 'login' : 'register');
    shell.querySelector('form').onsubmit = async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const error = shell.querySelector('.auth-error'); const submit = shell.querySelector('[type=submit]');
      const payload = Object.fromEntries(form.entries());
      if (register && payload.password !== payload.confirm) { error.textContent = 'As senhas precisam ser iguais.'; error.hidden = false; error.focus(); return; }
      submit.disabled = true; submit.textContent = register ? 'Criando conta…' : 'Entrando…'; event.currentTarget.setAttribute('aria-busy', 'true'); error.hidden = true;
      try {
        const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 15000);
        const response = await rawFetch(`${apiBase()}/auth/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(register ? { name: payload.name, email: payload.email, password: payload.password, phone: payload.phone || undefined } : { email: payload.email, password: payload.password }), signal: controller.signal });
        window.clearTimeout(timeout); const result = await response.json().catch(() => ({})); if (!response.ok || !result.success) throw new Error(result.error || 'Não foi possível concluir a solicitação.');
        setSession(result.data); startSession();
      } catch (requestError) { error.textContent = requestError.name === 'AbortError' ? 'O servidor demorou mais que o esperado. Tente novamente.' : (requestError.message || 'Verifique sua conexão e tente novamente.'); error.hidden = false; error.focus(); submit.disabled = false; submit.textContent = register ? 'Criar conta' : 'Entrar'; } finally { event.currentTarget.removeAttribute('aria-busy'); }
    };
    shell.querySelector(register ? '#auth-name' : '#auth-email').focus();
  }

  function showSessionControl() {
    document.getElementById('auth-session-control')?.remove(); const user = getUser(); if (!user) return;
    const control = document.createElement('div'); control.id = 'auth-session-control'; control.className = 'auth-session'; control.innerHTML = `<span>Olá, ${String(user.name || 'você').split(' ')[0]}</span><button type="button" aria-label="Sair da sua conta">Sair</button>`;
    control.querySelector('button').onclick = () => logout(); document.body.append(control);
  }
  function startSession() { if (document.body.dataset.authPage === 'true') { window.location.replace('/index.html'); return; } document.getElementById('auth-shell')?.setAttribute('hidden', ''); showSessionControl(); window.dispatchEvent(new CustomEvent('pagueon:auth', { detail: { user: getUser() } })); }
  function endSession() { clearSession(); document.getElementById('auth-session-control')?.remove(); showAuth('login', 'Sua sessão terminou. Entre novamente para continuar.'); }
  async function logout() { const refreshToken = getRefreshToken(); try { if (refreshToken) await rawFetch(`${apiBase()}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) }); } finally { endSession(); } }
  async function loadUser() {
    if (!getToken()) return null;
    let response = await rawFetch(`${apiBase()}/auth/me`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (response.status === 401 && await renew()) response = await rawFetch(`${apiBase()}/auth/me`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!response.ok) return null; const result = await response.json(); if (!result.success) return null; setSession({ token: getToken(), refreshToken: getRefreshToken(), user: result.data }); return result.data;
  }

  window.pagueOnAuth = { getToken, getUser, isAuthenticated: () => Boolean(getToken()), fetchWithAuth, logout, loadUser };
  window.fetch = (input, options) => fetchWithAuth(input, options);
  (async () => {
    const parameters = new URLSearchParams(location.search); const requestedMode = parameters.get('mode') || parameters.get('auth');
    const mode = requestedMode === 'register' ? 'register' : 'login';
    const user = await loadUser();
    if (user) startSession(); else { clearSession(); showAuth(mode); }
  })();
})();
