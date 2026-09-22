// ALE ATENCIO R9.18.40 · autocompletado seguro de clientes por RUT
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money=n=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(n||0));
const normalizeText=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-CL").trim();
const normalizeRutChile=value=>String(value??"").toUpperCase().replace(/[^0-9K]/g,"");
function isValidRutChile(value){const rut=normalizeRutChile(value);if(!/^[0-9]{7,8}[0-9K]$/.test(rut))return false;const body=rut.slice(0,-1),dv=rut.slice(-1);let sum=0,mul=2;for(let i=body.length-1;i>=0;i--){sum+=Number(body[i])*mul;mul=mul===7?2:mul+1}const r=11-(sum%11),expected=r===11?"0":r===10?"K":String(r);return dv===expected}
function formatRutChile(value){const rut=normalizeRutChile(value);if(!rut)return"";const body=rut.slice(0,-1),dv=rut.slice(-1);return `${body.replace(/\B(?=(\d{3})+(?!\d))/g,".")}-${dv}`}
function requireRutChile(value){const rut=formatRutChile(value);if(!rut)throw new Error("RUT_REQUERIDO");if(!isValidRutChile(rut))throw new Error("RUT_INVALIDO");return rut}
function wireRutInput(selector){const el=$(selector);if(!el)return;el.addEventListener("blur",()=>{if(el.value)el.value=formatRutChile(el.value)});el.addEventListener("input",()=>el.setCustomValidity(el.value&&!isValidRutChile(el.value)?"RUT inválido":""))}

const clientLookupSeq=new Map();
function mergeClientCache(client){if(!client?.id)return;data.clients=Array.isArray(data.clients)?data.clients:[];const i=data.clients.findIndex(x=>String(x.id)===String(client.id));if(i>=0)data.clients[i]={...data.clients[i],...client};else data.clients.unshift(client)}
function clientFromCacheByRut(value){const n=normalizeRutChile(value);if(!n)return null;return (data.clients||[]).find(c=>normalizeRutChile(c.rut_normalizado||c.rut)===n)||null}
function setClientLookupState(selector,message,kind=""){const el=$(selector);if(!el)return;el.textContent=message||"";el.classList.remove("is-loading","is-found","is-new","is-error");if(kind)el.classList.add(`is-${kind}`)}
async function fetchClientByRut(value){const rut=requireRutChile(value),normalized=normalizeRutChile(rut),cached=clientFromCacheByRut(normalized);try{const out=await AleAPI.post("clientbyrut",{rut},token);if(out?.client)mergeClientCache(out.client);return out?.client||null}catch(err){if(cached)return cached;throw err}}
function orderDeliveryFromClient(value){const x=String(value||"").trim().toUpperCase();if(x==="RETIRO")return"Retiro";if(x==="DESPACHO")return"Despacho";return"Coordinar"}
async function hydrateClientByRut({rutSelector,statusSelector,fields={},mode="overwrite"}){
  const input=$(rutSelector);if(!input)return null;const raw=input.value;if(!raw||!isValidRutChile(raw)){if(raw)setClientLookupState(statusSelector,"RUT inválido. Revisa el dígito verificador.","error");else setClientLookupState(statusSelector,"Ingresa un RUT válido para buscar en Clientes.");return null}
  input.value=formatRutChile(raw);const seq=(clientLookupSeq.get(rutSelector)||0)+1;clientLookupSeq.set(rutSelector,seq);setClientLookupState(statusSelector,"Buscando cliente…","loading");
  try{const client=await fetchClientByRut(input.value);if(clientLookupSeq.get(rutSelector)!==seq)return null;if(!client){setClientLookupState(statusSelector,"RUT nuevo: al guardar quedará registrado en Clientes.","new");return null}
    const assign=(selector,value)=>{const el=$(selector);if(!el||value===undefined||value===null)return;if(mode==="blank"&&String(el.value||"").trim())return;el.value=String(value)};
    if(fields.name)assign(fields.name,client.nombre||"");if(fields.phone)assign(fields.phone,client.telefono||"");if(fields.email)assign(fields.email,client.email||"");if(fields.address)assign(fields.address,client.direccion||"");if(fields.commune)assign(fields.commune,client.comuna||"");if(fields.delivery){const el=$(fields.delivery);if(el&&(mode!=="blank"||!String(el.value||"").trim()))el.value=orderDeliveryFromClient(client.tipo_transporte)}
    setClientLookupState(statusSelector,`Cliente encontrado${client.numero_cliente?` · ${client.numero_cliente}`:""}. Datos precargados.`,"found");return client;
  }catch(err){console.warn("client lookup",err);if(clientLookupSeq.get(rutSelector)===seq)setClientLookupState(statusSelector,"No fue posible consultar Clientes. Puedes continuar y guardar.","error");return null}
}
function wireClientRutLookup({rutSelector,statusSelector,fields,mode="overwrite",guard=null}){const el=$(rutSelector);if(!el)return;wireRutInput(rutSelector);const run=()=>{if(typeof guard==="function"&&!guard())return;hydrateClientByRut({rutSelector,statusSelector,fields,mode})};el.addEventListener("blur",run);el.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();run()}});el.addEventListener("input",()=>{if(!el.value)setClientLookupState(statusSelector,"Ingresa un RUT válido para buscar en Clientes.")})}

function rutSearchMatch(value,query){
  const candidate=normalizeRutChile(query);
  if(!candidate||candidate.length<4)return false;
  return normalizeRutChile(value).includes(candidate);
}
function flexibleSearchMatch(values,query){
  const raw=String(query??"").trim();
  if(!raw)return true;
  const text=normalizeText(values.filter(Boolean).join(" "));
  if(text.includes(normalizeText(raw)))return true;
  return values.some(v=>rutSearchMatch(v,raw));
}
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

// R9.18.22 · Parser monetario chileno + dictado robusto. Evita que "40.000" se convierta en 40.
const CLP_WORDS={
  cero:0,un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,
  dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veintiuno:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,
  treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,cien:100,ciento:100,doscientos:200,trescientos:300,cuatrocientos:400,quinientos:500,seiscientos:600,setecientos:700,ochocientos:800,novecientos:900
};
function spokenSpanishInteger(value){
  const text=normalizeText(value).replace(/\b(?:pesos?|chilenos?|clp|monto|precio|valor|total|de)\b/g," ").replace(/[^a-z0-9.,\s-]/g," ").replace(/\s+/g," ").trim();
  if(!text)return NaN;
  const tokens=text.split(" ");let total=0,current=0,recognized=false;
  for(const token0 of tokens){const token=token0.replace(/^-|-$/g,"");if(!token||token==="y")continue;
    if(/^\d/.test(token)){const n=parseClpNumeric(token);if(Number.isFinite(n)){current+=n;recognized=true;continue}}
    if(token==="mil"||token==="miles"){total+=current>=1000?current:(current||1)*1000;current=0;recognized=true;continue}
    if(token==="millon"||token==="millones"){total+=(current||1)*1000000;current=0;recognized=true;continue}
    if(token==="luca"||token==="lucas"){total+=current>=1000?current:(current||1)*1000;current=0;recognized=true;continue}
    if(Object.prototype.hasOwnProperty.call(CLP_WORDS,token)){current+=CLP_WORDS[token];recognized=true;continue}
  }
  return recognized?total+current:NaN;
}
function parseClpNumeric(value){
  if(typeof value==="number")return Number.isFinite(value)?value:NaN;
  let raw=String(value??"").trim();if(!raw)return NaN;
  raw=raw.replace(/\s+/g,"").replace(/[^0-9,.-]/g,"");if(!raw)return NaN;
  const neg=raw.startsWith("-");if(neg)raw=raw.slice(1);
  let normalized=raw;
  if(/^\d{1,3}([.,]\d{3})+$/.test(raw)) normalized=raw.replace(/[.,]/g,"");
  else if(raw.includes(",")&&raw.includes(".")) normalized=raw.lastIndexOf(",")>raw.lastIndexOf(".")?raw.replace(/\./g,"").replace(",", "."):raw.replace(/,/g,"");
  else if(raw.includes(",")){const parts=raw.split(",");normalized=parts.length===2&&parts[1].length===3?parts.join(""):raw.replace(",", ".")}
  else if((raw.match(/\./g)||[]).length>1||/\.\d{3}$/.test(raw))normalized=raw.replace(/\./g,"");
  const n=Number(normalized);return Number.isFinite(n)?(neg?-n:n):NaN;
}
function parseSpokenClpGrouping(value){
  const text=normalizeText(value).replace(/\b(?:pesos?|chilenos?|clp)\b/g," ").replace(/\s+/g," ").trim();
  const m=text.match(/^(\d+)\s*(?:punto|\.)\s*(.+)$/);if(!m)return NaN;
  const digitWords={cero:"0",zero:"0",uno:"1",una:"1",un:"1",dos:"2",tres:"3",cuatro:"4",cinco:"5",seis:"6",siete:"7",ocho:"8",nueve:"9"};
  const tail=m[2].replace(/(?:punto|\.)/g," ").replace(/[,;-]/g," ").split(/\s+/).filter(Boolean);let digits="";
  for(const token of tail){if(/^\d+$/.test(token)){digits+=token;continue}if(Object.prototype.hasOwnProperty.call(digitWords,token)){digits+=digitWords[token];continue}return NaN}
  if(!digits||digits.length>6)return NaN;const n=Number(`${m[1]}${digits}`);return Number.isFinite(n)?n:NaN;
}
function parseClpAmount(value){
  if(typeof value==="number")return Number.isFinite(value)?Math.max(0,Math.round(value)):0;
  const raw=String(value??"").trim();if(!raw)return 0;
  const normalized=normalizeText(raw);
  const spokenGrouping=parseSpokenClpGrouping(normalized);if(Number.isFinite(spokenGrouping)&&spokenGrouping>=0)return Math.round(spokenGrouping);
  const hasScale=/\b(mil|miles|millon|millones|luca|lucas)\b/.test(normalized);
  if(hasScale){
    const spoken=spokenSpanishInteger(normalized);
    if(Number.isFinite(spoken)&&spoken>=0)return Math.round(spoken);
  }
  const numeric=parseClpNumeric(raw);if(Number.isFinite(numeric)&&numeric>=0)return Math.round(numeric);
  const spoken=spokenSpanishInteger(normalized);return Number.isFinite(spoken)&&spoken>=0?Math.round(spoken):0;
}
function formatClpEditable(value){const n=parseClpAmount(value);return n?new Intl.NumberFormat("es-CL",{maximumFractionDigits:0}).format(n):"0"}
function clpLabel(value){return `CLP ${money(parseClpAmount(value))}`}

// R9.18.22 · Voz CLP natural. La interfaz conserva $30.000, pero TTS recibe "treinta mil pesos".
const CLP_UNITS=["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince","dieciséis","diecisiete","dieciocho","diecinueve","veinte","veintiuno","veintidós","veintitrés","veinticuatro","veinticinco","veintiséis","veintisiete","veintiocho","veintinueve"];
const CLP_TENS={30:"treinta",40:"cuarenta",50:"cincuenta",60:"sesenta",70:"setenta",80:"ochenta",90:"noventa"};
const CLP_HUNDREDS={2:"doscientos",3:"trescientos",4:"cuatrocientos",5:"quinientos",6:"seiscientos",7:"setecientos",8:"ochocientos",9:"novecientos"};
function clpApocope(text){return String(text||"").replace(/veintiuno$/,"veintiún").replace(/ y uno$/," y un").replace(/uno$/,"un")}
function clpUnder100(n){n=Math.trunc(n);if(n<30)return CLP_UNITS[n]||"";const t=Math.trunc(n/10)*10,u=n%10;return u?`${CLP_TENS[t]} y ${CLP_UNITS[u]}`:CLP_TENS[t]}
function clpUnder1000(n){n=Math.trunc(n);if(n<100)return clpUnder100(n);if(n===100)return"cien";const h=Math.trunc(n/100),r=n%100;const head=h===1?"ciento":CLP_HUNDREDS[h];return r?`${head} ${clpUnder100(r)}`:head}
function clpIntegerWords(value){
  let n=Math.max(0,Math.round(Number(value)||0));if(n===0)return"cero";
  if(n<1000)return clpUnder1000(n);
  if(n<1_000_000){const th=Math.trunc(n/1000),r=n%1000;const head=th===1?"mil":`${clpApocope(clpUnder1000(th))} mil`;return r?`${head} ${clpUnder1000(r)}`:head}
  if(n<1_000_000_000){const m=Math.trunc(n/1_000_000),r=n%1_000_000;const head=m===1?"un millón":`${clpApocope(clpIntegerWords(m))} millones`;return r?`${head} ${clpIntegerWords(r)}`:head}
  const b=Math.trunc(n/1_000_000_000),r=n%1_000_000_000;const head=b===1?"mil millones":`${clpApocope(clpIntegerWords(b))} mil millones`;return r?`${head} ${clpIntegerWords(r)}`:head;
}
function clpSpeechAmount(value){const n=parseClpAmount(value);return `${clpIntegerWords(n)} ${n===1?"peso":"pesos"}`}
function speechFriendlyClpText(value){
  let text=String(value??"");
  const replaceAmount=(_,raw)=>clpSpeechAmount(raw);
  text=text.replace(/\bCLP\s*\$?\s*([0-9][0-9.\s,]*)\s*(?:pesos?(?:\s+chilenos?)?)?/gi,replaceAmount);
  text=text.replace(/\$\s*([0-9][0-9.\s,]*)\s*(?:pesos?(?:\s+chilenos?)?)?/gi,replaceAmount);
  text=text.replace(/\b([0-9]{1,3}(?:[.]\d{3})+)\s+pesos?(?:\s+chilenos?)?\b/gi,replaceAmount);
  return text.replace(/\s{2,}/g," ").trim();
}
function normalizeClpInput(input){if(!input)return;const n=parseClpAmount(input.value);input.value=n?new Intl.NumberFormat("es-CL",{maximumFractionDigits:0}).format(n):"0"}
function speechRecognitionCtor(){return window.SpeechRecognition||window.webkitSpeechRecognition||null}
function listenClpAmount(input,button){
  const Ctor=speechRecognitionCtor();if(!Ctor)return toast("El reconocimiento de voz no está disponible en este navegador");
  const rec=new Ctor();rec.lang="es-CL";rec.interimResults=false;rec.maxAlternatives=3;button?.classList.add("is-listening");
  rec.onresult=e=>{const transcript=Array.from(e.results?.[0]||[]).map(x=>x.transcript).join(" ")||e.results?.[0]?.[0]?.transcript||"";const amount=parseClpAmount(transcript);if(!amount){toast(`No pude interpretar el monto: ${transcript}`);return}input.value=new Intl.NumberFormat("es-CL",{maximumFractionDigits:0}).format(amount);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));toast(`Monto reconocido: ${clpLabel(amount)}`)};
  rec.onerror=()=>toast("No fue posible escuchar el monto");rec.onend=()=>button?.classList.remove("is-listening");rec.start();
}
function installStaticClpFields(){
  [["#pPrice","Precio"],["#ocDispatch","Despacho"],["#sDelivery","Valor despacho"]].forEach(([sel,label])=>{const input=$(sel);if(!input||input.dataset.clpReady)return;input.dataset.clpReady="1";input.type="text";input.inputMode="numeric";input.autocomplete="off";input.classList.add("clp-money-input");const wrap=document.createElement("div");wrap.className="clp-input-shell";input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);const prefix=document.createElement("span");prefix.className="clp-input-prefix";prefix.textContent="CLP $";wrap.insertBefore(prefix,input);const Ctor=speechRecognitionCtor();if(Ctor){const mic=document.createElement("button");mic.type="button";mic.className="clp-voice-btn";mic.title=`Dictar ${label}`;mic.setAttribute("aria-label",`Dictar ${label}`);mic.innerHTML='<i class="bi bi-mic-fill"></i>';mic.addEventListener("click",()=>listenClpAmount(input,mic));wrap.appendChild(mic)}input.addEventListener("blur",()=>normalizeClpInput(input));});
}
const FINAL_ORDER_STATES=new Set(["ENTREGADO","CANCELADO"]);
function orderState(value){return String(value||"").trim().toUpperCase()}
function isFinalOrder(orderOrState){return FINAL_ORDER_STATES.has(orderState(typeof orderOrState==="object"?orderOrState?.estado:orderOrState))}
function orderFinalMessage(state){return orderState(state)==="CANCELADO"?"Pedido cancelado · estado final e irreversible":"Pedido entregado · estado final e irreversible"}
let token=localStorage.getItem("aleAdminToken")||sessionStorage.getItem("aleAdminToken")||"", data={products:[],categories:[],banners:[],orders:[],requests:[],quotes:[],clients:[],users:[],suppliers:[],supplies:[],purchases:[],purchaseItems:[],gallery:[],config:{},currentUser:null};

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


// R9.18.38 · Filtros de tablas comerciales. Por defecto se muestra HOY para evitar tablas interminables.
function localDateKey(value){
  if(!value)return "";const d=new Date(value);if(!Number.isNaN(d.getTime()))return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const m=String(value).match(/^(\d{4}-\d{2}-\d{2})/);return m?m[1]:"";
}
function todayDateKey(){return localDateKey(new Date())}
const commercialFilters={orders:{search:"",from:todayDateKey(),to:todayDateKey(),saleType:""},requests:{search:"",from:todayDateKey(),to:todayDateKey()},quotes:{search:"",from:todayDateKey(),to:todayDateKey()}};
function normalizeFilterText(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function recordDateFor(kind,row){return kind==="quotes"?(row.fecha||row.creado_en||row.created_at):(row.fecha||row.created_at||row.creado_en)}
function recordSearchText(kind,row){
  const fields=kind==="orders"?[row.numero_pedido,row.nombre,row.rut,row.telefono,row.email,row.metodo_entrega,row.direccion,row.comuna,row.total,row.estado,row.estado_pago,row.medio_pago,row.tipo_venta,row.origen,row.lista_precio_nombre]:kind==="requests"?[row.numero_solicitud,row.nombre,row.rut,row.telefono,row.email,row.tipo,row.fecha_evento,row.detalle,row.estado]:[row.numero_cotizacion,row.numero_solicitud,row.cliente_nombre,row.rut,row.telefono,row.email,row.subtotal,row.iva,row.total,row.estado,row.pedido_numero];
  return normalizeFilterText(fields.filter(v=>v!==undefined&&v!==null).join(" "));
}
function filteredCommercialRows(kind,rows){
  const f=commercialFilters[kind]||{};const q=normalizeFilterText(f.search).trim();
  return (rows||[]).filter(row=>{const dk=recordDateFor(kind,row);const key=localDateKey(dk);if(f.from&&(!key||key<f.from))return false;if(f.to&&(!key||key>f.to))return false;if(kind==="orders"&&f.saleType&&String(row.tipo_venta||row.origen||"MINORISTA").toUpperCase()!==f.saleType)return false;if(q&&!recordSearchText(kind,row).includes(q))return false;return true});
}
function updateCommercialFilterUi(kind,visible,total){
  const f=commercialFilters[kind],from=$("#"+kind+"From"),to=$("#"+kind+"To"),search=$("#"+kind+"Search"),today=$("#"+kind+"Today"),meta=$("#"+kind+"FilterMeta"),td=todayDateKey(),saleType=kind==="orders"?$("#ordersSaleType"):null;
  if(from&&from.value!==f.from)from.value=f.from||"";if(to&&to.value!==f.to)to.value=f.to||"";if(search&&search.value!==f.search)search.value=f.search||"";if(saleType&&saleType.value!==(f.saleType||""))saleType.value=f.saleType||"";today?.classList.toggle("is-active",f.from===td&&f.to===td);
  if(meta){const range=f.from||f.to?(f.from===f.to?`Fecha: ${f.from||f.to}`:`Desde ${f.from||"inicio"} hasta ${f.to||"hoy"}`):"Todas las fechas";const typeLabel=kind==="orders"&&f.saleType?` · ${f.saleType}`:"";meta.textContent=`Mostrando ${visible} de ${total} · ${range}${typeLabel}${f.search?` · búsqueda: “${f.search}”`:""}`;}
}
function renderCommercialKind(kind){if(kind==="orders")renderOrders();else if(kind==="requests")renderRequests();else if(kind==="quotes")renderQuotes()}
function bindCommercialFilter(kind){
  const f=commercialFilters[kind],search=$("#"+kind+"Search"),from=$("#"+kind+"From"),to=$("#"+kind+"To"),today=$("#"+kind+"Today"),all=$("#"+kind+"All"),saleType=kind==="orders"?$("#ordersSaleType"):null;
  if(search)search.addEventListener("input",()=>{f.search=search.value;renderCommercialKind(kind)});
  saleType?.addEventListener("change",()=>{f.saleType=String(saleType.value||"").toUpperCase();renderCommercialKind(kind)});
  [from,to].forEach((el,idx)=>{if(!el)return;el.addEventListener("keydown",e=>{if(!["Tab","Shift"].includes(e.key))e.preventDefault()});el.addEventListener("paste",e=>e.preventDefault());el.addEventListener("click",()=>{try{el.showPicker?.()}catch(_){}});el.addEventListener("change",()=>{if(idx===0)f.from=el.value;else f.to=el.value;if(f.from&&f.to&&f.from>f.to){if(idx===0)f.to=f.from;else f.from=f.to}renderCommercialKind(kind)});});
  today?.addEventListener("click",()=>{const d=todayDateKey();f.from=d;f.to=d;renderCommercialKind(kind)});
  all?.addEventListener("click",()=>{f.from="";f.to="";renderCommercialKind(kind)});
}
["orders","requests","quotes"].forEach(bindCommercialFilter);

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
async function refreshAfterConfirmedDelete(kind){
  // La sincronización visual es posterior al DELETE y nunca puede cambiar su resultado.
  try{
    const moduleMap={products:"products",requests:"requests",quotes:"quotes"};
    const module=moduleMap[kind];
    if(module&&typeof loadAdminModules==="function"){
      const refreshed=await loadAdminModules({modules:[module],retry:true});
      return refreshed?.ok!==false;
    }
    await reload();
    return true;
  }catch(err){
    console.warn("post-delete refresh",err);
    // El registro ya fue eliminado. Dejamos la sincronización general en segundo plano.
    try{scheduleAdminRetry?.([kind])}catch(_){}
    return false;
  }
}

function applyVerifiedDeleteResult(kind,ids,out){
  const remainingIds=Array.isArray(out?.remainingIds)?out.remainingIds.map(String):[];
  const remaining=Number(out?.remaining||remainingIds.length||0);
  if(out?.ok===false||remaining>0){
    const set=selectedSet(kind);set.clear();for(const id of remainingIds)set.add(String(id));updateBulkBar(kind);
    throw Object.assign(new Error(out?.error||"ELIMINACION_INCOMPLETA"),{payload:out});
  }
  clearBulkSelection(kind);
  const deleted=Number(out?.deleted||0),missing=Number(out?.missing||0),blocked=Number(out?.blocked||0);
  const confirmed=Math.max(0,deleted+missing);
  return{deleted,missing,blocked,confirmed};
}

async function verifyDeleteAfterAmbiguousError(kind,ids,err){
  const code=String(err?.message||err||"").toUpperCase();
  const ambiguous=["API_TIMEOUT","API_CONEXION_FALLIDA","RESPUESTA_API_INVALIDA","HTTP_502","HTTP_503","HTTP_504","NETWORK","FETCH"].some(x=>code.includes(x));
  if(!ambiguous||typeof AleAPI.verifyBulkDelete!=="function")return null;
  try{return await AleAPI.verifyBulkDelete({kind,ids},token)}catch(verifyErr){console.warn("bulk delete verification",verifyErr);return null}
}

async function deleteSelected(kind,btn){
  let ids=[...selectedSet(kind)];if(!ids.length)return;
  if(kind==="requests"){const closed=ids.filter(id=>String(data.requests.find(r=>String(r.id)===String(id))?.estado||"").toUpperCase()==="CERRADA");if(closed.length){closed.forEach(id=>selectedSet(kind).delete(String(id)));ids=ids.filter(id=>!closed.includes(id));updateBulkBar(kind);toast(`⚠ ${closed.length} solicitud${closed.length===1?" CERRADA fue excluida":"es CERRADAS fueron excluidas"} de la eliminación masiva.`);if(!ids.length)return;}}
  if(kind==="quotes"){const used=ids.filter(id=>quoteIsConsumed(data.quotes.find(q=>String(q.id)===String(id))));if(used.length){used.forEach(id=>selectedSet(kind).delete(String(id)));ids=ids.filter(id=>!used.includes(id));updateBulkBar(kind);toast(`⚠ ${used.length} cotización${used.length===1?" UTILIZADA fue excluida":"es UTILIZADAS fueron excluidas"} de la eliminación masiva.`);if(!ids.length)return;}}
  const names={products:"productos",requests:"solicitudes",quotes:"cotizaciones"};
  const extra=kind==="products"?" Los productos se eliminarán definitivamente de la base. Las imágenes locales de GitHub no se borran; las imágenes propias de Supabase Storage sí se limpian cuando corresponda.":kind==="requests"?" Las cotizaciones ya creadas se conservarán, pero quedarán sin solicitud asociada.":" Los PDF asociados guardados en Supabase Storage también se eliminarán cuando correspondan.";
  if(!confirm(`¿Eliminar definitivamente ${ids.length} ${names[kind]} seleccionados?${extra}\n\nEsta acción no se puede deshacer.`))return;
  await busy(btn,async()=>{
    let out=null;
    try{
      out=typeof AleAPI.bulkDeleteEntities==="function"
        ? await AleAPI.bulkDeleteEntities({kind,ids},token)
        : await AleAPI.post("bulkDeleteEntities",{kind,ids},token);
    }catch(err){
      console.warn("bulk delete transport",err);
      const verified=await verifyDeleteAfterAmbiguousError(kind,ids,err);
      if(verified?.ok&&verified?.confirmed===true&&Number(verified.remaining||0)===0){
        out={ok:true,requested:ids.length,deleted:Number(verified.absent||verified.deleted||ids.length),missing:0,remaining:0,remainingIds:[],verifiedAfterTransportError:true};
      }else if(verified?.ok&&verified?.confirmed===false&&Number(verified.remaining||0)>0){
        out={...verified,ok:false,error:"ELIMINACION_INCOMPLETA"};
      }else{
        const code=String(err?.message||err||"").toUpperCase();
        if(code.includes("ELIMINACION_INCOMPLETA")&&err?.payload){
          out={...err.payload,ok:false};
        }else if(code.includes("PERMISO_DENEGADO")){
          return toast("✕ Tu usuario no tiene permiso para eliminar estos registros");
        }else if(code.includes("ACCION_NO_VALIDA")){
          return toast("✕ La Edge Function está desactualizada. Despliega el index.ts de esta versión");
        }else if(code.includes("SESION_")){
          return toast("✕ La sesión ya no es válida. Vuelve a iniciar sesión");
        }else if(code.includes("TIMEOUT")||code.includes("CONEXION")){
          return toast("⚠ Supabase no respondió, pero el resultado no pudo verificarse. Actualiza la tabla antes de reintentar");
        }else{
          return toast(`✕ No fue posible solicitar la eliminación múltiple${code?` (${code.slice(0,80)})`:""}`);
        }
      }
    }

    try{
      const result=applyVerifiedDeleteResult(kind,ids,out||{});
      toast(`✓ Eliminación confirmada: ${result.confirmed} registro${result.confirmed===1?"":"s"} procesado${result.confirmed===1?"":"s"}${result.missing?` · ${result.missing} ya no existían`:""}${result.blocked?` · ${result.blocked} registro${result.blocked===1?"":"s"} protegido${result.blocked===1?"":"s"}`:""}`);
      // MUY IMPORTANTE: la recarga NO forma parte del resultado de la eliminación.
      const refreshed=await refreshAfterConfirmedDelete(kind);
      if(!refreshed)toast("✓ Eliminación realizada. La actualización visual se reintentará automáticamente");
    }catch(err){
      console.warn("bulk delete result",err);
      const code=String(err?.message||err||"").toUpperCase();
      if(code.includes("ELIMINACION_INCOMPLETA"))return toast("⚠ Eliminación parcial: algunos registros permanecen seleccionados para reintentar");
      toast(`✕ No fue posible confirmar la eliminación${code?` (${code.slice(0,80)})`:""}`);
    }
  });
}


// Menú lateral R9.17.2: rail compacto + expansión automática por cursor.
const adminSidebar=$("#adminSidebar"), sidebarBackdrop=$("#sidebarBackdrop"), menuToggle=$("#menuToggle"), sidebarClose=$("#sidebarClose"), sidebarRailToggle=$("#sidebarRailToggle");
const sidebarIsMobile=()=>window.matchMedia("(max-width: 1000px)").matches;
let sidebarHoverCloseTimer=null;

function syncSidebarA11y(open){
  const next=!!open;
  menuToggle?.setAttribute("aria-expanded",String(next));
  sidebarRailToggle?.setAttribute("aria-expanded",String(next));
  if(menuToggle)menuToggle.setAttribute("aria-label",next?"Cerrar menú":"Abrir menú");
  if(sidebarRailToggle){
    sidebarRailToggle.setAttribute("aria-label",next?"Menú expandido":"Expandir menú");
    sidebarRailToggle.title=next?"Menú expandido":"Expandir menú";
  }
}

function setSidebarOpen(open){
  if(!adminSidebar)return;
  clearTimeout(sidebarHoverCloseTimer);
  if(sidebarIsMobile()){
    const next=!!open;
    adminSidebar.classList.toggle("is-open",next);
    sidebarBackdrop?.classList.toggle("is-open",next);
    document.body.classList.toggle("menu-open",next);
    document.body.classList.toggle("sidebar-peek-open",next);
    document.body.classList.remove("sidebar-collapsed");
    syncSidebarA11y(next);
    return;
  }
  const next=!!open;
  document.body.classList.toggle("sidebar-collapsed",!next);
  document.body.classList.toggle("sidebar-hover-open",next);
  adminSidebar.classList.remove("is-open");
  sidebarBackdrop?.classList.remove("is-open");
  document.body.classList.remove("menu-open","sidebar-peek-open");
  syncSidebarA11y(next);
}

function scheduleSidebarCollapse(){
  if(sidebarIsMobile())return;
  clearTimeout(sidebarHoverCloseTimer);
  sidebarHoverCloseTimer=setTimeout(()=>{
    // Si el usuario navega con teclado dentro del menú, se mantiene abierto.
    if(adminSidebar?.contains(document.activeElement))return;
    setSidebarOpen(false);
  },140);
}

function restoreSidebarState(){
  // Escritorio siempre inicia como rail compacto. En móvil permanece off-canvas.
  setSidebarOpen(false);
}

// Escritorio: entrar con el cursor abre; salir vuelve automáticamente al ancho de iconos.
adminSidebar?.addEventListener("pointerenter",()=>{
  if(sidebarIsMobile())return;
  clearTimeout(sidebarHoverCloseTimer);
  setSidebarOpen(true);
});
adminSidebar?.addEventListener("pointerleave",scheduleSidebarCollapse);

// Accesibilidad por teclado: el rail también se expande al recibir foco.
adminSidebar?.addEventListener("focusin",()=>{if(!sidebarIsMobile())setSidebarOpen(true)});
adminSidebar?.addEventListener("focusout",e=>{
  if(sidebarIsMobile())return;
  if(adminSidebar?.contains(e.relatedTarget))return;
  scheduleSidebarCollapse();
});

menuToggle?.addEventListener("click",()=>{
  if(sidebarIsMobile()) setSidebarOpen(!adminSidebar.classList.contains("is-open"));
  else setSidebarOpen(true);
});
sidebarRailToggle?.addEventListener("click",()=>setSidebarOpen(true));
sidebarClose?.addEventListener("click",()=>setSidebarOpen(false));
sidebarBackdrop?.addEventListener("click",()=>setSidebarOpen(false));
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape")return;
  setSidebarOpen(false);
});
window.addEventListener("resize",restoreSidebarState);

// Tooltips accesibles para el rail compacto de escritorio.
$$('.admin-nav button').forEach(btn=>{const label=btn.textContent.trim();if(label){btn.title=label;btn.setAttribute('aria-label',label)}});
$$('.sidebar-bottom .btn').forEach(btn=>{const label=btn.textContent.trim();if(label){btn.title=label;btn.setAttribute('aria-label',label)}});
restoreSidebarState();

