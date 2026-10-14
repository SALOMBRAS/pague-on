(() => {
  const token = new URLSearchParams(location.search).get('token');
  const intro = document.querySelector('#intro');
  const card = document.querySelector('#formCard');
  const form = document.querySelector('#registrationForm');
  const message = document.querySelector('#message');
  const emptyToNull = value => value.trim() ? value.trim() : null;
  const show = (text, error = false) => { message.textContent = text; message.classList.toggle('error', error); };
  if (!token) { intro.textContent = 'Este link de cadastro é inválido.'; return; }
  fetch(`/api/v1/customer-registration/${encodeURIComponent(token)}`).then(async response => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Este link não é mais válido.');
    intro.textContent = `Olá, ${payload.data.customer.name}. Confira e complete seus dados.`;
    form.elements.name.value = payload.data.customer.name || '';
    card.hidden = false;
  }).catch(error => { intro.textContent = error.message; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true; show('Enviando cadastro…');
    const body = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, emptyToNull(value)]));
    try {
      const response = await fetch(`/api/v1/customer-registration/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Não foi possível enviar o cadastro.');
      form.hidden = true; intro.textContent = 'Cadastro enviado para análise. Obrigado!';
    } catch (error) { show(error.message, true); button.disabled = false; }
  });
})();
