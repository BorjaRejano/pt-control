import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localToday, addDays, dashboard, validateDescription, csvCell, permitInfo, extensionsFor, nextWorkingDay, isoWeek, mondayOf, filterWorks, defaultFilters, buildCsv, stateChange } from '../src/domain.ts'
import { validPublicConfig } from '../src/config.ts'
import type { Trabajo, Ampliacion } from '../src/lib.ts'

const work = (overrides: Partial<Trabajo> = {}): Trabajo => ({ id:'test',user_id:'test',descripcion:'Trabajo ficticio',numero_permiso:'ORIGINAL',fecha_programada:null,zona:null,empresa:null,estado:'pendiente',notas:null,archivado:false,created_at:'2026-10-15T08:00:00Z',updated_at:'2026-10-15T08:00:00Z',...overrides })
const extension = (overrides: Partial<Ampliacion> = {}): Ampliacion => ({ id:'extension',trabajo_id:'test',numero_ampliacion:'AMP-1',fecha_ampliacion:'2026-10-15',observaciones:null,created_at:'2026-10-15T09:00:00Z',...overrides })

test('fecha de Madrid independiente de la zona del ordenador y horario de verano',()=>{
  assert.equal(localToday(new Date('2026-10-14T22:30:00Z')),'2026-10-15')
  assert.equal(localToday(new Date('2026-12-14T23:30:00Z')),'2026-12-15')
  assert.equal(localToday(new Date('2026-10-25T01:30:00Z')),'2026-10-25')
})
test('aritmética de calendario cruza años, meses y cambios de hora',()=>{
  assert.equal(addDays('2026-12-31',1),'2027-01-01')
  assert.equal(addDays('2026-03-28',2),'2026-03-30')
  assert.equal(addDays('2028-03-01',-1),'2028-02-29')
})
test('próximo día laboral desde jueves, viernes, sábado y domingo',()=>{
  for(const [today,next] of [['2026-10-15','2026-10-16'],['2026-10-16','2026-10-19'],['2026-10-17','2026-10-19'],['2026-10-18','2026-10-19']]) assert.equal(nextWorkingDay(today),next)
})
test('semanas ISO y lunes inicial en el cambio de año',()=>{
  assert.deepEqual(isoWeek('2027-01-01'),{year:2026,week:53})
  assert.deepEqual(isoWeek('2027-01-04'),{year:2027,week:1})
  assert.equal(mondayOf('2027-01-01'),'2026-12-28')
})
test('finalizados y archivados salen de activos sin perderse del registro',()=>{
  const rows=[work(),work({id:'final',estado:'finalizado'}),work({id:'archivo',archivado:true}),work({id:'ejecucion',estado:'ejecucion'})]
  const p=dashboard(rows,'2026-10-15')
  assert.equal(p.active.length,2);assert.equal(p.unplanned.length,2);assert.equal(p.finished.length,1);assert.equal(rows.length,4)
  assert.deepEqual(stateChange(rows[0],'finalizado'),{estado:'finalizado',archivado:true})
  assert.equal(filterWorks(rows,[],{...defaultFilters,archive:true}).length,2)
})
test('la última ampliación se ordena por registro aunque no tenga fecha',()=>{
  const list=[extension(),extension({id:'latest',numero_ampliacion:null,fecha_ampliacion:null,created_at:'2026-10-16T09:00:00Z'}),extension({id:'other',trabajo_id:'other',created_at:'2027-01-01T00:00:00Z'})]
  assert.equal(extensionsFor(list,'test')[0].id,'latest')
  assert.equal(list[0].id,'extension')
})
test('ampliación incompleta usa el último número y fecha conocidos como referencia y avisa',()=>{
  const rows=[extension({numero_ampliacion:'AMP-ANTERIOR',fecha_ampliacion:'2026-10-14'}),extension({id:'pending',numero_ampliacion:null,fecha_ampliacion:null,created_at:'2026-10-16T10:00:00Z'})]
  const p=permitInfo(work({fecha_programada:'2026-10-12'}),rows)
  assert.equal(p.number,'AMP-ANTERIOR');assert.equal(p.date,'2026-10-14');assert.ok(p.numberPending);assert.ok(p.datePending)
  assert.deepEqual(p.warnings,['Falta número de permiso ampliado','Falta fecha de ampliación'])
  assert.equal(dashboard([work()],'2026-10-16',rows).overdue.length,1)
})
test('completar la ampliación elimina avisos y sustituye número y fecha sin duplicar',()=>{
  const record=work({fecha_programada:'2026-10-12',estado:'ejecucion'})
  const ext=extension({numero_ampliacion:null,fecha_ampliacion:null})
  const completed={...ext,numero_ampliacion:'AMP-2',fecha_ampliacion:'2026-10-19'}
  const p=permitInfo(record,[completed])
  assert.equal(p.number,'AMP-2');assert.equal(p.date,'2026-10-19');assert.equal(p.warnings.length,0)
  assert.equal(record.numero_permiso,'ORIGINAL');assert.equal(record.estado,'ejecucion')
  assert.equal(dashboard([record],'2026-10-16',[completed]).overdue.length,0)
  assert.equal(dashboard([record],'2026-10-16',[completed]).upcoming.length,1)
})
test('atrasados excluye hoy, mañana, sin fecha, archivados y finalizados',()=>{
  const rows=[work({id:'ayer',fecha_programada:'2026-10-15'}),work({id:'hoy',fecha_programada:'2026-10-16'}),work({id:'mañana',fecha_programada:'2026-10-17'}),work({id:'sinfecha'}),work({id:'archivado',fecha_programada:'2026-10-10',archivado:true}),work({id:'final',fecha_programada:'2026-10-10',estado:'finalizado'})]
  assert.deepEqual(dashboard(rows,'2026-10-16').overdue.map(w=>w.id),['ayer'])
})
test('las fechas de varias ampliaciones recolocan el permiso una sola vez',()=>{
  const rows=[extension({id:'one',fecha_ampliacion:'2026-10-17'}),extension({id:'two',fecha_ampliacion:'2026-10-19',created_at:'2026-10-16T11:00:00Z'})]
  const p=dashboard([work({fecha_programada:'2026-10-14'})],'2026-10-16',rows)
  assert.equal(p.upcoming.length,1);assert.equal(p.overdue.length,0);assert.equal(p.unplanned.length,0)
})
test('sin una fecha conocida no se inventa una fecha',()=>{
  const p=permitInfo(work({numero_permiso:null}),[extension({numero_ampliacion:null,fecha_ampliacion:null})])
  assert.equal(p.date,null);assert.equal(p.number,null)
  assert.equal(dashboard([work()],'2026-10-16',[extension({fecha_ampliacion:null})]).unplanned.length,1)
})
test('filtros y orden usan el número y fecha vigentes, incluyendo datos originales en búsqueda',()=>{
  const rows=[work({empresa:'Ficticia',zona:'A'}),work({id:'other',empresa:'Otra'})]
  const ex=[extension({numero_ampliacion:'AMP-9',fecha_ampliacion:'2026-10-19'})]
  const f={...defaultFilters,permitNumber:'AMP-9',company:'Ficticia',zone:'A',dateFrom:'2026-10-19',dateTo:'2026-10-19',onlyExtended:true}
  assert.equal(filterWorks(rows,ex,f).length,1)
  assert.equal(filterWorks(rows,ex,{...f,search:'ORIGINAL'}).length,1)
  assert.equal(filterWorks(rows,ex,{...f,dateFrom:'2026-10-20'}).length,0)
})
test('CSV exporta todos los resultados filtrados, su orden, tildes y valores vigentes',()=>{
  const rows=Array.from({length:1201},(_,i)=>work({id:String(i),descripcion:`Trabajo ${i}`,numero_permiso:`PT-${i}`,empresa:i%2?'Otra':'Ficticia'}))
  const visible=filterWorks(rows,[],{...defaultFilters,company:'Ficticia',sortBy:'numero_permiso',sortAsc:false})
  const csv=buildCsv(visible,[])
  assert.ok(csv.startsWith('\ufeff'));assert.equal(csv.split('\r\n').length,602)
  assert.ok(csv.split('\r\n')[1].includes('PT-1200'));assert.ok(!csv.includes('"PT-1"'))
  const ex=[extension({numero_ampliacion:'AMP-9',fecha_ampliacion:'2026-10-19'})]
  assert.ok(buildCsv([work()],ex).includes('"19/10/2026";"AMP-9";"ORIGINAL"'))
})
test('CSV neutraliza fórmulas y escapa comillas, separadores y saltos',()=>{
  assert.equal(csvCell('=1+1'),'"\'=1+1"')
  assert.equal(csvCell('Texto; "prueba"\nSiguiente'),'"Texto; ""prueba""\nSiguiente"')
  assert.equal(csvCell(null),'""')
})
test('valida descripción obligatoria y longitud máxima',()=>{
  assert.ok(validateDescription('   '));assert.ok(validateDescription('a'.repeat(301)));assert.equal(validateDescription('Trabajo ficticio'),null)
})
test('rechaza configuración inválida y claves administrativas',()=>{
  assert.equal(validPublicConfig('incorrecto','sb_publishable_prueba'),false)
  assert.equal(validPublicConfig('https://example.supabase.co','sb_secret_prueba'),false)
  assert.equal(validPublicConfig('https://example.supabase.co','sb_publishable_prueba'),true)
  const jwt=(role:string)=>`eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({role}))}.firma`
  assert.equal(validPublicConfig('https://example.supabase.co',jwt('service_role')),false)
  assert.equal(validPublicConfig('https://example.supabase.co',jwt('anon')),true)
})
