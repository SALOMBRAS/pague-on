(() => {
  const apiBase = () => location.port === '5500' ? 'http://localhost:3000/api/v1' : '/api/v1';
  const keys = { token: 'pagueon.token', user: 'pagueon.user' };
  const rawFetch = window.fetch.bind(window);
  let refreshing = null;
  const readUser = () => { try { return JSON.parse(sessionStorage.getItem(keys.user) || 'null'); } catch (_error) { return null; } };
  const getToken = () => sessionStorage.getItem(keys.token);
  const getUser = () => readUser();
  const setSession = ({ token, user }) => { sessionStorage.setItem(keys.token, token); sessionStorage.setItem(keys.user, JSON.stringify(user)); };
  const clearSession = () => { sessionStorage.removeItem(keys.token); sessionStorage.removeItem(keys.user); localStorage.removeItem('pagueon.token'); localStorage.removeItem('pagueon_token'); localStorage.removeItem('pagueon.refresh_token'); };
  const authPath = (url) => /\/auth\/(login|register|refresh|logout|password-reset\/(request|confirm))$/.test(new URL(url, location.href).pathname);
  const apiPath = (url) => new URL(url, location.href).pathname.startsWith('/api/v1/');

  async function renew() {
    if (!refreshing) refreshing = rawFetch(`${apiBase()}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(async (response) => {
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(); setSession(result.data); return true;
    }).catch(() => false).finally(() => { refreshing = null; });
    return refreshing;
  }
  async function fetchWithAuth(input, options = {}, retried = false) {
    const url = input instanceof Request ? input.url : input;
    const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
    if (apiPath(url) && !authPath(url) && getToken() && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${getToken()}`);
    const response = await rawFetch(input, { ...options, headers, credentials: options.credentials || 'include' });
    if (response.status === 401 && apiPath(url) && !authPath(url) && !retried && await renew()) return fetchWithAuth(input, options, true);
    if (response.status === 401 && apiPath(url) && !authPath(url)) endSession();
    return response;
  }

  function shell() {
    let element = document.getElementById('auth-shell'); if (element) return element;
    const style = document.createElement('style'); style.textContent = '#auth-shell{position:fixed;z-index:500;inset:0;display:grid;place-items:center;padding:24px;background:var(--bg,#07150e);color:var(--text,#f3fbf6);font-family:Inter,system-ui,sans-serif}.auth-card{width:min(100%,430px);padding:30px;border:1px solid var(--line,rgba(194,238,211,.13));border-radius:24px;background:var(--surface,#0f2117);box-shadow:var(--shadow,0 24px 80px #0009)}.auth-card h1{margin:0;font-size:26px}.auth-card p{color:var(--muted,#a9bdb0);line-height:1.5}.auth-field{display:grid;gap:7px;margin-top:15px}.auth-field input{min-height:48px;border:1px solid var(--line,rgba(194,238,211,.13));border-radius:12px;padding:0 13px;background:var(--raised,#152b1f);color:var(--text,#f3fbf6);font-size:16px}.auth-primary,.auth-secondary{width:100%;min-height:48px;margin-top:14px;border-radius:12px;padding:0 14px;font-weight:800;cursor:pointer}.auth-primary{border:0;background:var(--green,#00c853);color:var(--on-green,#07150e)}.auth-secondary,.auth-link{border:1px solid var(--line,rgba(194,238,211,.13));background:transparent;color:var(--text,#f3fbf6)}.auth-link{border:0;padding:2px;color:var(--green,#00c853);text-decoration:underline}.auth-error{margin:14px 0;padding:12px;border:1px solid var(--red,rgba(255,91,91,.4));border-radius:12px;background:var(--red-bg,rgba(69,29,40,.9));color:#fee2e2}.auth-error[hidden]{display:none}.auth-check{display:flex;gap:9px;align-items:center;margin-top:16px;color:var(--muted,#a9bdb0);font-size:13px}.auth-help{text-align:center;font-size:13px}.auth-session{position:fixed;z-index:60;top:12px;right:12px;display:flex;gap:8px;align-items:center;padding:8px 12px;border:1px solid var(--line,rgba(194,238,211,.13));border-radius:999px;background:rgba(17,17,17,.9);color:var(--text,#fff);font-size:12px}.auth-session button{border:0;border-radius:8px;padding:7px;background:var(--raised,#263449);color:var(--text,#fff);font-weight:700;cursor:pointer}'; document.head.append(style);
    element = document.createElement('section'); element.id = 'auth-shell'; element.setAttribute('aria-live', 'polite'); document.body.append(element); return element;
  }
  const form = (content) => `<form class="auth-card" novalidate><h1>Pague-On</h1>${content}<div class="auth-error" role="alert" hidden></div></form>`;
  const actionError = (element, message) => { const error = element.querySelector('.auth-error'); error.textContent = message; error.hidden = false; error.focus(); };
  function show(mode = 'login', message = '') {
    const target = shell(); target.hidden = false; const resetToken = new URLSearchParams(location.search).get('reset');
    if (mode === 'forgot') target.innerHTML = form('<p>Informe seu e-mail ou telefone para receber as instruções de recuperação.</p><label class="auth-field">E-mail ou telefone<input name="identity" autocomplete="username" required></label><button class="auth-primary" type="submit">Enviar instruções</button><p class="auth-help"><button class="auth-link" type="button" data-mode="login">Voltar ao acesso</button></p>');
    else if (mode === 'reset') target.innerHTML = form('<p>Defina uma nova senha para sua conta.</p><label class="auth-field">Nova senha<input name="password" type="password" autocomplete="new-password" minlength="6" required></label><label class="auth-field">Confirme a senha<input name="confirm" type="password" autocomplete="new-password" minlength="6" required></label><button class="auth-primary" type="submit">Atualizar senha</button>');
    else if (mode === 'register') target.innerHTML = form('<p>Crie sua conta para organizar suas finanças.</p><label class="auth-field">Nome completo<input name="name" autocomplete="name" required minlength="2"></label><label class="auth-field">E-mail<input name="email" type="email" autocomplete="email" required></label><label class="auth-field">Telefone (opcional)<input name="phone" type="tel" autocomplete="tel"></label><label class="auth-field">Senha<input name="password" type="password" autocomplete="new-password" minlength="6" required></label><label class="auth-field">Confirme a senha<input name="confirm" type="password" autocomplete="new-password" minlength="6" required></label><label class="auth-check"><input name="remember" type="checkbox" checked> Manter conectado neste dispositivo</label><button class="auth-primary" type="submit">Criar conta</button><p class="auth-help">Já tem conta? <button class="auth-link" type="button" data-mode="login">Entrar</button></p>');
    else target.innerHTML = form(`<p>${message || 'Entre para acompanhar suas finanças com segurança.'}</p><label class="auth-field">E-mail ou telefone<input name="identity" autocomplete="username" required></label><label class="auth-field">Senha<input name="password" type="password" autocomplete="current-password" required></label><label class="auth-check"><input name="remember" type="checkbox" checked> Manter conectado neste dispositivo</label><button class="auth-primary" type="submit">Entrar</button><button class="auth-secondary" type="button" data-pwa-install hidden>Instalar aplicativo</button><p class="auth-help"><button class="auth-link" type="button" data-mode="forgot">Esqueci minha senha</button><br>Não possui conta? <button class="auth-link" type="button" data-mode="register">Criar conta</button></p>`);
    target.querySelectorAll('[data-mode]').forEach((button) => button.onclick = () => show(button.dataset.mode));
    target.querySelector('form').onsubmit = async (event) => {
      event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); const submit = event.currentTarget.querySelector('[type=submit]'); if (submit) submit.disabled = true;
      try {
        let path; let body;
        if (mode === 'forgot') { path = '/auth/password-reset/request'; body = { identity: values.identity }; }
        else if (mode === 'reset') { if (!resetToken || values.password !== values.confirm) throw new Error('As senhas precisam ser iguais.'); path = '/auth/password-reset/confirm'; body = { token: resetToken, newPassword: values.password }; }
        else { if (mode === 'register' && values.password !== values.confirm) throw new Error('As senhas precisam ser iguais.'); path = `/auth/${mode === 'register' ? 'register' : 'login'}`; body = mode === 'register' ? { name: values.name, email: values.email, phone: values.phone || undefined, password: values.password, remember: values.remember === 'on' } : { identity: values.identity, password: values.password, remember: values.remember === 'on' }; }
        const response = await rawFetch(`${apiBase()}${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const result = await response.json().catch(() => ({})); if (!response.ok || !result.success) throw new Error(result.error || 'Não foi possível concluir a solicitação.');
        if (mode === 'forgot') show('login', 'Se houver uma conta compatível, você receberá as instruções.'); else if (mode === 'reset') { history.replaceState({}, '', location.pathname); show('login', 'Senha atualizada. Entre novamente.'); } else { setSession(result.data); startSession(); }
      } catch (error) { actionError(event.currentTarget, error.message || 'Verifique os dados e tente novamente.'); } finally { if (submit) submit.disabled = false; }
    };
    target.querySelector('input')?.focus(); window.dispatchEvent(new CustomEvent('pagueon:auth-ui-ready')); window.pagueOnPwa?.bind(target);
  }
  function showSessionControl() { document.getElementById('auth-session-control')?.remove(); const user = getUser(); if (!user) return; const control = document.createElement('div'); control.id = 'auth-session-control'; control.className = 'auth-session'; const label = document.createElement('span'); label.textContent = `${String(user.name || 'Você').split(' ')[0]}${user.role ? ` · ${user.role}` : ''}`; const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Sair'; button.onclick = logout; control.append(label, button); document.body.append(control); }
  function startSession() { document.getElementById('auth-shell')?.setAttribute('hidden', ''); showSessionControl(); window.dispatchEvent(new CustomEvent('pagueon:auth', { detail: { user: getUser() } })); }
  function endSession() { clearSession(); document.getElementById('auth-session-control')?.remove(); show('login', 'Sua sessão terminou. Entre novamente para continuar.'); }
  async function logout() { try { if (getToken()) await rawFetch(`${apiBase()}/auth/logout`, { method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${getToken()}` } }); } finally { endSession(); } }
  async function loadUser() { if (!getToken() && !(await renew())) return null; const response = await rawFetch(`${apiBase()}/auth/me`, { credentials: 'include', headers: { Authorization: `Bearer ${getToken()}` } }); if (!response.ok) return null; const result = await response.json(); if (!result.success) return null; setSession({ token: getToken(), user: result.data }); return result.data; }
  window.pagueOnAuth = { getToken, getUser, isAuthenticated: () => Boolean(getToken()), fetchWithAuth, logout, loadUser };
  window.fetch = (input, options) => fetchWithAuth(input, options);
  (async () => { const params = new URLSearchParams(location.search); const reset = params.get('reset'); const requestedMode = params.get('auth'); const user = reset ? null : await loadUser(); if (user) startSession(); else { clearSession(); show(reset ? 'reset' : requestedMode === 'register' ? 'register' : 'login'); } })();
})();
