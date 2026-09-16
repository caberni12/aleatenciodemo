const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money=n=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(n||0));
const normalizeText=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-CL").trim();
function toNumber(value){
  if(typeof value==="number") return Number.isFinite(value)?value:0;
  const raw=String(value??"").trim();
  if(!raw)return 0;
  const clean=raw.replace(/[^0-9,.-]/g,"");
  if(!clean)return 0;
  let normalized=clean;
  if(clean.includes(",")&&clean.includes(".")) normalized=clean.lastIndexOf(",")>clean.lastIndexOf(".")?clean.replace(/\./g,"").replace(",", "."):clean.replace(/,/g,"");
  else if(clean.includes(",")) normalized=clean.replace(/\./g,"").replace(",", ".");
  else if((clean.match(/\./g)||[]).length>1 || /\.\d{3}$/.test(clean)) normalized=clean.replace(/\./g,"");
  const n=Number(normalized);
  return Number.isFinite(n)?n:0;
}
let token=localStorage.getItem("aleAdminToken")||sessionStorage.getItem("aleAdminToken")||"", data={products:[],categories:[],banners:[],orders:[],requests:[],quotes:[],clients:[],users:[],config:{},currentUser:null};

// R9.15.1 · Sesión estable: una falla temporal de red nunca borra una sesión válida.
const sleepMs=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function sessionErrorCode(err){return String(err?.message||err||"").toUpperCase()}
function isDefinitiveSessionError(err){
  const code=sessionErrorCode(err);
  return ["SESION_INVALIDA","SESION_EXPIRADA","SESION_REQUERIDA","USUARIO_INACTIVO"].some(x=>code.includes(x));
}
function isTransientSessionError(err){
  const code=sessionErrorCode(err);
  return ["API_TIMEOUT","API_CONEXION_FALLIDA","RESPUESTA_API_INVALIDA","HTTP_500","HTTP_502","HTTP_503","HTTP_504","NETWORK","FETCH"].some(x=>code.includes(x));
}
function persistAdminToken(value){
  token=String(value||"");
  if(token){localStorage.setItem("aleAdminToken",token);sessionStorage.setItem("aleAdminToken",token)}
}
function clearAdminToken(){
  sessionStorage.removeItem("aleAdminToken");localStorage.removeItem("aleAdminToken");token="";data.currentUser=null;
}
async function validateStoredSession(attempts=3){
  let last=null;
  for(let i=0;i<attempts;i++){
    try{return await AleAPI.post("session",{},token)}catch(err){
      last=err;
      if(isDefinitiveSessionError(err))throw err;
      if(i<attempts-1)await sleepMs(550*(i+1));
    }
  }
  throw last||new Error("API_CONEXION_FALLIDA");
}


// R9.15.0 · Selección múltiple para eliminación masiva.
const bulkSelection={products:new Set(),requests:new Set(),quotes:new Set()};
function selectedSet(kind){return bulkSelection[kind]||new Set()}
function pruneSelection(kind,items){
  const valid=new Set((items||[]).map(x=>String(x.id)));
  const set=selectedSet(kind);for(const id of [...set])if(!valid.has(String(id)))set.delete(id);
}
function bulkCheckbox(kind,id){
  const checked=selectedSet(kind).has(String(id));
  return `<input class="bulk-check" type="checkbox" data-bulk-kind="${esc(kind)}" data-bulk-id="${esc(id)}" ${checked?"checked":""} aria-label="Seleccionar registro">`;
}
function bulkHeaderCheckbox(kind,visibleIds){
  const ids=(visibleIds||[]).map(String),set=selectedSet(kind);
  const all=ids.length>0&&ids.every(id=>set.has(id));
  return `<input class="bulk-check" type="checkbox" data-bulk-select-all="${esc(kind)}" ${all?"checked":""} aria-label="Seleccionar todos los registros visibles" title="Seleccionar todos los registros visibles">`;
}
function updateBulkBar(kind){
  const set=selectedSet(kind),count=set.size;
  const map={products:["#productsBulkBar","#productsSelectedCount","producto","productos"],requests:["#requestsBulkBar","#requestsSelectedCount","solicitud","solicitudes"],quotes:["#quotesBulkBar","#quotesSelectedCount","cotización","cotizaciones"]};
  const m=map[kind];if(!m)return;
  const bar=$(m[0]),label=$(m[1]);if(label)label.textContent=`${count} ${count===1?m[2]:m[3]} seleccionado${kind==="products"?(count===1?"":"s"):(count===1?"a":"as")}`;
  if(bar)bar.classList.toggle("hidden",count===0);
}
function syncSelectedRows(host){
  host?.querySelectorAll('input[data-bulk-id]').forEach(cb=>cb.closest('tr')?.classList.toggle('is-selected',cb.checked));
}
function handleBulkCheckboxChange(e){
  const cb=e.target.closest?.('input[data-bulk-id]');if(!cb)return false;
  const kind=cb.dataset.bulkKind,id=String(cb.dataset.bulkId||"");const set=selectedSet(kind);if(cb.checked)set.add(id);else set.delete(id);
  cb.closest('tr')?.classList.toggle('is-selected',cb.checked);updateBulkBar(kind);
  const host=cb.closest('.table-wrap');const head=host?.querySelector(`input[data-bulk-select-all="${CSS.escape(kind)}"]`);
  if(head){const rows=[...host.querySelectorAll(`input[data-bulk-kind="${CSS.escape(kind)}"]`)];head.checked=rows.length>0&&rows.every(x=>x.checked);head.indeterminate=rows.some(x=>x.checked)&&!head.checked}
  return true;
}
function handleBulkSelectAllChange(e,visibleIds){
  const cb=e.target.closest?.('input[data-bulk-select-all]');if(!cb)return false;
  const kind=cb.dataset.bulkSelectAll,set=selectedSet(kind);for(const id of visibleIds.map(String)){if(cb.checked)set.add(id);else set.delete(id)}
  return true;
}
function clearBulkSelection(kind){selectedSet(kind).clear();updateBulkBar(kind)}
async function deleteSelected(kind,btn){
  const ids=[...selectedSet(kind)];if(!ids.length)return;
  const names={products:"productos",requests:"solicitudes",quotes:"cotizaciones"};
  const extra=kind==="products"?" Los productos se eliminarán definitivamente de la base. Las imágenes locales de GitHub no se borran; las imágenes propias de Supabase Storage sí se limpian cuando corresponda.":kind==="requests"?" Las cotizaciones ya creadas se conservarán, pero quedarán sin solicitud asociada.":" Los PDF asociados guardados en Supabase Storage también se eliminarán cuando correspondan.";
  if(!confirm(`¿Eliminar definitivamente ${ids.length} ${names[kind]} seleccionados?${extra}\n\nEsta acción no se puede deshacer.`))return;
  await busy(btn,async()=>{
    try{
      const out=await AleAPI.post("bulkDeleteEntities",{kind,ids},token);
      const deleted=Number(out?.deleted||0),missing=Number(out?.missing||0);
      clearBulkSelection(kind);toast(`✓ ${deleted} registro${deleted===1?"":"s"} eliminado${deleted===1?"":"s"}${missing?` · ${missing} ya no existían`:""}`);await reload();
    }catch(err){console.warn(err);toast("✕ No fue posible completar la eliminación múltiple")}
  });
}


// Menú lateral R9.5: fijo, scroll independiente y hamburguesa siempre visible.
const adminSidebar=$("#adminSidebar"), sidebarBackdrop=$("#sidebarBackdrop"), menuToggle=$("#menuToggle"), sidebarClose=$("#sidebarClose"), sidebarRailToggle=$("#sidebarRailToggle");
const SIDEBAR_COLLAPSED_KEY="aleAtencioSidebarCollapsedR97";
const sidebarIsMobile=()=>window.matchMedia("(max-width: 1000px)").matches;
function setSidebarOpen(open){
  if(!adminSidebar)return;
  if(sidebarIsMobile()){
    const next=!!open;
    adminSidebar.classList.toggle("is-open",next);
    sidebarBackdrop?.classList.toggle("is-open",next);
    document.body.classList.toggle("menu-open",next);
    document.body.classList.toggle("sidebar-peek-open",next);
    document.body.classList.remove("sidebar-collapsed");
    menuToggle?.setAttribute("aria-expanded",String(next));
    if(menuToggle)menuToggle.setAttribute("aria-label",next?"Cerrar menú":"Abrir menú");
    return;
  }
  const next=!!open;
  document.body.classList.toggle("sidebar-collapsed",!next);
  adminSidebar.classList.remove("is-open");
  sidebarBackdrop?.classList.remove("is-open");
  document.body.classList.remove("menu-open");
  document.body.classList.remove("sidebar-peek-open");
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY,next?"0":"1");
  menuToggle?.setAttribute("aria-expanded",String(next));
  if(menuToggle)menuToggle.setAttribute("aria-label",next?"Ocultar menú":"Mostrar menú");
  sidebarRailToggle?.setAttribute("aria-expanded",String(next));
  if(sidebarRailToggle){
    sidebarRailToggle.setAttribute("aria-label",next?"Menú expandido":"Expandir menú");
    sidebarRailToggle.title=next?"Menú expandido":"Expandir menú";
  }
}
function restoreSidebarState(){
  if(sidebarIsMobile()) setSidebarOpen(false);
  else setSidebarOpen(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)==="0");
}
menuToggle?.addEventListener("click",()=>{
  if(sidebarIsMobile()) setSidebarOpen(!adminSidebar.classList.contains("is-open"));
  else setSidebarOpen(document.body.classList.contains("sidebar-collapsed"));
});
sidebarRailToggle?.addEventListener("click",()=>setSidebarOpen(true));
sidebarClose?.addEventListener("click",()=>setSidebarOpen(false));
sidebarBackdrop?.addEventListener("click",()=>setSidebarOpen(false));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&sidebarIsMobile())setSidebarOpen(false)});
window.addEventListener("resize",restoreSidebarState);
// Tooltips accesibles para el rail compacto de escritorio.
$$('.admin-nav button').forEach(btn=>{const label=btn.textContent.trim();if(label){btn.title=label;btn.setAttribute('aria-label',label)}});
$$('.sidebar-bottom .btn').forEach(btn=>{const label=btn.textContent.trim();if(label){btn.title=label;btn.setAttribute('aria-label',label)}});
restoreSidebarState();

