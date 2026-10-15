import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('migraciones, RLS, relaciones e historial en PostgreSQL temporal', async () => {
  const db = new PGlite()
  const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002'
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;
      insert into auth.users values ('${a}'),('${b}');`)
    const initial = await readFile(new URL('../supabase/migrations/001_pt_control.sql',import.meta.url),'utf8')
    // PGlite incorpora gen_random_uuid; solo se omite la extensión pgcrypto de Supabase.
    await db.exec(initial.replace('create extension if not exists pgcrypto;', ''))
    await db.exec(`set role authenticated; set "request.jwt.claim.sub" = '${a}';`)
    const inserted = await db.query<{id:string}>("insert into trabajos(descripcion) values ('Trabajo ficticio') returning id")
    const id=inserted.rows[0].id
    // Aplicar 002 sobre un registro existente prueba que la migración conserva los datos.
    await db.exec('reset role')
    await db.exec(await readFile(new URL('../supabase/migrations/002_integridad_historial.sql',import.meta.url),'utf8'))
    await db.exec(`set role authenticated; set "request.jwt.claim.sub" = '${a}';`)
    const rows = await db.query<{descripcion:string,numero_permiso:null,fecha_programada:null}>('select * from trabajos')
    assert.equal(rows.rows[0].descripcion,'Trabajo ficticio')
    assert.equal(rows.rows[0].numero_permiso,null)
    assert.equal(rows.rows[0].fecha_programada,null)
    await db.query("update trabajos set estado='ejecucion',fecha_programada='2026-10-15',numero_permiso='FICTICIO-1' where id=$1",[id])
    const audit=await db.query<{resumen:string}>("select resumen from historial_cambios where tipo='cambio_estado'")
    assert.match(audit.rows[0].resumen,/Estado:/)
    assert.match(audit.rows[0].resumen,/Fecha programada:/)
    assert.match(audit.rows[0].resumen,/Número de permiso:/)
    await db.query("insert into ampliaciones(trabajo_id,numero_ampliacion) values ($1,'FICTICIO-AMP')",[id])
    const unchanged=await db.query<{estado:string,numero_permiso:string}>('select estado,numero_permiso from trabajos where id=$1',[id])
    assert.deepEqual(unchanged.rows[0],{estado:'ejecucion',numero_permiso:'FICTICIO-1'})
    await db.query("insert into comentarios(trabajo_id,contenido) values ($1,'Comentario ficticio')",[id])
    assert.equal((await db.query('select created_at from comentarios')).rows.length,1)
    await assert.rejects(db.query('update trabajos set user_id=$1 where id=$2',[b,id]))
    await assert.rejects(db.query("insert into historial_cambios(user_id,trabajo_id,tipo,resumen) values ($1,$2,'actualizacion','Falsificado')",[a,id]))
    await db.exec(`set "request.jwt.claim.sub" = '${b}';`)
    for (const table of ['trabajos','ampliaciones','comentarios','historial_cambios']) {
      assert.equal((await db.query(`select * from ${table}`)).rows.length,0,`Usuario B no debe leer ${table} de A`)
    }
    await assert.rejects(db.query("insert into comentarios(trabajo_id,contenido) values ($1,'Acceso cruzado')",[id]))
    await assert.rejects(db.query("insert into ampliaciones(trabajo_id,numero_ampliacion) values ($1,'CRUZADA')",[id]))
    assert.equal((await db.query("update trabajos set descripcion='Acceso cruzado' where id=$1 returning id",[id])).rows.length,0)
    await db.exec(`set "request.jwt.claim.sub" = '${a}';`)
    await db.query('update trabajos set archivado=true where id=$1',[id])
    assert.equal((await db.query('select * from trabajos where archivado')).rows.length,1)
    await db.query('update trabajos set archivado=false where id=$1',[id])
    assert.equal((await db.query('select * from trabajos where not archivado')).rows.length,1)
    await db.exec('reset role; set role anon;')
    for (const table of ['trabajos','ampliaciones','comentarios','historial_cambios']) {
      await assert.rejects(db.query(`select * from ${table}`))
    }
  } finally { await db.close() }
})
