import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "ALE-SUPABASE-R9.15.2-CARGA-ADMIN-RESILIENTE";
const BUCKET = "ale-atencio-public";
const SESSION_HOURS = 24;
const SESSION_TOUCH_MINUTES = 5;
const MAX_LOGIN_FAILS = 5;
const LOGIN_BLOCK_MINUTES = 10;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

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
function money(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}
function yesNo(v: unknown): string { return bool(v) ? "SI" : "NO"; }
function nowIso(): string { return new Date().toISOString(); }
function clientIp(req: Request): string {
  return clean(req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("cf-connecting-ip") || "", 120);
}
function normalizeLogin(v: unknown): string { return clean(v, 180).toLowerCase().replace(/\s+/g, ""); }
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
  await audit(req, ctx, "LOGIN", "USUARIO", user.id, { via:"TABLA_USUARIOS" });
  return { ok:true, token, user:safeUser(user), permissions:ctx.permissions, expires_in:SESSION_HOURS*3600, version:VERSION };
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

async function adminModule(ctx: SessionCtx, d: Dict) {
  const module=clean(d.module,40).toLowerCase();
  if(module==="orders"){
    if(!ctx.permissions.orders?.read)return{module,orders:[]};
    const q=await db.from("pedidos").select("*").order("fecha",{ascending:false}).limit(1000);if(q.error)throw q.error;
    return{module,orders:q.data||[]};
  }
  if(module==="requests"){
    if(!ctx.permissions.requests?.read)return{module,requests:[]};
    const q=await db.from("solicitudes").select("*").order("fecha",{ascending:false}).limit(1000);if(q.error)throw q.error;
    return{module,requests:q.data||[]};
  }
  if(module==="quotes"){
    if(!ctx.permissions.quotes?.read)return{module,quotes:[]};
    const q=await db.from("cotizaciones").select("*").order("fecha",{ascending:false}).limit(1000);if(q.error)throw q.error;
    return{module,quotes:q.data||[]};
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
  if (Number.isNaN(since.getTime()) || since > now || now.getTime() - since.getTime() > 24*60*60*1000) {
    since = new Date(now.getTime() - 60*1000);
  }
  const sinceIso = since.toISOString();
  const [orders, requests] = await Promise.all([
    ctx.permissions.orders?.read
      ? db.from("pedidos").select("id,fecha,nombre,telefono,email,metodo_entrega,direccion,total,estado").gt("fecha",sinceIso).order("fecha",{ascending:true}).limit(50)
      : Promise.resolve({data:[],error:null} as any),
    ctx.permissions.requests?.read
      ? db.from("solicitudes").select("id,numero_solicitud,fecha,nombre,telefono,email,fecha_evento,tipo,cantidad,detalle,estado").gt("fecha",sinceIso).order("fecha",{ascending:true}).limit(50)
      : Promise.resolve({data:[],error:null} as any),
  ]);
  if ((orders as any).error) throw (orders as any).error;
  if ((requests as any).error) throw (requests as any).error;
  return {
    ok:true,
    serverTime:now.toISOString(),
    orders:(orders as any).data||[],
    requests:(requests as any).data||[],
  };
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
  const allowed=["empresa","whatsapp","instagram","facebook","tiktok","email","direccion","valor_despacho","logo_url","logo_storage_path","logo_drive_file_id","moneda","iva_porcentaje","cotizacion_validez_dias"];
  const rows:any[]=[];for(const k of allowed){if(d[k]===undefined)continue;let v=(k==="valor_despacho"||k==="iva_porcentaje"||k==="cotizacion_validez_dias")?String(money(d[k])):clean(d[k],3000);rows.push({clave:k,valor:v,updated_by:ctx.user.id});if(k==="logo_drive_file_id")rows.push({clave:"logo_storage_path",valor:v,updated_by:ctx.user.id});}
  if(rows.length){const{error}=await db.from("config").upsert(rows,{onConflict:"clave"});if(error)throw error;}
  await audit(req,ctx,"GUARDAR","CONFIG","CONFIG",{});return{ok:true,config:await configMap()};
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

async function bulkDeleteEntities(req: Request, ctx: SessionCtx, d: Dict) {
  const kind=clean(d.kind,40).toLowerCase();
  const ids=[...new Set((Array.isArray(d.ids)?d.ids:[]).map((x:any)=>clean(x,100)).filter(Boolean))].slice(0,250);
  if(!ids.length)throw new Error("IDS_REQUERIDOS");

  if(kind==="product"||kind==="products"||kind==="producto"||kind==="productos"){
    requirePermission(ctx,"products","delete");
    const before=await db.from("productos").select("id,nombre,storage_path,image_url").in("id",ids);
    if(before.error)throw before.error;
    const rows=before.data||[];
    if(!rows.length)return{ok:true,deleted:0,missing:ids.length};
    const del=await db.from("productos").delete().in("id",rows.map((x:any)=>x.id)).select("id");
    if(del.error)throw del.error;
    const paths=rows.map((x:any)=>clean(x.storage_path,1000)).filter(Boolean);
    if(paths.length)deferTask(cleanupStoragePaths(paths));
    await audit(req,ctx,"ELIMINAR_MULTIPLE","PRODUCTOS","MULTIPLE",{hard:true,count:(del.data||[]).length,ids:rows.map((x:any)=>x.id),nombres:rows.map((x:any)=>x.nombre)});
    return{ok:true,deleted:(del.data||[]).length,missing:Math.max(0,ids.length-rows.length)};
  }

  if(kind==="request"||kind==="requests"||kind==="solicitud"||kind==="solicitudes"){
    requirePermission(ctx,"requests","delete");
    const before=await db.from("solicitudes").select("id,numero_solicitud,cliente_id,nombre,telefono").in("id",ids);
    if(before.error)throw before.error;
    const rows=before.data||[];
    if(!rows.length)return{ok:true,deleted:0,missing:ids.length};
    const del=await db.from("solicitudes").delete().in("id",rows.map((x:any)=>x.id)).select("id");
    if(del.error)throw del.error;
    const customerIds:string[]=[...new Set<string>(rows.map((x:any)=>clean(x.cliente_id,100)).filter(Boolean))];
    for(const cid of customerIds)deferTask(refreshCustomerStats(cid));
    await audit(req,ctx,"ELIMINAR_MULTIPLE","SOLICITUDES","MULTIPLE",{hard:true,count:(del.data||[]).length,ids:rows.map((x:any)=>x.id),numeros:rows.map((x:any)=>x.numero_solicitud||"")});
    return{ok:true,deleted:(del.data||[]).length,missing:Math.max(0,ids.length-rows.length)};
  }

  if(kind==="quote"||kind==="quotes"||kind==="cotizacion"||kind==="cotizaciones"){
    requirePermission(ctx,"quotes","delete");
    const before=await db.from("cotizaciones").select("id,numero_cotizacion,cliente_id,pdf_bucket,pdf_path").in("id",ids);
    if(before.error)throw before.error;
    const rows=before.data||[];
    if(!rows.length)return{ok:true,deleted:0,missing:ids.length};
    const del=await db.from("cotizaciones").delete().in("id",rows.map((x:any)=>x.id)).select("id");
    if(del.error)throw del.error;
    const paths=rows.filter((x:any)=>!x.pdf_bucket||String(x.pdf_bucket)===BUCKET).map((x:any)=>clean(x.pdf_path,1000)).filter(Boolean);
    if(paths.length)deferTask(cleanupStoragePaths(paths));
    try{await db.from("archivos").delete().eq("entidad","COTIZACION").in("entidad_id",rows.map((x:any)=>x.id));}catch(_){ }
    const customerIds:string[]=[...new Set<string>(rows.map((x:any)=>clean(x.cliente_id,100)).filter(Boolean))];
    for(const cid of customerIds)deferTask(refreshCustomerStats(cid));
    await audit(req,ctx,"ELIMINAR_MULTIPLE","COTIZACIONES","MULTIPLE",{hard:true,count:(del.data||[]).length,ids:rows.map((x:any)=>x.id),numeros:rows.map((x:any)=>x.numero_cotizacion||"")});
    return{ok:true,deleted:(del.data||[]).length,missing:Math.max(0,ids.length-rows.length)};
  }

  throw new Error("TIPO_NO_VALIDO");
}

async function deleteEntity(req: Request, ctx: SessionCtx, d: Dict) {
  const kind=clean(d.kind,40).toLowerCase();
  const id=clean(d.id,100);
  if(!id)throw new Error("ID_REQUERIDO");
  const normalized=kind==="product"?"products":kind==="request"?"requests":kind==="quote"?"quotes":kind;
  if(["products","requests","quotes"].includes(normalized)){
    const out=await bulkDeleteEntities(req,ctx,{kind:normalized,ids:[id]});
    return{ok:true,deleted:Number(out.deleted||0)>0,missing:out.missing||0};
  }
  const map:Dict={category:["categorias","categories"],banner:["banners","banners"]};
  const target=map[kind];if(!target)throw new Error("TIPO_NO_VALIDO");
  requirePermission(ctx,target[1],"delete");
  const{data,error}=await db.from(target[0]).update({activo:false}).eq("id",id).select("id").maybeSingle();if(error)throw error;
  await audit(req,ctx,"ELIMINAR",target[0].toUpperCase(),id,{soft:true});
  return{ok:true,deleted:!!data};
}
async function updateStatus(req: Request, ctx: SessionCtx, d: Dict) {
  const kind=clean(d.kind,40).toLowerCase(),status=clean(d.status,80).toUpperCase();const allowed:Dict={order:["PENDIENTE","CONFIRMADO","EN PREPARACION","LISTO","ENTREGADO","CANCELADO"],request:["NUEVA","CONTACTADA","COTIZADA","ACEPTADA","CERRADA"]};const map:Dict={order:["pedidos","orders"],request:["solicitudes","requests"]};
  if(!map[kind]||!allowed[kind].includes(status))throw new Error("ESTADO_NO_VALIDO");requirePermission(ctx,map[kind][1],"write");const id=clean(d.id,100);const selectFields=kind==="order"?"id,cliente_id":"id";const{data,error}=await db.from(map[kind][0]).update({estado:status}).eq("id",id).select(selectFields).maybeSingle();if(error)throw error;if(kind==="order"&&data?.cliente_id)deferTask(refreshCustomerStats(String(data.cliente_id)));await audit(req,ctx,"ESTADO",map[kind][0].toUpperCase(),id,{estado:status});return{ok:true,updated:!!data};
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
  const subtotal=money(items.reduce((sum,x)=>sum+Number(x.total||0),0));
  const ivaPorcentaje=Math.min(100,Math.max(0,Number(d.iva_porcentaje??19)||0));
  const iva=money(subtotal*ivaPorcentaje/100);
  const total=money(subtotal+iva);
  const solicitudId=clean(d.solicitud_id,100)||null;
  let numeroSolicitud=clean(d.numero_solicitud,100)||null;
  let linkedRequest:any=null;
  if(solicitudId){
    const rq=await db.from("solicitudes").select("numero_solicitud,nombre,telefono,email,cliente_id").eq("id",solicitudId).maybeSingle();
    if(rq.error)throw rq.error;if(rq.data){linkedRequest=rq.data;numeroSolicitud=clean(rq.data.numero_solicitud,100)||numeroSolicitud;}
  }
  const customer=linkedRequest?.cliente_id?{id:linkedRequest.cliente_id}:await upsertCustomer(req,{...d,nombre:d.cliente_nombre},"COTIZACION",id);
  const row={
    id,
    solicitud_id:solicitudId,
    numero_solicitud:numeroSolicitud,
    cliente_id:customer?.id||linkedRequest?.cliente_id||null,
    cliente_nombre:clean(linkedRequest?.nombre||d.cliente_nombre||d.nombre,180),
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
  const telefono=clean(d.telefono,80), phone=normalizePhone(telefono), email=clean(d.email,250).toLowerCase(), nombre=clean(d.nombre||d.cliente_nombre,180);
  if(!phone&&!email)return null;
  let found:any=null;
  if(phone){const q=await db.from("clientes").select("*").eq("telefono_normalizado",phone).maybeSingle();if(q.error)throw q.error;found=q.data;}
  if(!found&&email){const q=await db.from("clientes").select("*").eq("email",email).limit(1);if(q.error)throw q.error;found=(q.data||[])[0]||null;}
  const now=nowIso();
  if(found){const patch:any={nombre:nombre||found.nombre,telefono:telefono||found.telefono,telefono_normalizado:phone||found.telefono_normalizado,email:email||found.email,ultima_interaccion:now};const u=await db.from("clientes").update(patch).eq("id",found.id).select("*").single();if(u.error)throw u.error;return u.data;}
  const row:any={nombre:nombre||"Cliente",telefono:telefono||null,telefono_normalizado:phone||null,email:email||null,origen_primero:source,primera_interaccion:now,ultima_interaccion:now,total_solicitudes:0,total_pedidos:0,total_cotizaciones:0};
  const i=await db.from("clientes").insert(row).select("*").single();if(i.error)throw i.error;deferTask(audit(req,null,"CREAR","CLIENTE",i.data.id,{source,sourceId}));return i.data;
}
async function refreshCustomerStats(clienteId:string){if(!clienteId)return;const [p,s,q]=await Promise.all([db.from("pedidos").select("total,estado").eq("cliente_id",clienteId),db.from("solicitudes").select("id").eq("cliente_id",clienteId),db.from("cotizaciones").select("id").eq("cliente_id",clienteId)]);const sales=(p.data||[]).filter((x:any)=>String(x.estado).toUpperCase()==="ENTREGADO").reduce((a:number,x:any)=>a+Number(x.total||0),0);await db.from("clientes").update({total_pedidos:(p.data||[]).length,total_solicitudes:(s.data||[]).length,total_cotizaciones:(q.data||[]).length,total_comprado:money(sales),ultima_interaccion:nowIso()}).eq("id",clienteId);}

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
    config:cfg,
    version:VERSION,
  };
}

async function createPublicOrder(req: Request, d: Dict) {
  const nombre=clean(d.nombre,180), telefono=clean(d.telefono,80);
  if(!nombre) throw new Error("NOMBRE_REQUERIDO");
  if(!telefono) throw new Error("TELEFONO_REQUERIDO");
  const id=requestedPublicId(d.id,"PED");
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
    detail.push({id:productId,nombre:clean(product.nombre,250),cantidad,precio});
    subtotal+=precio*cantidad;
  }
  subtotal=money(subtotal);
  const despacho=money(d.despacho);
  const total=money(subtotal+despacho);
  const customer=await upsertCustomer(req,d,"PEDIDO",id);
  const row={cliente_id:customer?.id||null,
    id,nombre,telefono,email:clean(d.email,250),direccion:clean(d.direccion,500),comuna:clean(d.comuna,180),
    metodo_entrega:clean(d.metodo_entrega,120),detalle:detail,subtotal,
    despacho,total,estado:"PENDIENTE",observaciones:clean(d.observaciones,3000),
    origen:"WEB",created_ip:clientIp(req),user_agent:clean(req.headers.get("user-agent"),1000),
  };
  const {error}=await db.from("pedidos").insert(row);
  if(error && error.code!=="23505") throw error;
  if(customer?.id)deferTask(refreshCustomerStats(String(customer.id)));
  deferTask(audit(req,null,"CREAR","PEDIDO",id,{nombre,publico:true,cliente_id:customer?.id||null}));
  return {ok:true,id,duplicated:error?.code==="23505",persisted:true,cliente_id:customer?.id||null};
}

