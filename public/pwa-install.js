(() => {
  let deferredPrompt = null;
  const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const controls = () => document.querySelectorAll('[data-pwa-install]');
  function publish(status) {
    controls().forEach((control) => {
      const available = status === 'available';
      control.hidden = !available; control.disabled = !available; control.setAttribute('aria-hidden', String(!available));
    });
    window.dispatchEvent(new CustomEvent('pagueon:pwa-status', { detail: { status, installable: status === 'available' } }));
  }
  async function install() {
    if (!deferredPrompt) return false;
    const prompt = deferredPrompt; deferredPrompt = null; publish('prompting');
    await prompt.prompt(); await prompt.userChoice;
    publish(isStandalone() ? 'installed' : 'unavailable'); return true;
  }
  function bind(root = document) {
    root.querySelectorAll?.('[data-pwa-install]').forEach((control) => {
      if (control.dataset.pwaBound) return;
      control.dataset.pwaBound = 'true'; control.addEventListener('click', () => install().catch(() => publish('unavailable')));
    });
    publish(deferredPrompt ? 'available' : (isStandalone() ? 'installed' : 'unavailable'));
  }
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredPrompt = event; publish('available'); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; publish('installed'); });
  window.addEventListener('pagueon:auth-ui-ready', () => bind());
  if ('serviceWorker' in navigator && (window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined));
  }
  window.pagueOnPwa = { bind, install, isStandalone }; bind();
})();
