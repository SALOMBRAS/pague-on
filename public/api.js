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
  async function request(method, endpoint, body) {
    const response = await fetch(`${base()}${endpoint}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Não foi possível concluir a operação.');
    return payload.data;
  }
  window.pagueOnApi = { base, authenticated: () => Boolean(window.pagueOnAuth?.getToken?.()), get: (endpoint) => request('GET', endpoint), post: (endpoint, body) => request('POST', endpoint, body), put: (endpoint, body) => request('PUT', endpoint, body), delete: (endpoint) => request('DELETE', endpoint) };
})();
