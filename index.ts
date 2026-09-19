import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";

const VERSION = "ALE-SUPABASE-R9.18.41-DOCUMENTOS-A4-TICKET-QR";
const BUCKET = "ale-atencio-public";
const ORDER_PDF_BUCKET = "ale-atencio-private";
const SESSION_HOURS = 24;
const SESSION_TOUCH_MINUTES = 5;
const MAX_LOGIN_FAILS = 5;
const LOGIN_BLOCK_MINUTES = 10;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

const TBK_INTEGRATION_COMMERCE_CODE = "597055555532";
const TBK_INTEGRATION_API_KEY = "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";
const TBK_INTEGRATION_HOST = "https://webpay3gint.transbank.cl";
const TBK_PRODUCTION_HOST = "https://webpay3g.transbank.cl";
const TBK_TRANSACTIONS_PATH = "/rswebpaytransaction/api/webpay/v1.2/transactions";
const TRANSBANK_FUNCTION_NAME = "dynamic-processor";
const TRANSBANK_FALLBACK_CHECKOUT_URL = "https://caberni12.github.io/aleatenciodemo/";
const TRANSBANK_FALLBACK_RETURN_URL = "https://caberni12.github.io/aleatenciodemo/";

function serverKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const single = Deno.env.get("SUPABASE_SECRET_KEY");
  if (single) return single;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const value = parsed?.default || Object.values(parsed || {})[0];
      if (typeof value === "string" && value) return value;
    } catch (_) {}
  }
  throw new Error("CLAVE_SERVIDOR_SUPABASE_NO_DISPONIBLE");
}
if (!SUPABASE_URL) throw new Error("SUPABASE_URL_NO_DISPONIBLE");