function toast(msg){const t=$("#adminToast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}

// ========================= NOTIFICACIONES R9.2 =========================
const NOTIFY_STORE_KEY="aleAtencioAdminNotificationsV2";
const NOTIFY_CURSOR_KEY="aleAtencioAdminNotifyCursorV2";
const NOTIFY_VOICE_KEY="aleAtencioAdminVoiceV2";
let notifyTimer=null;
let notifyBusy=false;
let notifyVoice=localStorage.getItem(NOTIFY_VOICE_KEY)!=="0";
let notifications=[];
try{notifications=JSON.parse(localStorage.getItem(NOTIFY_STORE_KEY)||"[]");if(!Array.isArray(notifications))notifications=[]}catch(_){notifications=[]}

function persistNotifications(){
  notifications=notifications.slice(0,60);
  localStorage.setItem(NOTIFY_STORE_KEY,JSON.stringify(notifications));
}
function unreadCount(){return notifications.filter(n=>!n.read).length}
function renderNotificationCenter(){
  const badge=$("#notificationBadge"), list=$("#notificationList"), voiceBtn=$("#notificationVoiceToggle");
  if(badge){const n=unreadCount();badge.textContent=String(n);badge.classList.toggle("hidden",n===0)}
  if(voiceBtn){voiceBtn.innerHTML=`<i class="bi bi-${notifyVoice?"volume-up":"volume-mute"}"></i><span>${notifyVoice?"Voz activada":"Voz silenciada"}</span>`}
  if(!list)return;
  if(!notifications.length){list.innerHTML='<div class="notification-empty">No hay notificaciones nuevas.</div>';return}
  list.innerHTML=notifications.map(n=>`<button type="button" class="notification-item ${n.read?"":"unread"}" data-notification-key="${esc(n.key)}" data-notification-view="${esc(n.view)}"><span class="notification-icon ${n.kind}"><i class="bi bi-${n.kind==="order"?"bag-check":"clipboard-heart"}"></i></span><span class="notification-copy"><strong>${esc(n.title)}</strong><small>${esc(n.message)}</small><time>${esc(formatDate(n.at))}</time></span>${n.read?"":'<span class="notification-dot" aria-label="No leída"></span>'}</button>`).join("");
}
function setNotificationPanel(open){
  const panel=$("#notificationPanel"), bell=$("#notificationBell");
  if(!panel)return;
  panel.classList.toggle("hidden",!open);bell?.setAttribute("aria-expanded",String(open));
}
function speakNotification(text){
  if(!notifyVoice||!("speechSynthesis" in window))return;
  try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="es-CL";u.rate=.96;u.pitch=1;window.speechSynthesis.speak(u)}catch(_){ }
}
function showNotificationCard(n){
  const stack=$("#notificationToastStack");if(!stack)return;
  const card=document.createElement("button");card.type="button";card.className=`notification-toast-card ${n.kind}`;card.innerHTML=`<span class="notification-toast-icon"><i class="bi bi-${n.kind==="order"?"bag-check":"clipboard-heart"}"></i></span><span><small>${n.kind==="order"?"NUEVO PEDIDO":"NUEVA SOLICITUD"}</small><strong>${esc(n.message)}</strong></span><i class="bi bi-chevron-right"></i>`;
  card.addEventListener("click",()=>{markNotificationRead(n.key);openAdminView(n.view);card.remove()});
  stack.prepend(card);requestAnimationFrame(()=>card.classList.add("show"));
  setTimeout(()=>{card.classList.remove("show");setTimeout(()=>card.remove(),260)},9000);
}
function markNotificationRead(key){const n=notifications.find(x=>x.key===key);if(n)n.read=true;persistNotifications();renderNotificationCenter()}
function addIncomingNotification(kind,item){
  const key=`${kind}:${item.id}`;if(notifications.some(n=>n.key===key))return false;
  const isOrder=kind==="order";
  const name=String(item.nombre||"Cliente");
  const reqNumber=item.numero_solicitud||"";
  const n={key,kind,view:isOrder?"orders":"requests",id:item.id,at:item.fecha||new Date().toISOString(),read:false,title:isOrder?"Nuevo pedido":"Nueva solicitud",message:isOrder?`${name} · ${money(item.total||0)}`:`${reqNumber?reqNumber+" · ":""}${name} · ${item.tipo||"Solicitud web"}`};
  notifications.unshift(n);persistNotifications();renderNotificationCenter();showNotificationCard(n);speakNotification(isOrder?`Nuevo pedido recibido de ${name}`:`Nueva solicitud recibida de ${name}`);return true;
}
function mergeIncomingFeed(feed){
  let changed=false;
  for(const o of feed.orders||[]){if(!data.orders.some(x=>String(x.id)===String(o.id)))data.orders.unshift(o);changed=addIncomingNotification("order",o)||changed}
  for(const r of feed.requests||[]){if(!data.requests.some(x=>String(x.id)===String(r.id)))data.requests.unshift(r);changed=addIncomingNotification("request",r)||changed}
  if(changed){renderOrders();renderRequests();$("#kpiOrders").textContent=data.orders.filter(x=>String(x.estado).toUpperCase()==="PENDIENTE").length;$("#kpiRequests").textContent=data.requests.filter(x=>String(x.estado).toUpperCase()==="NUEVA").length}
}
async function pollNotifications(){
  if(!token||notifyBusy||document.body.classList.contains("login-open"))return;
  notifyBusy=true;
  try{
    let since=localStorage.getItem(NOTIFY_CURSOR_KEY)||"";
    if(!since){since=new Date().toISOString();localStorage.setItem(NOTIFY_CURSOR_KEY,since);return}
    const feed=await AleAPI.notificationFeed(since,token);
    mergeIncomingFeed(feed||{});
    if(feed?.serverTime)localStorage.setItem(NOTIFY_CURSOR_KEY,feed.serverTime);
  }catch(err){console.warn("notificationFeed",err)}finally{notifyBusy=false}
}
function startNotificationWatcher(){
  stopNotificationWatcher();renderNotificationCenter();
  if(!localStorage.getItem(NOTIFY_CURSOR_KEY))localStorage.setItem(NOTIFY_CURSOR_KEY,new Date().toISOString());
  notifyTimer=setInterval(pollNotifications,8000);setTimeout(pollNotifications,900);
}
function stopNotificationWatcher(){if(notifyTimer){clearInterval(notifyTimer);notifyTimer=null}}

$("#notificationBell")?.addEventListener("click",e=>{e.stopPropagation();setNotificationPanel($("#notificationPanel").classList.contains("hidden"))});
$("#closeNotifications")?.addEventListener("click",()=>setNotificationPanel(false));
$("#markAllNotifications")?.addEventListener("click",()=>{notifications.forEach(n=>n.read=true);persistNotifications();renderNotificationCenter()});
$("#notificationVoiceToggle")?.addEventListener("click",()=>{notifyVoice=!notifyVoice;localStorage.setItem(NOTIFY_VOICE_KEY,notifyVoice?"1":"0");renderNotificationCenter();toast(notifyVoice?"Voz de alertas activada":"Voz de alertas silenciada")});
$("#notificationList")?.addEventListener("click",e=>{const b=e.target.closest("[data-notification-key]");if(!b)return;markNotificationRead(b.dataset.notificationKey);setNotificationPanel(false);openAdminView(b.dataset.notificationView)});
document.addEventListener("click",e=>{if(!e.target.closest(".notification-wrap"))setNotificationPanel(false)});
renderNotificationCenter();
function showLogin(msg=""){
  stopNotificationWatcher();
  document.body.classList.add("auth-locked");
  document.body.classList.remove("auth-active","sidebar-peek-open");
  const shell=$("#adminShell"),login=$("#loginScreen");
  if(shell){shell.classList.add("hidden");shell.setAttribute("aria-hidden","true");try{shell.inert=true}catch(_){}}
  if(login){login.classList.remove("hidden");login.setAttribute("aria-hidden","false")}
  adminSidebar?.classList.remove("is-open");
  sidebarBackdrop?.classList.remove("is-open");
  menuToggle?.setAttribute("aria-expanded","false");
  sidebarRailToggle?.setAttribute("aria-expanded","false");
  if($("#apiWarning"))$("#apiWarning").textContent=msg;
}
function showAdmin(){
  if(!token)return showLogin("Ingresa para acceder al cPanel.");
  const shell=$("#adminShell"),login=$("#loginScreen");
  document.body.classList.remove("auth-locked");
  document.body.classList.add("auth-active");
  if(login){login.classList.add("hidden");login.setAttribute("aria-hidden","true")}
  if(shell){shell.classList.remove("hidden");shell.setAttribute("aria-hidden","false");try{shell.inert=false}catch(_){}}
}
function beginBusy(btn){if(!btn)return;btn.dataset.busy="1";btn.classList.add("is-loading");btn.disabled=true}
function endBusy(btn){if(!btn)return;delete btn.dataset.busy;btn.classList.remove("is-loading");btn.disabled=false}
async function busy(btn,fn){beginBusy(btn);try{return await fn()}finally{endBusy(btn)}}
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||b.disabled)return;b.classList.add("is-loading");setTimeout(()=>{if(!b.dataset.busy)b.classList.remove("is-loading")},360)},true);
function resetFilePicker(target){
  const input=typeof target==="string"?$(target):target;
  if(!input)return;
  input.value="";
  const field=input.closest?.(".file-field");
  if(!field)return;
  field.classList.remove("has-file");
  const name=field.querySelector(".file-name");
  if(name)name.textContent="Sin archivo seleccionado";
  const text=field.querySelector(".file-picker-text");
  if(text){
    const kind=field.dataset.filePicker||"image";
    text.textContent=kind==="xlsx"?"Seleccionar XLSX":input.id==="sLogo"?"Seleccionar logo":"Seleccionar imagen";
  }
}
function syncFilePicker(input){
  if(!input)return;
  const field=input.closest?.(".file-field");
  if(!field)return;
  const file=input.files?.[0]||null;
  field.classList.toggle("has-file",!!file);
  const name=field.querySelector(".file-name");
  if(name)name.textContent=file?.name||"Sin archivo seleccionado";
  const text=field.querySelector(".file-picker-text");
  if(text){
    const kind=field.dataset.filePicker||"image";
    text.textContent=file?(kind==="xlsx"?"Cambiar XLSX":input.id==="sLogo"?"Cambiar logo":"Cambiar imagen"):(kind==="xlsx"?"Seleccionar XLSX":input.id==="sLogo"?"Seleccionar logo":"Seleccionar imagen");
  }
}
document.addEventListener("change",e=>{const input=e.target.closest?.('input[type="file"]');if(input)syncFilePicker(input)});

async function login(username,password){
  const r=await AleAPI.login(username||"admin",password);
  persistAdminToken(r.token);
  localStorage.setItem("aleAdminUser",String(username||"admin"));
  if(r.user) data.currentUser=r.user;
  if(r.permissions) data.permissions=r.permissions;

  // R9 Supabase: entrar al cPanel inmediatamente después de validar credenciales.
  // La carga pesada del dashboard ocurre después y ya no bloquea el login.
  showAdmin();
  renderSessionHeader(r.user);
  reload().then(()=>startNotificationWatcher()).catch(err=>{console.warn("adminBootstrap",err);toast("No fue posible actualizar todos los datos. Reintenta.")});
  return r;
}
function normalizePanelData(src={}){
  return {
    ...data,
    ...src,
    products:Array.isArray(src.products)?src.products:(Array.isArray(data.products)?data.products:[]),
    categories:Array.isArray(src.categories)?src.categories:(Array.isArray(data.categories)?data.categories:[]),
    banners:Array.isArray(src.banners)?src.banners:(Array.isArray(data.banners)?data.banners:[]),
    orders:Array.isArray(src.orders)?src.orders:(Array.isArray(data.orders)?data.orders:[]),
    requests:Array.isArray(src.requests)?src.requests:(Array.isArray(data.requests)?data.requests:[]),
    quotes:Array.isArray(src.quotes)?src.quotes:(Array.isArray(data.quotes)?data.quotes:[]),
    clients:Array.isArray(src.clients)?src.clients:(Array.isArray(data.clients)?data.clients:[]),
    users:Array.isArray(src.users)?src.users:(Array.isArray(data.users)?data.users:[]),
    config:(src.config&&typeof src.config==="object")?src.config:(data.config||{}),
    currentUser:src.currentUser||data.currentUser||null
  };
}
const ADMIN_DATA_MODULES=["orders","requests","quotes","clients","users"];
let adminModulesRetryTimer=null;
async function loadAdminModules({notify=true,retry=true}={}){
  const results=await Promise.allSettled(ADMIN_DATA_MODULES.map(module=>AleAPI.adminModule(module,token)));
  const failed=[];
  results.forEach((res,i)=>{
    const module=ADMIN_DATA_MODULES[i];
    if(res.status==="fulfilled") data=normalizePanelData(res.value||{});
    else{failed.push(module);console.warn(`adminModule:${module}`,res.reason)}
  });
  renderAll();
  if(adminModulesRetryTimer){clearTimeout(adminModulesRetryTimer);adminModulesRetryTimer=null}
  if(failed.length){
    if(notify)toast(`Datos principales cargados. Pendiente${failed.length===1?"":"s"}: ${failed.join(", ")}. Reintentando…`);
    if(retry)adminModulesRetryTimer=setTimeout(()=>loadAdminModules({notify:false,retry:false}).catch(e=>console.warn("adminModules retry",e)),3000);
  }
  return{ok:failed.length===0,failed};
}
async function reload(){
  // R9.15.2: catálogo + núcleo administrativo primero; módulos pesados después.
  // Un módulo lento o con error ya no invalida toda la carga del cPanel.
  let publicLoaded=false,coreLoaded=false;
  try{
    const pub=await AleAPI.publicBootstrap();
    data=normalizePanelData(pub);
    renderAll();
    publicLoaded=true;
  }catch(err){console.warn("publicBootstrap",err)}

  try{
    const core=await AleAPI.adminBootstrap(token,{mode:"core"});
    data=normalizePanelData(core);
    renderAll();
    coreLoaded=true;
    if(core?.partial&&Array.isArray(core.warnings)&&core.warnings.length)console.warn("adminBootstrap core warnings",core.warnings);
  }catch(err){
    console.warn("adminBootstrap core",err);
    if(!publicLoaded)throw err;
  }

  // No bloquear login ni mostrar desconexión por pedidos/cotizaciones/clientes/usuarios.
  loadAdminModules({notify:true,retry:true}).catch(err=>console.warn("loadAdminModules",err));
  return{ok:publicLoaded||coreLoaded,coreLoaded,publicLoaded};
}
function renderSessionHeader(user){
  const me=user||data.currentUser||{};
  if($("#currentUserAvatar")) $("#currentUserAvatar").src=me.profile_url||"logo-ale-icon-card.png";
  if($("#currentUserName")) $("#currentUserName").textContent=me.nombre||me.usuario||"Usuario";
  if($("#currentUserRole")) $("#currentUserRole").textContent=String(me.rol||"EDITOR").toUpperCase()==="ADMIN"?"Administrador":"Editor";
}