function toast(msg){const t=$("#adminToast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}

// ========================= NOTIFICACIONES R9.18.26 · ESTADO SERVIDOR =========================
const NOTIFY_STORE_PREFIX="aleAtencioAdminNotificationsV3";
const NOTIFY_LEGACY_STORE_KEY="aleAtencioAdminNotificationsV2";
const NOTIFY_CURSOR_PREFIX="aleAtencioAdminNotifyCursorV3";
const NOTIFY_LEGACY_OWNER_KEY="aleAtencioAdminNotificationsV2Owner";
const NOTIFY_VOICE_KEY="aleAtencioAdminVoiceV2";
const NOTIFY_READ_MIGRATION_PREFIX="aleAtencioNotifyReadMigratedV1";
let notifyTimer=null;
let notifyBusy=false;
let notifyVoice=localStorage.getItem(NOTIFY_VOICE_KEY)!=="0";
let notifications=[];
let notificationCacheUserId="";

function notificationUserId(){return String(data.currentUser?.id||"").trim()}
function notificationStoreKey(){const uid=notificationUserId();return `${NOTIFY_STORE_PREFIX}:${uid||"anonymous"}`}
function notificationCursorKey(){const uid=notificationUserId();return `${NOTIFY_CURSOR_PREFIX}:${uid||"anonymous"}`}
function loadNotificationCache(){
  const uid=notificationUserId();
  if(!uid||notificationCacheUserId===uid)return;
  notificationCacheUserId=uid;
  let raw=localStorage.getItem(notificationStoreKey());
  // Migración única desde la caché antigua: se vincula al primer usuario que actualiza para no mezclar cuentas.
  if(raw===null){
    const legacy=localStorage.getItem(NOTIFY_LEGACY_STORE_KEY),owner=localStorage.getItem(NOTIFY_LEGACY_OWNER_KEY);
    if(legacy!==null&&(!owner||owner===uid)){raw=legacy;if(!owner)localStorage.setItem(NOTIFY_LEGACY_OWNER_KEY,uid)}
  }
  try{const parsed=JSON.parse(raw||"[]");notifications=Array.isArray(parsed)?parsed.slice(0,60):[]}catch(_){notifications=[]}
}
function persistNotifications(){
  notifications=notifications.slice(0,60);
  const uid=notificationUserId();if(uid)localStorage.setItem(notificationStoreKey(),JSON.stringify(notifications));
}
function unreadCount(){return notifications.filter(n=>!n.read).length}
function notificationIcon(kind){return kind==="payment"?"credit-card-2-front":kind==="transfer"?"bank":kind==="order"?"bag-check":"clipboard-heart"}
function notificationKicker(kind){return kind==="payment"?"PAGO CONFIRMADO":kind==="transfer"?"COMPROBANTE RECIBIDO":kind==="order"?"NUEVO PEDIDO":"NUEVA SOLICITUD"}
function renderNotificationCenter(){
  const badge=$("#notificationBadge"), list=$("#notificationList"), voiceBtn=$("#notificationVoiceToggle");
  if(badge){const n=unreadCount();badge.textContent=String(n);badge.classList.toggle("hidden",n===0)}
  if(voiceBtn){voiceBtn.innerHTML=`<i class="bi bi-${notifyVoice?"volume-up":"volume-mute"}"></i><span>${notifyVoice?"Voz activada":"Voz silenciada"}</span>`}
  if(!list)return;
  if(!notifications.length){list.innerHTML='<div class="notification-empty">No hay notificaciones nuevas.</div>';return}
  list.innerHTML=notifications.map(n=>`<button type="button" class="notification-item ${n.read?"":"unread"}" data-notification-key="${esc(n.key)}" data-notification-view="${esc(n.view)}"><span class="notification-icon ${n.kind}"><i class="bi bi-${notificationIcon(n.kind)}"></i></span><span class="notification-copy"><strong>${esc(n.title)}</strong><small>${esc(n.message)}</small><time>${esc(formatDate(n.at))}</time></span>${n.read?"":'<span class="notification-dot" aria-label="No leída"></span>'}</button>`).join("");
}
function setNotificationPanel(open){
  const panel=$("#notificationPanel"), bell=$("#notificationBell");
  if(!panel)return;
  panel.classList.toggle("hidden",!open);bell?.setAttribute("aria-expanded",String(open));
}
function speakNotification(text){
  if(!notifyVoice||!("speechSynthesis" in window))return;
  try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(speechFriendlyClpText(text));u.lang="es-CL";u.rate=.96;u.pitch=1;window.speechSynthesis.speak(u)}catch(_){ }
}
function showNotificationCard(n){
  const stack=$("#notificationToastStack");if(!stack)return;
  const card=document.createElement("button");card.type="button";card.className=`notification-toast-card ${n.kind}`;card.innerHTML=`<span class="notification-toast-icon"><i class="bi bi-${notificationIcon(n.kind)}"></i></span><span><small>${notificationKicker(n.kind)}</small><strong>${esc(n.message)}</strong></span><i class="bi bi-chevron-right"></i>`;
  card.addEventListener("click",()=>{markNotificationRead(n.key);openAdminView(n.view);card.remove()});
  stack.prepend(card);requestAnimationFrame(()=>card.classList.add("show"));
  setTimeout(()=>{card.classList.remove("show");setTimeout(()=>card.remove(),260)},9000);
}
function applyServerReadKeys(keys){
  const set=new Set((Array.isArray(keys)?keys:[]).map(String));if(!set.size)return false;
  let changed=false;for(const n of notifications){if(!n.read&&set.has(String(n.key))){n.read=true;changed=true}}
  if(changed){persistNotifications();renderNotificationCenter()}return changed;
}
async function markNotificationRead(key){
  key=String(key||"").trim();if(!key)return false;
  const n=notifications.find(x=>x.key===key),wasRead=!!n?.read;
  if(n){n.read=true;persistNotifications();renderNotificationCenter()}
  try{await AleAPI.markNotificationRead(key,token);return true}catch(err){
    console.warn("notificationRead",err);
    if(n&&!wasRead){n.read=false;persistNotifications();renderNotificationCenter()}
    toast("No fue posible sincronizar la lectura de la notificación");return false;
  }
}
async function markAllNotificationsRead(){
  const keys=notifications.filter(n=>!n.read).map(n=>String(n.key)).filter(Boolean);
  if(!keys.length)return true;
  const previous=new Set(keys);notifications.forEach(n=>{if(previous.has(String(n.key)))n.read=true});persistNotifications();renderNotificationCenter();
  try{await AleAPI.markAllNotificationsRead(keys,token);return true}catch(err){
    console.warn("notificationReadAll",err);
    notifications.forEach(n=>{if(previous.has(String(n.key)))n.read=false});persistNotifications();renderNotificationCenter();
    toast("No fue posible sincronizar las notificaciones");return false;
  }
}
async function migrateLocalReadStateOnce(){
  const uid=notificationUserId();if(!uid||!token)return;
  const flag=`${NOTIFY_READ_MIGRATION_PREFIX}:${uid}`;if(localStorage.getItem(flag)==="1")return;
  const keys=notifications.filter(n=>n.read).map(n=>String(n.key)).filter(Boolean);
  try{if(keys.length)await AleAPI.markAllNotificationsRead(keys,token);localStorage.setItem(flag,"1")}catch(err){console.warn("notification read migration",err)}
}
function addIncomingNotification(kind,item,serverReadKeys){
  const suffix=kind==="payment"?String(item.fecha_pago||item.updated_at||"paid"):"";
  const key=`${kind}:${item.id}${suffix?":"+suffix:""}`;if(notifications.some(n=>n.key===key))return false;
  const isOrder=kind==="order",isPayment=kind==="payment",isTransfer=kind==="transfer";const name=String(item.nombre||"Cliente"),reqNumber=item.numero_solicitud||"",orderNumber=item.numero_pedido||item.id||"";
  const alreadyRead=serverReadKeys instanceof Set&&serverReadKeys.has(key);
  const n={key,kind,view:isOrder||isPayment||isTransfer?"orders":"requests",id:item.id,at:item.fecha_pago||item.updated_at||item.fecha||new Date().toISOString(),read:alreadyRead,title:isPayment?"Pago confirmado":isTransfer?"Comprobante de transferencia":isOrder?"Nuevo pedido":"Nueva solicitud",message:isTransfer?`${orderNumber} · ${name} · comprobante pendiente de revisión`:isPayment?`${orderNumber} · ${name} · ${money(item.total||0)}`:isOrder?`${orderNumber} · ${name} · ${money(item.total||0)}`:`${reqNumber?reqNumber+" · ":""}${name} · ${item.tipo||"Solicitud web"}`};
  notifications.unshift(n);persistNotifications();renderNotificationCenter();
  // Una alerta ya leída en otro dispositivo se incorpora al historial, pero no vuelve a interrumpir al usuario.
  if(!alreadyRead){showNotificationCard(n);speakNotification(isTransfer?`Comprobante de transferencia recibido para el pedido ${orderNumber}`:isPayment?`Pago confirmado del pedido ${orderNumber} por ${money(item.total||0)}`:isOrder?`Nuevo pedido recibido de ${name}`:`Nueva solicitud recibida de ${name}`)}
  return true;
}
function mergeIncomingFeed(feed){
  const serverReadKeys=new Set((feed?.readKeys||feed?.read_keys||[]).map(String));
  applyServerReadKeys([...serverReadKeys]);
  let changed=false,paymentChanged=false;
  for(const o of feed.orders||[]){
    const ix=data.orders.findIndex(x=>String(x.id)===String(o.id));const prev=ix>=0?data.orders[ix]:null;const prevPay=String(prev?.estado_pago||"").toUpperCase();
    if(ix<0){data.orders.unshift(o);changed=addIncomingNotification("order",o,serverReadKeys)||changed}else{data.orders[ix]={...prev,...o};changed=true}
    if(String(o.estado_pago||"").toUpperCase()==="PAGADO"){if(prevPay!=="PAGADO")paymentChanged=true;changed=addIncomingNotification("payment",o,serverReadKeys)||changed}
    if(String(o.comprobante_pago_estado||"").toUpperCase()==="PENDIENTE_REVISION"&&String(prev?.comprobante_pago_estado||"").toUpperCase()!=="PENDIENTE_REVISION")changed=addIncomingNotification("transfer",o,serverReadKeys)||changed;
  }
  for(const r of feed.requests||[]){const ix=data.requests.findIndex(x=>String(x.id)===String(r.id));if(ix<0){data.requests.unshift(r);changed=addIncomingNotification("request",r,serverReadKeys)||changed}else data.requests[ix]={...data.requests[ix],...r}}
  if(changed){renderOrders();renderRequests();$("#kpiOrders").textContent=data.orders.filter(x=>String(x.estado).toUpperCase()==="PENDIENTE").length;$("#kpiRequests").textContent=data.requests.filter(x=>String(x.estado).toUpperCase()==="NUEVA").length}
  if(paymentChanged){reportAnalytics=null;renderDashboardSalesSnapshot();if($("#view-reports")?.classList.contains("active"))loadReports(true).catch(err=>console.warn("report refresh after payment",err))}
}
async function pollNotifications(){
  if(!token||notifyBusy||document.body.classList.contains("login-open"))return;
  notifyBusy=true;
  try{
    const cursorKey=notificationCursorKey();
    let since=localStorage.getItem(cursorKey)||"";
    if(!since){since=new Date(Date.now()-24*60*60*1000).toISOString();localStorage.setItem(cursorKey,since)}
    const feed=await AleAPI.notificationFeed(since,token);
    mergeIncomingFeed(feed||{});
    if(feed?.serverTime)localStorage.setItem(cursorKey,feed.serverTime);
  }catch(err){console.warn("notificationFeed",err)}finally{notifyBusy=false}
}
function startNotificationWatcher(){
  stopNotificationWatcher();loadNotificationCache();renderNotificationCenter();migrateLocalReadStateOnce();
  const cursorKey=notificationCursorKey();if(!localStorage.getItem(cursorKey))localStorage.setItem(cursorKey,new Date(Date.now()-24*60*60*1000).toISOString());
  notifyTimer=setInterval(pollNotifications,5000);setTimeout(pollNotifications,700);
}
function stopNotificationWatcher(){if(notifyTimer){clearInterval(notifyTimer);notifyTimer=null}}

$("#notificationBell")?.addEventListener("click",e=>{e.stopPropagation();setNotificationPanel($("#notificationPanel").classList.contains("hidden"))});
$("#closeNotifications")?.addEventListener("click",()=>setNotificationPanel(false));
$("#markAllNotifications")?.addEventListener("click",()=>{markAllNotificationsRead()});
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
  if(String(r.user?.rol||"").toUpperCase()==="MAYORISTA"){
    // R9.18.53: Mayoristas usa un acceso independiente. Nunca conservar su sesión como token de cPanel.
    clearAdminToken();
    localStorage.setItem("aleMayoristaToken",r.token);
    location.href="mayoristas.html";
    return r;
  }
  persistAdminToken(r.token);
  localStorage.setItem("aleAdminUser",String(username||"admin"));
  if(r.user) data.currentUser=r.user;
  if(r.permissions) data.permissions=r.permissions;

  // R9 Supabase: entrar al cPanel inmediatamente después de validar credenciales.
  // La carga pesada del dashboard ocurre después y ya no bloquea el login.
  showAdmin();
  renderSessionHeader(r.user);
  reload().catch(err=>console.warn("admin reload",err)).finally(()=>startNotificationWatcher());
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
    priceLists:Array.isArray(src.priceLists)?src.priceLists:(Array.isArray(data.priceLists)?data.priceLists:[]),
    priceListItems:Array.isArray(src.priceListItems)?src.priceListItems:(Array.isArray(data.priceListItems)?data.priceListItems:[]),
    wholesalers:Array.isArray(src.wholesalers)?src.wholesalers:(Array.isArray(data.wholesalers)?data.wholesalers:[]),
    wholesaleRequests:Array.isArray(src.wholesaleRequests)?src.wholesaleRequests:(Array.isArray(data.wholesaleRequests)?data.wholesaleRequests:[]),
    wholesaleUsers:Array.isArray(src.wholesaleUsers)?src.wholesaleUsers:(Array.isArray(data.wholesaleUsers)?data.wholesaleUsers:[]),
    wholesaleDocuments:Array.isArray(src.wholesaleDocuments)?src.wholesaleDocuments:(Array.isArray(data.wholesaleDocuments)?data.wholesaleDocuments:[]),
    wholesaleNotifications:Array.isArray(src.wholesaleNotifications)?src.wholesaleNotifications:(Array.isArray(data.wholesaleNotifications)?data.wholesaleNotifications:[]),
    suppliers:Array.isArray(src.suppliers)?src.suppliers:(Array.isArray(data.suppliers)?data.suppliers:[]),
    supplies:Array.isArray(src.supplies)?src.supplies:(Array.isArray(data.supplies)?data.supplies:[]),
    purchases:Array.isArray(src.purchases)?src.purchases:(Array.isArray(data.purchases)?data.purchases:[]),
    purchaseItems:Array.isArray(src.purchaseItems)?src.purchaseItems:(Array.isArray(data.purchaseItems)?data.purchaseItems:[]),
    gallery:Array.isArray(src.gallery)?src.gallery:(Array.isArray(data.gallery)?data.gallery:[]),
    config:(src.config&&typeof src.config==="object")?src.config:(data.config||{}),
    currentUser:src.currentUser||data.currentUser||null
  };
}
const ADMIN_CORE_MODULES=["products","categories","banners","config"];
const ADMIN_SECONDARY_MODULES=["orders","requests","quotes","clients","users","wholesale","suppliers","inventory","gallery"];
const ADMIN_DATA_MODULES=[...ADMIN_CORE_MODULES,...ADMIN_SECONDARY_MODULES];
let adminModulesRetryTimer=null,adminReloadPromise=null,adminRetryAttempt=0;
const adminRetryModules=new Set();
let adminModuleCapability=null; // null=sin comprobar, true=nuevo backend, false=compatibilidad R9.15.0/R9.15.1
function setSyncState(state,message=""){
  const pill=$("#syncPill"),txt=$("#syncPillText");
  if(pill){pill.dataset.state=state||"ok";pill.classList.toggle("syncing",state==="syncing");pill.classList.toggle("warning",state==="warning")}
  if(txt)txt.textContent=message||(state==="syncing"?"Sincronizando":state==="warning"?"Conexión intermitente":"Conectado");
}
function isUnsupportedAdminModuleError(err){
  if(typeof AleAPI?.isUnsupportedActionError==="function"&&AleAPI.isUnsupportedActionError(err))return true;
  const code=sessionErrorCode(err);
  return ["ACCION_NO_VALIDA","MODULO_ADMIN_NO_VALIDO","ADMINMODULE_NO_DISPONIBLE"].some(x=>code.includes(x));
}
async function mapWithConcurrency(items,limit,worker){
  const out=new Array(items.length);let cursor=0;
  async function runner(){
    while(true){
      const i=cursor++;if(i>=items.length)return;
      try{out[i]={status:"fulfilled",value:await worker(items[i],i)}}
      catch(reason){out[i]={status:"rejected",reason}}
    }
  }
  await Promise.all(Array.from({length:Math.min(Math.max(1,limit),items.length||1)},runner));
  return out;
}
function scheduleAdminRetry(failed=[]){
  (failed.length?failed:ADMIN_DATA_MODULES).forEach(m=>adminRetryModules.add(m));
  // Un único temporizador acumula pendientes de núcleo y módulos secundarios.
  // Así una carga secundaria exitosa no cancela el reintento de Productos/Config, etc.
  if(adminModulesRetryTimer)return;
  const delay=Math.min(30000,2500*Math.max(1,2**Math.min(adminRetryAttempt,3)));
  adminRetryAttempt++;
  adminModulesRetryTimer=setTimeout(()=>{
    adminModulesRetryTimer=null;
    const modules=[...adminRetryModules];adminRetryModules.clear();
    loadAdminModules({modules:modules.length?modules:ADMIN_DATA_MODULES,retry:true}).catch(e=>{
      if(isDefinitiveSessionError(e)){clearAdminToken();showLogin("La sesión venció o fue cerrada. Ingresa nuevamente.")}
      else console.warn("admin retry",e);
    });
  },delay);
}
async function loadLegacyAdminBootstrap(){
  setSyncState("syncing","Sincronizando");
  const legacy=await AleAPI.adminBootstrap(token,{});
  data=normalizePanelData(legacy||{});
  if(legacy?.permissions)data.permissions=legacy.permissions;
  if(legacy?.currentUser)data.currentUser=legacy.currentUser;
  renderAll();
  renderSessionHeader(data.currentUser);
  adminModuleCapability=false;
  adminRetryAttempt=0;
  if(adminModulesRetryTimer){clearTimeout(adminModulesRetryTimer);adminModulesRetryTimer=null}
  adminRetryModules.clear();
  setSyncState("ok","Conectado");
  return{ok:true,failed:[],loaded:ADMIN_DATA_MODULES.length,compatibility:true};
}
async function loadAdminModules({modules=ADMIN_DATA_MODULES,retry=true}={}){
  const list=[...new Set(modules.filter(m=>ADMIN_DATA_MODULES.includes(m)))];
  if(!list.length)return{ok:true,failed:[]};

  // Compatibilidad automática: si el servidor aún es R9.15.0/R9.15.1,
  // usamos el adminbootstrap clásico en vez de dejar el cPanel sin datos.
  if(adminModuleCapability===false){
    try{return await loadLegacyAdminBootstrap()}catch(err){
      if(isDefinitiveSessionError(err))throw err;
      setSyncState("warning","Reconectando");
      if(retry)scheduleAdminRetry(list);
      return{ok:false,failed:list,loaded:0,compatibility:true,error:err};
    }
  }

  setSyncState("syncing","Sincronizando");
  // Limitar concurrencia evita ráfagas de 9-18 solicitudes simultáneas a la Edge Function.
  const results=await mapWithConcurrency(list,3,module=>AleAPI.adminModuleReliable(module,token,2));
  const failed=[],definitive=[];let unsupported=false,loaded=0;
  results.forEach((res,i)=>{
    const module=list[i];
    if(res.status==="fulfilled"){
      loaded++;adminModuleCapability=true;data=normalizePanelData(res.value||{});
      if(res.value?.permissions)data.permissions=res.value.permissions;
      if(res.value?.currentUser)data.currentUser=res.value.currentUser;
    }else{
      failed.push(module);console.warn(`adminModule:${module}`,res.reason);
      if(isDefinitiveSessionError(res.reason))definitive.push(res.reason);
      if(isUnsupportedAdminModuleError(res.reason))unsupported=true;
    }
  });

  if(definitive.length)throw definitive[0];
  if(unsupported){
    adminModuleCapability=false;
    try{return await loadLegacyAdminBootstrap()}catch(err){
      if(isDefinitiveSessionError(err))throw err;
      setSyncState("warning","Reconectando");
      if(retry)scheduleAdminRetry(list);
      return{ok:false,failed:list,loaded:0,compatibility:true,error:err};
    }
  }

  renderAll();
  renderSessionHeader(data.currentUser);
  // Quitar de la cola únicamente los módulos que esta ejecución sí recuperó.
  list.forEach(m=>{if(!failed.includes(m))adminRetryModules.delete(m)});
  if(failed.length){
    setSyncState("warning",`Sincronizando ${failed.length} módulo${failed.length===1?"":"s"}`);
    if(retry)scheduleAdminRetry(failed);
  }else if(adminRetryModules.size===0){
    adminRetryAttempt=0;setSyncState("ok","Conectado");
  }
  return{ok:failed.length===0,failed,loaded};
}
async function reload(){
  // Production Ready: primero núcleo, luego datos secundarios en segundo plano.
  // Una falla parcial jamás invalida login/sesión.
  if(adminReloadPromise)return adminReloadPromise;
  adminReloadPromise=(async()=>{
    try{
      const core=await loadAdminModules({modules:ADMIN_CORE_MODULES,retry:true});
      if(adminModuleCapability===false)return core; // el fallback clásico ya cargó todo.
      // Pedidos/Solicitudes/Cotizaciones/Clientes/Usuarios no bloquean la entrada.
      loadAdminModules({modules:ADMIN_SECONDARY_MODULES,retry:true}).catch(err=>{
        if(isDefinitiveSessionError(err)){clearAdminToken();showLogin("La sesión venció o fue cerrada. Ingresa nuevamente.")}
        else console.warn("secondary admin modules",err);
      });
      return core;
    }finally{adminReloadPromise=null}
  })();
  return adminReloadPromise;
}
function renderSessionHeader(user){
  const me=user||data.currentUser||{};
  if($("#currentUserAvatar")) $("#currentUserAvatar").src=me.profile_url||"favicon.png";
  if($("#currentUserName")) $("#currentUserName").textContent=me.nombre||me.usuario||"Usuario";
  if($("#currentUserRole")){const rm={ADMIN:"Administrador",GERENCIA:"Gerencia",OPERADOR:"Operador",EDITOR:"Editor",LECTURA:"Lectura",MAYORISTA:"Mayorista"};$("#currentUserRole").textContent=rm[String(me.rol||"EDITOR").toUpperCase()]||String(me.rol||"Editor");}
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

function renderDashboardSalesSnapshot(){
  const paid=(data.orders||[]).filter(o=>String(o.estado_pago||"").toUpperCase()==="PAGADO");const today=new Date();const sameDay=v=>{const d=new Date(v);return d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth()&&d.getDate()===today.getDate()};const sameMonth=v=>{const d=new Date(v);return d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth()};
  const day=paid.filter(o=>sameDay(o.fecha_pago||o.fecha)).reduce((a,o)=>a+Number(o.total||0),0),month=paid.filter(o=>sameMonth(o.fecha_pago||o.fecha)).reduce((a,o)=>a+Number(o.total||0),0);
  if($("#dashboardSalesToday"))$("#dashboardSalesToday").textContent=money(day);if($("#dashboardSalesMonth"))$("#dashboardSalesMonth").textContent=money(month);
}
function renderAll(){
  data=normalizePanelData(data);
  $("#adminLogo").src=(data.config&&data.config.logo_url)||"logo-ale-atencio.png";
  const me=data.currentUser||{};
  $("#currentUserAvatar").src=me.profile_url||"favicon.png";
  $("#currentUserName").textContent=me.nombre||me.usuario||"Usuario";
  $("#currentUserRole").textContent=String(me.rol||"EDITOR").toUpperCase()==="ADMIN"?"Administrador":"Editor";
  const isAdmin=String(me.rol||"").toUpperCase()==="ADMIN";
  $("#usersNavBtn").classList.toggle("hidden-role",!isAdmin);
  $("#kpiProducts").textContent=data.products.length;
  $("#kpiOrders").textContent=data.orders.filter(x=>String(x.estado).toUpperCase()==="PENDIENTE").length;
  $("#kpiRequests").textContent=data.requests.filter(x=>String(x.estado).toUpperCase()==="NUEVA").length;
  $("#kpiStock").textContent=data.products.reduce((s,p)=>s+Number(p.stock||0),0);
  $("#dashboardSummary").innerHTML=`<div class="summary-row"><span>Productos destacados</span><strong>${data.products.filter(p=>String(p.destacado).toUpperCase()==="SI").length}</strong></div><div class="summary-row"><span>Categorías activas</span><strong>${data.categories.length}</strong></div><div class="summary-row"><span>Banners activos</span><strong>${data.banners.length}</strong></div><div class="summary-row"><span>Total pedidos</span><strong>${data.orders.length}</strong></div><div class="summary-row"><span>Cotizaciones</span><strong>${data.quotes.length}</strong></div>`;
  fillCategorySelects();renderProducts();renderCategories();renderBanners();renderOrders();renderRequests();renderQuotes();renderClients();renderDashboardSalesSnapshot();renderReports();renderUsers();renderIntegrations();renderPayments();renderSettings();renderWholesale();renderSuppliers();renderInventory();renderGallery();
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

// R9.18.6 · Montos siempre lineales en todos los módulos/tablas del cPanel.
const MONEY_COLUMN_TOKENS=["total","subtotal","precio","p unitario","monto","valor","costo","iva","despacho","saldo","importe","total comprado"];
function adminHeaderKey(value){return normalizeText(String(value||"").replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9 ]/g," ")).replace(/\s+/g," ").trim()}
function isMoneyColumnHeader(value){const key=adminHeaderKey(value);return MONEY_COLUMN_TOKENS.some(token=>key===token||key.startsWith(token+" ")||key.endsWith(" "+token))}
function decorateMoneyColumns(scope=document){
  const tables=[];
  if(scope?.matches?.("table.admin-table"))tables.push(scope);
  if(scope?.querySelectorAll)tables.push(...scope.querySelectorAll("table.admin-table"));
  [...new Set(tables)].forEach(tbl=>{
    const headers=[...tbl.querySelectorAll("thead th")];
    headers.forEach((th,index)=>{
      if(!isMoneyColumnHeader(th.textContent))return;
      th.classList.add("money-column");
      tbl.querySelectorAll("tbody tr").forEach(tr=>tr.children[index]?.classList?.add("money-column"));
    });
  });
}
function scheduleMoneyColumns(){requestAnimationFrame(()=>decorateMoneyColumns(document))}
const moneyColumnObserver=new MutationObserver(mutations=>{
  let needsRefresh=false;
  for(const mutation of mutations){
    if(mutation.addedNodes?.length){needsRefresh=true;break}
  }
  if(needsRefresh)scheduleMoneyColumns();
});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{decorateMoneyColumns(document);moneyColumnObserver.observe(document.body,{childList:true,subtree:true})},{once:true});
else{decorateMoneyColumns(document);moneyColumnObserver.observe(document.body,{childList:true,subtree:true})}

const CPANEL_MEDIA_VERSION="20260922-r91863-portal-completo";
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

function syncProductStockVisibilityControl(){
  const input=$("#productShowStockClients"),value=$("#productShowStockClientsValue"),hint=$("#productShowStockClientsHint"),bar=$("#productStockVisibilityBar");
  if(!input)return;
  const on=yesNo(data.config?.mostrar_stock_clientes)==="SI";
  if(document.activeElement!==input)input.checked=on;
  if(value){value.textContent=input.checked?"TRUE":"FALSE";value.classList.toggle("is-true",input.checked);value.classList.toggle("is-false",!input.checked)}
  if(hint)hint.textContent=input.checked?"TRUE: la Web muestra el stock general y el stock disponible por tamaño.":"FALSE: el inventario sigue funcionando, pero el cliente solo ve producto, tamaño y precio.";
  const canWrite=data.permissions?.settings?.write!==false;
  input.disabled=!canWrite;
  if(bar)bar.classList.toggle("is-readonly",!canWrite);
}

async function saveProductStockVisibility(on){
  const input=$("#productShowStockClients");
  if(!input)return;
  input.disabled=true;
  try{
    const out=await AleAPI.post("saveConfig",{mostrar_stock_clientes:on?"SI":"NO"},token);
    data.config={...(data.config||{}),...(out?.config||{}),mostrar_stock_clientes:on?"SI":"NO"};
    if($("#sShowStockClients"))$("#sShowStockClients").checked=on;
    syncStockVisibilitySetting();
    syncProductStockVisibilityControl();
    toast(on?"✓ Stock visible para clientes":"✓ Stock oculto para clientes");
  }catch(err){
    console.warn(err);
    input.checked=!on;
    if(data.config)data.config.mostrar_stock_clientes=input.checked?"SI":"NO";
    syncProductStockVisibilityControl();
    toast("✕ No fue posible cambiar la visibilidad del stock");
  }finally{
    input.disabled=data.permissions?.settings?.write===false;
  }
}

