-- Solo lectura: no cambia tablas, permisos ni registros.
-- Ejecutar en el SQL Editor del proyecto uxhltqypmxgnkkwhrmpp.
select '01_numero_admite_vacios' as comprobacion,
       is_nullable as resultado, 'YES' as esperado
from information_schema.columns
where table_schema = 'public' and table_name = 'ampliaciones' and column_name = 'numero_ampliacion'
union all
select '02_fecha_admite_vacios', is_nullable, 'YES'
from information_schema.columns
where table_schema = 'public' and table_name = 'ampliaciones' and column_name = 'fecha_ampliacion'
union all
select '03_editar_numero', has_column_privilege('authenticated', 'public.ampliaciones', 'numero_ampliacion', 'UPDATE')::text, 'true'
union all
select '04_editar_fecha', has_column_privilege('authenticated', 'public.ampliaciones', 'fecha_ampliacion', 'UPDATE')::text, 'true'
union all
select '05_editar_observaciones', has_column_privilege('authenticated', 'public.ampliaciones', 'observaciones', 'UPDATE')::text, 'true'
union all
select '06_politica_edicion', exists (
  select 1 from pg_policies where schemaname = 'public' and tablename = 'ampliaciones'
    and policyname = 'editar ampliaciones propias' and cmd = 'UPDATE'
)::text, 'true'
union all
select '07_trigger_archivado', exists (
  select 1 from pg_trigger where tgrelid = 'public.trabajos'::regclass
    and tgname = 'pt_archivar_finalizado' and tgenabled <> 'D'
)::text, 'true'
union all
select '08_permiso_eliminar', has_table_privilege('authenticated', 'public.trabajos', 'DELETE')::text, 'true'
union all
select '09_politica_eliminar', exists (
  select 1 from pg_policies where schemaname = 'public' and tablename = 'trabajos'
    and policyname = 'eliminar trabajos propios' and cmd = 'DELETE'
)::text, 'true'
union all
select '10_permiso_eliminar_ampliaciones', has_table_privilege('authenticated', 'public.ampliaciones', 'DELETE')::text, 'true'
union all
select '11_politica_eliminar_ampliaciones', exists (
  select 1 from pg_policies where schemaname = 'public' and tablename = 'ampliaciones'
    and policyname = 'eliminar ampliaciones propias' and cmd = 'DELETE'
)::text, 'true'
order by comprobacion;
