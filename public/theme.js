/* ============================================================
   Pague-On — tema (dark mode) carregado no <head> ANTES do CSS
   para evitar FOUC. Define data-theme="light|dark|system" em
   <html>; o CSS (tokens.css) resolve as variáveis por data-theme
   + prefers-color-scheme.
   Persistência: localStorage['pagueon_theme'].
   ============================================================ */
(function () {
  var KEY = 'pagueon_theme';
  var root = document.documentElement;
  var meta = null;

  function current() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* privado */ }
    return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
  }

  function apply(theme) {
    var t = theme || current();
    root.setAttribute('data-theme', t);
    fluidMeta();
  }

  // Mantém <meta name="theme-color"> coerente com o tema (chrome/navbar do PWA).
  function fluidMeta() {
    if (!meta) meta = document.querySelector('meta[name="theme-color"]');
    var dark = root.getAttribute('data-theme') === 'dark'
      || (root.getAttribute('data-theme') !== 'light'
          && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    // A identidade atual do produto é Neon escura em todas as superfícies.
    // O seletor de tema continua disponível para preferências futuras, mas a
    // barra do navegador não deve voltar para uma cor de outra identidade.
    var base = '#000000';
    var brand = '#a3e635';
    if (meta) meta.setAttribute('content', base);
    // fundo do app nas bordas do mobile
    if (root && root.style) root.style.backgroundColor = base;
    // expõe a cor da marca para consumidores externos
    var b = brand;
    if (window) { if (!window.__pagueOnBrand) window.__pagueOnBrand = {}; window.__pagueOnBrand.color = b; window.__pagueOnBrand.base = base; }
  }

  var pagueOnTheme = {
    KEY: KEY,
    get: current,
    apply: apply,
    set: function (theme) {
      try { localStorage.setItem(KEY, theme); } catch (e) { /* ignora */ }
      apply(theme);
      if (theme !== 'system') {
        // versão explícita congela o que o sistema escolheria
        document.documentElement.style.colorScheme = theme;
      } else {
        document.documentElement.style.colorScheme = '';
      }
    },
    toggle: function () {
      var t = current();
      var next = t === 'dark' ? 'light' : (t === 'light' ? 'dark' : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark'));
      pagueOnTheme.set(next);
      return next;
    }
  };

  apply(current());

  // Recalcula o meta quando a preferência do sistema muda (em modo system).
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () {
      if (root.getAttribute('data-theme') !== 'light') { fluidMeta(); }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  window.pagueOnTheme = pagueOnTheme;
})();
