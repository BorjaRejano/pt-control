-- Aplicar después de 001. No elimina tablas ni registros.
begin;

-- Impide alterar identificadores o fechas de creación mediante la API.
create or replace function public.pt_actualizar_fecha() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'No se pueden modificar el identificador, propietario o fecha de creación';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Conserva todos los cambios de una edición, incluso si cambian estado y fecha juntos.
create or replace function public.pt_registrar_cambios() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  tipo_evento text := 'actualizacion';
  mensaje text := '';
begin
  if tg_op = 'INSERT' then
    tipo_evento := 'creacion';
    mensaje := 'Trabajo incorporado al registro';
  else
    if new.archivado is distinct from old.archivado then
      tipo_evento := 'archivo';
      mensaje := case when new.archivado then 'Trabajo archivado. ' else 'Trabajo recuperado del archivo. ' end;
    end if;
    if new.estado is distinct from old.estado then
      tipo_evento := 'cambio_estado';
      mensaje := mensaje || 'Estado: ' || old.estado || ' → ' || new.estado || '. ';
    end if;
    if new.fecha_programada is distinct from old.fecha_programada then
      mensaje := mensaje || 'Fecha programada: ' || coalesce(old.fecha_programada::text, 'sin fecha') || ' → ' || coalesce(new.fecha_programada::text, 'sin fecha') || '. ';
    end if;
    if new.numero_permiso is distinct from old.numero_permiso then
      mensaje := mensaje || 'Número de permiso: ' || coalesce(old.numero_permiso, 'sin número') || ' → ' || coalesce(new.numero_permiso, 'sin número') || '. ';
    end if;
    if new.descripcion is distinct from old.descripcion then mensaje := mensaje || 'Descripción modificada. '; end if;
    if new.empresa is distinct from old.empresa then mensaje := mensaje || 'Empresa modificada. '; end if;
    if new.zona is distinct from old.zona then mensaje := mensaje || 'Zona modificada. '; end if;
    if new.notas is distinct from old.notas then mensaje := mensaje || 'Notas modificadas. '; end if;
    if mensaje = '' then return new; end if;
  end if;
  insert into public.historial_cambios(user_id, trabajo_id, tipo, resumen)
  values (new.user_id, new.id, tipo_evento, btrim(mensaje));
  return new;
end;
$$;

create index if not exists idx_comentarios_usuario on public.comentarios(user_id);
create index if not exists idx_ampliaciones_usuario on public.ampliaciones(user_id);
create index if not exists idx_historial_usuario on public.historial_cambios(user_id);
revoke all on function public.pt_actualizar_fecha() from public, anon, authenticated;
revoke all on function public.pt_registrar_cambios() from public, anon, authenticated;
commit;