const db = createClient(SUPABASE_URL, serverKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Dict = Record<string, any>;
type SessionCtx = { user: Dict; session: Dict; token: string; permissions: Dict };

function clean(v: unknown, max = 5000): string { return String(v ?? "").trim().slice(0, max); }
function bool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toUpperCase();
  if (["SI","SÍ","TRUE","1","YES"].includes(s)) return true;
  if (["NO","FALSE","0"].includes(s)) return false;
  return fallback;
}
function normalizeAmountText(v: unknown): string {
  return clean(v,300).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
const CLP_WORD_NUMBERS:Record<string,number>={cero:0,un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veintiuno:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,cien:100,ciento:100,doscientos:200,trescientos:300,cuatrocientos:400,quinientos:500,seiscientos:600,setecientos:700,ochocientos:800,novecientos:900};
function parseLocalizedNumeric(v:unknown):number{
  if(typeof v==="number")return Number.isFinite(v)?v:NaN;
  let raw=clean(v,300).replace(/\s+/g,"").replace(/[^0-9,.-]/g,"");if(!raw)return NaN;
  const neg=raw.startsWith("-");if(neg)raw=raw.slice(1);let normalized=raw;
  if(/^\d{1,3}([.,]\d{3})+$/.test(raw))normalized=raw.replace(/[.,]/g,"");
  else if(raw.includes(",")&&raw.includes("."))normalized=raw.lastIndexOf(",")>raw.lastIndexOf(".")?raw.replace(/\./g,"").replace(",","."):raw.replace(/,/g,"");
  else if(raw.includes(",")){const parts=raw.split(",");normalized=parts.length===2&&parts[1].length===3?parts.join(""):raw.replace(",", ".");}
  else if((raw.match(/\./g)||[]).length>1||/\.\d{3}$/.test(raw))normalized=raw.replace(/\./g,"");
  const n=Number(normalized);return Number.isFinite(n)?(neg?-n:n):NaN;
}
function parseSpanishAmountWords(v:unknown):number{
  const text=normalizeAmountText(v).replace(/\b(?:pesos?|chilenos?|clp|monto|precio|valor|total|de)\b/g," ").replace(/[^a-z0-9.,\s-]/g," ").replace(/\s+/g," ").trim();if(!text)return NaN;
  let total=0,current=0,recognized=false;
  for(const rawToken of text.split(" ")){const token=rawToken.replace(/^-|-$/g,"");if(!token||token==="y")continue;
    if(/^\d/.test(token)){const n=parseLocalizedNumeric(token);if(Number.isFinite(n)){current+=n;recognized=true;continue;}}
    if(token==="mil"||token==="miles"){total+=current>=1000?current:(current||1)*1000;current=0;recognized=true;continue;}
    if(token==="millon"||token==="millones"){total+=(current||1)*1000000;current=0;recognized=true;continue;}
    if(token==="luca"||token==="lucas"){total+=current>=1000?current:(current||1)*1000;current=0;recognized=true;continue;}
    if(Object.prototype.hasOwnProperty.call(CLP_WORD_NUMBERS,token)){current+=CLP_WORD_NUMBERS[token];recognized=true;}
  }
  return recognized?total+current:NaN;
}
function money(v: unknown): number {
  const text=normalizeAmountText(v);let n:number=NaN;
  if(/\b(mil|miles|millon|millones|luca|lucas)\b/.test(text))n=parseSpanishAmountWords(v);
  if(!Number.isFinite(Number(n)))n=parseLocalizedNumeric(v);
  if(!Number.isFinite(Number(n)))n=parseSpanishAmountWords(v);
  const value=Number(n);return Number.isFinite(value)&&value>=0?Math.round(value*100)/100:0;
}
function yesNo(v: unknown): string { return bool(v) ? "SI" : "NO"; }
function nowIso(): string { return new Date().toISOString(); }
function clientIp(req: Request): string {
  return clean(req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("cf-connecting-ip") || "", 120);
}
function normalizeLogin(v: unknown): string { return clean(v, 180).toLowerCase().replace(/\s+/g, ""); }

function normalizeRut(v: unknown): string {
  return clean(v, 32).toUpperCase().replace(/[^0-9K]/g, "");
}
function isValidRut(v: unknown): boolean {
  const rut = normalizeRut(v);
  if (!/^[0-9]{7,8}[0-9K]$/.test(rut)) return false;
  const body = rut.slice(0, -1);
  const dv = rut.slice(-1);
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (sum % 11);
  const expected = r === 11 ? "0" : r === 10 ? "K" : String(r);
  return dv === expected;
}
function formatRut(v: unknown): string {
  const rut = normalizeRut(v);
  if (!rut) return "";
  const body = rut.slice(0, -1);
  const dv = rut.slice(-1);
  const dotted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${dotted}-${dv}`;
}
function requireValidRut(v: unknown, errorCode = "RUT_INVALIDO"): { rut:string; normalized:string } {
  const normalized = normalizeRut(v);
  if (!normalized) throw new Error("RUT_REQUERIDO");
  if (!isValidRut(normalized)) throw new Error(errorCode);
  return { rut: formatRut(normalized), normalized };
}
function cors(_req: Request): HeadersInit {
  // R9.3: la Web/cPanel no usan cookies ni Supabase Auth. La sesión administrativa
  // viaja en X-Ale-Session, por lo que podemos permitir CORS público sin crear
  // falsos fallos cuando cambia el dominio de GitHub Pages.
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-ale-session, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };
}
function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}
function randomToken(bytes = 48): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  let binary = "";
  for (const b of a) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function safeHttps(v: unknown): string {
  const raw=clean(v,2000);
  if(!raw)return "";
  try{const u=new URL(raw);return u.protocol==="https:"?u.toString():"";}catch(_){return "";}
}
function transbankEnvironment(): "INTEGRATION"|"PRODUCTION" {
  const raw=clean(Deno.env.get("TRANSBANK_ENVIRONMENT")||"INTEGRATION",40).toUpperCase();
  return ["PRODUCTION","PRODUCCION","PROD"].includes(raw)?"PRODUCTION":"INTEGRATION";
}
function transbankCredentialsFor(environment:"INTEGRATION"|"PRODUCTION"){
  if(environment==="INTEGRATION") return {environment,host:TBK_INTEGRATION_HOST,commerceCode:TBK_INTEGRATION_COMMERCE_CODE,apiKey:TBK_INTEGRATION_API_KEY,credentialsReady:true};
  const commerceCode=clean(Deno.env.get("TRANSBANK_COMMERCE_CODE"),80);
  const apiKey=clean(Deno.env.get("TRANSBANK_API_KEY_SECRET"),300);
  return {environment,host:TBK_PRODUCTION_HOST,commerceCode,apiKey,credentialsReady:!!commerceCode&&!!apiKey};
}
function transbankServerCredentials(){return transbankCredentialsFor(transbankEnvironment());}
function isTransbankPublicHost(host:string):boolean{
  host=String(host||"").toLowerCase();
  return host==="webpay.cl"||host.endsWith(".webpay.cl")||host==="transbank.cl"||host.endsWith(".transbank.cl");
}
function transbankPublicUrl(v:unknown):string{
  const url=safeHttps(v);
  if(!url)return "";
  try{
    const host=new URL(url).hostname.toLowerCase();
    // La URL final del cliente debe ser una web del comercio, nunca Supabase ni una página de pago Transbank.
    if(host==="supabase.co"||host.endsWith(".supabase.co")||isTransbankPublicHost(host))return "";
    return url;
  }catch(_){return "";}
}
function transbankManualPaymentUrl(v:unknown):string{
  const url=safeHttps(v);
  if(!url)return "";
  try{return isTransbankPublicHost(new URL(url).hostname.toLowerCase())?url:"";}catch(_){return "";}
}
function isInternalServerHost(host:string):boolean{
  host=String(host||"").toLowerCase();
  return host==="supabase.co"||host.endsWith(".supabase.co")||host==="script.google.com"||host.endsWith(".script.google.com")||host==="script.googleusercontent.com"||host.endsWith(".script.googleusercontent.com")||host==="localhost"||host==="127.0.0.1";
}
function publicWebUrl(v:unknown):string{
  const url=safeHttps(v);
  if(!url)return "";
  try{
    const u=new URL(url),host=u.hostname.toLowerCase();
    if(isInternalServerHost(host)||isTransbankPublicHost(host)||/\/(?:functions|rest|storage)\/v1\//i.test(u.pathname))return "";
    u.search="";u.hash="";
    if(!u.pathname.endsWith("/")){const last=u.pathname.split("/").pop()||"";u.pathname=/\.[a-z0-9]{1,8}$/i.test(last)?u.pathname.replace(/[^/]+$/,""):u.pathname+"/";}
    return u.toString();
  }catch(_){return "";}
}
function publicWebBaseUrl(cfg:Dict):string{
  return publicWebUrl(cfg.web_public_url)||publicWebUrl(cfg.transbank_checkout_url)||TRANSBANK_FALLBACK_CHECKOUT_URL;
}
function transbankCheckoutUrl(cfg:Dict):string{
  return transbankPublicUrl(cfg.transbank_checkout_url)||TRANSBANK_FALLBACK_CHECKOUT_URL;
}
function transbankFinalReturnUrl(cfg:Dict):string{
  return transbankPublicUrl(cfg.transbank_return_url)||transbankCheckoutUrl(cfg)||TRANSBANK_FALLBACK_RETURN_URL;
}
function transbankRuntimeInfo(cfg:Dict){
  const server=transbankServerCredentials();
  const checkoutUrl=transbankCheckoutUrl(cfg);
  const returnUrl=transbankFinalReturnUrl(cfg);
  const enabled=yesNo(cfg.transbank_enabled)==="SI";
  return {...server,checkoutUrl,returnUrl,enabled,checkoutUrlReady:!!checkoutUrl,urlReady:!!returnUrl,ready:enabled&&!!checkoutUrl&&!!returnUrl&&server.credentialsReady};
}
function transbankHeaders(environment:"INTEGRATION"|"PRODUCTION"){
  const c=transbankCredentialsFor(environment);
  if(!c.credentialsReady)throw new Error("TRANSBANK_CREDENCIALES_SERVIDOR_PENDIENTES");
  return {"Content-Type":"application/json","Tbk-Api-Key-Id":c.commerceCode,"Tbk-Api-Key-Secret":c.apiKey};
}
function transbankApiUrl(environment:"INTEGRATION"|"PRODUCTION",token=""){const c=transbankCredentialsFor(environment);return `${c.host}${TBK_TRANSACTIONS_PATH}${token?`/${encodeURIComponent(token)}`:""}`;}
function transbankBuyOrder():string{return (`AA${Date.now().toString(36)}${crypto.randomUUID().replaceAll("-","").slice(0,8)}`).toUpperCase().slice(0,26);}
function transbankSessionId(orderId:string):string{return `ALE-${clean(orderId,36)}-${crypto.randomUUID().replaceAll("-","").slice(0,12)}`.slice(0,61);}
function transbankEdgeReturnUrl(_req?:Request,paymentId="",orderId=""):string{
  const base=safeHttps(SUPABASE_URL);
  if(!base)throw new Error("SUPABASE_URL_NO_DISPONIBLE");
  const u=new URL(base);
  u.pathname=`/functions/v1/${TRANSBANK_FUNCTION_NAME}`;
  u.search="";u.hash="";u.searchParams.set("tbk_return","1");
  if(paymentId)u.searchParams.set("tbk_pid",clean(paymentId,100));
  if(orderId)u.searchParams.set("tbk_oid",clean(orderId,100));
  return u.toString().slice(0,512);
}
async function transbankFetch(environment:"INTEGRATION"|"PRODUCTION",url:string, init:RequestInit):Promise<Dict>{
  const response=await fetch(url,{...init,headers:{...transbankHeaders(environment),...(init.headers||{})}});
  const text=await response.text();let payload:Dict={};try{payload=text?JSON.parse(text):{};}catch(_){payload={raw:text.slice(0,1000)};}
  if(!response.ok)throw new Error(`TRANSBANK_HTTP_${response.status}:${clean(payload.error_message||payload.message||payload.raw||"ERROR",400)}`);
  return payload;
}
async function transbankRemoteCreate(req:Request,environment:"INTEGRATION"|"PRODUCTION",buyOrder:string,sessionId:string,amount:number,paymentId="",orderId=""){
  return await transbankFetch(environment,transbankApiUrl(environment),{method:"POST",body:JSON.stringify({buy_order:buyOrder,session_id:sessionId,amount,return_url:transbankEdgeReturnUrl(req,paymentId,orderId)})});
}
async function transbankRemoteCommit(token:string,environment:"INTEGRATION"|"PRODUCTION"){return await transbankFetch(environment,transbankApiUrl(environment,token),{method:"PUT"});}
async function transbankRemoteStatus(token:string,environment:"INTEGRATION"|"PRODUCTION"){return await transbankFetch(environment,transbankApiUrl(environment,token),{method:"GET"});}
function paymentStatusFromCommit(resp:Dict):"PAGADO"|"RECHAZADO"{return String(resp.status||"").toUpperCase()==="AUTHORIZED"&&Number(resp.response_code)===0?"PAGADO":"RECHAZADO";}
function buildFinalReturnUrl(base:string,status:string,orderNumber:string){const u=new URL(base);u.searchParams.set("tbk",status);if(orderNumber)u.searchParams.set("order",orderNumber);return u.toString();}
function redirect303(url:string){return new Response(null,{status:303,headers:{Location:url,"Cache-Control":"no-store"}});}

function safeUser(u: Dict | null): Dict | null {
  if (!u) return null;
  return {
    id: String(u.id || ""), nombre: String(u.nombre || ""), usuario: String(u.usuario || ""),
    email: String(u.email || ""), rol: String(u.rol || "EDITOR").toUpperCase(),
    permisos: u.permisos || {}, activo: yesNo(u.activo),
    profile_file_id: String(u.profile_path || ""), profile_url: String(u.profile_url || ""),
    ultimo_acceso: u.ultimo_acceso || "", fecha_creacion: u.creado_en || "", fecha_actualizacion: u.updated_at || "",
  };
}

function rolePermissions(role: string): Dict {
  const r = String(role || "EDITOR").toUpperCase();
  const modules = ["dashboard","products","categories","banners","orders","requests","quotes","clients","reports","content","users","settings"];
  const out: Dict = {};
  for (const m of modules) out[m] = { read:false, write:false, delete:false };
  if (r === "ADMIN") { for (const m of modules) out[m] = {read:true,write:true,delete:true}; return out; }
  if (r === "GERENCIA") {
    for (const m of ["dashboard","products","categories","banners","orders","requests","quotes","clients","reports","content"]) out[m] = {read:true,write:true,delete:true};
    out.users = {read:true,write:false,delete:false}; out.settings = {read:true,write:true,delete:false}; return out;
  }
  if (r === "LECTURA") {
    for (const m of ["dashboard","products","categories","banners","orders","requests","quotes","clients","reports","content","settings"]) out[m] = {read:true,write:false,delete:false};
    return out;
  }
  out.dashboard = {read:true,write:false,delete:false};
  for (const m of ["products","categories","orders","requests","quotes","clients","reports","content"]) out[m] = {read:true,write:true,delete:false};
  out.banners = {read:true,write:false,delete:false}; out.settings = {read:true,write:false,delete:false};
  return out;
}
function normalizedPermissions(user: Dict): Dict {
  const base = rolePermissions(user.rol);
  if (String(user.rol || "").toUpperCase() === "ADMIN") return base;
  const custom = user.permisos && typeof user.permisos === "object" ? user.permisos : {};
  for (const [m, actions] of Object.entries(custom)) {
    if (!base[m] || !actions || typeof actions !== "object") continue;
    for (const a of ["read","write","delete"]) if ((actions as Dict)[a] !== undefined) base[m][a] = !!(actions as Dict)[a];
    if (base[m].write || base[m].delete) base[m].read = true;
  }
  return base;
}
function requirePermission(ctx: SessionCtx, moduleName: string, action = "read") {
  if (String(ctx.user.rol || "").toUpperCase() === "ADMIN") return;
  if (!ctx.permissions?.[moduleName]?.[action]) throw new Error("PERMISO_DENEGADO");
}
function requireAdmin(ctx: SessionCtx) {
  if (String(ctx.user.rol || "").toUpperCase() !== "ADMIN") throw new Error("PERMISO_DENEGADO");
}

async function audit(req: Request, ctx: SessionCtx | null, accion: string, entidad: string, entidadId = "", detalle: Dict = {}) {
  try {
    await db.from("auditoria").insert({
      actor_usuario_id: ctx?.user?.id || null,
      actor_usuario: ctx?.user?.usuario || null,
      accion, entidad, entidad_id: entidadId || null, detalle,
      ip: clientIp(req), user_agent: clean(req.headers.get("user-agent"), 1000),
    });
  } catch (_) {}
}

function deferTask(task: Promise<unknown>) {
  // Responde al navegador apenas la operación principal quedó persistida.
  // La auditoría no debe convertir un INSERT correcto en un timeout visual.
  const safe = task.catch(() => undefined);
  try {
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(safe);
  } catch (_) {}
}

async function loginKey(login: string, ip: string): Promise<string> {
  return sha256Hex(`${normalizeLogin(login)}|${ip || "-"}`);
}
async function assertLoginAllowed(login: string, ip: string) {
  const key = await loginKey(login, ip);
  const { data, error } = await db.from("login_intentos").select("intentos,bloqueado_hasta").eq("clave", key).maybeSingle();
  if (error) throw error;
  if (data?.bloqueado_hasta && new Date(data.bloqueado_hasta).getTime() > Date.now()) throw new Error("LOGIN_BLOQUEADO_TEMPORALMENTE");
}
async function recordLoginFailure(login: string, ip: string) {
  const key = await loginKey(login, ip);
  const { data } = await db.from("login_intentos").select("intentos").eq("clave", key).maybeSingle();
  const attempts = Number(data?.intentos || 0) + 1;
  const blocked = attempts >= MAX_LOGIN_FAILS ? new Date(Date.now() + LOGIN_BLOCK_MINUTES * 60_000).toISOString() : null;
  await db.from("login_intentos").upsert({ clave:key, login:normalizeLogin(login), ip, intentos:attempts, bloqueado_hasta:blocked }, { onConflict:"clave" });
}
async function clearLoginFailures(login: string, ip: string) {
  const key = await loginKey(login, ip);
  await db.from("login_intentos").delete().eq("clave", key);
}

async function login(req: Request, d: Dict) {
  const loginValue = normalizeLogin(d.usuario || d.username || d.email);
  const password = String(d.password || "");
  if (!loginValue || !password) throw new Error("CREDENCIALES_REQUERIDAS");
  const ip = clientIp(req);
  await assertLoginAllowed(loginValue, ip);

  const { data, error } = await db.rpc("ale_verificar_credenciales", { p_login: loginValue, p_password: password });
  if (error) throw error;
  const user = Array.isArray(data) ? data[0] : data;
  if (!user?.id || user.activo === false) {
    await recordLoginFailure(loginValue, ip);
    throw new Error("USUARIO_O_CLAVE_INVALIDOS");
  }
  await clearLoginFailures(loginValue, ip);

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60_000).toISOString();
  await db.from("sesiones").delete().eq("usuario_id", user.id).lt("expira_en", nowIso());
  const { error: sessionError } = await db.from("sesiones").insert({
    usuario_id:user.id, token_hash:tokenHash, expira_en:expires,
    ip, user_agent:clean(req.headers.get("user-agent"), 1000),
  });
  if (sessionError) throw sessionError;
  const ctx: SessionCtx = { user, session:{expira_en:expires}, token, permissions:normalizedPermissions(user) };
  deferTask(audit(req, ctx, "LOGIN", "USUARIO", user.id, { via:"TABLA_USUARIOS" }));
  return {
    ok:true, token, user:safeUser(user), permissions:ctx.permissions,
    expires_in:SESSION_HOURS*3600, version:VERSION, api_contract:2,
    capabilities:["adminmodule","bulkdeleteentities","verifydeleteentities","storage_images","sliding_session","orderdetail","order_pdf","rut_cl","transbank_webpay_plus","ecommerce_integrations","order_tracking","sales_analytics","cpanel_order_create","transfer_proof","public_share_links","notification_read_sync","protected_order_pdf","request_paid_close_lock","commercial_table_filters","document_formats","document_trace_qr"]
  };
}

function tokenFrom(req: Request, body: Dict): string {
  const h = clean(req.headers.get("authorization"), 500);
  if (/^Bearer\s+/i.test(h)) return h.replace(/^Bearer\s+/i, "").trim();
  const x = clean(req.headers.get("x-ale-session"), 500);
  if (x) return x;
  return clean(body.token, 500);
}
async function requireSession(req: Request, body: Dict): Promise<SessionCtx> {
  const token = tokenFrom(req, body);
  if (!token) throw new Error("SESION_REQUERIDA");
  const tokenHash = await sha256Hex(token);
  const { data: session, error } = await db.from("sesiones").select("*").eq("token_hash", tokenHash).eq("revocada", false).maybeSingle();
  if (error) throw error;
  if (!session) throw new Error("SESION_INVALIDA");
  if (new Date(session.expira_en).getTime() <= Date.now()) throw new Error("SESION_EXPIRADA");
  const { data:user, error:userError } = await db.from("usuarios").select("*").eq("id", session.usuario_id).eq("activo", true).maybeSingle();
  if (userError) throw userError;
  if (!user) throw new Error("USUARIO_INACTIVO");

  // R9.15.1: sesión deslizante. La actividad real renueva la vigencia, pero
  // el touch se limita para evitar una escritura a BD en cada polling de 8 s.
  const now=Date.now();
  const lastUse=new Date(session.ultimo_uso_en||session.creado_en||0).getTime();
  const shouldTouch=!Number.isFinite(lastUse)||(now-lastUse)>=SESSION_TOUCH_MINUTES*60_000;
  if(shouldTouch){
    const touchedAt=new Date(now).toISOString();
    const refreshedExpiry=new Date(now+SESSION_HOURS*60*60_000).toISOString();
    const {error:touchError}=await db.from("sesiones").update({ultimo_uso_en:touchedAt,expira_en:refreshedExpiry}).eq("id",session.id);
    if(!touchError){session.ultimo_uso_en=touchedAt;session.expira_en=refreshedExpiry}
  }
  return { user, session, token, permissions:normalizedPermissions(user) };
}

function storagePublicUrl(path: unknown): string {
  const p=clean(path,1000);
  if(!p)return "";
  try{return db.storage.from(BUCKET).getPublicUrl(p).data.publicUrl||""}catch(_){return ""}
}
function resolvedImageUrl(r: Dict): string {
  const explicit=clean(r.image_url,2000);
  if(explicit)return explicit;
  return storagePublicUrl(r.storage_path);
}
function legacyProduct(r: Dict) { return {...r,image_url:resolvedImageUrl(r),destacado:yesNo(r.destacado),activo:yesNo(r.activo),drive_file_id:r.storage_path||""}; }
function legacyCategory(r: Dict) { return {...r,image_url:resolvedImageUrl(r),activo:yesNo(r.activo),drive_file_id:r.storage_path||""}; }
function legacyBanner(r: Dict) { return {...r,image_url:resolvedImageUrl(r),activo:yesNo(r.activo),drive_file_id:r.storage_path||""}; }

async function configMap(): Promise<Dict> {
  const { data, error } = await db.from("config").select("clave,valor");
  if (error) throw error;
  const out: Dict = {};
  for (const r of data || []) out[String(r.clave)] = String(r.valor ?? "");
  out.logo_drive_file_id = out.logo_drive_file_id || out.logo_storage_path || "";
  if(!out.logo_url && out.logo_storage_path) out.logo_url = storagePublicUrl(out.logo_storage_path);
  // ALE ATENCIO opera únicamente en pesos chilenos. No exponer USD por configuración heredada.
  out.moneda = "CLP";
  out.document_format = normalizeDocumentFormat(out.document_format);
  return out;
}
function apiWarning(scope:string, err:any): string {
  const code=clean(err?.code||err?.message||err,160)||"ERROR_DESCONOCIDO";
  return `${scope}:${code}`;
}
async function safeDbQuery(scope:string, promise:any): Promise<any> {
  try{
    const out=await promise;
    if(out?.error)return{ok:false,scope,error:out.error,warning:apiWarning(scope,out.error)};
    return{ok:true,scope,data:out?.data||[]};
  }catch(err){return{ok:false,scope,error:err,warning:apiWarning(scope,err)}}
}
async function safeConfigQuery(): Promise<any> {
  try{return{ok:true,scope:"config",data:await configMap()}}
  catch(err){return{ok:false,scope:"config",error:err,warning:apiWarning("config",err)}}
}

function pdfSafeText(v: unknown): string {
  return clean(v, 8000).replace(/[\r\t]+/g, " ").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
}
function clp(v: unknown): string {
  return `$${Math.round(money(v)).toLocaleString("es-CL")}`;
}
function normalizeDocumentFormat(v:unknown):"A4"|"TICKET_80"|"TICKET_100"{
  const x=clean(v,40).toUpperCase().replace(/[ -]+/g,"_");
  if(x==="TICKET_80"||x==="80"||x==="80MM")return "TICKET_80";
  if(x==="TICKET_100"||x==="100"||x==="100MM")return "TICKET_100";
  return "A4";
}
const MM_TO_PT=72/25.4;
function mmPt(mm:number):number{return mm*MM_TO_PT;}
function wrapPdfText(font:any, text:string, size:number, maxWidth:number): string[] {
  const out:string[]=[];
  for(const paragraph of pdfSafeText(text).split(/\n/)){
    const words=paragraph.split(/\s+/).filter(Boolean);
    if(!words.length){out.push("");continue;}
    let line="";
    for(const word of words){
      const candidate=line?`${line} ${word}`:word;
      if(font.widthOfTextAtSize(candidate,size)<=maxWidth){line=candidate;continue;}
      if(line)out.push(line);
      if(font.widthOfTextAtSize(word,size)<=maxWidth){line=word;continue;}
      let chunk="";
      for(const ch of word){
        const c=chunk+ch;
        if(font.widthOfTextAtSize(c,size)>maxWidth&&chunk){out.push(chunk);chunk=ch}else chunk=c;
      }
      line=chunk;
    }
    if(line)out.push(line);
  }
  return out.length?out:[""];
}
async function maybeEmbedLogo(pdf:any, config:Dict): Promise<any|null> {
  const url=clean(config.logo_url,2000)||storagePublicUrl(config.logo_storage_path);
  if(!url)return null;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4500);
  try{
    const res=await fetch(url,{signal:controller.signal});if(!res.ok)return null;
    const bytes=new Uint8Array(await res.arrayBuffer());
    const type=(res.headers.get("content-type")||"").toLowerCase();
    if(type.includes("png")||url.toLowerCase().includes(".png"))return await pdf.embedPng(bytes);
    if(type.includes("jpeg")||type.includes("jpg")||/\.jpe?g(?:\?|$)/i.test(url))return await pdf.embedJpg(bytes);
  }catch(_){
    // El logo es decorativo: nunca debe impedir registrar o regenerar un pedido.
  }finally{clearTimeout(timer);}
  return null;
}
async function embedTraceQr(pdf:any,url:string):Promise<any|null>{
  if(!url)return null;
  try{
    const dataUrl=await (QRCode as any).toDataURL(url,{width:720,margin:1,errorCorrectionLevel:"M"});
    const base64=String(dataUrl||"").split(",")[1]||"";
    if(!base64)return null;
    return await pdf.embedPng(b64Bytes(base64));
  }catch(err){console.warn("PDF_QR",err instanceof Error?err.message:String(err));return null;}
}
async function buildOrderPdf(order:Dict, items:Dict[], config:Dict): Promise<Uint8Array> {
  const pdf=await PDFDocument.create();
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo=await maybeEmbedLogo(pdf,config);
  const format=normalizeDocumentFormat(config.document_format);
  const traceUrl=await documentTraceUrl("PEDIDO",String(order.id||""),config);
  const qr=await embedTraceQr(pdf,traceUrl);
  const business=pdfSafeText(config.empresa||"Ale Atencio"),orderNumber=pdfSafeText(order.numero_pedido||order.id||"");
  const businessRut=formatRut(config.empresa_rut||"");
  const companyLines=[businessRut?`RUT: ${businessRut}`:"",config.direccion,config.email,config.whatsapp?`WhatsApp: ${config.whatsapp}`:""].filter(Boolean).map(pdfSafeText);
  const customerLines=[order.nombre,order.rut?`RUT: ${formatRut(order.rut)}`:"",order.telefono?`WhatsApp: ${order.telefono}`:"",order.email?`Correo: ${order.email}`:"",order.metodo_entrega?`Entrega: ${order.metodo_entrega}`:"",order.direccion?`Dirección: ${order.direccion}`:"",order.comuna?`Comuna: ${order.comuna}`:""].filter(Boolean).map(pdfSafeText);

  if(format!=="A4"){
    const widthMm=format==="TICKET_100"?100:80,width=mmPt(widthMm),margin=mmPt(5),content=width-margin*2,qrSize=mmPt(40);
    const size=8.2,lineH=10.5,small=7.2;
    const lineCount=(text:unknown,font=regular,fontSize=size,max=content)=>wrapPdfText(font,pdfSafeText(text),fontSize,max).length;
    let estimated=margin+mmPt(18)+18+companyLines.reduce((a,x)=>a+lineCount(x,regular,small)*9,0)+24;
    estimated+=30+customerLines.reduce((a,x)=>a+lineCount(x)*lineH,0)+15;
    for(const item of items){estimated+=lineCount(item.producto_nombre||item.nombre||item.descripcion||"Producto",regular,size,content)*lineH+22;}
    estimated+=72+(order.observaciones?lineCount(order.observaciones,regular,small,content)*9+24:0)+28+qrSize+38+margin;
    const height=Math.max(mmPt(180),Math.min(mmPt(2000),estimated));
    const page=pdf.addPage([width,height]);let y=height-margin;
    const draw=(text:unknown,x:number,yy:number,fontSize=size,font=regular,opts:any={})=>page.drawText(pdfSafeText(text),{x,y:yy,size:fontSize,font,color:opts.color||rgb(.18,.15,.14),maxWidth:opts.maxWidth});
    const wrapped=(text:unknown,fontSize=size,font=regular,lh=lineH,maxWidth=content)=>{const lines=wrapPdfText(font,pdfSafeText(text),fontSize,maxWidth);for(const ln of lines){draw(ln,margin,y,fontSize,font);y-=lh;}return lines.length};
    if(logo){try{const maxW=mmPt(widthMm===100?38:34),maxH=mmPt(18),scale=Math.min(maxW/logo.width,maxH/logo.height);const w=logo.width*scale,h=logo.height*scale;page.drawImage(logo,{x:(width-w)/2,y:y-h,width:w,height:h});y-=h+6;}catch(_){}}
    const bw=bold.widthOfTextAtSize(business,12);draw(business,Math.max(margin,(width-bw)/2),y,12,bold);y-=15;
    for(const line of companyLines){for(const ln of wrapPdfText(regular,line,small,content)){const tw=regular.widthOfTextAtSize(ln,small);draw(ln,Math.max(margin,(width-tw)/2),y,small,regular);y-=9;}}
    y-=5;page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:.7,color:rgb(.82,.73,.68)});y-=16;
    const title="PEDIDO";draw(title,(width-bold.widthOfTextAtSize(title,12))/2,y,12,bold);y-=15;draw(orderNumber,(width-bold.widthOfTextAtSize(orderNumber,9.5))/2,y,9.5,bold);y-=13;
    wrapped(`Fecha: ${new Date(order.fecha||Date.now()).toLocaleString("es-CL")}`,small,regular,9);wrapped(`Estado: ${publicOrderStatusLabel(order.estado||"PENDIENTE")}`,small,regular,9);wrapped(`Pago: ${clean(order.estado_pago||"PENDIENTE",80)}${order.medio_pago?` · ${clean(order.medio_pago,40)}`:""}`,small,regular,9);y-=8;
    draw("CLIENTE",margin,y,9,bold);y-=12;for(const line of customerLines)wrapped(line,size,regular,lineH);y-=8;
    page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:.6,color:rgb(.86,.80,.77)});y-=13;draw("DETALLE",margin,y,9,bold);y-=13;
    for(const item of items){wrapped(item.producto_nombre||item.nombre||item.descripcion||"Producto",size,bold,lineH);const qty=Math.max(1,Number(item.cantidad||1)),unit=clp(item.precio_unitario??item.precio),lt=clp(item.subtotal??qty*Number(item.precio_unitario??item.precio??0));const left=`${qty} x ${unit}`,rightText=lt;draw(left,margin,y,small,regular);draw(rightText,width-margin-regular.widthOfTextAtSize(rightText,small),y,small,bold);y-=13;page.drawLine({start:{x:margin,y:y+5},end:{x:width-margin,y:y+5},thickness:.35,color:rgb(.90,.86,.84)});}
    y-=5;for(const [label,value] of [["Subtotal",order.subtotal],["Despacho",order.despacho],["TOTAL",order.total]] as any[]){const total=label==="TOTAL",f=total?bold:regular,fs=total?11:8.5,val=clp(value);draw(label,margin,y,fs,f);draw(val,width-margin-f.widthOfTextAtSize(val,fs),y,fs,f);y-=total?18:13;}
    if(order.observaciones){y-=2;draw("OBSERVACIONES",margin,y,8.5,bold);y-=12;wrapped(order.observaciones,small,regular,9);}
    y-=8;page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:.6,color:rgb(.82,.73,.68)});y-=13;wrapped("Escanea el QR para consultar el seguimiento y la trazabilidad actualizada.",small,regular,9);y-=5;
    if(qr){page.drawImage(qr,{x:(width-qrSize)/2,y:y-qrSize,width:qrSize,height:qrSize});y-=qrSize+8;}
    const traceLabel="SEGUIMIENTO DEL PEDIDO";draw(traceLabel,(width-bold.widthOfTextAtSize(traceLabel,small))/2,y,small,bold);y-=12;
    wrapped("Documento de respaldo. No reemplaza boleta, factura ni documento tributario.",6.5,regular,8);y-=5;
    const foot=`${business} · ${orderNumber}`;draw(foot,Math.max(margin,(width-regular.widthOfTextAtSize(foot,6.3))/2),Math.max(margin,y),6.3,regular,{color:rgb(.45,.40,.38)});
    return new Uint8Array(await pdf.save());
  }

  const pageSize:[number,number]=[595.28,841.89],margin=44,right=pageSize[0]-margin,qrSize=mmPt(30);let page:any,y=0;
  const addPage=()=>{page=pdf.addPage(pageSize);y=pageSize[1]-48;return page};
  const ensure=(height:number)=>{if(y-height<58)addPage()};
  const drawText=(text:unknown,x:number,yy:number,size=9,font=regular,opts:any={})=>page.drawText(pdfSafeText(text),{x,y:yy,size,font,color:opts.color||rgb(0.23,0.18,0.16),maxWidth:opts.maxWidth});
  const drawWrapped=(text:unknown,x:number,maxWidth:number,size=9,font=regular,lineH=12)=>{const lines=wrapPdfText(font,pdfSafeText(text),size,maxWidth);ensure(lines.length*lineH+4);for(const line of lines){drawText(line,x,y,size,font);y-=lineH;}return lines.length};
  addPage();
  if(logo){try{const scale=Math.min(110/logo.width,50/logo.height);page.drawImage(logo,{x:margin,y:y-38,width:logo.width*scale,height:logo.height*scale});}catch(_){}}
  const qrX=right-qrSize;if(qr){page.drawImage(qr,{x:qrX,y:y-qrSize+4,width:qrSize,height:qrSize});drawText("Seguimiento",qrX+qrSize/2-regular.widthOfTextAtSize("Seguimiento",7)/2,y-qrSize-5,7,regular);}
  const companyRight=qr?qrX-12:right;drawText(business,companyRight-bold.widthOfTextAtSize(business,17),y,17,bold);
  let cy=y-17;for(const line of companyLines){const t=pdfSafeText(line);drawText(t,companyRight-regular.widthOfTextAtSize(t,8.5),cy,8.5,regular);cy-=11;}
  y-=102;page.drawLine({start:{x:margin,y},end:{x:right,y},thickness:1,color:rgb(0.82,0.73,0.68)});y-=27;
  drawText("RESPALDO DE PEDIDO",margin,y,18,bold);drawText(orderNumber,right-bold.widthOfTextAtSize(orderNumber,11),y+2,11,bold);y-=19;
  const dateText=`Fecha: ${new Date(order.fecha||Date.now()).toLocaleString("es-CL")}`;drawText(dateText,margin,y,9,regular);const stateText=`Pedido: ${publicOrderStatusLabel(order.estado||"PENDIENTE")}`;drawText(stateText,right-regular.widthOfTextAtSize(pdfSafeText(stateText),9),y,9,regular);y-=14;const paymentText=`Pago: ${clean(order.estado_pago||"PENDIENTE",80)}${order.medio_pago?` · ${clean(order.medio_pago,40)}`:""}`;drawText(paymentText,margin,y,9,regular);y-=20;
  drawText("Cliente",margin,y,11,bold);y-=16;for(const line of customerLines)drawWrapped(line,margin,right-margin,9,regular,11);y-=10;
  const col={desc:margin,qty:350,unit:414,total:right};const drawTableHeader=()=>{ensure(28);page.drawRectangle({x:margin,y:y-16,width:right-margin,height:20,color:rgb(0.96,0.93,0.91)});drawText("Producto",col.desc+5,y-3,8.5,bold);drawText("Cant.",col.qty,y-3,8.5,bold);drawText("P. unit.",col.unit,y-3,8.5,bold);const tt="Total";drawText(tt,col.total-bold.widthOfTextAtSize(tt,8.5),y-3,8.5,bold);y-=26;};drawTableHeader();
  for(const item of items){const desc=pdfSafeText(item.producto_nombre||item.nombre||item.descripcion||"Producto"),descLines=wrapPdfText(regular,desc,8.5,285),h=Math.max(18,descLines.length*10+6);if(y-h<70){addPage();drawText(`Pedido ${orderNumber}`,margin,y,10,bold);y-=20;drawTableHeader();}let ty=y;for(const line of descLines){drawText(line,col.desc+5,ty,8.5,regular);ty-=10;}drawText(String(item.cantidad||1),col.qty,y,8.5,regular);const unit=clp(item.precio_unitario??item.precio);drawText(unit,col.unit+50-regular.widthOfTextAtSize(unit,8.5),y,8.5,regular);const lineTotal=clp(item.subtotal??(Number(item.cantidad||1)*Number(item.precio_unitario??item.precio??0)));drawText(lineTotal,col.total-regular.widthOfTextAtSize(lineTotal,8.5),y,8.5,regular);y-=h;page.drawLine({start:{x:margin,y:y+5},end:{x:right,y:y+5},thickness:.5,color:rgb(0.9,0.86,0.84)});}
  ensure(92);y-=6;for(const [label,value] of [["Subtotal",order.subtotal],["Despacho",order.despacho],["TOTAL",order.total]] as any[]){const isTotal=label==="TOTAL",f=isTotal?bold:regular,size=isTotal?12:9.5;drawText(label,430,y,size,f);const valueText=clp(value);drawText(valueText,right-f.widthOfTextAtSize(valueText,size),y,size,f);y-=isTotal?20:15;}
  if(order.observaciones){y-=6;drawText("Observaciones",margin,y,10,bold);y-=14;drawWrapped(order.observaciones,margin,right-margin,8.5,regular,11);}
  ensure(45);y-=12;page.drawLine({start:{x:margin,y},end:{x:right,y},thickness:.7,color:rgb(0.82,0.73,0.68)});y-=16;drawWrapped("Este PDF es un respaldo del pedido registrado en Ale Atencio. No reemplaza una boleta, factura ni documento tributario.",margin,right-margin,7.5,regular,9);
  const pages=pdf.getPages();for(let i=0;i<pages.length;i++){const pg=pages[i];pg.drawText(pdfSafeText(`${business} · ${orderNumber}`),{x:margin,y:27,size:7.5,font:regular,color:rgb(.45,.40,.38)});const pn=`Página ${i+1} de ${pages.length}`;pg.drawText(pn,{x:right-regular.widthOfTextAtSize(pn,7.5),y:27,size:7.5,font:regular,color:rgb(.45,.40,.38)});}
  return new Uint8Array(await pdf.save());
}

async function loadOrderItems(order:Dict): Promise<Dict[]> {
  const q=await db.from("pedido_items").select("linea,producto_id,producto_nombre,cantidad,precio_unitario,subtotal").eq("pedido_id",order.id).order("linea");
  if(!q.error&&(q.data||[]).length)return q.data||[];
  const raw=Array.isArray(order.detalle)?order.detalle:[];
  return raw.map((x:any,i:number)=>({linea:i+1,producto_id:clean(x.producto_id||x.id,100)||null,producto_nombre:clean(x.producto_nombre||x.nombre,250)||"Producto",cantidad:Math.max(1,Math.floor(Number(x.cantidad||x.qty||1))),precio_unitario:money(x.precio_unitario??x.precio),subtotal:money(Number(x.cantidad||x.qty||1)*Number(x.precio_unitario ?? x.precio ?? 0))}));
}
async function ensureOrderPdfBucket(): Promise<void> {
  try{
    const info=await db.storage.getBucket(ORDER_PDF_BUCKET);
    if(!info.error&&info.data){
      if((info.data as any).public){
        const upd=await db.storage.updateBucket(ORDER_PDF_BUCKET,{public:false,fileSizeLimit:12*1024*1024,allowedMimeTypes:["application/pdf"]});
        if(upd.error)console.warn("PDF_BUCKET_PRIVATE_UPDATE",upd.error.message);
      }
      return;
    }
  }catch(_){ }
  const created=await db.storage.createBucket(ORDER_PDF_BUCKET,{public:false,fileSizeLimit:12*1024*1024,allowedMimeTypes:["application/pdf"]});
  if(created.error&&!/already exists|duplicate/i.test(String(created.error.message||"")))throw created.error;
}
async function protectedOrderPdfUrl(order:Dict, config:Dict): Promise<string> {
  const id=clean(order?.id,100);if(!id)return "";
  const token=await signedPublicToken("ORDER_PDF",id);
  const number=clean(order?.numero_pedido||id,120);
  return `${publicWebBaseUrl(config)}pdf.html?pedido=${encodeURIComponent(number)}&t=${encodeURIComponent(token)}`;
}
function legacyPdfPathFromUrl(value:unknown,bucket:string):string{
  const raw=clean(value,3000);if(!raw||!bucket)return "";
  try{
    const u=new URL(raw),needle=`/storage/v1/object/public/${encodeURIComponent(bucket)}/`;
    const ix=u.pathname.indexOf(needle);if(ix<0)return "";
    return decodeURIComponent(u.pathname.slice(ix+needle.length));
  }catch(_){return "";}
}
async function persistOrderPdf(order:Dict, items:Dict[], config:Dict, actorUserId:string|null=null): Promise<{pdfUrl:string;storagePath:string;bytes:number}> {
  const bytes=await buildOrderPdf(order,items,config);
  if(bytes.length>12*1024*1024)throw new Error("PDF_PEDIDO_SUPERA_12MB");
  await ensureOrderPdfBucket();
  const safeNumber=sanitizeFileName(String(order.numero_pedido||order.id||"pedido")).replace(/\.[^.]+$/,"" );
  const suffix=sanitizeFileName(String(order.id||"").slice(-16))||crypto.randomUUID().slice(0,8);
  const path=`pedidos/${safeNumber}-${suffix}.pdf`;
  const oldBucket=clean(order.pdf_bucket,120)||BUCKET;
  const oldPath=clean(order.pdf_path,1200)||legacyPdfPathFromUrl(order.pdf_url,oldBucket);
  const up=await db.storage.from(ORDER_PDF_BUCKET).upload(path,bytes,{contentType:"application/pdf",upsert:true,cacheControl:"0"});
  if(up.error)throw up.error;
  const pdfUrl=await protectedOrderPdfUrl(order,config);
  const upd=await db.from("pedidos").update({pdf_bucket:ORDER_PDF_BUCKET,pdf_path:path,pdf_url:pdfUrl}).eq("id",order.id);
  if(upd.error){
    try{await db.storage.from(ORDER_PDF_BUCKET).remove([path]);}catch(_){ }
    throw upd.error;
  }
  const fileRow={entidad:"PEDIDO",entidad_id:order.id,tipo:"PDF",bucket:ORDER_PDF_BUCKET,storage_path:path,nombre_original:`${safeNumber}.pdf`,mime_type:"application/pdf",bytes:bytes.length,public_url:pdfUrl,activo:true,subido_por:actorUserId};
  const meta=await db.from("archivos").upsert(fileRow,{onConflict:"bucket,storage_path"});
  if(meta.error)console.warn("PEDIDO_PDF_METADATA",meta.error.message);
  // Si el pedido venía de la carpeta pública antigua, elimina esa copia sólo después de guardar la nueva versión privada.
  if(oldPath&&(oldBucket!==ORDER_PDF_BUCKET||oldPath!==path)){
    try{await db.storage.from(oldBucket).remove([oldPath]);}catch(err){console.warn("PDF_ANTIGUO_LIMPIEZA",err instanceof Error?err.message:String(err));}
  }
  return{pdfUrl,storagePath:path,bytes:bytes.length};
}

async function publicOrderPdfResponse(req:Request):Promise<Response>{
  const u=new URL(req.url),number=clean(u.searchParams.get("pedido")||u.searchParams.get("order"),120),token=clean(u.searchParams.get("t")||u.searchParams.get("token"),300);
  if(!number||!token)return new Response("Enlace de PDF incompleto",{status:400,headers:{...cors(req),"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  let q=await db.from("pedidos").select("id,numero_pedido,pdf_bucket,pdf_path,pdf_url").eq("numero_pedido",number).limit(1).maybeSingle();
  if(q.error)throw q.error;
  if(!q.data){q=await db.from("pedidos").select("id,numero_pedido,pdf_bucket,pdf_path,pdf_url").eq("id",number).limit(1).maybeSingle();if(q.error)throw q.error;}
  if(!q.data)return new Response("PDF no encontrado",{status:404,headers:{...cors(req),"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  const order:any=q.data;
  if(!(await validPublicToken("ORDER_PDF",String(order.id),token)))return new Response("Enlace de PDF no válido",{status:403,headers:{...cors(req),"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  let bucket=clean(order.pdf_bucket,120)||BUCKET;
  let path=clean(order.pdf_path,1200)||legacyPdfPathFromUrl(order.pdf_url,bucket);
  // Para pedidos históricos/finales, la cabecera puede ser inmutable. En ese caso,
  // la ubicación privada vigente se resuelve desde archivos sin tocar el estado del pedido.
  try{
    const meta=await db.from("archivos").select("bucket,storage_path").eq("entidad","PEDIDO").eq("entidad_id",order.id).eq("tipo","PDF").eq("bucket",ORDER_PDF_BUCKET).eq("activo",true).limit(1).maybeSingle();
    if(!meta.error&&meta.data?.storage_path){bucket=ORDER_PDF_BUCKET;path=clean(meta.data.storage_path,1200);}
  }catch(_){ }
  if(!path)return new Response("PDF aún no disponible",{status:404,headers:{...cors(req),"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  const out=await db.storage.from(bucket).download(path);
  if(out.error||!out.data)return new Response("PDF no disponible",{status:404,headers:{...cors(req),"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  // Migración silenciosa: al abrir un PDF histórico que aún vive en el bucket público,
  // se copia al bucket privado y se elimina la copia pública sólo si la referencia pudo actualizarse.
  if(bucket===BUCKET){
    try{
      await ensureOrderPdfBucket();
      const bytes=new Uint8Array(await out.data.arrayBuffer());
      const migrated=await db.storage.from(ORDER_PDF_BUCKET).upload(path,bytes,{contentType:"application/pdf",upsert:true,cacheControl:"0"});
      if(!migrated.error){
        const cfg=await configMap(),siteUrl=await protectedOrderPdfUrl(order,cfg);
        // Primero dejamos una referencia privada independiente en archivos. Esto permite migrar
        // incluso pedidos ENTREGADOS/CANCELADOS cuya cabecera está protegida por trigger.
        const meta=await db.from("archivos").upsert({entidad:"PEDIDO",entidad_id:order.id,tipo:"PDF",bucket:ORDER_PDF_BUCKET,storage_path:path,nombre_original:`${sanitizeFileName(String(order.numero_pedido||"pedido"))}.pdf`,mime_type:"application/pdf",bytes:bytes.length,public_url:siteUrl,activo:true,subido_por:null},{onConflict:"bucket,storage_path"});
        if(!meta.error){
          const upd=await db.from("pedidos").update({pdf_bucket:ORDER_PDF_BUCKET,pdf_path:path,pdf_url:siteUrl}).eq("id",order.id);
          if(upd.error)console.warn("PDF_CABECERA_INMUTABLE",upd.error.message||upd.error);
          try{await db.from("archivos").update({activo:false}).eq("entidad","PEDIDO").eq("entidad_id",order.id).eq("bucket",BUCKET).eq("storage_path",path);}catch(_){ }
          try{await db.storage.from(BUCKET).remove([path]);}catch(_){ }
        }else{
          try{await db.storage.from(ORDER_PDF_BUCKET).remove([path]);}catch(_){ }
        }
      }
      // El Blob original ya fue consumido para la migración; recreamos la respuesta desde bytes si aplica.
      if(!migrated.error){
        const privateCopy=await db.storage.from(ORDER_PDF_BUCKET).download(path);
        if(!privateCopy.error&&privateCopy.data){
          const fileName=`${sanitizeFileName(String(order.numero_pedido||"pedido"))}.pdf`;
          return new Response(privateCopy.data,{status:200,headers:{...cors(req),"Content-Type":"application/pdf","Content-Disposition":`inline; filename="${fileName}"`,"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
        }
      }
    }catch(err){console.warn("PDF_LEGACY_MIGRATION",err instanceof Error?err.message:String(err));}
  }
  const fileName=`${sanitizeFileName(String(order.numero_pedido||"pedido"))}.pdf`;
  return new Response(out.data,{status:200,headers:{...cors(req),"Content-Type":"application/pdf","Content-Disposition":`inline; filename="${fileName}"`,"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
}

async function adminOrderPdfLink(ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"orders","read");
  const id=clean(d.id||d.order_id,100);if(!id)throw new Error("PEDIDO_REQUERIDO");
  const q=await db.from("pedidos").select("id,numero_pedido,pdf_bucket,pdf_path,pdf_url").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("PEDIDO_NO_ENCONTRADO");
  if(!q.data.pdf_path&&!q.data.pdf_url)throw new Error("PDF_PEDIDO_NO_DISPONIBLE");
  const cfg=await configMap();
  return{ok:true,pdf_url:await protectedOrderPdfUrl(q.data as Dict,cfg),numero_pedido:q.data.numero_pedido||q.data.id};
}

async function appendOrderHistory(pedidoId:string,evento:string,estadoPedido:string,estadoPago:string,descripcion:string,actor:string|null=null){
  if(!pedidoId)return;
  const row={pedido_id:pedidoId,evento:clean(evento,80),estado_pedido:clean(estadoPedido,80)||null,estado_pago:clean(estadoPago,80)||null,descripcion:clean(descripcion,500),actor_usuario_id:actor||null,creado_en:nowIso()};
  const out=await db.from("pedido_estado_historial").insert(row);
  if(out.error)console.warn("PEDIDO_HISTORIAL",out.error.message);
}
function publicOrderStatusLabel(value:unknown):string{
  const v=clean(value,80).toUpperCase();
  const map:Dict={PENDIENTE:"PEDIDO RECIBIDO",CONFIRMADO:"PEDIDO ACEPTADO","EN PREPARACION":"EN PREPARACIÓN",LISTO:"LISTO PARA ENTREGA",ENTREGADO:"ENTREGADO",CANCELADO:"CANCELADO"};
  return map[v]||v||"PEDIDO RECIBIDO";
}
function trackingBaseUrl(cfg:Dict):string{
  return publicWebBaseUrl(cfg);
}
async function signedPublicToken(scope:string,id:string):Promise<string>{
  const secret=Deno.env.get("ALE_TRACKING_SIGNING_SECRET")||serverKey();
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const payload=`ALE_ATENCIO_PUBLIC_V2:${clean(scope,40).toUpperCase()}:${clean(id,180)}`;
  const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload)));
  let binary="";for(const b of sig)binary+=String.fromCharCode(b);
  return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
}
async function validPublicToken(scope:string,id:string,token:string):Promise<boolean>{
  if(!token)return false;
  const expected=await signedPublicToken(scope,id);
  if(expected.length!==token.length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^token.charCodeAt(i);
  return diff===0;
}
async function trackingTokenForOrder(orderId:string):Promise<string>{
  return await signedPublicToken("ORDER",orderId);
}
async function requestTokenForId(requestId:string):Promise<string>{return await signedPublicToken("REQUEST",requestId);}
async function quoteTokenForId(quoteId:string):Promise<string>{return await signedPublicToken("QUOTE",quoteId);}
async function adminOrderTrackingLink(ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"orders","read");const id=clean(d.id||d.order_id,100);if(!id)throw new Error("PEDIDO_REQUERIDO");
  const q=await db.from("pedidos").select("id,numero_pedido,tracking_token_hash").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("PEDIDO_NO_ENCONTRADO");
  const token=await trackingTokenForOrder(id),hash=await sha256Hex(token);
  if(String(q.data.tracking_token_hash||"")!==hash){const u=await db.from("pedidos").update({tracking_token_hash:hash,updated_at:nowIso()}).eq("id",id);if(u.error)throw u.error;}
  const cfg=await configMap(),number=q.data.numero_pedido||id;
  return{ok:true,tracking_url:`${trackingBaseUrl(cfg)}#seguimiento/${encodeURIComponent(number)}?t=${encodeURIComponent(token)}`,trace_url:await documentTraceUrl("PEDIDO",id,cfg,token),numero_pedido:number};
}
async function documentTraceUrl(type:"SOLICITUD"|"COTIZACION"|"PEDIDO",id:string,cfg:Dict,token?:string):Promise<string>{
  const scope=type==="PEDIDO"?"ORDER":type==="COTIZACION"?"QUOTE":"REQUEST";
  const signed=token||await signedPublicToken(scope,id);
  return `${publicWebBaseUrl(cfg)}trazabilidad.html?tipo=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}&t=${encodeURIComponent(signed)}`;
}
async function adminQuoteShareLink(ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"quotes","read");const id=clean(d.id||d.quote_id,100);if(!id)throw new Error("COTIZACION_REQUERIDA");
  const q=await db.from("cotizaciones").select("id,numero_cotizacion").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("COTIZACION_NO_ENCONTRADA");
  const token=await quoteTokenForId(id),cfg=await configMap(),number=q.data.numero_cotizacion||id;
  return{ok:true,public_url:`${publicWebBaseUrl(cfg)}#cotizacion/${encodeURIComponent(number)}?qid=${encodeURIComponent(id)}&qt=${encodeURIComponent(token)}`,trace_url:await documentTraceUrl("COTIZACION",id,cfg,token),numero_cotizacion:number};
}
async function adminRequestShareLink(ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"requests","read");const id=clean(d.id||d.request_id,100);if(!id)throw new Error("SOLICITUD_REQUERIDA");
  const q=await db.from("solicitudes").select("id,numero_solicitud").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("SOLICITUD_NO_ENCONTRADA");
  const token=await requestTokenForId(id),cfg=await configMap(),number=q.data.numero_solicitud||id;
  return{ok:true,public_url:`${publicWebBaseUrl(cfg)}#solicitud/${encodeURIComponent(number)}?rid=${encodeURIComponent(id)}&rt=${encodeURIComponent(token)}`,trace_url:await documentTraceUrl("SOLICITUD",id,cfg,token),numero_solicitud:number};
}
async function publicTraceView(d:Dict){
  const type=clean(d.tipo||d.type,30).toUpperCase(),id=clean(d.id,100),token=clean(d.t||d.token,300);
  const scope=type==="PEDIDO"?"ORDER":type==="COTIZACION"?"QUOTE":type==="SOLICITUD"?"REQUEST":"";
  if(!scope||!id||!(await validPublicToken(scope,id,token)))throw new Error("TRAZABILIDAD_ENLACE_INVALIDO");
  let request:any=null,quote:any=null,order:any=null;
  if(type==="SOLICITUD"){const q=await db.from("solicitudes").select("id,numero_solicitud,estado,fecha,cotizacion_id").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("SOLICITUD_NO_ENCONTRADA");request=q.data;const cq=await db.from("cotizaciones").select("id,numero_cotizacion,estado,fecha,solicitud_id,pedido_id").eq("solicitud_id",id).order("fecha",{ascending:true}).limit(1).maybeSingle();if(!cq.error&&cq.data)quote=cq.data;}
  if(type==="COTIZACION"){const q=await db.from("cotizaciones").select("id,numero_cotizacion,estado,fecha,solicitud_id,pedido_id").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("COTIZACION_NO_ENCONTRADA");quote=q.data;if(quote.solicitud_id){const rq=await db.from("solicitudes").select("id,numero_solicitud,estado,fecha,cotizacion_id").eq("id",quote.solicitud_id).maybeSingle();if(!rq.error)request=rq.data;}}
  if(type==="PEDIDO"){const q=await db.from("pedidos").select("id,numero_pedido,estado,estado_pago,fecha,solicitud_id,cotizacion_id").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("PEDIDO_NO_ENCONTRADO");order=q.data;}
  if(!order&&quote){const oq=await db.from("pedidos").select("id,numero_pedido,estado,estado_pago,fecha,solicitud_id,cotizacion_id").eq("cotizacion_id",quote.id).order("fecha",{ascending:false}).limit(1).maybeSingle();if(!oq.error&&oq.data)order=oq.data;}
  if(!order&&request){const oq=await db.from("pedidos").select("id,numero_pedido,estado,estado_pago,fecha,solicitud_id,cotizacion_id").eq("solicitud_id",request.id).order("fecha",{ascending:false}).limit(1).maybeSingle();if(!oq.error&&oq.data)order=oq.data;}
  if(!quote&&order?.cotizacion_id){const cq=await db.from("cotizaciones").select("id,numero_cotizacion,estado,fecha,solicitud_id,pedido_id").eq("id",order.cotizacion_id).maybeSingle();if(!cq.error)quote=cq.data;}
  if(!request){const rid=order?.solicitud_id||quote?.solicitud_id;if(rid){const rq=await db.from("solicitudes").select("id,numero_solicitud,estado,fecha,cotizacion_id").eq("id",rid).maybeSingle();if(!rq.error)request=rq.data;}}
  let history:any[]=[];let trackingUrl="";
  if(order){const h=await db.from("pedido_estado_historial").select("evento,estado_pedido,estado_pago,descripcion,creado_en").eq("pedido_id",order.id).order("creado_en",{ascending:true}).limit(100);if(!h.error)history=h.data||[];const cfg=await configMap(),ot=await trackingTokenForOrder(String(order.id));trackingUrl=`${trackingBaseUrl(cfg)}#seguimiento/${encodeURIComponent(order.numero_pedido||order.id)}?t=${encodeURIComponent(ot)}`;}
  return{ok:true,type,request,quote,order,history,tracking_url:trackingUrl};
}
async function publicQuoteView(d:Dict){
  const id=clean(d.id||d.quote_id||d.qid,100),token=clean(d.token||d.quote_token||d.qt,300);
  if(!id||!(await validPublicToken("QUOTE",id,token)))throw new Error("COTIZACION_ENLACE_INVALIDO");
  const q=await db.from("cotizaciones").select("*").eq("id",id).maybeSingle();
  if(q.error)throw q.error;if(!q.data)throw new Error("COTIZACION_NO_ENCONTRADA");
  const x:any=q.data;return{ok:true,quote:{id:x.id,numero_cotizacion:x.numero_cotizacion||x.id,numero_solicitud:x.numero_solicitud||"",cliente_nombre:x.cliente_nombre||"Cliente",moneda:x.moneda||"CLP",validez_dias:Number(x.validez_dias||0),items:Array.isArray(x.items)?x.items:[],subtotal:money(x.subtotal),iva_porcentaje:Number(x.iva_porcentaje||0),iva:money(x.iva),total:money(x.total),estado:x.estado||"",observaciones:x.observaciones||"",fecha:x.fecha||x.created_at||x.updated_at||""}};
}
async function publicRequestView(d:Dict){
  const id=clean(d.id||d.request_id||d.rid,100),token=clean(d.token||d.request_token||d.rt,300);
  if(!id||!(await validPublicToken("REQUEST",id,token)))throw new Error("SOLICITUD_ENLACE_INVALIDO");
  const q=await db.from("solicitudes").select("*").eq("id",id).maybeSingle();
  if(q.error)throw q.error;if(!q.data)throw new Error("SOLICITUD_NO_ENCONTRADA");
  const x:any=q.data;return{ok:true,request:{id:x.id,numero_solicitud:x.numero_solicitud||x.id,nombre:x.nombre||"Cliente",fecha_evento:x.fecha_evento||"",tipo:x.tipo||"",cantidad:x.cantidad||"",detalle:x.detalle||"",medio_pago_preferido:x.medio_pago_preferido||"",estado:x.estado||"NUEVA",fecha:x.fecha||x.created_at||x.updated_at||""}};
}
function canonicalPaymentMethod(value:unknown):string{
  const s=clean(value,80).trim().toUpperCase().replace(/[ÁÀÄ]/g,"A").replace(/[ÉÈË]/g,"E").replace(/[ÍÌÏ]/g,"I").replace(/[ÓÒÖ]/g,"O").replace(/[ÚÙÜ]/g,"U");
  if(!s)return "";
  if(s.includes("TRANSFER"))return "TRANSFERENCIA";
  if(s.includes("TRANSBANK")||s.includes("TARJETA")||s.includes("WEBPAY")||s.includes("CARD"))return "TRANSBANK";
  if(s.includes("EFECTIVO")||s.includes("CASH"))return "EFECTIVO";
  return s;
}
async function resolveOrderPaymentMethod(row:any):Promise<string>{
  let method=canonicalPaymentMethod(row?.medio_pago);
  if(method)return method;
  // Un comprobante existente prueba que este pedido corresponde a transferencia.
  if(row?.comprobante_pago_url||row?.comprobante_pago_path)return "TRANSFERENCIA";

  const orderId=clean(row?.id,100);
  // Si el pedido tiene una transacción/enlace Webpay histórico, el medio correcto es tarjeta.
  if(orderId){
    const tq=await db.from("pagos_transbank").select("id").eq("pedido_id",orderId).limit(1).maybeSingle();
    if(!tq.error&&tq.data)return "TRANSBANK";
    const lq=await db.from("pedido_enlaces_pago").select("id").eq("pedido_id",orderId).limit(1).maybeSingle();
    if(!lq.error&&lq.data)return "TRANSBANK";
  }

  let requestId=clean(row?.solicitud_id,100);
  if(!requestId&&row?.cotizacion_id){
    const cq=await db.from("cotizaciones").select("solicitud_id").eq("id",String(row.cotizacion_id)).maybeSingle();
    if(!cq.error&&cq.data)requestId=clean((cq.data as any).solicitud_id,100);
  }
  if(requestId){
    const rq=await db.from("solicitudes").select("medio_pago_preferido").eq("id",requestId).maybeSingle();
    if(!rq.error&&rq.data)method=canonicalPaymentMethod((rq.data as any).medio_pago_preferido);
    if(method)return method;
  }

  // Compatibilidad con pedidos Web creados por versiones anteriores: el flujo normal
  // (sin Webpay) correspondía a transferencia, pero no persistía medio_pago.
  if(String(row?.origen||"").trim().toUpperCase()==="WEB"||row?.checkout_token_hash)return "TRANSFERENCIA";
  return "";
}
async function resolveAndPersistOrderPaymentMethod(row:any):Promise<any>{
  const raw=canonicalPaymentMethod(row?.medio_pago);
  const method=raw||await resolveOrderPaymentMethod(row);
  const out={...row,medio_pago:method||raw||""};
  if(method&&!raw&&row?.id){
    const patch:any={medio_pago:method,updated_at:nowIso()};
    if(!clean(row?.estado_pago,40))patch.estado_pago=method==="EFECTIVO"?"PENDIENTE":"INICIADO";
    const u=await db.from("pedidos").update(patch).eq("id",String(row.id));
    if(u.error)console.warn("MEDIO_PAGO_PERSIST",u.error.message||u.error);
    else if(patch.estado_pago)out.estado_pago=patch.estado_pago;
  }
  return out;
}

