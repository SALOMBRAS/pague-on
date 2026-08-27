/* ============================================================
   Pague-On — componentes de UI compartilhados (skillbook, Onda 4)
   window.pagueOnUI: cardCobranca, emptyState, skeleton, toast, tracker.
   Dependências resolvidas em tempo de chamada (globais do app.js):
   $, format, relative, kind, state. Não roda nada na carga.
   ============================================================ */
(function () {
  // Escape HTML central — previne XSS ao renderizar dados de origem externa
  // (extrato importado, religioso, dashboard, remote). Usado por todas as views.
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function skeleton(rows) {
    var n = (rows && typeof rows === 'number') ? rows : 4;
    var out = '';
    for (var i = 0; i < n; i++) {
      out += '<div class="skel" style="' + (i === 0 ? 'height:104px;border-radius:20px;' : 'height:118px;margin-top:12px') + '"></div>';
    }
    return out;
  }

  function emptyState(opts) {
    opts = opts || {};
    var icon = opts.icon || '🎉';
    var title = opts.title || 'Nada por aqui ainda';
    var body = opts.body || '';
    var action = opts.action || '';
    return '<div class="empty">' +
      '<div style="font-size:32px" aria-hidden="true">' + icon + '</div>' +
      '<strong>' + title + '</strong>' +
      (body ? '<span>' + body + '</span>' : '') +
      (action ? '<br>' + action : '') +
      '</div>';
  }

  function toast(msg, kind) {
    if (typeof showToast === 'function') { showToast(msg, kind); return; }
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  // Vencimento em dias (date-only): 0=hoje, -3=atrasado 3.
  function dueDays(due) {
    var t = new Date();
    var a = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    var b = new Date(due).getTime();
    return Math.round((b - a) / 86400000);
  }

  function dueLabel(days) {
    if (days < 0) return 'Atrasado';
    if (days === 0) return 'Vence hoje';
    if (days === 1) return 'Vence amanhã';
    return 'Vence em ' + days + ' dias';
  }

  function toneFor(days) {
    if (days < 0) return 'overdue'; // vermelho
    if (days <= 2) return 'today';  // âmbar
    return 'ok';                    // verde
  }

  /* Maior dia do mês para normalizar o progresso quando não há criadoAt. */
  function dueProgress(days, paid) {
    if (paid || days < 0) return 100;
    return Math.max(14, 100 - Math.min(100, days * 100 / 60));
  }

  /* ---- Card de cobrança aprimorado ---- */
  function cardCobranca(debt) {
    var receive = debt.type === 'RECEIVABLE';
    var paid = debt.status === 'PAID';
    var days = dueDays(debt.due);
    var tone = paid ? 'paid' : toneFor(days);
    var label = paid ? 'Quitada' : dueLabel(days);
    var progress = dueProgress(days, paid);
    var dueTxt = new Date(debt.due).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    var statusBadge = paid ? 'Quitada' : (debt.status === 'OVERDUE' ? 'Atrasada' : (days === 0 ? 'Hoje' : 'Em aberto'));
    var toneColor = tone === 'overdue' ? 'var(--red)' : tone === 'today' ? 'var(--amber)' : 'var(--green)';

    return '<article class="debt-wrap" data-swipe="' + debt.id + '">' +
      '<div class="swipe-actions">' +
      '<button class="done" data-action="done" data-id="' + debt.id + '">✓<br>Pago</button>' +
      '<button class="edit" data-action="edit" data-id="' + debt.id + '">✎<br>Editar</button>' +
      '<button class="delete" data-action="delete" data-id="' + debt.id + '">⌫<br>Excluir</button>' +
      '</div>' +
      '<div class="debt ' + (receive ? '' : 'payable') + ' ' + tone + '" data-detail="' + debt.id + '" tabindex="0" role="button" aria-label="Ver cobrança de ' + esc(debt.counterparty) + '">' +
      '<div class="debt-top">' +
      '<div class="meta"><i class="dot ' + (receive ? '' : 'payable') + '"></i>' + (receive ? 'A RECEBER' : 'A PAGAR') + ' <span>│</span><span class="payment-type">' + kind(debt) + '</span></div>' +
      '<span class="badge ' + (debt.status === 'OVERDUE' ? 'overdue' : paid ? 'paid' : 'pending') + '">' + statusBadge + '</span>' +
      '</div>' +
      '<div class="person">' + esc(debt.counterparty) + '</div>' +
      '<div class="description">“' + esc(debt.description) + '”</div>' +
      '<div class="amountline"><span class="value">' + format(debt.amount) + '</span></div>' +
      '<div class="due-chip ' + tone + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress + '" aria-label="' + label + '"><span>' + dueTxt + ' · ' + label + '</span></div>' +
      '<div class="actions">' + (debt.paymentType === 'INSTALLMENT' ? '<button class="small-btn" data-detail="' + debt.id + '">▤ Ver parcelas</button>' : '') + (receive ? '<button class="small-btn collect" data-action="collect" data-id="' + debt.id + '">💬 Cobrar</button>' : '') + '<button class="small-btn pay ' + (receive ? '' : 'out') + '" data-action="done" data-id="' + debt.id + '">✓ ' + (receive ? 'Receber' : 'Pagar') + '</button></div>' +
      '<div class="due-progress"><i style="width:' + progress + '%;background:' + toneColor + '"></i></div>' +
      '</div>' +
      '</article>';
  }

  /* ---- Mini tracker de vencimentos (home) ---- */
  function tracker(items, limit) {
    var open = (items || []).filter(function (d) { return d.status !== 'PAID'; })
      .sort(function (a, b) { return a.due - b.due; });
    var take = (typeof limit === 'number') ? limit : 4;
    var slice = open.slice(0, take);
    if (!slice.length) {
      return '<div class="empty small"><strong>Nenhum vencimento próximo</strong><span>Você está em dia 🎉</span></div>';
    }
    return '<div class="duetracker">' + slice.map(function (d) {
      var days = dueDays(d.due);
      var tone = toneFor(days);
      return '<div class="duetracker-row"><span class="dot ' + (d.type === 'RECEIVABLE' ? '' : 'payable') + ' ' + tone + '"></span><span class="duetracker-name">' + esc(d.counterparty) + '</span><span class="duetracker-amt">' + format(d.amount) + '</span><span class="duetracker-label ' + tone + '">' + dueLabel(days) + '</span></div>';
    }).join('') + '</div>';
  }

  window.pagueOnUI = {
    esc: esc,
    cardCobranca: cardCobranca,
    emptyState: emptyState,
    skeleton: skeleton,
    toast: toast,
    tracker: tracker
  };
})();