async function createPublicRequest(req: Request, d: Dict) {
  const nombre=clean(d.nombre,180), telefono=clean(d.telefono,80);
  if(!nombre) throw new Error("NOMBRE_REQUERIDO");
  if(!telefono) throw new Error("TELEFONO_REQUERIDO");
  const id=requestedPublicId(d.id,"SOL");
  const customer=await upsertCustomer(req,d,"SOLICITUD",id);
  const row={cliente_id:customer?.id||null,
    id,nombre,telefono,email:clean(d.email,250),fecha_evento:clean(d.fecha_evento,20)||null,tipo:clean(d.tipo,180),
    cantidad:clean(d.cantidad,120),detalle:clean(d.detalle,5000),estado:"NUEVA",origen:"WEB",created_ip:clientIp(req),
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
  deferTask(audit(req,null,"CREAR","SOLICITUD",id,{nombre,publico:true,numero_solicitud:persisted?.numero_solicitud||"",cliente_id:customer?.id||null}));
  return {ok:true,id,numero_solicitud:persisted?.numero_solicitud||"",duplicated:created.error?.code==="23505",persisted:true,cliente_id:customer?.id||null};
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
  const selectFields=target.table==="solicitudes"?`id,numero_solicitud,${target.field}`:`id,${target.field}`;
  const {data,error}=await db.from(target.table).select(selectFields).eq("id",id).maybeSingle();
  if(error) throw error;
  return {ok:true,exists:!!data,id,numero_solicitud:data?String((data as Dict).numero_solicitud??""):"",estado:data?String((data as Dict)[target.field]??""):""};
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    const body: Dict = req.method === "GET" ? Object.fromEntries(new URL(req.url).searchParams.entries()) : await req.json().catch(()=>({}));
    const action=clean(body.action,80).toLowerCase();
    const data:Dict=body.data&&typeof body.data==="object"?body.data:body;

    // Acciones públicas: no requieren sesión.
    if(action==="ping") return json(req,{ok:true,service:"ALE_ATENCIO_API",version:VERSION,jwt:false,supabaseAuth:false,auth:"TABLA_USUARIOS",session:"TABLA_SESIONES",singleTs:true});
    if(action==="bootstrap") return json(req,{ok:true,...await publicBootstrap()});
    if(action==="createorder") return json(req,await createPublicOrder(req,data));
    if(action==="createrequest") return json(req,await createPublicRequest(req,data));
    if(action==="checkrecord") return json(req,await checkPublicRecord(clean(data.type,40),clean(data.id,100)));
    if(action==="checkproduct") return json(req,await checkPublicProduct(clean(data.id,100)));
    if(action==="login"||action==="adminlogin") return json(req,await login(req,data));

    // Desde aquí todo requiere nuestra sesión propia en public.sesiones.
    const ctx=await requireSession(req,body);
    if(action==="session"||action==="adminsession") return json(req,{ok:true,user:safeUser(ctx.user),permissions:ctx.permissions,expires_at:ctx.session.expira_en,version:VERSION});
    if(action==="logout"||action==="adminlogout") return json(req,await logout(req,ctx));
    if(action==="adminbootstrap") return json(req,{ok:true,...await adminBootstrap(ctx,data)});
    if(action==="adminmodule") return json(req,{ok:true,...await adminModule(ctx,data)});
    if(action==="notificationfeed") return json(req,await notificationFeed(ctx,data));
    if(action==="saveproduct") return json(req,await saveProduct(req,ctx,data));
    if(action==="bulkimportproducts") return json(req,await bulkImportProducts(req,ctx,data));
    if(action==="saveprice") return json(req,await savePrice(req,ctx,data));
    if(action==="savecategory") return json(req,await saveCategory(req,ctx,data));
    if(action==="savebanner") return json(req,await saveBanner(req,ctx,data));
    if(action==="saveconfig") return json(req,await saveConfig(req,ctx,data));
    if(action==="savequote") return json(req,await saveQuote(req,ctx,data));
    if(action==="uploadquotepdf") return json(req,await uploadQuotePdf(req,ctx,data));
    if(action==="updatequotestatus") return json(req,await updateQuoteStatus(req,ctx,data));
    if(action==="uploadimage") return json(req,await uploadImage(req,ctx,data));
    if(action==="deleteentity") return json(req,await deleteEntity(req,ctx,data));
    if(action==="bulkdeleteentities") return json(req,await bulkDeleteEntities(req,ctx,data));
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