async function publicTrackOrder(d:Dict){
  const query=clean(d.query||d.numero_pedido||d.rut,120);
  if(!query)throw new Error("CONSULTA_PEDIDO_REQUERIDA");
  const token=clean(d.tracking_token,300),verifyPhone=normalizePhone(d.verify_phone||d.telefono_verificacion||"");
  let rows:any[]=[];
  const normalized=normalizeRut(query);
  if(isValidRut(normalized)){
    const q=await db.from("pedidos").select("*").eq("rut_normalizado",normalized).order("fecha",{ascending:false}).limit(20);
    if(q.error)throw q.error;rows=q.data||[];
  }else{
    let q=await db.from("pedidos").select("*").eq("numero_pedido",query).limit(1);
    if(q.error)throw q.error;rows=q.data||[];
    if(!rows.length){const q2=await db.from("pedidos").select("*").eq("id",query).limit(1);if(q2.error)throw q2.error;rows=q2.data||[];}
  }
  const cfg=await configMap();
  const result=[];
  let needsVerification=false;
  for(const row of rows){
    let verified=false;
    if(token&&row.tracking_token_hash){try{verified=(await sha256Hex(token))===String(row.tracking_token_hash)}catch(_){} }
    if(!verified&&verifyPhone)verified=normalizePhone(row.telefono)===verifyPhone;
    if(!verified){needsVerification=true;continue;}
    const secureToken=await trackingTokenForOrder(String(row.id)),secureHash=await sha256Hex(secureToken);
    if(String(row.tracking_token_hash||"")!==secureHash)deferTask(db.from("pedidos").update({tracking_token_hash:secureHash,updated_at:nowIso()}).eq("id",row.id).then(({error}:any)=>{if(error)console.warn("TRACKING_HASH_REFRESH",error.message)}));
    const hq=await db.from("pedido_estado_historial").select("evento,estado_pedido,estado_pago,descripcion,creado_en").eq("pedido_id",row.id).order("creado_en",{ascending:true}).limit(80);
    const history=(hq.error?[]:(hq.data||[])).map((h:any)=>({evento:h.evento,estado_pedido:h.estado_pedido,estado_pago:h.estado_pago,descripcion:h.descripcion,fecha:h.creado_en}));
    const paymentMethod=await resolveOrderPaymentMethod(row);
    if(paymentMethod&&!canonicalPaymentMethod(row.medio_pago))deferTask(db.from("pedidos").update({medio_pago:paymentMethod,updated_at:nowIso()}).eq("id",row.id).then(({error}:any)=>{if(error)console.warn("TRACKING_MEDIO_PAGO_PERSIST",error.message)}));
    const protectedPdfUrl=(row.pdf_path||row.pdf_url)?await protectedOrderPdfUrl(row,cfg):"";
    result.push({id:row.id,numero_pedido:row.numero_pedido||row.id,fecha:row.fecha,nombre:clean(row.nombre,2)?`${clean(row.nombre,1)}***`:"Cliente",metodo_entrega:row.metodo_entrega,total:row.total,estado:row.estado,estado_label:publicOrderStatusLabel(row.estado),estado_pago:row.estado_pago||"PENDIENTE",medio_pago:paymentMethod,fecha_pago:row.fecha_pago||"",updated_at:row.updated_at,history,verified:true,pdf_url:protectedPdfUrl,comprobante_pago_estado:row.comprobante_pago_estado||"",comprobante_pago_fecha:row.comprobante_pago_fecha||"",comprobante_pago_cargado:!!(row.comprobante_pago_url||row.comprobante_pago_path),tracking_url:`${trackingBaseUrl(cfg)}#seguimiento/${encodeURIComponent(row.numero_pedido||row.id)}?t=${encodeURIComponent(secureToken)}`});
  }
  return{ok:true,count:result.length,needs_verification:needsVerification&&!result.length,orders:result};
}
async function publicGenerateOrderPdf(req:Request,d:Dict){
  const orderId=clean(d.order_id||d.id,100),trackingToken=clean(d.tracking_token,300);
  if(!orderId||!trackingToken)throw new Error("PEDIDO_TOKEN_SEGUIMIENTO_REQUERIDO");
  const oq=await db.from("pedidos").select("*").eq("id",orderId).maybeSingle();if(oq.error)throw oq.error;if(!oq.data)throw new Error("PEDIDO_NO_ENCONTRADO");
  if(!oq.data.tracking_token_hash||(await sha256Hex(trackingToken))!==String(oq.data.tracking_token_hash))throw new Error("TOKEN_SEGUIMIENTO_INVALIDO");
  const items=await loadOrderItems(oq.data as Dict),cfg=await configMap();
  const out=await persistOrderPdf(oq.data as Dict,items,cfg,null);
  return{ok:true,pdf_url:out.pdfUrl,numero_pedido:oq.data.numero_pedido||oq.data.id};
}

async function fetchPaidOrdersBetween(fromIso:string,toIso:string){
  // R9.18.11: no seleccionar una lista rígida de columnas. Producción puede venir
  // de una migración histórica y una columna opcional ausente no debe tumbar Reportes.
  const all:any[]=[],seen=new Set<string>(),pageSize=1000,maxRows=100000;
  const pushUnique=(rows:any[])=>{for(const row of rows||[]){const id=String(row.id||"");if(!id||seen.has(id))continue;seen.add(id);all.push(row)}};
  let paymentDateQueryOk=true;

  // Principal: fecha real de pago. Si fecha_pago no existe en una instalación antigua,
  // se activa el fallback por fecha de creación, manteniendo SIEMPRE estado_pago=PAGADO.
  for(let from=0;from<maxRows;from+=pageSize){
    const q=await db.from("pedidos").select("*").eq("estado_pago","PAGADO").gte("fecha_pago",fromIso).lte("fecha_pago",toIso).order("fecha_pago",{ascending:false}).range(from,from+pageSize-1);
    if(q.error){paymentDateQueryOk=false;console.warn("REPORTES_FECHA_PAGO_FALLBACK",q.error.message||q.error);break;}
    const rows=q.data||[];pushUnique(rows);if(rows.length<pageSize)break;
  }

  if(paymentDateQueryOk){
    // Compatibilidad histórica: PAGADO sin fecha_pago usa fecha de creación.
    for(let from=0;from<maxRows;from+=pageSize){
      const q=await db.from("pedidos").select("*").eq("estado_pago","PAGADO").is("fecha_pago",null).gte("fecha",fromIso).lte("fecha",toIso).order("fecha",{ascending:false}).range(from,from+pageSize-1);
      if(q.error){paymentDateQueryOk=false;console.warn("REPORTES_FECHA_PAGO_NULL_FALLBACK",q.error.message||q.error);break;}
      const rows=q.data||[];pushUnique(rows);if(rows.length<pageSize)break;
    }
  }

  if(!paymentDateQueryOk){
    all.length=0;seen.clear();
    for(let from=0;from<maxRows;from+=pageSize){
      const q=await db.from("pedidos").select("*").eq("estado_pago","PAGADO").gte("fecha",fromIso).lte("fecha",toIso).order("fecha",{ascending:false}).range(from,from+pageSize-1);
      if(q.error){
        const detail=clean((q.error as any)?.message||String(q.error),500);
        throw new Error(`REPORTES_ESQUEMA_PAGO_INCOMPLETO:${detail}`);
      }
      const rows=q.data||[];pushUnique(rows);if(rows.length<pageSize)break;
    }
  }

  all.sort((a:any,b:any)=>new Date(b.fecha_pago||b.fecha||0).getTime()-new Date(a.fecha_pago||a.fecha||0).getTime());
  return all;
}
async function fetchItemsForOrders(orderIds:string[]){
  // R9.18.11: pedido_items mejora el rendimiento, pero NO es requisito para Reportes.
  // Si la tabla/columnas no existen o una tanda falla, se usa pedidos.detalle como fallback.
  const out:any[]=[];
  for(let i=0;i<orderIds.length;i+=200){
    const batch=orderIds.slice(i,i+200);if(!batch.length)continue;
    const q=await db.from("pedido_items").select("pedido_id,producto_id,producto_nombre,cantidad,precio_unitario,subtotal").in("pedido_id",batch);
    if(q.error){console.warn("REPORTES_PEDIDO_ITEMS_FALLBACK",q.error.message||q.error);continue;}
    out.push(...(q.data||[]));
  }
  return out;
}
function reportItemsWithHistoricalFallback(orders:any[],items:any[]){
  const out=[...(items||[])],withItems=new Set(out.map((x:any)=>String(x.pedido_id)));
  for(const order of orders||[]){
    const pedidoId=String(order.id||"");if(!pedidoId||withItems.has(pedidoId))continue;
    const raw=Array.isArray(order.detalle)?order.detalle:[];
    raw.forEach((x:any,i:number)=>{const cantidad=Math.max(1,Math.floor(Number(x?.cantidad??x?.qty??1)||1));const precio=money(x?.precio_unitario??x?.precio);out.push({pedido_id:pedidoId,producto_id:clean(x?.producto_id||x?.id,100)||`HIST-${i+1}`,producto_nombre:clean(x?.producto_nombre||x?.nombre,250)||"Producto",cantidad,precio_unitario:precio,subtotal:money(x?.subtotal??(cantidad*precio))})});
  }
  return out;
}
function pctChange(current:number,previous:number){if(previous===0)return current>0?100:0;return Math.round(((current-previous)/previous)*1000)/10}
const BUSINESS_TIME_ZONE="America/Santiago";
function zonedDateParts(date:Date,timeZone=BUSINESS_TIME_ZONE){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const out:Dict={};for(const p of parts)if(p.type!=="literal")out[p.type]=Number(p.value);return out;
}
function zoneOffsetMinutes(date:Date,timeZone=BUSINESS_TIME_ZONE){
  const p=zonedDateParts(date,timeZone);const asUtc=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);return Math.round((asUtc-date.getTime())/60000);
}
function businessLocalIso(year:number,month1:number,day:number,hour=0,minute=0,second=0,ms=0){
  const localUtc=Date.UTC(year,month1-1,day,hour,minute,second,ms);let guess=localUtc;
  for(let i=0;i<3;i++){const offset=zoneOffsetMinutes(new Date(guess));guess=localUtc-offset*60000}
  return new Date(guess).toISOString();
}
function businessDateRangeValue(raw:string,end=false){
  const m=String(raw||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return"";
  return businessLocalIso(Number(m[1]),Number(m[2]),Number(m[3]),end?23:0,end?59:0,end?59:0,end?999:0);
}
async function salesReport(ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"reports","read");
  const now=new Date(),bp=zonedDateParts(now);const y=Number(bp.year),m=Number(bp.month),day=Number(bp.day);
  const defaultFrom=businessLocalIso(y,1,1);const defaultTo=now.toISOString();
  const fromRaw=clean(d.from,30),toRaw=clean(d.to,30);
  const fromIso=businessDateRangeValue(fromRaw,false)||defaultFrom;
  const toIso=businessDateRangeValue(toRaw,true)||defaultTo;
  if(new Date(fromIso).getTime()>new Date(toIso).getTime())throw new Error("REPORTE_RANGO_FECHAS_INVALIDO");
  const orderStatus=clean(d.order_status,80).toUpperCase();

  const dayStart=businessLocalIso(y,m,day),monthStart=businessLocalIso(y,m,1),yearStart=businessLocalIso(y,1,1);
  const prevYearStart=businessLocalIso(y-1,1,1),prevYearEnd=businessLocalIso(y-1,m,day,23,59,59,999);
  const prevMonthYearStart=businessLocalIso(y-1,m,1),prevMonthYearEnd=businessLocalIso(y-1,m,day,23,59,59,999);
  const demandNowStart=new Date(now.getTime()-30*86400000).toISOString(),demandPrevStart=new Date(now.getTime()-60*86400000).toISOString();
  const minStart=new Date(Math.min(new Date(fromIso).getTime(),new Date(prevYearStart).getTime(),new Date(demandPrevStart).getTime())).toISOString();
  const maxEnd=new Date(Math.max(new Date(toIso).getTime(),now.getTime())).toISOString();

  // R9.18.10: una sola lectura de ventas + una sola lectura de detalle.
  // Evita 7-9 consultas repetidas y los timeouts observados en Reportes.
  const universe=await fetchPaidOrdersBetween(minStart,maxEnd);
  const allItemsRaw=await fetchItemsForOrders(universe.map((o:any)=>String(o.id)));
  const allItems=reportItemsWithHistoricalFallback(universe,allItemsRaw);
  const ts=(o:any)=>new Date(o.fecha_pago||o.fecha||0).getTime();
  const between=(o:any,a:string,b:string)=>{const t=ts(o);return t>=new Date(a).getTime()&&t<=new Date(b).getTime()};
  const orders=universe.filter((o:any)=>between(o,fromIso,toIso)&&(!orderStatus||String(o.estado||"").toUpperCase()===orderStatus));
  const reportOrderIds=new Set(orders.map((o:any)=>String(o.id)));
  const items=allItems.filter((it:any)=>reportOrderIds.has(String(it.pedido_id)));

  const total=money(orders.reduce((a:number,o:any)=>a+Number(o.total||0),0));
  const customerMap=new Map<string,any>();for(const o of orders){const key=String(o.cliente_id||normalizeRut(o.rut)||o.nombre||o.id);const cur=customerMap.get(key)||{key,nombre:o.nombre||"Cliente",rut:o.rut||"",compras:0,total:0};cur.compras++;cur.total+=Number(o.total||0);customerMap.set(key,cur)}
  const productMap=new Map<string,any>();for(const it of items){const key=String(it.producto_id||it.producto_nombre);const cur=productMap.get(key)||{producto_id:it.producto_id||"",producto_nombre:it.producto_nombre||"Producto",cantidad:0,ventas:0,pedidos:new Set<string>()};cur.cantidad+=Number(it.cantidad||0);cur.ventas+=Number(it.subtotal||0);cur.pedidos.add(String(it.pedido_id));productMap.set(key,cur)}
  const products=[...productMap.values()].map((x:any)=>({producto_id:x.producto_id,producto_nombre:x.producto_nombre,cantidad:x.cantidad,ventas:money(x.ventas),pedidos:x.pedidos.size})).sort((a,b)=>b.cantidad-a.cantidad||b.ventas-a.ventas);
  const customers=[...customerMap.values()].map((x:any)=>({...x,total:money(x.total)})).sort((a,b)=>b.total-a.total);
  const sumRange=(a:string,b:string)=>money(universe.filter((o:any)=>between(o,a,b)).reduce((acc:number,o:any)=>acc+Number(o.total||0),0));
  const today=sumRange(dayStart,now.toISOString()),month=sumRange(monthStart,now.toISOString()),yearTotal=sumRange(yearStart,now.toISOString()),prevYear=sumRange(prevYearStart,prevYearEnd),prevMonthYear=sumRange(prevMonthYearStart,prevMonthYearEnd);

  const demandOrderIds=new Set(universe.filter((o:any)=>between(o,demandPrevStart,now.toISOString())).map((o:any)=>String(o.id)));
  const dateByOrder=new Map(universe.map((o:any)=>[String(o.id),ts(o)]));const demand=new Map<string,any>();
  for(const it of allItems){if(!demandOrderIds.has(String(it.pedido_id)))continue;const key=String(it.producto_id||it.producto_nombre);const cur=demand.get(key)||{producto_id:it.producto_id||"",producto_nombre:it.producto_nombre||"Producto",actual:0,anterior:0};const t=dateByOrder.get(String(it.pedido_id))||0;if(t>=new Date(demandNowStart).getTime())cur.actual+=Number(it.cantidad||0);else cur.anterior+=Number(it.cantidad||0);demand.set(key,cur)}
  const highDemand=[...demand.values()].map((x:any)=>({...x,crecimiento_pct:pctChange(x.actual,x.anterior)})).sort((a,b)=>b.actual-a.actual||b.crecimiento_pct-a.crecimiento_pct).slice(0,50);
  return{ok:true,generated_at:nowIso(),time_zone:BUSINESS_TIME_ZONE,diagnostics:{backend_version:VERSION,paid_orders_scanned:universe.length,relational_item_rows:allItemsRaw.length,effective_item_rows:allItems.length},filters:{from:fromRaw||`${y}-01-01`,to:toRaw||`${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`,order_status:orderStatus},kpis:{sales_total:total,orders_count:orders.length,unique_clients:customerMap.size,repeat_clients:customers.filter(x=>x.compras>1).length,average_ticket:orders.length?money(total/orders.length):0,sales_today:today,sales_month:month,sales_year:yearTotal,sales_previous_year:prevYear,year_change_pct:pctChange(yearTotal,prevYear),sales_same_month_previous_year:prevMonthYear,month_change_pct:pctChange(month,prevMonthYear)},top_product:products[0]||null,top_customer:customers[0]||null,products,customers,high_demand:highDemand,orders};
}

