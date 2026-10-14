(() => {
  const base = () => {
    // Em produção/servido pelo próprio Express: mesmo origin (relativo).
    // No Live Server (:5500) a API não roda na porta estática; usa um override
    // configurável (default 3001) em vez de um número fixo frágil.
    if (location.port === '5500') {
      const saved = localStorage.getItem('pagueon_api_base');
      return (saved || 'http://localhost:3001/api/v1').replace(/\/$/, '');
    }
    return '/api/v1';
  };
  const REQUEST_TIMEOUT_MS = 12_000;
  const apiError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
  };
  async function request(method, endpoint, body) {
    const controller = new AbortController();
    const startedAt = performance.now();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const route = String(endpoint).split('?')[0];
    try {
      const response = await fetch(`${base()}${endpoint}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      console.info('[API] request_completed', { method, route, status: response.status, durationMs: Math.round(performance.now() - startedAt) });
      if (!response.ok || !payload.success) throw apiError(payload.error || 'Não foi possível concluir a operação.', payload.code || 'API_ERROR');
      return payload.data;
    } catch (error) {
      const failure = controller.signal.aborted ? apiError('A conexão demorou mais que o esperado. Tente novamente.', 'API_TIMEOUT') : error;
      console.info('[API] request_error', { method, route, code: failure?.code || failure?.name || 'NETWORK_ERROR', durationMs: Math.round(performance.now() - startedAt) });
      throw failure;
    } finally {
      clearTimeout(timeout);
    }
  }
  window.pagueOnApi = { base, authenticated: () => Boolean(window.pagueOnAuth?.getToken?.()), get: (endpoint) => request('GET', endpoint), post: (endpoint, body) => request('POST', endpoint, body), put: (endpoint, body) => request('PUT', endpoint, body), delete: (endpoint, body) => request('DELETE', endpoint, body) };
})();
