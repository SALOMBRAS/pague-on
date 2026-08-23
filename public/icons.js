(() => {
  'use strict';

  // Pequena coleção local de ícones para que a interface não dependa de uma CDN
  // durante o carregamento. Todos usam a mesma família visual (traço arredondado).
  const paths = {
    menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
    x: ['M18 6 6 18', 'm6 6 12 12'],
    plus: ['M12 5v14', 'M5 12h14'],
    check: ['m5 12 4 4L19 6'],
    'circle-check-big': ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'm22 4-10 10.01-3-3'],
    'arrow-left': ['m19 12-7 7-7-7', 'M19 12H5'],
    'arrow-right': ['m5 12 7-7 7 7', 'M5 12h14'],
    'arrow-up-right': ['M7 17 17 7', 'M7 7h10v10'],
    'arrow-down-left': ['M17 7 7 17', 'M17 17H7V7'],
    bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
    'bell-ring': ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4', 'M4.5 3.5 3 5', 'm19.5 0 1.5 1.5'],
    'notebook-pen': ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2', 'M8 2v4', 'M16 2v4', 'M8 10h5', 'm14 14 4-4 2 2-4 4-3 1z'],
    sheet: ['M4 3h16v18H4z', 'M8 3v18', 'M4 8h16', 'M12 8v13', 'M4 13h16'],
    'calendar-x-2': ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2', 'm14 14 4 4', 'm18 14-4 4'],
    'wallet-cards': ['M4 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2', 'M16 13h.01', 'M5 4h14'],
    package: ['m16.5 9.4-9-5.19', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16', 'M3.3 7 12 12l8.7-5', 'M12 22V12'],
    box: ['M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16', 'M3.3 7 12 12l8.7-5', 'M12 22V12'],
    'chart-no-axes-combined': ['M7 20v-6', 'M12 20V8', 'M17 20V4', 'M3 20h18'],
    'shopping-cart': ['m2 3 3 3 2.7 11.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L20 8H5', 'M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2', 'M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2'],
    smartphone: ['M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2', 'M11 18h2'],
    'trending-up': ['m3 17 6-6 4 4 8-8', 'M14 7h7v7'],
    'receipt-text': ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z', 'M8 9h8', 'M8 13h6'],
    shirt: ['m4 4 4-2 4 3 4-3 4 2 2 5-4 2v10H6V11L2 9z'],
    'briefcase-business': ['M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M3 6h18v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M3 12h18', 'M10 12v2h4v-2'],
    search: ['m21 21-4.35-4.35', 'M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0'],
    'calendar-days': ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2', 'M8 14h.01', 'M12 14h.01', 'M16 14h.01'],
    star: ['m12 2 3.1 6.3 7 .9-5.1 5 1.2 7-6.2-3.3L5.8 21l1.2-7-5.1-5 7-.9z'],
    sparkles: ['m12 3-1.8 4.2L6 9l4.2 1.8L12 15l1.8-4.2L18 9l-4.2-1.8z', 'm19 15-.8 2.2L16 18l2.2.8L19 21l.8-2.2L22 18l-2.2-.8z'],
    rocket: ['M14 4c3-3 6-3 6-3s0 3-3 6l-3 3-4-4z', 'M9 13 4 18l2 2 5-5', 'M5 13 3 11l4-4 2 2', 'M13 19l2 2 4-4-2-2'],
    play: ['m8 5 11 7-11 7z'],
    download: ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
  };
  const fallback = ['M4 4h16v16H4z'];
  const svg = (name) => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${(paths[name] || fallback).map((d) => `<path d="${d}"/>`).join('')}</svg>`;
  const render = (root = document) => root.querySelectorAll?.('[data-lucide]').forEach((node) => { if (!node.dataset.iconReady) { node.innerHTML = svg(node.dataset.lucide); node.dataset.iconReady = 'true'; } });
  window.pagueOnIcons = { render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => render()); else render();
  new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => { if (node.nodeType === 1) { if (node.matches?.('[data-lucide]')) render(node.parentElement); render(node); } }))).observe(document.documentElement, { childList: true, subtree: true });
})();