async function refreshOrderPdfSnapshot(orderId:string){
  try{const q=await db.from("pedidos").select("*").eq("id",orderId).maybeSingle();if(q.error||!q.data)return;const items=await loadOrderItems(q.data as Dict),cfg=await configMap();await persistOrderPdf(q.data as Dict,items,cfg,null);}catch(err){console.warn("REFRESH_PEDIDO_PDF",err instanceof Error?err.message:String(err))}
}
async function orderDetail(ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"orders","read");
  const id=clean(d.id,100);if(!id)throw new Error("PEDIDO_REQUERIDO");
  const q=await db.from("pedidos").select("*").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("PEDIDO_NO_ENCONTRADO");
  const order=await resolveAndPersistOrderPaymentMethod(q.data);
  const cfg=await configMap();
  if(order.pdf_path||order.pdf_url)order.pdf_url=await protectedOrderPdfUrl(order as Dict,cfg);
  const items=await loadOrderItems(order as Dict);
  const h=await db.from("pedido_estado_historial").select("evento,estado_pedido,estado_pago,descripcion,creado_en").eq("pedido_id",id).order("creado_en",{ascending:true}).limit(100);
  return{ok:true,order,items,history:h.error?[]:(h.data||[])};
}
async function generateOrderPdf(req:Request,ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"orders","write");
  const detail=await orderDetail(ctx,d);
  const cfg=await configMap();
  const out=await persistOrderPdf(detail.order,detail.items,cfg,String(ctx.user.id||"")||null);
  const refreshed=await db.from("pedidos").select("*").eq("id",detail.order.id).single();if(refreshed.error)throw refreshed.error;
  (refreshed.data as any).pdf_url=out.pdfUrl;
  await audit(req,ctx,"GENERAR_PDF","PEDIDO",detail.order.id,{pdf_url:out.pdfUrl,bytes:out.bytes,storage_private:true});
  return{ok:true,order:refreshed.data,items:detail.items,history:detail.history||[],pdfUrl:out.pdfUrl,storagePath:out.storagePath};
}

async function adminModule(ctx: SessionCtx, d: Dict) {
  const module=clean(d.module,40).toLowerCase();
  if(module==="products"){
    if(!ctx.permissions.products?.read)return{module,products:[]};
    const q=await db.from("productos").select("*").order("orden").order("nombre");if(q.error)throw q.error;
    return{module,products:(q.data||[]).map((x:any)=>legacyProduct(x as Dict))};
  }
  if(module==="categories"){
    if(!ctx.permissions.categories?.read)return{module,categories:[]};
    const q=await db.from("categorias").select("*").order("orden").order("nombre");if(q.error)throw q.error;
    return{module,categories:(q.data||[]).map((x:any)=>legacyCategory(x as Dict))};
  }
  if(module==="banners"){
    if(!ctx.permissions.banners?.read)return{module,banners:[]};
    const q=await db.from("banners").select("*").order("orden");if(q.error)throw q.error;
    return{module,banners:(q.data||[]).map((x:any)=>legacyBanner(x as Dict))};
  }
  if(module==="config"){
    return{module,config:await configMap()};
  }
  if(module==="orders"){
    if(!ctx.permissions.orders?.read)return{module,orders:[]};
    const q=await db.from("pedidos").select("*").order("fecha",{ascending:false}).limit(1000);if(q.error)throw q.error;
    return{module,orders:q.data||[]};
  }
  if(module==="requests"){
    if(!ctx.permissions.requests?.read)return{module,requests:[]};
    const q=await db.from("solicitudes").select("*").order("fecha",{ascending:false}).limit(1000);if(q.error)throw q.error;
    // R9.18.33: una solicitud utilizada por una cotización deja de estar disponible.
    // Se cruza también contra cotizaciones para cubrir registros históricos y despliegues escalonados.
    const usedQ=await db.from("cotizaciones").select("id,numero_cotizacion,solicitud_id,fecha").not("solicitud_id","is",null).order("fecha",{ascending:true}).limit(3000);
    const used=new Map<string,any>();
    if(!usedQ.error)for(const c of (usedQ.data||[])){const key=String((c as any).solicitud_id||"");if(key&&!used.has(key))used.set(key,c)}
    const requests=(q.data||[]).map((x:any)=>{const c=used.get(String(x.id));return c?{...x,cotizacion_id:x.cotizacion_id||c.id,cotizacion_numero:c.numero_cotizacion||"",_consumida:true}:x});
    return{module,requests};
  }
  if(module==="quotes"){
    if(!ctx.permissions.quotes?.read)return{module,quotes:[]};
    const q=await db.from("cotizaciones").select("*").order("fecha",{ascending:false}).limit(1000);if(q.error)throw q.error;
    // R9.18.32: una cotización utilizada deja de estar disponible aunque la migración
    // todavía no haya rellenado cotizaciones.pedido_id. Se cruza también contra pedidos.
    const usedQ=await db.from("pedidos").select("id,numero_pedido,cotizacion_id").not("cotizacion_id","is",null).order("fecha",{ascending:true}).limit(3000);
    const used=new Map<string,any>();
    if(!usedQ.error)for(const o of (usedQ.data||[])){const key=String((o as any).cotizacion_id||"");if(key&&!used.has(key))used.set(key,o)}
    const quotes=(q.data||[]).map((x:any)=>{const o=used.get(String(x.id));return o?{...x,pedido_id:x.pedido_id||o.id,pedido_numero:o.numero_pedido||"",_consumida:true}:x});
    return{module,quotes};
  }
  if(module==="clients"){
    if(!ctx.permissions.clients?.read)return{module,clients:[]};
    const q=await db.from("clientes").select("*").eq("activo",true).order("ultima_interaccion",{ascending:false}).limit(2000);if(q.error)throw q.error;
    return{module,clients:q.data||[]};
  }
  if(module==="users"){
    if(!ctx.permissions.users?.read)return{module,users:[]};
    const q=await db.from("usuarios").select("*").order("nombre");if(q.error)throw q.error;
    return{module,users:(q.data||[]).map(x=>safeUser(x as Dict))};
  }
  throw new Error("MODULO_ADMIN_NO_VALIDO");
}

async function adminBootstrap(ctx: SessionCtx, d: Dict={}) {
  const mode=clean(d.mode,30).toLowerCase();
  const [p,c,b,cfg] = await Promise.all([
    safeDbQuery("productos",db.from("productos").select("*").order("orden").order("nombre")),
    safeDbQuery("categorias",db.from("categorias").select("*").order("orden").order("nombre")),
    safeDbQuery("banners",db.from("banners").select("*").order("orden")),
    safeConfigQuery(),
  ]);
  const warnings:string[]=[p,c,b,cfg].filter((x:any)=>!x.ok).map((x:any)=>x.warning);
  const out:Dict={
    currentUser:safeUser(ctx.user), permissions:ctx.permissions,
    security:{mode:"TABLE_SESSION",session_ttl_seconds:SESSION_HOURS*3600,jwt:false,supabaseAuth:false},
    version:VERSION,
  };
  if(p.ok)out.products=ctx.permissions.products.read?(p.data||[]).map((x:any)=>legacyProduct(x as Dict)):[];
  if(c.ok)out.categories=ctx.permissions.categories.read?(c.data||[]).map((x:any)=>legacyCategory(x as Dict)):[];
  if(b.ok)out.banners=ctx.permissions.banners.read?(b.data||[]).map((x:any)=>legacyBanner(x as Dict)):[];
  if(cfg.ok)out.config=cfg.data||{};

  // R9.15.2: el login/cPanel ya no depende de una respuesta gigante.
  // Modo core entrega inmediatamente catálogo/config/permisos. Los módulos pesados se cargan por separado.
  if(mode==="core"){
    if(warnings.length){out.partial=true;out.warnings=warnings}
    return out;
  }

  // Compatibilidad con cPanel anteriores: cargar módulos sin convertir un fallo aislado en fallo total.
  const modules=["orders","requests","quotes","clients","users"];
  const settled=await Promise.allSettled(modules.map(module=>adminModule(ctx,{module})));
  settled.forEach((res,i)=>{
    const module=modules[i];
    if(res.status==="fulfilled")Object.assign(out,res.value);
    else warnings.push(apiWarning(module,res.reason));
  });
  if(warnings.length){out.partial=true;out.warnings=warnings}
  return out;
}

async function notificationFeed(ctx: SessionCtx, d: Dict) {
  requirePermission(ctx,"dashboard","read");
  const now = new Date();
  let since = new Date(clean(d.since,80));
  if (Number.isNaN(since.getTime()) || since > now || now.getTime() - since.getTime() > 7*24*60*60*1000) {
    since = new Date(now.getTime() - 60*1000);
  }
  const sinceIso = since.toISOString();
  const [orders, requests, readState] = await Promise.all([
    ctx.permissions.orders?.read
      ? db.from("pedidos").select("id,numero_pedido,fecha,nombre,rut,telefono,email,metodo_entrega,direccion,total,estado,estado_pago,medio_pago,fecha_pago,pdf_url,updated_at,comprobante_pago_estado,comprobante_pago_revisado_en").or(`fecha.gt.${sinceIso},updated_at.gt.${sinceIso}`).order("updated_at",{ascending:true}).limit(500)
      : Promise.resolve({data:[],error:null} as any),
    ctx.permissions.requests?.read
      ? db.from("solicitudes").select("id,numero_solicitud,fecha,nombre,rut,telefono,email,fecha_evento,tipo,cantidad,detalle,estado").gt("fecha",sinceIso).order("fecha",{ascending:true}).limit(50)
      : Promise.resolve({data:[],error:null} as any),
    db.from("notificacion_lecturas").select("notification_key,leido_en").eq("usuario_id",String(ctx.user.id||"")).order("leido_en",{ascending:false}).limit(2000),
  ]);
  if ((orders as any).error) throw (orders as any).error;
  if ((requests as any).error) throw (requests as any).error;
  // Compatibilidad de despliegue: si la migración SQL aún no fue aplicada, el feed sigue funcionando sin romper el cPanel.
  const readKeys=(readState as any).error?[]:((readState as any).data||[]).map((x:any)=>String(x.notification_key||"")).filter(Boolean);
  return {
    ok:true,
    serverTime:now.toISOString(),
    orders:(orders as any).data||[],
    requests:(requests as any).data||[],
    readKeys,
  };
}

async function notificationRead(req:Request,ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"dashboard","read");
  const key=clean(d.key,400);if(!key)throw new Error("NOTIFICACION_REQUERIDA");
  const row={usuario_id:String(ctx.user.id||""),notification_key:key,leido_en:nowIso()};
  const q=await db.from("notificacion_lecturas").upsert(row,{onConflict:"usuario_id,notification_key"});if(q.error)throw q.error;
  return{ok:true,key,read:true};
}

async function notificationReadAll(req:Request,ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"dashboard","read");
  const raw=Array.isArray(d.keys)?d.keys:[];
  const keys=[...new Set(raw.map((x:any)=>clean(x,400)).filter(Boolean))].slice(0,200);
  if(!keys.length)return{ok:true,count:0};
  const when=nowIso(),uid=String(ctx.user.id||"");
  const rows=keys.map(key=>({usuario_id:uid,notification_key:key,leido_en:when}));
  const q=await db.from("notificacion_lecturas").upsert(rows,{onConflict:"usuario_id,notification_key"});if(q.error)throw q.error;
  return{ok:true,count:keys.length,readKeys:keys};
}

async function saveProduct(req: Request, ctx: SessionCtx, d: Dict) {
  requirePermission(ctx,"products","write");
  const nombre=clean(d.nombre,250); if(!nombre)throw new Error("NOMBRE_PRODUCTO_REQUERIDO");
  const id=clean(d.id,100)||randomId("PROD");
  let categoriaId:string|null=null; const categoriaNombre=clean(d.categoria_nombre,180);
  if(categoriaNombre){const q=await db.from("categorias").select("id").ilike("nombre",categoriaNombre).maybeSingle();if(!q.error&&q.data)categoriaId=q.data.id;}
  const storagePath=clean(d.storage_path||d.drive_file_id,1000)||null;
  const imageUrl=clean(d.image_url,2000)||storagePublicUrl(storagePath)||null;
  const row={
    id,nombre,descripcion:clean(d.descripcion,5000),precio:money(d.precio),categoria_id:categoriaId,categoria_nombre:categoriaNombre,
    stock:money(d.stock),storage_path:storagePath,image_url:imageUrl,
    destacado:bool(d.destacado),activo:d.activo===undefined?true:bool(d.activo,true),ocasion:clean(d.ocasion,180),orden:Number(d.orden||0)||0,
  };
  const {error}=await db.from("productos").upsert(row,{onConflict:"id"}); if(error)throw error;
  await audit(req,ctx,"GUARDAR","PRODUCTO",id,{nombre}); return {ok:true,id};
}
async function savePrice(req: Request, ctx: SessionCtx, d: Dict) {
  requirePermission(ctx,"products","write"); const id=clean(d.id,100),precio=money(d.precio); if(!id)throw new Error("PRODUCTO_REQUERIDO");
  const {data,error}=await db.from("productos").update({precio}).eq("id",id).select("id").maybeSingle(); if(error)throw error;if(!data)throw new Error("PRODUCTO_NO_ENCONTRADO");
  await audit(req,ctx,"PRECIO","PRODUCTO",id,{precio}); return {ok:true,updated:true,precio};
}
async function saveCategory(req: Request, ctx: SessionCtx, d: Dict) {
  requirePermission(ctx,"categories","write"); const nombre=clean(d.nombre,180);if(!nombre)throw new Error("NOMBRE_CATEGORIA_REQUERIDO");const id=clean(d.id,100)||randomId("CAT");
  const row={id,nombre,descripcion:clean(d.descripcion,3000),storage_path:clean(d.storage_path||d.drive_file_id,1000)||null,image_url:clean(d.image_url,2000)||null,orden:Number(d.orden||0)||0,activo:d.activo===undefined?true:bool(d.activo,true)};
  const {error}=await db.from("categorias").upsert(row,{onConflict:"id"});if(error)throw error;await audit(req,ctx,"GUARDAR","CATEGORIA",id,{nombre});return{ok:true,id};
}
async function saveBanner(req: Request, ctx: SessionCtx, d: Dict) {
  requirePermission(ctx,"banners","write");const titulo=clean(d.titulo,250);if(!titulo)throw new Error("TITULO_BANNER_REQUERIDO");const id=clean(d.id,100)||randomId("BAN");
  const row={id,titulo,subtitulo:clean(d.subtitulo,1000),cta_texto:clean(d.cta_texto,180),enlace:clean(d.enlace,1000)||"#solicitud",storage_path:clean(d.storage_path||d.drive_file_id,1000)||null,image_url:clean(d.image_url,2000)||null,activo:d.activo===undefined?true:bool(d.activo,true),orden:Number(d.orden||0)||0};
  const {error}=await db.from("banners").upsert(row,{onConflict:"id"});if(error)throw error;await audit(req,ctx,"GUARDAR","BANNER",id,{titulo});return{ok:true,id};
}
async function saveConfig(req: Request, ctx: SessionCtx, d: Dict) {
  requirePermission(ctx,"settings","write");
  const allowed=["empresa","empresa_rut","whatsapp","instagram","facebook","tiktok","email","direccion","valor_despacho","logo_url","logo_storage_path","logo_drive_file_id","moneda","iva_porcentaje","cotizacion_validez_dias","document_format","web_public_url","transbank_enabled","transbank_payment_url","transbank_checkout_url","transbank_return_url","transbank_button_label","integration_shopify_enabled","integration_shopify_url","integration_woocommerce_enabled","integration_woocommerce_url","integration_mercadolibre_enabled","integration_mercadolibre_url","integration_meta_enabled","integration_meta_url","integration_google_merchant_enabled","integration_google_merchant_url","integration_tiktok_shop_enabled","integration_tiktok_shop_url","integration_whatsapp_catalog_enabled","integration_whatsapp_catalog_url","integration_jumpseller_enabled","integration_jumpseller_url"];
  const rows:any[]=[];for(const k of allowed){if(d[k]===undefined)continue;let v=(k==="valor_despacho"||k==="iva_porcentaje"||k==="cotizacion_validez_dias")?String(money(d[k])):clean(d[k],3000);if(k==="empresa_rut"&&v)v=requireValidRut(v,"RUT_EMPRESA_INVALIDO").rut;if(k==="web_public_url"&&v){v=publicWebUrl(v);if(!v)throw new Error("WEB_PUBLIC_URL_INVALIDA");}if((k==="transbank_checkout_url"||k==="transbank_return_url")&&v){const original=v;v=transbankPublicUrl(v);if(!v)throw new Error(k==="transbank_checkout_url"?"TRANSBANK_URL_CHECKOUT_HTTPS_PUBLICA_REQUERIDA":"TRANSBANK_URL_RETORNO_HTTPS_PUBLICA_REQUERIDA");if(!original.startsWith("https://"))throw new Error("TRANSBANK_URL_HTTPS_REQUERIDA");}if(k==="transbank_payment_url"&&v){v=transbankManualPaymentUrl(v);if(!v)throw new Error("TRANSBANK_LINK_MANUAL_OFICIAL_REQUERIDO");}rows.push({clave:k,valor:v,updated_by:ctx.user.id});if(k==="logo_drive_file_id")rows.push({clave:"logo_storage_path",valor:v,updated_by:ctx.user.id});}
  if(rows.length){const{error}=await db.from("config").upsert(rows,{onConflict:"clave"});if(error)throw error;}
  await audit(req,ctx,"GUARDAR","CONFIG","CONFIG",{});return{ok:true,config:await configMap()};
}


