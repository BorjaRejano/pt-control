-- Aplicar después de 001 y 002. Conserva las tablas y los datos existentes.
begin;

alter table public.ampliaciones alter column numero_ampliacion drop not null;
alter table public.ampliaciones alter column fecha_ampliacion drop not null;
alter table public.ampliaciones alter column fecha_ampliacion drop default;

grant update (numero_ampliacion, fecha_ampliacion, observaciones) on public.ampliaciones to authenticated;
drop policy if exists "editar ampliaciones propias" on public.ampliaciones;
create policy "editar ampliaciones propias" on public.ampliaciones for update to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.trabajos t where t.id = trabajo_id and t.user_id = (select auth.uid())
  )) with check (user_id = (select auth.uid()) and exists (
    select 1 from public.trabajos t where t.id = trabajo_id and t.user_id = (select auth.uid())
  ));

create or replace function public.pt_proteger_ampliacion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.trabajo_id is distinct from old.trabajo_id or new.created_at is distinct from old.created_at then
    raise exception 'No se pueden modificar el identificador, propietario, trabajo o fecha de creación';
  end if;
  return new;
end;
$$;
drop trigger if exists pt_ampliaciones_integridad on public.ampliaciones;
create trigger pt_ampliaciones_integridad before update on public.ampliaciones
for each row execute function public.pt_proteger_ampliacion();

create or replace function public.pt_registrar_ampliacion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare mensaje text;
begin
  if tg_op = 'UPDATE' and new.numero_ampliacion is not distinct from old.numero_ampliacion
    and new.fecha_ampliacion is not distinct from old.fecha_ampliacion
    and new.observaciones is not distinct from old.observaciones then return new; end if;
  mensaje := case when tg_op = 'INSERT' then 'Ampliación registrada: ' else 'Ampliación modificada: ' end
    || coalesce(new.numero_ampliacion, 'número pendiente') || '. Fecha: '
    || coalesce(new.fecha_ampliacion::text, 'pendiente');
  if tg_op = 'UPDATE' then
    mensaje := mensaje || '. Antes: ' || coalesce(old.numero_ampliacion, 'número pendiente')
      || ', ' || coalesce(old.fecha_ampliacion::text, 'fecha pendiente');
  end if;
  insert into public.historial_cambios(user_id, trabajo_id, tipo, resumen)
  values (new.user_id, new.trabajo_id, 'ampliacion', mensaje);
  return new;
end;
$$;
drop trigger if exists pt_ampliaciones_historial on public.ampliaciones;
create trigger pt_ampliaciones_historial after insert or update on public.ampliaciones
for each row execute function public.pt_registrar_ampliacion();

create or replace function public.pt_archivar_finalizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.estado = 'finalizado' then new.archivado := true; end if;
  return new;
end;
$$;
drop trigger if exists pt_archivar_finalizado on public.trabajos;
create trigger pt_archivar_finalizado before insert or update on public.trabajos
for each row execute function public.pt_archivar_finalizado();
update public.trabajos set archivado = true where estado = 'finalizado' and not archivado;

-- Las FK existentes eliminan en cascada ampliaciones, comentarios e historial.
grant delete on public.trabajos to authenticated;
drop policy if exists "eliminar trabajos propios" on public.trabajos;
create policy "eliminar trabajos propios" on public.trabajos for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on function public.pt_proteger_ampliacion() from public, anon, authenticated;
revoke all on function public.pt_registrar_ampliacion() from public, anon, authenticated;
revoke all on function public.pt_archivar_finalizado() from public, anon, authenticated;
commit;
