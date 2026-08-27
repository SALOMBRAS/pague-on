/* ============================================================
   Pague-On — app.js — roteador / estado / helpers / init
   Extraído do <script> inline do index.html. NÃO edite aqui a lógica
   de negócio: é movimento de código (organização), comportamento idêntico.
   ============================================================ */

    const today = new Date();
    const addDays = (days) => { const d = new Date(today); d.setDate(d.getDate()+days); return d; };
    const format = (value) => window.pagueOnLock?.config?.hideValues ? '••••' : (window.pagueOnCurrency?.formatBrl(value) || new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value));
    const date = (value) => new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(value);
    const relative = (value) => { const days = Math.round((new Date(value)-new Date(today.getFullYear(),today.getMonth(),today.getDate()))/86400000); return days < 0 ? `Venceu ${date(value)}` : days === 0 ? 'Vence hoje' : `Vence ${date(value)}`; };
    const debts = [
      {id:'joao', type:'RECEIVABLE', paymentType:'SINGLE', status:'OVERDUE', counterparty:'João Silva', description:'Venda de Tênis Casual', amount:500, total:500, due:addDays(-5), phone:'11988887777', category:'Produto'},
      {id:'carlos', type:'RECEIVABLE', paymentType:'INSTALLMENT', status:'PENDING', counterparty:'Carlos Souza', description:'Mesa de Jantar 6 lugares', amount:250, total:1500, due:addDays(3), installments:6, paidInstallments:2, category:'Produto', product:'Mesa de Jantar', quantity:1},
      {id:'internet', type:'PAYABLE', paymentType:'RECURRING', status:'PENDING', counterparty:'Claro Empresas', description:'Internet da Loja', amount:150, total:150, due:addDays(0), frequency:'Mensal', category:'Assinatura'},
      {id:'aluguel', type:'PAYABLE', paymentType:'RECURRING', status:'PENDING', counterparty:'Imobiliária XYZ', description:'Aluguel da Loja', amount:1200, total:1200, due:addDays(14), frequency:'Mensal', category:'Aluguel'},
      {id:'imovel', type:'RECEIVABLE', paymentType:'RECURRING', status:'PENDING', counterparty:'Marina Alves', description:'Aluguel do Imóvel', amount:2000, total:2000, due:addDays(10), frequency:'Mensal', category:'Aluguel'},
      {id:'geladeira', type:'PAYABLE', paymentType:'INSTALLMENT', status:'PAID', counterparty:'Casas Bahia', description:'Geladeira Consul', amount:320, total:3840, due:addDays(-12), paidAt:addDays(-12), installments:12, paidInstallments:12, category:'Produto'}
    ];
    const products = [
      {id:'camiseta',name:'Camiseta Preta',emoji:'👕',category:'Roupas',cost:25,selling:55,stock:10,alert:5},
      {id:'tenis',name:'Tênis Casual',emoji:'👟',category:'Calçados',cost:110,selling:180,stock:4,alert:5},
      {id:'mesa',name:'Mesa de Jantar',emoji:'🪑',category:'Móveis',cost:380,selling:650,stock:2,alert:1}
    ];
    const purchases = [
      {id:'p1',productId:'camiseta',quantity:20,unitCost:22.5,supplier:'Fornecedor ABC',date:addDays(-2)},
      {id:'p2',productId:'tenis',quantity:5,unitCost:108,supplier:'Fornecedor XYZ',date:addDays(-8)},
      {id:'p3',productId:'mesa',quantity:3,unitCost:365,supplier:'Madeiras Sul',date:addDays(-28)}
    ];
    let formState = null;
    const profile = { name:'João Silva', email:'joao@email.com', plan:'Free', theme:'Escuro', currency:'BRL', push:true, sound:true, biometric:false, pin:false, hideValues:false, lockTimeout:5, reminder:'24h antes', channels:{push:true,whatsapp:true,sms:false} };
    const notifications = [
      {id:'n1',group:'Hoje',kind:'danger',icon:'🔴',title:'Cobrança atrasada!',body:'A parcela 3 do Celular venceu há 2 dias. Toque para pagar.',time:'14:30',read:false},
      {id:'n2',group:'Hoje',kind:'warning',icon:'🟡',title:'Estoque baixo',body:'Tênis Casual está com apenas 4 unidades. Considere repor.',time:'10:15',read:false},
      {id:'n3',group:'Ontem',kind:'success',icon:'✅',title:'Pagamento recebido',body:'Você recebeu R$ 250,00 de Carlos Souza.',time:'Ontem',read:true}
    ];
    const smartRules = [
      {id:'rule-transport',name:'🚗 Transporte',order:1,isActive:true,logic:'ANY',triggers:[{type:'DESCRIPTION_CONTAINS',value:'uber'},{type:'DESCRIPTION_CONTAINS',value:'99'},{type:'DESCRIPTION_CONTAINS',value:'taxi'}],actions:[{type:'SET_CATEGORY',value:'TRANSPORT'},{type:'SET_TYPE',value:'PAYABLE'}]},
      {id:'rule-rent',name:'🏠 Aluguel recorrente',order:2,isActive:true,logic:'ANY',triggers:[{type:'COUNTERPARTY_CONTAINS',value:'imobiliária'},{type:'DESCRIPTION_CONTAINS',value:'aluguel'}],actions:[{type:'SET_CATEGORY',value:'RENT'},{type:'SET_PAYMENT_TYPE',value:'RECURRING'}]}
    ];
    let ruleEditor = null;
    let state = { tab:'all', chip:'all', query:'', detail:null, screen:'home', stockTab:'products', stockFilter:'all', stockQuery:'', stockDetail:null, panel:null, historyFilter:'month', purchaseFilter:'all' };
    let dashboardRemote = null;
    let dashboardStatus = 'idle';
    let profitRemote = null;
    let profitStatus = 'idle';
    (()=>{const st=document.createElement('style');st.textContent=`.skel{position:relative;overflow:hidden;background:var(--surface);border-radius:12px}.skel::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent);animation:skelPulse 1.3s infinite}@keyframes skelPulse{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}.error-state{padding:30px 18px;text-align:center;color:var(--muted)}.error-state strong{display:block;font-size:16px;color:var(--text)}.error-state span{display:block;margin-top:6px;font-size:13px;line-height:19px}.error-state button{margin-top:16px;min-height:44px;padding:0 18px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text);font-weight:750}.dash-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 16px}.dash-summary-card{padding:13px 12px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}.dash-summary-card span{display:block;color:var(--muted);font-size:10.5px;line-height:14px}.dash-summary-card b{display:block;margin-top:4px;font-size:16px}.dash-summary-card.positive b{color:var(--green)}.dash-summary-card.danger b{color:var(--red)}.dash-summary-card.warning b{color:var(--amber)}`;document.head.append(st);})();