const PAYMENT_SECRET_BLOCKED = new Set([
  "ALE_MANAGEMENT_TOKEN","SUPABASE_URL","SUPABASE_DB_URL","SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY","SUPABASE_SECRET_KEYS","SUPABASE_PUBLISHABLE_KEYS","SUPABASE_JWKS","JWT_SECRET",
  "DENO_DEPLOYMENT_ID","SB_REGION","SB_EXECUTION_ID"
]);
const PAYMENT_SECRET_PREFIXES = [
  "TRANSBANK_","WEBPAY_","STRIPE_","MERCADOPAGO_","MERCADO_PAGO_","PAYPAL_","FLOW_","KLAP_","GETNET_",
  "KHIPU_","FINTOP_","SUMUP_","WOMPI_","PAYMENT_","GATEWAY_","ALE_PAYMENT_"
];
function supabaseProjectRef():string{
  try{
    const host=new URL(SUPABASE_URL).hostname.toLowerCase();
    const ref=host.split(".")[0]||"";
    if(!/^[a-z0-9-]{6,80}$/.test(ref))throw new Error("PROJECT_REF_INVALIDO");
    return ref;
  }catch(_){throw new Error("SUPABASE_PROJECT_REF_NO_DISPONIBLE");}
}
function paymentSecretManagerToken():string{return clean(Deno.env.get("ALE_MANAGEMENT_TOKEN"),12000);}
function paymentSecretName(v:unknown):string{
  const name=clean(v,256).toUpperCase();
  if(!/^[A-Z][A-Z0-9_]{2,127}$/.test(name))throw new Error("SECRET_NOMBRE_INVALIDO");
  if(name.startsWith("SUPABASE_")||PAYMENT_SECRET_BLOCKED.has(name))throw new Error("SECRET_NOMBRE_RESERVADO");
  const prefixOk=PAYMENT_SECRET_PREFIXES.some(p=>name.startsWith(p));
  const suffixOk=/(?:_API_KEY|_API_KEY_SECRET|_SECRET|_CLIENT_SECRET|_CLIENT_ID|_COMMERCE_CODE|_TOKEN|_ACCESS_TOKEN|_PRIVATE_KEY|_PUBLIC_KEY|_ENVIRONMENT)$/.test(name);
  if(!prefixOk&&!suffixOk)throw new Error("SECRET_SOLO_PASARELAS_PAGO");
  return name;
}
async function paymentSecretsManagementFetch(path:string,init:RequestInit={}):Promise<any>{
  const token=paymentSecretManagerToken();if(!token)throw new Error("SECRET_MANAGER_BOOTSTRAP_REQUERIDO");
  const response=await fetch(`https://api.supabase.com${path}`,{
    ...init,
    headers:{"Authorization":`Bearer ${token}`,"Accept":"application/json","Content-Type":"application/json",...(init.headers||{})}
  });
  const text=await response.text();let payload:any={};try{payload=text?JSON.parse(text):{};}catch(_){payload={message:text.slice(0,1200)};}
  if(!response.ok){
    const msg=clean(payload?.message||payload?.error||payload?.msg||text||"ERROR",700);
    throw new Error(`SECRET_MANAGER_HTTP_${response.status}:${msg}`);
  }
  return payload;
}
function safePaymentSecretMeta(row:any):Dict{
  const name=clean(row?.name||row?.key,256).toUpperCase();
  return {name,updated_at:clean(row?.updated_at||row?.updatedAt||row?.inserted_at||row?.created_at,120),masked:"••••••••••"};
}
async function paymentSecretsList(ctx:SessionCtx){
  requireAdmin(ctx);
  const project_ref=supabaseProjectRef(),bootstrap_ready=!!paymentSecretManagerToken();
  if(!bootstrap_ready)return{ok:true,bootstrap_ready:false,project_ref,secrets:[],message:"Agrega una sola vez ALE_MANAGEMENT_TOKEN en Supabase para habilitar este gestor."};
  const payload=await paymentSecretsManagementFetch(`/v1/projects/${encodeURIComponent(project_ref)}/secrets`,{method:"GET"});
  const rows=Array.isArray(payload)?payload:Array.isArray(payload?.secrets)?payload.secrets:[];
  const secrets=rows.map(safePaymentSecretMeta).filter((x:Dict)=>{try{return !!paymentSecretName(x.name)}catch(_){return false}}).sort((a:Dict,b:Dict)=>String(a.name).localeCompare(String(b.name)));
  return{ok:true,bootstrap_ready:true,project_ref,secrets};
}
async function paymentSecretsSet(req:Request,ctx:SessionCtx,d:Dict){
  requireAdmin(ctx);
  const raw=Array.isArray(d.secrets)?d.secrets:[];if(!raw.length)throw new Error("SECRET_LISTA_VACIA");if(raw.length>30)throw new Error("SECRET_LIMITE_30");
  const seen=new Set<string>(),rows:any[]=[];
  for(const item of raw){
    const name=paymentSecretName(item?.name),value=String(item?.value??"").slice(0,24576);
    if(!value.trim())throw new Error(`SECRET_VALOR_REQUERIDO:${name}`);if(seen.has(name))throw new Error(`SECRET_DUPLICADO:${name}`);seen.add(name);rows.push({name,value});
  }
  const project_ref=supabaseProjectRef();
  await paymentSecretsManagementFetch(`/v1/projects/${encodeURIComponent(project_ref)}/secrets`,{method:"POST",body:JSON.stringify(rows)});
  await audit(req,ctx,"SECRET_GUARDAR","PASARELA_PAGO","SECRETS",{nombres:rows.map(x=>x.name),cantidad:rows.length});
  return{ok:true,updated:rows.map(x=>x.name),message:"Secretos enviados al servidor. Los valores no se devuelven al navegador."};
}
async function paymentSecretsDelete(req:Request,ctx:SessionCtx,d:Dict){
  requireAdmin(ctx);
  const names=[...new Set((Array.isArray(d.names)?d.names:[d.name]).filter(Boolean).map(paymentSecretName))];if(!names.length)throw new Error("SECRET_NOMBRE_REQUERIDO");
  const project_ref=supabaseProjectRef();
  await paymentSecretsManagementFetch(`/v1/projects/${encodeURIComponent(project_ref)}/secrets`,{method:"DELETE",body:JSON.stringify(names)});
  await audit(req,ctx,"SECRET_ELIMINAR","PASARELA_PAGO","SECRETS",{nombres:names,cantidad:names.length});
  return{ok:true,deleted:names};
}

function sanitizeFileName(name:string):string{return clean(name,180).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"")||`imagen-${Date.now()}.bin`;}
async function uploadImage(req: Request, ctx: SessionCtx, d: Dict) {
  const kind=clean(d.kind,40).toUpperCase()||"PRODUCTOS";const moduleMap:Dict={PRODUCTOS:"products",CATEGORIAS:"categories",BANNERS:"banners",LOGO:"settings",USUARIOS:"users",PEDIDOS:"orders",COTIZACIONES:"quotes"};
  requirePermission(ctx,moduleMap[kind]||"products","write");
  const match=String(d.dataUrl||"").match(/^data:([^;]+);base64,(.+)$/);if(!match)throw new Error("IMAGEN_INVALIDA");
  const mime=match[1];if(!["image/jpeg","image/png","image/webp","image/gif"].includes(mime))throw new Error("TIPO_IMAGEN_NO_PERMITIDO");
  const bin=atob(match[2]);if(bin.length>6*1024*1024)throw new Error("IMAGEN_SUPERA_6MB");const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const folder:Dict={PRODUCTOS:"productos",CATEGORIAS:"categorias",BANNERS:"banners",LOGO:"logo",USUARIOS:"usuarios",PEDIDOS:"pedidos",COTIZACIONES:"cotizaciones"};
  const name=sanitizeFileName(clean(d.fileName,180)||`imagen-${Date.now()}`);const path=`${folder[kind]||"otros"}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${name}`;
  const {error}=await db.storage.from(BUCKET).upload(path,bytes,{contentType:mime,upsert:false});if(error)throw error;const{data:pub}=db.storage.from(BUCKET).getPublicUrl(path);
  const url=pub.publicUrl;await db.from("archivos").insert({entidad:kind,tipo:"IMAGEN",bucket:BUCKET,storage_path:path,nombre_original:name,mime_type:mime,bytes:bytes.length,public_url:url,subido_por:ctx.user.id});
  await audit(req,ctx,"SUBIR","IMAGEN",path,{kind,bytes:bytes.length});return{ok:true,fileId:path,storagePath:path,imageUrl:url,name};
}

async function cleanupStoragePaths(paths:string[]) {
  const cleanPaths=[...new Set((paths||[]).map(x=>clean(x,1000)).filter(Boolean))];
  if(!cleanPaths.length)return;
  try{await db.storage.from(BUCKET).remove(cleanPaths);}catch(_){ }
  try{await db.from("archivos").delete().eq("bucket",BUCKET).in("storage_path",cleanPaths);}catch(_){ }
}

async function fetchRowsByIds(table:string, ids:string[], preferredFields:string, fallbackFields="id") {
  let q=await db.from(table).select(preferredFields).in("id",ids);
  if(!q.error)return q.data||[];
  // La eliminación nunca debe depender de una columna opcional de una migración posterior.
  if(fallbackFields&&fallbackFields!==preferredFields){
    q=await db.from(table).select(fallbackFields).in("id",ids);
    if(!q.error)return q.data||[];
  }
  throw q.error;
}

function chunksOf<T>(items:T[],size=75):T[][]{
  const out:T[][]=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out;
}

async function hardDeleteIds(table:string, ids:string[]) {
  for(const chunk of chunksOf(ids,75)){
    const q=await db.from(table).delete().in("id",chunk);
    if(q.error)throw q.error;
  }
}

async function getRemainingIds(table:string, ids:string[]):Promise<string[]> {
  const remaining:string[]=[];
  for(const chunk of chunksOf(ids,75)){
    const q=await db.from(table).select("id").in("id",chunk);
    if(q.error)throw q.error;
    for(const row of q.data||[])remaining.push(String((row as Dict).id||""));
  }
  return remaining.filter(Boolean);
}

async function verifyDeleteEntities(_req: Request, ctx: SessionCtx, d: Dict) {
  const kind=clean(d.kind,40).toLowerCase();
  const ids=[...new Set((Array.isArray(d.ids)?d.ids:[]).map((x:any)=>clean(x,100)).filter(Boolean))].slice(0,250);
  if(!ids.length)throw new Error("IDS_REQUERIDOS");

  let table="",moduleName="";
  if(["product","products","producto","productos"].includes(kind)){table="productos";moduleName="products";}
  else if(["request","requests","solicitud","solicitudes"].includes(kind)){table="solicitudes";moduleName="requests";}
  else if(["quote","quotes","cotizacion","cotizaciones"].includes(kind)){table="cotizaciones";moduleName="quotes";}
  else throw new Error("TIPO_NO_VALIDO");

  requirePermission(ctx,moduleName,"delete");
  const remainingIds=await getRemainingIds(table,ids);
  const remainingSet=new Set(remainingIds);
  const missingIds=ids.filter(id=>!remainingSet.has(id));
  return{
    ok:true,
    confirmed:remainingIds.length===0,
    requested:ids.length,
    absent:missingIds.length,
    remaining:remainingIds.length,
    remainingIds,
    absentIds:missingIds,
    verification:true
  };
}

async function bulkDeleteEntities(req: Request, ctx: SessionCtx, d: Dict) {
  const kind=clean(d.kind,40).toLowerCase();
  const ids=[...new Set((Array.isArray(d.ids)?d.ids:[]).map((x:any)=>clean(x,100)).filter(Boolean))].slice(0,250);
  if(!ids.length)throw new Error("IDS_REQUERIDOS");

  let table="",moduleName="",entity="",preferred="id",fallback="id";
  if(["product","products","producto","productos"].includes(kind)){
    table="productos";moduleName="products";entity="PRODUCTOS";
    preferred="id,nombre,storage_path,image_url";fallback="id,nombre";
  }else if(["request","requests","solicitud","solicitudes"].includes(kind)){
    table="solicitudes";moduleName="requests";entity="SOLICITUDES";
    preferred="id,numero_solicitud,cliente_id,nombre,telefono,estado";fallback="id,estado";
  }else if(["quote","quotes","cotizacion","cotizaciones"].includes(kind)){
    table="cotizaciones";moduleName="quotes";entity="COTIZACIONES";
    preferred="id,numero_cotizacion,cliente_id,pdf_bucket,pdf_path";fallback="id";
  }else throw new Error("TIPO_NO_VALIDO");

  requirePermission(ctx,moduleName,"delete");

  // 1) Obtener los registros existentes. Si una columna auxiliar no existe, se usa solo ID.
  const rows:any[]=await fetchRowsByIds(table,ids,preferred,fallback) as any[];
  const blockedRows=table==="solicitudes"?rows.filter((x:any)=>String(x.estado||"").toUpperCase()==="CERRADA"):[];
  const blockedIds=blockedRows.map((x:any)=>clean(x.id,100)).filter(Boolean);const blockedSet=new Set(blockedIds);
  const existingIds=[...new Set(rows.map((x:any)=>clean(x.id,100)).filter((id:string)=>id&&!blockedSet.has(id)))];
  if(!existingIds.length)return{ok:true,requested:ids.length,existing:0,deleted:0,missing:Math.max(0,ids.length-blockedIds.length),blocked:blockedIds.length,blockedIds,remaining:0,remainingIds:[]};

  // 2) DELETE físico por lotes cortos. Solicitudes CERRADAS se excluyen y quedan protegidas.
  await hardDeleteIds(table,existingIds);

  // 3) Verificación real posterior: no confiamos en el número de filas devuelto por PostgREST.
  const remainingIds=await getRemainingIds(table,existingIds);
  const remainingSet=new Set(remainingIds);
  const deletedIds=existingIds.filter(id=>!remainingSet.has(id));
  const deleted=deletedIds.length;
  const missing=Math.max(0,ids.length-existingIds.length-blockedIds.length);

  if(remainingIds.length){
    return{ok:false,error:"ELIMINACION_INCOMPLETA",requested:ids.length,existing:existingIds.length,deleted,missing,remaining:remainingIds.length,remainingIds};
  }

  // 4) Limpiezas secundarias NO bloquean la respuesta ni convierten un DELETE correcto en timeout.
  if(table==="productos"){
    const deletedSet=new Set(deletedIds);
    const paths=rows.filter((x:any)=>deletedSet.has(String(x.id))).map((x:any)=>clean(x.storage_path,1000)).filter(Boolean);
    if(paths.length)deferTask(cleanupStoragePaths(paths));
  }
  if(table==="cotizaciones"){
    const deletedSet=new Set(deletedIds);
    const paths=rows.filter((x:any)=>deletedSet.has(String(x.id))&&(!x.pdf_bucket||String(x.pdf_bucket)===BUCKET)).map((x:any)=>clean(x.pdf_path,1000)).filter(Boolean);
    if(paths.length)deferTask(cleanupStoragePaths(paths));
    deferTask((async()=>{try{await db.from("archivos").delete().eq("entidad","COTIZACION").in("entidad_id",deletedIds);}catch(_){}})());
  }

  // Estadísticas de clientes son secundarias y solo se recalculan cuando el campo existe en la respuesta.
  const customerIds:string[]=[...new Set<string>(rows.map((x:any)=>clean(x.cliente_id,100)).filter(Boolean))];
  for(const cid of customerIds)deferTask(refreshCustomerStats(cid));

  deferTask(audit(req,ctx,"ELIMINAR_MULTIPLE",entity,"MULTIPLE",{
    hard:true,requested:ids.length,deleted,missing,ids:deletedIds
  }));

  return{ok:true,requested:ids.length,existing:existingIds.length,deleted,missing,blocked:blockedIds.length,blockedIds,remaining:0,remainingIds:[],deletedIds};
}

async function deleteEntity(req: Request, ctx: SessionCtx, d: Dict) {
  const kind=clean(d.kind,40).toLowerCase();
  const id=clean(d.id,100);
  if(!id)throw new Error("ID_REQUERIDO");
  const normalized=kind==="product"?"products":kind==="request"?"requests":kind==="quote"?"quotes":kind;
  if(["products","requests","quotes"].includes(normalized)){
    const out=await bulkDeleteEntities(req,ctx,{kind:normalized,ids:[id]});
    if(normalized==="requests"&&Number(out.blocked||0)>0)throw new Error("SOLICITUD_CERRADA_NO_ELIMINABLE");
    return{ok:true,deleted:Number(out.deleted||0)>0,missing:out.missing||0};
  }
  const map:Dict={category:["categorias","categories"],banner:["banners","banners"]};
  const target=map[kind];if(!target)throw new Error("TIPO_NO_VALIDO");
  requirePermission(ctx,target[1],"delete");
  const{data,error}=await db.from(target[0]).update({activo:false}).eq("id",id).select("id").maybeSingle();if(error)throw error;
  await audit(req,ctx,"ELIMINAR",target[0].toUpperCase(),id,{soft:true});
  return{ok:true,deleted:!!data};
}
const FINAL_ORDER_STATES=new Set(["ENTREGADO","CANCELADO"]);
function orderStatusFinal(value:unknown){return FINAL_ORDER_STATES.has(clean(value,80).toUpperCase())}
async function requireMutableOrder(id:string){const q=await db.from("pedidos").select("id,numero_pedido,cliente_id,estado,estado_pago").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("PEDIDO_NO_ENCONTRADO");if(orderStatusFinal((q.data as any).estado))throw new Error("PEDIDO_ESTADO_FINAL");return q.data as any}
async function updateStatus(req: Request, ctx: SessionCtx, d: Dict) {
  const kind=clean(d.kind,40).toLowerCase(),status=clean(d.status,80).toUpperCase();const allowed:Dict={order:["PENDIENTE","CONFIRMADO","EN PREPARACION","LISTO","ENTREGADO"],request:["NUEVA","CONTACTADA","COTIZADA","ACEPTADA","CERRADA"]};const map:Dict={order:["pedidos","orders"],request:["solicitudes","requests"]};
  if(!map[kind]||!allowed[kind].includes(status))throw new Error(status==="CANCELADO"&&kind==="order"?"ANULACION_REQUIERE_MOTIVO":"ESTADO_NO_VALIDO");requirePermission(ctx,map[kind][1],"write");const id=clean(d.id,100);if(!id)throw new Error("ID_REQUERIDO");
  if(kind==="order")await requireMutableOrder(id);
  if(kind==="request"){const rq=await db.from("solicitudes").select("id,estado").eq("id",id).maybeSingle();if(rq.error)throw rq.error;if(!rq.data)throw new Error("SOLICITUD_NO_ENCONTRADA");if(String((rq.data as any).estado||"").toUpperCase()==="CERRADA")throw new Error("SOLICITUD_CERRADA_BLOQUEADA");}
  const selectFields=kind==="order"?"id,cliente_id,estado,estado_pago":"id";const{data,error}=await db.from(map[kind][0]).update({estado:status,updated_at:nowIso()}).eq("id",id).select(selectFields).maybeSingle();if(error)throw error;if(kind==="order"&&data){if(data.cliente_id)deferTask(refreshCustomerStats(String(data.cliente_id)));deferTask(appendOrderHistory(id,"ESTADO_PEDIDO",status,String(data.estado_pago||"PENDIENTE"),`Estado del pedido actualizado a ${publicOrderStatusLabel(status)}${status==="ENTREGADO"?" · Estado final e irreversible":""}`,String(ctx.user.id||"")||null));}await audit(req,ctx,"ESTADO",map[kind][0].toUpperCase(),id,{estado:status,final:kind==="order"&&status==="ENTREGADO"});return{ok:true,updated:!!data,final:kind==="order"&&status==="ENTREGADO"};
}
async function cancelOrder(req:Request,ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"orders","write");const id=clean(d.id||d.order_id,100),motivo=clean(d.motivo||d.reason,500);if(!id)throw new Error("PEDIDO_REQUERIDO");if(motivo.length<5)throw new Error("MOTIVO_ANULACION_REQUERIDO");const current=await requireMutableOrder(id);const when=nowIso();
  const upd=await db.from("pedidos").update({estado:"CANCELADO",anulado_motivo:motivo,anulado_por:String(ctx.user.id||"")||null,anulado_en:when,updated_at:when}).eq("id",id).select("id,numero_pedido,cliente_id,estado,estado_pago,anulado_motivo,anulado_por,anulado_en").maybeSingle();if(upd.error)throw upd.error;if(!upd.data)throw new Error("PEDIDO_NO_ENCONTRADO");
  await db.from("pedido_enlaces_pago").update({revocado_en:when}).eq("pedido_id",id).is("revocado_en",null);
  if((upd.data as any).cliente_id)deferTask(refreshCustomerStats(String((upd.data as any).cliente_id)));deferTask(appendOrderHistory(id,"PEDIDO_ANULADO","CANCELADO",String((upd.data as any).estado_pago||current.estado_pago||"PENDIENTE"),`Pedido anulado. Motivo: ${motivo}`,String(ctx.user.id||"")||null));deferTask(audit(req,ctx,"ANULAR","PEDIDO",id,{motivo,estado_anterior:current.estado,estado_pago:current.estado_pago,final:true}));return{ok:true,id,estado:"CANCELADO",motivo,anulado_en:when,final:true};
}


function quoteItems(raw: unknown): Dict[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0,100).map((item:any)=>{
    const descripcion=clean(item?.descripcion||item?.nombre,500);
    const cantidad=Math.max(0, Number(item?.cantidad||0));
    const precio_unitario=money(item?.precio_unitario??item?.precio);
    const total=money(cantidad*precio_unitario);
    return {descripcion,cantidad,precio_unitario,total};
  }).filter(x=>x.descripcion && x.cantidad>0);
}

async function saveQuote(req: Request, ctx: SessionCtx, d: Dict) {
  requirePermission(ctx,"quotes","write");
  const id=clean(d.id,100)||randomId("COT");
  const items=quoteItems(d.items);
  if(!items.length) throw new Error("COTIZACION_SIN_ITEMS");
  const initialRut=requireValidRut(d.rut,"RUT_COTIZACION_INVALIDO");
  const subtotal=money(items.reduce((sum,x)=>sum+Number(x.total||0),0));
  const ivaPorcentaje=Math.min(100,Math.max(0,Number(d.iva_porcentaje??19)||0));
  const iva=money(subtotal*ivaPorcentaje/100);
  const total=money(subtotal+iva);
  const solicitudId=clean(d.solicitud_id,100)||null;
  let numeroSolicitud=clean(d.numero_solicitud,100)||null;
  let linkedRequest:any=null;
  const existingQuote=await db.from("cotizaciones").select("id,solicitud_id").eq("id",id).maybeSingle();
  if(existingQuote.error)throw existingQuote.error;
  const existingSolicitudId=clean((existingQuote.data as any)?.solicitud_id,100)||null;
  if(existingSolicitudId && existingSolicitudId!==solicitudId){
    throw new Error("SOLICITUD_COTIZACION_NO_REASIGNABLE");
  }
  if(solicitudId){
    const rq=await db.from("solicitudes").select("*").eq("id",solicitudId).maybeSingle();
    if(rq.error)throw rq.error;
    if(!rq.data)throw new Error("SOLICITUD_NO_ENCONTRADA");
    linkedRequest=rq.data;numeroSolicitud=clean((rq.data as any).numero_solicitud,100)||numeroSolicitud;
    const requestQuoteId=clean((rq.data as any).cotizacion_id,100);
    if(requestQuoteId && requestQuoteId!==id)throw new Error("SOLICITUD_YA_CONVERTIDA_EN_COTIZACION");
    const used=await db.from("cotizaciones").select("id,numero_cotizacion").eq("solicitud_id",solicitudId).neq("id",id).order("fecha",{ascending:true}).limit(1).maybeSingle();
    if(used.error)throw used.error;
    if(used.data)throw new Error("SOLICITUD_YA_CONVERTIDA_EN_COTIZACION");
  }
  const linkedRut=linkedRequest?.rut?requireValidRut(linkedRequest.rut,"RUT_SOLICITUD_INVALIDO"):initialRut;
  const customer=linkedRequest?.cliente_id?{id:linkedRequest.cliente_id}:await upsertCustomer(req,{...d,rut:linkedRut.rut,nombre:d.cliente_nombre},"COTIZACION",id);
  const row={
    id,
    solicitud_id:solicitudId,
    numero_solicitud:numeroSolicitud,
    cliente_id:customer?.id||linkedRequest?.cliente_id||null,
    cliente_nombre:clean(linkedRequest?.nombre||d.cliente_nombre||d.nombre,180),
    rut:linkedRut.rut,
    rut_normalizado:linkedRut.normalized,
    telefono:clean(linkedRequest?.telefono||d.telefono,80),
    email:clean(linkedRequest?.email||d.email,250),
    moneda:clean(d.moneda,10)||"CLP",
    validez_dias:Math.max(1,Math.min(365,Number(d.validez_dias||15)||15)),
    items,
    subtotal,
    iva_porcentaje:ivaPorcentaje,
    iva,
    total,
    estado:clean(d.estado,30).toUpperCase()||"BORRADOR",
    observaciones:clean(d.observaciones,5000),
    pdf_bucket:null,
    pdf_path:null,
    pdf_url:null,
    creado_por:ctx.user.id
  };
  if(!row.cliente_nombre) throw new Error("CLIENTE_REQUERIDO");
  const allowed=["BORRADOR","ENVIADA","ACEPTADA","RECHAZADA","VENCIDA","ANULADA"];
  if(!allowed.includes(row.estado)) row.estado="BORRADOR";
  const {data,error}=await db.from("cotizaciones").upsert(row,{onConflict:"id"}).select("*").single();
  if(error) throw error;
  if(solicitudId){
    // La relación inversa se fija de forma atómica por el trigger R9.18.33.
    // Aquí solo normalizamos el estado para compatibilidad con bases históricas.
    await db.from("solicitudes").update({estado:"COTIZADA"}).eq("id",solicitudId).in("estado",["NUEVA","CONTACTADA"]);
  }
  if(data?.cliente_id)deferTask(refreshCustomerStats(String(data.cliente_id)));
  await audit(req,ctx,"GUARDAR","COTIZACION",id,{numero_cotizacion:data.numero_cotizacion,subtotal,iva,total,solicitud_id:solicitudId,cliente_id:data.cliente_id||null});
  return {ok:true,quote:data};
}

async function uploadQuotePdf(req: Request, ctx: SessionCtx, d: Dict) {
  requirePermission(ctx,"quotes","write");
  const id=clean(d.id,100); if(!id) throw new Error("COTIZACION_REQUERIDA");
  const {data:quote,error:qErr}=await db.from("cotizaciones").select("id,numero_cotizacion").eq("id",id).maybeSingle();
  if(qErr) throw qErr; if(!quote) throw new Error("COTIZACION_NO_ENCONTRADA");
  const match=String(d.dataUrl||"").match(/^data:application\/pdf(?:;filename=[^;]+)?;base64,(.+)$/);
  if(!match) throw new Error("PDF_INVALIDO");
  const bin=atob(match[1]);
  if(bin.length>12*1024*1024) throw new Error("PDF_SUPERA_12MB");
  const bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  const safeNumber=sanitizeFileName(String(quote.numero_cotizacion||id)).replace(/\.[^.]+$/,"");
  const path=`cotizaciones/${safeNumber}.pdf`;
  const {error:upErr}=await db.storage.from(BUCKET).upload(path,bytes,{contentType:"application/pdf",upsert:true});
  if(upErr) throw upErr;
  const {data:pub}=db.storage.from(BUCKET).getPublicUrl(path);
  const pdfUrl=pub.publicUrl;
  const {data:updated,error:uErr}=await db.from("cotizaciones")
    .update({pdf_bucket:BUCKET,pdf_path:path,pdf_url:pdfUrl})
    .eq("id",id).select("*").single();
  if(uErr) throw uErr;
  const fileRow={entidad:"COTIZACION",entidad_id:id,tipo:"PDF",bucket:BUCKET,storage_path:path,nombre_original:`${safeNumber}.pdf`,mime_type:"application/pdf",bytes:bytes.length,public_url:pdfUrl,activo:true,subido_por:ctx.user.id};
  await db.from("archivos").upsert(fileRow,{onConflict:"bucket,storage_path"});
  await audit(req,ctx,"GENERAR_PDF","COTIZACION",id,{pdf_url:pdfUrl,bytes:bytes.length});
  return {ok:true,quote:updated,pdfUrl,storagePath:path};
}

async function updateQuoteStatus(req: Request, ctx: SessionCtx, d: Dict) {
  requirePermission(ctx,"quotes","write");
  const id=clean(d.id,100), status=clean(d.status,30).toUpperCase();
  const allowed=["BORRADOR","ENVIADA","ACEPTADA","RECHAZADA","VENCIDA","ANULADA"];
  if(!id||!allowed.includes(status)) throw new Error("ESTADO_COTIZACION_NO_VALIDO");
  const {data,error}=await db.from("cotizaciones").update({estado:status}).eq("id",id).select("*").maybeSingle();
  if(error) throw error; if(!data) throw new Error("COTIZACION_NO_ENCONTRADA");
  await audit(req,ctx,"ESTADO","COTIZACION",id,{estado:status});
  return {ok:true,quote:data};
}

