(() => {
  let loading;
  function loadScanner() {
    if (window.pagueOnBillScanner) return Promise.resolve(window.pagueOnBillScanner);
    if (!loading) loading = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = '/scanner.js'; script.async = true;
      script.onload = () => resolve(window.pagueOnBillScanner); script.onerror = () => reject(new Error('Não foi possível abrir o scanner agora.'));
      document.head.append(script);
    });
    return loading;
  }
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-scan-bill]'); if (!button || window.pagueOnBillScanner) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const original = button.innerHTML; button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Abrindo scanner…';
    loadScanner().then((scanner) => scanner?.open()).catch((error) => window.alert(error.message)).finally(() => { button.disabled = false; button.removeAttribute('aria-busy'); button.innerHTML = original; });
  }, true);
})();