function renderProducts(){
  syncProductStockVisibilityControl();
  const q=normalizeText($("#productSearch").value), f=$("#productFilter").value, status=$("#productStatusFilter")?.value||"";
  pruneSelection("products",data.products);
  const list=data.products.filter(p=>{const active=String(p.activo??"SI").toUpperCase()==="NO"?"NO":"SI";return normalizeText([p.nombre,p.descripcion,p.categoria_nombre,p.ocasion].filter(Boolean).join(" ")).includes(q)&&(!f||p.categoria_nombre===f)&&(!status||active===status)});
  const meta=$("#productResultsMeta");if(meta)meta.textContent=`Mostrando ${list.length} de ${data.products.length} productos${f?` · Categoría: ${f}`:""}${status?` · Estado: ${status==="SI"?"Activos":"Inactivos"}`:""}${q?` · Búsqueda: “${$("#productSearch").value.trim()}”`:""}`;
  const canDelete=!!data.permissions?.products?.delete;if(!canDelete)selectedSet("products").clear();const visibleIds=list.map(p=>String(p.id));
  const headers=canDelete?[`<span class="bulk-select-col">${bulkHeaderCheckbox("products",visibleIds)}</span>`,"Imagen","Producto","Categoría","Tamaños / precios","Stock","Control stock","Estado","Destacado","Acciones"]:["Imagen","Producto","Categoría","Tamaños / precios","Stock","Control stock","Estado","Destacado","Acciones"];
  const rows=list.map(p=>{const active=String(p.activo??"SI").toUpperCase()!=="NO",selected=selectedSet("products").has(String(p.id)),sizes=Array.isArray(p.tamanos)?p.tamanos.filter(x=>String(x.activo??"SI").toUpperCase()!=="NO"):[],sizeHtml=sizes.length?`<div class="product-size-summary">${sizes.map(z=>`<span><b>${esc(z.nombre)}</b> ${Number(z.precio||0)>0?money(z.precio):"Consultar"}</span>`).join("")}</div>`:`<span class="muted">Sin tamaños configurados</span>`,stock=sizes.length?sizes.reduce((a,z)=>a+Number(z.stock||0),0):toNumber(p.stock),allowNegative=p.permite_stock_negativo===undefined||p.permite_stock_negativo===null||p.permite_stock_negativo===true||["SI","TRUE","1","YES","ON"].includes(String(p.permite_stock_negativo??"").toUpperCase()),stockClass=stock<0?"stock-negative":stock>0?"stock-positive":"stock-zero";return `<tr class="${active?"":"product-row-inactive"} ${selected?"is-selected":""}">${canDelete?`<td class="bulk-select-col">${bulkCheckbox("products",p.id)}</td>`:""}<td class="product-image-cell">${imgTag(p.image_url)}</td><td class="product-name-cell"><strong>${esc(p.nombre)}</strong></td><td>${esc(p.categoria_nombre||"")}</td><td>${sizeHtml}</td><td class="${stockClass}">${stock}</td><td><span class="stock-control-badge ${allowNegative?"flexible":"strict"}">${allowNegative?"Flexible · permite negativo":"Estricto · bloquea"}</span></td><td><span class="product-state-badge ${active?"is-active":"is-inactive"}"><span class="product-state-dot" aria-hidden="true"></span>${active?"Activo":"Inactivo"}</span></td><td>${String(p.destacado).toUpperCase()==="SI"?"Sí":"No"}</td><td><div class="row-actions"><button type="button" data-edit-product="${esc(p.id)}">Editar</button><button type="button" data-stock-product="${esc(p.id)}">Inventario</button>${canDelete?`<button type="button" class="danger" data-delete-product="${esc(p.id)}">Eliminar</button>`:""}</div></td></tr>`}).join("");
  $("#productsTable").innerHTML=table(headers,rows);updateBulkBar("products");syncSelectedRows($("#productsTable"));
}
let productPreviewObjectUrl="";
function revokeProductPreviewObjectUrl(){
  if(productPreviewObjectUrl){
    try{URL.revokeObjectURL(productPreviewObjectUrl)}catch(_){}
    productPreviewObjectUrl="";
  }
}
function standardProductSizes(){return ["Pequeña","Mediana","Grande"].map((nombre,i)=>({id:"",nombre,precio:0,stock:0,orden:i+1,activo:"SI"}))}
function productEditorSizes(source){const rows=Array.isArray(source)&&source.length?source:standardProductSizes();return rows.map((x,i)=>({id:String(x.id||""),nombre:String(x.nombre||""),precio:parseClpAmount(x.precio),stock:toNumber(x.stock),orden:Number(x.orden||i+1),activo:String(x.activo??"SI").toUpperCase()==="NO"?"NO":"SI"}))}
function renderProductSizeEditor(source){const box=$("#productSizesEditor");if(!box)return;const rows=productEditorSizes(source);box.innerHTML=rows.map((x,i)=>`<div class="product-size-row" data-size-id="${esc(x.id)}"><span class="product-size-order">${i+1}</span><label><small>Tamaño</small><input class="pSizeName" value="${esc(x.nombre)}" placeholder="Ej. Pequeña"></label><label><small>Precio CLP</small><input class="pSizePrice" type="text" inputmode="numeric" value="${new Intl.NumberFormat("es-CL",{maximumFractionDigits:0}).format(Number(x.precio||0))}" placeholder="0"></label><label><small>Stock</small><input class="pSizeStock" type="number" step="1" value="${Number(x.stock||0)}"></label><label class="product-size-active"><small>Estado</small><select class="pSizeActive"><option value="SI" ${x.activo!=="NO"?"selected":""}>Activo</option><option value="NO" ${x.activo==="NO"?"selected":""}>Inactivo</option></select></label><button type="button" class="product-size-remove" data-remove-size title="Quitar tamaño" aria-label="Quitar tamaño">×</button></div>`).join("");syncProductBaseFromSizes()}
function collectProductSizes(){return $$("#productSizesEditor .product-size-row").map((row,i)=>({id:row.dataset.sizeId||"",nombre:row.querySelector(".pSizeName")?.value.trim()||"",precio:parseClpAmount(row.querySelector(".pSizePrice")?.value),stock:toNumber(row.querySelector(".pSizeStock")?.value),orden:i+1,activo:row.querySelector(".pSizeActive")?.value||"SI"})).filter(x=>x.nombre)}
function syncProductBaseFromSizes(){const sizes=collectProductSizes().filter(x=>x.activo!=="NO"),prices=sizes.map(x=>Number(x.precio||0)).filter(x=>x>0);if($("#pPrice"))$("#pPrice").value=prices.length?Math.min(...prices):0;if($("#pStock"))$("#pStock").value=sizes.reduce((a,x)=>a+Number(x.stock||0),0)}
function addProductSizeRow(){const rows=collectProductSizes();rows.push({id:"",nombre:"",precio:0,stock:0,orden:rows.length+1,activo:"SI"});renderProductSizeEditor(rows);const inputs=$$("#productSizesEditor .pSizeName");inputs.at(-1)?.focus();renderProductWebPreview()}
function renderProductIngredientEditor(source){
  const box=$("#productIngredientsEditor");if(!box)return;const rows=Array.isArray(source)?source:[];
  const opts=(data.supplies||[]).filter(x=>String(x.activo??"SI").toUpperCase()!=="NO").map(x=>`<option value="${esc(x.id)}">${esc(x.nombre)} · ${esc(x.unidad||"UNIDAD")} · ${money(x.costo_promedio||0)}</option>`).join("");
  box.innerHTML=rows.map((x,i)=>`<div class="product-ingredient-row"><span class="product-size-order">${i+1}</span><label><small>Insumo</small><select class="pIngredientSupply"><option value="">Seleccionar</option>${opts}</select></label><label><small>Cantidad</small><input class="pIngredientQty" type="number" min="0" step="0.001" value="${Number(x.cantidad||0)}"></label><label><small>Notas</small><input class="pIngredientNotes" value="${esc(x.notas||"")}" placeholder="Opcional"></label><button type="button" class="product-size-remove" data-remove-ingredient aria-label="Quitar ingrediente">×</button></div>`).join("");
  [...box.querySelectorAll(".product-ingredient-row")].forEach((row,i)=>{const sel=row.querySelector(".pIngredientSupply");if(sel)sel.value=String(rows[i]?.insumo_id||"")});updateProductEstimatedCost();
}
function collectProductIngredients(){return $$("#productIngredientsEditor .product-ingredient-row").map((row,i)=>({insumo_id:row.querySelector(".pIngredientSupply")?.value||"",cantidad:Math.max(0,Number(row.querySelector(".pIngredientQty")?.value||0)),notas:row.querySelector(".pIngredientNotes")?.value.trim()||"",orden:i+1})).filter(x=>x.insumo_id&&x.cantidad>0)}
function updateProductEstimatedCost(){const total=collectProductIngredients().reduce((sum,x)=>{const ins=(data.supplies||[]).find(i=>String(i.id)===String(x.insumo_id));return sum+Number(x.cantidad||0)*Number(ins?.costo_promedio||0)},0);if($("#productEstimatedCost"))$("#productEstimatedCost").textContent=money(total)}
function addProductIngredientRow(){const rows=collectProductIngredients();rows.push({insumo_id:"",cantidad:1,notas:""});renderProductIngredientEditor(rows)}

function productEditorSnapshot(imageOverride=""){
  return {
    id:$("#pId")?.value||"",
    nombre:$("#pName")?.value.trim()||"Producto sin nombre",
    descripcion:$("#pDescription")?.value.trim()||"Agrega una descripción para mostrarla en la tienda.",
    precio:parseClpAmount($("#pPrice")?.value),
    categoria_nombre:$("#pCategory")?.value||"Categoría",
    stock:toNumber($("#pStock")?.value),
    permite_stock_negativo:!!$("#pAllowNegativeStock")?.checked,
    tamanos:collectProductSizes(),
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
  const box=$("#productWebPreview");if(!box)return;const p=productOverride||productEditorSnapshot(productPreviewObjectUrl),active=String(p.activo??"SI").toUpperCase()!=="NO",src=productPreviewMediaUrl(p.image_url),sizes=productEditorSizes(p.tamanos).filter(x=>x.activo!=="NO"),selected=sizes[0]||null,price=Number(selected?.precio??p.precio??0),priced=price>0;box.classList.toggle("is-inactive",!active);const media=src?`<img src="${esc(src)}" alt="${esc(p.nombre)}">`:`<span>${productPreviewFallback(p)}</span>`,badge=String(p.destacado).toUpperCase()==="SI"?'<span class="product-preview-badge">Destacado</span>':"";box.innerHTML=`<div class="product-preview-media">${media}${badge}<span class="product-preview-status">${active?"Activo":"Inactivo"}</span></div><div class="product-preview-body"><small>${esc(p.categoria_nombre||"Categoría")}</small><h4>${esc(p.nombre||"Producto sin nombre")}</h4><p>${esc(p.descripcion||"Agrega una descripción para mostrarla en la tienda.")}</p>${sizes.length?`<div class="product-preview-sizes">${sizes.map((z,i)=>`<span class="${i===0?"active":""}">${esc(z.nombre)}</span>`).join("")}</div><div class="product-preview-size-caption">Tamaño: <strong>${esc(selected?.nombre||"")}</strong></div>`:""}<div class="product-preview-bottom"><span class="product-preview-price">${priced?money(price):"Consultar"}</span><button type="button" class="product-preview-action" ${active?"":"disabled"}>${active?(priced?"Agregar":"Consultar"):"No disponible"}</button></div></div>`;const idLabel=$("#productEditorIdLabel");if(idLabel)idLabel.textContent=p.id?`ID ${p.id} · conectado al catálogo Web`:"Producto nuevo · se generará un ID al guardar";
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
    renderProductSizeEditor(Array.isArray(p.tamanos)&&p.tamanos.length?p.tamanos:standardProductSizes());
    renderProductIngredientEditor(Array.isArray(p.ingredientes)?p.ingredientes:[]);
    $("#pActive").value=String(p.activo??"SI").toUpperCase()==="NO"?"NO":"SI";
    if($("#pAllowNegativeStock"))$("#pAllowNegativeStock").checked=p.permite_stock_negativo===undefined||p.permite_stock_negativo===null||p.permite_stock_negativo===true||["SI","TRUE","1","YES","ON"].includes(String(p.permite_stock_negativo??"").toUpperCase());
    updateProductStatusHint();updateStockPolicyHint();
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
window.saveQuickPrice=async(id,btn)=>busy(btn,async()=>{const input=$("#price-"+CSS.escape(String(id)));if(!input)return;const precio=parseClpAmount(input.value);if(!Number.isFinite(precio)||precio<0){toast("Precio no válido");return}try{await AleAPI.savePriceVerified({id,precio},token);const p=data.products.find(x=>String(x.id)===String(id));if(p)p.precio=precio;input.value=precio;toast("✓ Precio actualizado")}catch(e){console.warn(e);toast("✕ No se confirmó el cambio de precio")}});
$("#productsTable").addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit-product]"); if(edit){openProductEditor(edit.dataset.editProduct);return}
  const stock=e.target.closest("[data-stock-product]"); if(stock){openProductStockEditor(stock.dataset.stockProduct);return}
  const save=e.target.closest("[data-save-price]"); if(save){window.saveQuickPrice(save.dataset.savePrice,save);return}
  const del=e.target.closest("[data-delete-product]"); if(del){window.removeEntity("product",del.dataset.deleteProduct,del);return}
});
$("#productsTable").addEventListener("change",e=>{
  if(handleBulkCheckboxChange(e))return;
  const all=e.target.closest('input[data-bulk-select-all="products"]');if(all){const ids=data.products.filter(p=>{const q=normalizeText($("#productSearch").value),f=$("#productFilter").value,status=$("#productStatusFilter")?.value||"",active=String(p.activo??"SI").toUpperCase()==="NO"?"NO":"SI";return normalizeText([p.nombre,p.descripcion,p.categoria_nombre,p.ocasion].filter(Boolean).join(" ")).includes(q)&&(!f||p.categoria_nombre===f)&&(!status||active===status)}).map(p=>String(p.id));handleBulkSelectAllChange(e,ids);renderProducts()}
});
$("#deleteSelectedProducts")?.addEventListener("click",e=>deleteSelected("products",e.currentTarget));
["pName","pPrice","pCategory","pStock","pActive","pOccasion","pDescription","pFeatured","pAllowNegativeStock"].forEach(id=>{
  const el=$("#"+id); if(!el)return;
  const eventName=(id==="pFeatured"||id==="pActive"||id==="pCategory"||id==="pAllowNegativeStock")?"change":"input";
  el.addEventListener(eventName,()=>{if(id==="pActive")updateProductStatusHint();if(id==="pAllowNegativeStock")updateStockPolicyHint();renderProductWebPreview()});
});
$("#pImage")?.addEventListener("change",()=>{
  revokeProductPreviewObjectUrl();
  const file=$("#pImage")?.files?.[0];
  if(file){productPreviewObjectUrl=URL.createObjectURL(file);renderProductImageSource("",{pending:true})}
  else renderProductImageSource($("#pImageUrl")?.value||"");
  renderProductWebPreview(productEditorSnapshot(productPreviewObjectUrl));
});
$("#addProductSize")?.addEventListener("click",addProductSizeRow);
$("#productSizesEditor")?.addEventListener("input",()=>{syncProductBaseFromSizes();renderProductWebPreview()});
$("#productSizesEditor")?.addEventListener("change",()=>{syncProductBaseFromSizes();renderProductWebPreview()});
$("#productSizesEditor")?.addEventListener("click",e=>{const b=e.target.closest("[data-remove-size]");if(!b)return;const row=b.closest(".product-size-row");if(!row)return;const rows=collectProductSizes(),domRows=[...$("#productSizesEditor").querySelectorAll(".product-size-row")],idx=domRows.indexOf(row);if(rows.length<=1){toast("Debe existir al menos un tamaño");return}if(idx>=0)rows.splice(idx,1);renderProductSizeEditor(rows);renderProductWebPreview()});
$("#addProductIngredient")?.addEventListener("click",addProductIngredientRow);
$("#productIngredientsEditor")?.addEventListener("input",updateProductEstimatedCost);
$("#productIngredientsEditor")?.addEventListener("change",updateProductEstimatedCost);
$("#productIngredientsEditor")?.addEventListener("click",e=>{const b=e.target.closest("[data-remove-ingredient]");if(!b)return;b.closest(".product-ingredient-row")?.remove();updateProductEstimatedCost()});
$("#productSearch").addEventListener("input",renderProducts);$("#productFilter").addEventListener("change",renderProducts);$("#productStatusFilter")?.addEventListener("change",renderProducts);
$("#clearProductFilter")?.addEventListener("click",()=>{$("#productSearch").value="";$("#productFilter").value="";if($("#productStatusFilter"))$("#productStatusFilter").value="";renderProducts()});
$("#productShowStockClients")?.addEventListener("change",e=>saveProductStockVisibility(!!e.currentTarget.checked));
$("#newProduct").addEventListener("click",()=>openProductEditor());
function updateProductStatusHint(){const select=$("#pActive"),hint=$("#pActiveHint");if(!select||!hint)return;const active=select.value!=="NO";hint.textContent=active?"Activo: el producto se muestra y puede comprarse en la Web.":"Inactivo: el producto se oculta y no puede comprarse en la Web.";hint.classList.toggle("is-inactive",!active)}
function updateStockPolicyHint(){const input=$("#pAllowNegativeStock"),hint=$("#pAllowNegativeStockHint"),label=$("#pAllowNegativeStockLabel");if(!input||!hint)return;const on=!!input.checked;if(label)label.textContent=on?"Permitir venta sin stock":"Bloquear venta sin stock";hint.textContent=on?"Activado: la venta continúa aunque el stock llegue a 0 o quede negativo.":"Desactivado: si no existe stock suficiente, el pedido se bloquea antes de cobrar.";hint.classList.toggle("is-inactive",!on)}
$("#pActive")?.addEventListener("change",updateProductStatusHint);
$("#pAllowNegativeStock")?.addEventListener("change",updateStockPolicyHint);
function clearProduct(){revokeProductPreviewObjectUrl();["pId","pImageId","pImageUrl","pOrder","pName","pPrice","pStock","pOccasion","pDescription"].forEach(id=>$("#"+id).value="");$("#pFeatured").checked=false;if($("#pActive"))$("#pActive").value="SI";if($("#pAllowNegativeStock"))$("#pAllowNegativeStock").checked=true;renderProductSizeEditor(standardProductSizes());renderProductIngredientEditor([]);updateProductStatusHint();updateStockPolicyHint();resetFilePicker("#pImage");renderProductImageSource("");renderProductWebPreview()}
$("#closeProductEditorX")?.addEventListener("click",closeProductEditor);
$("#saveProduct").addEventListener("click",e=>busy(e.currentTarget,async()=>{try{let imageId=$("#pImageId").value,imageUrl=$("#pImageUrl").value;const file=$("#pImage").files[0];if(file){const u=await upload(file,"PRODUCTOS");imageId=u.fileId;imageUrl=u.imageUrl||imageUrl}syncProductBaseFromSizes();const tamanos=collectProductSizes();const ingredientes=collectProductIngredients();const payload={id:$("#pId").value,nombre:$("#pName").value.trim(),descripcion:$("#pDescription").value.trim(),precio:parseClpAmount($("#pPrice").value),categoria_nombre:$("#pCategory").value,stock:toNumber($("#pStock").value),tamanos,ingredientes,drive_file_id:imageId,image_url:imageUrl,destacado:$("#pFeatured").checked?"SI":"NO",activo:$("#pActive")?.value||"SI",permite_stock_negativo:!!$("#pAllowNegativeStock")?.checked,ocasion:$("#pOccasion").value.trim(),orden:toNumber($("#pOrder").value)};if(!payload.nombre){toast("El nombre es obligatorio");return}if(!tamanos.length){toast("Configura al menos un tamaño");return}const saved=await AleAPI.saveProductVerified(payload,token);const verified=await AleAPI.adminModuleReliable("products",token,2);data=normalizePanelData(verified||{});const persisted=(data.products||[]).find(x=>String(x.id)===String(saved.id||payload.id));if(!persisted)throw new Error("PRODUCTO_NO_CONFIRMADO");const expected=tamanos.map(x=>({nombre:String(x.nombre||"").trim().toLowerCase(),precio:Number(x.precio||0),stock:Number(x.stock||0),activo:String(x.activo||"SI").toUpperCase()}));const got=(persisted.tamanos||[]).map(x=>({nombre:String(x.nombre||"").trim().toLowerCase(),precio:Number(x.precio||0),stock:Number(x.stock||0),activo:String(x.activo??"SI").toUpperCase()}));const mismatch=expected.some(e=>!got.some(g=>g.nombre===e.nombre&&g.precio===e.precio&&g.stock===e.stock&&((e.activo==="NO")===(g.activo==="NO"||g.activo==="FALSE"))));if(mismatch)throw new Error("PRECIO_TAMANO_NO_PERSISTIDO");toast(file?"✓ Producto y precios por tamaño verificados · imagen guardada":"✓ Producto y precios por tamaño verificados");closeProductEditor();renderAll()}catch(err){console.warn(err);const code=String(err?.message||err||"");toast(code.includes("PRECIO_TAMANO_NO_PERSISTIDO")?"✕ El servidor no confirmó los precios por tamaño. No se marcó como guardado.":code.includes("PRODUCTO_NO_CONFIRMADO")?"✕ El producto no apareció al verificar el servidor.":"✕ No se confirmó la actualización")}}));

function stockPolicyAllowsNegative(p){const v=p?.permite_stock_negativo;if(v===undefined||v===null||String(v).trim()==="")return true;return v===true||["SI","TRUE","1","YES","ON"].includes(String(v).toUpperCase())}
function stockValueClass(v){v=Number(v||0);return v<0?"stock-negative":v>0?"stock-positive":"stock-zero"}
function stockMovementLabel(t){return ({VENTA:"Venta",INGRESO:"Ingreso",SALIDA:"Salida",AJUSTE:"Ajuste",REVERSA_CANCELACION:"Anulación / reversa"})[String(t||"").toUpperCase()]||String(t||"")}
function updateStockMovementUi(){const type=$("#stockMovementType")?.value||"INGRESO",label=$("#stockMovementValueLabel"),hint=$("#stockMovementValueHint"),input=$("#stockMovementValue");if(type==="AJUSTE"){if(label)label.textContent="Nuevo stock";if(hint)hint.textContent="Ajuste fija el stock exactamente en el valor indicado.";if(input)input.step="1"}else{if(label)label.textContent="Cantidad";if(hint)hint.textContent=type==="INGRESO"?"Ingreso suma unidades al stock actual.":"Salida descuenta unidades. Si el producto permite negativo, puede bajar de 0.";if(input){input.step="1";if(Number(input.value)<=0)input.value="1"}}updateStockCurrentHint()}
function selectedStockSize(){const p=data.products.find(x=>String(x.id)===String($("#stockProductId")?.value||""));if(!p)return null;const sid=$("#stockSizeId")?.value||"";return (Array.isArray(p.tamanos)?p.tamanos:[]).find(x=>String(x.id)===String(sid))||null}
function updateStockCurrentHint(){const p=data.products.find(x=>String(x.id)===String($("#stockProductId")?.value||"")),z=selectedStockSize(),v=Number(z?.stock??p?.stock??0),hint=$("#stockCurrentHint");if(hint){hint.className=`field-hint ${stockValueClass(v)}`;hint.textContent=`Stock actual: ${v}`}}
async function loadProductStockHistory(productId){const box=$("#productStockHistory");if(!box)return;box.innerHTML='<div class="muted">Cargando movimientos…</div>';try{const out=await AleAPI.post("productstockhistory",{producto_id:productId,limit:60},token),rows=Array.isArray(out.movements)?out.movements:[];box.innerHTML=table(["Fecha","Tipo","Tamaño","Movimiento","Stock resultante","Referencia"],rows.map(m=>{const qty=Number(m.cantidad||0),stock=Number(m.stock_resultante||0);return `<tr><td>${esc(formatDate(m.creado_en||""))}</td><td>${esc(stockMovementLabel(m.tipo))}</td><td>${esc(m.tamano_nombre||"General")}</td><td class="${qty<0?"stock-negative":qty>0?"stock-positive":"stock-zero"}">${qty>0?"+":""}${qty}</td><td class="${stockValueClass(stock)}">${stock}</td><td>${esc(m.referencia||"")}</td></tr>`}).join(""));}catch(err){console.warn(err);box.innerHTML='<div class="muted">No fue posible cargar el historial.</div>'}}
async function openProductStockEditor(id){const p=data.products.find(x=>String(x.id)===String(id));if(!p){toast("Producto no encontrado");return}$("#stockProductId").value=p.id;$("#productStockEditorTitle").textContent=`Inventario · ${p.nombre}`;const allow=stockPolicyAllowsNegative(p);$("#stockPolicySummary").innerHTML=allow?'<span class="stock-control-badge flexible">Flexible · permite negativo</span> La venta continúa aunque el stock sea 0 o negativo.':'<span class="stock-control-badge strict">Estricto · bloquea</span> La venta se detiene si el stock disponible no alcanza.';const sizes=(Array.isArray(p.tamanos)?p.tamanos:[]).filter(x=>String(x.activo??"SI").toUpperCase()!=="NO");$("#stockSizeId").innerHTML=sizes.length?sizes.map(z=>`<option value="${esc(z.id)}">${esc(z.nombre)} · stock ${Number(z.stock||0)}</option>`).join(""):'<option value="">Stock general</option>';$("#stockMovementType").value="INGRESO";$("#stockMovementValue").value="1";$("#stockMovementReference").value="";updateStockMovementUi();showEditor("productStockEditor",true);await loadProductStockHistory(p.id)}
function closeProductStockEditor(){showEditor("productStockEditor",false)}
$("#closeProductStockEditor")?.addEventListener("click",closeProductStockEditor);$("#cancelProductStockEditor")?.addEventListener("click",closeProductStockEditor);$("#stockMovementType")?.addEventListener("change",updateStockMovementUi);$("#stockSizeId")?.addEventListener("change",updateStockCurrentHint);
$("#saveProductStockMovement")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const p=data.products.find(x=>String(x.id)===String($("#stockProductId").value));if(!p)throw new Error("PRODUCTO_NO_ENCONTRADO");const type=$("#stockMovementType").value,value=Number($("#stockMovementValue").value),ref=$("#stockMovementReference").value.trim();if(type!=="AJUSTE"&&(!Number.isFinite(value)||value<=0)){toast("Ingresa una cantidad mayor que 0");return}if(type==="AJUSTE"&&!Number.isFinite(value)){toast("Ingresa el nuevo stock");return}const out=await AleAPI.post("adjustproductstock",{producto_id:p.id,tamano_id:$("#stockSizeId").value||null,tipo:type,cantidad:type==="AJUSTE"?null:value,nuevo_stock:type==="AJUSTE"?value:null,referencia:ref},token);toast(`✓ Inventario actualizado · stock ${Number(out.stock_resultante??0)}`);const verified=await AleAPI.adminModuleReliable("products",token,2);data=normalizePanelData(verified||{});renderProducts();const current=data.products.find(x=>String(x.id)===String(p.id));if(current){const sizes=(Array.isArray(current.tamanos)?current.tamanos:[]).filter(x=>String(x.activo??"SI").toUpperCase()!=="NO");$("#stockSizeId").innerHTML=sizes.length?sizes.map(z=>`<option value="${esc(z.id)}">${esc(z.nombre)} · stock ${Number(z.stock||0)}</option>`).join(""):'<option value="">Stock general</option>';updateStockCurrentHint()}await loadProductStockHistory(p.id)}catch(err){console.warn(err);const code=String(err?.message||err||"").toUpperCase();toast(code.includes("STOCK_NEGATIVO_NO_PERMITIDO")||code.includes("STOCK_INSUFICIENTE")?"✕ Este producto tiene control estricto y no puede quedar con stock negativo.":"✕ No fue posible aplicar el movimiento")}}));

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


function parseOrderLines(text){return String(text||"").split(/\n+/).map(line=>{const p=line.split("|").map(x=>x.trim());if(p.length<3)return null;const nombre=p[0],cantidad=Math.max(1,Number(p[1])||1),precio=parseClpAmount(p[2]);return nombre?{nombre,producto_nombre:nombre,cantidad,precio_unitario:precio,precio}:null}).filter(Boolean)}
function quoteIsConsumed(q){
  if(!q)return false;
  if(q._consumida||q.pedido_id)return true;
  return (data.orders||[]).some(o=>String(o.cotizacion_id||"")===String(q.id));
}
function fillOrderQuoteSelect(){
  const sel=$("#ocQuote");if(!sel)return;
  sel.innerHTML='<option value="">Pedido manual</option>'+data.quotes
    .filter(q=>!quoteIsConsumed(q)&&!["ANULADA","RECHAZADA","VENCIDA"].includes(String(q.estado||"").toUpperCase()))
    .map(q=>`<option value="${esc(q.id)}">${esc(q.numero_cotizacion||q.id)} · ${esc(q.cliente_nombre||"")} · ${money(q.total||0)}</option>`).join("");
}
function ensureOrderCreateBackdrop(){
  let backdrop=$("#orderCreateBackdrop");
  if(!backdrop){
    backdrop=document.createElement("div");
    backdrop.id="orderCreateBackdrop";
    backdrop.className="hidden";
    backdrop.setAttribute("aria-hidden","true");
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click",closeOrderCreate);
  }
  return backdrop;
}
function openOrderCreate(){
  fillOrderQuoteSelect();
  ["#ocName","#ocRut","#ocPhone","#ocEmail","#ocAddress","#ocCommune","#ocItems","#ocNotes"].forEach(x=>{if($(x))$(x).value=""});
  if($("#ocDispatch"))$("#ocDispatch").value=0;
  if($("#ocPayment"))$("#ocPayment").value="EFECTIVO";
  if($("#ocDelivery"))$("#ocDelivery").value="Retiro";
  setClientLookupState("#ocClientLookupState","Ingresa un RUT válido para buscar en Clientes.");
  const editor=$("#orderCreateEditor");if(!editor)return;
  // El modal se monta directamente en body para evitar stacking/overflow de tablas, tarjetas o sidebar.
  if(editor.parentElement!==document.body)document.body.appendChild(editor);
  ensureOrderCreateBackdrop().classList.remove("hidden");
  editor.classList.remove("hidden");
  document.body.classList.add("order-create-open");
  requestAnimationFrame(()=>{editor.scrollTop=0;$("#ocQuote")?.focus({preventScroll:true})});
}
function closeOrderCreate(){
  $("#orderCreateEditor")?.classList.add("hidden");
  $("#orderCreateBackdrop")?.classList.add("hidden");
  document.body.classList.remove("order-create-open");
}
$("#newOrder")?.addEventListener("click",openOrderCreate);
$("#closeOrderCreateX")?.addEventListener("click",closeOrderCreate);
$("#cancelOrderCreate")?.addEventListener("click",closeOrderCreate);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#orderCreateEditor")?.classList.contains("hidden"))closeOrderCreate()});
$("#ocQuote")?.addEventListener("change",async e=>{const q=data.quotes.find(x=>String(x.id)===String(e.target.value));if(!q)return;$("#ocName").value=q.cliente_nombre||"";$("#ocRut").value=q.rut?formatRutChile(q.rut):"";$("#ocPhone").value=q.telefono||"";$("#ocEmail").value=q.email||"";$("#ocNotes").value=q.observaciones||"";$("#ocItems").value=(Array.isArray(q.items)?q.items:[]).map(i=>`${i.descripcion||i.nombre||"Producto"} | ${i.cantidad||1} | ${i.precio_unitario||i.precio||0}`).join("\n");const request=data.requests.find(r=>String(r.id)===String(q.solicitud_id||""));const pref=String(q.medio_pago_preferido||request?.medio_pago_preferido||"").trim().toUpperCase();const pay=$("#ocPayment");if(pay){if(pref.includes("TRANSFER"))pay.value="TRANSFERENCIA";else if(pref.includes("TRANSBANK")||pref.includes("TARJETA")||pref.includes("WEBPAY"))pay.value="TRANSBANK";else if(pref.includes("EFECTIVO"))pay.value="EFECTIVO";}if(q.rut)await hydrateClientByRut({rutSelector:"#ocRut",statusSelector:"#ocClientLookupState",fields:{name:"#ocName",phone:"#ocPhone",email:"#ocEmail",address:"#ocAddress",commune:"#ocCommune",delivery:"#ocDelivery"},mode:"overwrite"});});
wireClientRutLookup({rutSelector:"#ocRut",statusSelector:"#ocClientLookupState",fields:{name:"#ocName",phone:"#ocPhone",email:"#ocEmail",address:"#ocAddress",commune:"#ocCommune",delivery:"#ocDelivery"}});
$("#saveOrderFromCpanel")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const detalle=parseOrderLines($("#ocItems").value);if(!detalle.length){toast("✕ Agrega al menos un producto");return}const delivery=$("#ocDelivery").value,commune=$("#ocCommune").value.trim();if(String(delivery).toUpperCase()==="DESPACHO"&&!commune){toast("✕ Ingresa la comuna para el despacho");$("#ocCommune").focus();return}const payload={cotizacion_id:$("#ocQuote").value||null,nombre:$("#ocName").value.trim(),rut:requireRutChile($("#ocRut").value),telefono:$("#ocPhone").value.trim(),email:$("#ocEmail").value.trim(),metodo_entrega:delivery,direccion:$("#ocAddress").value.trim(),comuna:commune,medio_pago:$("#ocPayment").value,despacho:parseClpAmount($("#ocDispatch").value),detalle,total:(data.quotes.find(x=>String(x.id)===String($("#ocQuote").value))?.total||0),observaciones:$("#ocNotes").value.trim()};const out=await AleAPI.post("admincreateorder",payload,token);const consumedQuoteId=String(payload.cotizacion_id||"");if(consumedQuoteId){const qix=data.quotes.findIndex(x=>String(x.id)===consumedQuoteId);if(qix>=0)data.quotes[qix]={...data.quotes[qix],estado:"UTILIZADA",pedido_id:out.order?.id||"CONSUMIDA",pedido_numero:out.order?.numero_pedido||"",_consumida:true};if(out.order?.id&&!data.orders.some(x=>String(x.id)===String(out.order.id)))data.orders.unshift({...out.order,cotizacion_id:consumedQuoteId});fillOrderQuoteSelect();renderQuotes()}toast(`✓ Pedido ${out.order?.numero_pedido||out.order?.id||""} creado`);closeOrderCreate();await loadAdminModules({modules:["orders","quotes"],retry:true});if(out.order?.id){window.openOrderDetail(out.order.id);const o=data.orders.find(x=>String(x.id)===String(out.order.id));if(o&&out.payment_link_required)o._payment_link_required=true}}catch(err){console.warn(err);const code=String(err?.message||err||"").toUpperCase();toast(code.includes("COTIZACION_YA_CONVERTIDA")?"✕ Esta cotización ya fue utilizada en un pedido y no puede reutilizarse.":code.includes("COTIZACION_NO_VIGENTE")?"✕ La cotización ya no está vigente para crear pedidos.":code.includes("TELEFONO_YA_ASOCIADO")?"✕ Ese teléfono ya está asociado a otro RUT en Clientes.":code.includes("EMAIL_YA_ASOCIADO")?"✕ Ese correo ya está asociado a otro RUT en Clientes.":"✕ No fue posible crear el pedido")}}));

