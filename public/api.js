(() => {
  const base = () => location.port === '5500' ? 'http://localhost:3000/api/v1' : '/api/v1';
  async function request(method, endpoint, body) {
    const response = await fetch(`${base()}${endpoint}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Não foi possível concluir a operação.');
    return payload.data;
  }
  window.pagueOnApi = { base, authenticated: () => Boolean(window.pagueOnAuth?.getToken?.()), get: (endpoint) => request('GET', endpoint), post: (endpoint, body) => request('POST', endpoint, body), put: (endpoint, body) => request('PUT', endpoint, body), delete: (endpoint) => request('DELETE', endpoint) };
})();
