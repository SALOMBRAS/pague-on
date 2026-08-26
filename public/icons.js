/* ============================================================
   Pague-On — ícones vetoriais (estilo lucide, apenas os usados)
   Helper `icon(name)` devolve um <svg> inline (stroke currentColor),
   para ser usado em templates JS e markup. Mesma família visual da
   landing (lucide). String exportada também em `pagueOnIcon.paths`.
   ============================================================ */
(function () {
  var PATHS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
    trend: '<path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/>',
    package: '<path d="M21 8V16L12 21 3 16V8l9-5 9 5Z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M17 5.5a3 3 0 0 1 0 5"/><path d="M21.5 20c0-2.4-1.4-4.2-3.5-5"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10.3 19a2 2 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    wallet: '<path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1H3Z"/><path d="M3 6v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9H5a2 2 0 0 1-2-2Z"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M17 5a6 6 0 0 1 0 12"/><path d="M9.5 14a6 6 0 0 0 6 4"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    'arrow-left': '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    camera: '<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2.5 3H5l2.2 12.4a1 1 0 0 0 1 .8h9.4a1 1 0 0 0 1-.8L21 7H7"/>',
    bank: '<path d="M3 9.5 12 4l9 5.5Z"/><path d="M5 10v8M10 10v8M14 10v8M19 10v8"/><path d="M3 21h18"/>',
    cash: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V9M12 15v1.5M10.7 13a1.6 1.6 0 0 0 1.6 1.6h1.3a1.5 1.5 0 0 0 0-3H11a1.5 1.5 0 0 1 0-3h1.3a1.6 1.6 0 0 1 1.6 1.4"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z"/>',
    'arrow-left-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8l-4 4 4 4M16 12H8"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/>',
    alert: '<path d="M12 3 2.5 20h19Z"/><path d="M12 10v4M12 17.5v.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    flash: '<path d="M13 2 3 14h8l-1 8L21 10h-8Z"/>',
    receipt: '<path d="M5 3h14v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L5 21Z"/><path d="M9 8h6M9 12h6"/>',
    chart: '<path d="M3 3v18h18"/><path d="M8 17v-6M13 17V7M18 17v-4"/>',
    tag: '<path d="M2 12V4a2 2 0 0 1 2-2h8l10 10-10 10Z"/><circle cx="7" cy="7" r="1.5"/>'
  };

  var CACHE = {};
  function iconPath(name) { return PATHS[name] || ''; }

  function icon(name) {
    if (CACHE[name]) return CACHE[name];
    var p = PATHS[name];
    if (!p) { /* fallback: canto de seta genérica */ p = '<path d="M4 14a8 8 0 0 0 16 0"/>'; }
    var s = '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
    CACHE[name] = s;
    return s;
  }

  window.icon = icon;
  window.pagueOnIcon = { icon: icon, paths: PATHS };
})();