window.changeCashPaymentState=async(id,next,control)=>{
  const o=data.orders.find(x=>String(x.id)===String(id));
  if(!o){toast("✕ Pedido no encontrado");renderOrders();return}
  const target=String(next||"").trim().toUpperCase();
  if(target!=="PAGADO"){renderOrders();return}
  if(isFinalOrder(o)){toast(`✕ ${orderFinalMessage(o.estado)}. El pedido está bloqueado.`);renderOrders();return}
  if(canonicalOrderPaymentMethod(o.medio_pago)!=="EFECTIVO"){toast("✕ Solo los pedidos en EFECTIVO pueden confirmarse manualmente desde este control.");renderOrders();return}
  if(String(o.estado_pago||"").toUpperCase()==="PAGADO"){toast("✓ Este pedido ya está pagado");renderOrders();return}
  const total=money(o.total);
  if(!window.confirm(`¿Marcar como PAGADO el pedido ${o.numero_pedido||o.id}?

Medio: EFECTIVO
Monto recibido: ${total}

El movimiento quedará registrado en la trazabilidad.`)){renderOrders();return}
  try{
    beginBusy(control);
    const out=await AleAPI.post("adminmarkcashpaid",{id:o.id},token);
    const ix=data.orders.findIndex(x=>String(x.id)===String(o.id));
    if(ix>=0)data.orders[ix]={...data.orders[ix],estado_pago:"PAGADO",estado:out?.estado||data.orders[ix].estado,fecha_pago:out?.fecha_pago||new Date().toISOString(),medio_pago:"EFECTIVO"};
    toast("✓ Pedido marcado como PAGADO · EFECTIVO");
    await loadAdminModules({modules:["orders","requests"],retry:true});
    renderOrders();renderRequests();reportAnalytics=null;
    if(currentOrderDetailId&&String(currentOrderDetailId)===String(o.id))await window.openOrderDetail(o.id);
  }catch(err){
    console.warn("changeCashPaymentState",err);
    const code=String(err?.message||err||"").toUpperCase();
    toast(code.includes("PEDIDO_NO_ES_EFECTIVO")?"✕ El pedido no está registrado como EFECTIVO":code.includes("PEDIDO_ESTADO_FINAL")?"✕ El pedido está finalizado y no admite cambios":code.includes("PEDIDO_YA_PAGADO")?"✓ Este pedido ya está pagado":"✕ No fue posible marcar el pedido como PAGADO");
    try{await loadAdminModules({modules:["orders"],retry:true})}catch(_){ }
    renderOrders();
  }finally{endBusy(control)}
};
function renderOrders(){
  const host=$("#ordersTable");if(!host)return;
  const normalStates=["PENDIENTE","CONFIRMADO","EN PREPARACION","LISTO","ENTREGADO"];
  const visibleOrders=filteredCommercialRows("orders",data.orders);updateCommercialFilterUi("orders",visibleOrders.length,data.orders.length);
  host.innerHTML=table(["N.º pedido","Tipo","Fecha","Cliente / RUT","Contacto","Entrega","Total","Pago","Estado","PDF","Acciones"],visibleOrders.map(o=>{
    const final=isFinalOrder(o),st=orderState(o.estado),saleType=String(o.tipo_venta||o.origen||"MINORISTA").toUpperCase()==="MAYORISTA"?"MAYORISTA":"MINORISTA";
    const statusHtml=final?`<select class="status-select is-final" disabled title="${esc(orderFinalMessage(st))}"><option selected>${esc(st)}</option></select>`:`<select class="status-select" title="${esc(st)}" onchange="this.title=this.value;changeStatus('order','${o.id}',this.value)">${normalStates.map(x=>`<option ${st===x?"selected":""}>${x}</option>`).join("")}</select>`;
    const cancelAction=final?`<span class="order-final-chip ${st==="CANCELADO"?"cancelled":""}"><i class="bi ${st==="CANCELADO"?"bi-x-octagon":"bi-check2-circle"}"></i>${st}</span>`:`<button type="button" class="cancel-order-row" onclick="openOrderCancel('${o.id}')"><i class="bi bi-x-octagon"></i> Anular</button>`;
    const paymentState=String(o.estado_pago||"PENDIENTE").trim().toUpperCase();
    const paymentMethod=canonicalOrderPaymentMethod(o.medio_pago);
    const paymentClass=paymentState==="PAGADO"?"payment-pagado":(["RECHAZADO","CANCELADO"].includes(paymentState)?"payment-rechazado":"payment-pendiente");
    const paymentControl=paymentMethod==="EFECTIVO"&&!final
      ?(paymentState==="PAGADO"
        ?`<select class="status-select payment-cash-select payment-pagado" disabled title="Pago en efectivo confirmado"><option selected>PAGADO</option></select>`
        :`<select class="status-select payment-cash-select payment-pendiente" title="Cambiar estado de pago en efectivo" onchange="changeCashPaymentState('${o.id}',this.value,this)"><option value="PENDIENTE" selected>PENDIENTE</option><option value="PAGADO">PAGADO</option></select>`)
      :`<span class="payment-status-badge ${paymentClass}" title="${esc(paymentState)}">${esc(paymentState)}</span>`;
    const fullDate=formatDate(o.fecha),dateParts=String(fullDate||"").split(","),dateMain=dateParts.shift()||"",dateTime=dateParts.join(",").trim();
    return `<tr class="order-row-clickable" data-order-id="${esc(o.id)}" tabindex="0" aria-label="Abrir detalle del pedido ${esc(o.numero_pedido||o.id)}">
    <td class="order-number-cell"><strong>${esc(o.numero_pedido||o.id)}</strong></td>
    <td class="order-type-cell"><span class="sale-type-badge ${saleType.toLowerCase()}">${saleType}</span>${saleType==="MAYORISTA"&&o.lista_precio_nombre?`<small>${esc(o.lista_precio_nombre)}</small>`:""}</td>
    <td class="order-date-cell"><span>${esc(dateMain)}</span>${dateTime?`<small>${esc(dateTime)}</small>`:""}</td>
    <td class="order-client-cell"><strong title="${esc(o.nombre||"")}">${esc(o.nombre||"")}</strong><small>${esc(o.rut?formatRutChile(o.rut):"")}</small></td>
    <td class="order-contact-cell"><span title="${esc(o.telefono||"")}">${esc(o.telefono||"")}</span><small title="${esc(o.email||"")}">${esc(o.email||"")}</small></td>
    <td class="order-delivery-cell"><span title="${esc(o.metodo_entrega||"")}">${esc(o.metodo_entrega||"")}</span><small title="${esc([o.direccion,o.comuna].filter(Boolean).join(" · ")||"")}">${esc([o.direccion,o.comuna].filter(Boolean).join(" · "))}</small></td>
    <td class="money-column"><strong>${money(o.total||0)}</strong></td>
    <td class="order-payment-cell">${paymentControl}<small title="${esc(orderPaymentMethodLabel(paymentMethod))}">${esc(orderPaymentMethodLabel(paymentMethod))}</small></td>
    <td class="order-status-cell">${statusHtml}</td>
    <td class="order-pdf-cell">${(o.pdf_url||o.pdf_path)?`<button class="pdf-link order-pdf-secure-btn" type="button" data-order-pdf="${esc(o.id)}"><i class="bi bi-file-earmark-pdf"></i> PDF</button>`:'<span class="muted-text">Pendiente</span>'}</td>
    <td class="order-actions-cell"><div class="row-actions"><button type="button" onclick="openOrderDetail('${o.id}')"><i class="bi bi-eye"></i> Ver pedido</button>${cancelAction}</div></td>
  </tr>`}).join(""));
}
async function secureOrderPdfUrl(orderId){const out=await AleAPI.post("orderpdflink",{id:String(orderId||"")},token);if(!out?.pdf_url)throw new Error("PDF_PEDIDO_NO_DISPONIBLE");return clientPublicUrl(out.pdf_url)}
async function openSecureOrderPdf(orderId,button=null){let tab=null;try{tab=window.open("about:blank","_blank");if(tab)tab.document.write('<title>Ale Atencio · PDF</title><body style="font-family:Arial,sans-serif;padding:24px">Cargando PDF seguro…</body>');const url=await secureOrderPdfUrl(orderId);if(tab)tab.location.replace(url);else window.location.href=url}catch(err){try{tab?.close()}catch(_){}console.warn("secureOrderPdf",err);toast("✕ No fue posible abrir el PDF seguro")}}
$("#ordersTable")?.addEventListener("click",e=>{
  const pdf=e.target.closest("[data-order-pdf]");
  if(pdf){e.stopPropagation();openSecureOrderPdf(pdf.dataset.orderPdf,pdf);return}
  if(e.target.closest("button,a,select,input,textarea,label,[role=button]"))return;
  const row=e.target.closest("tr[data-order-id]");
  if(row?.dataset?.orderId)window.openOrderDetail(row.dataset.orderId);
});
$("#ordersTable")?.addEventListener("keydown",e=>{
  if(e.key!=="Enter"&&e.key!==" ")return;
  if(e.target.closest("button,a,select,input,textarea,label,[role=button]"))return;
  const row=e.target.closest("tr[data-order-id]");
  if(!row?.dataset?.orderId)return;
  e.preventDefault();
  window.openOrderDetail(row.dataset.orderId);
});
window.changeStatus=async(kind,id,status)=>{
  if(kind==="request"){const r=data.requests.find(x=>String(x.id)===String(id));if(requestIsClosed(r)){toast("✕ La solicitud está CERRADA por pago confirmado y ya no admite cambios.");renderRequests();return}}
  if(kind==="order"){const o=data.orders.find(x=>String(x.id)===String(id));if(o&&isFinalOrder(o)){toast(`✕ ${orderFinalMessage(o.estado)}. No se puede modificar.`);renderOrders();return}if(orderState(status)==="CANCELADO"){window.openOrderCancel(id);renderOrders();return}}
  try{await AleAPI.post("updatestatus",{kind,id,status},token);const list=kind==="order"?data.orders:data.requests;const ix=list.findIndex(x=>String(x.id)===String(id));if(ix>=0)list[ix]={...list[ix],estado:status,updated_at:new Date().toISOString()};if(kind==="order"){renderOrders();reportAnalytics=null;if($("#view-reports")?.classList.contains("active"))loadReports(true).catch(()=>{})}else renderRequests();toast(orderState(status)==="ENTREGADO"?"✓ Pedido marcado como ENTREGADO. El estado quedó bloqueado.":"✓ Estado actualizado")}catch(err){console.warn("changeStatus",err);const code=String(err?.message||err||"").toUpperCase();toast(code.includes("PEDIDO_ESTADO_FINAL")?"✕ El pedido está finalizado y no admite cambios.":code.includes("SOLICITUD_CERRADA")?"✕ La solicitud está CERRADA y protegida contra cambios.":"No fue posible actualizar el estado");try{await loadAdminModules({modules:[kind==="order"?"orders":"requests"],retry:true})}catch(_){}}};
let currentOrderDetailId="";
function canonicalOrderPaymentMethod(v){const s=String(v||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");if(!s)return"";if(s.includes("TRANSFER"))return"TRANSFERENCIA";if(s.includes("TRANSBANK")||s.includes("TARJETA")||s.includes("WEBPAY")||s.includes("CARD"))return"TRANSBANK";if(s.includes("EFECTIVO")||s.includes("CASH"))return"EFECTIVO";return s}
function orderPaymentMethodLabel(v){const m=canonicalOrderPaymentMethod(v);return m==="TRANSFERENCIA"?"Transferencia":m==="TRANSBANK"?"Tarjeta · Transbank":m==="EFECTIVO"?"Efectivo":(m||"Por definir")}
function closeOrderDetail(){currentOrderDetailId="";$("#orderDetailEditor")?.classList.add("hidden");document.body.classList.remove("order-detail-open")}
function renderOrderDetail(order,items,history=[]){
  currentOrderDetailId=String(order.id||"");
  $("#orderDetailNumber").textContent=order.numero_pedido||order.id||"";
  const final=isFinalOrder(order),finalState=orderState(order.estado);
  const paymentMethod=canonicalOrderPaymentMethod(order.medio_pago);
  $("#orderDetailSummary").innerHTML=`<div><span>Cliente</span><strong>${esc(order.nombre||"")}</strong></div><div><span>RUT</span><strong>${esc(order.rut?formatRutChile(order.rut):"-")}</strong></div><div><span>WhatsApp</span><strong>${esc(order.telefono||"-")}</strong></div><div><span>Correo</span><strong>${esc(order.email||"-")}</strong></div><div><span>Entrega</span><strong>${esc(order.metodo_entrega||"-")}</strong></div><div><span>Dirección</span><strong>${esc([order.direccion,order.comuna].filter(Boolean).join(" · ")||"-")}</strong></div><div><span>Tipo de venta</span><strong>${String(order.tipo_venta||order.origen||"MINORISTA").toUpperCase()==="MAYORISTA"?"MAYORISTA":"MINORISTA"}</strong></div>${String(order.tipo_venta||order.origen||"").toUpperCase()==="MAYORISTA"?`<div><span>Lista de precios</span><strong>${esc(order.lista_precio_nombre||order.lista_precio_id||"-")}</strong></div>`:""}<div><span>Estado</span><strong>${esc(order.estado||"")}</strong></div><div><span>Estado de pago</span><strong>${esc(order.estado_pago||"PENDIENTE")}</strong></div><div><span>Medio de pago</span><strong>${esc(orderPaymentMethodLabel(paymentMethod))}</strong></div><div><span>Fecha</span><strong>${esc(formatDate(order.fecha))}</strong></div>${final?`<div class="order-detail-final-note ${finalState==="ENTREGADO"?"delivered":""}"><span>Estado final</span><strong>${esc(orderFinalMessage(finalState))}${finalState==="CANCELADO"&&order.anulado_motivo?` · Motivo: ${esc(order.anulado_motivo)}`:""}</strong></div>`:""}`;
  const proofBox=$("#orderTransferProof"),proofLink=$("#orderTransferProofLink"),proofState=$("#orderTransferProofState"),approveBtn=$("#approveTransferPayment"),cashBtn=$("#confirmCashPayment"),payWa=$("#sendOrderPaymentWhatsApp"),cancelBtn=$("#cancelOrderBtn"),regenBtn=$("#regenerateOrderPdf");
  const paymentPaid=String(order.estado_pago||"").toUpperCase()==="PAGADO";
  if(proofBox){const transfer=paymentMethod==="TRANSFERENCIA";proofBox.classList.toggle("hidden",!transfer);if(transfer){const has=!!order.comprobante_pago_url;proofLink.classList.toggle("hidden",!has);if(has)proofLink.href=order.comprobante_pago_url;proofState.textContent=has?(order.comprobante_pago_estado||"PENDIENTE_REVISION"):"Aún sin comprobante";approveBtn.classList.toggle("hidden",final||!has||paymentPaid)}}
  if(cashBtn){cashBtn.classList.toggle("hidden",final||paymentMethod!=="EFECTIVO"||paymentPaid);cashBtn.disabled=final||paymentPaid;cashBtn.title=paymentPaid?"Este pedido ya está pagado":"Registrar cobro manual en efectivo";}
  if(payWa)payWa.classList.toggle("hidden",final||paymentMethod!=="TRANSBANK"||paymentPaid);if(cancelBtn)cancelBtn.classList.toggle("hidden",final);if(regenBtn){regenBtn.disabled=false;regenBtn.title=final?"El estado comercial permanece bloqueado; el PDF sí puede reimprimirse/actualizarse.":"";}
  $("#orderDetailItems").innerHTML=(items||[]).length?(items||[]).map(i=>`<div class="order-detail-line"><span><strong>${esc(i.producto_nombre||i.nombre||"Producto")}</strong><small>${i.tamano_nombre?`Tamaño: ${esc(i.tamano_nombre)} · `:""}${esc(i.producto_id||i.id||"")}</small></span><span>${Number(i.cantidad||1)}</span><span>${money(i.precio_unitario??i.precio)}</span><span><strong>${money(i.subtotal??(Number(i.cantidad||1)*Number(i.precio_unitario??i.precio??0)))}</strong></span></div>`).join(""):'<div class="empty-card">Este pedido histórico no tiene líneas de producto recuperables.</div>';
  $("#orderDetailTotals").innerHTML=`<div><span>Subtotal</span><strong>${money(order.subtotal)}</strong></div><div><span>Despacho</span><strong>${money(order.despacho)}</strong></div><div class="grand"><span>Total</span><strong>${money(order.total)}</strong></div>${order.observaciones?`<p><b>Observaciones:</b> ${esc(order.observaciones)}</p>`:""}`;
  const hh=$("#orderDetailHistory");if(hh)hh.innerHTML=(history||[]).length?(history||[]).map(h=>`<div class="order-history-row"><span class="order-history-dot"></span><div><strong>${esc(h.descripcion||h.evento||"Actualización")}</strong><small>${esc(formatDate(h.creado_en||h.fecha))}${h.estado_pago?` · Pago: ${esc(h.estado_pago)}`:""}${h.estado_pedido?` · Pedido: ${esc(h.estado_pedido)}`:""}</small></div></div>`).join(""):'<div class="muted-text">La trazabilidad se registrará desde esta versión.</div>';
  const link=$("#orderDetailPdfLink"),reprint=$("#reprintOrderPdf"),hasPdf=!!(order.pdf_url||order.pdf_path);if(hasPdf){link.href="#";link.dataset.orderPdfId=String(order.id||"");link.classList.remove("hidden")}else{link.href="#";delete link.dataset.orderPdfId;link.classList.add("hidden")}if(reprint){reprint.disabled=!hasPdf;reprint.title=hasPdf?`Abrir PDF guardado para reimprimir · ${documentFormatLabel()}`:"Genera primero el PDF del pedido"}
}
window.openOrderDetail=async id=>{
  const local=data.orders.find(x=>String(x.id)===String(id));if(!local)return toast("Pedido no encontrado");
  $("#orderDetailEditor")?.classList.remove("hidden");document.body.classList.add("order-detail-open");renderOrderDetail(local,Array.isArray(local.detalle)?local.detalle:[],[]);
  try{const out=await AleAPI.post("orderdetail",{id},token);if(out?.order){renderOrderDetail(out.order,out.items||[],out.history||[]);const ix=data.orders.findIndex(x=>String(x.id)===String(id));if(ix>=0){data.orders[ix]={...data.orders[ix],...out.order};renderOrders()}}}catch(err){console.warn("orderdetail",err);toast("El pedido se abrió con los datos disponibles; no se pudo actualizar el detalle completo")}
};
$("#closeOrderDetailX")?.addEventListener("click",closeOrderDetail);$("#closeOrderDetail")?.addEventListener("click",closeOrderDetail);
$("#orderDetailPdfLink")?.addEventListener("click",e=>{e.preventDefault();const id=e.currentTarget.dataset.orderPdfId||currentOrderDetailId;if(id)openSecureOrderPdf(id,e.currentTarget)});
$("#regenerateOrderPdf")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{if(!currentOrderDetailId)return;try{const out=await AleAPI.post("generateorderpdf",{id:currentOrderDetailId},token);if(out?.order){renderOrderDetail(out.order,out.items||[],out.history||[]);const ix=data.orders.findIndex(x=>String(x.id)===String(currentOrderDetailId));if(ix>=0)data.orders[ix]={...data.orders[ix],...out.order};renderOrders()}toast("PDF del pedido generado correctamente")}catch(err){console.warn(err);toast(`No fue posible generar el PDF del pedido: ${String(err?.message||"ERROR")}`)}}));
$("#reprintOrderPdf")?.addEventListener("click",()=>{if(!currentOrderDetailId)return;openSecureOrderPdf(currentOrderDetailId)});

async function secureOrderTrackingUrl(order){const out=await AleAPI.post("ordertrackinglink",{id:order.id},token);if(!out?.tracking_url)throw new Error("SEGUIMIENTO_NO_DISPONIBLE");return clientPublicUrl(out.tracking_url)}
$("#copyOrderTracking")?.addEventListener("click",async()=>{const o=data.orders.find(x=>String(x.id)===String(currentOrderDetailId));if(!o)return;try{const url=await secureOrderTrackingUrl(o);await navigator.clipboard.writeText(url);toast("✓ Enlace seguro de seguimiento copiado")}catch(err){console.warn(err);toast("No fue posible copiar el enlace")}});
$("#sendOrderTrackingWhatsApp")?.addEventListener("click",async()=>{const o=data.orders.find(x=>String(x.id)===String(currentOrderDetailId));if(!o)return;const phone=String(o.telefono||"").replace(/\D/g,"");if(!phone)return toast("El pedido no tiene WhatsApp");try{const url=await secureOrderTrackingUrl(o);const text=`Hola ${o.nombre||""}, puedes consultar el estado de tu pedido ${o.numero_pedido||o.id} aquí: ${url}`;window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,"_blank","noopener")}catch(err){console.warn(err);toast("No fue posible generar el enlace de seguimiento")}});
let pendingCancelOrderId="";
function closeOrderCancel(){pendingCancelOrderId="";$("#orderCancelEditor")?.classList.add("hidden");document.body.classList.remove("order-cancel-open");if($("#orderCancelReason"))$("#orderCancelReason").value=""}
window.openOrderCancel=id=>{const o=data.orders.find(x=>String(x.id)===String(id));if(!o)return toast("Pedido no encontrado");if(isFinalOrder(o))return toast(`✕ ${orderFinalMessage(o.estado)}. No se puede volver a anular ni modificar.`);pendingCancelOrderId=String(id);const modal=$("#orderCancelEditor");if(!modal)return;if(modal.parentElement!==document.body)document.body.appendChild(modal);if($("#orderCancelNumber"))$("#orderCancelNumber").textContent=o.numero_pedido||o.id||"";if($("#orderCancelReason"))$("#orderCancelReason").value="";modal.classList.remove("hidden");document.body.classList.add("order-cancel-open");setTimeout(()=>$("#orderCancelReason")?.focus(),30)};
$("#closeOrderCancelX")?.addEventListener("click",closeOrderCancel);$("#closeOrderCancel")?.addEventListener("click",closeOrderCancel);
$("#orderCancelEditor")?.addEventListener("click",e=>{if(e.target===$("#orderCancelEditor"))closeOrderCancel()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#orderCancelEditor")?.classList.contains("hidden"))closeOrderCancel()});
$("#confirmCancelOrder")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{const id=pendingCancelOrderId||currentOrderDetailId;if(!id)return;const motivo=String($("#orderCancelReason")?.value||"").trim();if(motivo.length<5)return toast("✕ Debes indicar un motivo de anulación claro (mínimo 5 caracteres).");try{const out=await AleAPI.post("cancelorder",{id,motivo},token);const ix=data.orders.findIndex(x=>String(x.id)===String(id));if(ix>=0)data.orders[ix]={...data.orders[ix],estado:"CANCELADO",anulado_motivo:motivo,anulado_en:out.anulado_en||new Date().toISOString(),updated_at:new Date().toISOString()};closeOrderCancel();renderOrders();reportAnalytics=null;toast("✓ Pedido CANCELADO. El estado quedó bloqueado de forma irreversible.");if(String(currentOrderDetailId)===String(id))await window.openOrderDetail(id)}catch(err){console.warn("cancelorder",err);const code=String(err?.message||err||"").toUpperCase();toast(code.includes("PEDIDO_ESTADO_FINAL")?"✕ El pedido ya está en un estado final y no admite cambios.":code.includes("MOTIVO")?"✕ Debes ingresar el motivo de anulación.":"✕ No fue posible anular el pedido")}}));

function openOrderPaymentLinkEditor(){
  const o=data.orders.find(x=>String(x.id)===String(currentOrderDetailId));if(!o)return;
  if(isFinalOrder(o))return toast(`✕ ${orderFinalMessage(o.estado)}. No se puede asignar un nuevo enlace de pago.`);
  if(String(o.medio_pago||"").toUpperCase()!=="TRANSBANK")return toast("Este pedido no usa Transbank");
  if(String(o.estado_pago||"").toUpperCase()==="PAGADO")return toast("Este pedido ya está pagado");
  const modal=$("#orderPaymentLinkEditor");if(!modal)return;
  if(modal.parentElement!==document.body)document.body.appendChild(modal);
  if($("#orderPaymentExpiryDate"))$("#orderPaymentExpiryDate").value="";if($("#orderPaymentExpiryTime"))$("#orderPaymentExpiryTime").value="";if($("#orderPaymentOrderNumber"))$("#orderPaymentOrderNumber").textContent=o.numero_pedido||o.id||"";if($("#orderPaymentAmount"))$("#orderPaymentAmount").textContent=clpLabel(o.total);modal.classList.remove("hidden");document.body.classList.add("payment-link-open");setTimeout(()=>$("#orderPaymentExpiryDate")?.focus(),30);
}
function closeOrderPaymentLinkEditor(){$("#orderPaymentLinkEditor")?.classList.add("hidden");document.body.classList.remove("payment-link-open")}
function selectedPaymentExpiryIso(){const date=$("#orderPaymentExpiryDate")?.value||"",time=$("#orderPaymentExpiryTime")?.value||"";if(!date||!time)throw new Error("VIGENCIA_ENLACE_REQUERIDA");const d=new Date(`${date}T${time}:00`);if(!Number.isFinite(d.getTime())||d.getTime()<=Date.now()+60000)throw new Error("VIGENCIA_ENLACE_INVALIDA");return d.toISOString()}
async function generateAssignedPaymentLink(mode,btn){
  const o=data.orders.find(x=>String(x.id)===String(currentOrderDetailId));if(!o)return;
  const expiresAt=selectedPaymentExpiryIso();const out=await AleAPI.post("adminorderpaymentlink",{id:o.id,expires_at:expiresAt},token);
  const paymentUrl=clientPublicUrl(out.payment_url);const label=new Date(out.expires_at||expiresAt).toLocaleString("es-CL");const text=`Hola ${o.nombre||""}, tu pedido ${o.numero_pedido||o.id} está listo para pagar con Transbank. Este enlace estará disponible hasta ${label}: ${paymentUrl}`;
  closeOrderPaymentLinkEditor();
  if(mode==="whatsapp"){const phone=String(o.telefono||"").replace(/\D/g,"");if(!phone)throw new Error("PEDIDO_SIN_WHATSAPP");window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,"_blank","noopener");toast(`✓ Enlace asignado hasta ${label}`)}
  else{await navigator.clipboard.writeText(paymentUrl);toast(`✓ Enlace copiado · vigente hasta ${label}`)}
}
$("#sendOrderPaymentWhatsApp")?.addEventListener("click",openOrderPaymentLinkEditor);
$("#closeOrderPaymentLinkX")?.addEventListener("click",closeOrderPaymentLinkEditor);
$("#cancelOrderPaymentLink")?.addEventListener("click",closeOrderPaymentLinkEditor);
$("#generatePaymentLinkWhatsapp")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{await generateAssignedPaymentLink("whatsapp",e.currentTarget)}catch(err){console.warn(err);const code=String(err?.message||err||"").toUpperCase();toast(code.includes("VIGENCIA")?"✕ Define una fecha y hora futura para la vigencia del enlace.":code.includes("WHATSAPP")?"✕ El pedido no tiene WhatsApp.":"✕ No fue posible generar el enlace de pago")}}));
$("#generatePaymentLinkCopy")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{await generateAssignedPaymentLink("copy",e.currentTarget)}catch(err){console.warn(err);const code=String(err?.message||err||"").toUpperCase();toast(code.includes("VIGENCIA")?"✕ Define una fecha y hora futura para la vigencia del enlace.":"✕ No fue posible generar el enlace de pago")}}));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#orderPaymentLinkEditor")?.classList.contains("hidden"))closeOrderPaymentLinkEditor()});
$("#approveTransferPayment")?.addEventListener("click",async e=>busy(e.currentTarget,async()=>{const o=data.orders.find(x=>String(x.id)===String(currentOrderDetailId));if(o&&isFinalOrder(o))return toast(`✕ ${orderFinalMessage(o.estado)}. No se puede modificar el pago.`);try{await AleAPI.post("adminverifytransfer",{id:currentOrderDetailId},token);toast("✓ Transferencia verificada: pago PAGADO y pedido CONFIRMADO");await reload();if(currentOrderDetailId)openOrderDetail(currentOrderDetailId)}catch(err){console.warn(err);const code=String(err?.message||err||"").toUpperCase();toast(code.includes("PEDIDO_ESTADO_FINAL")?"✕ El pedido está finalizado y no admite cambios.":"✕ No fue posible confirmar la transferencia")}}));
$("#confirmCashPayment")?.addEventListener("click",async e=>{
  const o=data.orders.find(x=>String(x.id)===String(currentOrderDetailId));
  if(!o)return toast("✕ Pedido no encontrado");
  if(isFinalOrder(o))return toast(`✕ ${orderFinalMessage(o.estado)}. No se puede modificar el pago.`);
  if(canonicalOrderPaymentMethod(o.medio_pago)!=="EFECTIVO")return toast("✕ Este pedido no usa pago en efectivo");
  if(String(o.estado_pago||"").toUpperCase()==="PAGADO")return toast("✓ Este pedido ya está pagado");
  const total=money(o.total);
  if(!window.confirm(`¿Confirmar que se recibió ${total} en EFECTIVO para el pedido ${o.numero_pedido||o.id}?\n\nEsta acción quedará registrada en la trazabilidad.`))return;
  await busy(e.currentTarget,async()=>{
    try{
      const out=await AleAPI.post("adminmarkcashpaid",{id:currentOrderDetailId},token);
      toast(`✓ Pedido marcado como PAGADO · EFECTIVO`);
      await reload();
      if(currentOrderDetailId)openOrderDetail(currentOrderDetailId);
    }catch(err){
      console.warn(err);
      const code=String(err?.message||err||"").toUpperCase();
      toast(code.includes("PEDIDO_YA_PAGADO")?"✓ Este pedido ya está pagado":code.includes("PEDIDO_NO_ES_EFECTIVO")?"✕ El pedido no está configurado para pago en efectivo":code.includes("PEDIDO_ESTADO_FINAL")?"✕ El pedido está finalizado y no admite cambios.":"✕ No fue posible confirmar el pago en efectivo");
    }
  });
});

function requestIsClosed(r){return String(r?.estado||"").trim().toUpperCase()==="CERRADA"}
function renderRequests(){
  pruneSelection("requests",data.requests);
  const canDelete=!!data.permissions?.requests?.delete;if(!canDelete)selectedSet("requests").clear();
  const visibleRequests=filteredCommercialRows("requests",data.requests);updateCommercialFilterUi("requests",visibleRequests.length,data.requests.length);
  const visibleIds=visibleRequests.filter(r=>!requestIsClosed(r)).map(r=>String(r.id));
  const headers=canDelete?[`<span class="bulk-select-col">${bulkHeaderCheckbox("requests",visibleIds)}</span>`,"N.º solicitud","Fecha","Cliente / RUT","Tipo","Evento","Detalle","Estado","Acciones"]:["N.º solicitud","Fecha","Cliente / RUT","Tipo","Evento","Detalle","Estado","Acciones"];
  const rows=visibleRequests.map(r=>{const closed=requestIsClosed(r),selected=!closed&&selectedSet("requests").has(String(r.id)),used=requestConsumedQuoteId(r),usedLabel=r.cotizacion_numero||used;const quoteAction=used?`<span class="request-used-badge" title="Esta solicitud ya fue utilizada en una cotización"><i class="bi bi-check2-circle"></i> Cotizada${usedLabel?` · ${esc(usedLabel)}`:""}</span>`:closed?`<span class="request-closed-lock"><i class="bi bi-lock-fill"></i> Cerrada</span>`:`<button type="button" onclick="quoteFromRequest('${r.id}')"><i class="bi bi-receipt-cutoff"></i> Cotizar</button>`;const statusHtml=closed?`<select class="status-select is-request-closed" disabled title="Solicitud cerrada por pedido pagado"><option selected>CERRADA</option></select>`:`<select class="status-select" onchange="changeStatus('request','${r.id}',this.value)">${["NUEVA","CONTACTADA","COTIZADA","ACEPTADA","CERRADA"].map(st=>`<option ${String(r.estado).toUpperCase()===st?"selected":""}>${st}</option>`).join("")}</select>`;return `<tr class="request-row-client-clickable ${selected?"is-selected ":""}${closed?"request-row-closed":""}" data-request-id="${esc(r.id)}" tabindex="0" title="Abrir datos del cliente">${canDelete?`<td class="bulk-select-col">${closed?`<span class="bulk-locked" title="Solicitud CERRADA: no se puede eliminar"><i class="bi bi-lock-fill"></i></span>`:bulkCheckbox("requests",r.id)}</td>`:""}<td><strong>${esc(r.numero_solicitud||r.id)}</strong></td><td>${esc(formatDate(r.fecha))}</td><td><strong>${esc(r.nombre)}</strong><br><small>${esc(r.rut?formatRutChile(r.rut):"RUT sin registrar")} · ${esc(r.telefono||"")}</small></td><td>${esc(r.tipo||"")}</td><td>${esc(r.fecha_evento||"")}</td><td>${esc(r.detalle||"")}</td><td>${statusHtml}</td><td><div class="row-actions"><button type="button" onclick="openRequestClientEditor('${r.id}')" title="Ver o editar datos del cliente"><i class="bi bi-person-vcard"></i> Cliente</button>${quoteAction}<button type="button" onclick="generateRequestPdfFromList('${r.id}',this)" title="Generar / reimprimir PDF"><i class="bi bi-file-earmark-pdf"></i></button><button type="button" onclick="sendRequestWhatsapp('${r.id}',this)" title="Enviar seguimiento por WhatsApp"><i class="bi bi-whatsapp"></i></button>${canDelete&&!closed?`<button type="button" class="danger" onclick="deleteRequest('${r.id}',this)"><i class="bi bi-trash3"></i> Eliminar</button>`:closed?`<span class="request-closed-lock" title="Una solicitud CERRADA está protegida contra eliminación"><i class="bi bi-shield-lock"></i> Protegida</span>`:""}</div></td></tr>`}).join("");
  $("#requestsTable").innerHTML=table(headers,rows);updateBulkBar("requests");syncSelectedRows($("#requestsTable"));
}
$("#requestsTable")?.addEventListener("change",e=>{
  if(handleBulkCheckboxChange(e))return;
  const all=e.target.closest('input[data-bulk-select-all="requests"]');if(all){handleBulkSelectAllChange(e,filteredCommercialRows("requests",data.requests).filter(r=>!requestIsClosed(r)).map(r=>String(r.id)));renderRequests()}
});
let currentRequestClientEditorId="";
function closeRequestClientEditor(){currentRequestClientEditorId="";$("#requestClientEditor")?.classList.add("hidden");document.body.classList.remove("request-client-editor-open")}
window.openRequestClientEditor=id=>{const r=(data.requests||[]).find(x=>String(x.id)===String(id));if(!r)return toast("Solicitud no encontrada");currentRequestClientEditorId=String(id);const modal=$("#requestClientEditor");if(!modal)return;if(modal.parentElement!==document.body)document.body.appendChild(modal);$("#requestClientRequestId").value=r.id||"";$("#requestClientEditorNumber").textContent=`${r.numero_solicitud||r.id||""} · ${String(r.estado||"NUEVA").toUpperCase()}`;$("#requestClientName").value=r.nombre||"";$("#requestClientRut").value=r.rut?formatRutChile(r.rut):"";$("#requestClientPhone").value=r.telefono||"";$("#requestClientEmail").value=r.email||"";const closed=requestIsClosed(r),consumed=!!requestConsumedQuoteId(r),locked=closed||consumed,notice=$("#requestClientLockNotice"),save=$("#saveRequestClient");["#requestClientName","#requestClientRut","#requestClientPhone","#requestClientEmail"].forEach(sel=>{if($(sel))$(sel).disabled=locked});if(save)save.classList.toggle("hidden",locked);if(notice){notice.classList.toggle("is-visible",locked);notice.textContent=closed?"Solicitud CERRADA: los datos quedan en modo consulta y no pueden modificarse.":consumed?"Solicitud ya utilizada en una cotización: se conserva la ficha original para mantener la trazabilidad.":""}setClientLookupState("#requestClientLookupState",locked?"Ficha protegida: consulta solamente.":"Ingresa un RUT válido para buscar en Clientes.");modal.classList.remove("hidden");document.body.classList.add("request-client-editor-open");setTimeout(()=>$(locked?"#closeRequestClientEditor":"#requestClientRut")?.focus(),30)};
$("#closeRequestClientEditorX")?.addEventListener("click",closeRequestClientEditor);$("#closeRequestClientEditor")?.addEventListener("click",closeRequestClientEditor);$("#requestClientEditor")?.addEventListener("click",e=>{if(e.target===$("#requestClientEditor"))closeRequestClientEditor()});
$("#requestClientPdf")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const r=(data.requests||[]).find(x=>String(x.id)===String(currentRequestClientEditorId));if(!r)throw new Error("SOLICITUD_NO_ENCONTRADA");await generateRequestPdf(r,true);toast(`PDF ${documentFormatLabel()} generado`)}catch(err){console.warn(err);toast("No fue posible generar el PDF de la solicitud")}}));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#requestClientEditor")?.classList.contains("hidden"))closeRequestClientEditor()});
wireClientRutLookup({rutSelector:"#requestClientRut",statusSelector:"#requestClientLookupState",fields:{name:"#requestClientName",phone:"#requestClientPhone",email:"#requestClientEmail"},guard:()=>{const r=(data.requests||[]).find(x=>String(x.id)===String(currentRequestClientEditorId));return !requestIsClosed(r)&&!requestConsumedQuoteId(r)}});
$("#saveRequestClient")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const id=$("#requestClientRequestId").value||currentRequestClientEditorId,r=(data.requests||[]).find(x=>String(x.id)===String(id));if(requestIsClosed(r))throw new Error("SOLICITUD_CERRADA");if(requestConsumedQuoteId(r))throw new Error("SOLICITUD_COTIZADA_BLOQUEADA");const payload={id,nombre:$("#requestClientName").value.trim(),rut:requireRutChile($("#requestClientRut").value),telefono:$("#requestClientPhone").value.trim(),email:$("#requestClientEmail").value.trim()};const out=await AleAPI.post("updaterequestclient",payload,token);if(out?.request){const i=data.requests.findIndex(x=>String(x.id)===String(out.request.id));if(i>=0)data.requests[i]={...data.requests[i],...out.request}}if(out?.client)mergeClientCache(out.client);renderRequests();closeRequestClientEditor();toast("✓ Datos del cliente actualizados")}catch(err){console.warn(err);const code=String(err?.message||err||"").toUpperCase();toast(code.includes("SOLICITUD_CERRADA")?"✕ La solicitud está CERRADA y no admite cambios.":code.includes("SOLICITUD_COTIZADA_BLOQUEADA")?"✕ La solicitud ya fue utilizada en una cotización y conserva su ficha original.":code.includes("RUT")?"✕ Revisa el RUT del cliente.":code.includes("TELEFONO_YA_ASOCIADO")?"✕ Ese teléfono pertenece a otro RUT.":"✕ No fue posible guardar los datos del cliente")}}));
$("#requestsTable")?.addEventListener("click",e=>{if(e.target.closest("button,select,input,a,label"))return;const row=e.target.closest("tr[data-request-id]");if(row)window.openRequestClientEditor(row.dataset.requestId)});
$("#requestsTable")?.addEventListener("keydown",e=>{if(!["Enter"," "].includes(e.key)||e.target.closest("button,select,input,a"))return;const row=e.target.closest("tr[data-request-id]");if(row){e.preventDefault();window.openRequestClientEditor(row.dataset.requestId)}});

