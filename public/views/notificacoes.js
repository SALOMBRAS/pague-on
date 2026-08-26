/* ============================================================
   Pague-On — views/notificacoes.js
   Extraído do <script> inline do index.html. NÃO edite aqui a lógica
   de negócio: é movimento de código (organização), comportamento idêntico.
   ============================================================ */

function renderNotifications(){ const groups=['Hoje','Ontem']; $('#notificationPanel').innerHTML=`<header class="panel-head"><button class="back" data-close-panel>← Voltar</button><h2>Notificações</h2><button class="read-all" data-read-all>Ler todas</button></header>${groups.map(group=>`<div class="notification-group">🔔 ${group}</div>${notifications.filter(n=>n.group===group).map(n=>`<article class="notification ${n.read?'read':'unread'}" data-notification="${n.id}"><div class="notification-icon ${n.kind}">${n.icon}</div><div><b>${n.title}</b><p>${n.body}</p></div><time>${n.time}</time></article>`).join('')}`).join('')}`; $('#notificationPanel').classList.add('show'); document.querySelectorAll('[data-close-panel]').forEach(b=>b.onclick=closePanel); $('[data-read-all]').onclick=()=>{notifications.forEach(n=>n.read=true);renderPanel();showToast('Todas as notificações foram lidas');}; document.querySelectorAll('[data-notification]').forEach(b=>b.onclick=()=>{const n=notifications.find(x=>x.id===b.dataset.notification);n.read=true;renderPanel();}); }
