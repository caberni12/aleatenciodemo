-- ============================================================================
-- ALE ATENCIO - SUPABASE POSTGRESQL
-- R2 - USUARIOS + SESIONES PROPIAS EN TABLAS
-- SIN Supabase Auth. SIN JWT. SIN Google Sheets. SIN Apps Script.
-- Ejecutar COMPLETO en Supabase > SQL Editor > New query > Run.
-- ============================================================================

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- --------------------------------------------------------------------------
-- Utilidades
-- --------------------------------------------------------------------------
create or replace function public.ale_generar_id(prefijo text)
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select upper(coalesce(nullif(trim(prefijo),''),'ID') || '-' || substr(replace(extensions.gen_random_uuid()::text,'-',''),1,12));
$$;

create or replace function public.ale_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- USUARIOS PROPIOS. NO auth.users.
-- password_salt: sal adicional por usuario.
-- password_hash: bcrypt de SHA-256(password|password_salt).
-- --------------------------------------------------------------------------
create table if not exists public.usuarios (
  id text primary key default public.ale_generar_id('USR'),
  nombre text not null,
  usuario text not null,
  email text,
  rol text not null default 'EDITOR'
    check (rol in ('ADMIN','GERENCIA','OPERADOR','EDITOR','LECTURA')),
  permisos jsonb not null default '{}'::jsonb,
  activo boolean not null default true,
  password_salt text not null,
  password_hash text not null,
  profile_path text,
  profile_url text,
  ultimo_acceso timestamptz,
  creado_en timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists usuarios_usuario_uq on public.usuarios(lower(usuario));
create unique index if not exists usuarios_email_uq on public.usuarios(lower(email))
  where email is not null and btrim(email) <> '';
create index if not exists usuarios_activo_rol_idx on public.usuarios(activo,rol);

-- --------------------------------------------------------------------------
-- SESIONES PROPIAS. El token real NUNCA se guarda; solo SHA-256.
-- --------------------------------------------------------------------------
create table if not exists public.sesiones (
  id uuid primary key default extensions.gen_random_uuid(),
  usuario_id text not null references public.usuarios(id) on delete cascade,
  token_hash text not null unique,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null,
  ultimo_uso_en timestamptz not null default now(),
  revocada boolean not null default false,
  ip text,
  user_agent text
);
create index if not exists sesiones_usuario_idx on public.sesiones(usuario_id,revocada,expira_en desc);
create index if not exists sesiones_expira_idx on public.sesiones(expira_en);

-- Intentos de login / bloqueo temporal.
create table if not exists public.login_intentos (
  clave text primary key,
  login text not null,
  ip text,
  intentos integer not null default 0,
  bloqueado_hasta timestamptz,
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- CATALOGO
-- --------------------------------------------------------------------------
create table if not exists public.categorias (
  id text primary key default public.ale_generar_id('CAT'),
  nombre text not null,
  descripcion text not null default '',
  storage_path text,
  image_url text,
  orden integer not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists categorias_nombre_uq on public.categorias(lower(nombre));
create index if not exists categorias_activo_orden_idx on public.categorias(activo,orden);

create table if not exists public.productos (
  id text primary key default public.ale_generar_id('PROD'),
  nombre text not null,
  descripcion text not null default '',
  precio numeric(12,2) not null default 0 check (precio >= 0),
  categoria_id text references public.categorias(id) on delete set null,
  categoria_nombre text not null default '',
  stock numeric(12,2) not null default 0,
  storage_path text,
  image_url text,
  destacado boolean not null default false,
  activo boolean not null default true,
  ocasion text not null default '',
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists productos_activo_orden_idx on public.productos(activo,orden);
create index if not exists productos_categoria_idx on public.productos(categoria_id);
create index if not exists productos_nombre_idx on public.productos(lower(nombre));

create table if not exists public.banners (
  id text primary key default public.ale_generar_id('BAN'),
  titulo text not null,
  subtitulo text not null default '',
  cta_texto text not null default '',
  enlace text not null default '#solicitud',
  storage_path text,
  image_url text,
  activo boolean not null default true,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists banners_activo_orden_idx on public.banners(activo,orden);

-- --------------------------------------------------------------------------
-- PEDIDOS Y SOLICITUDES
-- --------------------------------------------------------------------------
create table if not exists public.pedidos (
  id text primary key default public.ale_generar_id('PED'),
  fecha timestamptz not null default now(),
  nombre text not null,
  telefono text not null,
  email text not null default '',
  direccion text not null default '',
  comuna text not null default '',
  metodo_entrega text not null default '',
  detalle jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  despacho numeric(12,2) not null default 0 check (despacho >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','CONFIRMADO','EN PREPARACION','LISTO','ENTREGADO','CANCELADO')),
  observaciones text not null default '',
  origen text not null default 'WEB',
  created_ip text,
  user_agent text,
  updated_at timestamptz not null default now()
);
create index if not exists pedidos_fecha_idx on public.pedidos(fecha desc);
create index if not exists pedidos_estado_idx on public.pedidos(estado);
create index if not exists pedidos_telefono_idx on public.pedidos(telefono);

create table if not exists public.solicitudes (
  id text primary key default public.ale_generar_id('SOL'),
  fecha timestamptz not null default now(),
  nombre text not null,
  telefono text not null,
  email text not null default '',
  fecha_evento date,
  tipo text not null default '',
  cantidad text not null default '',
  detalle text not null default '',
  estado text not null default 'NUEVA'
    check (estado in ('NUEVA','CONTACTADA','COTIZADA','ACEPTADA','CERRADA')),
  origen text not null default 'WEB',
  created_ip text,
  user_agent text,
  updated_at timestamptz not null default now()
);
create index if not exists solicitudes_fecha_idx on public.solicitudes(fecha desc);
create index if not exists solicitudes_estado_idx on public.solicitudes(estado);
create index if not exists solicitudes_telefono_idx on public.solicitudes(telefono);

-- --------------------------------------------------------------------------
-- CONFIGURACION
-- --------------------------------------------------------------------------
create table if not exists public.config (
  clave text primary key,
  valor text not null default '',
  updated_by text references public.usuarios(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.config(clave,valor) values
  ('empresa','Ale Atencio'),
  ('whatsapp',''),
  ('instagram',''),
  ('facebook',''),
  ('tiktok',''),
  ('email',''),
  ('direccion',''),
  ('valor_despacho','0'),
  ('logo_url',''),
  ('logo_storage_path',''),
  ('logo_drive_file_id',''),
  ('moneda','CLP')
on conflict (clave) do nothing;

-- --------------------------------------------------------------------------
-- ARCHIVOS / STORAGE METADATA
-- --------------------------------------------------------------------------
create table if not exists public.archivos (
  id text primary key default public.ale_generar_id('ARC'),
  entidad text not null,
  entidad_id text,
  tipo text not null default 'IMAGEN',
  bucket text not null default 'ale-atencio-public',
  storage_path text not null,
  nombre_original text,
  mime_type text,
  bytes bigint,
  public_url text,
  activo boolean not null default true,
  subido_por text references public.usuarios(id) on delete set null,
  creado_en timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists archivos_bucket_path_uq on public.archivos(bucket,storage_path);
create index if not exists archivos_entidad_idx on public.archivos(entidad,entidad_id,activo);

-- --------------------------------------------------------------------------
-- AUDITORIA
-- --------------------------------------------------------------------------
create table if not exists public.auditoria (
  id bigint generated by default as identity primary key,
  fecha timestamptz not null default now(),
  actor_usuario_id text references public.usuarios(id) on delete set null,
  actor_usuario text,
  accion text not null,
  entidad text not null,
  entidad_id text,
  detalle jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text
);
create index if not exists auditoria_fecha_idx on public.auditoria(fecha desc);
create index if not exists auditoria_actor_idx on public.auditoria(actor_usuario_id);
create index if not exists auditoria_entidad_idx on public.auditoria(entidad,entidad_id);

-- --------------------------------------------------------------------------
-- TRIGGERS updated_at
-- --------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['usuarios','login_intentos','categorias','productos','banners','pedidos','solicitudes','config','archivos']
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.ale_set_updated_at()', t, t);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- FUNCIONES SEGURAS DE CLAVE.
-- Solo postgres/service_role pueden ejecutarlas.
-- --------------------------------------------------------------------------
create or replace function public.ale_material_clave(p_password text, p_salt text)
returns text
language sql
immutable
security definer
set search_path = public, extensions
as $$
  select encode(extensions.digest(coalesce(p_password,'') || '|' || coalesce(p_salt,''), 'sha256'), 'hex');
$$;

create or replace function public.ale_crear_admin_inicial(
  p_usuario text,
  p_password text,
  p_nombre text default 'Administrador',
  p_email text default null
)
returns table(id text, usuario text, nombre text, rol text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id text;
  v_usuario text := lower(trim(coalesce(p_usuario,'')));
  v_nombre text := trim(coalesce(p_nombre,'Administrador'));
  v_email text := nullif(lower(trim(coalesce(p_email,''))), '');
  v_salt text;
  v_material text;
begin
  if v_usuario = '' then raise exception 'USUARIO_REQUERIDO'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'CLAVE_MINIMO_8_CARACTERES'; end if;
  if exists(select 1 from public.usuarios where activo = true and rol = 'ADMIN') then
    raise exception 'ADMIN_INICIAL_YA_EXISTE';
  end if;
  if exists(select 1 from public.usuarios where lower(usuario)=v_usuario) then
    raise exception 'USUARIO_YA_EXISTE';
  end if;
  if v_email is not null and exists(select 1 from public.usuarios where lower(email)=v_email) then
    raise exception 'EMAIL_YA_EXISTE';
  end if;

  v_id := public.ale_generar_id('USR');
  v_salt := encode(extensions.gen_random_bytes(16), 'hex');
  v_material := public.ale_material_clave(p_password, v_salt);

  insert into public.usuarios(id,nombre,usuario,email,rol,permisos,activo,password_salt,password_hash)
  values(v_id,v_nombre,v_usuario,v_email,'ADMIN','{}'::jsonb,true,v_salt,extensions.crypt(v_material, extensions.gen_salt('bf',12)));

  return query select v_id, v_usuario, v_nombre, 'ADMIN'::text;
end;
$$;

create or replace function public.ale_verificar_credenciales(p_login text, p_password text)
returns table(
  id text,
  nombre text,
  usuario text,
  email text,
  rol text,
  permisos jsonb,
  activo boolean,
  profile_path text,
  profile_url text,
  ultimo_acceso timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios%rowtype;
  v_login text := lower(trim(coalesce(p_login,'')));
  v_material text;
begin
  if v_login = '' or coalesce(p_password,'') = '' then return; end if;

  select * into u
  from public.usuarios x
  where x.activo = true
    and (lower(x.usuario)=v_login or lower(coalesce(x.email,''))=v_login)
  order by x.creado_en asc
  limit 1;

  if not found then return; end if;
  v_material := public.ale_material_clave(p_password, u.password_salt);
  if u.password_hash <> extensions.crypt(v_material, u.password_hash) then return; end if;

  update public.usuarios set ultimo_acceso=now() where public.usuarios.id=u.id;

  return query
  select u.id,u.nombre,u.usuario,u.email,u.rol,u.permisos,u.activo,u.profile_path,u.profile_url,now();
end;
$$;

create or replace function public.ale_crear_usuario_seguro(
  p_nombre text,
  p_usuario text,
  p_email text,
  p_rol text,
  p_activo boolean,
  p_password text,
  p_permisos jsonb default '{}'::jsonb,
  p_profile_path text default null,
  p_profile_url text default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id text := public.ale_generar_id('USR');
  v_usuario text := lower(trim(coalesce(p_usuario,'')));
  v_email text := nullif(lower(trim(coalesce(p_email,''))), '');
  v_rol text := upper(trim(coalesce(p_rol,'EDITOR')));
  v_salt text;
  v_material text;
begin
  if trim(coalesce(p_nombre,''))='' then raise exception 'NOMBRE_REQUERIDO'; end if;
  if v_usuario='' then raise exception 'USUARIO_REQUERIDO'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'CLAVE_MINIMO_8_CARACTERES'; end if;
  if v_rol not in ('ADMIN','GERENCIA','OPERADOR','EDITOR','LECTURA') then raise exception 'ROL_INVALIDO'; end if;
  if exists(select 1 from public.usuarios where lower(usuario)=v_usuario) then raise exception 'USUARIO_YA_EXISTE'; end if;
  if v_email is not null and exists(select 1 from public.usuarios where lower(email)=v_email) then raise exception 'EMAIL_YA_EXISTE'; end if;

  v_salt := encode(extensions.gen_random_bytes(16),'hex');
  v_material := public.ale_material_clave(p_password,v_salt);

  insert into public.usuarios(id,nombre,usuario,email,rol,permisos,activo,password_salt,password_hash,profile_path,profile_url)
  values(v_id,trim(p_nombre),v_usuario,v_email,v_rol,coalesce(p_permisos,'{}'::jsonb),coalesce(p_activo,true),v_salt,
         extensions.crypt(v_material,extensions.gen_salt('bf',12)),nullif(trim(coalesce(p_profile_path,'')),''),nullif(trim(coalesce(p_profile_url,'')),''));
  return v_id;
end;
$$;

create or replace function public.ale_establecer_clave(p_usuario_id text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_salt text;
  v_material text;
begin
  if length(coalesce(p_password,'')) < 8 then raise exception 'CLAVE_MINIMO_8_CARACTERES'; end if;
  if not exists(select 1 from public.usuarios where id=p_usuario_id) then raise exception 'USUARIO_NO_ENCONTRADO'; end if;
  v_salt := encode(extensions.gen_random_bytes(16),'hex');
  v_material := public.ale_material_clave(p_password,v_salt);
  update public.usuarios
     set password_salt=v_salt,
         password_hash=extensions.crypt(v_material,extensions.gen_salt('bf',12)),
         updated_at=now()
   where id=p_usuario_id;
  update public.sesiones set revocada=true where usuario_id=p_usuario_id;
  return true;
end;
$$;

-- --------------------------------------------------------------------------
-- STORAGE: bucket publico SOLO para lectura de imagenes de tienda.
-- Escritura/borrado se realiza desde Edge Function con clave de servidor.
-- --------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'ale-atencio-public','ale-atencio-public',true,6291456,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- --------------------------------------------------------------------------
-- RLS: BLOQUEO TOTAL para anon/authenticated.
-- El navegador no consulta tablas directamente. Solo llama Edge Functions.
-- Las Edge Functions usan una clave de servidor y validan nuestra sesion propia.
-- --------------------------------------------------------------------------
alter table public.usuarios enable row level security;
alter table public.sesiones enable row level security;
alter table public.login_intentos enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.banners enable row level security;
alter table public.pedidos enable row level security;
alter table public.solicitudes enable row level security;
alter table public.config enable row level security;
alter table public.archivos enable row level security;
alter table public.auditoria enable row level security;

revoke all on table public.usuarios,public.sesiones,public.login_intentos,public.categorias,public.productos,public.banners,
  public.pedidos,public.solicitudes,public.config,public.archivos,public.auditoria from anon, authenticated;

-- service_role/secret key: acceso exclusivo para Edge Functions.
grant usage on schema public to service_role;
grant all on table public.usuarios,public.sesiones,public.login_intentos,public.categorias,public.productos,public.banners,
  public.pedidos,public.solicitudes,public.config,public.archivos,public.auditoria to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on function public.ale_material_clave(text,text) from public, anon, authenticated;
revoke all on function public.ale_crear_admin_inicial(text,text,text,text) from public, anon, authenticated;
revoke all on function public.ale_verificar_credenciales(text,text) from public, anon, authenticated;
revoke all on function public.ale_crear_usuario_seguro(text,text,text,text,boolean,text,jsonb,text,text) from public, anon, authenticated;
revoke all on function public.ale_establecer_clave(text,text) from public, anon, authenticated;

grant execute on function public.ale_verificar_credenciales(text,text) to service_role;
grant execute on function public.ale_crear_usuario_seguro(text,text,text,text,boolean,text,jsonb,text,text) to service_role;
grant execute on function public.ale_establecer_clave(text,text) to service_role;

-- El primer admin se crea desde SQL Editor, no desde una API publica.
-- EJEMPLO (CAMBIAR CLAVE ANTES DE EJECUTAR):
-- select * from public.ale_crear_admin_inicial('admin','CAMBIAR-CLAVE-SEGURA','Administrador','');

commit;

-- ============================================================================
-- VALIDACION FINAL
-- ============================================================================
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('usuarios','sesiones','login_intentos','categorias','productos','banners','pedidos','solicitudes','config','archivos','auditoria')
order by table_name;

select id,name,public,file_size_limit from storage.buckets where id='ale-atencio-public';

select 'ALE_ATENCIO_SUPABASE_R2_SQL_OK' as resultado;


-- ============================================================================
-- ALE ATENCIO - IMPORTACION COMPLETA DE DATOS DESDE ALE_ATENCIO_BD_WEB.xlsx
-- Compatible con ALE ATENCIO SUPABASE R3 (un solo index.ts)
-- Generado a partir del Excel entregado por el usuario.
--
-- Incluye:
--   101 productos
--   5 categorias
--   3 banners
--   0 pedidos (la hoja solo contiene encabezados)
--   9 solicitudes
--   10 claves de configuracion
--   17 registros historicos de auditoria
--   1 usuario administrador
--
-- IMPORTANTE:
-- - No usa Supabase Auth.
-- - No usa JWT.
-- - Los usuarios dependen de public.usuarios y public.sesiones.
-- - Conserva el hash/salt legacy del administrador si aun no existe.
-- - El primer login legacy correcto actualiza automaticamente el hash a bcrypt.
-- ============================================================================

begin;

-- Verificacion de que el esquema R3 ya existe.
do $$
begin
  if to_regclass('public.usuarios') is null
     or to_regclass('public.productos') is null
     or to_regclass('public.categorias') is null
     or to_regclass('public.banners') is null
     or to_regclass('public.solicitudes') is null
     or to_regclass('public.config') is null
     or to_regclass('public.auditoria') is null then
    raise exception 'ALE_ATENCIO_ESQUEMA_R3_NO_INSTALADO';
  end if;
end $$;

-- ============================================================================
-- COMPATIBILIDAD DE LOGIN CON HASH LEGACY DE APPS SCRIPT
-- Hash antiguo: SHA256(salt || password)
-- Hash nuevo: bcrypt(SHA256(password || ''|'' || salt))
-- Tras un login legacy correcto se actualiza automaticamente al formato nuevo.
-- ============================================================================
create or replace function public.ale_verificar_credenciales(p_login text, p_password text)
returns table(
  id text,
  nombre text,
  usuario text,
  email text,
  rol text,
  permisos jsonb,
  activo boolean,
  profile_path text,
  profile_url text,
  ultimo_acceso timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios%rowtype;
  v_login text := lower(trim(coalesce(p_login,'')));
  v_material text;
  v_legacy_hash text;
  v_ok boolean := false;
begin
  if v_login = '' or coalesce(p_password,'') = '' then return; end if;

  select * into u
  from public.usuarios x
  where x.activo = true
    and (lower(x.usuario)=v_login or lower(coalesce(x.email,''))=v_login)
  order by x.creado_en asc
  limit 1;

  if not found then return; end if;

  if u.password_hash like '$2%' then
    v_material := public.ale_material_clave(p_password, u.password_salt);
    v_ok := (u.password_hash = extensions.crypt(v_material, u.password_hash));
  elsif u.password_hash ~ '^[0-9A-Fa-f]{64}$' then
    v_legacy_hash := encode(
      extensions.digest(coalesce(u.password_salt,'') || coalesce(p_password,''), 'sha256'),
      'hex'
    );
    v_ok := (lower(u.password_hash) = lower(v_legacy_hash));

    if v_ok then
      v_material := public.ale_material_clave(p_password, u.password_salt);
      update public.usuarios
         set password_hash = extensions.crypt(v_material, extensions.gen_salt('bf',12)),
             updated_at = now()
       where public.usuarios.id = u.id;
    end if;
  end if;

  if not v_ok then return; end if;

  update public.usuarios
     set ultimo_acceso=now()
   where public.usuarios.id=u.id;

  return query
  select u.id,u.nombre,u.usuario,u.email,u.rol,u.permisos,u.activo,u.profile_path,u.profile_url,now();
end;
$$;

revoke all on function public.ale_verificar_credenciales(text,text) from public, anon, authenticated;
grant execute on function public.ale_verificar_credenciales(text,text) to service_role;

-- ============================================================================
-- CATEGORIAS
-- ============================================================================

insert into public.categorias
(id,nombre,descripcion,storage_path,image_url,orden,activo)
values ('C001','Tortas','Tortas artesanales para celebraciones',NULL,'producto-004-torta-pina-crema-y-cerezas.jpg',1,true)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  image_url=excluded.image_url,
  orden=excluded.orden,
  activo=excluded.activo,
  updated_at=now();

insert into public.categorias
(id,nombre,descripcion,storage_path,image_url,orden,activo)
values ('C002','Galletas','Galletas, alfajores y masas artesanales',NULL,'producto-006-surtido-de-masas-secas.jpg',2,true)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  image_url=excluded.image_url,
  orden=excluded.orden,
  activo=excluded.activo,
  updated_at=now();

insert into public.categorias
(id,nombre,descripcion,storage_path,image_url,orden,activo)
values ('C003','Dulcería','Calugas, vasitos y dulces especiales',NULL,'producto-008-galletas-vienesas-banadas.jpg',3,true)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  image_url=excluded.image_url,
  orden=excluded.orden,
  activo=excluded.activo,
  updated_at=now();

insert into public.categorias
(id,nombre,descripcion,storage_path,image_url,orden,activo)
values ('C004','Postres','Cheesecakes, pies, tartas y postres',NULL,'producto-026-tarta-nuez-espolvoreada.jpg',4,true)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  image_url=excluded.image_url,
  orden=excluded.orden,
  activo=excluded.activo,
  updated_at=now();

insert into public.categorias
(id,nombre,descripcion,storage_path,image_url,orden,activo)
values ('C005','Regalos','Selecciones personalizadas y detalles para regalar',NULL,'producto-006-surtido-de-masas-secas.jpg',5,true)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  image_url=excluded.image_url,
  orden=excluded.orden,
  activo=excluded.activo,
  updated_at=now();


-- ============================================================================
-- PRODUCTOS
-- ============================================================================

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P001',
  'Torta Chocolate Ganache',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-001-torta-chocolate-ganache.jpg',
  true,
  true,
  'Celebraciones',
  1,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P002',
  'Torta Hojarasca Manjar',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-002-torta-hojarasca-manjar.jpg',
  true,
  true,
  'Celebraciones',
  2,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P003',
  'Torta Café Praliné',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-003-torta-cafe-praline.jpg',
  false,
  true,
  'Celebraciones',
  3,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P004',
  'Torta Piña, Crema y Cerezas',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-004-torta-pina-crema-y-cerezas.jpg',
  true,
  true,
  'Celebraciones',
  4,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P005',
  'Torta Hojarasca Frambuesa',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-005-torta-hojarasca-frambuesa.jpg',
  true,
  true,
  'Celebraciones',
  5,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P006',
  'Surtido de Masas Secas',
  'Selección Ale Atencio pensada para regalar, compartir o personalizar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-006-surtido-de-masas-secas.jpg',
  true,
  true,
  'Regalos',
  6,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P007',
  'Torta Hojarasca Frambuesa',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-007-torta-hojarasca-frambuesa.jpg',
  false,
  true,
  'Celebraciones',
  7,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P008',
  'Galletas Vienesas Bañadas',
  'Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-008-galletas-vienesas-banadas.jpg',
  true,
  true,
  'Todo momento',
  8,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P009',
  'Pie de Manzana Tradicional',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-009-pie-de-manzana-tradicional.jpg',
  false,
  true,
  'Todo momento',
  9,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P010',
  'Galletas Vienesas Mix',
  'Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-010-galletas-vienesas-mix.jpg',
  false,
  true,
  'Todo momento',
  10,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P011',
  'Torta Merengue Nuez',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-011-torta-merengue-nuez.jpg',
  false,
  true,
  'Celebraciones',
  11,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P012',
  'Cheesecake Frutilla Rústico',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-012-cheesecake-frutilla-rustico.jpg',
  false,
  true,
  'Todo momento',
  12,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P013',
  'Merenguitos Artesanales',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  10000,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-013-merenguitos-artesanales.jpg',
  false,
  true,
  'Todo momento',
  13,
  '2026-09-15 10:36:19.571-03'::timestamptz
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P014',
  'Pie de Limón Merengado',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-014-pie-de-limon-merengado.jpg',
  false,
  true,
  'Todo momento',
  14,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P015',
  'Calugas de Rosa',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-015-calugas-de-rosa.jpg',
  false,
  true,
  'Todo momento',
  15,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P016',
  'Calugas Pistacho',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-016-calugas-pistacho.jpg',
  false,
  true,
  'Todo momento',
  16,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P017',
  'Brazo de Reina Frambuesa',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-017-brazo-de-reina-frambuesa.jpg',
  false,
  true,
  'Todo momento',
  17,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P018',
  'Surtido de Galletas Finas',
  'Selección Ale Atencio pensada para regalar, compartir o personalizar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-018-surtido-de-galletas-finas.jpg',
  false,
  true,
  'Regalos',
  18,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P019',
  'Torta Chocolate Ganache',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-019-torta-chocolate-ganache.jpg',
  false,
  true,
  'Celebraciones',
  19,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P020',
  'Cuadrado Frambuesa Crumble',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-020-cuadrado-frambuesa-crumble.jpg',
  false,
  true,
  'Todo momento',
  20,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P021',
  'Canastitas Gourmet Frutos Secos',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-021-canastitas-gourmet-frutos-secos.jpg',
  false,
  true,
  'Todo momento',
  21,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P022',
  'Milhojas Crocante Manjar',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-022-milhojas-crocante-manjar.jpg',
  false,
  true,
  'Todo momento',
  22,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P023',
  'Alfajores y Trufas Surtidas',
  'Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-023-alfajores-y-trufas-surtidas.jpg',
  false,
  true,
  'Todo momento',
  23,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P024',
  'Cheesecake Frutilla Rústico',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-024-cheesecake-frutilla-rustico.jpg',
  false,
  true,
  'Todo momento',
  24,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P025',
  'Alfajores Maicena Artesanales',
  'Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-025-alfajores-maicena-artesanales.jpg',
  false,
  true,
  'Todo momento',
  25,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P026',
  'Tarta Nuez Espolvoreada',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-026-tarta-nuez-espolvoreada.jpg',
  false,
  true,
  'Todo momento',
  26,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P027',
  'Torta Durazno Chantilly',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-027-torta-durazno-chantilly.jpg',
  false,
  true,
  'Celebraciones',
  27,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P028',
  'Canastitas Dulces Gourmet',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-028-canastitas-dulces-gourmet.jpg',
  false,
  true,
  'Todo momento',
  28,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P029',
  'Vasitos Mousse Maracuyá Frambuesa',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-029-vasitos-mousse-maracuya-frambuesa.jpg',
  false,
  true,
  'Todo momento',
  29,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P030',
  'Vasitos Postre Maracuyá Frambuesa',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-030-vasitos-postre-maracuya-frambuesa.jpg',
  false,
  true,
  'Todo momento',
  30,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P031',
  'Torta Rosas Blancas',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-031-torta-rosas-blancas.jpg',
  false,
  true,
  'Celebraciones',
  31,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P032',
  'Rollos de Canela Glaseados',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-032-rollos-de-canela-glaseados.jpg',
  false,
  true,
  'Todo momento',
  32,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P033',
  'Rectángulo Hojarasca Manjar',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-033-rectangulo-hojarasca-manjar.jpg',
  false,
  true,
  'Todo momento',
  33,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P034',
  'Galletas Navideñas Decoradas',
  'Preparación artesanal Ale Atencio, ideal para compartir y regalar en temporada navideña.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-034-galletas-navidenas-decoradas.jpg',
  false,
  true,
  'Navidad',
  34,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P035',
  'Torta Frambuesa Crocante',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-035-torta-frambuesa-crocante.jpg',
  false,
  true,
  'Celebraciones',
  35,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P036',
  'Torta Chocolate Premium',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-036-torta-chocolate-premium.jpg',
  false,
  true,
  'Celebraciones',
  36,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P037',
  'Alfajores Maicena Artesanales',
  'Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-037-alfajores-maicena-artesanales.jpg',
  false,
  true,
  'Todo momento',
  37,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P038',
  'Torta Hojarasca Manjar',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-038-torta-hojarasca-manjar.jpg',
  false,
  true,
  'Celebraciones',
  38,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P039',
  'Empanaditas Dulces Surtidas',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-039-empanaditas-dulces-surtidas.jpg',
  false,
  true,
  'Todo momento',
  39,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P040',
  'Torta Rosas y Chocolate',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-040-torta-rosas-y-chocolate.jpg',
  false,
  true,
  'Celebraciones',
  40,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P041',
  'Galleta Reno Decorada',
  'Preparación artesanal Ale Atencio, ideal para compartir y regalar en temporada navideña.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-041-galleta-reno-decorada.jpg',
  false,
  true,
  'Navidad',
  41,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P042',
  'Torta Merengue Frambuesa',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-042-torta-merengue-frambuesa.jpg',
  false,
  true,
  'Celebraciones',
  42,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P043',
  'Surtido Ale Atencio',
  'Selección Ale Atencio pensada para regalar, compartir o personalizar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-043-surtido-ale-atencio.jpg',
  true,
  true,
  'Regalos',
  43,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P044',
  'Rectángulo Hojarasca Manjar',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-044-rectangulo-hojarasca-manjar.jpg',
  false,
  true,
  'Todo momento',
  44,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P045',
  'Empanada de Manzana Individual',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-045-empanada-de-manzana-individual.jpg',
  false,
  true,
  'Todo momento',
  45,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P046',
  'Triángulo Hojarasca Manjar',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-046-triangulo-hojarasca-manjar.jpg',
  false,
  true,
  'Todo momento',
  46,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P047',
  'Calugas Artesanales Pistacho',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-047-calugas-artesanales-pistacho.jpg',
  false,
  true,
  'Todo momento',
  47,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P048',
  'Brazo de Reina Merengado',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-048-brazo-de-reina-merengado.jpg',
  false,
  true,
  'Todo momento',
  48,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P049',
  'Torta Merengue Frambuesa',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-049-torta-merengue-frambuesa.jpg',
  false,
  true,
  'Celebraciones',
  49,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P050',
  'Cheesecake Frutilla',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-050-cheesecake-frutilla.jpg',
  false,
  true,
  'Todo momento',
  50,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P051',
  'Cheesecake Maracuyá',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-051-cheesecake-maracuya.jpg',
  false,
  true,
  'Todo momento',
  51,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P052',
  'Torta Piña, Crema y Cerezas',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-052-torta-pina-crema-y-cerezas.jpg',
  false,
  true,
  'Celebraciones',
  52,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P053',
  'Croissants de Mantequilla',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-053-croissants-de-mantequilla.jpg',
  false,
  true,
  'Todo momento',
  53,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P054',
  'Alfajores y Trufas Finas',
  'Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-054-alfajores-y-trufas-finas.jpg',
  false,
  true,
  'Todo momento',
  54,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P055',
  'Galletas Navideñas Envoltorio',
  'Preparación artesanal Ale Atencio, ideal para compartir y regalar en temporada navideña.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-055-galletas-navidenas-envoltorio.jpg',
  false,
  true,
  'Navidad',
  55,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P056',
  'Surtido de Galletas Finas Ale Atencio',
  'Selección Ale Atencio pensada para regalar, compartir o personalizar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-056-surtido-de-galletas-finas-ale-atencio.jpg',
  false,
  true,
  'Regalos',
  56,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P057',
  'Torta Hojarasca Manjar Redonda',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-057-torta-hojarasca-manjar-redonda.jpg',
  true,
  true,
  'Celebraciones',
  57,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P058',
  'Torta Merengue Frambuesa Redonda',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-058-torta-merengue-frambuesa-redonda.jpg',
  false,
  true,
  'Celebraciones',
  58,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P059',
  'Rollos de Canela Caseros',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-059-rollos-de-canela-caseros.jpg',
  false,
  true,
  'Todo momento',
  59,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P060',
  'Alfajores Premium',
  'Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-060-alfajores-premium.jpg',
  false,
  true,
  'Todo momento',
  60,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P061',
  'Torta Merengue Nuez',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-061-torta-merengue-nuez.jpg',
  false,
  true,
  'Celebraciones',
  61,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P062',
  'Trufas y Alfajores Surtidos',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-062-trufas-y-alfajores-surtidos.jpg',
  false,
  true,
  'Todo momento',
  62,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P063',
  'Cheesecake Frambuesa',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-063-cheesecake-frambuesa.jpg',
  false,
  true,
  'Todo momento',
  63,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P064',
  'Vasitos Mousse Gourmet',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-064-vasitos-mousse-gourmet.jpg',
  false,
  true,
  'Todo momento',
  64,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P065',
  'Mini Tartaletas y Alfajores',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-065-mini-tartaletas-y-alfajores.jpg',
  false,
  true,
  'Todo momento',
  65,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P066',
  'Croissants Artesanales',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-066-croissants-artesanales.jpg',
  false,
  true,
  'Todo momento',
  66,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P067',
  'Galletas Personalizadas Novios',
  'Selección Ale Atencio pensada para regalar, compartir o personalizar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-067-galletas-personalizadas-novios.jpg',
  false,
  true,
  'Matrimonios',
  67,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P068',
  'Torta Chocolate Oro',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  20000,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-068-torta-chocolate-oro.jpg',
  true,
  true,
  'Celebraciones',
  68,
  '2026-09-15 10:11:41.933-03'::timestamptz
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P069',
  'Torta Merengue Frambuesa',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-069-torta-merengue-frambuesa.jpg',
  false,
  true,
  'Celebraciones',
  69,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P070',
  'Strudel de Manzana',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-070-strudel-de-manzana.jpg',
  false,
  true,
  'Todo momento',
  70,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P071',
  'Galletas Peineta Artesanales',
  'Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-071-galletas-peineta-artesanales.jpg',
  false,
  true,
  'Todo momento',
  71,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P072',
  'Torta Merengue Frambuesa',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-072-torta-merengue-frambuesa.jpg',
  false,
  true,
  'Celebraciones',
  72,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P073',
  'Alfajores Nevados',
  'Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-073-alfajores-nevados.jpg',
  false,
  true,
  'Todo momento',
  73,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P074',
  'Torta Piña, Crema y Cerezas',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-074-torta-pina-crema-y-cerezas.jpg',
  true,
  true,
  'Celebraciones',
  74,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P075',
  'Tarta Corazones de Manjar',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-075-tarta-corazones-de-manjar.jpg',
  false,
  true,
  'Todo momento',
  75,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P076',
  'Torta Merengada Alta',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-076-torta-merengada-alta.jpg',
  false,
  true,
  'Celebraciones',
  76,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P077',
  'Torta Hojarasca Manjar Chocodots',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-077-torta-hojarasca-manjar-chocodots.jpg',
  false,
  true,
  'Celebraciones',
  77,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P078',
  'Macarons Surtidos Box',
  'Selección Ale Atencio pensada para regalar, compartir o personalizar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-078-macarons-surtidos-box.jpg',
  false,
  true,
  'Regalos',
  78,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P079',
  'Palmeritas de Hojaldre',
  'Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-079-palmeritas-de-hojaldre.jpg',
  false,
  true,
  'Todo momento',
  79,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P080',
  'Torta Chocolate Oro',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-080-torta-chocolate-oro.jpg',
  true,
  true,
  'Celebraciones',
  80,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P081',
  'Macarons Surtidos Box',
  'Selección Ale Atencio pensada para regalar, compartir o personalizar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-081-macarons-surtidos-box.jpg',
  false,
  true,
  'Regalos',
  81,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P082',
  'Torta Naked Frambuesa',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-082-torta-naked-frambuesa.jpg',
  false,
  true,
  'Celebraciones',
  82,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P083',
  'Tarta Decorada Premium',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-083-tarta-decorada-premium.jpg',
  false,
  true,
  'Todo momento',
  83,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P084',
  'Rectángulo Hojarasca Manjar Dorado',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-084-rectangulo-hojarasca-manjar-dorado.jpg',
  false,
  true,
  'Todo momento',
  84,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P085',
  'Galletas Navideñas Surtidas',
  'Preparación artesanal Ale Atencio, ideal para compartir y regalar en temporada navideña.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-085-galletas-navidenas-surtidas.jpg',
  false,
  true,
  'Navidad',
  85,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P086',
  'Cuadrados Frambuesa Crumble',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-086-cuadrados-frambuesa-crumble.jpg',
  false,
  true,
  'Todo momento',
  86,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P087',
  'Torta Hojarasca Manjar Alta',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-087-torta-hojarasca-manjar-alta.jpg',
  false,
  true,
  'Celebraciones',
  87,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P088',
  'Galleta Corporativa Personalizada',
  'Preparación personalizada Ale Atencio para empresas, eventos y ocasiones especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-088-galleta-corporativa-personalizada.jpg',
  false,
  true,
  'Empresas',
  88,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P089',
  'Cheesecake Frutos Rojos',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-089-cheesecake-frutos-rojos.jpg',
  true,
  true,
  'Todo momento',
  89,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P090',
  'Torta Chocolate Oro',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-090-torta-chocolate-oro.jpg',
  false,
  true,
  'Celebraciones',
  90,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P091',
  'Torta Hojarasca Manjar Clásica',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-091-torta-hojarasca-manjar-clasica.jpg',
  false,
  true,
  'Celebraciones',
  91,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P092',
  'Muffin Gourmet Frutos Secos',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-092-muffin-gourmet-frutos-secos.jpg',
  false,
  true,
  'Todo momento',
  92,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P093',
  'Galletas Corporativas Personalizadas',
  'Preparación personalizada Ale Atencio para empresas, eventos y ocasiones especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-093-galletas-corporativas-personalizadas.jpg',
  false,
  true,
  'Empresas',
  93,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P094',
  'Strudel de Manzana y Nuez',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-094-strudel-de-manzana-y-nuez.jpg',
  false,
  true,
  'Todo momento',
  94,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P095',
  'Berlines con Azúcar',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-095-berlines-con-azucar.jpg',
  false,
  true,
  'Todo momento',
  95,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P096',
  'Rectángulo Hojarasca Frambuesa',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-096-rectangulo-hojarasca-frambuesa.jpg',
  false,
  true,
  'Todo momento',
  96,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P097',
  'Galletas Corporativas Envoltorio',
  'Preparación personalizada Ale Atencio para empresas, eventos y ocasiones especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Regalos') limit 1),
  'Regalos',
  0,
  NULL,
  'producto-097-galletas-corporativas-envoltorio.jpg',
  false,
  true,
  'Empresas',
  97,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P098',
  'Croissants Dorados',
  'Postre artesanal Ale Atencio con presentación cuidada y sabor casero.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Postres') limit 1),
  'Postres',
  0,
  NULL,
  'producto-098-croissants-dorados.jpg',
  false,
  true,
  'Todo momento',
  98,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P099',
  'Palmeritas de Hojaldre',
  'Elaboración artesanal Ale Atencio, ideal para compartir, acompañar o regalar.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Galletas') limit 1),
  'Galletas',
  0,
  NULL,
  'producto-099-palmeritas-de-hojaldre.jpg',
  false,
  true,
  'Todo momento',
  99,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P100',
  'Torta Vainilla Manjar',
  'Torta artesanal Ale Atencio, preparada con presentación cuidada para celebraciones y momentos especiales.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Tortas') limit 1),
  'Tortas',
  0,
  NULL,
  'producto-100-torta-vainilla-manjar.jpg',
  true,
  true,
  'Celebraciones',
  100,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;

insert into public.productos
(id,nombre,descripcion,precio,categoria_id,categoria_nombre,stock,storage_path,image_url,destacado,activo,ocasion,orden,updated_at)
values (
  'P101',
  'Rectángulo Hojarasca Frambuesa',
  'Dulce artesanal Ale Atencio, elaborado con dedicación para disfrutar y compartir.',
  0,
  (select id from public.categorias where lower(nombre)=lower('Dulcería') limit 1),
  'Dulcería',
  0,
  NULL,
  'producto-101-rectangulo-hojarasca-frambuesa.jpg',
  false,
  true,
  'Todo momento',
  101,
  now()
)
on conflict (id) do update set
  nombre=excluded.nombre,
  descripcion=excluded.descripcion,
  precio=excluded.precio,
  categoria_id=excluded.categoria_id,
  categoria_nombre=excluded.categoria_nombre,
  stock=excluded.stock,
  image_url=excluded.image_url,
  destacado=excluded.destacado,
  activo=excluded.activo,
  ocasion=excluded.ocasion,
  orden=excluded.orden,
  updated_at=excluded.updated_at;


-- ============================================================================
-- BANNERS
-- ============================================================================

insert into public.banners
(id,titulo,subtitulo,cta_texto,enlace,storage_path,image_url,activo,orden)
values ('B001','Dulces momentos hechos para celebrar','Descubre nuestro catálogo artesanal Ale Atencio.','Ver catálogo','#productos/todos',NULL,'producto-001-torta-chocolate-ganache.jpg',true,1)
on conflict (id) do update set
  titulo=excluded.titulo,
  subtitulo=excluded.subtitulo,
  cta_texto=excluded.cta_texto,
  enlace=excluded.enlace,
  image_url=excluded.image_url,
  activo=excluded.activo,
  orden=excluded.orden,
  updated_at=now();

insert into public.banners
(id,titulo,subtitulo,cta_texto,enlace,storage_path,image_url,activo,orden)
values ('B002','Tortas que hacen especial cada celebración','Diseños y sabores preparados con dedicación para cada ocasión.','Ver tortas','#productos/tortas',NULL,'producto-004-torta-pina-crema-y-cerezas.jpg',true,2)
on conflict (id) do update set
  titulo=excluded.titulo,
  subtitulo=excluded.subtitulo,
  cta_texto=excluded.cta_texto,
  enlace=excluded.enlace,
  image_url=excluded.image_url,
  activo=excluded.activo,
  orden=excluded.orden,
  updated_at=now();

insert into public.banners
(id,titulo,subtitulo,cta_texto,enlace,storage_path,image_url,activo,orden)
values ('B003','Detalles dulces para compartir y regalar','Galletas, surtidos y preparaciones artesanales para sorprender.','Ver productos','#productos/todos',NULL,'producto-006-surtido-de-masas-secas.jpg',true,3)
on conflict (id) do update set
  titulo=excluded.titulo,
  subtitulo=excluded.subtitulo,
  cta_texto=excluded.cta_texto,
  enlace=excluded.enlace,
  image_url=excluded.image_url,
  activo=excluded.activo,
  orden=excluded.orden,
  updated_at=now();


-- ============================================================================
-- PEDIDOS
-- La hoja PEDIDOS del Excel no tiene registros; no se insertan filas.
-- ============================================================================


-- ============================================================================
-- SOLICITUDES
-- ============================================================================

insert into public.solicitudes
(id,fecha,nombre,telefono,email,fecha_evento,tipo,cantidad,detalle,estado,origen)
values (
  'SOL-20260915-072247-41C4',
  '2026-09-15 07:22:48.124-03'::timestamptz,
  'Alejandro Silva',
  '968613559',
  'alejandrosilva1891@gmail.com',
  '2026-09-15'::date,
  'Cotización general',
  '20',
  'hola buenos dias quisiera 6 tortas variadas que sirvan  para  cubrir 20 personas',
  'NUEVA',
  'MIGRACION_EXCEL'
)
on conflict (id) do update set
  fecha=excluded.fecha,
  nombre=excluded.nombre,
  telefono=excluded.telefono,
  email=excluded.email,
  fecha_evento=excluded.fecha_evento,
  tipo=excluded.tipo,
  cantidad=excluded.cantidad,
  detalle=excluded.detalle,
  estado=excluded.estado,
  origen=excluded.origen,
  updated_at=now();

insert into public.solicitudes
(id,fecha,nombre,telefono,email,fecha_evento,tipo,cantidad,detalle,estado,origen)
values (
  'SOL-20260915-072254-5F68',
  '2026-09-15 07:22:55.120-03'::timestamptz,
  'Alejandro Silva',
  '968613559',
  'alejandrosilva1891@gmail.com',
  '2026-09-15'::date,
  'Cotización general',
  '20',
  'hola buenos dias quisiera 6 tortas variadas que sirvan  para  cubrir 20 personas',
  'NUEVA',
  'MIGRACION_EXCEL'
)
on conflict (id) do update set
  fecha=excluded.fecha,
  nombre=excluded.nombre,
  telefono=excluded.telefono,
  email=excluded.email,
  fecha_evento=excluded.fecha_evento,
  tipo=excluded.tipo,
  cantidad=excluded.cantidad,
  detalle=excluded.detalle,
  estado=excluded.estado,
  origen=excluded.origen,
  updated_at=now();

insert into public.solicitudes
(id,fecha,nombre,telefono,email,fecha_evento,tipo,cantidad,detalle,estado,origen)
values (
  'SOL-20260915-072816-13ED',
  '2026-09-15 07:28:16.372-03'::timestamptz,
  'Alejandro Silva',
  '968613559',
  'alejandrosilva1891@gmail.com',
  '2026-09-15'::date,
  'Cotización general',
  '20',
  'hola buenos dias quisiera 6 tortas variadas que sirvan  para  cubrir 20 personas',
  'NUEVA',
  'MIGRACION_EXCEL'
)
on conflict (id) do update set
  fecha=excluded.fecha,
  nombre=excluded.nombre,
  telefono=excluded.telefono,
  email=excluded.email,
  fecha_evento=excluded.fecha_evento,
  tipo=excluded.tipo,
  cantidad=excluded.cantidad,
  detalle=excluded.detalle,
  estado=excluded.estado,
  origen=excluded.origen,
  updated_at=now();

insert into public.solicitudes
(id,fecha,nombre,telefono,email,fecha_evento,tipo,cantidad,detalle,estado,origen)
values (
  'SOL-20260915-072854-393F',
  '2026-09-15 07:28:55.205-03'::timestamptz,
  'Alejandro Silva',
  '968613559',
  'alejandrosilva1891@gmail.com',
  '2026-09-15'::date,
  'Cotización general',
  '20',
  'hola buenos dias quisiera 6 tortas variadas que sirvan  para  cubrir 20 personas',
  'NUEVA',
  'MIGRACION_EXCEL'
)
on conflict (id) do update set
  fecha=excluded.fecha,
  nombre=excluded.nombre,
  telefono=excluded.telefono,
  email=excluded.email,
  fecha_evento=excluded.fecha_evento,
  tipo=excluded.tipo,
  cantidad=excluded.cantidad,
  detalle=excluded.detalle,
  estado=excluded.estado,
  origen=excluded.origen,
  updated_at=now();

insert into public.solicitudes
(id,fecha,nombre,telefono,email,fecha_evento,tipo,cantidad,detalle,estado,origen)
values (
  'SOL-WEB-MU2JMQIU-19A087WL33',
  '2026-09-15 07:42:47.070-03'::timestamptz,
  'Lendro Silva',
  '968613559',
  'alejandrosilva1891@gmail.com',
  '2026-09-15'::date,
  'Torta personalizada',
  '20',
  'prueba del sistema',
  'NUEVA',
  'MIGRACION_EXCEL'
)
on conflict (id) do update set
  fecha=excluded.fecha,
  nombre=excluded.nombre,
  telefono=excluded.telefono,
  email=excluded.email,
  fecha_evento=excluded.fecha_evento,
  tipo=excluded.tipo,
  cantidad=excluded.cantidad,
  detalle=excluded.detalle,
  estado=excluded.estado,
  origen=excluded.origen,
  updated_at=now();

insert into public.solicitudes
(id,fecha,nombre,telefono,email,fecha_evento,tipo,cantidad,detalle,estado,origen)
values (
  'SOL-WEB-MU2JRRGZ-ABFF5616DS',
  '2026-09-15 07:46:41.653-03'::timestamptz,
  'Alejandro Silva',
  '968613559',
  'alejandrosilva1891@gmail.com',
  '2026-09-15'::date,
  'Torta personalizada',
  '10',
  'prueba del sistema',
  'NUEVA',
  'MIGRACION_EXCEL'
)
on conflict (id) do update set
  fecha=excluded.fecha,
  nombre=excluded.nombre,
  telefono=excluded.telefono,
  email=excluded.email,
  fecha_evento=excluded.fecha_evento,
  tipo=excluded.tipo,
  cantidad=excluded.cantidad,
  detalle=excluded.detalle,
  estado=excluded.estado,
  origen=excluded.origen,
  updated_at=now();

insert into public.solicitudes
(id,fecha,nombre,telefono,email,fecha_evento,tipo,cantidad,detalle,estado,origen)
values (
  'SOL-WEB-MU2KKBV4-1QUB9RLK2T',
  '2026-09-15 08:08:54.569-03'::timestamptz,
  'Alejandro Silva',
  '968613559',
  'alejandrosilva1891@gmail.com',
  '2026-09-15'::date,
  'Torta personalizada',
  '25',
  'prueba del sistema',
  'NUEVA',
  'MIGRACION_EXCEL'
)
on conflict (id) do update set
  fecha=excluded.fecha,
  nombre=excluded.nombre,
  telefono=excluded.telefono,
  email=excluded.email,
  fecha_evento=excluded.fecha_evento,
  tipo=excluded.tipo,
  cantidad=excluded.cantidad,
  detalle=excluded.detalle,
  estado=excluded.estado,
  origen=excluded.origen,
  updated_at=now();

insert into public.solicitudes
(id,fecha,nombre,telefono,email,fecha_evento,tipo,cantidad,detalle,estado,origen)
values (
  'SOL-WEB-MU2LYKHE-115V0V1PUT',
  '2026-09-15 08:48:00.693-03'::timestamptz,
  'Alejandro Silva',
  '968613559',
  'alejandrosilva1891@gmail.com',
  '2026-09-15'::date,
  'Torta personalizada',
  '30',
  'prueba del sistema',
  'NUEVA',
  'MIGRACION_EXCEL'
)
on conflict (id) do update set
  fecha=excluded.fecha,
  nombre=excluded.nombre,
  telefono=excluded.telefono,
  email=excluded.email,
  fecha_evento=excluded.fecha_evento,
  tipo=excluded.tipo,
  cantidad=excluded.cantidad,
  detalle=excluded.detalle,
  estado=excluded.estado,
  origen=excluded.origen,
  updated_at=now();

insert into public.solicitudes
(id,fecha,nombre,telefono,email,fecha_evento,tipo,cantidad,detalle,estado,origen)
values (
  'SOL-WEB-MU2M2EEN-3A23MH7SJJ',
  '2026-09-15 08:50:57.637-03'::timestamptz,
  'Alejandro Silva',
  '968613559',
  'alejandrosilva1891@gmail.com',
  '2026-09-15'::date,
  'Torta personalizada',
  '30',
  'prueba del sistema',
  'NUEVA',
  'MIGRACION_EXCEL'
)
on conflict (id) do update set
  fecha=excluded.fecha,
  nombre=excluded.nombre,
  telefono=excluded.telefono,
  email=excluded.email,
  fecha_evento=excluded.fecha_evento,
  tipo=excluded.tipo,
  cantidad=excluded.cantidad,
  detalle=excluded.detalle,
  estado=excluded.estado,
  origen=excluded.origen,
  updated_at=now();


-- ============================================================================
-- CONFIGURACION
-- ============================================================================

insert into public.config(clave,valor)
values ('empresa','Ale Atencio')
on conflict (clave) do update set valor=excluded.valor, updated_at=now();

insert into public.config(clave,valor)
values ('whatsapp','')
on conflict (clave) do update set valor=excluded.valor, updated_at=now();

insert into public.config(clave,valor)
values ('instagram','')
on conflict (clave) do update set valor=excluded.valor, updated_at=now();

insert into public.config(clave,valor)
values ('facebook','')
on conflict (clave) do update set valor=excluded.valor, updated_at=now();

insert into public.config(clave,valor)
values ('tiktok','')
on conflict (clave) do update set valor=excluded.valor, updated_at=now();

insert into public.config(clave,valor)
values ('email','')
on conflict (clave) do update set valor=excluded.valor, updated_at=now();

insert into public.config(clave,valor)
values ('direccion','')
on conflict (clave) do update set valor=excluded.valor, updated_at=now();

insert into public.config(clave,valor)
values ('valor_despacho','0')
on conflict (clave) do update set valor=excluded.valor, updated_at=now();

insert into public.config(clave,valor)
values ('logo_drive_file_id','')
on conflict (clave) do update set valor=excluded.valor, updated_at=now();

insert into public.config(clave,valor)
values ('moneda','CLP')
on conflict (clave) do update set valor=excluded.valor, updated_at=now();


-- ============================================================================
-- USUARIO ADMINISTRADOR DEL EXCEL
-- Si ya existe un usuario 'admin' en Supabase, NO sobreescribe su clave actual.
-- Si no existe, importa el hash/salt legacy y se migra a bcrypt al primer login.
-- ============================================================================

do $$
declare
  v_existente text;
begin
  select id into v_existente
  from public.usuarios
  where lower(usuario)=lower('admin')
  limit 1;

  if v_existente is null then
    insert into public.usuarios
    (id,nombre,usuario,email,rol,permisos,activo,password_salt,password_hash,profile_path,profile_url,ultimo_acceso,creado_en,updated_at)
    values (
      'USR-ADMIN',
      'Administrador',
      lower('admin'),
      NULL,
      'ADMIN',
      '{}'::jsonb,
      true,
      '1c200b61-92a8-41a0-b85b-4d9ec96d0431',
      '91baa2a8f8477d79bc42c37c862a44c52c6345a4d9d47fd987db8081b1301947',
      NULL,
      NULL,
      '2026-09-15 10:35:14.183-03'::timestamptz,
      '2026-09-15 07:50:07.001-03'::timestamptz,
      '2026-09-15 07:50:07.001-03'::timestamptz
    );
  else
    update public.usuarios
       set nombre='Administrador',
           rol='ADMIN',
           activo=true,
           ultimo_acceso=coalesce('2026-09-15 10:35:14.183-03'::timestamptz,ultimo_acceso),
           updated_at=now()
     where id=v_existente;
  end if;
end $$;


-- ============================================================================
-- AUDITORIA HISTORICA
-- Se inserta solo si no existe una fila equivalente, para poder reejecutar.
-- ============================================================================

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 07:18:09.165-03'::timestamptz,NULL,NULL,'PRECIO','PRODUCTO','P013','{"legacy_detalle":1000}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 07:18:09.165-03'::timestamptz
    and a.accion='PRECIO'
    and a.entidad='PRODUCTO'
    and coalesce(a.entidad_id,'')=coalesce('P013','')
    and a.detalle='{"legacy_detalle":1000}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 07:22:48.716-03'::timestamptz,NULL,NULL,'CREAR','SOLICITUD','SOL-20260915-072247-41C4','{"legacy_detalle":"Alejandro Silva"}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 07:22:48.716-03'::timestamptz
    and a.accion='CREAR'
    and a.entidad='SOLICITUD'
    and coalesce(a.entidad_id,'')=coalesce('SOL-20260915-072247-41C4','')
    and a.detalle='{"legacy_detalle":"Alejandro Silva"}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 07:22:55.628-03'::timestamptz,NULL,NULL,'CREAR','SOLICITUD','SOL-20260915-072254-5F68','{"legacy_detalle":"Alejandro Silva"}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 07:22:55.628-03'::timestamptz
    and a.accion='CREAR'
    and a.entidad='SOLICITUD'
    and coalesce(a.entidad_id,'')=coalesce('SOL-20260915-072254-5F68','')
    and a.detalle='{"legacy_detalle":"Alejandro Silva"}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 07:28:16.617-03'::timestamptz,NULL,NULL,'CREAR','SOLICITUD','SOL-20260915-072816-13ED','{"legacy_detalle":"Alejandro Silva"}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 07:28:16.617-03'::timestamptz
    and a.accion='CREAR'
    and a.entidad='SOLICITUD'
    and coalesce(a.entidad_id,'')=coalesce('SOL-20260915-072816-13ED','')
    and a.detalle='{"legacy_detalle":"Alejandro Silva"}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 07:28:56.172-03'::timestamptz,NULL,NULL,'CREAR','SOLICITUD','SOL-20260915-072854-393F','{"legacy_detalle":"Alejandro Silva"}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 07:28:56.172-03'::timestamptz
    and a.accion='CREAR'
    and a.entidad='SOLICITUD'
    and coalesce(a.entidad_id,'')=coalesce('SOL-20260915-072854-393F','')
    and a.detalle='{"legacy_detalle":"Alejandro Silva"}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 07:42:48.884-03'::timestamptz,NULL,NULL,'CREAR','SOLICITUD','SOL-WEB-MU2JMQIU-19A087WL33','{"legacy_detalle":"Lendro Silva"}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 07:42:48.884-03'::timestamptz
    and a.accion='CREAR'
    and a.entidad='SOLICITUD'
    and coalesce(a.entidad_id,'')=coalesce('SOL-WEB-MU2JMQIU-19A087WL33','')
    and a.detalle='{"legacy_detalle":"Lendro Silva"}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 07:46:42.015-03'::timestamptz,NULL,NULL,'CREAR','SOLICITUD','SOL-WEB-MU2JRRGZ-ABFF5616DS','{"legacy_detalle":"Alejandro Silva"}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 07:46:42.015-03'::timestamptz
    and a.accion='CREAR'
    and a.entidad='SOLICITUD'
    and coalesce(a.entidad_id,'')=coalesce('SOL-WEB-MU2JRRGZ-ABFF5616DS','')
    and a.detalle='{"legacy_detalle":"Alejandro Silva"}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 07:50:07.556-03'::timestamptz,NULL,NULL,'MIGRAR','USUARIO','USR-ADMIN','{"legacy_detalle":"Administrador inicial creado desde credenciales existentes"}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 07:50:07.556-03'::timestamptz
    and a.accion='MIGRAR'
    and a.entidad='USUARIO'
    and coalesce(a.entidad_id,'')=coalesce('USR-ADMIN','')
    and a.detalle='{"legacy_detalle":"Administrador inicial creado desde credenciales existentes"}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 08:08:54.902-03'::timestamptz,NULL,NULL,'CREAR','SOLICITUD','SOL-WEB-MU2KKBV4-1QUB9RLK2T','{"legacy_detalle":"Alejandro Silva"}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 08:08:54.902-03'::timestamptz
    and a.accion='CREAR'
    and a.entidad='SOLICITUD'
    and coalesce(a.entidad_id,'')=coalesce('SOL-WEB-MU2KKBV4-1QUB9RLK2T','')
    and a.detalle='{"legacy_detalle":"Alejandro Silva"}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 08:48:01.161-03'::timestamptz,NULL,NULL,'CREAR','SOLICITUD','SOL-WEB-MU2LYKHE-115V0V1PUT','{"legacy_detalle":"Alejandro Silva"}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 08:48:01.161-03'::timestamptz
    and a.accion='CREAR'
    and a.entidad='SOLICITUD'
    and coalesce(a.entidad_id,'')=coalesce('SOL-WEB-MU2LYKHE-115V0V1PUT','')
    and a.detalle='{"legacy_detalle":"Alejandro Silva"}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 08:50:58.306-03'::timestamptz,NULL,NULL,'CREAR','SOLICITUD','SOL-WEB-MU2M2EEN-3A23MH7SJJ','{"legacy_detalle":"Alejandro Silva"}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 08:50:58.306-03'::timestamptz
    and a.accion='CREAR'
    and a.entidad='SOLICITUD'
    and coalesce(a.entidad_id,'')=coalesce('SOL-WEB-MU2M2EEN-3A23MH7SJJ','')
    and a.detalle='{"legacy_detalle":"Alejandro Silva"}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 10:10:25.786-03'::timestamptz,NULL,NULL,'PRECIO','PRODUCTO','P068','{"legacy_detalle":20000}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 10:10:25.786-03'::timestamptz
    and a.accion='PRECIO'
    and a.entidad='PRODUCTO'
    and coalesce(a.entidad_id,'')=coalesce('P068','')
    and a.detalle='{"legacy_detalle":20000}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 10:10:38.856-03'::timestamptz,NULL,NULL,'PRECIO','PRODUCTO','P068','{"legacy_detalle":20000}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 10:10:38.856-03'::timestamptz
    and a.accion='PRECIO'
    and a.entidad='PRODUCTO'
    and coalesce(a.entidad_id,'')=coalesce('P068','')
    and a.detalle='{"legacy_detalle":20000}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 10:11:42.214-03'::timestamptz,NULL,NULL,'PRECIO','PRODUCTO','P068','{"legacy_detalle":20000}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 10:11:42.214-03'::timestamptz
    and a.accion='PRECIO'
    and a.entidad='PRODUCTO'
    and coalesce(a.entidad_id,'')=coalesce('P068','')
    and a.detalle='{"legacy_detalle":20000}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 10:13:23.319-03'::timestamptz,NULL,NULL,'PRECIO','PRODUCTO','P013','{"legacy_detalle":1000}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 10:13:23.319-03'::timestamptz
    and a.accion='PRECIO'
    and a.entidad='PRODUCTO'
    and coalesce(a.entidad_id,'')=coalesce('P013','')
    and a.detalle='{"legacy_detalle":1000}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 10:13:54.114-03'::timestamptz,NULL,NULL,'PRECIO','PRODUCTO','P013','{"legacy_detalle":1000}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 10:13:54.114-03'::timestamptz
    and a.accion='PRECIO'
    and a.entidad='PRODUCTO'
    and coalesce(a.entidad_id,'')=coalesce('P013','')
    and a.detalle='{"legacy_detalle":1000}'::jsonb
);

insert into public.auditoria
(fecha,actor_usuario_id,actor_usuario,accion,entidad,entidad_id,detalle)
select
  '2026-09-15 10:36:19.892-03'::timestamptz,NULL,NULL,'PRECIO','PRODUCTO','P013','{"legacy_detalle":10000}'::jsonb
where not exists (
  select 1 from public.auditoria a
  where a.fecha='2026-09-15 10:36:19.892-03'::timestamptz
    and a.accion='PRECIO'
    and a.entidad='PRODUCTO'
    and coalesce(a.entidad_id,'')=coalesce('P013','')
    and a.detalle='{"legacy_detalle":10000}'::jsonb
);


commit;

-- ============================================================================
-- VALIDACION FINAL
-- ============================================================================
select 'productos' as tabla, count(*) as registros from public.productos
union all
select 'categorias', count(*) from public.categorias
union all
select 'banners', count(*) from public.banners
union all
select 'pedidos', count(*) from public.pedidos
union all
select 'solicitudes', count(*) from public.solicitudes
union all
select 'config', count(*) from public.config
union all
select 'usuarios', count(*) from public.usuarios
union all
select 'auditoria', count(*) from public.auditoria
order by tabla;

select id,nombre,precio,categoria_nombre,image_url,activo,orden
from public.productos
order by orden
limit 10;

select id,nombre,usuario,rol,activo,ultimo_acceso
from public.usuarios
order by nombre;

select 'ALE_ATENCIO_DATOS_EXCEL_IMPORTADOS_OK' as resultado;