// ---- funções de núcleo (roteador, estado, navegação) ----
function skeletonHome(){ return (window.pagueOnUI && window.pagueOnUI.skeleton) ? window.pagueOnUI.skeleton(7) : `<header class="dashboard-head"><div class="dash-greeting"><div class="skel" style="flex:0 0 43px;width:43px;height:43px;border-radius:12px"></div><div style="flex:1"><div class="skel" style="height:13px;width:56%;margin:2px 0 8px"></div><div class="skel" style="height:15px;width:40%"></div></div></div></header><section class="dash-hero skel" style="height:104px"></section><div style="display:flex;gap:10px;margin:16px 0"><div class="skel" style="flex:1;height:70px"></div><div class="skel" style="flex:1;height:70px"></div><div class="skel" style="flex:1;height:70px"></div></div><div class="skel" style="height:120px"></div><div class="skel" style="height:120px;margin-top:12px"></div><div class="skel" style="height:140px;margin-top:12px"></div>`; }
function errorHomeMarkup(){ return `<section class="error-state"><div style="font-size:34px">😕</div><strong>Não foi possível carregar seus dados</strong><span>Verifique sua conexão e tente novamente.</span><button data-home-retry>Tentar novamente</button></section>`; }
function retryDashboard(){ dashboardStatus='loading'; render(); hydrateRemote(); }
    const labels = { all:'Tudo', receive:'Quem te deve', pay:'Quem você deve', recurring:'Recorrentes', history:'Histórico' };
    const chipSet = [{key:'all',label:'Todos'},{key:'today',label:'Hoje'},{key:'overdue',label:'Atrasados'},{key:'installment',label:'Parcelados'},{key:'recurring',label:'Recorrentes'},{key:'single',label:'Únicos'}];
    const $ = (sel) => document.querySelector(sel);
