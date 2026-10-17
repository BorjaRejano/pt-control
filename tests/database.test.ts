import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('migraciones 001–004, ampliaciones pendientes, archivado y borrado seguro con RLS',async()=>{
  const db=new PGlite()
  const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002'
  const migration=async(name:string)=>db.exec((await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;',''))
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;insert into auth.users values('${a}'),('${b}');`)
    await migration('001_pt_control.sql')
    await migration('002_integridad_historial.sql')
    await db.exec(`set role authenticated;set "request.jwt.claim.sub"='${a}';`)
    const id=(await db.query<{id:string}>("insert into trabajos(descripcion,numero_permiso) values('Trabajo ficticio','ORIGINAL') returning id")).rows[0].id
    const oldFinal=(await db.query<{id:string}>("insert into trabajos(descripcion,estado) values('Finalizado anterior','finalizado') returning id")).rows[0].id
    await db.exec('reset role')
    await migration('003_planificacion_ampliaciones.sql')
    // La migración admite volver a aplicarse sin perder datos ni duplicar políticas.
    await migration('003_planificacion_ampliaciones.sql')
    await migration('004_eliminar_ampliaciones.sql')
    await db.exec(`set role authenticated;set "request.jwt.claim.sub"='${a}';`)
    assert.equal((await db.query<{archivado:boolean}>('select archivado from trabajos where id=$1',[oldFinal])).rows[0].archivado,true)
    assert.equal((await db.query('select id from trabajos where id=$1',[id])).rows.length,1)
    const ext=(await db.query<{id:string,numero_ampliacion:null,fecha_ampliacion:null}>("insert into ampliaciones(trabajo_id) values($1) returning *",[id])).rows[0]
    assert.equal(ext.numero_ampliacion,null);assert.equal(ext.fecha_ampliacion,null)
    assert.match((await db.query<{resumen:string}>("select resumen from historial_cambios where tipo='ampliacion'")).rows[0].resumen,/número pendiente/)
    await db.query("update ampliaciones set numero_ampliacion='AMP-1',fecha_ampliacion='2026-10-19' where id=$1",[ext.id])
    assert.equal((await db.query('select * from ampliaciones where trabajo_id=$1',[id])).rows.length,1)
    await db.query("insert into ampliaciones(trabajo_id,numero_ampliacion,fecha_ampliacion) values($1,'AMP-2','2026-10-20')",[id])
    const deletable=(await db.query<{id:string}>("insert into ampliaciones(trabajo_id,numero_ampliacion,fecha_ampliacion) values($1,'AMP-3','2026-10-21') returning id",[id])).rows[0]
    assert.equal((await db.query('delete from ampliaciones where id=$1 returning id',[deletable.id])).rows.length,1)
    await db.query("insert into comentarios(trabajo_id,contenido) values($1,'Comentario ficticio')",[id])
    await db.query("update trabajos set estado='finalizado',fecha_programada='2026-10-16',archivado=false where id=$1",[id])
    assert.equal((await db.query<{archivado:boolean}>('select archivado from trabajos where id=$1',[id])).rows[0].archivado,true)
    assert.equal((await db.query('select * from ampliaciones where trabajo_id=$1',[id])).rows.length,2)
    const audit=(await db.query<{resumen:string}>("select resumen from historial_cambios where trabajo_id=$1 and tipo='cambio_estado'",[id])).rows[0].resumen
    assert.match(audit,/Estado:/);assert.match(audit,/Fecha programada:/);assert.match(audit,/archivado/)
    await db.query('update trabajos set archivado=false where id=$1',[id])
    assert.equal((await db.query<{archivado:boolean}>('select archivado from trabajos where id=$1',[id])).rows[0].archivado,true)
    await db.query("update trabajos set estado='pendiente',archivado=false where id=$1",[id])
    assert.equal((await db.query<{archivado:boolean}>('select archivado from trabajos where id=$1',[id])).rows[0].archivado,false)
    assert.equal((await db.query<{numero_permiso:string}>('select numero_permiso from trabajos where id=$1',[id])).rows[0].numero_permiso,'ORIGINAL')
    await assert.rejects(db.query('update trabajos set user_id=$1 where id=$2',[b,id]))
    await assert.rejects(db.query('update ampliaciones set trabajo_id=$1 where id=$2',[oldFinal,ext.id]))
    await assert.rejects(db.query("insert into historial_cambios(user_id,trabajo_id,tipo,resumen) values($1,$2,'actualizacion','Falso')",[a,id]))
    await db.exec(`set "request.jwt.claim.sub"='${b}';`)
    for(const table of ['trabajos','ampliaciones','comentarios','historial_cambios'])assert.equal((await db.query(`select * from ${table}`)).rows.length,0)
    assert.equal((await db.query('delete from trabajos where id=$1 returning id',[id])).rows.length,0)
    assert.equal((await db.query("update ampliaciones set numero_ampliacion='CRUZADA' where id=$1 returning id",[ext.id])).rows.length,0)
    await assert.rejects(db.query("insert into comentarios(trabajo_id,contenido) values($1,'Acceso cruzado')",[id]))
    await assert.rejects(db.query('insert into ampliaciones(trabajo_id) values($1)',[id]))
    await db.exec(`set "request.jwt.claim.sub"='${a}';`)
    assert.equal((await db.query('delete from trabajos where id=$1 returning id',[id])).rows.length,1)
    for(const table of ['ampliaciones','comentarios','historial_cambios'])assert.equal((await db.query(`select * from ${table} where trabajo_id=$1`,[id])).rows.length,0)
    assert.equal((await db.query('select * from trabajos where id=$1',[oldFinal])).rows.length,1)
    await db.exec('reset role;set role anon;')
    for(const table of ['trabajos','ampliaciones','comentarios','historial_cambios'])await assert.rejects(db.query(`select * from ${table}`))
    await assert.rejects(db.query('delete from trabajos where id=$1',[oldFinal]))
  }finally{await db.close()}
})