$("#deleteSelectedRequests")?.addEventListener("click",e=>deleteSelected("requests",e.currentTarget));
window.deleteRequest=async(id,btn)=>{
  const r=data.requests.find(x=>String(x.id)===String(id));
  if(requestIsClosed(r))return toast("✕ Esta solicitud está CERRADA y protegida. No se puede eliminar.");
  const label=r?.numero_solicitud||id;
  if(!confirm(`¿Eliminar definitivamente la solicitud ${label}?\n\nLas cotizaciones vinculadas se conservarán y quedarán sin solicitud asociada.`))return;
  await busy(btn,async()=>{
    try{
      const res=await AleAPI.post("deleteEntity",{kind:"request",id},token);
      if(!res?.deleted)throw new Error("SOLICITUD_NO_ELIMINADA");
      selectedSet("requests").delete(String(id));toast("✓ Solicitud eliminada");await reload();
    }catch(e){console.warn(e);const code=String(e?.message||e||"").toUpperCase();toast(code.includes("SOLICITUD_CERRADA")?"✕ La solicitud está CERRADA y no puede eliminarse.":"✕ No fue posible eliminar la solicitud")}
  });
};
window.sendRequestWhatsapp=(id,btn)=>{const popup=window.open("about:blank","_blank");return busy(btn,async()=>{const r=data.requests.find(x=>String(x.id)===String(id));if(!r){try{popup?.close()}catch(_){};throw new Error("SOLICITUD_NO_ENCONTRADA")}const phone=phoneForWhatsapp(r.telefono);if(!phone){try{popup?.close()}catch(_){};return toast("La solicitud no tiene WhatsApp")}try{const out=await AleAPI.post("requestsharelink",{id:r.id},token),url=clientPublicUrl(out?.public_url||"");const text=`Hola ${r.nombre||""}, puedes consultar tu solicitud ${r.numero_solicitud||r.id} aquí: ${url}`,waUrl=`https://wa.me/${phone}?text=${encodeURIComponent(text)}`;if(popup&&!popup.closed)popup.location.href=waUrl;else window.open(waUrl,"_blank","noopener");toast("Enlace público de solicitud preparado")}catch(err){try{popup?.close()}catch(_){};console.warn(err);toast("No fue posible generar el enlace de la solicitud")}})};
function renderUsers(){
  const list=data.users||[];
  $("#usersTable").innerHTML=table(["Perfil","Nombre / usuario","Rol","Estado","Último acceso","Acciones"],list.map(u=>`<tr><td><img class="user-avatar" src="${esc(u.profile_url||'favicon.png')}" alt=""></td><td><strong>${esc(u.nombre||'')}</strong><br><small>@${esc(u.usuario||'')}</small></td><td><span class="role-badge">${esc(({ADMIN:'Administrador',GERENCIA:'Gerencia',OPERADOR:'Operador',EDITOR:'Editor',LECTURA:'Lectura',MAYORISTA:'Mayorista'})[String(u.rol||'EDITOR').toUpperCase()]||u.rol||'Editor')}</span></td><td><span class="role-badge ${String(u.activo).toUpperCase()==='NO'?'inactive-badge':''}">${String(u.activo).toUpperCase()==='NO'?'Inactivo':'Activo'}</span></td><td>${esc(formatDate(u.ultimo_acceso))}</td><td><div class="row-actions"><button onclick="editUser('${u.id}')">Editar</button>${u.id!==data.currentUser?.id?`<button class="danger" onclick="deleteUser('${u.id}',this)">Desactivar</button>`:''}</div></td></tr>`).join(""));
}
function wholesaleActive(v){return v!==false&&!['NO','FALSE','0','INACTIVO'].includes(String(v??'SI').toUpperCase())}
function fillWholesaleSelectors(){const clients=(data.wholesalers?.length?data.wholesalers:data.clients||[]).filter(c=>String(c.tipo_cliente||'').toUpperCase()==='MAYORISTA');const lists=(data.priceLists||[]).filter(x=>wholesaleActive(x.activo));const cOpts='<option value="">Seleccionar cliente</option>'+clients.map(c=>`<option value="${esc(c.id)}">${esc(c.razon_social||c.nombre)} · ${esc(c.rut||'')}</option>`).join('');const lOpts='<option value="">Seleccionar lista</option>'+lists.map(l=>`<option value="${esc(l.id)}">${esc(l.nombre)}${l.codigo?` (${esc(l.codigo)})`:''}</option>`).join('');if($("#uClient"))$("#uClient").innerHTML=cOpts;if($("#whDocClient"))$("#whDocClient").innerHTML=cOpts;if($("#uPriceList"))$("#uPriceList").innerHTML=lOpts;if($("#clientPriceList"))$("#clientPriceList").innerHTML='<option value="">Sin lista</option>'+lists.map(l=>`<option value="${esc(l.id)}">${esc(l.nombre)}${l.codigo?` (${esc(l.codigo)})`:''}</option>`).join('')}
function syncWholesaleUserFields(){const show=$("#uRole")?.value==='MAYORISTA';$$('.wholesale-user-field').forEach(x=>x.classList.toggle('hidden',!show))}
function clearUser(){["uId","uProfileId","uProfileUrl","uName","uUsername","uPassword"].forEach(id=>$("#"+id).value="");$("#uRole").value="EDITOR";$("#uActive").value="SI";if($("#uClient"))$("#uClient").value="";if($("#uPriceList"))$("#uPriceList").value="";resetFilePicker("#uProfile");$("#uProfilePreview").src="favicon.png";fillWholesaleSelectors();syncWholesaleUserFields()}
$("#newUser").addEventListener("click",()=>{clearUser();$("#userEditor").classList.remove("hidden")});
window.editUser=id=>{const u=(data.users||[]).find(x=>x.id===id);if(!u)return;fillWholesaleSelectors();resetFilePicker("#uProfile");$("#uId").value=u.id;$("#uProfileId").value=u.profile_file_id||"";$("#uProfileUrl").value=u.profile_url||"";$("#uName").value=u.nombre||"";$("#uUsername").value=u.usuario||"";$("#uPassword").value="";$("#uRole").value=String(u.rol||"EDITOR").toUpperCase();$("#uActive").value=String(u.activo||"SI").toUpperCase();if($("#uClient"))$("#uClient").value=u.cliente_id||"";if($("#uPriceList"))$("#uPriceList").value=u.lista_precio_id||"";$("#uProfilePreview").src=u.profile_url||"favicon.png";syncWholesaleUserFields();$("#userEditor").classList.remove("hidden")};
$("#uProfile").addEventListener("change",e=>{const f=e.target.files[0];if(f)$("#uProfilePreview").src=URL.createObjectURL(f)});
$("#uRole")?.addEventListener("change",syncWholesaleUserFields);
function userSaveErrorMessage(err){const code=String(err?.message||err||"").toUpperCase();if(code.includes("USUARIO_YA_EXISTE"))return "Ese usuario ya existe";if(code.includes("EMAIL_YA_EXISTE"))return "Ese correo ya está asociado a otro usuario";if(code.includes("CLAVE_MINIMO_8_CARACTERES"))return "La contraseña debe tener al menos 8 caracteres";if(code.includes("MAYORISTA_CLIENTE_REQUERIDO"))return "Selecciona el cliente Mayorista";if(code.includes("CLIENTE_NO_ES_MAYORISTA"))return "El cliente seleccionado no está configurado como Mayorista";if(code.includes("LISTA_PRECIO_NO_DISPONIBLE"))return "La lista de precios seleccionada no está activa";if(code.includes("PERMISO_DENEGADO"))return "Tu sesión no tiene permiso para crear usuarios";if(code.includes("ACCION_NO_VALIDA"))return "El backend está desactualizado. Debes desplegar el index.ts incluido en esta versión";return `No fue posible guardar el usuario${code?` · ${code}`:""}`}
$("#saveUser").addEventListener("click",e=>busy(e.currentTarget,async()=>{try{let profileId=$("#uProfileId").value,profileUrl=$("#uProfileUrl").value;const f=$("#uProfile").files[0];if(f){const u=await upload(f,"USUARIOS");profileId=u.fileId;profileUrl=u.imageUrl||profileUrl}const payload={id:$("#uId").value,nombre:$("#uName").value.trim(),usuario:$("#uUsername").value.trim(),password:$("#uPassword").value,rol:$("#uRole").value,activo:$("#uActive").value,cliente_id:$("#uClient")?.value||"",lista_precio_id:$("#uPriceList")?.value||"",profile_file_id:profileId,profile_url:profileUrl};if(!payload.nombre||!payload.usuario){toast("Completa nombre y usuario");return}if(!payload.id&&String(payload.password||"").length<8){toast("La contraseña debe tener al menos 8 caracteres");return}if(payload.rol==='MAYORISTA'&&!payload.cliente_id){toast('Selecciona el cliente Mayorista');return}if(payload.rol==='MAYORISTA'&&!payload.lista_precio_id){payload.activo='NO'}const out=await AleAPI.post("saveUser",payload,token);toast(out?.pending_price_list?"✓ Usuario Mayorista creado · acceso pendiente hasta asignar lista de precios":"✓ Usuario guardado");$("#userEditor").classList.add("hidden");await reload()}catch(err){console.warn(err);toast(userSaveErrorMessage(err))}}));
window.deleteUser=async(id,btn)=>{if(!confirm("¿Desactivar este usuario?"))return;await busy(btn,async()=>{try{await AleAPI.post("deleteUser",{id},token);toast("Usuario desactivado");await reload()}catch(e){console.warn(e);toast("No fue posible desactivar")}})};
$("#changeMyPassword").addEventListener("click",e=>busy(e.currentTarget,async()=>{const password=$("#myNewPassword").value;if(password.length<8){toast("La contraseña debe tener al menos 8 caracteres");return}try{await AleAPI.post("changeMyPassword",{password},token);$("#myNewPassword").value="";toast("Contraseña actualizada") }catch(err){console.warn(err);toast("No fue posible cambiar la contraseña")}}));

function yesNo(v){return ["SI","SÍ","TRUE","1","YES","ON"].includes(String(v||"").trim().toUpperCase())?"SI":"NO"}
function safeHttpsAdminUrl(value){try{const u=new URL(String(value||"").trim());if(u.protocol!=="https:")throw new Error("URL_HTTPS_REQUERIDA");return u.toString()}catch(e){if(String(value||"").trim())throw new Error("URL_HTTPS_INVALIDA");return""}}
function isSupabaseHost(host){host=String(host||"").toLowerCase();return host==="supabase.co"||host.endsWith(".supabase.co")}
function clientPublicUrl(value){const url=safeHttpsAdminUrl(value);if(!url)throw new Error("URL_PUBLICA_REQUERIDA");const u=new URL(url),api=String(window.ALE_ATENCIO_CONFIG?.API_URL||"");let apiHost="";try{apiHost=new URL(api).hostname.toLowerCase()}catch(_){}const host=u.hostname.toLowerCase();if(isSupabaseHost(host)||host===apiHost||host==="script.google.com"||host.endsWith(".script.google.com")||host==="script.googleusercontent.com"||host.endsWith(".script.googleusercontent.com")||isTransbankHost(host)||/\/(?:functions|rest|storage)\/v1\//i.test(u.pathname))throw new Error("URL_CLIENTE_INTERNA_NO_PERMITIDA");return u.toString()}
function isTransbankHost(host){host=String(host||"").toLowerCase();return host==="webpay.cl"||host.endsWith(".webpay.cl")||host==="transbank.cl"||host.endsWith(".transbank.cl")}
function safeTransbankStorefrontUrl(value){const url=safeHttpsAdminUrl(value);if(!url)return"";const host=new URL(url).hostname.toLowerCase();if(isSupabaseHost(host)||isTransbankHost(host))throw new Error("TRANSBANK_DOMINIO_TIENDA_INVALIDO");return url}
function safeTransbankManualUrl(value){const url=safeHttpsAdminUrl(value);if(!url)return"";const host=new URL(url).hostname.toLowerCase();if(!isTransbankHost(host))throw new Error("TRANSBANK_LINK_MANUAL_INVALIDO");return url}
const integrationFields=[
  ["Shopify","iShopifyEnabled","iShopifyUrl","integration_shopify_enabled","integration_shopify_url"],
  ["WooCommerce","iWooEnabled","iWooUrl","integration_woocommerce_enabled","integration_woocommerce_url"],
  ["Mercado Libre","iMercadoLibreEnabled","iMercadoLibreUrl","integration_mercadolibre_enabled","integration_mercadolibre_url"],
  ["Meta","iMetaEnabled","iMetaUrl","integration_meta_enabled","integration_meta_url"],
  ["Google Merchant","iGoogleMerchantEnabled","iGoogleMerchantUrl","integration_google_merchant_enabled","integration_google_merchant_url"],
  ["TikTok Shop","iTiktokShopEnabled","iTiktokShopUrl","integration_tiktok_shop_enabled","integration_tiktok_shop_url"],
  ["WhatsApp Catalog","iWhatsappCatalogEnabled","iWhatsappCatalogUrl","integration_whatsapp_catalog_enabled","integration_whatsapp_catalog_url"],
  ["Jumpseller","iJumpsellerEnabled","iJumpsellerUrl","integration_jumpseller_enabled","integration_jumpseller_url"]
];
function renderIntegrations(){const c=data.config||{};for(const[,enabledId,urlId,enabledKey,urlKey]of integrationFields){const e=$("#"+enabledId),u=$("#"+urlId);if(e)e.checked=yesNo(c[enabledKey])==="SI";if(u)u.value=c[urlKey]||""}}
$("#saveIntegrations")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const payload={};for(const[name,enabledId,urlId,enabledKey,urlKey]of integrationFields){const enabled=$("#"+enabledId)?.checked;const raw=$("#"+urlId)?.value.trim()||"";const url=raw?safeHttpsAdminUrl(raw):"";if(enabled&&!url){toast(`✕ ${name}: agrega una URL HTTPS antes de activar`);return}payload[enabledKey]=enabled?"SI":"NO";payload[urlKey]=url}await AleAPI.post("saveConfig",payload,token);toast("✓ Integraciones guardadas");await reload()}catch(err){console.warn(err);toast(String(err?.message||"").includes("URL_HTTPS")?"✕ Revisa las URL: deben comenzar con https://":"✕ No fue posible guardar las integraciones")}}));
const TRANSBANK_DEFAULT_STOREFRONT_URL="https://aleatencioreposteria.cl/";
async function refreshTransbankHealth(showToast=false){
  const status=$("#transbankStatus"),env=$("#transbankEnvironment"),creds=$("#transbankCredentials"),callback=$("#pTransbankCallbackUrl");
  try{
    const out=await AleAPI.post("transbankhealth",{},token);
    if(env)env.textContent=out.environment==="PRODUCTION"?"Producción":"Integración / pruebas";
    if(creds){creds.textContent=out.credentials_ready?"Configuradas en servidor":"Pendientes en servidor";creds.classList.toggle("is-ok",!!out.credentials_ready);creds.classList.toggle("is-error",!out.credentials_ready)}
    if(callback)callback.value=out.callback_url||"";
    if(status){status.textContent=out.ready?"Listo para cobrar":(out.url_ready&&out.checkout_url_ready)?"Faltan credenciales":"Faltan dominios";status.classList.toggle("is-ready",!!out.ready);status.classList.toggle("is-warning",!out.ready)}
    if(showToast)toast(out.ready?"✓ Transbank está listo para crear transacciones":"Configuración incompleta: revisa dominios y Secrets del servidor");
    return out;
  }catch(err){console.warn("transbankhealth",err);if(status){status.textContent="No verificado";status.classList.remove("is-ready");status.classList.add("is-warning")}if(creds)creds.textContent="No verificado";if(callback)callback.value="";if(showToast)toast("✕ No fue posible verificar Transbank");return null}
}
const PAYMENT_SECRET_DEFAULTS=["TRANSBANK_COMMERCE_CODE","TRANSBANK_API_KEY_SECRET","TRANSBANK_ENVIRONMENT"];
let paymentSecretDrafts=[];
let paymentSecretsSaved=[];
function paymentSecretEsc(v){return esc(String(v||""))}
function paymentSecretDraft(name=""){return{id:`sec-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name:String(name||"").toUpperCase(),value:"",visible:false}}
function ensurePaymentSecretDrafts(){
  if(paymentSecretDrafts.length)return;
  const saved=new Set(paymentSecretsSaved.map(x=>String(x.name||"").toUpperCase()));
  const pending=PAYMENT_SECRET_DEFAULTS.filter(x=>!saved.has(x));
  (pending.length?pending:[""]).forEach(n=>paymentSecretDrafts.push(paymentSecretDraft(n)));
}
function renderPaymentSecretRows(){
  const host=$("#paymentSecretRows");if(!host)return;ensurePaymentSecretDrafts();
  host.innerHTML=paymentSecretDrafts.map((r,i)=>`<div class="payment-secret-row" data-secret-row="${paymentSecretEsc(r.id)}">
    <input class="secret-name-input" data-secret-name="${paymentSecretEsc(r.id)}" value="${paymentSecretEsc(r.name)}" placeholder="Ej: TRANSBANK_API_KEY_SECRET" autocomplete="off" spellcheck="false">
    <div class="secret-value-wrap"><input class="secret-value-input" data-secret-value="${paymentSecretEsc(r.id)}" type="${r.visible?"text":"password"}" value="${paymentSecretEsc(r.value)}" placeholder="Escribe el valor del Secret" autocomplete="new-password" spellcheck="false"><button type="button" class="secret-eye" data-secret-eye="${paymentSecretEsc(r.id)}" aria-label="${r.visible?"Ocultar":"Mostrar"} valor"><i class="bi ${r.visible?"bi-eye-slash":"bi-eye"}"></i></button></div>
    <button type="button" class="secret-row-remove" data-secret-remove="${paymentSecretEsc(r.id)}" aria-label="Quitar fila"><i class="bi bi-trash3"></i></button>
  </div>`).join("");
}
function renderPaymentSecretsExisting(){
  const host=$("#paymentSecretsExisting");if(!host)return;
  if(!paymentSecretsSaved.length){host.innerHTML='<span class="secret-empty">No hay Secrets de pasarela detectados.</span>';return}
  host.innerHTML=paymentSecretsSaved.map(s=>`<div class="stored-secret-item"><div><strong>${paymentSecretEsc(s.name)}</strong><span>••••••••••</span>${s.updated_at?`<small>Actualizado: ${paymentSecretEsc(formatDate(s.updated_at))}</small>`:""}</div><div class="stored-secret-actions"><button type="button" class="btn btn-light secret-replace-btn" data-secret-replace="${paymentSecretEsc(s.name)}"><i class="bi bi-pencil-square"></i> Reemplazar</button><button type="button" class="secret-delete-btn" data-secret-delete="${paymentSecretEsc(s.name)}" title="Eliminar Secret"><i class="bi bi-trash3"></i></button></div></div>`).join("");
}
async function loadPaymentSecrets(showToast=false){
  const panel=$("#paymentSecretsPanel"),status=$("#paymentSecretsManagerStatus"),bootstrap=$("#paymentSecretsBootstrap"),save=$("#savePaymentSecrets"),add=$("#addPaymentSecret");if(!panel)return;
  const isAdmin=String(data.currentUser?.rol||"").toUpperCase()==="ADMIN";
  if(!isAdmin){if(status){status.textContent="Solo Administrador";status.className="secret-manager-status is-warning"}if(bootstrap)bootstrap.classList.add("hidden");if(save)save.disabled=true;if(add)add.disabled=true;paymentSecretsSaved=[];paymentSecretDrafts=[];renderPaymentSecretRows();renderPaymentSecretsExisting();return}
  try{
    if(status){status.textContent="Consultando servidor…";status.className="secret-manager-status"}
    const out=await AleAPI.post("paymentsecretslist",{},token);paymentSecretsSaved=Array.isArray(out.secrets)?out.secrets:[];
    if(bootstrap)bootstrap.classList.toggle("hidden",!!out.bootstrap_ready);
    if(status){status.textContent=out.bootstrap_ready?"Conectado":"Activación inicial requerida";status.className=`secret-manager-status ${out.bootstrap_ready?"is-ready":"is-warning"}`}
    if(save)save.disabled=!out.bootstrap_ready;if(add)add.disabled=!out.bootstrap_ready;
    paymentSecretDrafts=[];renderPaymentSecretRows();renderPaymentSecretsExisting();if(showToast)toast(out.bootstrap_ready?"✓ Secrets del servidor actualizados":"Falta la activación inicial del gestor de Secrets");
  }catch(err){console.warn("paymentsecretslist",err);if(status){status.textContent="No disponible";status.className="secret-manager-status is-warning"}if(save)save.disabled=true;if(add)add.disabled=true;if(showToast)toast("✕ No fue posible consultar los Secrets del servidor")}
}
function addPaymentSecretDraft(name=""){const key=String(name||"").toUpperCase();if(key){const existing=paymentSecretDrafts.find(x=>String(x.name).toUpperCase()===key);if(existing){document.querySelector(`[data-secret-value="${CSS.escape(existing.id)}"]`)?.focus();return}paymentSecretDrafts.unshift(paymentSecretDraft(key))}else paymentSecretDrafts.push(paymentSecretDraft(""));renderPaymentSecretRows();const id=paymentSecretDrafts.find(x=>!x.name)?.id||paymentSecretDrafts[0]?.id;if(id)document.querySelector(`[data-secret-name="${CSS.escape(id)}"]`)?.focus()}
$("#paymentSecretRows")?.addEventListener("input",e=>{const n=e.target.closest("[data-secret-name]"),v=e.target.closest("[data-secret-value]");const id=n?.dataset.secretName||v?.dataset.secretValue;if(!id)return;const row=paymentSecretDrafts.find(x=>x.id===id);if(!row)return;if(n)row.name=String(n.value||"").toUpperCase().replace(/[^A-Z0-9_]/g,"");if(v)row.value=v.value});
$("#paymentSecretRows")?.addEventListener("click",e=>{const eye=e.target.closest("[data-secret-eye]"),rm=e.target.closest("[data-secret-remove]");if(eye){const row=paymentSecretDrafts.find(x=>x.id===eye.dataset.secretEye);if(row){row.visible=!row.visible;renderPaymentSecretRows()}return}if(rm){paymentSecretDrafts=paymentSecretDrafts.filter(x=>x.id!==rm.dataset.secretRemove);renderPaymentSecretRows()}});
$("#addPaymentSecret")?.addEventListener("click",()=>addPaymentSecretDraft(""));
$("#refreshPaymentSecrets")?.addEventListener("click",()=>loadPaymentSecrets(true));
$("#paymentSecretsExisting")?.addEventListener("click",async e=>{const rep=e.target.closest("[data-secret-replace]"),del=e.target.closest("[data-secret-delete]");if(rep){addPaymentSecretDraft(rep.dataset.secretReplace);return}if(del){const name=String(del.dataset.secretDelete||"");if(!name||!confirm(`¿Eliminar el Secret ${name} del servidor?\n\nLa pasarela puede dejar de funcionar hasta que vuelvas a configurarlo.`))return;try{await busy(del,()=>AleAPI.post("paymentsecretsdelete",{names:[name]},token));toast(`✓ Secret ${name} eliminado`);await loadPaymentSecrets(false);await refreshTransbankHealth(false)}catch(err){console.warn(err);toast("✕ No fue posible eliminar el Secret")}}});
$("#savePaymentSecrets")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const secrets=paymentSecretDrafts.map(r=>({name:String(r.name||"").trim().toUpperCase(),value:String(r.value||"")})).filter(x=>x.name||x.value);if(!secrets.length){toast("Agrega al menos un Secret para guardar");return}if(secrets.some(x=>!x.name||!x.value.trim())){toast("✕ Completa el nombre y el valor de cada Secret");return}await AleAPI.post("paymentsecretsset",{secrets},token);paymentSecretDrafts=[];toast("✓ Secrets guardados en el servidor. Los valores se limpiaron del navegador.");await loadPaymentSecrets(false);await refreshTransbankHealth(false)}catch(err){console.warn(err);const code=String(err?.message||err||"");if(code.includes("BOOTSTRAP"))toast("✕ Falta ALE_MANAGEMENT_TOKEN para activar el gestor");else if(code.includes("RESERVADO")||code.includes("SOLO_PASARELAS"))toast("✕ Ese nombre está reservado o no corresponde a una pasarela de pago");else toast("✕ No fue posible guardar los Secrets")}}));

function renderPayments(){const c=data.config||{},checkout=c.transbank_checkout_url||TRANSBANK_DEFAULT_STOREFRONT_URL;let returnUrl=c.transbank_return_url||checkout||TRANSBANK_DEFAULT_STOREFRONT_URL,manualUrl=c.transbank_payment_url||"";try{const legacyHost=returnUrl?new URL(returnUrl).hostname.toLowerCase():"";if(isTransbankHost(legacyHost)){if(!manualUrl)manualUrl=returnUrl;returnUrl=checkout||TRANSBANK_DEFAULT_STOREFRONT_URL}}catch(_){}if($("#pTransbankCheckoutUrl"))$("#pTransbankCheckoutUrl").value=checkout;if($("#pTransbankReturnUrl"))$("#pTransbankReturnUrl").value=returnUrl;if($("#pTransbankManualUrl"))$("#pTransbankManualUrl").value=manualUrl;refreshTransbankHealth(false);loadPaymentSecrets(false)}
$("#savePayments")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const checkoutRaw=$("#pTransbankCheckoutUrl")?.value.trim()||"",returnRaw=$("#pTransbankReturnUrl")?.value.trim()||"",manualRaw=$("#pTransbankManualUrl")?.value.trim()||"";const checkout=checkoutRaw?safeTransbankStorefrontUrl(checkoutRaw):"",returnUrl=returnRaw?safeTransbankStorefrontUrl(returnRaw):"",manualUrl=manualRaw?safeTransbankManualUrl(manualRaw):"";if(!checkout||!returnUrl){toast("✕ Debes indicar el dominio de tienda y el dominio de regreso");return}await AleAPI.post("saveConfig",{transbank_enabled:"SI",transbank_checkout_url:checkout,transbank_return_url:returnUrl,transbank_payment_url:manualUrl,transbank_button_label:"Pagar con Transbank"},token);toast("✓ Webpay Plus y Link Webpay manual guardados por separado. Verificando…");await reload();await refreshTransbankHealth(false)}catch(err){console.warn(err);const code=String(err?.message||"");if(code.includes("TRANSBANK_LINK_MANUAL_INVALIDO"))toast("✕ El Link Webpay manual debe pertenecer a webpay.cl o transbank.cl");else if(code.includes("TRANSBANK_DOMINIO_TIENDA_INVALIDO"))toast("✕ El dominio de tienda/regreso debe ser tu web, no Supabase ni Webpay");else toast(code.includes("TRANSBANK_URL")||code.includes("URL_HTTPS")?"✕ Revisa las URL HTTPS":"✕ No fue posible guardar Transbank")}}));
$("#testTransbankLink")?.addEventListener("click",()=>refreshTransbankHealth(true));
$("#openTransbankManualLink")?.addEventListener("click",()=>{try{const raw=$("#pTransbankManualUrl")?.value.trim()||"";if(!raw)return toast("Agrega primero el Link Webpay manual entregado por Transbank");const url=safeTransbankManualUrl(raw);window.open(url,"_blank","noopener,noreferrer")}catch(err){console.warn(err);toast("✕ El Link Webpay manual no es válido")}});

function syncStockVisibilitySetting(){const input=$("#sShowStockClients"),value=$("#sShowStockClientsValue"),hint=$("#sShowStockClientsHint");if(!input)return;const on=!!input.checked;if(value){value.textContent=on?"TRUE":"FALSE";value.classList.toggle("is-true",on);value.classList.toggle("is-false",!on)}if(hint)hint.textContent=on?"TRUE: la Web muestra el stock general disponible de cada producto.":"FALSE: el stock queda oculto en la Web; el cliente ve producto, tamaño y precio."}
function renderSettings(){const c=data.config||{};resetFilePicker("#sLogo");$("#sLogoId").value=c.logo_drive_file_id||"";$("#sBusiness").value=c.empresa||"";if($("#sBusinessRut"))$("#sBusinessRut").value=c.empresa_rut?formatRutChile(c.empresa_rut):"";if($("#sPublicWebUrl"))$("#sPublicWebUrl").value=c.web_public_url||c.transbank_checkout_url||window.ALE_ATENCIO_CONFIG?.PUBLIC_BASE_URL||"";$("#sWhatsapp").value=c.whatsapp||"";$("#sEmail").value=c.email||"";$("#sAddress").value=c.direccion||"";$("#sInstagram").value=c.instagram||"";$("#sFacebook").value=c.facebook||"";$("#sTiktok").value=c.tiktok||"";$("#sDelivery").value=c.valor_despacho||0;$("#sIva").value=c.iva_porcentaje||19;$("#sQuoteValidity").value=c.cotizacion_validez_dias||15;if($("#sDocumentFormat"))$("#sDocumentFormat").value=["A4","TICKET_80","TICKET_100"].includes(String(c.document_format||"").toUpperCase())?String(c.document_format).toUpperCase():"A4";if($("#sShowStockClients"))$("#sShowStockClients").checked=yesNo(c.mostrar_stock_clientes)==="SI";syncStockVisibilitySetting()}
if($("#sShowStockClients"))$("#sShowStockClients").addEventListener("change",()=>{syncStockVisibilitySetting();if($("#productShowStockClients")){$("#productShowStockClients").checked=$("#sShowStockClients").checked;const v=$("#productShowStockClientsValue");if(v){v.textContent=$("#productShowStockClients").checked?"TRUE":"FALSE";v.classList.toggle("is-true",$("#productShowStockClients").checked);v.classList.toggle("is-false",!$("#productShowStockClients").checked)}}});
$("#saveSettings").addEventListener("click",e=>busy(e.currentTarget,async()=>{try{let logoId=$("#sLogoId").value,logoUrl=data.config?.logo_url||"";const f=$("#sLogo").files[0];if(f){const up=await upload(f,"LOGO");logoId=up.fileId;logoUrl=up.imageUrl||logoUrl}const empresaRut=$("#sBusinessRut")?.value.trim()?requireRutChile($("#sBusinessRut").value):"";const publicWebUrl=clientPublicUrl($("#sPublicWebUrl")?.value.trim()||window.ALE_ATENCIO_CONFIG?.PUBLIC_BASE_URL||"");await AleAPI.post("saveConfig",{empresa:$("#sBusiness").value.trim(),empresa_rut:empresaRut,web_public_url:publicWebUrl,whatsapp:$("#sWhatsapp").value.trim(),email:$("#sEmail").value.trim(),direccion:$("#sAddress").value.trim(),instagram:$("#sInstagram").value.trim(),facebook:$("#sFacebook").value.trim(),tiktok:$("#sTiktok").value.trim(),valor_despacho:parseClpAmount($("#sDelivery").value),iva_porcentaje:$("#sIva").value,cotizacion_validez_dias:$("#sQuoteValidity").value,document_format:$("#sDocumentFormat")?.value||"A4",mostrar_stock_clientes:$("#sShowStockClients")?.checked?"SI":"NO",logo_drive_file_id:logoId,logo_url:logoUrl},token);toast("Configuración guardada");await reload()}catch(err){console.warn(err);toast("No fue posible guardar")}}));

async function upload(file,kind){if(file.size>6*1024*1024)throw new Error("IMAGEN_MUY_GRANDE");const dataUrl=await AleAPI.fileToDataUrl(file);return AleAPI.post("uploadImage",{kind,fileName:file.name,dataUrl},token)}
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
    precio_unitario:parseClpAmount(item.precio_unitario??item.precio??0)
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
    <div class="quote-price-shell"><span>CLP $</span><input class="quote-price" data-q-index="${i}" data-q-field="precio_unitario" type="text" inputmode="numeric" autocomplete="off" value="${new Intl.NumberFormat("es-CL",{maximumFractionDigits:0}).format(Number(x.precio_unitario||0))}"><button type="button" class="clp-voice-btn quote-voice-btn" data-q-voice="${i}" title="Dictar precio" aria-label="Dictar precio"><i class="bi bi-mic-fill"></i></button></div>
    <strong class="quote-line-total">${money(Number(x.cantidad||0)*Number(x.precio_unitario||0))}</strong>
    <button type="button" class="quote-remove" data-q-remove="${i}" aria-label="Quitar línea"><i class="bi bi-trash3"></i></button>
  </div>`).join("");
  updateQuoteTotals();
}
$("#quoteItems")?.addEventListener("input",e=>{
  const el=e.target.closest("[data-q-index]"); if(!el)return;
  const i=Number(el.dataset.qIndex), field=el.dataset.qField; if(!quoteDraftItems[i])return;
  quoteDraftItems[i][field]=field==="descripcion"?el.value:field==="precio_unitario"?parseClpAmount(el.value):toNumber(el.value);
  const row=el.closest(".quote-item-row");
  const item=quoteDraftItems[i];
  row?.querySelector(".quote-line-total")?.replaceChildren(document.createTextNode(money(Number(item.cantidad||0)*Number(item.precio_unitario||0))));
  updateQuoteTotals();
});
$("#quoteItems")?.addEventListener("click",e=>{
  const voice=e.target.closest("[data-q-voice]");if(voice){const input=voice.closest(".quote-price-shell")?.querySelector(".quote-price");if(input)listenClpAmount(input,voice);return}
  const b=e.target.closest("[data-q-remove]"); if(!b)return;
  quoteDraftItems.splice(Number(b.dataset.qRemove),1);renderQuoteItems();
});
$("#quoteItems")?.addEventListener("focusout",e=>{const input=e.target.closest(".quote-price");if(input)normalizeClpInput(input)});
$("#qIva")?.addEventListener("input",updateQuoteTotals);