const rememberedAdminUser=localStorage.getItem("aleAdminUser");
if(rememberedAdminUser && $("#adminUsername")) $("#adminUsername").value=rememberedAdminUser;

$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); const btn=e.submitter||e.currentTarget.querySelector('button[type="submit"]');
  if(!AleAPI.configured())return showLogin("Configura la URL de Supabase Edge Function en config.js.");
  await busy(btn,async()=>{
    try{
      await login($("#adminUsername").value.trim()||"admin",$("#adminPassword").value);
    }catch(err){
      console.warn(err);
      const code=String(err&&err.message||"");
      if(code.includes("LOGIN_BLOQUEADO")) return showLogin("Demasiados intentos fallidos. Espera unos minutos e intenta nuevamente.");
      if(code.includes("CREDENCIALES")||code.includes("USUARIO_O_CLAVE")) return showLogin("Usuario o contraseña incorrectos.");
      if(code.includes("BACKEND_AUTH_NO_ACTUALIZADO")) return showLogin("El backend de Supabase no corresponde a la API esperada. Revisa index.ts y vuelve a desplegar la Edge Function.");
            if(code.includes("TIMEOUT")) return showLogin("Supabase no respondió a tiempo. Verifica que dynamic-processor esté desplegada y activa.");
      if(code.includes("SESION")) return showLogin("La sesión no es válida. Ingresa nuevamente.");
      showLogin("No fue posible iniciar sesión ("+(code||"SIN_RESPUESTA")+").");
    }
  });
});
$("#logoutBtn").addEventListener("click",async()=>{const oldToken=token;stopNotificationWatcher();clearAdminToken();showLogin();if(oldToken){try{await AleAPI.post("logout",{},oldToken)}catch(_){}}});

