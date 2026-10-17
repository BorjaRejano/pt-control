-- Aplicar después de 003. Permite eliminar únicamente ampliaciones propias.
begin;

grant delete on public.ampliaciones to authenticated;
drop policy if exists "eliminar ampliaciones propias" on public.ampliaciones;
create policy "eliminar ampliaciones propias" on public.ampliaciones for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.trabajos t
      where t.id = trabajo_id and t.user_id = (select auth.uid())
    )
  );

commit;