// R9.8 · Combo filtrable para asociar una solicitud a la cotización.
let quoteRequestHighlight=-1;
function requestLabel(r){return `${r.numero_solicitud||r.id||"Solicitud"} · ${r.nombre||"Cliente"}${r.rut?` · ${formatRutChile(r.rut)}`:""}${r.telefono?` · ${r.telefono}`:""}`}
function requestConsumedQuoteId(r){return String(r?.cotizacion_id||"").trim()}
function requestConsumedForOtherQuote(r){
  const used=requestConsumedQuoteId(r),current=String($("#qId")?.value||"").trim();
  return !!used&&used!==current;
}
function setQuoteRequestLocked(locked=false){
  const search=$("#qRequestSearch"),toggle=$("#toggleQuoteRequest"),clear=$("#clearQuoteRequest");
  if(search){search.readOnly=!!locked;search.setAttribute("aria-disabled",String(!!locked))}
  if(toggle)toggle.disabled=!!locked;
  if(clear)clear.disabled=!!locked;
}
function quoteRequestCandidates(term=""){
  const raw=String(term??"").trim();
  return (data.requests||[]).slice().sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0)).filter(r=>{
    if(requestConsumedForOtherQuote(r))return false;
    return flexibleSearchMatch([r.numero_solicitud,r.id,r.nombre,r.rut,r.telefono,r.email,r.tipo,r.detalle],raw);
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
  host.innerHTML=rows.map((r,i)=>`<button type="button" class="request-option ${i===quoteRequestHighlight?"is-active":""}" role="option" aria-selected="${i===quoteRequestHighlight}" data-request-id="${esc(r.id)}"><strong>${esc(r.numero_solicitud||r.id||"")}</strong><span class="request-option-main"><b>${esc(r.nombre||"Cliente")}</b><small>${esc([r.rut?formatRutChile(r.rut):"",r.telefono,r.email].filter(Boolean).join(" · ")||r.tipo||"")}</small></span><span class="request-option-state">${esc(r.estado||"NUEVA")}</span></button>`).join("");
  setQuoteRequestResultsOpen(true);
  host.querySelector('.request-option.is-active')?.scrollIntoView({block:'nearest'});
}
function linkRequestToQuote(r,{replaceLine=true}={}){
  if(!r)return;
  if(requestConsumedForOtherQuote(r)){toast(`✕ La solicitud ${r.numero_solicitud||r.id} ya fue utilizada en ${r.cotizacion_numero||"otra cotización"}.`);return}
  $("#qRequestId").value=r.id||"";
  $("#qRequestNumber").textContent=r.numero_solicitud||r.id||"";
  $("#qRequestSearch").value=requestLabel(r);
  $("#qRequestSearch").dataset.selectedRequestId=String(r.id||"");
  $("#qClient").value=r.nombre||"";
  if($("#qRut"))$("#qRut").value=r.rut?formatRutChile(r.rut):"";
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
  if($("#qRut")){$("#qRut").readOnly=false;$("#qRut").classList.remove("linked-phone")}
  $("#qPhone").readOnly=false;$("#qPhone").classList.remove("linked-phone");$("#qPhone").title="";
  const help=$("#qRequestHelp");if(help){help.textContent="Busca por número, cliente, RUT, teléfono o correo. Puedes dejar la cotización sin solicitud asociada.";help.classList.remove("is-linked")}
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
  ["qId","qRequestId","qPdfUrl","qClient","qRut","qPhone","qEmail","qObservations"].forEach(id=>{const el=$("#"+id);if(el)el.value=""});
  setQuoteRequestLocked(false);
  if($("#qPhone")){ $("#qPhone").readOnly=false; $("#qPhone").classList.remove("linked-phone"); $("#qPhone").title=""; }
  $("#qNumber").textContent="Se asignará al guardar";
  $("#qRequestNumber").textContent="Sin solicitud asociada";
  if($("#qRequestSearch")){ $("#qRequestSearch").value=""; delete $("#qRequestSearch").dataset.selectedRequestId; }
  if($("#qRequestHelp")){$("#qRequestHelp").textContent="Busca por número, cliente, RUT, teléfono o correo. Puedes dejar la cotización sin solicitud asociada.";$("#qRequestHelp").classList.remove("is-linked")}
  setQuoteRequestResultsOpen(false);
  $("#qValidity").value=Number(data.config?.cotizacion_validez_dias||15)||15;
  $("#qIva").value=Number(data.config?.iva_porcentaje||19);
  $("#qStatus").value="BORRADOR";
  if($("#saveQuote")){ $("#saveQuote").disabled=false; $("#saveQuote").title="Guardar cotización"; }
  setClientLookupState("#qClientLookupState","Ingresa un RUT válido para buscar en Clientes.");
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
    if(linkedRequest&&$("#qRequestHelp")){ $("#qRequestHelp").textContent=`Asociada a ${linkedRequest.numero_solicitud||linkedRequest.id}. Esta solicitud ya está consumida por esta cotización y no puede reasignarse.`; $("#qRequestHelp").classList.add("is-linked") }
    if(quote.solicitud_id)setQuoteRequestLocked(true);
    $("#qClient").value=quote.cliente_nombre||"";
    if($("#qRut"))$("#qRut").value=quote.rut?formatRutChile(quote.rut):"";
    $("#qPhone").value=quote.telefono||"";
    $("#qPhone").readOnly=!!linkedRequest?.telefono;$("#qPhone").classList.toggle("linked-phone",!!linkedRequest?.telefono);$("#qPhone").title=linkedRequest?.telefono?"WhatsApp ligado automáticamente a la solicitud":"";
    $("#qEmail").value=quote.email||"";
    $("#qValidity").value=quote.validez_dias||15;
    $("#qIva").value=quote.iva_porcentaje??19;
    $("#qStatus").value=quoteIsConsumed(quote)?"UTILIZADA":(quote.estado||"BORRADOR");
    if($("#saveQuote")&&quoteIsConsumed(quote)){ $("#saveQuote").disabled=true; $("#saveQuote").title="Cotización utilizada: los datos comerciales están bloqueados. Corrige los datos personales desde Clientes."; }
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
window.quoteFromRequest=id=>{const r=data.requests.find(x=>String(x.id)===String(id));if(!r)return toast("Solicitud no encontrada");if(requestConsumedQuoteId(r))return toast(`✕ Esta solicitud ya fue utilizada en ${r.cotizacion_numero||"una cotización"}.`);openAdminView("quotes");openQuoteEditor(null,r)};
window.editQuote=id=>{const q=data.quotes.find(x=>String(x.id)===String(id));if(!q)return toast("Cotización no encontrada");openQuoteEditor(q,null)};

function quotePayload(){
  return {
    id:$("#qId").value,
    solicitud_id:$("#qRequestId").value,
    numero_solicitud:$("#qRequestNumber").textContent.includes("Sin solicitud")?"":$("#qRequestNumber").textContent.trim(),
    cliente_nombre:$("#qClient").value.trim(),
    rut:requireRutChile($("#qRut").value),
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
  if(q.solicitud_id){
    const r=(data.requests||[]).find(x=>String(x.id)===String(q.solicitud_id));
    if(r){r.cotizacion_id=q.id;r.cotizacion_numero=q.numero_cotizacion||q.id;r._consumida=true;r.estado="COTIZADA";}
    setQuoteRequestLocked(true);renderRequests();
  }
  renderQuotes();
  return q;
}

function renderQuotes(){
  const host=$("#quotesTable");if(!host)return;
  pruneSelection("quotes",data.quotes);
  const canDelete=!!data.permissions?.quotes?.delete;if(!canDelete)selectedSet("quotes").clear();
  const visibleQuotes=filteredCommercialRows("quotes",data.quotes);updateCommercialFilterUi("quotes",visibleQuotes.length,data.quotes.length);
  const visibleIds=visibleQuotes.map(q=>String(q.id));
  const headers=canDelete?[`<span class="bulk-select-col">${bulkHeaderCheckbox("quotes",visibleIds)}</span>`,"N.º cotización","Solicitud","Fecha","Cliente","Neto","IVA","Total","Estado","PDF","Acciones"]:["N.º cotización","Solicitud","Fecha","Cliente","Neto","IVA","Total","Estado","PDF","Acciones"];
  const rows=visibleQuotes.map(q=>{const selected=selectedSet("quotes").has(String(q.id));return `<tr class="${selected?"is-selected":""}">
    ${canDelete?`<td class="bulk-select-col">${quoteIsConsumed(q)?`<span class="bulk-locked" title="Cotización UTILIZADA: no se puede eliminar"><i class="bi bi-lock-fill"></i></span>`:bulkCheckbox("quotes",q.id)}</td>`:""}
    <td><strong>${esc(q.numero_cotizacion||q.id)}</strong></td>
    <td>${esc(q.numero_solicitud||"-")}</td>
    <td>${esc(formatDate(q.fecha||q.creado_en))}</td>
    <td><strong>${esc(q.cliente_nombre||"")}</strong><br><small>${esc(q.rut?formatRutChile(q.rut):"RUT sin registrar")} · ${esc(q.telefono||"")}</small></td>
    <td>${money(q.subtotal)}</td>
    <td>${money(q.iva)}<br><small>${esc(q.iva_porcentaje||19)}%</small></td>
    <td><strong>${money(q.total)}</strong></td>
    <td>${quoteIsConsumed(q)?`<span class="quote-used-badge" title="${esc(q.pedido_numero?`Utilizada en ${q.pedido_numero}`:"Cotización utilizada en un pedido")}">UTILIZADA${q.pedido_numero?` · ${esc(q.pedido_numero)}`:""}</span>`:`<select class="status-select" onchange="changeQuoteStatus('${q.id}',this.value)">${["BORRADOR","ENVIADA","ACEPTADA","RECHAZADA","VENCIDA","ANULADA"].map(st=>`<option ${String(q.estado).toUpperCase()===st?"selected":""}>${st}</option>`).join("")}</select>`}</td>
    <td>${q.pdf_url?`<a class="pdf-link" href="${esc(q.pdf_url)}" target="_blank" rel="noopener"><i class="bi bi-file-earmark-pdf"></i> PDF</a>`:"Pendiente"}</td>
    <td><div class="row-actions"><button type="button" onclick="editQuote('${q.id}')">Editar</button><button type="button" onclick="generateQuoteFromList('${q.id}',this)"><i class="bi bi-file-earmark-pdf"></i></button><button type="button" onclick="sendQuoteFromList('${q.id}',this)"><i class="bi bi-whatsapp"></i></button>${canDelete&&!quoteIsConsumed(q)?`<button type="button" class="danger" onclick="deleteQuote('${q.id}',this)" title="Eliminar cotización"><i class="bi bi-trash3"></i></button>`:canDelete&&quoteIsConsumed(q)?`<span class="request-closed-lock" title="Cotización utilizada: protegida por trazabilidad"><i class="bi bi-shield-lock"></i> Protegida</span>`:""}</div></td>
  </tr>`}).join("");
  host.innerHTML=table(headers,rows);updateBulkBar("quotes");syncSelectedRows(host);
}
$("#quotesTable")?.addEventListener("change",e=>{
  if(handleBulkCheckboxChange(e))return;
  const all=e.target.closest('input[data-bulk-select-all="quotes"]');if(all){handleBulkSelectAllChange(e,filteredCommercialRows("quotes",data.quotes).map(q=>String(q.id)));renderQuotes()}
});
$("#deleteSelectedQuotes")?.addEventListener("click",e=>deleteSelected("quotes",e.currentTarget));
window.deleteQuote=async(id,btn)=>{
  const q=data.quotes.find(x=>String(x.id)===String(id));
  const label=q?.numero_cotizacion||id;
  if(!confirm(`¿Eliminar definitivamente la cotización ${label}?\n\nSi tiene PDF almacenado en Supabase, también será eliminado.`))return;
  await busy(btn,async()=>{try{const out=await AleAPI.post("deleteEntity",{kind:"quote",id},token);if(!out?.deleted)throw new Error("COTIZACION_NO_ELIMINADA");selectedSet("quotes").delete(String(id));toast("✓ Cotización eliminada");await reload()}catch(e){console.warn(e);toast("✕ No fue posible eliminar la cotización")}});
};
window.changeQuoteStatus=async(id,status)=>{try{const out=await AleAPI.post("updatequotestatus",{id,status},token);const ix=data.quotes.findIndex(x=>String(x.id)===String(id));if(ix>=0&&out.quote)data.quotes[ix]=out.quote;toast("Estado de cotización actualizado");renderQuotes()}catch(e){console.warn(e);const code=String(e?.message||e||"").toUpperCase();toast(code.includes("COTIZACION_UTILIZADA_BLOQUEADA")?"Esta cotización ya fue utilizada en un pedido y su estado queda en UTILIZADA":"No fue posible actualizar el estado");await loadAdminModules({modules:["quotes"],retry:true})}};

function addCatalogProductToQuote(){
  const id=$("#quoteProductPicker").value;if(!id)return toast("Selecciona un producto");
  const p=data.products.find(x=>String(x.id)===String(id));if(!p)return;
  quoteDraftItems.push(newQuoteItem({descripcion:p.nombre,cantidad:1,precio_unitario:p.precio}));renderQuoteItems();
}
$("#addQuoteProduct")?.addEventListener("click",addCatalogProductToQuote);
$("#addQuoteLine")?.addEventListener("click",()=>{quoteDraftItems.push(newQuoteItem());renderQuoteItems()});
$("#newQuote")?.addEventListener("click",()=>openQuoteEditor());
$("#closeQuoteEditorX")?.addEventListener("click",closeQuoteEditor);
wireClientRutLookup({rutSelector:"#qRut",statusSelector:"#qClientLookupState",fields:{name:"#qClient",phone:"#qPhone",email:"#qEmail"},guard:()=>!String($("#qRequestId")?.value||"").trim()});
$("#saveQuote")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const q=await persistQuote();toast(`Cotización ${q.numero_cotizacion||""} guardada`)}catch(err){console.warn(err);const code=String(err?.message||err||"").toUpperCase();toast(code.includes("COTIZACION_UTILIZADA_BLOQUEADA")?"✕ Esta cotización ya fue utilizada en un pedido. Sus datos comerciales quedan bloqueados; los datos del cliente se sincronizan desde Clientes.":code.includes("SOLICITUD_YA_CONVERTIDA_EN_COTIZACION")?"✕ Esa solicitud ya fue utilizada en otra cotización.":code.includes("SOLICITUD_COTIZACION_NO_REASIGNABLE")?"✕ Una solicitud ya vinculada no puede reasignarse a otra cotización.":code.includes("TELEFONO_YA_ASOCIADO")?"✕ Ese teléfono ya está asociado a otro RUT en Clientes.":code.includes("EMAIL_YA_ASOCIADO")?"✕ Ese correo ya está asociado a otro RUT en Clientes.":"No fue posible guardar la cotización")}}));

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
function configuredDocumentFormat(){const f=String(data.config?.document_format||"A4").toUpperCase();return ["A4","TICKET_80","TICKET_100"].includes(f)?f:"A4"}
function documentFormatLabel(f=configuredDocumentFormat()){return f==="TICKET_80"?"Ticket 80 mm":f==="TICKET_100"?"Ticket 100 mm":"A4"}
async function qrDataUrl(url){
  if(!url)return "";
  try{
    if(!window.QRCode?.toDataURL){console.warn("PDF_QR_LIBRERIA_NO_DISPONIBLE");return ""}
    return await window.QRCode.toDataURL(String(url),{width:720,margin:1,errorCorrectionLevel:"M"})
  }catch(err){
    console.warn("PDF_QR_NO_DISPONIBLE",err);
    return "";
  }
}
function clpPdf(v){return money(v).replace("CLP","$").trim()}
function centeredText(doc,text,w,y,size=8,bold=false){doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);doc.text(String(text||""),w/2,y,{align:"center"})}
function drawA4PdfHeader(doc,{company,logo,qr,left=18,right=192,top=12,companyLines=[]}={}){
  const qrSize=30;
  const logoBox={x:left,y:top,w:36,h:22};
  let textX=left;
  if(logo){
    try{
      const props=doc.getImageProperties(logo),ratio=Math.min(logoBox.w/props.width,logoBox.h/props.height);
      const w=props.width*ratio,h=props.height*ratio;
      const y=top+((logoBox.h-h)/2);
      doc.addImage(logo,pdfImageType(logo),logoBox.x,y,w,h,undefined,"FAST");
      textX=logoBox.x+logoBox.w+6;
    }catch(_){textX=left;}
  }
  if(qr){
    try{
      doc.addImage(qr,"PNG",right-qrSize,10,qrSize,qrSize,undefined,"FAST");
      doc.setFont("helvetica","normal");
      doc.setFontSize(7);
      doc.text("Seguimiento / trazabilidad",right-qrSize/2,43,{align:"center"});
    }catch(_){ }
  }
  doc.setTextColor(68,47,39);
  doc.setFont("helvetica","bold");
  doc.setFontSize(18);
  doc.text(String(company||"Ale Atencio"),textX,18,{align:"left"});
  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  companyLines.filter(Boolean).forEach((line,i)=>doc.text(String(line),textX,24+i*4.5,{align:"left",maxWidth:120}));
  doc.setDrawColor(220,204,197);
  doc.line(left,48,right,48);
}
async function buildQuotePdfData(quote,traceUrl=""){
  const JsPDF=window.jspdf?.jsPDF;if(!JsPDF)throw new Error("LIBRERIA_PDF_NO_DISPONIBLE");
  const format=configuredDocumentFormat(),company=data.config?.empresa||"Ale Atencio",logo=await imageUrlToDataUrl(data.config?.logo_url||"logo-ale-atencio.png"),qr=await qrDataUrl(traceUrl);
  if(format!=="A4"){
    const width=format==="TICKET_100"?100:80,margin=5,content=width-margin*2,temp=new JsPDF({unit:"mm",format:"a4"});
    temp.setFont("helvetica","normal");temp.setFontSize(8);
    const split=(t,w=content)=>temp.splitTextToSize(String(t||""),w),items=Array.isArray(quote.items)?quote.items:[];
    let height=58+items.reduce((sum,it)=>sum+Math.max(13,split(it.descripcion||it.nombre||"Producto").length*4+10),0)+45;
    height+=quote.observaciones?split(quote.observaciones).length*4+14:0;height+=58; height=Math.max(170,Math.min(1200,height));
    const doc=new JsPDF({unit:"mm",format:[width,height],orientation:"portrait"});let y=7;
    if(logo){try{const props=doc.getImageProperties(logo),maxW=width===100?38:34,maxH=18,ratio=Math.min(maxW/props.width,maxH/props.height);const w=props.width*ratio,h=props.height*ratio;doc.addImage(logo,pdfImageType(logo),(width-w)/2,y,w,h,undefined,"FAST");y+=h+3}catch(_){}}
    doc.setTextColor(50,40,36);centeredText(doc,company,width,y+3,12,true);y+=7;doc.setFontSize(7.5);doc.setFont("helvetica","normal");
    for(const line of [data.config?.empresa_rut?`RUT: ${formatRutChile(data.config.empresa_rut)}`:"",data.config?.direccion,data.config?.email,data.config?.whatsapp?`WhatsApp: ${data.config.whatsapp}`:""].filter(Boolean)){for(const l of split(line)){doc.text(l,width/2,y,{align:"center"});y+=3.6}}
    y+=2;doc.setDrawColor(210,195,188);doc.line(margin,y,width-margin,y);y+=6;centeredText(doc,"COTIZACIÓN",width,y,11,true);y+=5;centeredText(doc,quote.numero_cotizacion||quote.id||"",width,y,8.5,true);y+=5;
    doc.setFont("helvetica","normal");doc.setFontSize(7.5);centeredText(doc,`Fecha: ${new Date(quote.fecha||quote.creado_en||Date.now()).toLocaleDateString("es-CL")}`,width,y,7.5);y+=4;centeredText(doc,`Validez: ${quote.validez_dias||15} días`,width,y,7.5);y+=6;
    doc.setFont("helvetica","bold");doc.text("CLIENTE",margin,y);y+=4;doc.setFont("helvetica","normal");for(const line of [quote.cliente_nombre,quote.rut?`RUT: ${formatRutChile(quote.rut)}`:"",quote.telefono?`Tel: ${quote.telefono}`:"",quote.email?`Correo: ${quote.email}`:"",quote.numero_solicitud?`Solicitud: ${quote.numero_solicitud}`:""].filter(Boolean)){for(const l of split(line)){doc.text(l,margin,y);y+=3.8}}y+=2;
    doc.setDrawColor(225,214,209);doc.line(margin,y,width-margin,y);y+=5;doc.setFont("helvetica","bold");doc.text("DETALLE",margin,y);y+=4;
    for(const item of items){doc.setFont("helvetica","bold");for(const l of split(item.descripcion||item.nombre||"Producto")){doc.text(l,margin,y);y+=3.8}doc.setFont("helvetica","normal");doc.setFontSize(7.2);const qty=Number(item.cantidad||0),unit=clpPdf(item.precio_unitario),total=clpPdf(item.total??qty*Number(item.precio_unitario||0));doc.text(`${qty} x ${unit}`,margin,y);doc.text(total,width-margin,y,{align:"right"});y+=5;doc.setDrawColor(238,231,227);doc.line(margin,y-2,width-margin,y-2)}
    y+=2;const totals=[["Subtotal neto",quote.subtotal],[`IVA ${quote.iva_porcentaje??19}%`,quote.iva],["TOTAL",quote.total]];for(const [label,val] of totals){const total=label==="TOTAL";doc.setFont("helvetica",total?"bold":"normal");doc.setFontSize(total?10:8);doc.text(String(label),margin,y);doc.text(clpPdf(val),width-margin,y,{align:"right"});y+=total?6:4.5}
    if(quote.observaciones){y+=2;doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text("OBSERVACIONES",margin,y);y+=4;doc.setFont("helvetica","normal");doc.setFontSize(7.2);for(const l of split(quote.observaciones)){doc.text(l,margin,y);y+=3.6}}
    y+=3;doc.setDrawColor(210,195,188);doc.line(margin,y,width-margin,y);y+=5;doc.setFontSize(7);doc.setFont("helvetica","normal");for(const l of split("Escanea el QR para consultar la trazabilidad actualizada del documento y del pedido cuando corresponda.")){doc.text(l,width/2,y,{align:"center"});y+=3.3}y+=2;
    if(qr){doc.addImage(qr,"PNG",(width-40)/2,y,40,40,undefined,"FAST");y+=43}centeredText(doc,"TRAZABILIDAD",width,y,7.5,true);y+=5;doc.setFontSize(6.5);centeredText(doc,`${company} · ${quote.numero_cotizacion||"Cotización"}`,width,y,6.5);
    return {doc,dataUrl:doc.output("datauristring"),format};
  }
  const doc=new JsPDF({unit:"mm",format:"a4",orientation:"portrait"}),pageW=210,pageH=297,left=18,right=192;
  const companyLines=[data.config?.empresa_rut?`RUT: ${formatRutChile(data.config.empresa_rut)}`:"",data.config?.direccion,data.config?.email,data.config?.whatsapp?`WhatsApp: ${data.config.whatsapp}`:""].filter(Boolean);
  drawA4PdfHeader(doc,{company,logo,qr,left,right,top:12,companyLines});
  doc.setFont("helvetica","bold");doc.setFontSize(20);doc.text("COTIZACIÓN",left,59);doc.setFontSize(11);doc.text(String(quote.numero_cotizacion||quote.id||""),right,57,{align:"right"});doc.setFont("helvetica","normal");doc.setFontSize(9);doc.text(`Fecha: ${new Date(quote.fecha||quote.creado_en||Date.now()).toLocaleDateString("es-CL")}`,right,63,{align:"right"});doc.text(`Validez: ${quote.validez_dias||15} días`,right,68,{align:"right"});let y=75;
  doc.setFont("helvetica","bold");doc.text("Cliente",left,y);doc.setFont("helvetica","normal");doc.text(String(quote.cliente_nombre||""),left,y+5);let clientY=y+10;if(quote.rut){doc.text(`RUT: ${formatRutChile(quote.rut)}`,left,clientY);clientY+=5}if(quote.telefono){doc.text(`Teléfono: ${quote.telefono}`,left,clientY);clientY+=5}if(quote.email)doc.text(`Correo: ${quote.email}`,left,clientY);if(quote.numero_solicitud){doc.setFont("helvetica","bold");doc.text(`Solicitud: ${quote.numero_solicitud}`,right,y,{align:"right"});doc.setFont("helvetica","normal")}y+=25;
  const col={desc:left,qty:125,price:145,total:right},drawHeader=()=>{doc.setFillColor(248,241,238);doc.rect(left,y,right-left,9,"F");doc.setFont("helvetica","bold");doc.text("Descripción",col.desc+2,y+6);doc.text("Cant.",col.qty,y+6,{align:"right"});doc.text("P. unitario",col.price+20,y+6,{align:"right"});doc.text("Total",col.total,y+6,{align:"right"});doc.setFont("helvetica","normal");y+=12};drawHeader();
  for(const item of quote.items||[]){const lines=doc.splitTextToSize(String(item.descripcion||""),78),h=Math.max(7,lines.length*4.5+2);if(y+h>245){doc.addPage();y=18;drawHeader()}doc.text(lines,col.desc+2,y+4);doc.text(String(item.cantidad??""),col.qty,y+4,{align:"right"});doc.text(clpPdf(item.precio_unitario),col.price+20,y+4,{align:"right"});doc.text(clpPdf(item.total??(Number(item.cantidad||0)*Number(item.precio_unitario||0))),col.total,y+4,{align:"right"});doc.setDrawColor(235,225,220);doc.line(left,y+h,right,y+h);y+=h+2}
  if(y>230){doc.addPage();y=22}y+=5;doc.setFont("helvetica","normal");doc.text("Subtotal neto",160,y,{align:"right"});doc.setFont("helvetica","bold");doc.text(clpPdf(quote.subtotal),right,y,{align:"right"});y+=7;doc.setFont("helvetica","normal");doc.text(`IVA ${quote.iva_porcentaje??19}%`,160,y,{align:"right"});doc.setFont("helvetica","bold");doc.text(clpPdf(quote.iva),right,y,{align:"right"});y+=8;doc.setFontSize(12);doc.text("TOTAL",160,y,{align:"right"});doc.text(clpPdf(quote.total),right,y,{align:"right"});doc.setFontSize(9);if(quote.observaciones){y+=14;doc.setFont("helvetica","bold");doc.text("Observaciones",left,y);doc.setFont("helvetica","normal");doc.text(doc.splitTextToSize(String(quote.observaciones),174),left,y+5)}
  const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(125,108,100);doc.text(`${company} · ${quote.numero_cotizacion||"Cotización"}`,left,pageH-10);doc.text(`Página ${i} de ${pages}`,right,pageH-10,{align:"right"})}return {doc,dataUrl:doc.output("datauristring"),format};
}
async function buildRequestPdfData(request,traceUrl=""){
  const JsPDF=window.jspdf?.jsPDF;if(!JsPDF)throw new Error("LIBRERIA_PDF_NO_DISPONIBLE");const format=configuredDocumentFormat(),company=data.config?.empresa||"Ale Atencio",logo=await imageUrlToDataUrl(data.config?.logo_url||"logo-ale-atencio.png"),qr=await qrDataUrl(traceUrl),ticket=format!=="A4",width=format==="TICKET_100"?100:format==="TICKET_80"?80:210,margin=ticket?5:18,content=width-margin*2;
  let height=297;if(ticket){const temp=new JsPDF({unit:"mm",format:"a4"});temp.setFontSize(8);const split=t=>temp.splitTextToSize(String(t||""),content);height=145+(request.detalle?split(request.detalle).length*4:0)+(request.nombre?8:0);height=Math.max(170,Math.min(800,height));}
  const doc=new JsPDF({unit:"mm",format:ticket?[width,height]:"a4",orientation:"portrait"});let y=ticket?7:12;
  if(logo){try{if(ticket){const props=doc.getImageProperties(logo),maxW=width===100?38:34,maxH=18,ratio=Math.min(maxW/props.width,maxH/props.height);const w=props.width*ratio,h=props.height*ratio;doc.addImage(logo,pdfImageType(logo),(width-w)/2,y,w,h,undefined,"FAST");y+=h+4}else doc.addImage(logo,pdfImageType(logo),margin,y,48,24,undefined,"FAST")}catch(_){}}
  if(ticket){centeredText(doc,company,width,y+2,12,true);y+=7;doc.setFontSize(7.5);for(const line of [data.config?.empresa_rut?`RUT: ${formatRutChile(data.config.empresa_rut)}`:"",data.config?.direccion,data.config?.email,data.config?.whatsapp?`WhatsApp: ${data.config.whatsapp}`:""].filter(Boolean)){doc.text(String(line),width/2,y,{align:"center",maxWidth:content});y+=4}doc.setDrawColor(215,200,192);doc.line(margin,y,width-margin,y);y+=7;centeredText(doc,"SOLICITUD",width,y,11,true);y+=5;centeredText(doc,request.numero_solicitud||request.id||"",width,y,8.5,true);y+=7;doc.setFont("helvetica","normal");doc.setFontSize(8);for(const [label,val] of [["Fecha",new Date(request.fecha||Date.now()).toLocaleString("es-CL")],["Cliente",request.nombre],["RUT",request.rut?formatRutChile(request.rut):""],["Teléfono",request.telefono],["Correo",request.email],["Tipo",request.tipo],["Evento",request.fecha_evento],["Cantidad",request.cantidad],["Pago preferido",request.medio_pago_preferido],["Estado",request.estado]].filter(x=>x[1])){doc.setFont("helvetica","bold");doc.text(`${label}:`,margin,y);doc.setFont("helvetica","normal");const lines=doc.splitTextToSize(String(val),content-24);doc.text(lines,margin+24,y);y+=Math.max(4,lines.length*3.8)}if(request.detalle){y+=3;doc.setFont("helvetica","bold");doc.text("DETALLE",margin,y);y+=4;doc.setFont("helvetica","normal");for(const l of doc.splitTextToSize(String(request.detalle),content)){doc.text(l,margin,y);y+=3.8}}y+=5;doc.line(margin,y,width-margin,y);y+=5;doc.setFontSize(7);for(const l of doc.splitTextToSize("Escanea el QR para consultar la trazabilidad actualizada de esta solicitud y del pedido cuando corresponda.",content)){doc.text(l,width/2,y,{align:"center"});y+=3.3}y+=2;if(qr){doc.addImage(qr,"PNG",(width-40)/2,y,40,40,undefined,"FAST");y+=43}centeredText(doc,"TRAZABILIDAD",width,y,7.5,true);return {doc,dataUrl:doc.output("datauristring"),format}}
  const right=192;drawA4PdfHeader(doc,{company,logo,qr,left:margin,right,top:12,companyLines:[data.config?.empresa_rut?`RUT: ${formatRutChile(data.config.empresa_rut)}`:"",data.config?.direccion,data.config?.email,data.config?.whatsapp?`WhatsApp: ${data.config.whatsapp}`:""].filter(Boolean)});doc.setFont("helvetica","bold");doc.setFontSize(20);doc.text("SOLICITUD",margin,60);doc.setFontSize(11);doc.text(String(request.numero_solicitud||request.id||""),right,58,{align:"right"});y=73;doc.setFontSize(9);for(const [label,val] of [["Fecha",new Date(request.fecha||Date.now()).toLocaleString("es-CL")],["Cliente",request.nombre],["RUT",request.rut?formatRutChile(request.rut):""],["Teléfono",request.telefono],["Correo",request.email],["Tipo",request.tipo],["Evento",request.fecha_evento],["Cantidad",request.cantidad],["Pago preferido",request.medio_pago_preferido],["Estado",request.estado]].filter(x=>x[1])){doc.setFont("helvetica","bold");doc.text(`${label}:`,margin,y);doc.setFont("helvetica","normal");const lines=doc.splitTextToSize(String(val),120);doc.text(lines,58,y);y+=Math.max(6,lines.length*4.5)}if(request.detalle){y+=4;doc.setFont("helvetica","bold");doc.text("Detalle",margin,y);doc.setFont("helvetica","normal");doc.text(doc.splitTextToSize(String(request.detalle),174),margin,y+6)}doc.setFontSize(8);doc.setTextColor(125,108,100);doc.text(`${company} · ${request.numero_solicitud||"Solicitud"}`,margin,287);return {doc,dataUrl:doc.output("datauristring"),format};
}
async function generateRequestPdf(request,download=true){
  if(!request?.id)throw new Error("SOLICITUD_NO_ENCONTRADA");
  let traceUrl="";
  try{
    const shared=await AleAPI.post("requestsharelink",{id:request.id},token);
    traceUrl=shared?.trace_url||shared?.public_url||"";
  }catch(err){
    // El enlace/QR es complementario. Nunca debe impedir generar o reimprimir el PDF.
    console.warn("PDF_SOLICITUD_SIN_TRAZABILIDAD",err);
  }
  const built=await buildRequestPdfData(request,traceUrl);
  if(download)built.doc.save(`${request.numero_solicitud||"solicitud"}.pdf`);
  return built;
}
window.generateRequestPdfFromList=async(id,btn)=>busy(btn,async()=>{try{const r=data.requests.find(x=>String(x.id)===String(id));if(!r)throw new Error("SOLICITUD_NO_ENCONTRADA");await generateRequestPdf(r,true);toast(`PDF ${documentFormatLabel()} generado`)}catch(err){console.warn(err);toast("No fue posible generar el PDF de la solicitud")}});