function renderAll(){
  data=normalizePanelData(data);
  $("#adminLogo").src=(data.config&&data.config.logo_url)||"logo-ale-atencio.png";
  const me=data.currentUser||{};
  $("#currentUserAvatar").src=me.profile_url||"logo-ale-icon-card.png";
  $("#currentUserName").textContent=me.nombre||me.usuario||"Usuario";
  $("#currentUserRole").textContent=String(me.rol||"EDITOR").toUpperCase()==="ADMIN"?"Administrador":"Editor";
  const isAdmin=String(me.rol||"").toUpperCase()==="ADMIN";
  $("#usersNavBtn").classList.toggle("hidden-role",!isAdmin);
  $("#kpiProducts").textContent=data.products.length;
  $("#kpiOrders").textContent=data.orders.filter(x=>String(x.estado).toUpperCase()==="PENDIENTE").length;
  $("#kpiRequests").textContent=data.requests.filter(x=>String(x.estado).toUpperCase()==="NUEVA").length;
  $("#kpiStock").textContent=data.products.reduce((s,p)=>s+Number(p.stock||0),0);
  $("#dashboardSummary").innerHTML=`<div class="summary-row"><span>Productos destacados</span><strong>${data.products.filter(p=>String(p.destacado).toUpperCase()==="SI").length}</strong></div><div class="summary-row"><span>Categorías activas</span><strong>${data.categories.length}</strong></div><div class="summary-row"><span>Banners activos</span><strong>${data.banners.length}</strong></div><div class="summary-row"><span>Total pedidos</span><strong>${data.orders.length}</strong></div><div class="summary-row"><span>Cotizaciones</span><strong>${data.quotes.length}</strong></div>`;
  fillCategorySelects();renderProducts();renderCategories();renderBanners();renderOrders();renderRequests();renderQuotes();renderClients();renderReports();renderUsers();renderSettings();
}
function fillCategorySelects(){
  const opts=data.categories.map(c=>`<option value="${esc(c.nombre)}">${esc(c.nombre)}</option>`).join("");
  const currentFilter=$("#productFilter")?.value||"";
  $("#pCategory").innerHTML=opts;
  $("#productFilter").innerHTML='<option value="">Todas las categorías</option>'+opts;
  if([...$("#productFilter").options].some(o=>o.value===currentFilter))$("#productFilter").value=currentFilter;
  fillQuoteProductPicker();
}
function table(headers,rows){return `<table class="admin-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}">Sin registros</td></tr>`}</tbody></table>`}
const CPANEL_MEDIA_VERSION="20260916-r9152-admin-resilient";
function resolveMediaUrl(value){
  const u=String(value||"").trim();
  if(!u||/^(?:https?:|data:|blob:)/i.test(u))return u;
  return `${u}${u.includes("?")?"&":"?"}v=${CPANEL_MEDIA_VERSION}`;
}
function imageSourceInfo(value){
  const u=String(value||"").trim();
  if(!u)return{label:"Sin imagen publicada",kind:"none",file:""};
  if(/^https?:/i.test(u)){
    const isSupabase=/\.supabase\.co\/storage\/v1\/object\/public\//i.test(u)||/\/storage\/v1\/object\/public\//i.test(u);
    let file=u.split("?")[0].split("/").pop()||"imagen";
    try{file=decodeURIComponent(file)}catch(_){}
    return{label:isSupabase?"Supabase Storage":"Servidor externo",kind:isSupabase?"supabase":"remote",file};
  }
  return{label:"GitHub / archivo local",kind:"local",file:u.split("?")[0].split("/").pop()||u};
}
function renderProductImageSource(value,{pending=false}={}){
  const el=$("#pCurrentImageName");if(!el)return;
  if(pending){el.innerHTML=`<span class="image-source-copy">Nueva imagen seleccionada</span><span class="image-source-badge supabase"><i class="bi bi-cloud-arrow-up"></i> Se subirá a Supabase Storage al guardar</span>`;return}
  const info=imageSourceInfo(value);
  if(info.kind==="none"){el.textContent=info.label;return}
  const icon=info.kind==="local"?"github":info.kind==="supabase"?"cloud-check":"globe2";
  el.innerHTML=`<span class="image-source-copy">Imagen actual: ${esc(info.file)}</span><span class="image-source-badge ${esc(info.kind)}"><i class="bi bi-${icon}"></i> ${esc(info.label)}</span>`;
}
function imgTag(url){const src=resolveMediaUrl(url);return src?`<img class="thumb" src="${esc(src)}" alt="">`:'<div class="thumb"></div>'}

function renderProducts(){
  const q=normalizeText($("#productSearch").value), f=$("#productFilter").value, status=$("#productStatusFilter")?.value||"";
  pruneSelection("products",data.products);
  const list=data.products.filter(p=>{
    const active=String(p.activo??"SI").toUpperCase()==="NO"?"NO":"SI";
    return normalizeText([p.nombre,p.descripcion,p.categoria_nombre,p.ocasion].filter(Boolean).join(" ")).includes(q)&&(!f||p.categoria_nombre===f)&&(!status||active===status);
  });
  const meta=$("#productResultsMeta");
  if(meta)meta.textContent=`Mostrando ${list.length} de ${data.products.length} productos${f?` · Categoría: ${f}`:""}${status?` · Estado: ${status==="SI"?"Activos":"Inactivos"}`:""}${q?` · Búsqueda: “${$("#productSearch").value.trim()}”`:""}`;
  const canDelete=!!data.permissions?.products?.delete;if(!canDelete)selectedSet("products").clear();
  const visibleIds=list.map(p=>String(p.id));
  const headers=canDelete?[`<span class="bulk-select-col">${bulkHeaderCheckbox("products",visibleIds)}</span>`,"Imagen","Producto","Categoría","Precio editable","Stock","Estado","Destacado","Acciones"]:["Imagen","Producto","Categoría","Precio editable","Stock","Estado","Destacado","Acciones"];
  const rows=list.map(p=>{const active=String(p.activo??"SI").toUpperCase()!=="NO";const selected=selectedSet("products").has(String(p.id));return `<tr class="${active?"":"product-row-inactive"} ${selected?"is-selected":""}">${canDelete?`<td class="bulk-select-col">${bulkCheckbox("products",p.id)}</td>`:""}<td>${imgTag(p.image_url)}</td><td><strong>${esc(p.nombre)}</strong><br><small>${esc(p.descripcion||"")}</small></td><td>${esc(p.categoria_nombre||"")}</td><td><div class="quick-price"><span>$</span><input id="price-${esc(p.id)}" type="number" min="0" step="1" value="${toNumber(p.precio)}"><button type="button" data-save-price="${esc(p.id)}">Guardar</button></div></td><td>${toNumber(p.stock)}</td><td><span class="product-state-badge ${active?"is-active":"is-inactive"}"><span class="product-state-dot" aria-hidden="true"></span>${active?"Activo":"Inactivo"}</span></td><td>${String(p.destacado).toUpperCase()==="SI"?"Sí":"No"}</td><td><div class="row-actions"><button type="button" data-edit-product="${esc(p.id)}">Editar</button>${canDelete?`<button type="button" class="danger" data-delete-product="${esc(p.id)}">Eliminar</button>`:""}</div></td></tr>`}).join("");
  $("#productsTable").innerHTML=table(headers,rows);updateBulkBar("products");syncSelectedRows($("#productsTable"));
}
let productPreviewObjectUrl="";
function revokeProductPreviewObjectUrl(){
  if(productPreviewObjectUrl){
    try{URL.revokeObjectURL(productPreviewObjectUrl)}catch(_){}
    productPreviewObjectUrl="";
  }
}
function productEditorSnapshot(imageOverride=""){
  return {
    id:$("#pId")?.value||"",
    nombre:$("#pName")?.value.trim()||"Producto sin nombre",
    descripcion:$("#pDescription")?.value.trim()||"Agrega una descripción para mostrarla en la tienda.",
    precio:toNumber($("#pPrice")?.value),
    categoria_nombre:$("#pCategory")?.value||"Categoría",
    stock:toNumber($("#pStock")?.value),
    activo:$("#pActive")?.value||"SI",
    ocasion:$("#pOccasion")?.value.trim()||"",
    destacado:$("#pFeatured")?.checked?"SI":"NO",
    image_url:imageOverride||$("#pImageUrl")?.value||"",
    orden:toNumber($("#pOrder")?.value)
  };
}
function productPreviewMediaUrl(value){return resolveMediaUrl(value)}
function productPreviewFallback(p){
  return ({Tortas:"🍰",Galletas:"🍪","Dulcería":"🍫",Postres:"🧁",Regalos:"🎁"})[p.categoria_nombre]||"🍰";
}
function renderProductWebPreview(productOverride=null){
  const box=$("#productWebPreview");
  if(!box)return;
  const p=productOverride||productEditorSnapshot(productPreviewObjectUrl);
  const active=String(p.activo??"SI").toUpperCase()!=="NO";
  const priced=Number(p.precio||0)>0;
  const src=productPreviewMediaUrl(p.image_url);
  box.classList.toggle("is-inactive",!active);
  const media=src?`<img src="${esc(src)}" alt="${esc(p.nombre)}">`:`<span>${productPreviewFallback(p)}</span>`;
  const badge=String(p.destacado).toUpperCase()==="SI"?'<span class="product-preview-badge">Destacado</span>':"";
  box.innerHTML=`<div class="product-preview-media">${media}${badge}<span class="product-preview-status">${active?"Activo":"Inactivo"}</span></div><div class="product-preview-body"><small>${esc(p.categoria_nombre||"Categoría")}</small><h4>${esc(p.nombre||"Producto sin nombre")}</h4><p>${esc(p.descripcion||"Agrega una descripción para mostrarla en la tienda.")}</p><div class="product-preview-bottom"><span class="product-preview-price">${priced?money(p.precio):"Consultar"}</span><button type="button" class="product-preview-action" ${active?"":"disabled"}>${active?(priced?"Agregar":"Consultar"):"No disponible"}</button></div></div>`;
  const idLabel=$("#productEditorIdLabel");
  if(idLabel)idLabel.textContent=p.id?`ID ${p.id} · conectado al catálogo Web`:"Producto nuevo · se generará un ID al guardar";
}
function openProductEditor(id=""){
  const editor=$("#productEditor");
  revokeProductPreviewObjectUrl();
  resetFilePicker("#pImage");
  if(id){
    const p=data.products.find(x=>String(x.id)===String(id));
    if(!p){toast("Producto no encontrado");return}
    $("#pId").value=p.id||"";
    $("#pImageId").value=p.drive_file_id||"";
    $("#pImageUrl").value=p.image_url||"";
    $("#pOrder").value=toNumber(p.orden);
    $("#pName").value=p.nombre||"";
    $("#pPrice").value=toNumber(p.precio);
    $("#pCategory").value=p.categoria_nombre||"";
    $("#pStock").value=toNumber(p.stock);
    $("#pActive").value=String(p.activo??"SI").toUpperCase()==="NO"?"NO":"SI";
    updateProductStatusHint();
    $("#pOccasion").value=p.ocasion||"";
    $("#pDescription").value=p.descripcion||"";
    $("#pFeatured").checked=String(p.destacado).toUpperCase()==="SI";
    renderProductImageSource(p.image_url||"");
    renderProductWebPreview({...p,image_url:p.image_url||""});
  }else{
    clearProduct();
    const nextOrder=Math.max(0,...data.products.map(p=>toNumber(p.orden)))+1;
    $("#pOrder").value=nextOrder;
    renderProductWebPreview();
  }
  editor.classList.remove("hidden");
  document.body.classList.add("product-editor-open");
  requestAnimationFrame(()=>{editor.scrollTop=0;$("#pName")?.focus({preventScroll:true})});
}
function closeProductEditor(){
  revokeProductPreviewObjectUrl();
  $("#productEditor").classList.add("hidden");
  document.body.classList.remove("product-editor-open");
}
window.editProduct=id=>openProductEditor(id);
window.saveQuickPrice=async(id,btn)=>busy(btn,async()=>{const input=$("#price-"+CSS.escape(String(id)));if(!input)return;const precio=toNumber(input.value);if(!Number.isFinite(precio)||precio<0){toast("Precio no válido");return}try{await AleAPI.savePriceVerified({id,precio},token);const p=data.products.find(x=>String(x.id)===String(id));if(p)p.precio=precio;input.value=precio;toast("✓ Precio actualizado")}catch(e){console.warn(e);toast("✕ No se confirmó el cambio de precio")}});
$("#productsTable").addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit-product]"); if(edit){openProductEditor(edit.dataset.editProduct);return}
  const save=e.target.closest("[data-save-price]"); if(save){window.saveQuickPrice(save.dataset.savePrice,save);return}
  const del=e.target.closest("[data-delete-product]"); if(del){window.removeEntity("product",del.dataset.deleteProduct,del);return}
});
$("#productsTable").addEventListener("change",e=>{
  if(handleBulkCheckboxChange(e))return;
  const all=e.target.closest('input[data-bulk-select-all="products"]');if(all){const ids=data.products.filter(p=>{const q=normalizeText($("#productSearch").value),f=$("#productFilter").value,status=$("#productStatusFilter")?.value||"",active=String(p.activo??"SI").toUpperCase()==="NO"?"NO":"SI";return normalizeText([p.nombre,p.descripcion,p.categoria_nombre,p.ocasion].filter(Boolean).join(" ")).includes(q)&&(!f||p.categoria_nombre===f)&&(!status||active===status)}).map(p=>String(p.id));handleBulkSelectAllChange(e,ids);renderProducts()}
});
$("#deleteSelectedProducts")?.addEventListener("click",e=>deleteSelected("products",e.currentTarget));
["pName","pPrice","pCategory","pStock","pActive","pOccasion","pDescription","pFeatured"].forEach(id=>{
  const el=$("#"+id); if(!el)return;
  const eventName=(id==="pFeatured"||id==="pActive"||id==="pCategory")?"change":"input";
  el.addEventListener(eventName,()=>{if(id==="pActive")updateProductStatusHint();renderProductWebPreview()});
});
$("#pImage")?.addEventListener("change",()=>{
  revokeProductPreviewObjectUrl();
  const file=$("#pImage")?.files?.[0];
  if(file){productPreviewObjectUrl=URL.createObjectURL(file);renderProductImageSource("",{pending:true})}
  else renderProductImageSource($("#pImageUrl")?.value||"");
  renderProductWebPreview(productEditorSnapshot(productPreviewObjectUrl));
});
$("#productSearch").addEventListener("input",renderProducts);$("#productFilter").addEventListener("change",renderProducts);$("#productStatusFilter")?.addEventListener("change",renderProducts);
$("#clearProductFilter")?.addEventListener("click",()=>{$("#productSearch").value="";$("#productFilter").value="";if($("#productStatusFilter"))$("#productStatusFilter").value="";renderProducts()});
$("#newProduct").addEventListener("click",()=>openProductEditor());
function updateProductStatusHint(){const select=$("#pActive"),hint=$("#pActiveHint");if(!select||!hint)return;const active=select.value!=="NO";hint.textContent=active?"Activo: el producto se muestra y puede comprarse en la Web.":"Inactivo: el producto se oculta y no puede comprarse en la Web.";hint.classList.toggle("is-inactive",!active)}
$("#pActive")?.addEventListener("change",updateProductStatusHint);
function clearProduct(){revokeProductPreviewObjectUrl();["pId","pImageId","pImageUrl","pOrder","pName","pPrice","pStock","pOccasion","pDescription"].forEach(id=>$("#"+id).value="");$("#pFeatured").checked=false;if($("#pActive"))$("#pActive").value="SI";updateProductStatusHint();resetFilePicker("#pImage");renderProductImageSource("");renderProductWebPreview()}
$("#closeProductEditorX")?.addEventListener("click",closeProductEditor);
$("#saveProduct").addEventListener("click",e=>busy(e.currentTarget,async()=>{try{let imageId=$("#pImageId").value,imageUrl=$("#pImageUrl").value;const file=$("#pImage").files[0];if(file){const u=await upload(file,"PRODUCTOS");imageId=u.fileId;imageUrl=u.imageUrl||imageUrl}const payload={id:$("#pId").value,nombre:$("#pName").value.trim(),descripcion:$("#pDescription").value.trim(),precio:toNumber($("#pPrice").value),categoria_nombre:$("#pCategory").value,stock:toNumber($("#pStock").value),drive_file_id:imageId,image_url:imageUrl,destacado:$("#pFeatured").checked?"SI":"NO",activo:$("#pActive")?.value||"SI",ocasion:$("#pOccasion").value.trim(),orden:toNumber($("#pOrder").value)};if(!payload.nombre){toast("El nombre es obligatorio");return}await AleAPI.saveProductVerified(payload,token);toast(file?"✓ Producto actualizado · imagen guardada en Supabase":"✓ Producto actualizado");closeProductEditor();await reload()}catch(err){console.warn(err);toast("✕ No se confirmó la actualización")}}));

function renderCategories(){$("#categoriesTable").innerHTML=table(["Imagen","Categoría","Descripción","Orden","Acciones"],data.categories.map(c=>`<tr><td>${imgTag(c.image_url)}</td><td><strong>${esc(c.nombre)}</strong></td><td>${esc(c.descripcion||"")}</td><td>${Number(c.orden||0)}</td><td><div class="row-actions"><button onclick="editCategory('${c.id}')">Editar</button><button class="danger" onclick="removeEntity('category','${c.id}',this)">Eliminar</button></div></td></tr>`).join(""))}
$("#newCategory").addEventListener("click",()=>{clearCategory();$("#categoryEditor").classList.remove("hidden")});
function clearCategory(){["cId","cImageId","cImageUrl","cName","cOrder","cDescription"].forEach(id=>$("#"+id).value="");resetFilePicker("#cImage")}
window.editCategory=id=>{const c=data.categories.find(x=>x.id===id);if(!c)return;resetFilePicker("#cImage");$("#cId").value=c.id;$("#cImageId").value=c.drive_file_id||"";$("#cImageUrl").value=c.image_url||"";$("#cName").value=c.nombre||"";$("#cOrder").value=c.orden||0;$("#cDescription").value=c.descripcion||"";$("#categoryEditor").classList.remove("hidden")};
$("#saveCategory").addEventListener("click",e=>busy(e.currentTarget,async()=>{try{let imageId=$("#cImageId").value,imageUrl=$("#cImageUrl").value;const file=$("#cImage").files[0];if(file){const u=await upload(file,"CATEGORIAS");imageId=u.fileId;imageUrl=u.imageUrl||imageUrl}await AleAPI.post("saveCategory",{id:$("#cId").value,nombre:$("#cName").value.trim(),descripcion:$("#cDescription").value.trim(),drive_file_id:imageId,image_url:imageUrl,orden:Number($("#cOrder").value||0),activo:"SI"},token);toast("Categoría guardada");$("#categoryEditor").classList.add("hidden");await reload()}catch(err){console.warn(err);toast("No fue posible guardar")}}));

function renderBanners(){$("#bannersTable").innerHTML=table(["Imagen","Título","Botón","Orden","Acciones"],data.banners.map(b=>`<tr><td>${imgTag(b.image_url)}</td><td><strong>${esc(b.titulo)}</strong><br><small>${esc(b.subtitulo||"")}</small></td><td>${esc(b.cta_texto||"")}</td><td>${Number(b.orden||0)}</td><td><div class="row-actions"><button onclick="editBanner('${b.id}')">Editar</button><button class="danger" onclick="removeEntity('banner','${b.id}',this)">Eliminar</button></div></td></tr>`).join(""))}
$("#newBanner").addEventListener("click",()=>{clearBanner();$("#bannerEditor").classList.remove("hidden")});
function clearBanner(){["bId","bImageId","bImageUrl","bTitle","bSubtitle","bCta","bLink","bOrder"].forEach(id=>$("#"+id).value="");resetFilePicker("#bImage")}
window.editBanner=id=>{const b=data.banners.find(x=>x.id===id);if(!b)return;resetFilePicker("#bImage");$("#bId").value=b.id;$("#bImageId").value=b.drive_file_id||"";$("#bImageUrl").value=b.image_url||"";$("#bTitle").value=b.titulo||"";$("#bSubtitle").value=b.subtitulo||"";$("#bCta").value=b.cta_texto||"";$("#bLink").value=b.enlace||"";$("#bOrder").value=b.orden||0;$("#bannerEditor").classList.remove("hidden")};
$("#saveBanner").addEventListener("click",e=>busy(e.currentTarget,async()=>{try{let imageId=$("#bImageId").value,imageUrl=$("#bImageUrl").value;const file=$("#bImage").files[0];if(file){const u=await upload(file,"BANNERS");imageId=u.fileId;imageUrl=u.imageUrl||imageUrl}await AleAPI.post("saveBanner",{id:$("#bId").value,titulo:$("#bTitle").value.trim(),subtitulo:$("#bSubtitle").value.trim(),cta_texto:$("#bCta").value.trim(),enlace:$("#bLink").value.trim(),drive_file_id:imageId,image_url:imageUrl,activo:"SI",orden:Number($("#bOrder").value||0)},token);toast("Banner guardado");$("#bannerEditor").classList.add("hidden");await reload()}catch(err){console.warn(err);toast("No fue posible guardar")}}));

function renderOrders(){$("#ordersTable").innerHTML=table(["Fecha","Cliente","Contacto","Entrega","Total","Estado"],data.orders.map(o=>`<tr><td>${esc(formatDate(o.fecha))}</td><td><strong>${esc(o.nombre)}</strong><br><small>${esc(o.id)}</small></td><td>${esc(o.telefono)}<br><small>${esc(o.email||"")}</small></td><td>${esc(o.metodo_entrega||"")}<br><small>${esc(o.direccion||"")}</small></td><td>${money(o.total)}</td><td><select class="status-select" onchange="changeStatus('order','${o.id}',this.value)">${["PENDIENTE","CONFIRMADO","EN PREPARACION","LISTO","ENTREGADO","CANCELADO"].map(s=>`<option ${String(o.estado).toUpperCase()===s?"selected":""}>${s}</option>`).join("")}</select></td></tr>`).join(""))}
function renderRequests(){
  pruneSelection("requests",data.requests);
  const canDelete=!!data.permissions?.requests?.delete;if(!canDelete)selectedSet("requests").clear();
  const visibleIds=data.requests.map(r=>String(r.id));
  const headers=canDelete?[`<span class="bulk-select-col">${bulkHeaderCheckbox("requests",visibleIds)}</span>`,"N.º solicitud","Fecha","Cliente","Tipo","Evento","Detalle","Estado","Acciones"]:["N.º solicitud","Fecha","Cliente","Tipo","Evento","Detalle","Estado","Acciones"];
  const rows=data.requests.map(r=>{const selected=selectedSet("requests").has(String(r.id));return `<tr class="${selected?"is-selected":""}">${canDelete?`<td class="bulk-select-col">${bulkCheckbox("requests",r.id)}</td>`:""}<td><strong>${esc(r.numero_solicitud||r.id)}</strong></td><td>${esc(formatDate(r.fecha))}</td><td><strong>${esc(r.nombre)}</strong><br><small>${esc(r.telefono)}</small></td><td>${esc(r.tipo||"")}</td><td>${esc(r.fecha_evento||"")}</td><td>${esc(r.detalle||"")}</td><td><select class="status-select" onchange="changeStatus('request','${r.id}',this.value)">${["NUEVA","CONTACTADA","COTIZADA","ACEPTADA","CERRADA"].map(st=>`<option ${String(r.estado).toUpperCase()===st?"selected":""}>${st}</option>`).join("")}</select></td><td><div class="row-actions"><button type="button" onclick="quoteFromRequest('${r.id}')"><i class="bi bi-receipt-cutoff"></i> Cotizar</button>${canDelete?`<button type="button" class="danger" onclick="deleteRequest('${r.id}',this)"><i class="bi bi-trash3"></i> Eliminar</button>`:""}</div></td></tr>`}).join("");
  $("#requestsTable").innerHTML=table(headers,rows);updateBulkBar("requests");syncSelectedRows($("#requestsTable"));
}
$("#requestsTable")?.addEventListener("change",e=>{
  if(handleBulkCheckboxChange(e))return;
  const all=e.target.closest('input[data-bulk-select-all="requests"]');if(all){handleBulkSelectAllChange(e,data.requests.map(r=>String(r.id)));renderRequests()}
});
$("#deleteSelectedRequests")?.addEventListener("click",e=>deleteSelected("requests",e.currentTarget));
window.deleteRequest=async(id,btn)=>{
  const r=data.requests.find(x=>String(x.id)===String(id));
  const label=r?.numero_solicitud||id;
  if(!confirm(`¿Eliminar definitivamente la solicitud ${label}?\n\nLas cotizaciones vinculadas se conservarán y quedarán sin solicitud asociada.`))return;
  await busy(btn,async()=>{
    try{
      const res=await AleAPI.post("deleteEntity",{kind:"request",id},token);
      if(!res?.deleted)throw new Error("SOLICITUD_NO_ELIMINADA");
      selectedSet("requests").delete(String(id));toast("✓ Solicitud eliminada");await reload();
    }catch(e){console.warn(e);toast("✕ No fue posible eliminar la solicitud")}
  });
};
window.removeEntity=async(kind,id,btn)=>{const label=kind==="product"?"producto":"registro";const extra=kind==="product"?"\n\nEl producto se eliminará definitivamente. Si su imagen fue subida a Supabase Storage, también se limpiará. Las imágenes locales de GitHub no se modifican.":"";if(!confirm(`¿Eliminar definitivamente este ${label}?${extra}`))return;await busy(btn,async()=>{try{const out=await AleAPI.post("deleteEntity",{kind,id},token);if(!out?.deleted)throw new Error("REGISTRO_NO_ELIMINADO");selectedSet(kind==="product"?"products":kind+"s").delete(String(id));toast("Registro eliminado");await reload()}catch(e){console.warn(e);toast("No fue posible eliminar")}})};
$$('[data-cancel]').forEach(b=>b.addEventListener("click",()=>{if(b.dataset.cancel==="productEditor")closeProductEditor();else if(b.dataset.cancel==="quoteEditor")closeQuoteEditor();else $("#"+b.dataset.cancel)?.classList.add("hidden")}));
// ========================= COTIZACIONES R9.5 =========================
let quoteDraftItems=[];

function fillQuoteProductPicker(){
  const picker=$("#quoteProductPicker"); if(!picker)return;
  const current=picker.value;
  picker.innerHTML='<option value="">Seleccionar producto del catálogo...</option>'+data.products
    .slice().sort((a,b)=>String(a.nombre||"").localeCompare(String(b.nombre||""),"es"))
    .map(p=>`<option value="${esc(p.id)}">${esc(p.nombre)} · ${money(p.precio)}</option>`).join("");
  if([...picker.options].some(o=>o.value===current))picker.value=current;
}
function newQuoteItem(item={}){
  return {
    key:(crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())),
    descripcion:String(item.descripcion||item.nombre||""),
    cantidad:Math.max(0,Number(item.cantidad||1)||1),
    precio_unitario:Math.max(0,toNumber(item.precio_unitario??item.precio??0))
  };
}
function quoteAmounts(){
  const subtotal=quoteDraftItems.reduce((sum,x)=>sum+(Number(x.cantidad||0)*Number(x.precio_unitario||0)),0);
  const pct=Math.max(0,Math.min(100,toNumber($("#qIva")?.value||19)));
  const iva=Math.round(subtotal*pct/100);
  const total=subtotal+iva;
  return {subtotal,iva,pct,total};
}
function updateQuoteTotals(){
  const a=quoteAmounts();
  if($("#qSubtotal"))$("#qSubtotal").textContent=money(a.subtotal);
  if($("#qIvaLabel"))$("#qIvaLabel").textContent=`IVA ${a.pct}%`;
  if($("#qIvaAmount"))$("#qIvaAmount").textContent=money(a.iva);
  if($("#qTotal"))$("#qTotal").textContent=money(a.total);
}
function renderQuoteItems(){
  const host=$("#quoteItems"); if(!host)return;
  if(!quoteDraftItems.length)quoteDraftItems=[newQuoteItem()];
  host.innerHTML=quoteDraftItems.map((x,i)=>`<div class="quote-item-row" data-quote-key="${esc(x.key)}">
    <input class="quote-desc" data-q-index="${i}" data-q-field="descripcion" value="${esc(x.descripcion)}" placeholder="Descripción">
    <input class="quote-qty" data-q-index="${i}" data-q-field="cantidad" type="number" min="0.01" step="0.01" value="${Number(x.cantidad||1)}">
    <input class="quote-price" data-q-index="${i}" data-q-field="precio_unitario" type="number" min="0" step="1" value="${Number(x.precio_unitario||0)}">
    <strong class="quote-line-total">${money(Number(x.cantidad||0)*Number(x.precio_unitario||0))}</strong>
    <button type="button" class="quote-remove" data-q-remove="${i}" aria-label="Quitar línea"><i class="bi bi-trash3"></i></button>
  </div>`).join("");
  updateQuoteTotals();
}
$("#quoteItems")?.addEventListener("input",e=>{
  const el=e.target.closest("[data-q-index]"); if(!el)return;
  const i=Number(el.dataset.qIndex), field=el.dataset.qField; if(!quoteDraftItems[i])return;
  quoteDraftItems[i][field]=field==="descripcion"?el.value:toNumber(el.value);
  const row=el.closest(".quote-item-row");
  const item=quoteDraftItems[i];
  row?.querySelector(".quote-line-total")?.replaceChildren(document.createTextNode(money(Number(item.cantidad||0)*Number(item.precio_unitario||0))));
  updateQuoteTotals();
});
$("#quoteItems")?.addEventListener("click",e=>{
  const b=e.target.closest("[data-q-remove]"); if(!b)return;
  quoteDraftItems.splice(Number(b.dataset.qRemove),1);renderQuoteItems();
});
$("#qIva")?.addEventListener("input",updateQuoteTotals);

// R9.8 · Combo filtrable para asociar una solicitud a la cotización.
let quoteRequestHighlight=-1;
function requestLabel(r){return `${r.numero_solicitud||r.id||"Solicitud"} · ${r.nombre||"Cliente"}${r.telefono?` · ${r.telefono}`:""}`}
function quoteRequestCandidates(term=""){
  const q=normalizeText(term);
  return (data.requests||[]).slice().sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0)).filter(r=>{
    if(!q)return true;
    return normalizeText([r.numero_solicitud,r.id,r.nombre,r.telefono,r.email,r.tipo,r.detalle].filter(Boolean).join(" ")).includes(q);
  }).slice(0,18);
}
function setQuoteRequestResultsOpen(open){
  const results=$("#qRequestResults"), input=$("#qRequestSearch");if(!results||!input)return;
  results.classList.toggle("hidden",!open);input.setAttribute("aria-expanded",String(open));
  $("#toggleQuoteRequest")?.querySelector("i")?.classList.toggle("bi-chevron-up",open);
  $("#toggleQuoteRequest")?.querySelector("i")?.classList.toggle("bi-chevron-down",!open);
  if(!open)quoteRequestHighlight=-1;
}
function renderQuoteRequestResults(term=""){
  const host=$("#qRequestResults");if(!host)return;
  const rows=quoteRequestCandidates(term);
  if(!rows.length){host.innerHTML='<div class="request-option-empty">No se encontraron solicitudes con ese criterio.</div>';setQuoteRequestResultsOpen(true);return}
  if(quoteRequestHighlight>=rows.length)quoteRequestHighlight=rows.length-1;
  host.innerHTML=rows.map((r,i)=>`<button type="button" class="request-option ${i===quoteRequestHighlight?"is-active":""}" role="option" aria-selected="${i===quoteRequestHighlight}" data-request-id="${esc(r.id)}"><strong>${esc(r.numero_solicitud||r.id||"")}</strong><span class="request-option-main"><b>${esc(r.nombre||"Cliente")}</b><small>${esc([r.telefono,r.email].filter(Boolean).join(" · ")||r.tipo||"")}</small></span><span class="request-option-state">${esc(r.estado||"NUEVA")}</span></button>`).join("");
  setQuoteRequestResultsOpen(true);
  host.querySelector('.request-option.is-active')?.scrollIntoView({block:'nearest'});
}
function linkRequestToQuote(r,{replaceLine=true}={}){
  if(!r)return;
  $("#qRequestId").value=r.id||"";
  $("#qRequestNumber").textContent=r.numero_solicitud||r.id||"";
  $("#qRequestSearch").value=requestLabel(r);
  $("#qRequestSearch").dataset.selectedRequestId=String(r.id||"");
  $("#qClient").value=r.nombre||"";
  $("#qPhone").value=r.telefono||"";
  $("#qPhone").readOnly=!!r.telefono;
  $("#qPhone").classList.toggle("linked-phone",!!r.telefono);
  $("#qPhone").title=r.telefono?"WhatsApp ligado automáticamente a la solicitud":"";
  $("#qEmail").value=r.email||"";
  const help=$("#qRequestHelp");if(help){help.textContent=`Asociada a ${r.numero_solicitud||r.id}. El WhatsApp se toma de esta solicitud.`;help.classList.add("is-linked")}
  if(replaceLine){
    const qtyRaw=String(r.cantidad||"").replace(",",".").match(/[0-9]+(?:\.[0-9]+)?/),qty=qtyRaw?Number(qtyRaw[0]):1;
    const desc=[r.tipo,r.detalle].filter(Boolean).join(" · ");
    quoteDraftItems=[newQuoteItem({descripcion:desc||"Servicio / producto solicitado",cantidad:qty||1,precio_unitario:0})];renderQuoteItems();
  }
  setQuoteRequestResultsOpen(false);
}
function unlinkRequestFromQuote(){
  $("#qRequestId").value="";$("#qRequestNumber").textContent="Sin solicitud asociada";$("#qRequestSearch").value="";delete $("#qRequestSearch").dataset.selectedRequestId;
  $("#qPhone").readOnly=false;$("#qPhone").classList.remove("linked-phone");$("#qPhone").title="";
  const help=$("#qRequestHelp");if(help){help.textContent="Busca por número, cliente, teléfono o correo. Puedes dejar la cotización sin solicitud asociada.";help.classList.remove("is-linked")}
  setQuoteRequestResultsOpen(false);
}
$("#qRequestSearch")?.addEventListener("focus",e=>{quoteRequestHighlight=-1;renderQuoteRequestResults(e.currentTarget.value.includes(" · ")?"":e.currentTarget.value)});
$("#qRequestSearch")?.addEventListener("input",e=>{
  const selectedId=e.currentTarget.dataset.selectedRequestId||"";
  if(selectedId){
    const selected=(data.requests||[]).find(r=>String(r.id)===String(selectedId));
    if(!selected||e.currentTarget.value!==requestLabel(selected)){
      delete e.currentTarget.dataset.selectedRequestId;$("#qRequestId").value="";$("#qRequestNumber").textContent="Sin solicitud asociada";
      $("#qPhone").readOnly=false;$("#qPhone").classList.remove("linked-phone");$("#qPhone").title="";
      const help=$("#qRequestHelp");if(help){help.textContent="Selecciona una solicitud de la lista para asociarla.";help.classList.remove("is-linked")}
    }
  }
  quoteRequestHighlight=-1;renderQuoteRequestResults(e.currentTarget.value)
});
$("#qRequestSearch")?.addEventListener("keydown",e=>{
  const host=$("#qRequestResults"),rows=quoteRequestCandidates(e.currentTarget.value.includes(" · ")?"":e.currentTarget.value);
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){
    e.preventDefault();if(host?.classList.contains("hidden"))renderQuoteRequestResults(e.currentTarget.value);
    quoteRequestHighlight=e.key==="ArrowDown"?Math.min(rows.length-1,quoteRequestHighlight+1):Math.max(0,quoteRequestHighlight<0?rows.length-1:quoteRequestHighlight-1);renderQuoteRequestResults(e.currentTarget.value);
  }else if(e.key==="Enter"&&quoteRequestHighlight>=0&&rows[quoteRequestHighlight]){e.preventDefault();linkRequestToQuote(rows[quoteRequestHighlight])}
  else if(e.key==="Escape"){setQuoteRequestResultsOpen(false)}
});
$("#qRequestResults")?.addEventListener("click",e=>{const b=e.target.closest("[data-request-id]");if(!b)return;const r=(data.requests||[]).find(x=>String(x.id)===String(b.dataset.requestId));if(r)linkRequestToQuote(r)});
$("#toggleQuoteRequest")?.addEventListener("click",()=>{const host=$("#qRequestResults");if(host?.classList.contains("hidden"))renderQuoteRequestResults("");else setQuoteRequestResultsOpen(false)});
$("#clearQuoteRequest")?.addEventListener("click",unlinkRequestFromQuote);
document.addEventListener("click",e=>{if(!e.target.closest("#requestCombobox"))setQuoteRequestResultsOpen(false)});

function resetQuoteEditor(){
  ["qId","qRequestId","qPdfUrl","qClient","qPhone","qEmail","qObservations"].forEach(id=>{const el=$("#"+id);if(el)el.value=""});
  if($("#qPhone")){ $("#qPhone").readOnly=false; $("#qPhone").classList.remove("linked-phone"); $("#qPhone").title=""; }
  $("#qNumber").textContent="Se asignará al guardar";
  $("#qRequestNumber").textContent="Sin solicitud asociada";
  if($("#qRequestSearch")){ $("#qRequestSearch").value=""; delete $("#qRequestSearch").dataset.selectedRequestId; }
  if($("#qRequestHelp")){$("#qRequestHelp").textContent="Busca por número, cliente, teléfono o correo. Puedes dejar la cotización sin solicitud asociada.";$("#qRequestHelp").classList.remove("is-linked")}
  setQuoteRequestResultsOpen(false);
  $("#qValidity").value=Number(data.config?.cotizacion_validez_dias||15)||15;
  $("#qIva").value=Number(data.config?.iva_porcentaje||19);
  $("#qStatus").value="BORRADOR";
  quoteDraftItems=[newQuoteItem()];
  renderQuoteItems();
}
function openQuoteEditor(quote=null,request=null){
  resetQuoteEditor();
  if(quote){
    $("#qId").value=quote.id||"";
    $("#qRequestId").value=quote.solicitud_id||"";
    $("#qPdfUrl").value=quote.pdf_url||"";
    $("#qNumber").textContent=quote.numero_cotizacion||quote.id||"";
    $("#qRequestNumber").textContent=quote.numero_solicitud||"Sin solicitud asociada";
    const linkedRequest=(data.requests||[]).find(r=>String(r.id)===String(quote.solicitud_id||""));
    if($("#qRequestSearch")){ $("#qRequestSearch").value=linkedRequest?requestLabel(linkedRequest):(quote.numero_solicitud||""); if(linkedRequest)$("#qRequestSearch").dataset.selectedRequestId=String(linkedRequest.id||""); }
    if(linkedRequest&&$("#qRequestHelp")){ $("#qRequestHelp").textContent=`Asociada a ${linkedRequest.numero_solicitud||linkedRequest.id}. El WhatsApp se toma de esta solicitud.`; $("#qRequestHelp").classList.add("is-linked") }
    $("#qClient").value=quote.cliente_nombre||"";
    $("#qPhone").value=quote.telefono||"";
    $("#qPhone").readOnly=!!linkedRequest?.telefono;$("#qPhone").classList.toggle("linked-phone",!!linkedRequest?.telefono);$("#qPhone").title=linkedRequest?.telefono?"WhatsApp ligado automáticamente a la solicitud":"";
    $("#qEmail").value=quote.email||"";
    $("#qValidity").value=quote.validez_dias||15;
    $("#qIva").value=quote.iva_porcentaje??19;
    $("#qStatus").value=quote.estado||"BORRADOR";
    $("#qObservations").value=quote.observaciones||"";
    quoteDraftItems=(Array.isArray(quote.items)?quote.items:[]).map(newQuoteItem);
  }else if(request){
    linkRequestToQuote(request,{replaceLine:true});
  }
  renderQuoteItems();
  $("#quoteEditor").classList.remove("hidden");
  document.body.classList.add("quote-editor-open");
  requestAnimationFrame(()=>{const target=(!quote&&!request)?$("#qRequestSearch"):$("#qClient");target?.focus({preventScroll:true})});
}
function closeQuoteEditor(){$("#quoteEditor")?.classList.add("hidden");document.body.classList.remove("quote-editor-open")}
window.quoteFromRequest=id=>{const r=data.requests.find(x=>String(x.id)===String(id));if(!r)return toast("Solicitud no encontrada");openAdminView("quotes");openQuoteEditor(null,r)};
window.editQuote=id=>{const q=data.quotes.find(x=>String(x.id)===String(id));if(!q)return toast("Cotización no encontrada");openQuoteEditor(q,null)};

function quotePayload(){
  return {
    id:$("#qId").value,
    solicitud_id:$("#qRequestId").value,
    numero_solicitud:$("#qRequestNumber").textContent.includes("Sin solicitud")?"":$("#qRequestNumber").textContent.trim(),
    cliente_nombre:$("#qClient").value.trim(),
    telefono:$("#qPhone").value.trim(),
    email:$("#qEmail").value.trim(),
    validez_dias:toNumber($("#qValidity").value)||15,
    iva_porcentaje:toNumber($("#qIva").value),
    estado:$("#qStatus").value,
    observaciones:$("#qObservations").value.trim(),
    items:quoteDraftItems.map(x=>({descripcion:String(x.descripcion||"").trim(),cantidad:Number(x.cantidad||0),precio_unitario:Number(x.precio_unitario||0)}))
      .filter(x=>x.descripcion&&x.cantidad>0)
  };
}
async function persistQuote(){
  const payload=quotePayload();
  if(!payload.cliente_nombre)throw new Error("CLIENTE_REQUERIDO");
  if(!payload.items.length)throw new Error("COTIZACION_SIN_ITEMS");
  const out=await AleAPI.post("savequote",payload,token);
  const q=out.quote;
  if(!q)throw new Error("COTIZACION_NO_CONFIRMADA");
  const ix=data.quotes.findIndex(x=>String(x.id)===String(q.id));
  if(ix>=0)data.quotes[ix]=q;else data.quotes.unshift(q);
  $("#qId").value=q.id||"";$("#qPdfUrl").value=q.pdf_url||"";
  $("#qNumber").textContent=q.numero_cotizacion||q.id||"";
  if(q.numero_solicitud)$("#qRequestNumber").textContent=q.numero_solicitud;
  renderQuotes();
  return q;
}

function renderQuotes(){
  const host=$("#quotesTable");if(!host)return;
  pruneSelection("quotes",data.quotes);
  const canDelete=!!data.permissions?.quotes?.delete;if(!canDelete)selectedSet("quotes").clear();
  const visibleIds=data.quotes.map(q=>String(q.id));
  const headers=canDelete?[`<span class="bulk-select-col">${bulkHeaderCheckbox("quotes",visibleIds)}</span>`,"N.º cotización","Solicitud","Fecha","Cliente","Neto","IVA","Total","Estado","PDF","Acciones"]:["N.º cotización","Solicitud","Fecha","Cliente","Neto","IVA","Total","Estado","PDF","Acciones"];
  const rows=data.quotes.map(q=>{const selected=selectedSet("quotes").has(String(q.id));return `<tr class="${selected?"is-selected":""}">
    ${canDelete?`<td class="bulk-select-col">${bulkCheckbox("quotes",q.id)}</td>`:""}
    <td><strong>${esc(q.numero_cotizacion||q.id)}</strong></td>
    <td>${esc(q.numero_solicitud||"-")}</td>
    <td>${esc(formatDate(q.fecha||q.creado_en))}</td>
    <td><strong>${esc(q.cliente_nombre||"")}</strong><br><small>${esc(q.telefono||"")}</small></td>
    <td>${money(q.subtotal)}</td>
    <td>${money(q.iva)}<br><small>${esc(q.iva_porcentaje||19)}%</small></td>
    <td><strong>${money(q.total)}</strong></td>
    <td><select class="status-select" onchange="changeQuoteStatus('${q.id}',this.value)">${["BORRADOR","ENVIADA","ACEPTADA","RECHAZADA","VENCIDA","ANULADA"].map(st=>`<option ${String(q.estado).toUpperCase()===st?"selected":""}>${st}</option>`).join("")}</select></td>
    <td>${q.pdf_url?`<a class="pdf-link" href="${esc(q.pdf_url)}" target="_blank" rel="noopener"><i class="bi bi-file-earmark-pdf"></i> PDF</a>`:"Pendiente"}</td>
    <td><div class="row-actions"><button type="button" onclick="editQuote('${q.id}')">Editar</button><button type="button" onclick="generateQuoteFromList('${q.id}',this)"><i class="bi bi-file-earmark-pdf"></i></button><button type="button" onclick="sendQuoteFromList('${q.id}',this)"><i class="bi bi-whatsapp"></i></button>${canDelete?`<button type="button" class="danger" onclick="deleteQuote('${q.id}',this)" title="Eliminar cotización"><i class="bi bi-trash3"></i></button>`:""}</div></td>
  </tr>`}).join("");
  host.innerHTML=table(headers,rows);updateBulkBar("quotes");syncSelectedRows(host);
}
$("#quotesTable")?.addEventListener("change",e=>{
  if(handleBulkCheckboxChange(e))return;
  const all=e.target.closest('input[data-bulk-select-all="quotes"]');if(all){handleBulkSelectAllChange(e,data.quotes.map(q=>String(q.id)));renderQuotes()}
});
$("#deleteSelectedQuotes")?.addEventListener("click",e=>deleteSelected("quotes",e.currentTarget));
window.deleteQuote=async(id,btn)=>{
  const q=data.quotes.find(x=>String(x.id)===String(id));
  const label=q?.numero_cotizacion||id;
  if(!confirm(`¿Eliminar definitivamente la cotización ${label}?\n\nSi tiene PDF almacenado en Supabase, también será eliminado.`))return;
  await busy(btn,async()=>{try{const out=await AleAPI.post("deleteEntity",{kind:"quote",id},token);if(!out?.deleted)throw new Error("COTIZACION_NO_ELIMINADA");selectedSet("quotes").delete(String(id));toast("✓ Cotización eliminada");await reload()}catch(e){console.warn(e);toast("✕ No fue posible eliminar la cotización")}});
};
window.changeQuoteStatus=async(id,status)=>{try{const out=await AleAPI.post("updatequotestatus",{id,status},token);const ix=data.quotes.findIndex(x=>String(x.id)===String(id));if(ix>=0&&out.quote)data.quotes[ix]=out.quote;toast("Estado de cotización actualizado");renderQuotes()}catch(e){console.warn(e);toast("No fue posible actualizar el estado")}};

function addCatalogProductToQuote(){
  const id=$("#quoteProductPicker").value;if(!id)return toast("Selecciona un producto");
  const p=data.products.find(x=>String(x.id)===String(id));if(!p)return;
  quoteDraftItems.push(newQuoteItem({descripcion:p.nombre,cantidad:1,precio_unitario:p.precio}));renderQuoteItems();
}
$("#addQuoteProduct")?.addEventListener("click",addCatalogProductToQuote);
$("#addQuoteLine")?.addEventListener("click",()=>{quoteDraftItems.push(newQuoteItem());renderQuoteItems()});
$("#newQuote")?.addEventListener("click",()=>openQuoteEditor());
$("#closeQuoteEditorX")?.addEventListener("click",closeQuoteEditor);
$("#saveQuote")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const q=await persistQuote();toast(`Cotización ${q.numero_cotizacion||""} guardada`)}catch(err){console.warn(err);toast("No fue posible guardar la cotización")}}));

function phoneForWhatsapp(raw){
  let d=String(raw||"").replace(/\D/g,"");
  if(d.length===9&&d.startsWith("9"))d="56"+d;
  if(d.length===8)d="56"+d;
  return d;
}
async function imageUrlToDataUrl(url){
  const candidates=[url,"logo-ale-atencio.png"].filter(Boolean);
  for(const src of candidates){
    try{
      const r=await fetch(src,{cache:"no-store"});if(!r.ok)continue;
      const b=await r.blob();
      const data=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(b)});
      if(data)return String(data);
    }catch(_){ }
  }
  return "";
}
function pdfImageType(dataUrl){return /^data:image\/jpe?g/i.test(dataUrl)?"JPEG":"PNG"}
async function buildQuotePdfData(quote){
  const JsPDF=window.jspdf?.jsPDF;if(!JsPDF)throw new Error("LIBRERIA_PDF_NO_DISPONIBLE");
  const doc=new JsPDF({unit:"mm",format:"a4",orientation:"portrait"});
  const pageW=210, pageH=297, left=18, right=192;
  const company=data.config?.empresa||"Ale Atencio";
  const logo=await imageUrlToDataUrl(data.config?.logo_url||"logo-ale-atencio.png");
  if(logo){try{doc.addImage(logo,pdfImageType(logo),left,12,48,24,undefined,"FAST")}catch(_){}}
  doc.setTextColor(68,47,39);doc.setFont("helvetica","bold");doc.setFontSize(18);doc.text(company,right,18,{align:"right"});
  doc.setFont("helvetica","normal");doc.setFontSize(9);
  const companyLines=[data.config?.direccion,data.config?.email,data.config?.whatsapp?`WhatsApp: ${data.config.whatsapp}`:""].filter(Boolean);
  companyLines.forEach((t,i)=>doc.text(String(t),right,24+i*4.5,{align:"right"}));
  doc.setDrawColor(220,204,197);doc.line(left,40,right,40);
  doc.setFont("helvetica","bold");doc.setFontSize(20);doc.text("COTIZACIÓN",left,52);
  doc.setFontSize(11);doc.text(String(quote.numero_cotizacion||quote.id||""),right,50,{align:"right"});
  doc.setFont("helvetica","normal");doc.setFontSize(9);
  doc.text(`Fecha: ${new Date(quote.fecha||quote.creado_en||Date.now()).toLocaleDateString("es-CL")}`,right,56,{align:"right"});
  doc.text(`Validez: ${quote.validez_dias||15} días`,right,61,{align:"right"});
  let y=68;
  doc.setFont("helvetica","bold");doc.text("Cliente",left,y);doc.setFont("helvetica","normal");
  doc.text(String(quote.cliente_nombre||""),left,y+5);
  if(quote.telefono)doc.text(`Teléfono: ${quote.telefono}`,left,y+10);
  if(quote.email)doc.text(`Correo: ${quote.email}`,left,y+15);
  if(quote.numero_solicitud){doc.setFont("helvetica","bold");doc.text(`Solicitud: ${quote.numero_solicitud}`,right,y,{align:"right"});doc.setFont("helvetica","normal")}
  y+=25;
  const col={desc:left,qty:125,price:145,total:right};
  const drawHeader=()=>{doc.setFillColor(248,241,238);doc.rect(left,y,right-left,9,"F");doc.setFont("helvetica","bold");doc.text("Descripción",col.desc+2,y+6);doc.text("Cant.",col.qty,y+6,{align:"right"});doc.text("P. unitario",col.price+20,y+6,{align:"right"});doc.text("Total",col.total,y+6,{align:"right"});doc.setFont("helvetica","normal");y+=12};
  drawHeader();
  for(const item of quote.items||[]){
    const lines=doc.splitTextToSize(String(item.descripcion||""),78);const h=Math.max(7,lines.length*4.5+2);
    if(y+h>245){doc.addPage();y=18;drawHeader()}
    doc.text(lines,col.desc+2,y+4);doc.text(String(item.cantidad??""),col.qty,y+4,{align:"right"});doc.text(money(item.precio_unitario).replace("CLP","$").trim(),col.price+20,y+4,{align:"right"});doc.text(money(item.total??(Number(item.cantidad||0)*Number(item.precio_unitario||0))).replace("CLP","$").trim(),col.total,y+4,{align:"right"});
    doc.setDrawColor(235,225,220);doc.line(left,y+h,right,y+h);y+=h+2;
  }
  if(y>230){doc.addPage();y=22}
  y+=5;doc.setFont("helvetica","normal");doc.text("Subtotal neto",160,y,{align:"right"});doc.setFont("helvetica","bold");doc.text(money(quote.subtotal).replace("CLP","$").trim(),right,y,{align:"right"});
  y+=7;doc.setFont("helvetica","normal");doc.text(`IVA ${quote.iva_porcentaje??19}%`,160,y,{align:"right"});doc.setFont("helvetica","bold");doc.text(money(quote.iva).replace("CLP","$").trim(),right,y,{align:"right"});
  y+=8;doc.setFontSize(12);doc.text("TOTAL",160,y,{align:"right"});doc.text(money(quote.total).replace("CLP","$").trim(),right,y,{align:"right"});doc.setFontSize(9);
  if(quote.observaciones){y+=14;doc.setFont("helvetica","bold");doc.text("Observaciones",left,y);doc.setFont("helvetica","normal");doc.text(doc.splitTextToSize(String(quote.observaciones),174),left,y+5)}
  const pages=doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(125,108,100);doc.text(`${company} · ${quote.numero_cotizacion||"Cotización"}`,left,pageH-10);doc.text(`Página ${i} de ${pages}`,right,pageH-10,{align:"right"})}
  return {doc,dataUrl:doc.output("datauristring")};
}
async function generateAndUploadQuotePdf(quote,download=true){
  const saved=quote?.id?quote:await persistQuote();
  const fresh=data.quotes.find(x=>String(x.id)===String(saved.id))||saved;
  const built=await buildQuotePdfData(fresh);
  const out=await AleAPI.uploadQuotePdf({id:fresh.id,dataUrl:built.dataUrl},token);
  const updated=out.quote||{...fresh,pdf_url:out.pdfUrl};
  const ix=data.quotes.findIndex(x=>String(x.id)===String(updated.id));if(ix>=0)data.quotes[ix]=updated;else data.quotes.unshift(updated);
  $("#qPdfUrl").value=updated.pdf_url||out.pdfUrl||"";renderQuotes();
  if(download)built.doc.save(`${updated.numero_cotizacion||"cotizacion"}.pdf`);
  return updated;
}
async function sendQuoteWhatsapp(quote,popup=null){
  let q=quote;
  if(!q?.id)q=await persistQuote();
  if(!q.pdf_url)q=await generateAndUploadQuotePdf(q,false);
  const phone=phoneForWhatsapp(q.telefono);if(!phone)throw new Error("TELEFONO_WHATSAPP_REQUERIDO");
  const text=`Hola ${q.cliente_nombre||""}, adjuntamos la cotización ${q.numero_cotizacion||""}${q.numero_solicitud?` asociada a la solicitud ${q.numero_solicitud}`:""}. Total: ${money(q.total)}. PDF: ${q.pdf_url}`;
  const waUrl=`https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  if(popup && !popup.closed) popup.location.href=waUrl;
  else window.open(waUrl,"_blank","noopener");
  if(String(q.estado||"").toUpperCase()==="BORRADOR"){
    try{const out=await AleAPI.post("updatequotestatus",{id:q.id,status:"ENVIADA"},token);if(out.quote){const ix=data.quotes.findIndex(x=>String(x.id)===String(q.id));if(ix>=0)data.quotes[ix]=out.quote;renderQuotes()}}catch(_){ }
  }
  return q;
}
$("#generateQuotePdf")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const q=$("#qId").value?data.quotes.find(x=>String(x.id)===String($("#qId").value)):null;const out=await generateAndUploadQuotePdf(q||null,true);toast(`PDF ${out.numero_cotizacion||""} generado`)}catch(err){console.warn(err);toast("No fue posible generar el PDF")}}));
$("#sendQuoteWhatsapp")?.addEventListener("click",e=>{const popup=window.open("about:blank","_blank");busy(e.currentTarget,async()=>{try{const q=$("#qId").value?data.quotes.find(x=>String(x.id)===String($("#qId").value)):null;await sendQuoteWhatsapp(q||null,popup);toast("Cotización preparada para WhatsApp")}catch(err){try{popup?.close()}catch(_){}console.warn(err);toast("No fue posible enviar por WhatsApp")}})});
window.generateQuoteFromList=async(id,btn)=>busy(btn,async()=>{try{const q=data.quotes.find(x=>String(x.id)===String(id));if(!q)throw new Error("COTIZACION_NO_ENCONTRADA");await generateAndUploadQuotePdf(q,true);toast("PDF generado")}catch(e){console.warn(e);toast("No fue posible generar PDF")}});
window.sendQuoteFromList=async(id,btn)=>{const popup=window.open("about:blank","_blank");return busy(btn,async()=>{try{const q=data.quotes.find(x=>String(x.id)===String(id));if(!q)throw new Error("COTIZACION_NO_ENCONTRADA");await sendQuoteWhatsapp(q,popup);toast("Cotización preparada para WhatsApp")}catch(e){try{popup?.close()}catch(_){}console.warn(e);toast("No fue posible abrir WhatsApp")}})};