function showToast(message){ const toast=$('#toast'); toast.textContent=message; toast.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>toast.classList.remove('show'),2300); }
function persistLocal(changes=[]){ const snapshot={debts,products,purchases,profile,smartRules,assets:JSON.parse(localStorage.getItem('pagueon.assets.v1')||'[]')}; window.pagueOnOffline?.commit(snapshot,changes).catch(()=>showToast('Alteração salva nesta tela; tente novamente mais tarde.')); window.dispatchEvent(new CustomEvent('pagueon:data-change',{detail:{snapshot}})); }
    const apiCategory={Produto:'PRODUCT',Produtos:'PRODUCT',Serviço:'SERVICE',Serviços:'SERVICE',Empréstimo:'LOAN',Aluguel:'RENT',Assinatura:'SUBSCRIPTION',Transporte:'TRANSPORT',Utilidades:'UTILITIES',Outro:'OTHER'};
    const apiFrequency={Semanal:'WEEKLY',Quinzenal:'BIWEEKLY',Mensal:'MONTHLY',Bimestral:'BIMONTHLY',Trimestral:'QUARTERLY',Semestral:'SEMIANNUAL',Anual:'ANNUAL'};
function remoteDebt(item){return {id:item.id,type:item.type,paymentType:item.paymentType,status:item.status,counterparty:item.counterparty,description:item.description,amount:Number(item.installmentAmount||item.totalAmount),total:Number(item.totalAmount),due:new Date(item.dueDate),phone:item.counterpartyPhone,category:item.category,installments:item.totalInstallments,paidInstallments:item.paidInstallments,frequency:item.frequency,product:item.product?.name,productId:item.productId,quantity:item.quantity,paidAt:item.paidAt?new Date(item.paidAt):null,createdAt:new Date(item.createdAt),remote:true};}
function remoteProduct(item){return {id:item.id,name:item.name,emoji:item.image?'🖼️':'📦',category:item.category,cost:Number(item.costPrice),selling:Number(item.sellingPrice),stock:item.stockQuantity,alert:item.minStockAlert,description:item.description,remote:true};}
function remotePurchase(item){return {id:item.id,productId:item.productId,quantity:item.quantity,unitCost:Number(item.unitCost),supplier:item.supplier,date:new Date(item.date),remote:true};}
function debtPayload(item){const due=item.due||new Date();return {type:item.type,paymentType:item.paymentType,description:item.description,category:apiCategory[item.category]||item.category||'OTHER',counterparty:item.counterparty||'Lançamento avulso',counterpartyPhone:item.phone||null,totalAmount:Number(item.total),totalInstallments:item.paymentType==='INSTALLMENT'?Number(item.installments):null,frequency:item.paymentType==='RECURRING'?(apiFrequency[item.frequency]||item.frequency||'MONTHLY'):null,startDate:new Date(due).toISOString(),productId:item.productId||null,quantity:item.quantity?Number(item.quantity):null,currency:'BRL'};}
async function hydrateRemote(){if(!window.pagueOnApi?.authenticated())return;dashboardStatus='loading';dashboardRemote=null;try{const [dashboard,remoteDebts,remoteProducts,remotePurchases,remoteProfile]=await Promise.all([window.pagueOnApi.get('/dashboard'),window.pagueOnApi.get('/debts'),window.pagueOnApi.get('/products'),window.pagueOnApi.get('/purchases'),window.pagueOnApi.get('/auth/me')]);debts.splice(0,debts.length,...remoteDebts.map(remoteDebt));products.splice(0,products.length,...remoteProducts.map(remoteProduct));purchases.splice(0,purchases.length,...remotePurchases.map(remotePurchase));Object.assign(profile,{...remoteProfile,plan:remoteProfile.plan||'Free',push:remoteProfile.notificationEnabled,sound:remoteProfile.notificationSound!=='SILENT'});dashboardRemote=dashboard;dashboardStatus='ready';persistLocal();render();window.dispatchEvent(new CustomEvent('pagueon:remote-hydrated',{detail:{dashboard}}));}catch(error){dashboardStatus='error';showToast('Modo offline — mostrando dados salvos.');render();}}
function matchesLocalTrigger(debt,trigger){ if(!trigger.type){ const actual=String(debt[trigger.field]??'').toLocaleLowerCase('pt-BR'),target=String(trigger.value).toLocaleLowerCase('pt-BR'); return trigger.operator==='contains'?actual.includes(target):actual===target; } const meta=TRIGGER_META[trigger.type]; if(!meta)return false; const actual=String(debt[meta.field]??''); if(meta.operator==='gt')return Number(actual)>Number(trigger.value); if(meta.operator==='lt')return Number(actual)<Number(trigger.value); const a=actual.toLocaleLowerCase('pt-BR'),b=String(trigger.value).toLocaleLowerCase('pt-BR'); return meta.operator==='contains'?a.includes(b):meta.operator==='starts_with'?a.startsWith(b):a===b; }
function applySmartRulesLocal(debt){ let value={...debt,tags:[...(debt.tags||[])]}; const applied=[]; [...smartRules].filter(rule=>rule.isActive).sort((a,b)=>a.order-b.order).forEach(rule=>{const hit=rule.logic==='ANY'?rule.triggers.some(trigger=>matchesLocalTrigger(value,trigger)):rule.triggers.every(trigger=>matchesLocalTrigger(value,trigger));if(!hit)return;rule.actions.forEach(action=>{if(action.type==='SET_CATEGORY')value.category=action.value;if(action.type==='SET_TYPE')value.type=action.value;if(action.type==='SET_PAYMENT_TYPE'){value.paymentType=action.value;if(action.value==='RECURRING')value.frequency='Mensal';}if(action.type==='ADD_TAG'&&!value.tags.includes(action.value))value.tags.push(action.value);});applied.push(rule.name);});return {debt:value,applied}; }
async function loadProfit(){ if(!window.pagueOnApi?.authenticated()||profitStatus!=='idle')return; profitStatus='loading'; try{ profitRemote=await window.pagueOnApi.get('/reports/profit'); profitStatus='ready'; }catch(_error){ profitRemote=null; profitStatus='error'; } if(state.screen==='stock'&&state.stockTab==='analysis')renderStock(); }
function openPanel(kind){state.panel=kind;ruleEditor=null;if(kind==='rules'){hydrateRules().then(renderPanel);}else{renderPanel();}}
function closePanel(){state.panel=null;$('#notificationPanel').classList.remove('show');$('#searchPanel').classList.remove('show');$('#rulesPanel').classList.remove('show');render();}
function renderPanel(){ $('.bottom-nav').style.display='none'; if(state.panel==='rules'){renderRulesPanel();return;} if(state.panel==='notifications'){renderNotifications();return;} renderSearchPanel(); }
function openCash(tab='all'){ state.screen='caixa';state.tab=tab;state.chip='all';state.detail=null;render(); }
function render(){ $('#mainView').style.display=state.screen==='caixa'?'block':'none'; $('#homeView').classList.toggle('show',state.screen==='home'); $('#wealthView').classList.toggle('show',state.screen==='wealth'); $('#stockView').classList.toggle('show',state.screen==='stock'); $('#profileView').classList.toggle('show',state.screen==='profile'); $('#goalsView')?.classList.toggle('show',state.screen==='goals'); const inDetail=!!state.detail||!!state.stockDetail||!!state.panel; $('.bottom-nav').style.display=inDetail?'none':'flex'; $('#detail').classList.toggle('show',!!state.detail); $('#stockDetail').classList.toggle('show',!!state.stockDetail); document.querySelectorAll('.nav').forEach(b=>{const on=b.dataset.nav===state.screen;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}); if(state.panel){renderPanel();return;} if(state.detail){ renderDetail(); return; } if(state.stockDetail){ renderStockDetail(); return; } if(state.screen==='home'){document.dispatchEvent(new CustomEvent('pagueon:dashboard-request'));return;} if(state.screen==='wealth'){window.pagueOnNetWorth?.render();return;} if(state.screen==='goals'){renderGoalsView();return;} if(state.screen==='stock'){renderStock();return;} if(state.screen==='profile'){renderProfile();return;} $('#chips').style.display=(state.tab==='receive'||state.tab==='pay')?'flex':'none'; $('#chips').innerHTML=chipSet.map(c=>`<button class="chip ${state.chip===c.key?'active':''}" data-chip="${c.key}" aria-pressed="${state.chip===c.key}">${c.label}</button>`).join(''); document.querySelectorAll('.tab').forEach(b=>{const on=b.dataset.tab===state.tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',on);}); $('#cashContent').innerHTML=state.tab==='recurring'?recurringView():state.tab==='history'?historyView():normalView(); bindDynamic(); }
function renderDetail(){ const d=debts.find(x=>x.id===state.detail); const receive=d.type==='RECEIVABLE'; const lines=d.paymentType==='INSTALLMENT'?Array.from({length:d.installments},(_,i)=>{const paid=i<d.paidInstallments; const next=i===d.paidInstallments; const due=addDays((i-d.paidInstallments)*30+3); return `<div class="installment ${paid?'paid':''} ${next?'next':''}"><span>${paid?'✓':'□'} ${i+1}ª parcela</span><b>${format(d.amount)}</b><span>${paid?'Pago':date(due)}</span></div>`;}).join(''):d.paymentType==='RECURRING'?`<div class="installment paid"><span>✓ ${date(addDays(-30))}</span><b>${format(d.amount)}</b><span>Pago</span></div><div class="installment next"><span>□ ${date(d.due)}</span><b>${format(d.amount)}</b><span>Próximo</span></div>`:''; $('#detail').innerHTML=`<header class="detail-top"><button class="back" data-back>← Voltar</button><div><button class="muted-icon" data-action="edit" data-id="${d.id}">✎</button><button class="muted-icon" data-action="delete" data-id="${d.id}">⌫</button></div></header><div class="detail-identity"><div class="detail-badges"><i class="dot ${receive?'':'payable'}"></i>${receive?'A RECEBER':'A PAGAR'} <span>│</span><span>${kind(d)}</span></div><h2>${d.counterparty}</h2><p>“${d.description}”</p></div><div class="info-grid"><div class="info"><span>Valor total</span><b>${format(d.total)}</b></div>${d.paymentType==='INSTALLMENT'?`<div class="info"><span>Valor da parcela</span><b>${format(d.amount)}</b></div>`:''}<div class="info"><span>${d.paymentType==='INSTALLMENT'?'Próxima parcela':'Próximo vencimento'}</span><b>${date(d.due)}</b></div><div class="info"><span>Categoria</span><b>${d.category}</b></div>${d.product?`<div class="info"><span>Produto vinculado</span><b>${d.product}</b></div><div class="info"><span>Quantidade</span><b>${d.quantity} unidade</b></div>`:''}</div>${lines?`<section class="installments"><h3>${d.paymentType==='RECURRING'?'Histórico de pagamentos':'▤ Parcelas'}</h3><div class="installment-list">${lines}</div></section>`:''}<div class="detail-actions">${receive?`<button class="big-btn secondary" data-action="collect" data-id="${d.id}">💬 Enviar cobrança</button>`:''}<button class="big-btn ${receive?'':'out'}" data-action="done" data-id="${d.id}">✓ ${receive?'Marcar como recebido':'Marcar como pago'}</button></div>`; bindDynamic(); }
function bindDynamic(){ document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.chip='all';render();}); document.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{state.chip=b.dataset.chip;render();}); document.querySelectorAll('[data-history-filter]').forEach(b=>b.onclick=()=>{state.historyFilter=b.dataset.historyFilter;render();}); document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=(e)=>{if(e.target.closest('[data-action]'))return; state.detail=b.dataset.detail;render();}); document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{state.detail=null;render();}); document.querySelectorAll('[data-add]').forEach(b=>b.onclick=openSheet); document.querySelectorAll('[data-action]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();action(b.dataset.action,b.dataset.id);}); document.querySelectorAll('[data-swipe]').forEach(w=>swipe(w)); }
function swipe(wrap){ let start=0; wrap.onpointerdown=e=>{start=e.clientX;}; wrap.onpointerup=e=>{ if(start && e.clientX-start<-55) wrap.classList.add('revealed'); if(start && e.clientX-start>35) wrap.classList.remove('revealed'); start=0; }; }
async function action(type,id){ const d=debts.find(x=>x.id===id); if(!d)return; try{if(type==='collect'){const result=window.pagueOnApi?.authenticated()&&d.remote?await window.pagueOnApi.get(`/debts/${id}/collect`):null;if(result?.whatsappLink)window.open(result.whatsappLink,'_blank','noopener');else showToast(`Cobrança pronta para ${d.counterparty}`);return;}if(type==='done'){if(window.pagueOnApi?.authenticated()&&d.remote)await window.pagueOnApi.post(`/debts/${id}/pay`,{});else{d.status='PAID';d.paidAt=new Date();persistLocal([{entity:'debts',action:'UPDATE',payload:d}]);}state.detail=null;await hydrateRemote();showToast(`${receiveWord(d)} registrada com sucesso`);render();return;}if(type==='edit'){showToast('Edição da conta será aberta aqui');return;}if(type==='delete'&&confirm(`Excluir “${d.description}”?`)){if(window.pagueOnApi?.authenticated()&&d.remote)await window.pagueOnApi.delete(`/debts/${id}`);else{debts.splice(debts.indexOf(d),1);persistLocal([{entity:'debts',action:'DELETE',payload:{id:d.id}}]);}state.detail=null;await hydrateRemote();render();showToast('Conta excluída');}}catch(error){showToast(error.message||'Não foi possível sincronizar a alteração.');}}
function receiveWord(d){ return d.type==='RECEIVABLE'?'Recebimento':'Pagamento'; }
    const money = (value) => Number(String(value||'0').replace(',','.')) || 0;
    const isoToday = () => new Date().toISOString().slice(0,10);
function openSheet(){ $('#sheet').classList.add('show'); $('#sheetBackdrop').classList.add('show'); const fc=$('#sheet .choice'); if(fc) setTimeout(function(){ fc.focus(); }, 30); }
function closeSheet(){ $('#sheet').classList.remove('show'); $('#sheetBackdrop').classList.remove('show'); }
function openForm(kind){ closeSheet(); formState={kind,step:1,type:kind==='expense'?'PAYABLE':'RECEIVABLE',payment:'SINGLE',productId:null,linkProduct:false,data:{due:isoToday(),start:isoToday(),frequency:'MONTHLY',repeat:'indefinite',reminderType:'PUSH'}}; $('#formView').classList.add('show'); $('.bottom-nav').style.display='none'; renderForm(); }
function closeForm(){ formState=null; $('#formView').classList.remove('show'); render(); }

// ---- boot: bindings + módulos window.* (roda após as views) ----

  function bootApp(){
    document.getElementById('deskNewCharge')?.addEventListener('click', () => openForm('debt'));
$('#searchBtn').onclick=()=>{ $('#searchWrap').classList.toggle('open'); if($('#searchWrap').classList.contains('open')) $('#searchInput').focus(); }; $('#searchInput').oninput=e=>{state.query=e.target.value;render();}; $('#addBtn').onclick=openSheet; $('#centerAdd').onclick=openSheet; $('#sheetBackdrop').onclick=closeSheet; $('#sheetCancel').onclick=closeSheet; document.querySelectorAll('[data-create]').forEach(b=>b.onclick=()=>openForm(b.dataset.create)); let dragStart=0; $('#sheetHandle').onpointerdown=e=>dragStart=e.clientY; $('#sheetHandle').onpointerup=e=>{if(e.clientY-dragStart>45)closeSheet();dragStart=0;}; document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{const nav=b.dataset.nav; if(['home','caixa','wealth','stock','profile','goals'].includes(nav)){state.screen=nav;state.detail=null;state.stockDetail=null;state.panel=null;render();}}); document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{state.screen='caixa';state.tab=b.dataset.go;state.chip='all';render();}); $('#homeSale')?.addEventListener('click',openSheet); $('#homeDebt')?.addEventListener('click',openSheet); $('#stockAdd').onclick=()=>openForm('product'); $('#stockSearch').onclick=()=>{const query=prompt('Buscar produto',state.stockQuery);if(query!==null){state.stockQuery=query;state.stockTab='products';render();}};
    $('#rulesQuick')?.addEventListener('click', () => openPanel('rules'));
    render();
    window.pagueOnOffline?.boot({ hydrate(snapshot){
      if(Array.isArray(snapshot.debts)) debts.splice(0,debts.length,...snapshot.debts);
      if(Array.isArray(snapshot.products)) products.splice(0,products.length,...snapshot.products);
      if(Array.isArray(snapshot.purchases)) purchases.splice(0,purchases.length,...snapshot.purchases);
      if(snapshot.profile) Object.assign(profile,snapshot.profile);
      if(Array.isArray(snapshot.smartRules)) smartRules.splice(0,smartRules.length,...snapshot.smartRules);
      render();
    }}).finally(()=>hydrateRemote());
    window.addEventListener('pagueon:auth',()=>hydrateRemote());
    window.addEventListener('pagueon:security', ({detail}) => {
      profile.pin = Boolean(detail.pinHash);
      profile.biometric = Boolean(detail.biometricPreferred);
      profile.hideValues = Boolean(detail.hideValues);
      profile.lockTimeout = Number(detail.lockTimeout || 5);
      persistLocal();
      render();
    });
    window.pagueOnExportData = {
      snapshot(){ return { version:'1.0', exportedAt:new Date().toISOString(), profile:{ name:profile.name, email:profile.email, currency:profile.currency, theme:profile.theme }, data:{ debts, products, purchases, rules:smartRules, assets:JSON.parse(localStorage.getItem('pagueon.assets.v1')||'[]'), budgets:JSON.parse(localStorage.getItem('pagueon.budgets.v1')||'[]') } }; },
      restore(backup){
        if(!backup || backup.version!=='1.0' || !backup.data || !Array.isArray(backup.data.debts) || !Array.isArray(backup.data.products) || !Array.isArray(backup.data.purchases)) throw new Error('Formato de backup inválido.');
        const revive=(items,fields)=>items.map(item=>{ const copy={...item}; fields.forEach(field=>{if(copy[field])copy[field]=new Date(copy[field]);}); return copy; });
        debts.splice(0,debts.length,...revive(backup.data.debts,['due','paidAt'])); products.splice(0,products.length,...backup.data.products); purchases.splice(0,purchases.length,...revive(backup.data.purchases,['date'])); if(Array.isArray(backup.data.rules)) smartRules.splice(0,smartRules.length,...backup.data.rules); if(Array.isArray(backup.data.assets))localStorage.setItem('pagueon.assets.v1',JSON.stringify(backup.data.assets)); if(Array.isArray(backup.data.budgets))localStorage.setItem('pagueon.budgets.v1',JSON.stringify(backup.data.budgets)); if(backup.profile) Object.assign(profile,backup.profile); persistLocal(); render();
      }
    };
    window.pagueOnBill = {
      create(data){
        const result=applySmartRulesLocal({id:`scan-${Date.now()}`,type:'PAYABLE',paymentType:'SINGLE',status:'PENDING',counterparty:data.counterparty,description:data.description,amount:Number(data.amount),total:Number(data.amount),due:new Date(data.due),category:'Serviço',barcode:data.barcode||null,source:'OCR'});
        debts.unshift(result.debt); persistLocal([{entity:'debts',action:'CREATE',payload:debts[0]}]); state.screen='caixa';state.tab='all';render();
      }
    };
    window.pagueOnDuplicateActions = { edit(id){ state.detail=id;state.screen='caixa';state.stockDetail=null;state.panel=null;render(); } };
    window.pagueOnCurrencyActions = { refresh(){ render(); } };
    window.pagueOnReconciliationActions = {
      debts(){ return debts.map(item=>({...item})); },
      confirm(id){ const debt=debts.find(item=>item.id===id); if(debt){ debt.reconciled=true; persistLocal([{entity:'debts',action:'UPDATE',payload:debt}]); } },
      create(transaction){ const amount=Math.abs(Number(transaction.amount)); const debt={id:`bank-${Date.now()}`,type:Number(transaction.amount)>=0?'RECEIVABLE':'PAYABLE',paymentType:'SINGLE',status:'PAID',counterparty:transaction.description,description:transaction.description,amount,total:amount,paidAmount:amount,due:new Date(transaction.date),paidAt:new Date(transaction.date),category:'Outro',source:'BANK_STATEMENT'}; debts.unshift(debt); persistLocal([{entity:'debts',action:'CREATE',payload:debt}]); return debt; }
    };
    window.pagueOnWidgetActions = {
      addDebt(){ openForm('debt'); },
      urgent(){ state.screen='caixa';state.tab='all';state.chip='overdue';render(); }
    };
    window.pagueOnOnboardingActions = {
      home(){ state.screen='home';state.detail=null;state.stockDetail=null;state.panel=null;render(); },
      caixa(){ state.screen='caixa';state.detail=null;state.stockDetail=null;state.panel=null;render(); },
      estoque(){ state.screen='stock';state.detail=null;state.stockDetail=null;state.panel=null;render(); },
      lembrete(){ openForm('reminder'); },
      finish(){ formState=null;$('#formView').classList.remove('show');state.screen='home';state.detail=null;state.stockDetail=null;state.panel=null;render(); }
    };
    /* ===== Atalhos de teclado (desktop) ===== */
    document.addEventListener('keydown', (e) => {
      const target = e.target;
      const tag = (target && (target.tagName || '').toUpperCase());
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (target && target.isContentEditable)) return;
      const key = e.key;
      if (key === 'n' || key === 'N') { e.preventDefault(); openForm('debt'); }
      else if (key === '/') { e.preventDefault(); openPanel('search'); }
      else if (key === 'Escape') {
        if (document.querySelector('#formView.show')) closeForm();
        else if (document.querySelector('#sheet.show')) closeSheet();
        else if (state.panel) closePanel();
        else if (state.detail || state.stockDetail) { state.detail = null; state.stockDetail = null; render(); }
      }
    });
    /* ===== Ativação por teclado (Enter/Espaço) em cards clicáveis ===== */
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (!t || e.key !== 'Enter' && e.key !== ' ') return;
      const tag = (t.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') return;
      const card = t.closest && t.closest('[data-detail]');
      if (card) { e.preventDefault(); state.detail = card.dataset.detail; render(); }
    });
    /* ===== Toggle de tema (desktop header) ===== */
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.onclick = () => { if (window.pagueOnTheme) { window.pagueOnTheme.toggle(); render(); } };
    }

  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApp);
  } else {
    bootApp();
  }