async function generateAndUploadQuotePdf(quote,download=true){
  const saved=quote?.id?quote:await persistQuote();
  const fresh=data.quotes.find(x=>String(x.id)===String(saved.id))||saved;
  let traceUrl="";
  try{
    const shared=await AleAPI.post("quotesharelink",{id:fresh.id},token);
    traceUrl=shared?.trace_url||shared?.public_url||"";
  }catch(err){
    // El QR es complementario. La cotización debe poder emitirse aunque falle el enlace público.
    console.warn("PDF_COTIZACION_SIN_TRAZABILIDAD",err);
  }
  const built=await buildQuotePdfData(fresh,traceUrl);
  // Primero materializa el PDF para el usuario. Un fallo de Storage no debe bloquear su emisión.
  if(download)built.doc.save(`${fresh.numero_cotizacion||"cotizacion"}.pdf`);
  try{
    const out=await AleAPI.uploadQuotePdf({id:fresh.id,dataUrl:built.dataUrl},token);
    const updated=out.quote||{...fresh,pdf_url:out.pdfUrl};
    const ix=data.quotes.findIndex(x=>String(x.id)===String(updated.id));if(ix>=0)data.quotes[ix]=updated;else data.quotes.unshift(updated);
    $("#qPdfUrl").value=updated.pdf_url||out.pdfUrl||"";renderQuotes();
    return updated;
  }catch(err){
    console.warn("PDF_COTIZACION_STORAGE_PENDIENTE",err);
    return {...fresh,_pdfUploadPending:true,_pdfUploadError:String(err?.message||err||"ERROR")};
  }
}
async function sendQuoteWhatsapp(quote,popup=null){
  let q=quote;
  if(!q?.id)q=await persistQuote();
  // R9.18.17: WhatsApp comparte la vista pública firmada, nunca el PDF/Storage del servidor.
  const phone=phoneForWhatsapp(q.telefono);if(!phone)throw new Error("TELEFONO_WHATSAPP_REQUERIDO");
  const shared=await AleAPI.post("quotesharelink",{id:q.id},token),publicUrl=clientPublicUrl(shared?.public_url||"");
  const text=`Hola ${q.cliente_nombre||""}, puedes revisar la cotización ${q.numero_cotizacion||""}${q.numero_solicitud?` asociada a la solicitud ${q.numero_solicitud}`:""}. Total: ${money(q.total)}. Enlace seguro: ${publicUrl}`;
  const waUrl=`https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  if(popup && !popup.closed) popup.location.href=waUrl;
  else window.open(waUrl,"_blank","noopener");
  if(String(q.estado||"").toUpperCase()==="BORRADOR"){
    try{const out=await AleAPI.post("updatequotestatus",{id:q.id,status:"ENVIADA"},token);if(out.quote){const ix=data.quotes.findIndex(x=>String(x.id)===String(q.id));if(ix>=0)data.quotes[ix]=out.quote;renderQuotes()}}catch(_){ }
  }
  return q;
}
$("#generateQuotePdf")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const q=$("#qId").value?data.quotes.find(x=>String(x.id)===String($("#qId").value)):null;const out=await generateAndUploadQuotePdf(q||null,true);toast(out?._pdfUploadPending?`PDF ${out.numero_cotizacion||""} descargado. El respaldo en servidor quedó pendiente.`:`PDF ${out.numero_cotizacion||""} generado`)}catch(err){console.warn(err);toast("No fue posible generar el PDF")}}));
$("#sendQuoteWhatsapp")?.addEventListener("click",e=>{const popup=window.open("about:blank","_blank");busy(e.currentTarget,async()=>{try{const q=$("#qId").value?data.quotes.find(x=>String(x.id)===String($("#qId").value)):null;await sendQuoteWhatsapp(q||null,popup);toast("Cotización preparada para WhatsApp")}catch(err){try{popup?.close()}catch(_){}console.warn(err);toast("No fue posible enviar por WhatsApp")}})});
window.generateQuoteFromList=async(id,btn)=>busy(btn,async()=>{try{const q=data.quotes.find(x=>String(x.id)===String(id));if(!q)throw new Error("COTIZACION_NO_ENCONTRADA");const out=await generateAndUploadQuotePdf(q,true);toast(out?._pdfUploadPending?"PDF descargado. El respaldo en servidor quedó pendiente.":"PDF generado")}catch(e){console.warn(e);toast("No fue posible generar PDF")}});
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
function clientTransportLabel(v){const x=String(v||"POR DEFINIR").toUpperCase();return x==="RETIRO"?"Retiro":x==="DESPACHO"?"Despacho":x==="OTRO"?"Otro":"Por definir"}
function openClientEditor(id=""){
  fillWholesaleSelectors();const c=id?(data.clients||[]).find(x=>String(x.id)===String(id)):null;
  $("#clientId").value=c?.id||"";$("#clientRut").value=c?.rut?formatRutChile(c.rut):"";$("#clientName").value=c?.nombre||"";$("#clientPhone").value=c?.telefono||"";$("#clientEmail").value=c?.email||"";$("#clientAddress").value=c?.direccion||"";$("#clientCommune").value=c?.comuna||"";$("#clientTransport").value=String(c?.tipo_transporte||"POR DEFINIR").toUpperCase();if($("#clientType"))$("#clientType").value=String(c?.tipo_cliente||"MINORISTA").toUpperCase()==="MAYORISTA"?"MAYORISTA":"MINORISTA";if($("#clientWholesaleStatus"))$("#clientWholesaleStatus").value=String(c?.mayorista_estado||($("#clientType")?.value==="MAYORISTA"?"PENDIENTE":"NO_APLICA")).toUpperCase();if($("#clientPriceList"))$("#clientPriceList").value=c?.lista_precio_id||"";if($("#clientBusinessName"))$("#clientBusinessName").value=c?.razon_social||"";if($("#clientBusinessActivity"))$("#clientBusinessActivity").value=c?.giro||"";
  $("#clientEditorTitle").textContent=c?"Editar cliente":"Crear cliente";$("#clientEditorNumber").textContent=c?(c.numero_cliente||c.id||"Cliente"):"Cliente nuevo";
  $("#clientStatRequests").textContent=String(c?.total_solicitudes||0);$("#clientStatOrders").textContent=String(c?.total_pedidos||0);$("#clientStatQuotes").textContent=String(c?.total_cotizaciones||0);$("#clientStatTotal").textContent=money(c?.total_comprado||0);
  $("#clientEditor")?.classList.remove("hidden");document.body.classList.add("client-editor-open");setTimeout(()=>$(c?"#clientName":"#clientRut")?.focus(),50);
}
function closeClientEditor(){$("#clientEditor")?.classList.add("hidden");document.body.classList.remove("client-editor-open")}
function renderClients(){
  const host=$("#clientsTable");if(!host)return;const q=String($("#clientSearch")?.value||"").trim();const list=(data.clients||[]).filter(c=>flexibleSearchMatch([c.nombre,c.rut,c.telefono,c.email,c.numero_cliente,c.direccion,c.comuna,c.tipo_transporte],q));
  $("#clientResultsMeta").textContent=`Mostrando ${list.length} de ${(data.clients||[]).length} clientes`;
  host.innerHTML=table(["N.º cliente","Cliente","RUT","Contacto","Dirección","Transporte","Solicitudes","Pedidos","Cotizaciones","Total comprado","Última interacción"],list.map(c=>`<tr class="client-row" data-client-id="${esc(c.id)}" tabindex="0" title="Abrir ficha de ${esc(c.nombre||"cliente")}"><td><strong>${esc(c.numero_cliente||c.id)}</strong></td><td><strong>${esc(c.nombre||"")}</strong></td><td>${esc(c.rut?formatRutChile(c.rut):"-")}</td><td>${esc(c.telefono||"")}<br><small>${esc(c.email||"")}</small></td><td><span class="client-address" title="${esc([c.direccion,c.comuna].filter(Boolean).join(", "))}">${esc(c.direccion||"-")}${c.comuna?`<br><small>${esc(c.comuna)}</small>`:""}</span></td><td><span class="transport-badge">${esc(clientTransportLabel(c.tipo_transporte))}</span></td><td>${Number(c.total_solicitudes||0)}</td><td>${Number(c.total_pedidos||0)}</td><td>${Number(c.total_cotizaciones||0)}</td><td>${money(c.total_comprado||0)}</td><td>${esc(formatDate(c.ultima_interaccion))}</td></tr>`).join(""));
  const canWrite=data.permissions?.clients?.write!==false;$("#createClient")?.classList.toggle("hidden",!canWrite);
}
$("#clientSearch")?.addEventListener("input",renderClients);$("#clearClientSearch")?.addEventListener("click",()=>{$("#clientSearch").value="";renderClients();$("#clientSearch").focus()});
$("#createClient")?.addEventListener("click",()=>openClientEditor());$("#closeClientEditorX")?.addEventListener("click",closeClientEditor);$("#cancelClientEditor")?.addEventListener("click",closeClientEditor);wireRutInput("#clientRut");
$("#clientsTable")?.addEventListener("click",e=>{const row=e.target.closest?.("tr[data-client-id]");if(row)openClientEditor(row.dataset.clientId)});$("#clientsTable")?.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches?.("tr[data-client-id]")){e.preventDefault();openClientEditor(e.target.dataset.clientId)}});
$("#saveClient")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const name=$("#clientName").value.trim();if(!name)throw new Error("NOMBRE_REQUERIDO");const rut=requireRutChile($("#clientRut").value);const payload={id:$("#clientId").value||undefined,nombre:name,rut,telefono:$("#clientPhone").value.trim(),email:$("#clientEmail").value.trim(),direccion:$("#clientAddress").value.trim(),comuna:$("#clientCommune").value.trim(),tipo_transporte:$("#clientTransport").value,tipo_cliente:$("#clientType")?.value||"MINORISTA",mayorista_estado:$("#clientWholesaleStatus")?.value||"NO_APLICA",lista_precio_id:$("#clientPriceList")?.value||"",razon_social:$("#clientBusinessName")?.value.trim()||"",giro:$("#clientBusinessActivity")?.value.trim()||""};if(payload.tipo_cliente==='MAYORISTA'&&!payload.lista_precio_id&&payload.mayorista_estado==='APROBADO')payload.mayorista_estado='PENDIENTE';const out=await AleAPI.post("saveclient",payload,token);const c=out.client;if(!c)throw new Error("CLIENTE_NO_GUARDADO");const i=(data.clients||[]).findIndex(x=>String(x.id)===String(c.id));if(i>=0)data.clients[i]=c;else data.clients.unshift(c);closeClientEditor();if(i>=0){await loadAdminModules({modules:["clients","requests","quotes","orders"],retry:true});const synced=out.synced||{};const total=Number(synced.requests||0)+Number(synced.quotes||0)+Number(synced.orders||0);toast(total?`Cliente actualizado · ${total} documento${total===1?"":"s"} sincronizado${total===1?"":"s"}`:"Cliente actualizado")}else{renderClients();toast("Cliente creado")}}catch(err){console.warn(err);const code=String(err?.message||err||"");toast(code.includes("RUT_YA_ASOCIADO")?"Ese RUT ya pertenece a otro cliente":code.includes("TELEFONO_YA_ASOCIADO")?"Ese teléfono ya pertenece a otro cliente":code.includes("RUT")?"Revisa el RUT del cliente":"No fue posible guardar el cliente")}}));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#clientEditor")?.classList.contains("hidden"))closeClientEditor()});
function exportRowsXlsx(rows,name){if(!window.XLSX)return toast("No se cargó la librería XLSX");const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Datos");XLSX.writeFile(wb,name)}
function simplePdf(title,headers,rows,name){const JsPDF=window.jspdf?.jsPDF;if(!JsPDF)return toast("No se cargó la librería PDF");const doc=new JsPDF({orientation:"landscape",unit:"mm",format:"a4"});doc.setFontSize(16);doc.text(title,14,14);doc.setFontSize(8);let y=22;const widths=[28,48,42,28,28,30,35,42];headers.forEach((h,i)=>doc.text(String(h),14+widths.slice(0,i).reduce((a,b)=>a+b,0),y));y+=6;for(const row of rows){if(y>190){doc.addPage();y=16}row.forEach((v,i)=>doc.text(String(v??"").slice(0,32),14+widths.slice(0,i).reduce((a,b)=>a+b,0),y));y+=5}doc.save(name)}
$("#exportClientsXlsx")?.addEventListener("click",()=>exportRowsXlsx((data.clients||[]).map(c=>({numero_cliente:c.numero_cliente,nombre:c.nombre,rut:c.rut?formatRutChile(c.rut):"",telefono:c.telefono,email:c.email,solicitudes:c.total_solicitudes,pedidos:c.total_pedidos,cotizaciones:c.total_cotizaciones,total_comprado:c.total_comprado,ultima_interaccion:c.ultima_interaccion})),"ALE_ATENCIO_CLIENTES.xlsx"));
$("#exportClientsPdf")?.addEventListener("click",()=>simplePdf("ALE ATENCIO · Clientes",["N.º","Cliente","RUT","Teléfono","Email","Sol.","Pedidos","Total"],(data.clients||[]).map(c=>[c.numero_cliente,c.nombre,c.rut?formatRutChile(c.rut):"",c.telefono,c.email,c.total_solicitudes,c.total_pedidos,money(c.total_comprado)]),"ALE_ATENCIO_CLIENTES.pdf"));


// ========================= R9.18.63 MAYORISTAS / REGISTRO / LISTAS DE PRECIOS =========================
function renderWholesale(){
  const lists=data.priceLists||[],clients=data.wholesalers||[],users=data.wholesaleUsers||[],docs=data.wholesaleDocuments||[],requests=data.wholesaleRequests||[];fillWholesaleSelectors();
  if($("#whKpiLists"))$("#whKpiLists").textContent=lists.filter(x=>wholesaleActive(x.activo)).length;
  if($("#whKpiClients"))$("#whKpiClients").textContent=clients.length;
  if($("#whKpiRequests"))$("#whKpiRequests").textContent=requests.filter(x=>String(x.estado||'').toUpperCase()==='PENDIENTE').length;
  if($("#whKpiProfiles"))$("#whKpiProfiles").textContent=users.filter(x=>wholesaleActive(x.activo)).length;
  if($("#whKpiDocs"))$("#whKpiDocs").textContent=docs.length;
  if($("#priceListsTable"))$("#priceListsTable").innerHTML=table(["Lista","Código","Estado","Productos / tamaños","Acciones"],lists.map(l=>{const count=(data.priceListItems||[]).filter(x=>String(x.lista_id)===String(l.id)&&wholesaleActive(x.activo)).length,total=(data.products||[]).reduce((n,p)=>n+(p.tamanos||[]).filter(x=>wholesaleActive(x.activo)).length,0);return `<tr><td><strong>${esc(l.nombre||"")}</strong><br><small>${esc(l.descripcion||"")}</small></td><td>${esc(l.codigo||"")}</td><td><span class="role-badge ${wholesaleActive(l.activo)?"":"inactive-badge"}">${wholesaleActive(l.activo)?"Activa":"Inactiva"}</span></td><td><strong>${count}/${total}</strong><br><small>${count>=total?'Completa':'Se completará al editar/guardar'}</small></td><td><button class="btn btn-light btn-compact" onclick="editPriceList('${esc(l.id)}')">Editar precios</button></td></tr>`}).join(""));
  if($("#wholesaleRequestsTable"))$("#wholesaleRequestsTable").innerHTML=table(["Fecha","Empresa / contacto","RUT","Usuario","Estado","Lista","Acciones"],requests.map(r=>{const l=lists.find(x=>String(x.id)===String(r.lista_precio_id));const pending=String(r.estado||'').toUpperCase()==='PENDIENTE';return `<tr><td>${esc(formatDate(r.creado_en))}</td><td><strong>${esc(r.razon_social||'')}</strong><br><small>${esc(r.contacto||'')} · ${esc(r.email||'')}</small></td><td>${esc(r.rut?formatRutChile(r.rut):'')}</td><td>@${esc(r.usuario_solicitado||'')}</td><td><span class="role-badge ${pending?'inactive-badge':''}">${esc(r.estado||'PENDIENTE')}</span></td><td>${esc(l?.nombre||'—')}</td><td>${pending?`<button class="btn btn-primary btn-compact" onclick="openWholesaleRequest('${esc(r.id)}')">Revisar</button>`:`<button class="btn btn-light btn-compact" onclick="openWholesaleRequest('${esc(r.id)}')">Ver</button>`}</td></tr>`}).join(""));
  if($("#wholesalersTable"))$("#wholesalersTable").innerHTML=table(["Mayorista","RUT","Estado","Lista","Acceso","Pedidos","Acciones"],clients.map(c=>{const l=lists.find(x=>String(x.id)===String(c.lista_precio_id)),u=users.find(x=>String(x.cliente_id||"")===String(c.id));const access=u?`<span class="role-badge ${wholesaleActive(u.activo)?"":"inactive-badge"}">${wholesaleActive(u.activo)?"Activo":"Inactivo"}</span><br><small>@${esc(u.usuario||"")}</small>`:'<span class="role-badge inactive-badge">Sin acceso</span>';const accessBtn=u?`<button class="btn btn-light btn-compact" onclick="editWholesaleAccess('${esc(u.id)}')">Editar acceso</button>`:`<button class="btn btn-primary btn-compact" onclick="openWholesaleProfileEditor('${esc(c.id)}')">Crear acceso</button>`;return `<tr><td><strong>${esc(c.razon_social||c.nombre||"")}</strong><br><small>${esc(c.giro||c.email||"")}</small></td><td>${esc(c.rut?formatRutChile(c.rut):"")}</td><td>${esc(c.mayorista_estado||"APROBADO")}</td><td>${esc(l?.nombre||"Sin lista")}</td><td>${access}</td><td>${Number(c.total_pedidos||0)}</td><td><div class="row-actions"><button class="btn btn-light btn-compact" onclick="openClientEditor('${esc(c.id)}')">Editar cliente</button>${accessBtn}</div></td></tr>`}).join(""));
  if($("#wholesaleDocumentsTable"))$("#wholesaleDocumentsTable").innerHTML=table(["Fecha","Mayorista","Tipo","Documento","Origen"],docs.map(d=>{const c=clients.find(x=>String(x.id)===String(d.cliente_id));return `<tr><td>${esc(formatDate(d.creado_en))}</td><td>${esc(c?.razon_social||c?.nombre||d.cliente_id||"")}</td><td>${esc(d.tipo||"")}</td><td><strong>${esc(d.nombre||"")}</strong></td><td>${esc(d.origen||"")}</td></tr>`}).join(""));
}
function fillWholesaleRequestPriceLists(selected=""){const sel=$("#wrPriceList");if(!sel)return;const lists=(data.priceLists||[]).filter(x=>wholesaleActive(x.activo));sel.innerHTML='<option value="">Seleccionar lista activa</option>'+lists.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(selected)?"selected":""}>${esc(x.nombre||x.codigo||x.id)}</option>`).join("")}
window.openWholesaleRequest=id=>{const r=(data.wholesaleRequests||[]).find(x=>String(x.id)===String(id));if(!r)return;$("#wrId").value=r.id;$("#wrTitle").textContent=`${r.estado||'PENDIENTE'} · ${r.razon_social||r.contacto||'Solicitud Mayorista'}`;$("#wrDetail").innerHTML=`<div class="wholesale-request-grid"><div><span>Empresa</span><strong>${esc(r.razon_social||'')}</strong></div><div><span>RUT</span><strong>${esc(r.rut?formatRutChile(r.rut):'')}</strong></div><div><span>Contacto</span><strong>${esc(r.contacto||'')}</strong></div><div><span>Correo</span><strong>${esc(r.email||'')}</strong></div><div><span>Teléfono</span><strong>${esc(r.telefono||'')}</strong></div><div><span>Usuario solicitado</span><strong>@${esc(r.usuario_solicitado||'')}</strong></div><div><span>Giro</span><strong>${esc(r.giro||'—')}</strong></div><div><span>Comuna</span><strong>${esc(r.comuna||'—')}</strong></div><div class="span-2"><span>Observaciones</span><strong>${esc(r.observaciones||'—')}</strong></div>${r.motivo_rechazo?`<div class="span-2"><span>Motivo rechazo</span><strong>${esc(r.motivo_rechazo)}</strong></div>`:''}</div>`;fillWholesaleRequestPriceLists(r.lista_precio_id||'');$("#wrRejectReason").value=r.motivo_rechazo||'';const pending=String(r.estado||'').toUpperCase()==='PENDIENTE';$("#approveWholesaleRequest").classList.toggle('hidden',!pending);$("#rejectWholesaleRequest").classList.toggle('hidden',!pending);$("#wrPriceList").disabled=!pending;$("#wrRejectReason").disabled=!pending;$("#wholesaleRequestEditor").classList.remove('hidden')};
function closeWholesaleRequestEditor(){$("#wholesaleRequestEditor")?.classList.add('hidden')}
$("#closeWholesaleRequestEditor")?.addEventListener('click',closeWholesaleRequestEditor);$("#cancelWholesaleRequest")?.addEventListener('click',closeWholesaleRequestEditor);
$("#approveWholesaleRequest")?.addEventListener('click',e=>busy(e.currentTarget,async()=>{try{const id=$("#wrId").value,lista=$("#wrPriceList").value;if(!lista){toast('Selecciona una lista de precios activa');return}await AleAPI.post('adminwholesalerequestdecision',{id,accion:'APROBAR',lista_precio_id:lista},token);toast('✓ Solicitud aprobada · usuario Mayorista activado');closeWholesaleRequestEditor();await loadAdminModules({modules:['clients','users','wholesale'],retry:true});openAdminView('wholesale')}catch(err){console.warn(err);const c=String(err?.message||err||'');toast(c.includes('ACCION_NO_VALIDA')?'El backend R9.18.63 aún no está desplegado':`No fue posible aprobar · ${c}`)}}));
$("#rejectWholesaleRequest")?.addEventListener('click',e=>busy(e.currentTarget,async()=>{try{const id=$("#wrId").value,motivo=$("#wrRejectReason").value.trim();if(!confirm('¿Rechazar esta solicitud Mayorista?'))return;await AleAPI.post('adminwholesalerequestdecision',{id,accion:'RECHAZAR',motivo},token);toast('Solicitud Mayorista rechazada');closeWholesaleRequestEditor();await loadAdminModules({modules:['wholesale'],retry:true})}catch(err){console.warn(err);toast('No fue posible rechazar la solicitud')}}));
function currentPriceListItems(listId){const map=new Map();for(const x of data.priceListItems||[])if(String(x.lista_id)===String(listId))map.set(`${x.producto_id}|${x.tamano_id}`,x);return map}
function priceListCatalogRows(listId=""){
  const map=currentPriceListItems(listId),rows=[];
  for(const p of data.products||[]){
    const category=String(p.categoria_nombre||p.categoria||"Sin categoría");
    const sizes=(p.tamanos||[]).filter(x=>wholesaleActive(x.activo));
    for(const z of sizes){
      const it=map.get(`${p.id}|${z.id}`),normal=Number(z.precio||0),value=it!==undefined?Number(it.precio||0):normal;
      rows.push(`<tr data-product-id="${esc(p.id)}" data-size-id="${esc(z.id)}" data-name="${esc(String(p.nombre||'').toLowerCase())}" data-size="${esc(String(z.nombre||'').toLowerCase())}" data-category="${esc(category.toLowerCase())}"><td><strong>${esc(p.nombre)}</strong><br><small>${esc(category)}</small></td><td>${esc(z.nombre)}</td><td>${money(normal)}</td><td><input class="plItemPrice" type="text" inputmode="numeric" value="${esc(new Intl.NumberFormat('es-CL',{maximumFractionDigits:0}).format(value))}" data-default-price="${normal}"></td></tr>`);
    }
  }
  return rows;
}
function applyPriceListFilters(){
  const q=String($("#plSearch")?.value||"").trim().toLowerCase(),cat=String($("#plCategory")?.value||"").toLowerCase();let shown=0,total=0;
  $$("#priceListItemsEditor tr[data-product-id]").forEach(tr=>{total++;const hit=(!q||`${tr.dataset.name||''} ${tr.dataset.size||''}`.includes(q))&&(!cat||String(tr.dataset.category||'')===cat);tr.classList.toggle('pl-hidden',!hit);if(hit)shown++});
  if($("#plSummary"))$("#plSummary").innerHTML=`<strong>${shown}</strong> de <strong>${total}</strong> producto/tamaño visibles · todos forman parte de la lista · <span class="price-list-scroll-hint">Desplázate dentro de la tabla para verlos todos</span>`;
}
function fillPriceListCategories(){const sel=$("#plCategory");if(!sel)return;const cats=[...new Set((data.products||[]).map(p=>String(p.categoria_nombre||p.categoria||"Sin categoría")).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));sel.innerHTML='<option value="">Todas las categorías</option>'+cats.map(c=>`<option value="${esc(c.toLowerCase())}">${esc(c)}</option>`).join('')}
function openPriceListEditor(id=""){
  const l=id?(data.priceLists||[]).find(x=>String(x.id)===String(id)):null;$("#plId").value=l?.id||"";$("#plName").value=l?.nombre||"";$("#plCode").value=l?.codigo||"";$("#plDescription").value=l?.descripcion||"";$("#plActive").value=wholesaleActive(l?.activo??true)?"SI":"NO";$("#priceListEditorTitle").textContent=l?`Editar ${l.nombre}`:"Nueva lista";fillPriceListCategories();if($("#plSearch"))$("#plSearch").value='';if($("#plCategory"))$("#plCategory").value='';const rows=priceListCatalogRows(l?.id||"");$("#priceListItemsEditor").innerHTML=table(["Producto","Tamaño","Precio normal","Precio lista"],rows.join(""));applyPriceListFilters();$("#priceListEditor").classList.remove("hidden");
}
window.editPriceList=id=>openPriceListEditor(id);$("#newPriceList")?.addEventListener("click",()=>openPriceListEditor());function closePriceListEditor(){$("#priceListEditor")?.classList.add("hidden")}$("#closePriceListEditor")?.addEventListener("click",closePriceListEditor);$("#cancelPriceList")?.addEventListener("click",closePriceListEditor);$("#plSearch")?.addEventListener('input',applyPriceListFilters);$("#plCategory")?.addEventListener('change',applyPriceListFilters);$("#plResetFilters")?.addEventListener('click',()=>{if($("#plSearch"))$("#plSearch").value='';if($("#plCategory"))$("#plCategory").value='';applyPriceListFilters()});
$("#savePriceList")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const name=$("#plName").value.trim();if(!name)throw new Error("LISTA_NOMBRE_REQUERIDO");const items=$$("#priceListItemsEditor tr[data-product-id]").map(tr=>{const input=tr.querySelector('.plItemPrice'),raw=input?.value.trim()||"",fallback=Number(input?.dataset.defaultPrice||0),price=raw?parseClpAmount(raw):fallback;return{producto_id:tr.dataset.productId,tamano_id:tr.dataset.sizeId,precio:price,activo:true}});await AleAPI.post("savepricelist",{id:$("#plId").value||undefined,nombre:name,codigo:$("#plCode").value.trim(),descripcion:$("#plDescription").value.trim(),activo:$("#plActive").value,items},token);toast(`✓ Lista guardada · ${items.length} producto/tamaño incluidos`);closePriceListEditor();await loadAdminModules({modules:["wholesale"],retry:true})}catch(err){console.warn(err);toast("✕ No fue posible guardar la lista")}}));
function fillWholesaleProfilePriceLists(selected=""){const sel=$("#wmPriceList");if(!sel)return;const lists=(data.priceLists||[]).filter(x=>wholesaleActive(x.activo));sel.innerHTML='<option value="">Sin lista por ahora · acceso pendiente</option>'+lists.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(selected)?"selected":""}>${esc(x.nombre||x.codigo||x.id)}</option>`).join("")}
window.openWholesaleProfileEditor=(clientId="")=>{const client=clientId?(data.wholesalers||data.clients||[]).find(x=>String(x.id)===String(clientId)):null;const already=(data.wholesaleUsers||[]).find(x=>String(x.cliente_id||"")===String(clientId));if(already){openAdminView("users");window.editUser?.(already.id);return}$("#wmClientId").value=client?.id||"";$("#wmRut").value=client?.rut?formatRutChile(client.rut):"";$("#wmBusinessName").value=client?.razon_social||client?.nombre||"";$("#wmContact").value=client?.nombre||"";$("#wmBusinessActivity").value=client?.giro||"";$("#wmPhone").value=client?.telefono||"";$("#wmEmail").value=client?.email||"";$("#wmAddress").value=client?.direccion||"";$("#wmCommune").value=client?.comuna||"";$("#wmUsername").value="";$("#wmPassword").value="";$("#wmActive").value="SI";fillWholesaleProfilePriceLists(client?.lista_precio_id||"");$("#wholesaleProfileEditor")?.classList.remove("hidden");requestAnimationFrame(()=>$(client?"#wmUsername":"#wmRut")?.focus())};
window.editWholesaleAccess=id=>{openAdminView("users");window.editUser?.(id)};
function closeWholesaleProfileEditor(){$("#wholesaleProfileEditor")?.classList.add("hidden")}
$("#newWholesaleProfile")?.addEventListener("click",()=>window.openWholesaleProfileEditor());$("#closeWholesaleProfileEditor")?.addEventListener("click",closeWholesaleProfileEditor);$("#cancelWholesaleProfile")?.addEventListener("click",closeWholesaleProfileEditor);
function wholesaleProfileErrorMessage(err){const code=String(err?.message||err||"").toUpperCase();if(code.includes("USUARIO_YA_EXISTE"))return "Ese usuario ya existe";if(code.includes("EMAIL_YA_EXISTE"))return "Ese correo ya está asociado a otro usuario";if(code.includes("MAYORISTA_PERFIL_YA_EXISTE"))return "Ese cliente ya tiene un perfil Mayorista";if(code.includes("LISTA_PRECIO_NO_DISPONIBLE"))return "La lista de precios seleccionada no está activa";if(code.includes("TELEFONO_YA_ASOCIADO"))return "Ese teléfono ya está asociado a otro cliente";if(code.includes("RUT"))return "Revisa el RUT del Mayorista";if(code.includes("PERMISO_DENEGADO"))return "Solo un administrador autorizado puede crear perfiles Mayoristas";if(code.includes("ACCION_NO_VALIDA"))return "El backend está desactualizado. Debes desplegar el index.ts incluido en esta versión";return `No fue posible crear el perfil Mayorista${code?` · ${code}`:""}`}
$("#saveWholesaleProfile")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const rut=requireRutChile($("#wmRut").value),payload={cliente_id:$("#wmClientId").value||"",rut,razon_social:$("#wmBusinessName").value.trim(),nombre:$("#wmContact").value.trim(),giro:$("#wmBusinessActivity").value.trim(),telefono:$("#wmPhone").value.trim(),email:$("#wmEmail").value.trim(),direccion:$("#wmAddress").value.trim(),comuna:$("#wmCommune").value.trim(),lista_precio_id:$("#wmPriceList").value,usuario:$("#wmUsername").value.trim(),password:$("#wmPassword").value,activo:$("#wmActive").value};if(!payload.razon_social||!payload.nombre||!payload.usuario){toast("Completa razón social, contacto y usuario");return}if(String(payload.password||"").length<8){toast("La contraseña inicial debe tener al menos 8 caracteres");return}if(!payload.lista_precio_id)payload.activo='NO';const out=await AleAPI.post("createwholesaleprofile",payload,token);toast(out?.pending_price_list?"✓ Perfil y usuario Mayorista creados · acceso pendiente hasta asignar lista de precios":"✓ Perfil Mayorista y usuario creados desde cPanel");closeWholesaleProfileEditor();await loadAdminModules({modules:["clients","users","wholesale"],retry:true});openAdminView("wholesale")}catch(err){console.warn(err);toast(wholesaleProfileErrorMessage(err))}}));
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
$("#uploadWhDocument")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const f=$("#whDocFile")?.files?.[0];if(!f)throw new Error("ARCHIVO_REQUERIDO");const clientId=$("#whDocClient").value;if(!clientId)throw new Error("CLIENTE_REQUERIDO");const dataUrl=await fileToDataUrl(f);await AleAPI.post("adminwholesaledocumentupload",{cliente_id:clientId,tipo:$("#whDocType").value,nombre:$("#whDocName").value.trim()||f.name,data_url:dataUrl,visible_mayorista:true},token);toast("✓ Documento privado cargado y mayorista notificado");$("#whDocFile").value="";resetFilePicker("#whDocFile");$("#whDocName").value="";await loadAdminModules({modules:["wholesale"],retry:true})}catch(err){console.warn(err);toast("✕ No fue posible subir el documento")}}));

// ========================= R9.18.7 REPORTES CONECTADOS A VENTAS PAGADAS =========================
let reportAnalytics=null,reportLoading=false;
function reportDefaultDates(){const n=new Date(),y=n.getFullYear();return{from:`${y}-01-01`,to:`${y}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`}}
function reportFilters(){const def=reportDefaultDates();return{from:$("#reportFrom")?.value||def.from,to:$("#reportTo")?.value||def.to,order_status:$("#reportOrderStatus")?.value||""}}
function setReportCircle(id,pct){const el=$(id);if(!el)return;const n=Number(pct||0);el.style.setProperty("--pct",String(Math.min(100,Math.abs(n))));el.classList.toggle("negative",n<0);el.classList.toggle("positive",n>=0)}
async function loadReports(silent=false){
  if(reportLoading)return;reportLoading=true;const btn=$("#refreshReports");if(btn&&!silent)beginBusy(btn);
  try{
    const filters=reportFilters();
    const out=AleAPI.salesReport?await AleAPI.salesReport(filters,token):await AleAPI.post("salesreport",filters,token);
    if(!out?.ok)throw new Error(out?.error||"REPORTE_RESPUESTA_INVALIDA");
    reportAnalytics=out;renderReports();
  }catch(err){
    console.warn("salesreport",err);reportAnalytics=null;
    const code=String(err?.message||err||"ERROR_DESCONOCIDO").replace(/^Error:\s*/i,"");
    if(!silent){const shortCode=code.slice(0,140);toast(code==="API_TIMEOUT"?"El reporte tardó demasiado. Reintentando conexión…":`No fue posible actualizar los reportes · ${shortCode}`);}
    if($("#reportFilterSummary"))$("#reportFilterSummary").innerHTML=`<i class="bi bi-exclamation-triangle"></i><span>No se pudo consultar la analítica de ventas. <small>${esc(code)}</small></span>`;
  }finally{reportLoading=false;if(btn&&!silent)endBusy(btn)}
}
function renderReports(){
  if(!reportAnalytics){const def=reportDefaultDates();if($("#reportFrom")&&!$("#reportFrom").value)$("#reportFrom").value=def.from;if($("#reportTo")&&!$("#reportTo").value)$("#reportTo").value=def.to;return}
  const r=reportAnalytics,k=r.kpis||{},products=r.products||[],customers=r.customers||[],orders=r.orders||[],demand=r.high_demand||[],limit=Math.max(1,Math.min(50,Number($("#reportTopLimit")?.value||10))),top=products.slice(0,limit);
  const set=(id,v)=>{if($(id))$(id).textContent=v};
  set("#reportSalesTotal",money(k.sales_total));set("#reportOrdersCount",String(k.orders_count||0));set("#reportClientsCount",String(k.unique_clients||0));set("#reportRepeatClients",String(k.repeat_clients||0));set("#reportAvgTicket",money(k.average_ticket));set("#reportTodaySales",money(k.sales_today));set("#reportMonthSales",money(k.sales_month));
  set("#reportTopProduct",r.top_product?.producto_nombre||"—");set("#reportTopProductMeta",r.top_product?`${Number(r.top_product.cantidad||0)} unidades · ${money(r.top_product.ventas)}`:"Sin ventas");
  set("#reportYearPct",`${Number(k.year_change_pct||0)>=0?"+":""}${Number(k.year_change_pct||0)}%`);set("#reportYearSales",money(k.sales_year));set("#reportPrevYearSales",`Anterior: ${money(k.sales_previous_year)}`);setReportCircle("#reportYearCircle",k.year_change_pct);
  set("#reportMonthPct",`${Number(k.month_change_pct||0)>=0?"+":""}${Number(k.month_change_pct||0)}%`);set("#reportMonthCompareSales",money(k.sales_month));set("#reportPrevMonthSales",`Anterior: ${money(k.sales_same_month_previous_year)}`);setReportCircle("#reportMonthCircle",k.month_change_pct);
  set("#reportTopCustomer",r.top_customer?.nombre||"—");set("#reportTopCustomerTotal",money(r.top_customer?.total||0));set("#reportTopCustomerMeta",r.top_customer?`${r.top_customer.compras} compra${r.top_customer.compras===1?"":"s"}`:"Sin compras");
  set("#topProductsTitle",`Top ${limit} productos`);set("#topProductsBadge",String(top.length));set("#salesRowsBadge",`${orders.length} registro${orders.length===1?"":"s"}`);set("#clientRowsBadge",`${customers.length} cliente${customers.length===1?"":"s"}`);
  if($("#reportFilterSummary")){const bv=esc(r.diagnostics?.backend_version||"");$("#reportFilterSummary").innerHTML=`<i class="bi bi-check-circle"></i><span>${orders.length} venta${orders.length===1?"":"s"} pagada${orders.length===1?"":"s"} · ${esc(r.filters?.from||"")} a ${esc(r.filters?.to||"")} · Actualizado ${esc(new Date(r.generated_at).toLocaleTimeString("es-CL"))}${bv?` · ${bv}`:""}</span>`;}
  if($("#topProductsTable"))$("#topProductsTable").innerHTML=table(["#","Producto","Unidades","Pedidos","Ventas"],top.map((p,i)=>`<tr><td><strong>${i+1}</strong></td><td><strong>${esc(p.producto_nombre)}</strong></td><td>${Number(p.cantidad||0)}</td><td>${Number(p.pedidos||0)}</td><td><strong>${money(p.ventas)}</strong></td></tr>`).join(""));
  if($("#highDemandTable"))$("#highDemandTable").innerHTML=table(["Producto","30 días","30 días prev.","Variación"],demand.slice(0,10).map(p=>`<tr><td><strong>${esc(p.producto_nombre)}</strong></td><td>${Number(p.actual||0)}</td><td>${Number(p.anterior||0)}</td><td><span class="demand-change ${Number(p.crecimiento_pct||0)>=0?"up":"down"}">${Number(p.crecimiento_pct||0)>=0?"+":""}${Number(p.crecimiento_pct||0)}%</span></td></tr>`).join(""));
  if($("#clientReportTable"))$("#clientReportTable").innerHTML=table(["#","Cliente","RUT","Compras","Total comprado"],customers.slice(0,50).map((c,i)=>`<tr><td>${i+1}</td><td><strong>${esc(c.nombre||"")}</strong></td><td>${esc(c.rut?formatRutChile(c.rut):"-")}</td><td>${Number(c.compras||0)}</td><td><strong>${money(c.total||0)}</strong></td></tr>`).join(""));
  if($("#salesReportTable"))$("#salesReportTable").innerHTML=table(["Fecha pago","N.º pedido","Cliente","RUT","Estado pedido","Pago","Total"],orders.map(o=>`<tr><td>${esc(formatDate(o.fecha_pago||o.fecha))}</td><td><strong>${esc(o.numero_pedido||o.id)}</strong></td><td>${esc(o.nombre||"")}</td><td>${esc(o.rut?formatRutChile(o.rut):"-")}</td><td>${esc(o.estado||"")}</td><td><span class="payment-status-badge payment-pagado">PAGADO</span></td><td><strong>${money(o.total)}</strong></td></tr>`).join(""));
  scheduleMoneyColumns();
}
$("#applyReports")?.addEventListener("click",()=>loadReports());$("#refreshReports")?.addEventListener("click",()=>loadReports());$("#reportTopLimit")?.addEventListener("change",renderReports);
$("#resetReports")?.addEventListener("click",()=>{const def=reportDefaultDates();$("#reportFrom").value=def.from;$("#reportTo").value=def.to;$("#reportOrderStatus").value="";$("#reportTopLimit").value="10";loadReports()});
$("#exportSalesXlsx")?.addEventListener("click",()=>{const rows=(reportAnalytics?.orders||[]).map(o=>({fecha_pago:o.fecha_pago||o.fecha,numero_pedido:o.numero_pedido||o.id,cliente:o.nombre,rut:o.rut?formatRutChile(o.rut):"",estado_pedido:o.estado,estado_pago:o.estado_pago,total:o.total,medio_pago:o.medio_pago,entrega:o.metodo_entrega}));exportRowsXlsx(rows,"ALE_ATENCIO_VENTAS_PAGADAS.xlsx")});
$("#exportSalesPdf")?.addEventListener("click",()=>simplePdf("ALE ATENCIO · Ventas pagadas",["Fecha","Pedido","Cliente","RUT","Estado","Pago","Total"],(reportAnalytics?.orders||[]).map(o=>[formatDate(o.fecha_pago||o.fecha),o.numero_pedido||o.id,o.nombre,o.rut?formatRutChile(o.rut):"",o.estado,o.estado_pago,money(o.total)]),"ALE_ATENCIO_VENTAS_PAGADAS.pdf"));

function showEditor(id,show=true){const el=$("#"+id);if(el)el.classList.toggle("hidden",!show)}
function renderSuppliers(){
  const rows=(data.suppliers||[]).map(x=>`<tr><td><strong>${esc(x.nombre||"")}</strong></td><td>${esc(x.rut||"")}</td><td>${esc(x.contacto||"")}</td><td>${esc(x.telefono||"")}</td><td>${esc(x.email||"")}</td><td>${String(x.activo??true).toUpperCase()!=="FALSE"&&String(x.activo??"SI").toUpperCase()!=="NO"?"Activo":"Inactivo"}</td><td><div class="row-actions"><button data-edit-supplier="${esc(x.id)}">Editar</button></div></td></tr>`).join("");
  if($("#suppliersTable"))$("#suppliersTable").innerHTML=table(["Proveedor","RUT","Contacto","Teléfono","Correo","Estado","Acciones"],rows)
}
function clearSupplier(){["supplierId","supplierRut","supplierName","supplierContact","supplierPhone","supplierEmail","supplierAddress","supplierNotes"].forEach(id=>{if($("#"+id))$("#"+id).value=""});if($("#supplierActive"))$("#supplierActive").value="SI"}
function openSupplier(id=""){clearSupplier();const x=(data.suppliers||[]).find(v=>String(v.id)===String(id));if(x){$("#supplierId").value=x.id||"";$("#supplierRut").value=x.rut||"";$("#supplierName").value=x.nombre||"";$("#supplierContact").value=x.contacto||"";$("#supplierPhone").value=x.telefono||"";$("#supplierEmail").value=x.email||"";$("#supplierAddress").value=x.direccion||"";$("#supplierNotes").value=x.observaciones||"";$("#supplierActive").value=(String(x.activo??true).toUpperCase()==="FALSE"||String(x.activo).toUpperCase()==="NO")?"NO":"SI"}showEditor("supplierEditor",true)}
$("#newSupplier")?.addEventListener("click",()=>openSupplier());$("#closeSupplierEditor")?.addEventListener("click",()=>showEditor("supplierEditor",false));$("#cancelSupplier")?.addEventListener("click",()=>showEditor("supplierEditor",false));
$("#suppliersTable")?.addEventListener("click",e=>{const b=e.target.closest("[data-edit-supplier]");if(b)openSupplier(b.dataset.editSupplier)});
$("#saveSupplier")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const payload={id:$("#supplierId").value,rut:$("#supplierRut").value.trim(),nombre:$("#supplierName").value.trim(),contacto:$("#supplierContact").value.trim(),telefono:$("#supplierPhone").value.trim(),email:$("#supplierEmail").value.trim(),direccion:$("#supplierAddress").value.trim(),observaciones:$("#supplierNotes").value.trim(),activo:$("#supplierActive").value};if(!payload.nombre)return toast("Nombre de proveedor obligatorio");await AleAPI.post("saveSupplier",payload,token);data=normalizePanelData(await AleAPI.adminModuleReliable("suppliers",token,2));showEditor("supplierEditor",false);renderSuppliers();renderInventory();toast("✓ Proveedor guardado")}catch(err){console.warn(err);toast("✕ No fue posible guardar el proveedor")}}));

function renderInventory(){
  const supplies=data.supplies||[],purchases=data.purchases||[];const current=new Date();const value=supplies.reduce((a,x)=>a+Number(x.stock||0)*Number(x.costo_promedio||0),0),low=supplies.filter(x=>Number(x.stock_minimo||0)>0&&Number(x.stock||0)<=Number(x.stock_minimo||0)).length,month=purchases.filter(x=>{const d=new Date(x.fecha||x.creado_en);return !Number.isNaN(d.getTime())&&d.getFullYear()===current.getFullYear()&&d.getMonth()===current.getMonth()}).reduce((a,x)=>a+Number(x.total||0),0);if($("#inventoryKpiValue"))$("#inventoryKpiValue").textContent=money(value);if($("#inventoryKpiLow"))$("#inventoryKpiLow").textContent=String(low);if($("#inventoryKpiMonth"))$("#inventoryKpiMonth").textContent=money(month);
  if($("#suppliesTable"))$("#suppliesTable").innerHTML=table(["Insumo","Unidad","Stock","Mínimo","Costo promedio","Valor stock","Acciones"],supplies.map(x=>`<tr><td><strong>${esc(x.nombre)}</strong></td><td>${esc(x.unidad||"")}</td><td>${Number(x.stock||0).toLocaleString("es-CL")}</td><td>${Number(x.stock_minimo||0).toLocaleString("es-CL")}</td><td>${money(x.costo_promedio||0)}</td><td>${money(Number(x.stock||0)*Number(x.costo_promedio||0))}</td><td><div class="row-actions"><button data-edit-supply="${esc(x.id)}">Editar</button></div></td></tr>`).join(""));
  const smap=new Map((data.suppliers||[]).map(x=>[String(x.id),x.nombre]));if($("#purchasesTable"))$("#purchasesTable").innerHTML=table(["Fecha","Proveedor","Documento","Items","Total"],purchases.map(x=>{const count=(data.purchaseItems||[]).filter(i=>String(i.compra_id)===String(x.id)).length;return`<tr><td>${esc(formatDate(x.fecha||x.creado_en))}</td><td>${esc(smap.get(String(x.proveedor_id))||"Sin proveedor")}</td><td>${esc([x.tipo_documento,x.documento].filter(Boolean).join(" · "))}</td><td>${count}</td><td>${money(x.total||0)}</td></tr>`}).join(""));
  if($("#productCostTable"))$("#productCostTable").innerHTML=table(["Producto","Ingredientes","Costo estimado","Precio desde","Margen bruto referencial"],(data.products||[]).map(p=>{const cost=Number(p.costo_estimado||0),sizes=Array.isArray(p.tamanos)?p.tamanos:[],prices=sizes.map(z=>Number(z.precio||0)).filter(v=>v>0),price=prices.length?Math.min(...prices):Number(p.precio||0),margin=price>0?price-cost:0;return`<tr><td><strong>${esc(p.nombre)}</strong></td><td>${(p.ingredientes||[]).length}</td><td>${money(cost)}</td><td>${money(price)}</td><td>${money(margin)}</td></tr>`}).join(""));
  const sel=$("#receiptSupplier");if(sel){const v=sel.value;sel.innerHTML='<option value="">Sin proveedor</option>'+(data.suppliers||[]).filter(x=>String(x.activo??"SI").toUpperCase()!=="NO").map(x=>`<option value="${esc(x.id)}">${esc(x.nombre)}</option>`).join("");sel.value=v}
}
function clearSupply(){["supplyId","supplyName","supplyStock","supplyCost","supplyMin"].forEach(id=>{if($("#"+id))$("#"+id).value=""});if($("#supplyUnit"))$("#supplyUnit").value="KG";if($("#supplyActive"))$("#supplyActive").value="SI"}
function openSupply(id=""){clearSupply();const x=(data.supplies||[]).find(v=>String(v.id)===String(id));if(x){$("#supplyId").value=x.id||"";$("#supplyName").value=x.nombre||"";$("#supplyUnit").value=x.unidad||"UNIDAD";$("#supplyStock").value=Number(x.stock||0);$("#supplyCost").value=Number(x.costo_promedio||0);$("#supplyMin").value=Number(x.stock_minimo||0);$("#supplyActive").value=(String(x.activo??true).toUpperCase()==="FALSE"||String(x.activo).toUpperCase()==="NO")?"NO":"SI"}showEditor("supplyEditor",true)}
$("#newSupply")?.addEventListener("click",()=>openSupply());$("#closeSupplyEditor")?.addEventListener("click",()=>showEditor("supplyEditor",false));$("#cancelSupply")?.addEventListener("click",()=>showEditor("supplyEditor",false));$("#suppliesTable")?.addEventListener("click",e=>{const b=e.target.closest("[data-edit-supply]");if(b)openSupply(b.dataset.editSupply)});
$("#saveSupply")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const payload={id:$("#supplyId").value,nombre:$("#supplyName").value.trim(),unidad:$("#supplyUnit").value.trim(),stock:Number($("#supplyStock").value||0),costo_promedio:parseClpAmount($("#supplyCost").value),stock_minimo:Number($("#supplyMin").value||0),activo:$("#supplyActive").value};if(!payload.nombre)return toast("Nombre del insumo obligatorio");await AleAPI.post("saveSupply",payload,token);data=normalizePanelData(await AleAPI.adminModuleReliable("inventory",token,2));showEditor("supplyEditor",false);renderInventory();renderProductIngredientEditor(collectProductIngredients());toast("✓ Insumo guardado")}catch(err){console.warn(err);toast("✕ No fue posible guardar el insumo")}}));
function receiptItemRows(){return $$("#receiptItemsEditor .receipt-item-row").map(row=>({insumo_id:row.querySelector(".receiptSupply")?.value||"",nombre:row.querySelector(".receiptName")?.value.trim()||"",unidad:row.querySelector(".receiptUnit")?.value.trim()||"UNIDAD",cantidad:Math.max(0,Number(row.querySelector(".receiptQty")?.value||0)),costo_unitario:parseClpAmount(row.querySelector(".receiptCost")?.value)})).filter(x=>x.cantidad>0&&(x.insumo_id||x.nombre))}
function updateReceiptTotal(){if($("#receiptTotal"))$("#receiptTotal").textContent=money(receiptItemRows().reduce((a,x)=>a+x.cantidad*x.costo_unitario,0))}
function addReceiptItemRow(x={}){const box=$("#receiptItemsEditor");if(!box)return;const opts=(data.supplies||[]).filter(i=>String(i.activo??"SI").toUpperCase()!=="NO").map(i=>`<option value="${esc(i.id)}">${esc(i.nombre)} · ${esc(i.unidad||"")}</option>`).join("");box.insertAdjacentHTML("beforeend",`<div class="receipt-item-row"><label><small>Insumo existente</small><select class="receiptSupply"><option value="">Nuevo insumo</option>${opts}</select></label><label><small>Nombre</small><input class="receiptName" value="${esc(x.nombre||"")}" placeholder="Nombre"></label><label><small>Unidad</small><input class="receiptUnit" value="${esc(x.unidad||"KG")}"></label><label><small>Cantidad</small><input class="receiptQty" type="number" min="0" step="0.001" value="${Number(x.cantidad||1)}"></label><label><small>Costo unitario</small><input class="receiptCost" inputmode="numeric" value="${Number(x.costo_unitario||0)}"></label><button type="button" class="product-size-remove" data-remove-receipt>×</button></div>`);const row=box.lastElementChild;if(x.insumo_id)row.querySelector(".receiptSupply").value=String(x.insumo_id);updateReceiptTotal()}
function openInventoryReceipt(){if($("#receiptSupplier"))$("#receiptSupplier").value="";if($("#receiptDocument"))$("#receiptDocument").value="";if($("#receiptNotes"))$("#receiptNotes").value="";if($("#receiptType"))$("#receiptType").value="COMPRA";if($("#receiptDate")){const d=new Date(),local=new Date(d.getTime()-d.getTimezoneOffset()*60000);$("#receiptDate").value=local.toISOString().slice(0,16)};if($("#receiptItemsEditor"))$("#receiptItemsEditor").innerHTML="";addReceiptItemRow();showEditor("inventoryReceiptEditor",true)}
$("#newInventoryReceipt")?.addEventListener("click",openInventoryReceipt);$("#addReceiptItem")?.addEventListener("click",()=>addReceiptItemRow());$("#closeInventoryReceipt")?.addEventListener("click",()=>showEditor("inventoryReceiptEditor",false));$("#cancelInventoryReceipt")?.addEventListener("click",()=>showEditor("inventoryReceiptEditor",false));
$("#receiptItemsEditor")?.addEventListener("input",updateReceiptTotal);$("#receiptItemsEditor")?.addEventListener("change",e=>{const sel=e.target.closest(".receiptSupply");if(sel&&sel.value){const item=(data.supplies||[]).find(x=>String(x.id)===String(sel.value)),row=sel.closest(".receipt-item-row");if(item&&row){row.querySelector(".receiptName").value=item.nombre||"";row.querySelector(".receiptUnit").value=item.unidad||"UNIDAD";row.querySelector(".receiptCost").value=Number(item.costo_promedio||0)}}updateReceiptTotal()});$("#receiptItemsEditor")?.addEventListener("click",e=>{const b=e.target.closest("[data-remove-receipt]");if(!b)return;b.closest(".receipt-item-row")?.remove();if(!$("#receiptItemsEditor")?.children.length)addReceiptItemRow();updateReceiptTotal()});
$("#saveInventoryReceipt")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{const items=receiptItemRows();if(!items.length)return toast("Agrega al menos una línea de mercadería");await AleAPI.post("saveInventoryReceipt",{proveedor_id:$("#receiptSupplier").value,fecha:$("#receiptDate").value?new Date($("#receiptDate").value).toISOString():new Date().toISOString(),tipo_documento:$("#receiptType").value,documento:$("#receiptDocument").value.trim(),observaciones:$("#receiptNotes").value.trim(),items},token);data=normalizePanelData(await AleAPI.adminModuleReliable("inventory",token,2));showEditor("inventoryReceiptEditor",false);renderInventory();toast("✓ Mercadería ingresada y costo promedio actualizado") }catch(err){console.warn(err);toast("✕ No fue posible registrar la mercadería")}}));

function renderGallery(){const host=$("#galleryAdminGrid");if(!host)return;host.innerHTML=(data.gallery||[]).length?(data.gallery||[]).map(x=>`<article class="gallery-admin-card"><div class="gallery-admin-media">${x.image_url?`<img src="${esc(resolveMediaUrl(x.image_url))}" alt="${esc(x.titulo||"")}">`:""}</div><div class="gallery-admin-body"><strong>${esc(x.titulo||"")}</strong><small>${esc(x.categoria||"Sin categoría")}${x.fecha_evento?` · ${esc(String(x.fecha_evento).slice(0,10))}`:""}</small><span>${String(x.visible_publico??"SI").toUpperCase()==="NO"?"Privada":"Visible en Web"}</span><button class="btn btn-light btn-compact" data-edit-gallery="${esc(x.id)}">Editar</button></div></article>`).join(""):'<div class="empty-card">Aún no hay imágenes en Galería.</div>'}
function clearGallery(){["galleryId","galleryImageId","galleryImageUrl","galleryTitle","galleryCategory","galleryDate","galleryDescription"].forEach(id=>{if($("#"+id))$("#"+id).value=""});if($("#galleryOrder"))$("#galleryOrder").value="0";if($("#galleryPublic"))$("#galleryPublic").value="SI";if($("#galleryActive"))$("#galleryActive").value="SI";resetFilePicker("#galleryImage")}
function openGallery(id=""){clearGallery();const x=(data.gallery||[]).find(v=>String(v.id)===String(id));if(x){$("#galleryId").value=x.id||"";$("#galleryImageId").value=x.drive_file_id||x.storage_path||"";$("#galleryImageUrl").value=x.image_url||"";$("#galleryTitle").value=x.titulo||"";$("#galleryCategory").value=x.categoria||"";$("#galleryDate").value=x.fecha_evento?String(x.fecha_evento).slice(0,10):"";$("#galleryOrder").value=Number(x.orden||0);$("#galleryDescription").value=x.descripcion||"";$("#galleryPublic").value=String(x.visible_publico??"SI").toUpperCase()==="NO"?"NO":"SI";$("#galleryActive").value=String(x.activo??"SI").toUpperCase()==="NO"?"NO":"SI"}showEditor("galleryEditor",true)}
$("#newGalleryItem")?.addEventListener("click",()=>openGallery());$("#closeGalleryEditor")?.addEventListener("click",()=>showEditor("galleryEditor",false));$("#cancelGalleryEditor")?.addEventListener("click",()=>showEditor("galleryEditor",false));$("#galleryAdminGrid")?.addEventListener("click",e=>{const b=e.target.closest("[data-edit-gallery]");if(b)openGallery(b.dataset.editGallery)});
$("#saveGalleryItem")?.addEventListener("click",e=>busy(e.currentTarget,async()=>{try{let imageId=$("#galleryImageId").value,imageUrl=$("#galleryImageUrl").value;const file=$("#galleryImage")?.files?.[0];if(file){const up=await upload(file,"GALERIA");imageId=up.fileId;imageUrl=up.imageUrl||imageUrl}const payload={id:$("#galleryId").value,titulo:$("#galleryTitle").value.trim(),categoria:$("#galleryCategory").value.trim(),fecha_evento:$("#galleryDate").value,orden:Number($("#galleryOrder").value||0),descripcion:$("#galleryDescription").value.trim(),drive_file_id:imageId,image_url:imageUrl,visible_publico:$("#galleryPublic").value,activo:$("#galleryActive").value};if(!payload.titulo)return toast("Título obligatorio");if(!payload.image_url&&!payload.drive_file_id)return toast("Selecciona una imagen");await AleAPI.post("saveGalleryItem",payload,token);data=normalizePanelData(await AleAPI.adminModuleReliable("gallery",token,2));showEditor("galleryEditor",false);renderGallery();toast("✓ Imagen guardada en Galería") }catch(err){console.warn(err);toast("✕ No fue posible guardar la imagen")}}));

function openAdminView(view){const target=$(`.admin-nav button[data-view="${CSS.escape(String(view||"dashboard"))}"]`);if(!target)return;$$('.admin-nav button').forEach(x=>x.classList.remove("active"));target.classList.add("active");$$('.admin-view').forEach(x=>x.classList.remove("active"));$("#view-"+target.dataset.view)?.classList.add("active");$("#viewTitle").textContent=target.textContent.trim();if(target.dataset.view==="products"){if($("#productSearch"))$("#productSearch").value="";if($("#productFilter"))$("#productFilter").value="";renderProducts()}if(target.dataset.view==="wholesale"){renderWholesale()}if(target.dataset.view==="suppliers"){renderSuppliers()}if(target.dataset.view==="inventory"){renderInventory()}if(target.dataset.view==="gallery"){renderGallery()}if(target.dataset.view==="reports"){loadReports(true).catch(err=>console.warn("reports open",err))}if(sidebarIsMobile())setSidebarOpen(false);window.scrollTo({top:0,behavior:"smooth"})}
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
    if(String(sess.user?.rol||"").toUpperCase()==="MAYORISTA"){
      // Sesiones históricas de mayorista tampoco pueden abrir el área administrativa.
      const wholesaleToken=token;
      clearAdminToken();
      if(wholesaleToken)localStorage.setItem("aleMayoristaToken",wholesaleToken);
      location.href="mayoristas.html";
      return;
    }
    data.currentUser=sess.user||data.currentUser;
    if(sess.permissions)data.permissions=sess.permissions;
    showAdmin();
    renderSessionHeader(sess.user);
    // La sesión ya fue validada. Una falla al cargar datos NO debe cerrar sesión.
    try{await reload()}catch(err){
      console.warn("reload after restored session",err);
      if(isDefinitiveSessionError(err))throw err;
      setSyncState("warning","Reconectando");
      scheduleAdminRetry(ADMIN_DATA_MODULES);
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

window.addEventListener("online",()=>{if(!token)return;if(document.body.classList.contains("auth-active"))reload().catch(e=>console.warn("online reload",e));else restoreAdminSession()});
window.addEventListener("focus",()=>{if(!token)return;if(document.body.classList.contains("auth-active"))reload().catch(e=>console.warn("focus reload",e));else if(!sessionRestoreBusy)restoreAdminSession()});

wireRutInput("#qRut");
wireRutInput("#sBusinessRut");

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

// R9.18.22 · Inicialización monetaria CLP/voz natural.
installStaticClpFields();