// ========================= R9.6 IMPORTACION XLSX =========================
let productImportRows=[];
function normalizeImportHeader(v){return normalizeText(v).replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")}
function importRowFromXlsx(raw){
  const m={};Object.entries(raw||{}).forEach(([k,v])=>m[normalizeImportHeader(k)]=v);
  return {id:String(m.id||m.codigo||"").trim(),nombre:String(m.nombre||m.producto||"").trim(),descripcion:String(m.descripcion||"").trim(),precio:toNumber(m.precio),categoria_nombre:String(m.categoria||m.categoria_nombre||"").trim(),stock:toNumber(m.stock),destacado:String(m.destacado||"NO").trim(),activo:String(m.activo||"SI").trim(),ocasion:String(m.ocasion||"").trim(),orden:toNumber(m.orden),image_url:String(m.imagen_url||m.image_url||m.imagen||"").trim()};
}
function showProductImport(open){$("#productImportEditor")?.classList.toggle("hidden",!open);document.body.classList.toggle("product-import-open",!!open);if(!open){productImportRows=[];resetFilePicker("#productImportFile");$("#confirmProductImport").disabled=true;$("#productImportPreview").innerHTML="";$("#productImportSummary").textContent="Aún no se ha seleccionado un archivo."}}
$("#importProductsXlsx")?.addEventListener("click",()=>showProductImport(true));
$("#closeProductImportX")?.addEventListener("click",()=>showProductImport(false));$("#cancelProductImport")?.addEventListener("click",()=>showProductImport(false));
$("#productImportFile")?.addEventListener("change",async e=>{
  const f=e.target.files?.[0];if(!f)return;if(!window.XLSX)return toast("No se cargó el lector XLSX");
  try{const buf=await f.arrayBuffer(),book=XLSX.read(buf,{type:"array"}),sheet=book.Sheets[book.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{defval:""});productImportRows=rows.map(importRowFromXlsx).filter(r=>r.nombre);const invalid=productImportRows.filter(r=>!r.nombre||r.precio<0);$("#productImportSummary").textContent=`${productImportRows.length} filas válidas para revisar${invalid.length?` · ${invalid.length} con observaciones`:""}.`;$("#confirmProductImport").disabled=!productImportRows.length;const preview=productImportRows.slice(0,25);$("#productImportPreview").innerHTML=table(["ID","Nombre","Categoría","Precio","Stock","Activo"],preview.map(r=>`<tr><td>${esc(r.id||"NUEVO")}</td><td>${esc(r.nombre)}</td><td>${esc(r.categoria_nombre)}</td><td>${money(r.precio)}</td><td>${r.stock}</td><td>${esc(r.activo)}</td></tr>`).join(""));}catch(err){console.warn(err);toast("No fue posible leer el XLSX")}
});
$("#confirmProductImport")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const out=await AleAPI.post("bulkimportproducts",{rows:productImportRows},token);toast(`Importación lista: ${out.imported||0} productos · ${out.errors?.length||0} errores`);showProductImport(false);await reload()}catch(err){console.warn(err);toast("No fue posible importar los productos")}}));