async function saveUser(req: Request, ctx: SessionCtx, d: Dict) {
  requireAdmin(ctx);const id=clean(d.id,100);const nombre=clean(d.nombre,180),usuario=normalizeLogin(d.usuario),email=clean(d.email,250).toLowerCase()||null,rol=clean(d.rol,40).toUpperCase()||"EDITOR",activo=d.activo===undefined?true:bool(d.activo,true);const password=String(d.password||"");
  if(!nombre)throw new Error("NOMBRE_REQUERIDO");if(!usuario)throw new Error("USUARIO_REQUERIDO");if(!["ADMIN","GERENCIA","OPERADOR","EDITOR","LECTURA"].includes(rol))throw new Error("ROL_INVALIDO");
  if(!id){if(password.length<8)throw new Error("CLAVE_MINIMO_8_CARACTERES");const{data,error}=await db.rpc("ale_crear_usuario_seguro",{p_nombre:nombre,p_usuario:usuario,p_email:email,p_rol:rol,p_activo:activo,p_password:password,p_permisos:d.permisos||{},p_profile_path:clean(d.profile_file_id||d.profile_path,1000)||null,p_profile_url:clean(d.profile_url,2000)||null});if(error)throw error;await audit(req,ctx,"CREAR","USUARIO",String(data),{usuario,rol});return{ok:true,id:data};}
  if(id===ctx.user.id&&(!activo||rol!=="ADMIN"))throw new Error("NO_PUEDE_DESACTIVAR_SU_PROPIO_ADMIN");
  const{error}=await db.from("usuarios").update({nombre,usuario,email,rol,activo,permisos:d.permisos||{},profile_path:clean(d.profile_file_id||d.profile_path,1000)||null,profile_url:clean(d.profile_url,2000)||null}).eq("id",id);if(error)throw error;
  if(password){if(password.length<8)throw new Error("CLAVE_MINIMO_8_CARACTERES");const q=await db.rpc("ale_establecer_clave",{p_usuario_id:id,p_password:password});if(q.error)throw q.error;}
  await audit(req,ctx,"GUARDAR","USUARIO",id,{usuario,rol});return{ok:true,id};
}
async function deleteUser(req: Request, ctx: SessionCtx, d: Dict) {
  requireAdmin(ctx);const id=clean(d.id,100);if(!id)throw new Error("USUARIO_REQUERIDO");if(id===ctx.user.id)throw new Error("NO_PUEDE_ELIMINAR_SU_PROPIO_USUARIO");
  const{data:target,error:tErr}=await db.from("usuarios").select("id,rol,activo").eq("id",id).maybeSingle();if(tErr)throw tErr;if(!target)throw new Error("USUARIO_NO_ENCONTRADO");
  if(String(target.rol).toUpperCase()==="ADMIN"&&target.activo){const{count,error}=await db.from("usuarios").select("id",{count:"exact",head:true}).eq("rol","ADMIN").eq("activo",true);if(error)throw error;if((count||0)<=1)throw new Error("DEBE_EXISTIR_AL_MENOS_UN_ADMIN");}
  const q=await db.from("usuarios").update({activo:false}).eq("id",id);if(q.error)throw q.error;await db.from("sesiones").update({revocada:true}).eq("usuario_id",id);await audit(req,ctx,"DESACTIVAR","USUARIO",id,{});return{ok:true,deleted:true};
}
async function changeMyPassword(req: Request, ctx: SessionCtx, d: Dict) {
  const password=String(d.password||"");if(password.length<8)throw new Error("CLAVE_MINIMO_8_CARACTERES");const q=await db.rpc("ale_establecer_clave",{p_usuario_id:ctx.user.id,p_password:password});if(q.error)throw q.error;await audit(req,ctx,"CAMBIAR_CLAVE","USUARIO",ctx.user.id,{});return{ok:true,updated:true,session_revoked:true};
}
async function logout(req: Request, ctx: SessionCtx) {
  await db.from("sesiones").update({revocada:true}).eq("id",ctx.session.id);await audit(req,ctx,"LOGOUT","USUARIO",ctx.user.id,{});return{ok:true,logged_out:true};
}



function normalizePhone(v: unknown): string { let d=String(v??"").replace(/\D/g,""); if(d.length===9&&d.startsWith("9"))d="56"+d; if(d.length===8)d="56"+d; return d.slice(0,24); }
async function upsertCustomer(req:Request,d:Dict,source:"SOLICITUD"|"PEDIDO"|"COTIZACION",sourceId:string):Promise<Dict|null>{
  const rutData=requireValidRut(d.rut,"RUT_CLIENTE_INVALIDO");
  const telefono=clean(d.telefono,80), phone=normalizePhone(telefono), email=clean(d.email,250).toLowerCase(), nombre=clean(d.nombre||d.cliente_nombre,180);
  let found:any=null;
  const byRut=await db.from("clientes").select("*").eq("rut_normalizado",rutData.normalized).order("ultima_interaccion",{ascending:false}).limit(1);
  if(byRut.error)throw byRut.error;found=(byRut.data||[])[0]||null;
  if(!found&&phone){const q=await db.from("clientes").select("*").eq("telefono_normalizado",phone).limit(1);if(q.error)throw q.error;const byPhone=(q.data||[])[0]||null;if(byPhone){const otherRut=normalizeRut(byPhone.rut_normalizado||byPhone.rut);if(otherRut&&otherRut!==rutData.normalized)throw new Error("TELEFONO_YA_ASOCIADO_A_OTRO_RUT");found=byPhone;}}
  if(!found&&email){const q=await db.from("clientes").select("*").eq("email",email).limit(1);if(q.error)throw q.error;const byEmail=(q.data||[])[0]||null;if(byEmail){const otherRut=normalizeRut(byEmail.rut_normalizado||byEmail.rut);if(otherRut&&otherRut!==rutData.normalized)throw new Error("EMAIL_YA_ASOCIADO_A_OTRO_RUT");found=byEmail;}}
  const now=nowIso();
  if(found){
    const patch:any={nombre:nombre||found.nombre,rut:rutData.rut,rut_normalizado:rutData.normalized,telefono:telefono||found.telefono,telefono_normalizado:phone||found.telefono_normalizado,email:email||found.email,direccion:clean(d.direccion,500)||found.direccion||null,comuna:clean(d.comuna,180)||found.comuna||null,tipo_transporte:clean(d.tipo_transporte||d.metodo_entrega,60).toUpperCase()||found.tipo_transporte||"POR DEFINIR",ultima_interaccion:now};
    const u=await db.from("clientes").update(patch).eq("id",found.id).select("*").single();if(u.error)throw u.error;return u.data;
  }
  const row:any={nombre:nombre||"Cliente",rut:rutData.rut,rut_normalizado:rutData.normalized,telefono:telefono||null,telefono_normalizado:phone||null,email:email||null,direccion:clean(d.direccion,500)||null,comuna:clean(d.comuna,180)||null,tipo_transporte:clean(d.tipo_transporte||d.metodo_entrega,60).toUpperCase()||"POR DEFINIR",origen_primero:source,primera_interaccion:now,ultima_interaccion:now,total_solicitudes:0,total_pedidos:0,total_cotizaciones:0};
  const i=await db.from("clientes").insert(row).select("*").single();if(i.error)throw i.error;deferTask(audit(req,null,"CREAR","CLIENTE",i.data.id,{source,sourceId,rut:rutData.rut}));return i.data;
}
async function clientByRut(ctx:SessionCtx,d:Dict){
  const canRead=!!(ctx.permissions.clients?.read||ctx.permissions.requests?.write||ctx.permissions.quotes?.write||ctx.permissions.orders?.write);
  if(!canRead)throw new Error("PERMISO_DENEGADO");
  const rutData=requireValidRut(d.rut,"RUT_CLIENTE_INVALIDO");
  const q=await db.from("clientes").select("id,numero_cliente,nombre,rut,rut_normalizado,telefono,email,direccion,comuna,tipo_transporte,ultima_interaccion,total_solicitudes,total_pedidos,total_cotizaciones,total_comprado").eq("rut_normalizado",rutData.normalized).eq("activo",true).order("ultima_interaccion",{ascending:false}).limit(1).maybeSingle();
  if(q.error)throw q.error;
  return{ok:true,found:!!q.data,client:q.data||null};
}

async function updateRequestClient(req:Request,ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"requests","write");
  const id=clean(d.id,100);if(!id)throw new Error("SOLICITUD_REQUERIDA");
  const current=await db.from("solicitudes").select("*").eq("id",id).maybeSingle();
  if(current.error)throw current.error;if(!current.data)throw new Error("SOLICITUD_NO_ENCONTRADA");
  if(String((current.data as any).estado||"").trim().toUpperCase()==="CERRADA")throw new Error("SOLICITUD_CERRADA");
  if(clean((current.data as any).cotizacion_id,100))throw new Error("SOLICITUD_COTIZADA_BLOQUEADA");
  const used=await db.from("cotizaciones").select("id").eq("solicitud_id",id).limit(1).maybeSingle();if(used.error)throw used.error;if(used.data)throw new Error("SOLICITUD_COTIZADA_BLOQUEADA");
  const nombre=clean(d.nombre,180),telefono=clean(d.telefono,80);
  if(!nombre)throw new Error("NOMBRE_REQUERIDO");if(!telefono)throw new Error("TELEFONO_REQUERIDO");
  const rutData=requireValidRut(d.rut,"RUT_SOLICITUD_INVALIDO");
  const customer=await upsertCustomer(req,{...d,nombre,telefono,rut:rutData.rut},"SOLICITUD",id);
  const patch:any={cliente_id:customer?.id||null,nombre,rut:rutData.rut,rut_normalizado:rutData.normalized,telefono,email:clean(d.email,250)};
  const u=await db.from("solicitudes").update(patch).eq("id",id).select("*").single();if(u.error)throw u.error;
  if(customer?.id)deferTask(refreshCustomerStats(String(customer.id)));
  await audit(req,ctx,"ACTUALIZAR_CLIENTE","SOLICITUD",id,{cliente_id:customer?.id||null,rut:rutData.rut});
  return{ok:true,request:u.data,client:customer};
}

async function refreshCustomerStats(clienteId:string){if(!clienteId)return;const [p,s,q]=await Promise.all([db.from("pedidos").select("total,estado").eq("cliente_id",clienteId),db.from("solicitudes").select("id").eq("cliente_id",clienteId),db.from("cotizaciones").select("id").eq("cliente_id",clienteId)]);const sales=(p.data||[]).filter((x:any)=>String(x.estado).toUpperCase()==="ENTREGADO").reduce((a:number,x:any)=>a+Number(x.total||0),0);await db.from("clientes").update({total_pedidos:(p.data||[]).length,total_solicitudes:(s.data||[]).length,total_cotizaciones:(q.data||[]).length,total_comprado:money(sales),ultima_interaccion:nowIso()}).eq("id",clienteId);}


async function saveClient(req:Request,ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"clients","write");
  const id=clean(d.id,100),nombre=clean(d.nombre,180),rutData=requireValidRut(d.rut,"RUT_CLIENTE_INVALIDO");
  if(!nombre)throw new Error("NOMBRE_CLIENTE_REQUERIDO");
  const telefono=clean(d.telefono,80),telefonoNormalizado=normalizePhone(telefono),email=clean(d.email,250).toLowerCase()||null;
  const direccion=clean(d.direccion,500)||null,comuna=clean(d.comuna,180)||null;
  const tipoRaw=clean(d.tipo_transporte||d.metodo_entrega,60).toUpperCase();
  const tipoMap:Record<string,string>={"RETIRO":"RETIRO","DESPACHO":"DESPACHO","OTRO":"OTRO","POR DEFINIR":"POR DEFINIR","POR_DEFINIR":"POR DEFINIR"};
  const tipoTransporte=tipoMap[tipoRaw]||"POR DEFINIR";
  const dupRut=await db.from("clientes").select("id,numero_cliente,nombre").eq("rut_normalizado",rutData.normalized).neq("id",id||"__NUEVO__").limit(1).maybeSingle();
  if(dupRut.error)throw dupRut.error;if(dupRut.data)throw new Error("RUT_YA_ASOCIADO_A_OTRO_CLIENTE");
  if(telefonoNormalizado){const dupTel=await db.from("clientes").select("id,numero_cliente,nombre").eq("telefono_normalizado",telefonoNormalizado).neq("id",id||"__NUEVO__").limit(1).maybeSingle();if(dupTel.error)throw dupTel.error;if(dupTel.data)throw new Error("TELEFONO_YA_ASOCIADO_A_OTRO_CLIENTE");}
  const now=nowIso();
  const patch:any={nombre,rut:rutData.rut,rut_normalizado:rutData.normalized,telefono:telefono||null,telefono_normalizado:telefonoNormalizado||null,email,direccion,comuna,tipo_transporte:tipoTransporte,updated_at:now};
  let client:any;
  if(id){const found=await db.from("clientes").select("id").eq("id",id).maybeSingle();if(found.error)throw found.error;if(!found.data)throw new Error("CLIENTE_NO_ENCONTRADO");const q=await db.from("clientes").update(patch).eq("id",id).select("*").single();if(q.error)throw q.error;client=q.data;await audit(req,ctx,"ACTUALIZAR","CLIENTE",id,{rut:rutData.rut,tipo_transporte:tipoTransporte});}
  else{const row={...patch,origen_primero:"MANUAL",primera_interaccion:now,ultima_interaccion:now,total_solicitudes:0,total_pedidos:0,total_cotizaciones:0,total_comprado:0,activo:true,creado_en:now};const q=await db.from("clientes").insert(row).select("*").single();if(q.error)throw q.error;client=q.data;await audit(req,ctx,"CREAR","CLIENTE",String(client.id),{rut:rutData.rut,tipo_transporte:tipoTransporte});}
  return{ok:true,client};
}

async function bulkImportProducts(req:Request,ctx:SessionCtx,d:Dict){requirePermission(ctx,"products","write");const rows=Array.isArray(d.rows)?d.rows.slice(0,2000):[];if(!rows.length)throw new Error("ARCHIVO_SIN_PRODUCTOS");const existing=await db.from("productos").select("id");if(existing.error)throw existing.error;const ids=new Set((existing.data||[]).map((x:any)=>String(x.id)));const categories=new Map<string,string>();const cq=await db.from("categorias").select("id,nombre");if(cq.error)throw cq.error;for(const c of cq.data||[])categories.set(String(c.nombre).trim().toLowerCase(),String(c.id));let imported=0,created=0,updated=0;const errors:any[]=[];for(let i=0;i<rows.length;i++){try{const d0=rows[i]||{},nombre=clean(d0.nombre,250);if(!nombre)throw new Error("NOMBRE_REQUERIDO");let id=clean(d0.id,100)||randomId("PROD"),categoriaNombre=clean(d0.categoria_nombre||d0.categoria,180),categoriaId:string|null=null;if(categoriaNombre){const k=categoriaNombre.toLowerCase();categoriaId=categories.get(k)||null;if(!categoriaId){const nc={id:randomId("CAT"),nombre:categoriaNombre,descripcion:"",orden:0,activo:true};const ins=await db.from("categorias").insert(nc);if(ins.error)throw ins.error;categoriaId=nc.id;categories.set(k,nc.id);}}const was=ids.has(id);const row={id,nombre,descripcion:clean(d0.descripcion,5000),precio:money(d0.precio),categoria_id:categoriaId,categoria_nombre:categoriaNombre,stock:money(d0.stock),image_url:clean(d0.image_url||d0.imagen_url,2000)||null,destacado:bool(d0.destacado),activo:d0.activo===undefined?true:bool(d0.activo,true),ocasion:clean(d0.ocasion,180),orden:Number(d0.orden||0)||0};const q=await db.from("productos").upsert(row,{onConflict:"id"});if(q.error)throw q.error;ids.add(id);imported++;was?updated++:created++;}catch(e){errors.push({fila:i+2,error:e instanceof Error?e.message:String(e),nombre:clean(rows[i]?.nombre,120)});}}await audit(req,ctx,"IMPORTAR_XLSX","PRODUCTOS","",{filas:rows.length,imported,created,updated,errors:errors.length});return{ok:true,imported,created,updated,errors:errors.slice(0,100)};}


function requestedPublicId(v: unknown, prefix: "PED" | "SOL"): string {
  const s = clean(v, 90).toUpperCase();
  if (new RegExp(`^${prefix}-[A-Z0-9-]{6,80}$`).test(s)) return s;
  return randomId(prefix);
}

async function publicBootstrap() {
  const [p,c,b,cfg] = await Promise.all([
    db.from("productos").select("*").eq("activo", true).order("orden", {ascending:true}).order("nombre", {ascending:true}),
    db.from("categorias").select("*").eq("activo", true).order("orden", {ascending:true}).order("nombre", {ascending:true}),
    db.from("banners").select("*").eq("activo", true).order("orden", {ascending:true}),
    configMap(),
  ]);
  for (const q of [p,c,b]) if ((q as any).error) throw (q as any).error;
  return {
    products:(p.data||[]).map(x=>legacyProduct(x as Dict)),
    categories:(c.data||[]).map(x=>legacyCategory(x as Dict)),
    banners:(b.data||[]).map(x=>legacyBanner(x as Dict)),
    config:{...cfg,transbank_runtime_ready:yesNo(transbankRuntimeInfo(cfg).ready),transbank_environment:transbankRuntimeInfo(cfg).environment},
    version:VERSION,
  };
}


async function issueCheckoutToken(orderId:string):Promise<string>{
  const checkoutToken=randomToken(32),checkoutTokenHash=await sha256Hex(checkoutToken);
  const u=await db.from("pedidos").update({checkout_token_hash:checkoutTokenHash,updated_at:nowIso()}).eq("id",orderId);if(u.error)throw u.error;
  return checkoutToken;
}

async function validatePaymentLinkRow(row:any,token:string,checkExpiry=true){
  if(!row)throw new Error("ENLACE_PAGO_INVALIDO");
  if(row.revocado_en)throw new Error("ENLACE_PAGO_REVOCADO");
  const hash=await sha256Hex(token);if(hash!==String(row.token_hash||""))throw new Error("ENLACE_PAGO_INVALIDO");
  const expiresAt=Date.parse(String(row.expira_en||""));
  if(checkExpiry&&(!Number.isFinite(expiresAt)||expiresAt<=Date.now()))throw new Error("ENLACE_PAGO_VENCIDO");
  return row;
}
async function validateAssignedPaymentLink(orderId:string,linkId:string,token:string,checkExpiry=true){
  if(!orderId||!linkId||!token)throw new Error("ENLACE_PAGO_DATOS_REQUERIDOS");
  const q=await db.from("pedido_enlaces_pago").select("id,pedido_id,token_hash,expira_en,revocado_en,usado_en").eq("id",linkId).eq("pedido_id",orderId).maybeSingle();
  if(q.error)throw q.error;
  return await validatePaymentLinkRow(q.data,token,checkExpiry);
}
async function resolveAssignedPaymentToken(token:string,checkExpiry=true){
  if(!token)throw new Error("ENLACE_PAGO_TOKEN_REQUERIDO");
  const hash=await sha256Hex(token);
  const q=await db.from("pedido_enlaces_pago").select("id,pedido_id,token_hash,expira_en,revocado_en,usado_en").eq("token_hash",hash).limit(1).maybeSingle();
  if(q.error)throw q.error;
  return await validatePaymentLinkRow(q.data,token,checkExpiry);
}
async function hydrateCheckoutCustomer(order:any){
  let client:any=null,quote:any=null,request:any=null;
  if(order?.cliente_id){
    const cq=await db.from("clientes").select("*").eq("id",String(order.cliente_id)).maybeSingle();
    if(!cq.error&&cq.data)client=cq.data;
  }
  if(!client&&order?.rut_normalizado){
    const cq=await db.from("clientes").select("*").eq("rut_normalizado",String(order.rut_normalizado)).order("ultima_interaccion",{ascending:false}).limit(1).maybeSingle();
    if(!cq.error&&cq.data)client=cq.data;
  }
  if(!client&&order?.telefono){
    const phone=normalizePhone(order.telefono);
    if(phone){const cq=await db.from("clientes").select("*").eq("telefono_normalizado",phone).limit(1).maybeSingle();if(!cq.error&&cq.data)client=cq.data;}
  }
  if(order?.cotizacion_id){
    const qq=await db.from("cotizaciones").select("*").eq("id",String(order.cotizacion_id)).maybeSingle();
    if(!qq.error&&qq.data)quote=qq.data;
  }
  const requestId=order?.solicitud_id||quote?.solicitud_id||null;
  if(requestId){
    const rq=await db.from("solicitudes").select("*").eq("id",String(requestId)).maybeSingle();
    if(!rq.error&&rq.data)request=rq.data;
  }
  const merged={
    nombre:clean(order?.nombre||client?.nombre||quote?.cliente_nombre||request?.nombre,180),
    rut:clean(order?.rut||client?.rut||quote?.rut||request?.rut,40),
    telefono:clean(order?.telefono||client?.telefono||quote?.telefono||request?.telefono,80),
    email:clean(order?.email||client?.email||quote?.email||request?.email,250),
    direccion:clean(order?.direccion||client?.direccion||quote?.direccion||request?.direccion,500),
    comuna:clean(order?.comuna||client?.comuna||quote?.comuna||request?.comuna,180),
  };
  const patch:any={};
  for(const k of ["nombre","rut","telefono","email","direccion","comuna"]){if(!clean(order?.[k],500)&&clean((merged as any)[k],500))patch[k]=(merged as any)[k];}
  if(!order?.cliente_id&&client?.id)patch.cliente_id=client.id;
  if(Object.keys(patch).length){patch.updated_at=nowIso();const up=await db.from("pedidos").update(patch).eq("id",String(order.id));if(up.error)console.warn("CHECKOUT_CLIENTE_PERSIST",up.error.message);}
  return merged;
}
async function adminCreateOrder(req:Request,ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"orders","write");
  const quoteId=clean(d.cotizacion_id,100)||null;let quote:any=null;
  if(quoteId){
    const used=await db.from("pedidos").select("id,numero_pedido").eq("cotizacion_id",quoteId).limit(1).maybeSingle();if(used.error)throw used.error;if(used.data)throw new Error("COTIZACION_YA_CONVERTIDA_EN_PEDIDO");
    const q=await db.from("cotizaciones").select("*").eq("id",quoteId).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("COTIZACION_NO_ENCONTRADA");
    quote=q.data;
    if(clean(quote?.pedido_id,120))throw new Error("COTIZACION_YA_CONVERTIDA_EN_PEDIDO");
    if(["ANULADA","RECHAZADA","VENCIDA"].includes(String(quote?.estado||"").toUpperCase()))throw new Error("COTIZACION_NO_VIGENTE");
  }
  const nombre=clean(d.nombre||quote?.cliente_nombre,180),telefono=clean(d.telefono||quote?.telefono,80),email=clean(d.email||quote?.email,250);
  if(!nombre)throw new Error("NOMBRE_REQUERIDO");if(!telefono)throw new Error("TELEFONO_REQUERIDO");
  const rutData=requireValidRut(d.rut||quote?.rut,"RUT_PEDIDO_INVALIDO");
  const medio=clean(d.medio_pago,30).toUpperCase();if(!["EFECTIVO","TRANSFERENCIA","TRANSBANK"].includes(medio))throw new Error("MEDIO_PAGO_INVALIDO");
  const srcItems=Array.isArray(d.detalle)&&d.detalle.length?d.detalle:(Array.isArray(quote?.items)?quote.items:[]);if(!srcItems.length)throw new Error("DETALLE_PEDIDO_INVALIDO");
  const detail:any[]=[];let subtotal=0;
  for(const it of srcItems.slice(0,200)){const nombreItem=clean(it.producto_nombre||it.nombre||it.descripcion,250);const cantidad=Math.max(1,Math.min(999,Math.floor(Number(it.cantidad||1)||1)));const precio=money(it.precio_unitario??it.precio);if(!nombreItem||precio<0)continue;const lineSubtotal=money(cantidad*precio);detail.push({producto_id:clean(it.producto_id||it.id,100)||null,id:clean(it.producto_id||it.id,100)||null,producto_nombre:nombreItem,nombre:nombreItem,cantidad,precio_unitario:precio,precio,subtotal:lineSubtotal});subtotal+=lineSubtotal;}
  if(!detail.length)throw new Error("DETALLE_PEDIDO_INVALIDO");subtotal=money(subtotal);const despacho=money(d.despacho);const total=money(d.total||subtotal+despacho);
  const id=randomId("PED"),customer=await upsertCustomer(req,{...d,nombre,telefono,email,rut:rutData.rut},"PEDIDO",id);
  const pedido:any={id,cliente_id:customer?.id||quote?.cliente_id||null,nombre,rut:rutData.rut,rut_normalizado:rutData.normalized,telefono,email,direccion:clean(d.direccion,500),comuna:clean(d.comuna,180),metodo_entrega:clean(d.metodo_entrega,120)||"COORDINAR",subtotal,despacho,total,observaciones:clean(d.observaciones||quote?.observaciones,3000),origen:"CPANEL",medio_pago:medio,estado_pago:medio==="EFECTIVO"?"PENDIENTE":"INICIADO",cotizacion_id:quoteId,solicitud_id:quote?.solicitud_id||null,created_ip:clientIp(req),user_agent:clean(req.headers.get("user-agent"),1000)};
  const rpc=await db.rpc("ale_crear_pedido_completo",{p_pedido:pedido,p_items:detail});if(rpc.error)throw rpc.error;
  // R9.18.16: persistencia explícita de datos del cliente y coordinación. Algunos RPC históricos
  // no conocían las columnas nuevas y podían conservar el detalle pero omitir datos del cliente.
  const persist=await db.from("pedidos").update({cliente_id:pedido.cliente_id,nombre:pedido.nombre,rut:pedido.rut,rut_normalizado:pedido.rut_normalizado,telefono:pedido.telefono,email:pedido.email||"",direccion:pedido.direccion||"",comuna:pedido.comuna||"",metodo_entrega:pedido.metodo_entrega,subtotal:pedido.subtotal,despacho:pedido.despacho,total:pedido.total,observaciones:pedido.observaciones||null,medio_pago:medio,estado_pago:pedido.estado_pago,cotizacion_id:quoteId,solicitud_id:pedido.solicitud_id,origen:"CPANEL",updated_at:nowIso()}).eq("id",id);if(persist.error)throw persist.error;
  const oq=await db.from("pedidos").select("*").eq("id",id).single();if(oq.error)throw oq.error;const order:any=oq.data;
  const trackingToken=await trackingTokenForOrder(id),trackingHash=await sha256Hex(trackingToken);const trackingUpd=await db.from("pedidos").update({tracking_token_hash:trackingHash,updated_at:nowIso()}).eq("id",id);if(trackingUpd.error)throw trackingUpd.error;
  const cfg=await configMap(),base=trackingBaseUrl(cfg),number=order.numero_pedido||id;
  if(quoteId){
    // Persistir la relación inversa para que el cPanel la retire inmediatamente del selector.
    // La migración R9.18.32 agrega pedido_id; mantenemos fallback para despliegues escalonados.
    const qu=await db.from("cotizaciones").update({estado:"ACEPTADA",pedido_id:id,cotizacion_consumida_en:nowIso(),updated_at:nowIso()}).eq("id",quoteId).in("estado",["BORRADOR","ENVIADA","ACEPTADA"]);
    if(qu.error){const fb=await db.from("cotizaciones").update({estado:"ACEPTADA",updated_at:nowIso()}).eq("id",quoteId).in("estado",["BORRADOR","ENVIADA","ACEPTADA"]);if(fb.error)throw fb.error;}
  }
  deferTask(appendOrderHistory(id,"PEDIDO_CREADO_CPANEL",String(order.estado||"PENDIENTE"),pedido.estado_pago,quoteId?"Pedido creado desde cotización en cPanel":"Pedido creado manualmente desde cPanel",String(ctx.user.id||"")||null));
  deferTask(audit(req,ctx,"CREAR_CPANEL","PEDIDO",id,{numero_pedido:number,medio_pago:medio,cotizacion_id:quoteId,total}));
  return{ok:true,order:{...order,medio_pago:medio,estado_pago:pedido.estado_pago,cotizacion_id:quoteId},payment_link_required:medio==="TRANSBANK",tracking_url:`${base}#seguimiento/${encodeURIComponent(number)}?t=${encodeURIComponent(trackingToken)}`};
}
async function publicOrderCheckout(d:Dict){
  const paymentToken=clean(d.payment_token||d.pt,300);
  let orderId=clean(d.order_id||d.oid,100),token=clean(d.checkout_token||d.ct,300),linkId=clean(d.payment_link_id||d.pl,100);
  if(paymentToken){
    const resolved:any=await resolveAssignedPaymentToken(paymentToken,true);
    orderId=String(resolved.pedido_id||"");linkId=String(resolved.id||"");token=paymentToken;
  }
  if(!orderId||!token)throw new Error("PEDIDO_TOKEN_CHECKOUT_REQUERIDO");
  const q=await db.from("pedidos").select("*").eq("id",orderId).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("PEDIDO_NO_ENCONTRADO");const o:any=q.data;
  if(orderStatusFinal(o.estado))throw new Error("PEDIDO_ESTADO_FINAL");
  if(String(o.estado_pago||"").toUpperCase()==="PAGADO")throw new Error("PEDIDO_YA_PAGADO");
  if(linkId)await validateAssignedPaymentLink(orderId,linkId,token,true);
  else if(!o.checkout_token_hash||(await sha256Hex(token))!==String(o.checkout_token_hash))throw new Error("TOKEN_CHECKOUT_INVALIDO");
  const customer=await hydrateCheckoutCustomer(o);
  const items=await loadOrderItems(o);
  const paymentMethod=await resolveOrderPaymentMethod(o);
  return{ok:true,order_id:o.id,payment_link_id:linkId||null,checkout_token:token,order:{id:o.id,numero_pedido:o.numero_pedido||o.id,nombre:customer.nombre,rut:customer.rut,telefono:customer.telefono,email:customer.email,direccion:customer.direccion,comuna:customer.comuna,metodo_entrega:o.metodo_entrega,observaciones:o.observaciones,total:o.total,subtotal:o.subtotal,despacho:o.despacho,estado:o.estado,estado_pago:o.estado_pago,medio_pago:paymentMethod||o.medio_pago||""},items};
}
function b64Bytes(v:unknown):Uint8Array{let s=String(v??"");const bin=atob(s);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
async function uploadTransferProof(req:Request,d:Dict){
  const orderId=clean(d.order_id||d.id,100),trackingToken=clean(d.tracking_token,300),dataUrl=String(d.data_url||d.dataUrl||"");if(!orderId||!trackingToken)throw new Error("PEDIDO_TOKEN_SEGUIMIENTO_REQUERIDO");
  const oq=await db.from("pedidos").select("*").eq("id",orderId).maybeSingle();if(oq.error)throw oq.error;if(!oq.data)throw new Error("PEDIDO_NO_ENCONTRADO");const o:any=oq.data;
  if(!o.tracking_token_hash||(await sha256Hex(trackingToken))!==String(o.tracking_token_hash))throw new Error("TOKEN_SEGUIMIENTO_INVALIDO");if(orderStatusFinal(o.estado))throw new Error("PEDIDO_ESTADO_FINAL");if((await resolveOrderPaymentMethod(o))!=="TRANSFERENCIA")throw new Error("PEDIDO_NO_ES_TRANSFERENCIA");
  const m=dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);if(!m)throw new Error("COMPROBANTE_IMAGEN_INVALIDA");const bytes=b64Bytes(m[2]);if(bytes.length>8_000_000)throw new Error("COMPROBANTE_DEMASIADO_GRANDE");const ext=m[1].toLowerCase().includes("png")?"png":m[1].toLowerCase().includes("webp")?"webp":"jpg";const path=`pedidos/comprobantes/${sanitizeFileName(o.numero_pedido||orderId)}-${Date.now()}.${ext}`;
  const up=await db.storage.from(BUCKET).upload(path,bytes,{contentType:m[1],upsert:false});if(up.error)throw up.error;const url=db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const upd=await db.from("pedidos").update({medio_pago:"TRANSFERENCIA",comprobante_pago_url:url,comprobante_pago_path:path,comprobante_pago_estado:"PENDIENTE_REVISION",comprobante_pago_fecha:nowIso(),estado_pago:"INICIADO",updated_at:nowIso()}).eq("id",orderId);if(upd.error)throw upd.error;
  deferTask(appendOrderHistory(orderId,"COMPROBANTE_TRANSFERENCIA","",String(o.estado_pago||"INICIADO"),"Cliente adjuntó comprobante de transferencia para revisión",null));deferTask(audit(req,null,"COMPROBANTE_TRANSFERENCIA","PEDIDO",orderId,{path}));return{ok:true,url,status:"PENDIENTE_REVISION"};
}

