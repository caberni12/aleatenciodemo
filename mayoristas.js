const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n||0));
const fmtDate=v=>{try{return new Date(v).toLocaleString('es-CL')}catch(_){return String(v||'')}};
const fmtDay=v=>{try{return new Date(v).toLocaleDateString('es-CL')}catch(_){return String(v||'')}};
let token=localStorage.getItem('aleMayoristaToken')||'',state={},cart=[],lastOrder=null,whProductState={id:'',sizeId:'',qty:1,note:''};

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2400)}
function setBusy(btn,on,label='Procesando…'){
  if(!btn)return; if(on){btn.dataset.prevHtml=btn.innerHTML;btn.disabled=true;btn.classList.add('is-loading');const span=btn.querySelector('span');if(span)span.textContent=label}
  else{btn.disabled=false;btn.classList.remove('is-loading');if(btn.dataset.prevHtml){btn.innerHTML=btn.dataset.prevHtml;delete btn.dataset.prevHtml}}
}
async function busy(btn,fn,label){setBusy(btn,true,label);try{return await fn()}finally{setBusy(btn,false)}}
function fileDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
function showAuth(msg=''){token='';$('#portal').classList.add('hidden');$('#authShell').classList.remove('hidden');if(msg)$('#loginStatus').textContent=msg}
function showPortal(){$('#authShell').classList.add('hidden');$('#portal').classList.remove('hidden')}
function dateOnly(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return'';return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function inDateRange(v,from,to){const d=dateOnly(v);if(from&&(!d||d<from))return false;if(to&&(!d||d>to))return false;return true}

$$('[data-auth-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  $$('[data-auth-tab]').forEach(x=>x.classList.toggle('active',x===btn));
  $$('.auth-pane').forEach(p=>p.classList.toggle('active',p.dataset.pane===btn.dataset.authTab));
  $('#loginStatus').textContent='';$('#registerStatus').textContent='';
}));

$('#whRegisterForm').onsubmit=async e=>{
  e.preventDefault();const btn=e.submitter||e.currentTarget.querySelector('button[type="submit"]'),status=$('#registerStatus');status.textContent='';
  const p1=$('#regPassword').value,p2=$('#regPassword2').value;if(p1!==p2){status.textContent='Las contraseñas no coinciden.';return}if(p1.length<8){status.textContent='La contraseña debe tener al menos 8 caracteres.';return}
  await busy(btn,async()=>{try{
    const out=await AleAPI.postPublic('mayoristaregister',{rut:$('#regRut').value.trim(),razon_social:$('#regBusiness').value.trim(),giro:$('#regBusinessActivity').value.trim(),contacto:$('#regContact').value.trim(),telefono:$('#regPhone').value.trim(),email:$('#regEmail').value.trim(),direccion:$('#regAddress').value.trim(),comuna:$('#regCommune').value.trim(),usuario:$('#regUser').value.trim(),password:p1,observaciones:$('#regNotes').value.trim()});
    e.currentTarget.reset();status.textContent='✓ Solicitud enviada. Administración debe aprobarla y asignar tu lista de precios.';toast('✓ Solicitud Mayorista enviada');
  }catch(err){console.warn(err);const c=String(err?.message||err||'').toUpperCase();if(c.includes('SOLICITUD_MAYORISTA_PENDIENTE_EXISTENTE'))status.textContent='Ya existe una solicitud pendiente con ese RUT, usuario o correo.';else if(c.includes('USUARIO_YA_EXISTE'))status.textContent='Ese usuario ya está registrado.';else if(c.includes('EMAIL_YA_EXISTE'))status.textContent='Ese correo ya está registrado.';else if(c.includes('RUT'))status.textContent='Revisa el RUT ingresado.';else if(c.includes('ACCION_NO_VALIDA')||c.includes('ALE_REGISTRAR_SOLICITUD'))status.textContent='El backend o SQL de Mayoristas debe actualizarse a R9.18.63.';else status.textContent=`No fue posible enviar la solicitud${c?` · ${c}`:''}`}},'Enviando…');
};