// ========================= R9.6 CLIENTES =========================
function renderClients(){
  const host=$("#clientsTable");if(!host)return;const q=normalizeText($("#clientSearch")?.value||"");const list=(data.clients||[]).filter(c=>!q||normalizeText([c.nombre,c.telefono,c.email,c.numero_cliente].join(" ")).includes(q));
  $("#clientResultsMeta").textContent=`Mostrando ${list.length} de ${(data.clients||[]).length} clientes`;
  host.innerHTML=table(["N.º cliente","Cliente","Contacto","Solicitudes","Pedidos","Cotizaciones","Total comprado","Última interacción"],list.map(c=>`<tr><td><strong>${esc(c.numero_cliente||c.id)}</strong></td><td><strong>${esc(c.nombre||"")}</strong></td><td>${esc(c.telefono||"")}<br><small>${esc(c.email||"")}</small></td><td>${Number(c.total_solicitudes||0)}</td><td>${Number(c.total_pedidos||0)}</td><td>${Number(c.total_cotizaciones||0)}</td><td>${money(c.total_comprado||0)}</td><td>${esc(formatDate(c.ultima_interaccion))}</td></tr>`).join(""));
}
$("#clientSearch")?.addEventListener("input",renderClients);$("#clearClientSearch")?.addEventListener("click",()=>{$("#clientSearch").value="";renderClients()});
function exportRowsXlsx(rows,name){if(!window.XLSX)return toast("No se cargó la librería XLSX");const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Datos");XLSX.writeFile(wb,name)}
function simplePdf(title,headers,rows,name){const JsPDF=window.jspdf?.jsPDF;if(!JsPDF)return toast("No se cargó la librería PDF");const doc=new JsPDF({orientation:"landscape",unit:"mm",format:"a4"});doc.setFontSize(16);doc.text(title,14,14);doc.setFontSize(8);let y=22;const widths=[28,48,42,28,28,30,35,42];headers.forEach((h,i)=>doc.text(String(h),14+widths.slice(0,i).reduce((a,b)=>a+b,0),y));y+=6;for(const row of rows){if(y>190){doc.addPage();y=16}row.forEach((v,i)=>doc.text(String(v??"").slice(0,32),14+widths.slice(0,i).reduce((a,b)=>a+b,0),y));y+=5}doc.save(name)}
$("#exportClientsXlsx")?.addEventListener("click",()=>exportRowsXlsx((data.clients||[]).map(c=>({numero_cliente:c.numero_cliente,nombre:c.nombre,telefono:c.telefono,email:c.email,solicitudes:c.total_solicitudes,pedidos:c.total_pedidos,cotizaciones:c.total_cotizaciones,total_comprado:c.total_comprado,ultima_interaccion:c.ultima_interaccion})),"ALE_ATENCIO_CLIENTES.xlsx"));
$("#exportClientsPdf")?.addEventListener("click",()=>simplePdf("ALE ATENCIO · Clientes",["N.º","Cliente","Teléfono","Email","Sol.","Pedidos","Cot.","Total"],(data.clients||[]).map(c=>[c.numero_cliente,c.nombre,c.telefono,c.email,c.total_solicitudes,c.total_pedidos,c.total_cotizaciones,money(c.total_comprado)]),"ALE_ATENCIO_CLIENTES.pdf"));

// ========================= R9.6 REPORTES =========================
function reportDateOk(v){if(!v)return true;const d=new Date(v);const from=$("#reportFrom")?.value?new Date($("#reportFrom").value+"T00:00:00"):null,to=$("#reportTo")?.value?new Date($("#reportTo").value+"T23:59:59"):null;return(!from||d>=from)&&(!to||d<=to)}
function currentSalesRows(){const st=$("#reportOrderStatus")?.value||"";return(data.orders||[]).filter(o=>reportDateOk(o.fecha||o.created_at)&&(!st||String(o.estado).toUpperCase()===st))}
function renderReports(){
  const sales=currentSalesRows(),realSales=sales.filter(o=>String(o.estado).toUpperCase()!=="CANCELADO"),total=realSales.reduce((s,o)=>s+Number(o.total||0),0),clients=data.clients||[];
  $("#reportSalesTotal")&&( $("#reportSalesTotal").textContent=money(total));
  $("#reportOrdersCount")&&( $("#reportOrdersCount").textContent=String(sales.length));
  $("#reportClientsCount")&&( $("#reportClientsCount").textContent=String(clients.length));
  $("#reportRepeatClients")&&( $("#reportRepeatClients").textContent=String(clients.filter(c=>Number(c.total_pedidos||0)>1||Number(c.total_solicitudes||0)>1).length));
  const from=$("#reportFrom")?.value||"",to=$("#reportTo")?.value||"",status=$("#reportOrderStatus")?.value||"";
  const fmt=d=>{if(!d)return"";const [y,m,day]=d.split("-");return `${day}/${m}/${y}`};
  const parts=[from?`desde ${fmt(from)}`:"",to?`hasta ${fmt(to)}`:"",status?`estado ${status}`:"todos los estados"].filter(Boolean);
  if($("#reportFilterSummary"))$("#reportFilterSummary").innerHTML=`<i class="bi bi-info-circle"></i><span>Mostrando ${sales.length} pedido${sales.length===1?"":"s"}${parts.length?` · ${esc(parts.join(" · "))}`:""}.</span>`;
  if($("#salesRowsBadge"))$("#salesRowsBadge").textContent=`${sales.length} registro${sales.length===1?"":"s"}`;
  if($("#clientRowsBadge"))$("#clientRowsBadge").textContent=`${clients.length} cliente${clients.length===1?"":"s"}`;
  const sh=$("#salesReportTable");if(sh)sh.innerHTML=table(["Fecha","Cliente","Teléfono","Estado","Total"],sales.map(o=>`<tr><td>${esc(formatDate(o.fecha||o.created_at))}</td><td><strong>${esc(o.nombre||"")}</strong></td><td>${esc(o.telefono||"")}</td><td><span class="report-status-pill">${esc(o.estado||"")}</span></td><td><strong>${money(o.total)}</strong></td></tr>`).join(""));
  const ch=$("#clientReportTable");if(ch)ch.innerHTML=table(["Cliente","Solicitudes","Pedidos","Cotizaciones","Total comprado"],clients.slice().sort((a,b)=>Number(b.total_comprado||0)-Number(a.total_comprado||0)).map(c=>`<tr><td><strong>${esc(c.nombre||c.numero_cliente)}</strong></td><td>${Number(c.total_solicitudes||0)}</td><td>${Number(c.total_pedidos||0)}</td><td>${Number(c.total_cotizaciones||0)}</td><td><strong>${money(c.total_comprado||0)}</strong></td></tr>`).join(""));
}
$("#applyReports")?.addEventListener("click",renderReports);$("#reportOrderStatus")?.addEventListener("change",renderReports);$("#reportFrom")?.addEventListener("change",renderReports);$("#reportTo")?.addEventListener("change",renderReports);
$("#resetReports")?.addEventListener("click",()=>{if($("#reportFrom"))$("#reportFrom").value="";if($("#reportTo"))$("#reportTo").value="";if($("#reportOrderStatus"))$("#reportOrderStatus").value="ENTREGADO";renderReports()});
$("#exportSalesXlsx")?.addEventListener("click",()=>exportRowsXlsx(currentSalesRows().map(o=>({fecha:o.fecha||o.created_at,cliente:o.nombre,telefono:o.telefono,email:o.email,estado:o.estado,total:o.total,metodo_entrega:o.metodo_entrega})),"ALE_ATENCIO_REPORTE_VENTAS.xlsx"));
$("#exportSalesPdf")?.addEventListener("click",()=>simplePdf("ALE ATENCIO · Reporte de ventas",["Fecha","Cliente","Teléfono","Estado","Total"],currentSalesRows().map(o=>[formatDate(o.fecha||o.created_at),o.nombre,o.telefono,o.estado,money(o.total)]),"ALE_ATENCIO_REPORTE_VENTAS.pdf"));

function openAdminView(view){const target=$(`.admin-nav button[data-view="${CSS.escape(String(view||"dashboard"))}"]`);if(!target)return;$$('.admin-nav button').forEach(x=>x.classList.remove("active"));target.classList.add("active");$$('.admin-view').forEach(x=>x.classList.remove("active"));$("#view-"+target.dataset.view)?.classList.add("active");$("#viewTitle").textContent=target.textContent.trim();if(target.dataset.view==="products"){if($("#productSearch"))$("#productSearch").value="";if($("#productFilter"))$("#productFilter").value="";renderProducts()}if(sidebarIsMobile())setSidebarOpen(false);window.scrollTo({top:0,behavior:"smooth"})}
$$('.admin-nav button').forEach(btn=>btn.addEventListener("click",()=>openAdminView(btn.dataset.view)));
function formatDate(v){if(!v)return"";const d=new Date(v);return isNaN(d)?String(v):d.toLocaleString("es-CL")}
let sessionRestoreTimer=null,sessionRestoreBusy=false;
async function restoreAdminSession(){
  if(sessionRestoreBusy||!token)return;
  sessionRestoreBusy=true;
  if(sessionRestoreTimer){clearTimeout(sessionRestoreTimer);sessionRestoreTimer=null}
  showLogin("Validando sesión guardada…");
  try{
    const sess=await validateStoredSession(3);
    if(!sess?.ok)throw new Error(sess?.error||"SESION_INVALIDA");
    data.currentUser=sess.user||data.currentUser;
    if(sess.permissions)data.permissions=sess.permissions;
    showAdmin();
    renderSessionHeader(sess.user);
    // La sesión ya fue validada. Una falla al cargar datos NO debe cerrar sesión.
    try{await reload()}catch(err){
      console.warn("reload after restored session",err);
      toast("Sesión activa. No fue posible actualizar todos los datos; reintentaremos automáticamente.");
    }
    startNotificationWatcher();
    AleAPI.backendStatus().then(st=>{
      if(!st?.ok&&$("#apiWarning"))$("#apiWarning").textContent="Conexión intermitente con Supabase. La sesión permanece iniciada.";
    }).catch(()=>{});
  }catch(e){
    console.warn("restore session",e);
    if(isDefinitiveSessionError(e)){
      clearAdminToken();
      showLogin("La sesión venció o fue cerrada. Ingresa nuevamente.");
    }else{
      // No borrar el token por timeout, pérdida momentánea de Internet o respuesta 5xx.
      showLogin("No fue posible validar la conexión en este momento. Tu sesión se conserva y se reintentará automáticamente.");
      sessionRestoreTimer=setTimeout(()=>restoreAdminSession(),4500);
    }
  }finally{sessionRestoreBusy=false}
}

window.addEventListener("online",()=>{if(token&&!document.body.classList.contains("auth-active"))restoreAdminSession()});
window.addEventListener("focus",()=>{if(token&&!document.body.classList.contains("auth-active")&&!sessionRestoreBusy)restoreAdminSession()});

(async()=>{
  if(!AleAPI.configured()) return showLogin("Configura la URL de Supabase Edge Function en config.js.");
  if(token){
    // R9.15.1: validar primero la sesión; el ping no puede expulsar al usuario.
    await restoreAdminSession();
    return;
  }
  showLogin();
  AleAPI.backendStatus().then(st=>{
    if(!st?.ok&&$("#apiWarning"))$("#apiWarning").textContent="Backend Supabase sin respuesta: "+(st.error||"SIN_RESPUESTA")+". Revisa la Edge Function dynamic-processor.";
  }).catch(()=>{});
})();