async function adminOrderPaymentLink(ctx:SessionCtx,d:Dict){
  requirePermission(ctx,"orders","write");
  const id=clean(d.id||d.order_id,100),expiresRaw=clean(d.expires_at,100);if(!id)throw new Error("PEDIDO_REQUERIDO");if(!expiresRaw)throw new Error("VIGENCIA_ENLACE_REQUERIDA");
  const expires=new Date(expiresRaw);if(!Number.isFinite(expires.getTime())||expires.getTime()<=Date.now()+60_000)throw new Error("VIGENCIA_ENLACE_INVALIDA");
  const q=await db.from("pedidos").select("id,numero_pedido,medio_pago,estado_pago,estado").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("PEDIDO_NO_ENCONTRADO");
  if(orderStatusFinal((q.data as any).estado))throw new Error("PEDIDO_ESTADO_FINAL");if(String(q.data.medio_pago||"").toUpperCase()!=="TRANSBANK")throw new Error("PEDIDO_NO_ES_TRANSBANK");if(String(q.data.estado_pago||"").toUpperCase()==="PAGADO")throw new Error("PEDIDO_YA_PAGADO");
  const rawToken=randomToken(32),tokenHash=await sha256Hex(rawToken),linkId=randomId("PAYL");
  // Un pedido mantiene un único enlace de cobro activo. Al asignar uno nuevo, los anteriores quedan revocados.
  const revoke=await db.from("pedido_enlaces_pago").update({revocado_en:nowIso()}).eq("pedido_id",id).is("revocado_en",null);if(revoke.error)throw revoke.error;
  const ins=await db.from("pedido_enlaces_pago").insert({id:linkId,pedido_id:id,token_hash:tokenHash,expira_en:expires.toISOString(),creado_por:String(ctx.user.id||"")||null});if(ins.error)throw ins.error;
  const cfg=await configMap(),number=q.data.numero_pedido||id,paymentUrl=`${trackingBaseUrl(cfg)}#pago/${encodeURIComponent(number)}/${encodeURIComponent(rawToken)}`;
  deferTask(appendOrderHistory(id,"ENLACE_PAGO_ASIGNADO","",String(q.data.estado_pago||"INICIADO"),`Enlace de pago asignado con vigencia hasta ${expires.toISOString()}`,String(ctx.user.id||"")||null));
  return{ok:true,payment_url:paymentUrl,payment_link_id:linkId,checkout_token:rawToken,numero_pedido:number,expires_at:expires.toISOString()};
}


async function closeRequestForPaidOrder(orderId:string){
  if(!orderId)return;
  const oq=await db.from("pedidos").select("id,solicitud_id,cotizacion_id,estado_pago").eq("id",orderId).maybeSingle();
  if(oq.error||!oq.data)return;
  if(String((oq.data as any).estado_pago||"").toUpperCase()!=="PAGADO")return;
  let requestId=clean((oq.data as any).solicitud_id,100);
  if(!requestId&&(oq.data as any).cotizacion_id){const cq=await db.from("cotizaciones").select("solicitud_id").eq("id",String((oq.data as any).cotizacion_id)).maybeSingle();if(!cq.error&&cq.data)requestId=clean((cq.data as any).solicitud_id,100);}
  if(!requestId)return;
  const rq=await db.from("solicitudes").select("id,estado").eq("id",requestId).maybeSingle();if(rq.error||!rq.data)return;
  if(String((rq.data as any).estado||"").toUpperCase()==="CERRADA")return;
  const u=await db.from("solicitudes").update({estado:"CERRADA"}).eq("id",requestId);if(u.error)throw u.error;
}
async function adminVerifyTransfer(req:Request,ctx:SessionCtx,d:Dict){requirePermission(ctx,"orders","write");const id=clean(d.id||d.order_id,100);if(!id)throw new Error("PEDIDO_REQUERIDO");const q=await db.from("pedidos").select("*").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("PEDIDO_NO_ENCONTRADO");const o:any=q.data;if(orderStatusFinal(o.estado))throw new Error("PEDIDO_ESTADO_FINAL");if((await resolveOrderPaymentMethod(o))!=="TRANSFERENCIA")throw new Error("PEDIDO_NO_ES_TRANSFERENCIA");if(!o.comprobante_pago_url)throw new Error("COMPROBANTE_NO_DISPONIBLE");const u=await db.from("pedidos").update({medio_pago:"TRANSFERENCIA",estado_pago:"PAGADO",estado:"CONFIRMADO",fecha_pago:nowIso(),comprobante_pago_estado:"APROBADO",comprobante_pago_revisado_por:ctx.user.id,comprobante_pago_revisado_en:nowIso(),updated_at:nowIso()}).eq("id",id);if(u.error)throw u.error;await closeRequestForPaidOrder(id);deferTask(appendOrderHistory(id,"PAGO_TRANSFERENCIA_APROBADO","CONFIRMADO","PAGADO","Comprobante verificado y pago aprobado",String(ctx.user.id)));deferTask(refreshOrderPdfSnapshot(id));await audit(req,ctx,"APROBAR_TRANSFERENCIA","PEDIDO",id,{});return{ok:true,estado:"CONFIRMADO",estado_pago:"PAGADO"};}

async function createPublicOrder(req: Request, d: Dict) {
  const nombre=clean(d.nombre,180), telefono=clean(d.telefono,80);
  if(!nombre) throw new Error("NOMBRE_REQUERIDO");
  if(!telefono) throw new Error("TELEFONO_REQUERIDO");
  const rutData=requireValidRut(d.rut,"RUT_PEDIDO_INVALIDO");
  const id=requestedPublicId(d.id,"PED");
  const medio=canonicalPaymentMethod(d.medio_pago||d.metodo_pago||d.payment_method)||"TRANSFERENCIA";
  if(!["EFECTIVO","TRANSFERENCIA","TRANSBANK"].includes(medio))throw new Error("MEDIO_PAGO_INVALIDO");
  const rawDetail=Array.isArray(d.detalle)?d.detalle.slice(0,200):[];
  if(!rawDetail.length) throw new Error("DETALLE_PEDIDO_INVALIDO");
  const productIds=[...new Set(rawDetail.map((x:any)=>clean(x?.id,100)).filter(Boolean))];
  if(!productIds.length) throw new Error("DETALLE_PEDIDO_INVALIDO");
  const pq=await db.from("productos").select("id,nombre,precio,activo").in("id",productIds);
  if(pq.error) throw pq.error;
  const productMap=new Map((pq.data||[]).map((x:any)=>[String(x.id),x]));
  const detail:any[]=[];
  let subtotal=0;
  for(const item of rawDetail){
    const productId=clean(item?.id,100);
    const product:any=productMap.get(productId);
    if(!product || !bool(product.activo,false)) throw new Error(`PRODUCTO_NO_DISPONIBLE:${productId||"SIN_ID"}`);
    const qtyRaw=Number(item?.cantidad??item?.qty??1);
    const cantidad=Number.isFinite(qtyRaw)?Math.max(1,Math.min(999,Math.floor(qtyRaw))):1;
    const precio=money(product.precio);
    const lineSubtotal=money(precio*cantidad);
    detail.push({producto_id:productId,id:productId,producto_nombre:clean(product.nombre,250),nombre:clean(product.nombre,250),cantidad,precio_unitario:precio,precio,subtotal:lineSubtotal});
    subtotal+=lineSubtotal;
  }
  subtotal=money(subtotal);
  const despacho=money(d.despacho);
  const total=money(subtotal+despacho);
  const customer=await upsertCustomer(req,{...d,rut:rutData.rut},"PEDIDO",id);
  const pedido={
    id,cliente_id:customer?.id||null,nombre,rut:rutData.rut,rut_normalizado:rutData.normalized,telefono,email:clean(d.email,250),direccion:clean(d.direccion,500),comuna:clean(d.comuna,180),
    metodo_entrega:clean(d.metodo_entrega,120),subtotal,despacho,total,observaciones:clean(d.observaciones,3000),
    origen:"WEB",medio_pago:medio,estado_pago:medio==="EFECTIVO"?"PENDIENTE":"INICIADO",
    created_ip:clientIp(req),user_agent:clean(req.headers.get("user-agent"),1000)
  };
  const rpc=await db.rpc("ale_crear_pedido_completo",{p_pedido:pedido,p_items:detail});
  if(rpc.error)throw rpc.error;
  const result:any=rpc.data||{};
  let orderQ=await db.from("pedidos").select("*").eq("id",id).single();if(orderQ.error)throw orderQ.error;
  let order:any=orderQ.data;
  if(result.duplicated){const sameRut=normalizeRut(order.rut||order.rut_normalizado)===rutData.normalized;const samePhone=normalizePhone(order.telefono)===normalizePhone(telefono);if(!sameRut||!samePhone)throw new Error("PEDIDO_ID_EN_CONFLICTO");}
  if(!result.duplicated||!canonicalPaymentMethod(order.medio_pago)){
    const persist=await db.from("pedidos").update({origen:"WEB",medio_pago:medio,estado_pago:clean(order.estado_pago,40)||pedido.estado_pago,updated_at:nowIso()}).eq("id",id);if(persist.error)throw persist.error;
    orderQ=await db.from("pedidos").select("*").eq("id",id).single();if(orderQ.error)throw orderQ.error;order=orderQ.data;
  }
  const checkoutToken=randomToken(32);
  const checkoutTokenHash=await sha256Hex(checkoutToken);
  const trackingToken=await trackingTokenForOrder(id);
  const trackingTokenHash=await sha256Hex(trackingToken);
  const tokenUpd=await db.from("pedidos").update({checkout_token_hash:checkoutTokenHash,tracking_token_hash:trackingTokenHash,updated_at:nowIso()}).eq("id",id);if(tokenUpd.error)throw tokenUpd.error;
  let pdfUrl=clean(order.pdf_url,2000), pdfPending=false, pdfError="";
  if(!pdfUrl){
    try{
      const cfg=await configMap();
      const generated=await persistOrderPdf(order,detail,cfg,null);
      pdfUrl=generated.pdfUrl;
      order.pdf_url=pdfUrl;order.pdf_bucket=BUCKET;order.pdf_path=generated.storagePath;
    }catch(err){
      pdfPending=true;pdfError=err instanceof Error?err.message:String(err);console.error("PEDIDO_PDF",pdfError);
    }
  }
  if(customer?.id)deferTask(refreshCustomerStats(String(customer.id)));
  deferTask(appendOrderHistory(id,"PEDIDO_CREADO",String(order.estado||"PENDIENTE"),String(order.estado_pago||"PENDIENTE"),"Pedido recibido desde la Web",null));
  deferTask(audit(req,null,"CREAR","PEDIDO",id,{nombre,rut:rutData.rut,publico:true,numero_pedido:order.numero_pedido||result.numero_pedido||"",cliente_id:customer?.id||null,items:detail.length,pdf:!!pdfUrl,medio_pago:medio}));
  const cfg=await configMap();const number=order.numero_pedido||result.numero_pedido||id;
  return {ok:true,id,numero_pedido:number,duplicated:!!result.duplicated,persisted:true,cliente_id:customer?.id||null,pdf_url:pdfUrl,pdf_pending:pdfPending,pdf_error:pdfError||undefined,total,checkout_token:checkoutToken,tracking_token:trackingToken,tracking_url:`${trackingBaseUrl(cfg)}#seguimiento/${encodeURIComponent(number)}?t=${encodeURIComponent(trackingToken)}`};
}

async function transbankCreatePayment(req:Request,d:Dict){
  const orderId=clean(d.order_id||d.id,100),checkoutToken=clean(d.checkout_token,300),paymentLinkId=clean(d.payment_link_id||d.pl,100);
  if(!orderId||!checkoutToken)throw new Error("TRANSBANK_PEDIDO_TOKEN_REQUERIDO");
  const oq=await db.from("pedidos").select("id,numero_pedido,total,checkout_token_hash,estado_pago,medio_pago,estado").eq("id",orderId).maybeSingle();
  if(oq.error)throw oq.error;if(!oq.data)throw new Error("PEDIDO_NO_ENCONTRADO");const order:any=oq.data;
  if(paymentLinkId)await validateAssignedPaymentLink(orderId,paymentLinkId,checkoutToken,true);
  else{const tokenHash=await sha256Hex(checkoutToken);if(!order.checkout_token_hash||tokenHash!==String(order.checkout_token_hash))throw new Error("TRANSBANK_TOKEN_PEDIDO_INVALIDO");}
  const cfg=await configMap();const runtime=transbankRuntimeInfo(cfg);if(!runtime.ready)throw new Error(runtime.credentialsReady?"TRANSBANK_URL_RETORNO_PENDIENTE":"TRANSBANK_CREDENCIALES_SERVIDOR_PENDIENTES");
  if(orderStatusFinal(order.estado))throw new Error("PEDIDO_ESTADO_FINAL");if(String(order.estado_pago||"").toUpperCase()==="PAGADO")throw new Error("PEDIDO_YA_PAGADO");
  if(String(order.estado_pago||"").toUpperCase()==="VERIFICACION_PENDIENTE")throw new Error("TRANSBANK_PAGO_EN_VERIFICACION");
  const amount=Math.round(money(order.total||0));if(!Number.isFinite(amount)||amount<=0)throw new Error("TRANSBANK_MONTO_INVALIDO");
  // R9.18.1: un reintento nunca reutiliza un token_ws que ya pudo haber sido presentado a Webpay.
  // Antes de crear un nuevo intento verificamos el estado remoto del intento anterior para evitar doble cobro.
  const recent=await db.from("pagos_transbank").select("*").eq("pedido_id",orderId).eq("estado","INICIALIZADO").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(!recent.error&&recent.data?.token_ws){
    const previous:any=recent.data;
    const previousEnv:String=String(previous.ambiente||runtime.environment).toUpperCase();
    const prevEnv=previousEnv==="PRODUCTION"?"PRODUCTION":"INTEGRATION";
    try{
      const prev=await transbankRemoteStatus(String(previous.token_ws),prevEnv);
      const validOrder=String(prev.buy_order||"")===String(previous.buy_order||"");
      const validSession=String(prev.session_id||"")===String(previous.session_id||"");
      const validAmount=money(prev.amount)===money(previous.monto);
      const alreadyPaid=paymentStatusFromCommit(prev)==="PAGADO"&&validOrder&&validSession&&validAmount;
      if(alreadyPaid){
        await db.from("pagos_transbank").update({estado:"PAGADO",response_code:prev.response_code??null,authorization_code:clean(prev.authorization_code,120)||null,payment_type_code:clean(prev.payment_type_code,40)||null,installments_number:Number(prev.installments_number||0)||0,card_last4:clean(prev.card_detail?.card_number,20)||null,accounting_date:clean(prev.accounting_date,20)||null,transaction_date:prev.transaction_date||null,respuesta_json:prev,error_detalle:null,updated_at:nowIso(),committed_at:nowIso()}).eq("id",previous.id);
        await db.from("pedidos").update({estado_pago:"PAGADO",medio_pago:"TRANSBANK",fecha_pago:prev.transaction_date||nowIso(),updated_at:nowIso()}).eq("id",orderId);
        await closeRequestForPaidOrder(orderId);
        deferTask(appendOrderHistory(orderId,"PAGO_CONFIRMADO","","PAGADO","Pago confirmado por Transbank",null));
        deferTask(refreshOrderPdfSnapshot(orderId));
        deferTask(audit(req,null,"TRANSBANK_REINTENTO_BLOQUEADO_PAGO_EXISTENTE","PAGO",String(previous.id),{pedido_id:orderId,buy_order:previous.buy_order,response_code:prev.response_code,status:prev.status}));
        throw new Error("PEDIDO_YA_PAGADO");
      }
      await db.from("pagos_transbank").update({estado:"REINTENTO_REEMPLAZADO",response_code:prev.response_code??null,respuesta_json:prev,error_detalle:`REINTENTO_NUEVO_DESDE_${clean(prev.status,80)||"ESTADO_DESCONOCIDO"}`,updated_at:nowIso()}).eq("id",previous.id);
      deferTask(audit(req,null,"TRANSBANK_REINTENTO_NUEVO","PAGO",String(previous.id),{pedido_id:orderId,buy_order_anterior:previous.buy_order,status_anterior:prev.status||"",response_code:prev.response_code??null}));
    }catch(statusErr){
      if(statusErr instanceof Error&&statusErr.message==="PEDIDO_YA_PAGADO")throw statusErr;
      // Si no podemos comprobar el intento anterior, bloqueamos un nuevo cobro hasta verificarlo.
      await db.from("pagos_transbank").update({estado:"COMMIT_PENDIENTE",error_detalle:`STATUS_PREVIO_REINTENTO:${clean(statusErr instanceof Error?statusErr.message:String(statusErr),800)}`,updated_at:nowIso()}).eq("id",previous.id);
      await db.from("pedidos").update({estado_pago:"VERIFICACION_PENDIENTE",medio_pago:"TRANSBANK",updated_at:nowIso()}).eq("id",orderId);
      deferTask(audit(req,null,"TRANSBANK_REINTENTO_VERIFICACION","PAGO",String(previous.id),{pedido_id:orderId,buy_order:previous.buy_order,error:clean(statusErr instanceof Error?statusErr.message:String(statusErr),500)}));
      throw new Error("TRANSBANK_PAGO_EN_VERIFICACION");
    }
  }
  const paymentId=randomId("TBK"),buyOrder=transbankBuyOrder(),sessionId=transbankSessionId(orderId);
  const ins=await db.from("pagos_transbank").insert({id:paymentId,pedido_id:orderId,buy_order:buyOrder,session_id:sessionId,monto:amount,estado:"CREANDO",ambiente:runtime.environment,return_url_final:runtime.returnUrl});if(ins.error)throw ins.error;
  try{
    const created=await transbankRemoteCreate(req,runtime.environment,buyOrder,sessionId,amount,paymentId,orderId);const token=clean(created.token,100),url=safeHttps(created.url);if(!token||!url)throw new Error("TRANSBANK_RESPUESTA_CREATE_INVALIDA");
    const upd=await db.from("pagos_transbank").update({token_ws:token,webpay_url:url,estado:"INICIALIZADO",updated_at:nowIso()}).eq("id",paymentId);if(upd.error)throw upd.error;
    await db.from("pedidos").update({estado_pago:"INICIADO",medio_pago:"TRANSBANK",updated_at:nowIso()}).eq("id",orderId);
    if(paymentLinkId)deferTask((async()=>{try{await db.from("pedido_enlaces_pago").update({usado_en:nowIso()}).eq("id",paymentLinkId);}catch(_){}})());
    deferTask(audit(req,null,"TRANSBANK_CREATE","PAGO",paymentId,{pedido_id:orderId,buy_order:buyOrder,monto:amount,moneda:"CLP",ambiente:runtime.environment}));
    return{ok:true,token,url,buy_order:buyOrder,environment:runtime.environment,amount,currency:"CLP"};
  }catch(err){await db.from("pagos_transbank").update({estado:"ERROR_CREATE",error_detalle:clean(err instanceof Error?err.message:String(err),1000),updated_at:nowIso()}).eq("id",paymentId);throw err;}
}
async function transbankPublicStatus(d:Dict){
  const orderId=clean(d.order_id||d.id,100),checkoutToken=clean(d.checkout_token,300),paymentLinkId=clean(d.payment_link_id||d.pl,100);if(!orderId||!checkoutToken)throw new Error("TRANSBANK_PEDIDO_TOKEN_REQUERIDO");
  const oq=await db.from("pedidos").select("id,numero_pedido,estado_pago,medio_pago,checkout_token_hash,fecha_pago").eq("id",orderId).maybeSingle();if(oq.error)throw oq.error;if(!oq.data)throw new Error("PEDIDO_NO_ENCONTRADO");
  if(paymentLinkId)await validateAssignedPaymentLink(orderId,paymentLinkId,checkoutToken,false);else{const hash=await sha256Hex(checkoutToken);if(hash!==String((oq.data as any).checkout_token_hash||""))throw new Error("TRANSBANK_TOKEN_PEDIDO_INVALIDO");}
  return{ok:true,id:oq.data.id,numero_pedido:(oq.data as any).numero_pedido||"",estado_pago:(oq.data as any).estado_pago||"PENDIENTE",medio_pago:(oq.data as any).medio_pago||"",fecha_pago:(oq.data as any).fecha_pago||""};
}
async function transbankHealth(ctx:SessionCtx){
  requirePermission(ctx,"settings","read");const cfg=await configMap();const r=transbankRuntimeInfo(cfg);return{ok:true,environment:r.environment,ready:r.ready,url_ready:r.urlReady,checkout_url_ready:r.checkoutUrlReady,credentials_ready:r.credentialsReady,checkout_url:r.checkoutUrl||"",return_url:r.returnUrl||"",manual_payment_url:transbankManualPaymentUrl(cfg.transbank_payment_url),manual_payment_configured:!!transbankManualPaymentUrl(cfg.transbank_payment_url),callback_url:transbankEdgeReturnUrl(),commerce_code_configured:!!r.commerceCode};
}
async function transbankReturnParams(req:Request):Promise<URLSearchParams>{
  const u=new URL(req.url);
  const params=new URLSearchParams(u.search);
  if(req.method!=="GET"&&req.method!=="HEAD"){
    try{
      const form=await req.clone().formData();
      for(const [k,v] of form.entries())if(typeof v==="string")params.set(k,v);
    }catch(_){
      try{
        const text=await req.clone().text();
        const bodyParams=new URLSearchParams(text);
        for(const [k,v] of bodyParams.entries())params.set(k,v);
      }catch(__){}
    }
  }
  return params;
}

