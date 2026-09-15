-- ============================================================================
-- ALE ATENCIO · SUPABASE R9.5
-- ACTUALIZACION: NUMERO DE SOLICITUD + COTIZACIONES + IVA + PDF
-- Ejecutar UNA VEZ en Supabase > SQL Editor antes de desplegar index.ts R9.5.
-- Es reejecutable y no borra datos existentes.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 1) NUMERO CORRELATIVO VISIBLE DE SOLICITUD
-- --------------------------------------------------------------------------
create sequence if not exists public.ale_solicitud_num_seq start 1;

alter table public.solicitudes
  add column if not exists numero_solicitud text;

create or replace function public.ale_asignar_numero_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(new.numero_solicitud),'') = '' then
    new.numero_solicitud := 'SOL-' || lpad(nextval('public.ale_solicitud_num_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solicitudes_numero on public.solicitudes;
create trigger trg_solicitudes_numero
before insert on public.solicitudes
for each row execute function public.ale_asignar_numero_solicitud();

-- Asigna correlativo a solicitudes históricas que todavía no tengan número.
do $$
declare r record;
begin
  for r in
    select id
    from public.solicitudes
    where coalesce(trim(numero_solicitud),'') = ''
    order by fecha, id
  loop
    update public.solicitudes
       set numero_solicitud = 'SOL-' || lpad(nextval('public.ale_solicitud_num_seq')::text, 6, '0')
     where id = r.id;
  end loop;
end $$;

create unique index if not exists solicitudes_numero_solicitud_uq
  on public.solicitudes(numero_solicitud)
  where numero_solicitud is not null;

-- --------------------------------------------------------------------------
-- 2) COTIZACIONES
-- --------------------------------------------------------------------------
create sequence if not exists public.ale_cotizacion_num_seq start 1;

create table if not exists public.cotizaciones (
  id text primary key default public.ale_generar_id('COT'),
  numero_cotizacion text unique,
  solicitud_id text references public.solicitudes(id) on delete set null,
  numero_solicitud text,
  fecha timestamptz not null default now(),
  cliente_nombre text not null,
  telefono text not null default '',
  email text not null default '',
  moneda text not null default 'CLP',
  validez_dias integer not null default 15 check (validez_dias between 1 and 365),
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  iva_porcentaje numeric(6,2) not null default 19 check (iva_porcentaje between 0 and 100),
  iva numeric(14,2) not null default 0 check (iva >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  estado text not null default 'BORRADOR'
    check (estado in ('BORRADOR','ENVIADA','ACEPTADA','RECHAZADA','VENCIDA','ANULADA')),
  observaciones text not null default '',
  pdf_bucket text,
  pdf_path text,
  pdf_url text,
  creado_por text references public.usuarios(id) on delete set null,
  creado_en timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.ale_asignar_numero_cotizacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(new.numero_cotizacion),'') = '' then
    new.numero_cotizacion := 'COT-' || lpad(nextval('public.ale_cotizacion_num_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cotizaciones_numero on public.cotizaciones;
create trigger trg_cotizaciones_numero
before insert on public.cotizaciones
for each row execute function public.ale_asignar_numero_cotizacion();

drop trigger if exists trg_cotizaciones_updated_at on public.cotizaciones;
create trigger trg_cotizaciones_updated_at
before update on public.cotizaciones
for each row execute function public.ale_set_updated_at();

create index if not exists cotizaciones_fecha_idx on public.cotizaciones(fecha desc);
create index if not exists cotizaciones_estado_idx on public.cotizaciones(estado);
create index if not exists cotizaciones_solicitud_idx on public.cotizaciones(solicitud_id);

-- --------------------------------------------------------------------------
-- 3) CONFIGURACION DE IVA Y VIGENCIA
-- --------------------------------------------------------------------------
insert into public.config(clave,valor) values
  ('iva_porcentaje','19'),
  ('cotizacion_validez_dias','15')
on conflict (clave) do nothing;


-- Permitir también PDF en el bucket público existente.
update storage.buckets
   set public = true,
       file_size_limit = greatest(coalesce(file_size_limit,0),12582912),
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','application/pdf']::text[]
 where id = 'ale-atencio-public';

-- --------------------------------------------------------------------------
-- 4) SEGURIDAD: acceso solamente por la Edge Function con service role/secret
-- --------------------------------------------------------------------------
alter table public.cotizaciones enable row level security;
revoke all on table public.cotizaciones from public, anon, authenticated;
grant all on table public.cotizaciones to service_role;

grant usage, select on sequence public.ale_solicitud_num_seq to service_role;
grant usage, select on sequence public.ale_cotizacion_num_seq to service_role;

revoke all on function public.ale_asignar_numero_solicitud() from public, anon, authenticated;
revoke all on function public.ale_asignar_numero_cotizacion() from public, anon, authenticated;
grant execute on function public.ale_asignar_numero_solicitud() to service_role;
grant execute on function public.ale_asignar_numero_cotizacion() to service_role;

commit;

-- --------------------------------------------------------------------------
-- VERIFICACION
-- --------------------------------------------------------------------------
select count(*) as solicitudes_total,
       count(numero_solicitud) as solicitudes_con_numero
from public.solicitudes;

select numero_solicitud, id, nombre, fecha
from public.solicitudes
order by fecha desc
limit 10;

select clave, valor
from public.config
where clave in ('iva_porcentaje','cotizacion_validez_dias')
order by clave;
