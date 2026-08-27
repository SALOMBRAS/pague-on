(() => {
  const apiBase = () => location.port === '5500' ? 'http://localhost:3000/api/v1' : '/api/v1';
  const keys = { token: 'pagueon.token', user: 'pagueon.user' };
  const rawFetch = window.fetch.bind(window);
  const messages = {
    EMAIL_IN_USE: 'Este e-mail já está em uso. Entre na sua conta ou use outro e-mail.',
    PHONE_IN_USE: 'Este telefone já está em uso. Use outro telefone ou entre na sua conta.',
    INVALID_CREDENTIALS: 'E-mail, telefone ou senha inválidos.',
    AUTH_RATE_LIMIT: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
    VALIDATION_ERROR: 'Revise os dados informados e tente novamente.',
    INVALID_RESET_TOKEN: 'O link de recuperação é inválido ou expirou. Solicite um novo link.',
  };
  let refreshing = null;

  const readUser = () => { try { return JSON.parse(sessionStorage.getItem(keys.user) || 'null'); } catch (_error) { return null; } };
  const getToken = () => sessionStorage.getItem(keys.token);
  const getUser = () => readUser();
  const setSession = ({ token, user }) => {
    if (!token || !user) throw new Error('Não foi possível iniciar a sessão. Tente novamente.');
    sessionStorage.setItem(keys.token, token);
    sessionStorage.setItem(keys.user, JSON.stringify(user));
  };
  const clearSession = () => {
    sessionStorage.removeItem(keys.token);
    sessionStorage.removeItem(keys.user);
    localStorage.removeItem('pagueon.token');
    localStorage.removeItem('pagueon_token');
    localStorage.removeItem('pagueon.refresh_token');
  };
  const authPath = (url) => /\/auth\/(login|register|refresh|logout|password-reset\/(request|confirm))$/.test(new URL(url, location.href).pathname);
  const apiPath = (url) => new URL(url, location.href).pathname.startsWith('/api/v1/');

  function apiError(result, fallback) {
    const error = new Error(messages[result?.code] || result?.error || fallback);
    error.code = result?.code;
    return error;
  }

  async function renew() {
    if (!refreshing) {
      refreshing = rawFetch(`${apiBase()}/auth/refresh`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}'
      }).then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success || !result.data?.token) return false;
        setSession(result.data);
        return true;
      }).catch(() => false).finally(() => { refreshing = null; });
    }
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
    let element = document.getElementById('auth-shell');
    if (element) return element;
    const style = document.createElement('style');
    style.textContent = '#auth-shell{position:fixed;z-index:500;inset:0;display:grid;place-items:center;padding:24px;background:var(--bg,#07150e);color:var(--text,#f3fbf6);font-family:Inter,system-ui,sans-serif}.auth-card{width:min(100%,430px);padding:30px;border:1px solid var(--line,rgba(194,238,211,.13));border-radius:24px;background:var(--surface,#0f2117);box-shadow:var(--shadow,0 24px 80px #0009)}.auth-card h1{margin:0;font-size:26px}.auth-card p{color:var(--muted,#a9bdb0);line-height:1.5}.auth-field{display:grid;gap:7px;margin-top:15px}.auth-field input{min-height:48px;border:1px solid var(--line,rgba(194,238,211,.13));border-radius:12px;padding:0 13px;background:var(--raised,#152b1f);color:var(--text,#f3fbf6);font-size:16px}.auth-field input[aria-invalid="true"]{border-color:var(--red,#ff5b5b);box-shadow:0 0 0 3px rgba(255,91,91,.14)}.auth-primary,.auth-secondary{width:100%;min-height:48px;margin-top:14px;border-radius:12px;padding:0 14px;font-weight:800;cursor:pointer}.auth-primary{border:0;background:var(--green,#00c853);color:var(--on-green,#07150e)}.auth-primary:disabled{opacity:.7;cursor:wait}.auth-secondary,.auth-link{border:1px solid var(--line,rgba(194,238,211,.13));background:transparent;color:var(--text,#f3fbf6)}.auth-link{border:0;padding:2px;color:var(--green,#00c853);text-decoration:underline}.auth-error{margin:14px 0;padding:12px;border:1px solid var(--red,rgba(255,91,91,.4));border-radius:12px;background:var(--red-bg,rgba(69,29,40,.9));color:#fee2e2}.auth-error[hidden]{display:none}.auth-check{display:flex;gap:9px;align-items:center;margin-top:16px;color:var(--muted,#a9bdb0);font-size:13px}.auth-help{text-align:center;font-size:13px}.side-session{display:none}';
    document.head.append(style);
    element = document.createElement('section');
    element.id = 'auth-shell';
    element.setAttribute('aria-live', 'polite');
    document.body.append(element);
    return element;
  }

  const form = (content) => `<form class="auth-card" novalidate><h1>Pague-On</h1>${content}<div class="auth-error" id="auth-error" role="alert" tabindex="-1" hidden></div></form>`;
  const actionError = (element, message, code) => {
    const error = element?.querySelector('.auth-error');
    if (!error) return;
    const fieldName = code === 'EMAIL_IN_USE' ? 'email' : code === 'PHONE_IN_USE' ? 'phone' : null;
    element.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
    const field = fieldName ? element.querySelector(`[name="${fieldName}"]`) : null;
    if (field) field.setAttribute('aria-invalid', 'true');
    error.textContent = message;
    error.hidden = false;
    error.focus();
  };
  const clearActionError = (element) => {
    const error = element?.querySelector('.auth-error');
    if (error) { error.textContent = ''; error.hidden = true; }
    element?.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  };
  const setBusy = (formElement, busy) => {
    const submit = formElement.querySelector('[type=submit]');
    formElement.setAttribute('aria-busy', String(busy));
    if (!submit) return;
    submit.disabled = busy;
    submit.textContent = busy ? submit.dataset.loadingLabel : submit.dataset.idleLabel;
  };
  const submitButton = (idle, loading) => `<button class="auth-primary" type="submit" data-idle-label="${idle}" data-loading-label="${loading}">${idle}</button>`;

  function validate(mode, values, resetToken) {
    if (mode === 'register') {
      if (String(values.name || '').trim().length < 2) throw new Error('Informe seu nome completo.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values.email || '').trim())) throw new Error('Informe um e-mail válido.');
    }
    if (mode === 'forgot' && !String(values.identity || '').trim()) throw new Error('Informe seu e-mail ou telefone.');
    if ((mode === 'login' || mode === 'reset' || mode === 'register') && String(values.password || '').length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
    if ((mode === 'reset' || mode === 'register') && values.password !== values.confirm) throw new Error('As senhas precisam ser iguais.');
    if (mode === 'reset' && !resetToken) throw new Error('O link de recuperação é inválido. Solicite um novo link.');
  }

  async function submitAuth(path, body) {
    const response = await rawFetch(`${apiBase()}${path}`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw apiError(result, 'Não foi possível concluir a solicitação. Tente novamente.');
    return result;
  }

  function show(mode = 'login', message = '') {
    const target = shell();
    target.hidden = false;
    const resetToken = new URLSearchParams(location.search).get('reset');
    if (mode === 'forgot') target.innerHTML = form(`<p>Informe seu e-mail ou telefone para receber as instruções de recuperação.</p><label class="auth-field">E-mail ou telefone<input name="identity" autocomplete="username" aria-describedby="auth-error" required></label>${submitButton('Enviar instruções', 'Enviando...')}<p class="auth-help"><button class="auth-link" type="button" data-mode="login">Voltar ao acesso</button></p>`);
    else if (mode === 'reset') target.innerHTML = form(`<p>Defina uma nova senha para sua conta.</p><label class="auth-field">Nova senha<input name="password" type="password" autocomplete="new-password" aria-describedby="auth-error" minlength="6" required></label><label class="auth-field">Confirme a senha<input name="confirm" type="password" autocomplete="new-password" aria-describedby="auth-error" minlength="6" required></label>${submitButton('Atualizar senha', 'Atualizando...')}`);
    else if (mode === 'register') target.innerHTML = form(`<p>Crie sua conta para organizar suas finanças.</p><label class="auth-field">Nome completo<input name="name" autocomplete="name" aria-describedby="auth-error" required minlength="2"></label><label class="auth-field">E-mail<input name="email" type="email" autocomplete="email" aria-describedby="auth-error" required></label><label class="auth-field">Telefone (opcional)<input name="phone" type="tel" autocomplete="tel" aria-describedby="auth-error"></label><label class="auth-field">Senha<input name="password" type="password" autocomplete="new-password" aria-describedby="auth-error" minlength="6" required></label><label class="auth-field">Confirme a senha<input name="confirm" type="password" autocomplete="new-password" aria-describedby="auth-error" minlength="6" required></label><label class="auth-check"><input name="remember" type="checkbox" checked> Manter conectado neste dispositivo</label>${submitButton('Criar conta', 'Criando conta...')}<p class="auth-help">Já tem conta? <button class="auth-link" type="button" data-mode="login">Entrar</button></p>`);
    else target.innerHTML = form(`<p>${message || 'Entre para acompanhar suas finanças com segurança.'}</p><label class="auth-field">E-mail ou telefone<input name="identity" autocomplete="username" aria-describedby="auth-error" required></label><label class="auth-field">Senha<input name="password" type="password" autocomplete="current-password" aria-describedby="auth-error" required></label><label class="auth-check"><input name="remember" type="checkbox" checked> Manter conectado neste dispositivo</label>${submitButton('Entrar', 'Entrando...')}<button class="auth-secondary" type="button" data-pwa-install hidden>Instalar aplicativo</button><p class="auth-help"><button class="auth-link" type="button" data-mode="forgot">Esqueci minha senha</button><br>Não possui conta? <button class="auth-link" type="button" data-mode="register">Criar conta</button></p>`);

    target.querySelectorAll('[data-mode]').forEach((button) => { button.onclick = () => show(button.dataset.mode); });
    const formElement = target.querySelector('form');
    formElement.addEventListener('input', () => clearActionError(formElement));
    formElement.onsubmit = async (event) => {
      event.preventDefault();
      const submittedForm = event.currentTarget;
      const values = Object.fromEntries(new FormData(submittedForm));
      clearActionError(submittedForm);
      try {
        validate(mode, values, resetToken);
        setBusy(submittedForm, true);
        let result;
        if (mode === 'forgot') result = await submitAuth('/auth/password-reset/request', { identity: values.identity.trim() });
        else if (mode === 'reset') result = await submitAuth('/auth/password-reset/confirm', { token: resetToken, newPassword: values.password });
        else if (mode === 'register') result = await submitAuth('/auth/register', { name: values.name.trim(), email: values.email.trim().toLowerCase(), phone: values.phone?.trim() || undefined, password: values.password, remember: values.remember === 'on' });
        else result = await submitAuth('/auth/login', { identity: values.identity.trim(), password: values.password, remember: values.remember === 'on' });
        if (mode === 'forgot') show('login', result.message || 'Se houver uma conta compatível, você receberá as instruções.');
        else if (mode === 'reset') { history.replaceState({}, '', location.pathname); show('login', result.message || 'Senha atualizada. Entre novamente.'); }
        else if (mode === 'register') {
          const loginUrl = new URL(location.href);
          loginUrl.search = 'auth=login';
          history.replaceState({}, '', `${loginUrl.pathname}${loginUrl.search}${loginUrl.hash}`);
          show('login', result.message || 'Conta criada com sucesso. Entre com seu e-mail e senha para continuar.');
        }
        else { setSession(result.data); startSession(); }
      } catch (error) {
        actionError(submittedForm, error.message || 'Verifique os dados e tente novamente.', error.code);
      } finally {
        setBusy(submittedForm, false);
      }
    };
    target.querySelector('input')?.focus();
    window.dispatchEvent(new CustomEvent('pagueon:auth-ui-ready'));
    window.pagueOnPwa?.bind(target);
  }

  function showSessionControl() {
    document.getElementById('auth-session-control')?.remove();
    const user = getUser();
    const sidebarFooter = document.querySelector('.side-foot');
    if (!user || !sidebarFooter) return;
    const control = document.createElement('div'); control.id = 'auth-session-control'; control.className = 'side-session';
    const label = document.createElement('span'); label.textContent = `${String(user.name || 'Você').split(' ')[0]}${user.role ? ` · ${user.role}` : ''}`;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Sair'; button.setAttribute('aria-label', 'Sair da conta'); button.onclick = logout;
    control.append(label, button); sidebarFooter.append(control);
  }
  function startSession() {
    document.getElementById('auth-shell')?.setAttribute('hidden', '');
    const appUrl = new URL(location.href);
    if (appUrl.searchParams.has('auth') || appUrl.searchParams.has('reset')) {
      appUrl.searchParams.delete('auth');
      appUrl.searchParams.delete('reset');
      history.replaceState({}, '', `${appUrl.pathname}${appUrl.search}${appUrl.hash}`);
    }
    showSessionControl();
    window.dispatchEvent(new CustomEvent('pagueon:auth', { detail: { user: getUser() } }));
  }
  function endSession() { clearSession(); document.getElementById('auth-session-control')?.remove(); show('login', 'Sua sessão terminou. Entre novamente para continuar.'); }
  async function logout() { try { if (getToken()) await rawFetch(`${apiBase()}/auth/logout`, { method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${getToken()}` } }); } finally { endSession(); } }
  async function loadUser() {
    if (!getToken() && !(await renew())) return null;
    const response = await rawFetch(`${apiBase()}/auth/me`, { credentials: 'include', headers: { Authorization: `Bearer ${getToken()}` } });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) return null;
    setSession({ token: getToken(), user: result.data });
    return result.data;
  }
  window.pagueOnAuth = { getToken, getUser, isAuthenticated: () => Boolean(getToken()), fetchWithAuth, logout, loadUser };
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-profile-action="signout"]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    logout();
  }, true);
  window.fetch = (input, options) => fetchWithAuth(input, options);
  (async () => {
    const params = new URLSearchParams(location.search);
    const reset = params.get('reset');
    const requestedMode = params.get('auth');
    const cachedToken = getToken();
    const cachedUser = getUser();
    if (!reset && cachedUser && cachedToken) {
      // Já tem sessão em cache (sessionStorage): entra imediatamente sem esperar
      // rede, e revalida /auth/me em segundo plano — atualiza dados e detecta
      // sessão expirada/revogada sem travar a entrada.
      startSession();
      loadUser().then((user) => { if (user) { setSession({ token: getToken(), user }); startSession(); } else { endSession(); } }).catch(() => {});
      return;
    }
    const user = reset ? null : await loadUser();
    if (user) startSession(); else { clearSession(); show(reset ? 'reset' : requestedMode === 'register' ? 'register' : 'login'); }
  })();
})();
