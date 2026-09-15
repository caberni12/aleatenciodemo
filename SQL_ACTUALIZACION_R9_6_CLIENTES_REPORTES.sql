-- ALE ATENCIO R9.6 · CLIENTES + VINCULOS COMERCIALES
-- Ejecutar UNA VEZ después de R9.5. No borra datos existentes.
begin;

create sequence if not exists public.ale_cliente_num_seq start 1;
create or replace function public.ale_normalizar_telefono_cliente(p text) returns text language plpgsql immutable as $$
declare d text:=regexp_replace(coalesce(p,''),'\D','','g');
begin
  if d='' then return null; end if;
  if length(d)=9 and left(d,1)='9' then d:='56'||d;
  elsif length(d)=8 then d:='56'||d;
  end if;
  return d;
end$$;

create table if not exists public.clientes (
  id text primary key default ('CLI-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  numero_cliente text unique,
  nombre text not null,
  telefono text,
  telefono_normalizado text unique,
  email text,
  direccion text,
  comuna text,
  origen_primero text,
  primera_interaccion timestamptz not null default now(),
  ultima_interaccion timestamptz not null default now(),
  total_solicitudes integer not null default 0,
  total_pedidos integer not null default 0,
  total_cotizaciones integer not null default 0,
  total_comprado numeric(14,2) not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.ale_asignar_numero_cliente() returns trigger language plpgsql as $$
begin
  if coalesce(trim(new.numero_cliente),'')='' then new.numero_cliente := 'CLI-' || lpad(nextval('public.ale_cliente_num_seq')::text,6,'0'); end if;
  return new;
end$$;
drop trigger if exists trg_clientes_numero on public.clientes;
create trigger trg_clientes_numero before insert on public.clientes for each row execute function public.ale_asignar_numero_cliente();

do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='solicitudes' and column_name='cliente_id') then alter table public.solicitudes add column cliente_id text references public.clientes(id) on delete set null; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='pedidos' and column_name='cliente_id') then alter table public.pedidos add column cliente_id text references public.clientes(id) on delete set null; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cotizaciones' and column_name='cliente_id') then alter table public.cotizaciones add column cliente_id text references public.clientes(id) on delete set null; end if;
end $$;

create index if not exists clientes_nombre_idx on public.clientes(lower(nombre));
create index if not exists clientes_ultima_idx on public.clientes(ultima_interaccion desc);
create index if not exists solicitudes_cliente_idx on public.solicitudes(cliente_id);
create index if not exists pedidos_cliente_idx on public.pedidos(cliente_id);
create index if not exists cotizaciones_cliente_idx on public.cotizaciones(cliente_id);

-- Backfill: una ficha por teléfono existente en solicitudes/pedidos/cotizaciones.
with raw as (
  select nombre,telefono,email,fecha as f,'SOLICITUD'::text as origen from public.solicitudes where public.ale_normalizar_telefono_cliente(telefono) is not null
  union all select nombre,telefono,email,fecha,'PEDIDO' from public.pedidos where public.ale_normalizar_telefono_cliente(telefono) is not null
  union all select cliente_nombre,telefono,email,fecha,'COTIZACION' from public.cotizaciones where public.ale_normalizar_telefono_cliente(telefono) is not null
), agg as (
  select public.ale_normalizar_telefono_cliente(telefono) phone, max(nombre) nombre, max(telefono) telefono, max(email) email, min(f) primera, max(f) ultima, min(origen) origen
  from raw group by public.ale_normalizar_telefono_cliente(telefono)
)
insert into public.clientes(nombre,telefono,telefono_normalizado,email,origen_primero,primera_interaccion,ultima_interaccion)
select coalesce(nullif(nombre,''),'Cliente'),telefono,phone,nullif(lower(email),''),origen,coalesce(primera,now()),coalesce(ultima,now()) from agg
on conflict (telefono_normalizado) do update set nombre=excluded.nombre,telefono=excluded.telefono,email=coalesce(excluded.email,public.clientes.email),ultima_interaccion=greatest(public.clientes.ultima_interaccion,excluded.ultima_interaccion);

update public.solicitudes s set cliente_id=c.id from public.clientes c where s.cliente_id is null and public.ale_normalizar_telefono_cliente(s.telefono)=c.telefono_normalizado;
update public.pedidos p set cliente_id=c.id from public.clientes c where p.cliente_id is null and public.ale_normalizar_telefono_cliente(p.telefono)=c.telefono_normalizado;
update public.cotizaciones q set cliente_id=c.id from public.clientes c where q.cliente_id is null and public.ale_normalizar_telefono_cliente(q.telefono)=c.telefono_normalizado;

update public.clientes c set
 total_solicitudes=(select count(*) from public.solicitudes s where s.cliente_id=c.id),
 total_pedidos=(select count(*) from public.pedidos p where p.cliente_id=c.id),
 total_cotizaciones=(select count(*) from public.cotizaciones q where q.cliente_id=c.id),
 total_comprado=coalesce((select sum(p.total) from public.pedidos p where p.cliente_id=c.id and upper(coalesce(p.estado,''))='ENTREGADO'),0);

alter table public.clientes enable row level security;
revoke all on table public.clientes from public, anon, authenticated;
grant all on table public.clientes to service_role;
grant usage,select on sequence public.ale_cliente_num_seq to service_role;
revoke all on function public.ale_asignar_numero_cliente() from public,anon,authenticated;
revoke all on function public.ale_normalizar_telefono_cliente(text) from public,anon,authenticated;
grant execute on function public.ale_asignar_numero_cliente() to service_role;
grant execute on function public.ale_normalizar_telefono_cliente(text) to service_role;

commit;

select 'R9.6_OK' as estado,
 (select count(*) from public.clientes) as clientes,
 (select count(*) from public.solicitudes where cliente_id is not null) as solicitudes_vinculadas,
 (select count(*) from public.pedidos where cliente_id is not null) as pedidos_vinculados;
