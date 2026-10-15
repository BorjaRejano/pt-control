-- PT CONTROL v1.0 - ejecutar una sola vez en SQL Editor de Supabase.
-- IMPORTANTE: crear un unico usuario en Authentication > Users y desactivar registros publicos.
-- Las politicas vinculan cada registro a auth.uid() (cuenta que inicia sesion).

create extension if not exists pgcrypto;

create table if not exists public.trabajos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  descripcion text not null check (char_length(btrim(descripcion)) between 1 and 300),
  numero_permiso text null check (numero_permiso is null or char_length(numero_permiso) <= 70),
  fecha_programada date null,
  zona text null check (zona is null or char_length(zona) <= 150),
  empresa text null check (empresa is null or char_length(empresa) <= 150),
  estado text not null default 'pendiente' check (estado in ('pendiente','emitido','ejecucion','finalizado')),
  notas text null check (notas is null or char_length(notas) <= 6000),
  archivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_trabajos_numero_unico
  on public.trabajos (user_id, upper(btrim(numero_permiso)))
  where numero_permiso is not null and btrim(numero_permiso) <> '';
create index if not exists idx_trabajos_usuario_fecha on public.trabajos(user_id, fecha_programada);
create index if not exists idx_trabajos_usuario_estado on public.trabajos(user_id, estado);

create table if not exists public.ampliaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trabajo_id uuid not null references public.trabajos(id) on delete cascade,
  numero_ampliacion text not null check (char_length(btrim(numero_ampliacion)) between 1 and 70),
  fecha_ampliacion date not null default current_date,
  observaciones text null check (observaciones is null or char_length(observaciones) <= 2000),
  created_at timestamptz not null default now()
);
create unique index if not exists idx_ampliaciones_numero_unico
  on public.ampliaciones (user_id, upper(btrim(numero_ampliacion)));
create index if not exists idx_ampliaciones_trabajo on public.ampliaciones(trabajo_id);

create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trabajo_id uuid not null references public.trabajos(id) on delete cascade,
  contenido text not null check (char_length(btrim(contenido)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists idx_comentarios_trabajo on public.comentarios(trabajo_id, created_at desc);

create table if not exists public.historial_cambios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trabajo_id uuid not null references public.trabajos(id) on delete cascade,
  tipo text not null check (tipo in ('creacion','actualizacion','cambio_estado','ampliacion','archivo')),
  resumen text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_historial_trabajo on public.historial_cambios(trabajo_id, created_at desc);

-- RLS: primero retirar permisos predeterminados y dar solo los estrictamente necesarios.
alter table public.trabajos enable row level security;
alter table public.ampliaciones enable row level security;
alter table public.comentarios enable row level security;
alter table public.historial_cambios enable row level security;
revoke all on table public.trabajos, public.ampliaciones, public.comentarios, public.historial_cambios from anon, authenticated;
grant select, insert, update on table public.trabajos to authenticated;
grant select, insert on table public.ampliaciones, public.comentarios to authenticated;
grant select on table public.historial_cambios to authenticated;

create policy "leer trabajos propios" on public.trabajos for select to authenticated
  using (user_id = (select auth.uid()));
create policy "crear trabajos propios" on public.trabajos for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "editar trabajos propios" on public.trabajos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "leer ampliaciones propias" on public.ampliaciones for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.trabajos t where t.id = trabajo_id and t.user_id = (select auth.uid())
  ));
create policy "crear ampliaciones propias" on public.ampliaciones for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.trabajos t where t.id = trabajo_id and t.user_id = (select auth.uid())
  ));

create policy "leer comentarios propios" on public.comentarios for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.trabajos t where t.id = trabajo_id and t.user_id = (select auth.uid())
  ));
create policy "crear comentarios propios" on public.comentarios for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.trabajos t where t.id = trabajo_id and t.user_id = (select auth.uid())
  ));

create policy "leer historial propio" on public.historial_cambios for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.trabajos t where t.id = trabajo_id and t.user_id = (select auth.uid())
  ));
-- El historial SOLO lo escriben triggers: el cliente no tiene INSERT/UPDATE/DELETE.

create or replace function public.pt_actualizar_fecha() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger pt_trabajos_fecha before update on public.trabajos
for each row execute function public.pt_actualizar_fecha();

create or replace function public.pt_registrar_cambios() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  tipo_evento text;
  mensaje text;
begin
  if tg_op = 'INSERT' then
    tipo_evento := 'creacion';
    mensaje := 'Trabajo incorporado al registro';
  elsif new.archivado is distinct from old.archivado then
    tipo_evento := 'archivo';
    mensaje := case when new.archivado then 'Trabajo archivado' else 'Trabajo recuperado del archivo' end;
  elsif new.estado is distinct from old.estado then
    tipo_evento := 'cambio_estado';
    mensaje := 'Estado: ' || old.estado || ' → ' || new.estado;
  elsif new.fecha_programada is distinct from old.fecha_programada then
    tipo_evento := 'actualizacion';
    mensaje := 'Fecha programada: ' || coalesce(old.fecha_programada::text, 'sin fecha') || ' → ' || coalesce(new.fecha_programada::text, 'sin fecha');
  else
    tipo_evento := 'actualizacion';
    mensaje := 'Datos del trabajo modificados';
  end if;
  insert into public.historial_cambios(user_id, trabajo_id, tipo, resumen)
  values (new.user_id, new.id, tipo_evento, mensaje);
  return new;
end;
$$;
create trigger pt_trabajos_historial after insert or update on public.trabajos
for each row execute function public.pt_registrar_cambios();

create or replace function public.pt_registrar_ampliacion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.historial_cambios(user_id, trabajo_id, tipo, resumen)
  values (new.user_id, new.trabajo_id, 'ampliacion', 'Ampliación registrada: ' || new.numero_ampliacion);
  return new;
end;
$$;
create trigger pt_ampliaciones_historial after insert on public.ampliaciones
for each row execute function public.pt_registrar_ampliacion();

-- Las funciones de trigger no necesitan estar expuestas a usuarios API.
revoke all on function public.pt_actualizar_fecha() from public, anon, authenticated;
revoke all on function public.pt_registrar_cambios() from public, anon, authenticated;
revoke all on function public.pt_registrar_ampliacion() from public, anon, authenticated;