async function transbankResolvePaymentByReturn(token:string,paymentId:string){
  if(token){
    const byToken=await db.from("pagos_transbank").select("*,pedidos(numero_pedido,total)").eq("token_ws",token).limit(1).maybeSingle();
    if(byToken.error)throw byToken.error;
    if(byToken.data)return byToken.data as any;
  }
  if(paymentId){
    const byId=await db.from("pagos_transbank").select("*,pedidos(numero_pedido,total)").eq("id",paymentId).limit(1).maybeSingle();
    if(byId.error)throw byId.error;
    if(byId.data){
      const stored=clean((byId.data as any).token_ws,256);
      if(token&&stored&&token!==stored){
        await db.from("pagos_transbank").update({error_detalle:"TOKEN_RETORNO_NO_COINCIDE",updated_at:nowIso()}).eq("id",paymentId);
        return null;
      }
      return byId.data as any;
    }
  }
  return null;
}

async function transbankFinalizePayment(req:Request,payment:any,token:string):Promise<{status:string,resp?:Dict,paid:boolean}>{
  if(!payment)throw new Error("TRANSBANK_PAGO_NO_ENCONTRADO");
  if(payment.estado==="PAGADO")return{status:"PAGADO",paid:true};
  const environment:String=String(payment.ambiente||"INTEGRATION").toUpperCase();
  const env=environment==="PRODUCTION"?"PRODUCTION":"INTEGRATION";
  let resp:Dict;
  try{resp=await transbankRemoteCommit(token,env);}catch(commitErr){
    try{resp=await transbankRemoteStatus(token,env);}catch(_){throw commitErr;}
  }
  const validOrder=String(resp.buy_order||"")===String(payment.buy_order||"");
  const validSession=String(resp.session_id||"")===String(payment.session_id||"");
  const validAmount=money(resp.amount)===money(payment.monto);
  const tbStatus=String(resp.status||"").toUpperCase();
  const authorized=tbStatus==="AUTHORIZED"&&Number(resp.response_code)===0;
  const paid=authorized&&validOrder&&validSession&&validAmount;
  let finalStatus="VERIFICACION_PENDIENTE";
  if(paid)finalStatus="PAGADO";
  else if(["FAILED","REVERSED","NULLIFIED","PARTIALLY_NULLIFIED"].includes(tbStatus)||Number(resp.response_code)<0)finalStatus="RECHAZADO";
  else if(tbStatus==="INITIALIZED")finalStatus="INICIADO";
  const update:any={estado:finalStatus,response_code:resp.response_code??null,authorization_code:clean(resp.authorization_code,120)||null,payment_type_code:clean(resp.payment_type_code,40)||null,installments_number:Number(resp.installments_number||0)||0,card_last4:clean(resp.card_detail?.card_number,20)||null,accounting_date:clean(resp.accounting_date,20)||null,transaction_date:resp.transaction_date||null,respuesta_json:resp,error_detalle:paid?null:(!validOrder?"BUY_ORDER_NO_COINCIDE":!validSession?"SESSION_ID_NO_COINCIDE":!validAmount?"MONTO_NO_COINCIDE":`RESPUESTA_${clean(tbStatus,80)}`),updated_at:nowIso()};
  if(finalStatus==="PAGADO"||finalStatus==="RECHAZADO")update.committed_at=nowIso();
  await db.from("pagos_transbank").update(update).eq("id",payment.id);
  const orderState=finalStatus==="PAGADO"?"PAGADO":finalStatus==="RECHAZADO"?"RECHAZADO":finalStatus==="INICIADO"?"INICIADO":"VERIFICACION_PENDIENTE";
  await db.from("pedidos").update({estado_pago:orderState,medio_pago:"TRANSBANK",fecha_pago:paid?(resp.transaction_date||nowIso()):null,updated_at:nowIso()}).eq("id",payment.pedido_id);
  if(paid){await closeRequestForPaidOrder(String(payment.pedido_id));deferTask(appendOrderHistory(String(payment.pedido_id),"PAGO_CONFIRMADO","",orderState,"Pago confirmado por Transbank",null));deferTask(refreshOrderPdfSnapshot(String(payment.pedido_id)));}
  else if(finalStatus==="RECHAZADO")deferTask(appendOrderHistory(String(payment.pedido_id),"PAGO_RECHAZADO","",orderState,"Pago rechazado por Transbank",null));
  deferTask(audit(req,null,paid?"TRANSBANK_PAGADO":finalStatus==="RECHAZADO"?"TRANSBANK_RECHAZADO":"TRANSBANK_VERIFICACION","PAGO",String(payment.id),{pedido_id:payment.pedido_id,buy_order:payment.buy_order,response_code:resp.response_code,status:resp.status,validOrder,validSession,validAmount}));
  return{status:finalStatus,resp,paid};
}

async function transbankRecoverPayment(req:Request,d:Dict){
  const orderId=clean(d.order_id||d.id,100),checkoutToken=clean(d.checkout_token,300),paymentLinkId=clean(d.payment_link_id||d.pl,100);
  if(!orderId||!checkoutToken)throw new Error("TRANSBANK_PEDIDO_TOKEN_REQUERIDO");
  const oq=await db.from("pedidos").select("id,numero_pedido,estado_pago,checkout_token_hash,fecha_pago").eq("id",orderId).maybeSingle();
  if(oq.error)throw oq.error;if(!oq.data)throw new Error("PEDIDO_NO_ENCONTRADO");
  if(paymentLinkId)await validateAssignedPaymentLink(orderId,paymentLinkId,checkoutToken,false);else{const hash=await sha256Hex(checkoutToken);if(hash!==String((oq.data as any).checkout_token_hash||""))throw new Error("TRANSBANK_TOKEN_PEDIDO_INVALIDO");}
  if(String((oq.data as any).estado_pago||"").toUpperCase()==="PAGADO")return{ok:true,estado_pago:"PAGADO",numero_pedido:(oq.data as any).numero_pedido||"",recovered:false};
  const pq=await db.from("pagos_transbank").select("*,pedidos(numero_pedido,total)").eq("pedido_id",orderId).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(pq.error)throw pq.error;if(!pq.data)throw new Error("TRANSBANK_INTENTO_NO_ENCONTRADO");
  const payment:any=pq.data;const token=clean(payment.token_ws,256);if(!token)throw new Error("TRANSBANK_TOKEN_NO_DISPONIBLE");
  try{
    const out=await transbankFinalizePayment(req,payment,token);
    return{ok:true,estado_pago:out.status,numero_pedido:(oq.data as any).numero_pedido||"",recovered:true};
  }catch(err){
    await db.from("pagos_transbank").update({estado:"COMMIT_PENDIENTE",error_detalle:`RECUPERACION:${clean(err instanceof Error?err.message:String(err),800)}`,updated_at:nowIso()}).eq("id",payment.id);
    await db.from("pedidos").update({estado_pago:"VERIFICACION_PENDIENTE",medio_pago:"TRANSBANK",updated_at:nowIso()}).eq("id",orderId);
    return{ok:true,estado_pago:"VERIFICACION_PENDIENTE",numero_pedido:(oq.data as any).numero_pedido||"",recovered:false};
  }
}

async function transbankReturn(req:Request):Promise<Response>{
  const cfg=await configMap();const runtime=transbankRuntimeInfo(cfg);const fallback=runtime.returnUrl;
  const params=await transbankReturnParams(req);
  const token=clean(params.get("token_ws"),256);const abortToken=clean(params.get("TBK_TOKEN"),256);const session=clean(params.get("TBK_ID_SESION"),120);const buyOrderForm=clean(params.get("TBK_ORDEN_COMPRA"),120);const paymentId=clean(params.get("tbk_pid"),100);
  if(!token){
    let q:any=null;
    if(paymentId){const r=await db.from("pagos_transbank").select("*,pedidos(numero_pedido)").eq("id",paymentId).limit(1).maybeSingle();if(r.error)throw r.error;q=r.data;}
    if(!q&&session){const r=await db.from("pagos_transbank").select("*,pedidos(numero_pedido)").eq("session_id",session).order("created_at",{ascending:false}).limit(1).maybeSingle();if(r.error)throw r.error;q=r.data;}
    if(!q&&buyOrderForm){const r=await db.from("pagos_transbank").select("*,pedidos(numero_pedido)").eq("buy_order",buyOrderForm).order("created_at",{ascending:false}).limit(1).maybeSingle();if(r.error)throw r.error;q=r.data;}
    if(q){
      const reason=abortToken?"TBK_TOKEN_RETORNO_CANCELADO":req.method==="GET"?"RETORNO_GET_SIN_TOKEN_WS":"RETORNO_SIN_TOKEN_WS";
      const state=abortToken||session||buyOrderForm?"CANCELADO":"VERIFICACION_PENDIENTE";
      await db.from("pagos_transbank").update({estado:state,error_detalle:reason,updated_at:nowIso()}).eq("id",q.id);
      const orderPayState=state==="CANCELADO"?"CANCELADO":"VERIFICACION_PENDIENTE";
      await db.from("pedidos").update({estado_pago:orderPayState,medio_pago:"TRANSBANK",updated_at:nowIso()}).eq("id",q.pedido_id);
      deferTask(appendOrderHistory(String(q.pedido_id),state==="CANCELADO"?"PAGO_CANCELADO":"PAGO_VERIFICACION_PENDIENTE","",orderPayState,state==="CANCELADO"?"Pago cancelado antes de la confirmación":"Pago pendiente de verificación automática",null));
      const target=safeHttps(q.return_url_final)||runtime.returnUrl;
      return target?redirect303(buildFinalReturnUrl(target,state==="CANCELADO"?"cancelled":"pending",q.pedidos?.numero_pedido||"")):json(req,{ok:true,status:state,order:q.pedidos?.numero_pedido||""});
    }
    return fallback?redirect303(buildFinalReturnUrl(fallback,"invalid","")):json(req,{ok:false,error:"TRANSBANK_RETORNO_SIN_IDENTIFICADOR"},400);
  }
  const payment:any=await transbankResolvePaymentByReturn(token,paymentId);
  if(!payment)return fallback?redirect303(buildFinalReturnUrl(fallback,"invalid","")):json(req,{ok:false,error:"TRANSBANK_TOKEN_DESCONOCIDO"},400);
  const orderNumber=payment.pedidos?.numero_pedido||"",target=safeHttps(payment.return_url_final)||runtime.returnUrl;
  if(payment.estado==="PAGADO")return target?redirect303(buildFinalReturnUrl(target,"success",orderNumber)):json(req,{ok:true,status:"PAGADO",order:orderNumber});
  if(payment.estado==="RECHAZADO"||payment.estado==="CANCELADO")return target?redirect303(buildFinalReturnUrl(target,payment.estado==="CANCELADO"?"cancelled":"failed",orderNumber)):json(req,{ok:true,status:payment.estado,order:orderNumber});
  try{
    await db.from("pagos_transbank").update({estado:"COMMIT_EN_PROCESO",updated_at:nowIso()}).eq("id",payment.id);
    const out=await transbankFinalizePayment(req,payment,token);
    const webStatus=out.status==="PAGADO"?"success":out.status==="RECHAZADO"?"failed":"pending";
    return target?redirect303(buildFinalReturnUrl(target,webStatus,orderNumber)):json(req,{ok:true,status:out.status,order:orderNumber});
  }catch(err){
    await db.from("pagos_transbank").update({estado:"COMMIT_PENDIENTE",error_detalle:clean(err instanceof Error?err.message:String(err),1000),updated_at:nowIso()}).eq("id",payment.id);
    await db.from("pedidos").update({estado_pago:"VERIFICACION_PENDIENTE",medio_pago:"TRANSBANK",updated_at:nowIso()}).eq("id",payment.pedido_id);
    deferTask(appendOrderHistory(String(payment.pedido_id),"PAGO_VERIFICACION_PENDIENTE","","VERIFICACION_PENDIENTE","Transbank requiere verificación adicional del pago",null));
    deferTask(audit(req,null,"TRANSBANK_COMMIT_PENDIENTE","PAGO",String(payment.id),{pedido_id:payment.pedido_id,error:clean(err instanceof Error?err.message:String(err),500)}));
    return target?redirect303(buildFinalReturnUrl(target,"pending",orderNumber)):json(req,{ok:true,status:"VERIFICACION_PENDIENTE",order:orderNumber});
  }
}

async function createPublicRequest(req: Request, d: Dict) {
  const nombre=clean(d.nombre,180), telefono=clean(d.telefono,80);
  if(!nombre) throw new Error("NOMBRE_REQUERIDO");
  if(!telefono) throw new Error("TELEFONO_REQUERIDO");
  const rutData=requireValidRut(d.rut,"RUT_SOLICITUD_INVALIDO");
  const id=requestedPublicId(d.id,"SOL");
  const customer=await upsertCustomer(req,{...d,rut:rutData.rut},"SOLICITUD",id);
  const row={cliente_id:customer?.id||null,
    id,nombre,rut:rutData.rut,rut_normalizado:rutData.normalized,telefono,email:clean(d.email,250),fecha_evento:clean(d.fecha_evento,20)||null,tipo:clean(d.tipo,180),
    cantidad:clean(d.cantidad,120),detalle:clean(d.detalle,5000),medio_pago_preferido:clean(d.medio_pago_preferido,30).toUpperCase()||null,estado:"NUEVA",origen:"WEB",created_ip:clientIp(req),
    user_agent:clean(req.headers.get("user-agent"),1000),
  };
  const created=await db.from("solicitudes").insert(row).select("id,numero_solicitud").maybeSingle();
  if(created.error && created.error.code!=="23505") throw created.error;
  let persisted=created.data;
  if(created.error?.code==="23505"){
    const existing=await db.from("solicitudes").select("id,numero_solicitud").eq("id",id).maybeSingle();
    if(existing.error) throw existing.error;
    persisted=existing.data;
  }
  if(customer?.id)deferTask(refreshCustomerStats(String(customer.id)));
  const requestToken=await requestTokenForId(id),cfg=await configMap(),number=persisted?.numero_solicitud||id;
  const trackingUrl=`${publicWebBaseUrl(cfg)}#solicitud/${encodeURIComponent(number)}?rid=${encodeURIComponent(id)}&rt=${encodeURIComponent(requestToken)}`;
  deferTask(audit(req,null,"CREAR","SOLICITUD",id,{nombre,rut:rutData.rut,publico:true,numero_solicitud:number,cliente_id:customer?.id||null}));
  return {ok:true,id,numero_solicitud:number,duplicated:created.error?.code==="23505",persisted:true,cliente_id:customer?.id||null,tracking_token:requestToken,tracking_url:trackingUrl};
}

async function checkPublicProduct(id:string) {
  const productId=clean(id,100);
  if(!productId) return {ok:true,exists:false,active:false,id:productId};
  const {data,error}=await db.from("productos").select("id,nombre,precio,activo").eq("id",productId).maybeSingle();
  if(error) throw error;
  if(!data) return {ok:true,exists:false,active:false,id:productId};
  return {ok:true,exists:true,active:bool((data as Dict).activo,false),id:productId,nombre:clean((data as Dict).nombre,250),precio:money((data as Dict).precio)};
}

async function checkPublicRecord(type:string,id:string) {
  const map:Dict={
    order:{table:"pedidos",field:"estado"},pedido:{table:"pedidos",field:"estado"},
    request:{table:"solicitudes",field:"estado"},solicitud:{table:"solicitudes",field:"estado"},
  };
  const target=map[String(type||"").toLowerCase()];
  if(!target||!id) return {ok:true,exists:false,id};
  const selectFields=target.table==="solicitudes"?`id,numero_solicitud,${target.field}`:`id,numero_pedido,pdf_url,${target.field}`;
  const {data,error}=await db.from(target.table).select(selectFields).eq("id",id).maybeSingle();
  if(error) throw error;
  return {ok:true,exists:!!data,id,numero_solicitud:data?String((data as Dict).numero_solicitud??""):"",numero_pedido:data?String((data as Dict).numero_pedido??""):"",pdf_url:data?String((data as Dict).pdf_url??""):"",estado:data?String((data as Dict)[target.field]??""):""};
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    const requestUrl=new URL(req.url);
    if(requestUrl.searchParams.get("tbk_return")==="1") return await transbankReturn(req);
    if(requestUrl.searchParams.get("pdf")==="1") return await publicOrderPdfResponse(req);
    const body: Dict = req.method === "GET" ? Object.fromEntries(new URL(req.url).searchParams.entries()) : await req.json().catch(()=>({}));
    const action=clean(body.action,80).toLowerCase();
    const data:Dict=body.data&&typeof body.data==="object"?body.data:body;

    // Acciones públicas: no requieren sesión.
    if(action==="ping") return json(req,{
      ok:true,service:"ALE_ATENCIO_API",version:VERSION,api_contract:2,
      capabilities:["adminmodule","bulkdeleteentities","verifydeleteentities","storage_images","sliding_session","orderdetail","order_pdf","rut_cl","transbank_webpay_plus","order_tracking","sales_analytics","cpanel_order_create","transfer_proof","public_share_links","notification_read_sync","payment_secret_manager","protected_order_pdf","request_paid_close_lock","commercial_table_filters","client_management","client_rut_lookup","request_client_edit","document_formats","document_trace_qr"],
      jwt:false,supabaseAuth:false,auth:"TABLA_USUARIOS",session:"TABLA_SESIONES",singleTs:true,server_time:nowIso()
    });
    if(action==="bootstrap") return json(req,{ok:true,...await publicBootstrap()});
    if(action==="trackorder") return json(req,await publicTrackOrder(data));
    if(action==="publicquote") return json(req,await publicQuoteView(data));
    if(action==="publicrequest") return json(req,await publicRequestView(data));
    if(action==="publictrace") return json(req,await publicTraceView(data));
    if(action==="publicorderpdf") return json(req,await publicGenerateOrderPdf(req,data));
    if(action==="createorder") return json(req,await createPublicOrder(req,data));
    if(action==="publicordercheckout") return json(req,await publicOrderCheckout(data));
    if(action==="uploadtransferproof") return json(req,await uploadTransferProof(req,data));
    if(action==="transbankcreate") return json(req,await transbankCreatePayment(req,data));
    if(action==="transbankstatus") return json(req,await transbankPublicStatus(data));
    if(action==="transbankrecover") return json(req,await transbankRecoverPayment(req,data));
    if(action==="createrequest") return json(req,await createPublicRequest(req,data));
    if(action==="checkrecord") return json(req,await checkPublicRecord(clean(data.type,40),clean(data.id,100)));
    if(action==="checkproduct") return json(req,await checkPublicProduct(clean(data.id,100)));
    if(action==="login"||action==="adminlogin") return json(req,await login(req,data));

    // Desde aquí todo requiere nuestra sesión propia en public.sesiones.
    const ctx=await requireSession(req,body);
    if(action==="session"||action==="adminsession") return json(req,{
      ok:true,user:safeUser(ctx.user),permissions:ctx.permissions,expires_at:ctx.session.expira_en,
      version:VERSION,api_contract:2,capabilities:["adminmodule","bulkdeleteentities","verifydeleteentities","storage_images","sliding_session","orderdetail","order_pdf","rut_cl","transbank_webpay_plus","salesreport","cpanel_order_create","transfer_proof","public_share_links","notification_read_sync","protected_order_pdf","request_paid_close_lock","commercial_table_filters","client_management","client_rut_lookup","request_client_edit","document_formats","document_trace_qr"]
    });
    if(action==="logout"||action==="adminlogout") return json(req,await logout(req,ctx));
    if(action==="adminbootstrap") return json(req,{ok:true,...await adminBootstrap(ctx,data)});
    if(action==="adminmodule") return json(req,{ok:true,...await adminModule(ctx,data)});
    if(action==="orderdetail") return json(req,await orderDetail(ctx,data));
    if(action==="admincreateorder") return json(req,await adminCreateOrder(req,ctx,data));
    if(action==="adminverifytransfer") return json(req,await adminVerifyTransfer(req,ctx,data));
    if(action==="adminorderpaymentlink") return json(req,await adminOrderPaymentLink(ctx,data));
    if(action==="cancelorder") return json(req,await cancelOrder(req,ctx,data));
    if(action==="generateorderpdf") return json(req,await generateOrderPdf(req,ctx,data));
    if(action==="orderpdflink") return json(req,await adminOrderPdfLink(ctx,data));
    if(action==="ordertrackinglink") return json(req,await adminOrderTrackingLink(ctx,data));
    if(action==="quotesharelink") return json(req,await adminQuoteShareLink(ctx,data));
    if(action==="requestsharelink") return json(req,await adminRequestShareLink(ctx,data));
    if(action==="notificationfeed") return json(req,await notificationFeed(ctx,data));
    if(action==="notificationread") return json(req,await notificationRead(req,ctx,data));
    if(action==="notificationreadall") return json(req,await notificationReadAll(req,ctx,data));
    if(action==="salesreport") return json(req,await salesReport(ctx,data));
    if(action==="saveproduct") return json(req,await saveProduct(req,ctx,data));
    if(action==="saveclient") return json(req,await saveClient(req,ctx,data));
    if(action==="clientbyrut") return json(req,await clientByRut(ctx,data));
    if(action==="updaterequestclient") return json(req,await updateRequestClient(req,ctx,data));
    if(action==="bulkimportproducts") return json(req,await bulkImportProducts(req,ctx,data));
    if(action==="saveprice") return json(req,await savePrice(req,ctx,data));
    if(action==="savecategory") return json(req,await saveCategory(req,ctx,data));
    if(action==="savebanner") return json(req,await saveBanner(req,ctx,data));
    if(action==="saveconfig") return json(req,await saveConfig(req,ctx,data));
    if(action==="paymentsecretslist") return json(req,await paymentSecretsList(ctx));
    if(action==="paymentsecretsset") return json(req,await paymentSecretsSet(req,ctx,data));
    if(action==="paymentsecretsdelete") return json(req,await paymentSecretsDelete(req,ctx,data));
    if(action==="transbankhealth") return json(req,await transbankHealth(ctx));
    if(action==="savequote") return json(req,await saveQuote(req,ctx,data));
    if(action==="uploadquotepdf") return json(req,await uploadQuotePdf(req,ctx,data));
    if(action==="updatequotestatus") return json(req,await updateQuoteStatus(req,ctx,data));
    if(action==="uploadimage") return json(req,await uploadImage(req,ctx,data));
    if(action==="deleteentity") return json(req,await deleteEntity(req,ctx,data));
    if(action==="bulkdeleteentities") return json(req,await bulkDeleteEntities(req,ctx,data));
    if(action==="verifydeleteentities") return json(req,await verifyDeleteEntities(req,ctx,data));
    if(action==="updatestatus") return json(req,await updateStatus(req,ctx,data));
    if(action==="saveuser") return json(req,await saveUser(req,ctx,data));
    if(action==="deleteuser") return json(req,await deleteUser(req,ctx,data));
    if(action==="changemypassword") return json(req,await changeMyPassword(req,ctx,data));
    return json(req,{ok:false,error:"ACCION_NO_VALIDA",version:VERSION},400);
  } catch(e) {
    const message=e instanceof Error?e.message:String(e);
    console.error("ALE_API",message);
    const status=/SESION_|CREDENCIALES|USUARIO_O_CLAVE|LOGIN_BLOQUEADO/i.test(message)?401:/PERMISO_DENEGADO/i.test(message)?403:400;
    return json(req,{ok:false,error:message,version:VERSION},status);
  }
});