$('#whLoginForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter||e.currentTarget.querySelector('button[type="submit"]'),s=$('#loginStatus');s.textContent='';await busy(btn,async()=>{let loginOk=false;try{const out=await AleAPI.login($('#whUser').value.trim(),$('#whPassword').value);loginOk=true;if(String(out.user?.rol||'').toUpperCase()!=='MAYORISTA')throw new Error('PERFIL_MAYORISTA_REQUERIDO');token=out.token;localStorage.setItem('aleMayoristaToken',token);await bootstrap()}catch(err){console.warn(err);const code=String(err?.message||err||'').toUpperCase();if(!loginOk&&(/USUARIO_O_CLAVE_INVALIDOS|CREDENCIALES/.test(code)))s.textContent='Usuario o clave inválidos.';else if(/USUARIO_INACTIVO/.test(code))s.textContent='Tu usuario aún no está activo. Administración debe aprobar la solicitud y asignar una lista.';else if(/MAYORISTA_SUSPENDIDO/.test(code))s.textContent='El perfil Mayorista está suspendido.';else if(/MAYORISTA_NO_APROBADO/.test(code))s.textContent='El perfil Mayorista todavía no está aprobado.';else if(/MAYORISTA_SIN_ASIGNACION|LISTA_PRECIO/.test(code))s.textContent='Falta una lista de precios Mayorista activa.';else if(/PERFIL_MAYORISTA_REQUERIDO/.test(code))s.textContent='Este usuario no corresponde a un perfil Mayorista.';else s.textContent='No fue posible iniciar sesión Mayorista.';if(loginOk){localStorage.removeItem('aleMayoristaToken');token=''}}},'Ingresando…')};

async function bootstrap(){if(!token)return showAuth();try{const out=await AleAPI.post('mayoristabootstrap',{},token);state=out;showPortal();render()}catch(e){console.warn(e);const code=String(e?.message||'');if(/SESION_|PERFIL_MAYORISTA|MAYORISTA_NO_APROBADO|MAYORISTA_SIN_ASIGNACION|LISTA_PRECIO/.test(code)){localStorage.removeItem('aleMayoristaToken');showAuth('Tu acceso Mayorista no está habilitado o la sesión venció.')}else toast('No fue posible actualizar el portal')}}

function render(){const c=state.client||{},l=state.priceList||{},k=state.kpis||{},u=state.user||{};$('#whWelcome').textContent=c.razon_social||c.nombre||'Mayorista';$('#whListBadge').textContent=l.nombre||'Lista autorizada';$('#kOrders').textContent=k.orders||0;$('#kTotal').textContent=money(k.total);$('#kPaid').textContent=k.paid||0;$('#kPending').textContent=k.pending||0;$('#whAddress').value=c.direccion||'';$('#whCommune').value=c.comuna||'';const avatar=u.profile_url||'favicon.png';$('#whHeaderAvatar').src=avatar;$('#whProfilePhoto').src=avatar;populateCatalogFilters();populateOrderFilters();renderProducts();renderOrders();renderCredit();renderDocuments();renderProfile();renderNotifications();renderCart()}

function populateCatalogFilters(){const sel=$('#whCategory'),cur=sel.value,cats=[...new Set((state.products||[]).map(p=>String(p.categoria_nombre||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));sel.innerHTML='<option value="">Todas</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');if(cats.includes(cur))sel.value=cur}
function populateOrderFilters(){for(const [id,key] of [['#whOrderStatus','estado'],['#whOrderPaymentStatus','estado_pago']]){const sel=$(id),cur=sel.value,vals=[...new Set((state.orders||[]).map(o=>String(o[key]||'').trim()).filter(Boolean))].sort();sel.innerHTML='<option value="">Todos</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(vals.includes(cur))sel.value=cur}}

function whShowStockToClients(){return ["SI","SÍ","TRUE","1","YES","ON"].includes(String(state?.config?.mostrar_stock_clientes||"").trim().toUpperCase())}
function whProductById(id){return (state.products||[]).find(x=>String(x.id)===String(id))||null}
function whGlobalStock(p){const sizes=whProductSizes(p);if(sizes.length)return sizes.reduce((sum,z)=>{const n=Number(z?.stock);return sum+(Number.isFinite(n)?n:0)},0);const n=Number(p?.stock);return Number.isFinite(n)?n:0}
function whProductSizes(p){return Array.isArray(p?.tamanos)?p.tamanos.filter(z=>Number(z?.precio||0)>0):[]}
function whSelectedSize(p,sizeId){const rows=whProductSizes(p);return rows.find(z=>String(z.id)===String(sizeId))||rows[0]||null}
function whPriceText(value){return Number(value||0)>0?money(value):'Consultar'}
function renderProducts(){const q=$('#whSearch').value.trim().toLowerCase(),cat=$('#whCategory').value,from=$('#whCatalogFrom').value,to=$('#whCatalogTo').value;const rows=(state.products||[]).filter(p=>{const text=`${p.nombre} ${p.descripcion||''} ${p.categoria_nombre||''}`.toLowerCase();const dt=p.creado_en||p.created_at||p.updated_at||'';return text.includes(q)&&(!cat||String(p.categoria_nombre||'')===cat)&&inDateRange(dt,from,to)});$('#whProducts').innerHTML=rows.map(p=>{const sizes=whProductSizes(p),sel=sizes[0]||null,price=Number(sel?.precio||0),sizeMeta=sizes.length?`${sizes.length} ${sizes.length===1?'tamaño':'tamaños'}`:'Presentación única';return `<article class="wh-product-compact" data-product="${esc(p.id)}" role="button" tabindex="0" aria-label="Ver ${esc(p.nombre)}"><div class="wh-product-image"><img src="${esc(p.image_url||'logo-ale-atencio.png')}" alt="${esc(p.nombre)}" loading="lazy"></div><div class="wh-product-body"><small>${esc(p.categoria_nombre||'')}</small><h3>${esc(p.nombre)}</h3><p>${esc(p.descripcion||'')}</p>${whShowStockToClients()?`<div class="wh-stock-general"><i class="bi bi-box-seam"></i><span>Stock general</span><strong>${whGlobalStock(p)} ${Math.abs(whGlobalStock(p))===1?'unidad':'unidades'}</strong></div>`:''}<div class="wh-product-meta"><span>${esc(sizeMeta)}</span><strong>${price>0?`${sizes.length>1?'Desde ':''}${money(price)}`:'Consultar'}</strong></div></div><button class="wh-product-plus" type="button" data-open-product aria-label="Ver opciones"><i class="bi bi-plus-lg"></i></button></article>`}).join('')||'<div class="empty-state">No hay productos que coincidan con los filtros.</div>'}

function renderWhProductModal(){const p=whProductById(whProductState.id),host=$('#whProductContent');if(!p||!host)return;const sizes=whProductSizes(p),selected=whSelectedSize(p,whProductState.sizeId);if(selected)whProductState.sizeId=String(selected.id||'');const unitPrice=Number(selected?.precio||0),qty=Math.max(1,Number(whProductState.qty||1)),note=String(whProductState.note||'');const sizeOptions=sizes.length?`<div class="wh-product-section"><div class="wh-product-section-head"><div><div class="wh-product-label">Tamaño ${esc((p.nombre||'').toLowerCase())}</div><div class="wh-product-hint">Selecciona al menos 1</div></div><span class="wh-product-required">Obligatorio</span></div><div class="wh-product-sizes">${sizes.map(z=>`<button type="button" class="wh-product-size ${String(z.id)===String(selected?.id)?'active':''}" data-wh-size="${esc(z.id)}"><span class="wh-product-size-copy"><span class="wh-product-size-name">${esc(z.nombre)}</span><small>${whPriceText(z.precio)}</small></span><span class="wh-product-size-check"></span></button>`).join('')}</div></div>`:'';host.innerHTML=`<div class="wh-product-layout"><div class="wh-product-media"><img src="${esc(p.image_url||'logo-ale-atencio.png')}" alt="${esc(p.nombre)}"></div><div class="wh-product-side"><div class="wh-product-scroll"><small>${esc(p.categoria_nombre||'')}</small><h2 id="whProductTitle">${esc(p.nombre)}</h2><p>${esc(p.descripcion||'')}</p>${sizeOptions}<div class="wh-product-section"><div class="wh-product-label wh-product-label-lg">Instrucciones especiales</div><textarea class="wh-product-note" id="whProductNote" placeholder="Incluye una nota">${esc(note)}</textarea></div></div><div class="wh-product-footer"><div class="wh-product-qty"><button type="button" data-wh-qty="-1"><i class="bi bi-dash"></i></button><strong>${qty}</strong><button type="button" data-wh-qty="1"><i class="bi bi-plus"></i></button></div><button type="button" class="wh-product-add" id="whProductAdd"><span>Agregar</span><strong>${money(unitPrice*qty)}</strong></button></div></div></div>`}
function openWhProduct(id){const p=whProductById(id);if(!p)return;const first=whProductSizes(p)[0]||null;whProductState={id:String(id),sizeId:String(first?.id||''),qty:1,note:''};renderWhProductModal();$('#whProductModal').classList.add('open');$('#whProductModal').setAttribute('aria-hidden','false');document.body.classList.add('wh-modal-open')}
function closeWhProduct(){$('#whProductModal').classList.remove('open');$('#whProductModal').setAttribute('aria-hidden','true');document.body.classList.remove('wh-modal-open')}
function addWhProductFromModal(){const p=whProductById(whProductState.id),z=whSelectedSize(p,whProductState.sizeId);if(!p||!z)return toast('Selecciona un tamaño');const key=`${p.id}|${z.id}`,old=cart.find(x=>x.key===key),amount=Math.max(1,Number(whProductState.qty||1));if(old){old.cantidad+=amount;if(whProductState.note)old.nota=whProductState.note}else cart.push({key,id:p.id,nombre:p.nombre,tamano_id:z.id,tamano_nombre:z.nombre,precio:Number(z.precio||0),cantidad:amount,nota:whProductState.note||''});renderCart();closeWhProduct();openCart();toast(amount>1?`${amount} productos agregados`:'Producto agregado')}
$('#whProducts').onclick=e=>{const card=e.target.closest('.wh-product-compact');if(card)openWhProduct(card.dataset.product)};$('#whProducts').onkeydown=e=>{const card=e.target.closest('.wh-product-compact');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openWhProduct(card.dataset.product)}};$('#whProductClose').onclick=closeWhProduct;$('#whProductModal').onclick=e=>{if(e.target===$('#whProductModal'))closeWhProduct()};$('#whProductContent').onclick=e=>{const size=e.target.closest('[data-wh-size]');if(size){whProductState.sizeId=String(size.dataset.whSize||'');whProductState.note=$('#whProductNote')?.value||whProductState.note;renderWhProductModal();return}const qty=e.target.closest('[data-wh-qty]');if(qty){whProductState.note=$('#whProductNote')?.value||whProductState.note;whProductState.qty=Math.max(1,Math.min(999,Number(whProductState.qty||1)+Number(qty.dataset.whQty||0)));renderWhProductModal();return}if(e.target.closest('#whProductAdd')){whProductState.note=$('#whProductNote')?.value||'';addWhProductFromModal()}};$('#whProductContent').oninput=e=>{if(e.target.matches('#whProductNote'))whProductState.note=e.target.value};

function filteredOrders(){const q=$('#whOrderSearch').value.trim().toLowerCase(),st=$('#whOrderStatus').value,pay=$('#whOrderPaymentStatus').value,from=$('#whOrderFrom').value,to=$('#whOrderTo').value;return (state.orders||[]).filter(o=>`${o.numero_pedido||o.id} ${o.estado||''} ${o.estado_pago||''} ${o.medio_pago||''}`.toLowerCase().includes(q)&&(!st||String(o.estado||'')===st)&&(!pay||String(o.estado_pago||'')===pay)&&inDateRange(o.fecha||o.creado_en||o.created_at,from,to))}
function renderOrders(){const rows=filteredOrders();$('#whOrders').innerHTML=`<table><thead><tr><th>Pedido</th><th>Fecha</th><th>Estado</th><th>Pago</th><th>Medio</th><th>Total</th><th>Acciones</th></tr></thead><tbody>${rows.map(o=>`<tr><td><strong>${esc(o.numero_pedido||o.id)}</strong></td><td>${esc(fmtDate(o.fecha||o.creado_en||Date.now()))}</td><td><span class="status-pill">${esc(o.estado||'')}</span></td><td><span class="status-pill">${esc(o.estado_pago||'')}</span></td><td>${esc(o.medio_pago||'')}</td><td><strong>${money(o.total)}</strong></td><td><div class="order-actions"><button data-order-view="${esc(o.id)}">Consultar</button><button data-order-pdf="${esc(o.id)}">PDF</button><button data-order-trace="${esc(o.id)}">Trazabilidad</button></div></td></tr>`).join('')}</tbody></table>`+(rows.length?'':'<div class="empty-state">No hay pedidos que coincidan con los filtros.</div>')}
async function getOrderAccess(id){return await AleAPI.post('mayoristaorderaccess',{id},token)}
async function openOrderDetail(id,sourceBtn){$('#whOrderModal').classList.add('open');$('#whOrderModal').setAttribute('aria-hidden','false');$('#whOrderDetail').innerHTML='<div class="loading-block">Cargando detalle…</div>';try{const out=await getOrderAccess(id),o=out.order||{},items=out.items||[],history=out.history||[];$('#whOrderModalTitle').textContent=o.numero_pedido||o.id||'Detalle';$('#whOrderDetail').innerHTML=`<div class="order-detail-grid"><div><span>Estado</span><strong>${esc(o.estado||'-')}</strong></div><div><span>Pago</span><strong>${esc(o.estado_pago||'-')}</strong></div><div><span>Medio</span><strong>${esc(o.medio_pago||'-')}</strong></div><div><span>Total</span><strong>${money(o.total)}</strong></div><div><span>Fecha</span><strong>${esc(fmtDate(o.fecha||o.creado_en))}</strong></div><div><span>Entrega</span><strong>${esc(o.metodo_entrega||'-')}</strong></div></div><h3>Productos</h3><div class="order-detail-items">${items.map(x=>`<div><span>${esc(x.producto_nombre||'Producto')} ${x.tamano_nombre?`· ${esc(x.tamano_nombre)}`:''}</span><span>${Number(x.cantidad||1)} × ${money(x.precio_unitario)}</span><strong>${money(x.subtotal)}</strong></div>`).join('')||'<p>Sin detalle disponible.</p>'}</div><div class="order-detail-links">${out.pdf_url?`<a href="${esc(out.pdf_url)}" target="_blank" rel="noopener"><i class="bi bi-file-earmark-pdf"></i> Descargar PDF</a>`:''}<button type="button" class="order-detail-action" onclick="openOrderTrace('${esc(o.id||id)}')"><i class="bi bi-diagram-3"></i> Ver trazabilidad</button></div><h3>Historial</h3><div class="timeline">${history.map(h=>`<div class="timeline-item"><i></i><div><strong>${esc(h.evento||'Actualización')}</strong><span>${esc(h.descripcion||`${h.estado_pedido||''} ${h.estado_pago||''}`)}</span><small>${esc(fmtDate(h.creado_en))}</small></div></div>`).join('')||'<p>Sin movimientos registrados.</p>'}</div>`}catch(err){console.warn(err);$('#whOrderDetail').innerHTML='<div class="empty-state">No fue posible cargar el pedido.</div>'}finally{if(sourceBtn)setBusy(sourceBtn,false)}}

window.openOrderTrace=async function(id,sourceBtn){
  $('#whOrderModal').classList.add('open');
  $('#whOrderModal').setAttribute('aria-hidden','false');
  $('#whOrderDetail').innerHTML='<div class="loading-block">Cargando trazabilidad…</div>';
  try{
    const out=await getOrderAccess(id),o=out.order||{},history=out.history||[];
    $('#whOrderModalTitle').textContent=`Trazabilidad · ${o.numero_pedido||o.id||''}`;
    $('#whOrderDetail').innerHTML=`
      <div class="trace-summary">
        <div><span>Estado actual</span><strong>${esc(o.estado||'-')}</strong></div>
        <div><span>Estado de pago</span><strong>${esc(o.estado_pago||'-')}</strong></div>
        <div><span>Última actualización</span><strong>${esc(fmtDate(o.actualizado_en||o.fecha||o.creado_en))}</strong></div>
      </div>
      <div class="trace-toolbar">
        <button type="button" class="order-detail-action secondary" onclick="openOrderDetail('${esc(o.id||id)}')"><i class="bi bi-arrow-left"></i> Volver al detalle</button>
        ${out.pdf_url?`<a href="${esc(out.pdf_url)}" target="_blank" rel="noopener"><i class="bi bi-file-earmark-pdf"></i> PDF</a>`:''}
      </div>
      <div class="trace-panel">
        <div class="trace-title"><span>Línea de tiempo</span><strong>${history.length} movimiento${history.length===1?'':'s'}</strong></div>
        <div class="timeline trace-timeline">${history.map((h,i)=>`<div class="timeline-item ${i===0?'latest':''}"><i></i><div><strong>${esc(h.evento||'Actualización')}</strong><span>${esc(h.descripcion||[h.estado_pedido,h.estado_pago].filter(Boolean).join(' · ')||'Movimiento del pedido')}</span><small>${esc(fmtDate(h.creado_en))}</small></div></div>`).join('')||'<div class="empty-state">Aún no hay movimientos registrados para este pedido.</div>'}</div>
      </div>`;
  }catch(err){
    console.warn(err);
    $('#whOrderDetail').innerHTML='<div class="empty-state">No fue posible cargar la trazabilidad del pedido.</div>';
  }finally{if(sourceBtn)setBusy(sourceBtn,false)}
}
function closeOrderModal(){$('#whOrderModal').classList.remove('open');$('#whOrderModal').setAttribute('aria-hidden','true')}
$('#whOrderClose').onclick=closeOrderModal;$('#whOrderModal').onclick=e=>{if(e.target===$('#whOrderModal'))closeOrderModal()};$('#whOrders').onclick=async e=>{const v=e.target.closest('[data-order-view]'),pdf=e.target.closest('[data-order-pdf]'),tr=e.target.closest('[data-order-trace]');const btn=v||pdf||tr;if(!btn)return;setBusy(btn,true,'');try{const id=btn.dataset.orderView||btn.dataset.orderPdf||btn.dataset.orderTrace;if(v){await openOrderDetail(id,btn);return}if(tr){await openOrderTrace(id,btn);return}const out=await getOrderAccess(id),url=out.pdf_url;if(url)window.open(url,'_blank','noopener');else toast('PDF aún no disponible')}catch(err){console.warn(err);toast('No fue posible abrir el pedido')}finally{if(pdf)setBusy(btn,false)}};

function whCredit(){return state.credit&&typeof state.credit==='object'?state.credit:null}
function whCreditDueDate(c=whCredit()){return c?.fecha_vencimiento?String(c.fecha_vencimiento).slice(0,10):''}
function whCreditOverdue(c=whCredit()){const due=whCreditDueDate(c);if(!due)return false;const d=new Date(`${due}T23:59:59`);return !Number.isNaN(d.getTime())&&d.getTime()<Date.now()}
function whCreditActive(c=whCredit()){return !!c&&c.activo!==false&&!['NO','FALSE','0','INACTIVO'].includes(String(c.activo??'SI').toUpperCase())&&Number(c.limite_credito||0)>0}
function whCreditCanUse(total=0){const c=whCredit();return whCreditActive(c)&&!whCreditOverdue(c)&&Number(c.saldo_disponible||0)>0&&Number(c.saldo_disponible||0)>=Number(total||0)}
function openWhView(name){const btn=$(`.portal-nav button[data-view="${name}"]`);if(btn){$$('.portal-nav button').forEach(x=>x.classList.toggle('active',x===btn));$$('.portal-view').forEach(v=>v.classList.toggle('active',v.id===`wh-view-${name}`))}}
function renderCredit(){
  const c=whCredit(),available=Number(c?.saldo_disponible||0),used=Number(c?.saldo_utilizado||0),limit=Number(c?.limite_credito||0),due=whCreditDueDate(c);
  $('#whCreditHeaderAmount').textContent=money(available);
  $('#whCreditHeader').classList.toggle('credit-disabled',!whCreditActive(c));
  $('#whCreditHeader').classList.toggle('credit-overdue',whCreditOverdue(c));
  const assigned=c?.fecha_asignacion?String(c.fecha_asignacion).slice(0,10):'';$('#whCreditLimit').textContent=money(limit);$('#whCreditAvailable').textContent=money(available);$('#whCreditUsed').textContent=money(used);$('#whCreditAssigned').textContent=assigned?fmtDay(`${assigned}T12:00:00`):'—';$('#whCreditDue').textContent=due?fmtDay(`${due}T12:00:00`):'—';
  const card=$('#whCreditStatusCard'),title=$('#whCreditStatusTitle'),text=$('#whCreditStatusText');card.classList.remove('ok','warning','danger');
  if(!c){title.textContent='Sin línea de crédito asignada';text.textContent='Administración debe asignar una línea para habilitar compras a crédito.';card.classList.add('warning')}
  else if(!whCreditActive(c)){title.textContent='Línea de crédito suspendida';text.textContent=`Límite registrado: ${money(limit)}. Contacta a administración para habilitarla.`;card.classList.add('warning')}
  else if(whCreditOverdue(c)){title.textContent='Línea de crédito vencida';text.textContent=used>0?`Tienes ${money(used)} pendiente. La fecha tope fue ${fmtDay(`${due}T12:00:00`)}. No podrás hacer nuevas compras a crédito hasta regularizar y renovar la fecha.`:`La línea venció el ${fmtDay(`${due}T12:00:00`)}. Administración debe renovar la fecha tope antes de volver a usarla.`;card.classList.add('danger')}
  else {title.textContent='Línea de crédito disponible';text.textContent=`Puedes utilizar hasta ${money(available)}. Crédito usado: ${money(used)}${due?` · Fecha tope de pago: ${fmtDay(`${due}T12:00:00`)}`:''}.`;card.classList.add('ok')}
  const moves=state.creditMovements||[];
  $('#whCreditMovements').innerHTML=`<table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Monto</th><th>Disponible</th><th>Utilizado</th><th>Referencia</th></tr></thead><tbody>${moves.map(m=>`<tr><td>${esc(fmtDate(m.creado_en))}</td><td><span class="status-pill">${esc(m.tipo||'')}</span></td><td>${money(m.monto)}</td><td>${money(m.saldo_disponible_resultante)}</td><td>${money(m.saldo_utilizado_resultante)}</td><td>${esc(m.referencia||m.detalle||'—')}</td></tr>`).join('')}</tbody></table>`+(moves.length?'':'<div class="empty-state">Aún no hay movimientos de crédito.</div>');
  renderCreditPaymentOption();
}
function renderCreditPaymentOption(){const opt=$('#whCreditPaymentOption'),note=$('#whCreditCheckoutNote'),txt=$('#whCreditCheckoutText');if(!opt||!note||!txt)return;const total=cart.reduce((a,x)=>a+Number(x.precio||0)*Number(x.cantidad||0),0),c=whCredit(),available=Number(c?.saldo_disponible||0),usable=whCreditCanUse(total);opt.hidden=!whCreditActive(c);opt.disabled=!usable;if(whCreditActive(c))opt.textContent=usable?`Crédito disponible · ${money(available)}`:`Crédito · saldo ${money(available)}`;if($('#whPayment').value==='CREDITO'&&!usable)$('#whPayment').value='TRANSFERENCIA';const selected=$('#whPayment').value==='CREDITO';note.classList.toggle('hidden',!selected);if(selected)txt.textContent=`Se descontarán ${money(total)} de tu saldo disponible. Quedarán ${money(Math.max(0,available-total))}. Fecha tope de pago: ${whCreditDueDate(c)?fmtDay(`${whCreditDueDate(c)}T12:00:00`):'por definir'}.`}
$('#whCreditHeader').onclick=()=>openWhView('credit');
$('#whPayment').addEventListener('change',renderCreditPaymentOption);

function renderDocuments(){$('#whDocuments').innerHTML=(state.documents||[]).map(d=>`<div class="doc-item"><div><small>${esc(d.tipo||'DOCUMENTO')}</small><strong>${esc(d.nombre||'Documento')}</strong><div>${esc(fmtDay(d.creado_en||Date.now()))}</div></div>${d.url?`<a href="${esc(d.url)}" target="_blank" rel="noopener"><i class="bi bi-download"></i> Abrir</a>`:'<span>Protegido</span>'}</div>`).join('')||'<p>Aún no hay documentos.</p>'}
function renderProfile(){const c=state.client||{},l=state.priceList||{},cr=whCredit();$('#whProfile').innerHTML=`<div><span>Razón social</span><strong>${esc(c.razon_social||c.nombre||'')}</strong></div><div><span>RUT</span><strong>${esc(c.rut||'')}</strong></div><div><span>Giro</span><strong>${esc(c.giro||'-')}</strong></div><div><span>Lista</span><strong>${esc(l.nombre||'-')}</strong></div><div><span>Correo</span><strong>${esc(c.email||'-')}</strong></div><div><span>Teléfono</span><strong>${esc(c.telefono||'-')}</strong></div><div><span>Límite de crédito</span><strong>${cr?money(cr.limite_credito):'Sin asignar'}</strong></div><div><span>Saldo disponible</span><strong>${cr?money(cr.saldo_disponible):'—'}</strong></div>`}
function notificationVisual(n){
  const text=`${n?.titulo||''} ${n?.mensaje||''}`.toLowerCase();
  if(text.includes('crédito')||text.includes('credito'))return{icon:'bi-wallet2',cls:'payment'};
  if(text.includes('pago'))return{icon:'bi-credit-card-2-front',cls:'payment'};
  if(text.includes('pedido'))return{icon:'bi-bag-check',cls:'order'};
  if(text.includes('document')||text.includes('factura')||text.includes('pdf'))return{icon:'bi-file-earmark-text',cls:'document'};
  if(text.includes('habilitado')||text.includes('aprobado')||text.includes('perfil'))return{icon:'bi-person-check',cls:'profile'};
  return{icon:'bi-bell',cls:'generic'};
}
function notificationItemHtml(n){
  const v=notificationVisual(n),isRead=!!n.leida;
  return `<button class="notification-item ${isRead?'':'unread'}" data-notification="${esc(n.id)}" data-entity="${esc(n.entidad_id||'')}" type="button">
    <span class="notification-icon ${v.cls}"><i class="bi ${v.icon}"></i></span>
    <span class="notification-copy">
      <strong>${esc(n.titulo||'Notificación')}</strong>
      <span class="notification-message">${esc(n.mensaje||'')}</span>
      <span class="notification-meta">
        <time>${esc(fmtDate(n.creado_en||Date.now()))}</time>
        <span class="notification-read-label ${isRead?'read':''}">${isRead?'Leída':'Marcar como leída'}</span>
      </span>
    </span>
    <span class="notification-dot ${isRead?'read':''}" aria-hidden="true"></span>
  </button>`;
}
function renderNotifications(){
  const rows=state.notifications||[],unread=rows.filter(n=>!n.leida);
  $('#whBellCount').textContent=unread.length;
  $('#whBellCount').classList.toggle('hidden',!unread.length);
  const html=rows.map(notificationItemHtml).join('')||'<div class="notification-empty"><i class="bi bi-bell-slash"></i><strong>Sin notificaciones</strong><span>No tienes actividad nueva por revisar.</span></div>';
  $('#whNotifications').innerHTML=html;
  $('#whBellList').innerHTML=html;
}
async function markNotification(id,entity=''){try{await AleAPI.post('mayoristanotificationread',{id},token);const n=(state.notifications||[]).find(x=>String(x.id)===String(id));if(n)n.leida=true;renderNotifications();if(String(entity||'').startsWith('CREDITO'))openWhView('credit');else if(entity)await openOrderDetail(entity)}catch(err){console.warn(err)}}
async function markAllNotifications(btn){await busy(btn,async()=>{try{await AleAPI.post('mayoristanotificationreadall',{},token);(state.notifications||[]).forEach(n=>n.leida=true);renderNotifications();toast('Notificaciones marcadas como leídas')}catch(err){console.warn(err);toast('No fue posible actualizar notificaciones')}},'')}
$('#whBell').onclick=e=>{e.stopPropagation();$('#whBellPanel').classList.toggle('hidden')};
$('#whCloseNotifications').onclick=e=>{e.stopPropagation();$('#whBellPanel').classList.add('hidden')};
document.addEventListener('click',e=>{if(!e.target.closest('.wh-notification-wrap'))$('#whBellPanel').classList.add('hidden')});
for(const hostId of ['#whNotifications','#whBellList'])$(hostId).onclick=e=>{const n=e.target.closest('[data-notification]');if(n)markNotification(n.dataset.notification,n.dataset.entity)};
$('#whMarkAll').onclick=e=>markAllNotifications(e.currentTarget);
$('#whProfileMarkAll').onclick=e=>markAllNotifications(e.currentTarget);

function renderCart(){const count=cart.reduce((a,x)=>a+x.cantidad,0),total=cart.reduce((a,x)=>a+x.precio*x.cantidad,0);$('#whCartCount').textContent=count;$('#whCartTotal').textContent=money(total);$('#whCartItems').innerHTML=cart.map(x=>`<div class="cart-line" data-key="${esc(x.key)}"><div><strong>${esc(x.nombre)}</strong><small>${esc(x.tamano_nombre)} · ${money(x.precio)}</small></div><div><input type="number" min="1" max="999" value="${x.cantidad}"><button data-remove><i class="bi bi-trash"></i></button></div></div>`).join('')||'<p>Tu carrito está vacío.</p>';renderCreditPaymentOption()}
$('#whCartItems').onchange=e=>{const line=e.target.closest('.cart-line');if(!line||e.target.tagName!=='INPUT')return;const x=cart.find(v=>v.key===line.dataset.key);if(x)x.cantidad=Math.max(1,Number(e.target.value)||1);renderCart()};$('#whCartItems').onclick=e=>{const line=e.target.closest('.cart-line');if(line&&e.target.closest('[data-remove]')){cart=cart.filter(v=>v.key!==line.dataset.key);renderCart()}};function openCart(){$('#whCart').classList.add('open');$('#whOverlay').classList.add('open')}function closeCart(){$('#whCart').classList.remove('open');$('#whOverlay').classList.remove('open')}$('#whCartBtn').onclick=openCart;$('#whCartClose').onclick=closeCart;$('#whOverlay').onclick=closeCart;

['#whSearch','#whCategory','#whCatalogFrom','#whCatalogTo'].forEach(id=>$(id).addEventListener(id.includes('Search')?'input':'change',renderProducts));['#whOrderSearch','#whOrderStatus','#whOrderPaymentStatus','#whOrderFrom','#whOrderTo'].forEach(id=>$(id).addEventListener(id.includes('Search')?'input':'change',renderOrders));
$('#whCatalogToday').onclick=()=>{const t=dateOnly(new Date());$('#whCatalogFrom').value=t;$('#whCatalogTo').value=t;renderProducts()};$('#whCatalogClear').onclick=()=>{$('#whSearch').value='';$('#whCategory').value='';$('#whCatalogFrom').value='';$('#whCatalogTo').value='';renderProducts()};$('#whOrdersToday').onclick=()=>{const t=dateOnly(new Date());$('#whOrderFrom').value=t;$('#whOrderTo').value=t;renderOrders()};$('#whOrdersClear').onclick=()=>{$('#whOrderSearch').value='';$('#whOrderStatus').value='';$('#whOrderPaymentStatus').value='';$('#whOrderFrom').value='';$('#whOrderTo').value='';renderOrders()};

$$('.portal-nav button').forEach(b=>b.onclick=()=>openWhView(b.dataset.view));
$('#whRefresh').onclick=e=>busy(e.currentTarget,bootstrap,'');
let logoutInProgress=false;
$('#whLogout').onclick=()=>{
  if(logoutInProgress)return;
  logoutInProgress=true;
  const btn=$('#whLogout'),oldToken=token;
  btn.disabled=true;
  btn.classList.add('is-logout-loading');
  btn.setAttribute('aria-busy','true');
  btn.setAttribute('title','Cerrando sesión…');
  btn.innerHTML='<span class="logout-spinner" aria-hidden="true"></span>';
  try{localStorage.removeItem('aleMayoristaToken')}catch(_){}
  token='';
  if(oldToken)Promise.resolve(AleAPI.post('logout',{},oldToken)).catch(()=>{});
  window.setTimeout(()=>{
    $('#whBellPanel')?.classList.add('hidden');
    showAuth();
    $('#whPassword').value='';
    btn.classList.remove('is-logout-loading');
    btn.removeAttribute('aria-busy');
    btn.disabled=false;
    btn.setAttribute('title','Salir');
    btn.innerHTML='<i class="bi bi-box-arrow-right"></i>';
    logoutInProgress=false;
  },220);
};

$('#whSubmitOrder').onclick=e=>busy(e.currentTarget,async()=>{
  if(!cart.length){toast('Agrega productos al pedido');return}
  const selectedPayment=$('#whPayment').value,total=cart.reduce((a,x)=>a+Number(x.precio||0)*Number(x.cantidad||0),0);
  if(selectedPayment==='CREDITO'&&!whCreditCanUse(total)){const c=whCredit();if(whCreditOverdue(c))toast('Tu línea de crédito está vencida. Regulariza el pago antes de volver a usarla.');else toast(`Saldo de crédito insuficiente. Disponible: ${money(c?.saldo_disponible||0)}`);return}
  let out=null;
  try{
    out=await AleAPI.post('mayoristacreateorder',{detalle:cart,medio_pago:$('#whPayment').value,metodo_entrega:$('#whDelivery').value,direccion:$('#whAddress').value,comuna:$('#whCommune').value,observaciones:$('#whNotes').value,despacho:0},token);
  }catch(err){
    console.warn('MAYORISTA_CREATE_ORDER',err,err?.payload||'');
    const code=String(err?.message||err||'').toUpperCase();
    if(code.includes('CREDITO_SALDO_INSUFICIENTE'))toast(`Saldo de crédito insuficiente. Disponible: ${money(whCredit()?.saldo_disponible||0)}`);
    else if(code.includes('CREDITO_VENCIDO'))toast('Tu línea de crédito está vencida. Regulariza el pago con administración.');
    else if(code.includes('CREDITO_NO_ASIGNADO')||code.includes('CREDITO_NO_DISPONIBLE'))toast('La línea de crédito no está disponible para esta cuenta.');
    else if(code.includes('STOCK_INSUFICIENTE'))toast('Stock insuficiente para uno de los productos o tamaños.');
    else if(code.includes('PRECIO_MAYORISTA_NO_AUTORIZADO')||code.includes('LISTA_PRECIO_NO_DISPONIBLE'))toast('La lista de precios mayorista cambió. Actualiza el portal e intenta nuevamente.');
    else if(code.includes('PRODUCTO_TAMANO_REQUERIDO'))toast('Uno de los tamaños ya no está disponible. Actualiza el pedido.');
    else {
      const raw=AleAPI?.errorText ? AleAPI.errorText(err?.message||err?.payload?.error||err) : String(err?.message||'ERROR_SERVIDOR');
      toast(`No fue posible crear el pedido: ${raw}`);
    }
    return;
  }

  // Desde aquí el pedido ya existe. Un error posterior de Transbank nunca debe
  // mostrarse como si la creación del pedido hubiese fallado.
  lastOrder=out;
  $('#whLastOrder').classList.remove('hidden');
  $('#whLastOrderNumber').textContent=`Pedido ${out.numero_pedido} creado · ${money(out.total)}`;
  $('#whTransferUpload').classList.toggle('hidden',out.medio_pago!=='TRANSFERENCIA');
  cart=[];renderCart();toast(out.medio_pago==='CREDITO'?'✓ Compra cargada a tu línea de crédito':'✓ Pedido Mayorista creado');

  if(out.medio_pago==='TRANSBANK'){
    try{
      const pay=await AleAPI.postPublic('transbankcreate',{order_id:out.id,checkout_token:out.checkout_token});
      const ws=pay?.token_ws||pay?.token;
      if(!pay?.url||!ws)throw new Error('TRANSBANK_RESPUESTA_CREATE_INVALIDA');
      const f=document.createElement('form');f.method='POST';f.action=pay.url;
      const i=document.createElement('input');i.type='hidden';i.name='token_ws';i.value=ws;f.appendChild(i);
      document.body.appendChild(f);f.submit();return;
    }catch(err){
      console.warn('MAYORISTA_TRANSBANK_CREATE',err,err?.payload||'');
      toast(`Pedido ${out.numero_pedido} creado, pero Transbank no pudo iniciarse. El pedido no se duplicará.`);
      await bootstrap();openCart();return;
    }
  }
  await bootstrap();openCart();
},'Creando…');
$('#whUploadProof').onclick=e=>busy(e.currentTarget,async()=>{const f=$('#whProofFile').files?.[0];if(!f||!lastOrder){toast('Selecciona el comprobante');return}try{await AleAPI.postPublic('uploadtransferproof',{order_id:lastOrder.id,tracking_token:lastOrder.tracking_token,data_url:await fileDataUrl(f)});toast('✓ Comprobante enviado');$('#whTransferUpload').classList.add('hidden');await bootstrap()}catch(err){console.warn(err);toast('No fue posible subir el comprobante')}},'Subiendo…');
$('#whUploadDocument').onclick=e=>busy(e.currentTarget,async()=>{const f=$('#whDocumentFile').files?.[0];if(!f){toast('Selecciona un archivo');return}try{await AleAPI.post('mayoristadocumentupload',{tipo:$('#whDocumentType').value,nombre:$('#whDocumentName').value.trim()||f.name,data_url:await fileDataUrl(f)},token);toast('✓ Documento cargado');$('#whDocumentFile').value='';$('#whDocumentName').value='';await bootstrap()}catch(err){console.warn(err);toast('No fue posible subir el documento')}},'Subiendo…');
$('#whProfileFile').onchange=e=>{const f=e.target.files?.[0];if(f)$('#whProfilePhoto').src=URL.createObjectURL(f)};$('#whSaveProfilePhoto').onclick=e=>busy(e.currentTarget,async()=>{const f=$('#whProfileFile').files?.[0];if(!f){toast('Selecciona una imagen');return}if(f.size>5*1024*1024){toast('La imagen supera 5 MB');return}try{const out=await AleAPI.post('mayoristaprofilephoto',{data_url:await fileDataUrl(f)},token);state.user={...(state.user||{}),...(out.user||{}),profile_url:out.profile_url||out.user?.profile_url};$('#whHeaderAvatar').src=state.user.profile_url||'favicon.png';$('#whProfilePhoto').src=state.user.profile_url||'favicon.png';$('#whProfileFile').value='';toast('✓ Foto de perfil actualizada')}catch(err){console.warn(err);toast('No fue posible guardar la foto')}},'Guardando…');

document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#whProductModal').classList.contains('open'))closeWhProduct();if($('#whOrderModal').classList.contains('open'))closeOrderModal()}});
bootstrap();
