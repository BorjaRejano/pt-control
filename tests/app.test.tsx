import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Blob as NodeBlob } from 'node:buffer'
import App from '../src/App'
import { localToday, type Trabajo } from '../src/lib'
import { addDays, isoWeek, mondayOf } from '../src/domain'

function visualSnapshot(name:string){
  if(!process.env.PT_QA_EXPORT)return
  mkdirSync('.qa',{recursive:true})
  writeFileSync(`.qa/${name}.html`,`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PT CONTROL · Prueba visual</title><style>${readFileSync('src/styles.css','utf8')}</style><body><div style="padding:8px;background:#fff0e1;text-align:center;font:12px Arial">PRUEBA VISUAL · Datos ficticios · Sin guardado</div>${document.body.innerHTML}</body></html>`)
}
const mock=vi.hoisted(()=>({session:null as unknown,records:[] as Record<string,unknown>[],extensions:[] as Record<string,unknown>[],comments:[] as Record<string,unknown>[],history:[] as Record<string,unknown>[],writes:[] as Record<string,unknown>[],failNext:null as string|null,fetchFail:false,counter:0,blob:null as unknown,fetch:vi.fn(),login:vi.fn()}))
vi.mock('../src/lib',async original=>{
  const actual=await original<typeof import('../src/lib')>()
  return {...actual,configured:true,fetchAll:mock.fetch,supabase:{
    auth:{getSession:async()=>({data:{session:mock.session},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}}),signInWithPassword:mock.login,signOut:async()=>({error:null})},
    from:(table:string)=>{
      let op='',payload:Record<string,unknown>={},conditions:Record<string,unknown>={}
      const store=()=>table==='trabajos'?mock.records:table==='ampliaciones'?mock.extensions:mock.comments
      const query={
        insert:(data:Record<string,unknown>)=>{op='insert';payload=data;return query},
        update:(data:Record<string,unknown>)=>{op='update';payload=data;return query},
        delete:()=>{op='delete';return query},
        eq:(key:string,value:unknown)=>{conditions[key]=value;return query},
        select:()=>query,
        single:async()=>{
          mock.writes.push({table,op,payload:{...payload},conditions:{...conditions}})
          if(mock.failNext){const message=mock.failNext;mock.failNext=null;return {data:null,error:{message}}}
          const rows=store(),index=rows.findIndex(row=>Object.entries(conditions).every(([key,value])=>row[key]===value))
          if(op==='insert'){
            const data={id:`insert-${++mock.counter}`,created_at:`${localToday()}T23:50:${String(mock.counter).padStart(2,'0')}Z`,...(table==='trabajos'?{user_id:'test',archivado:false,updated_at:'',zona:null,empresa:null,notas:null}:{}),...payload}
            rows.unshift(data)
            return {data,error:null}
          }
          if(index<0)return {data:null,error:{message:'No se encontró el registro'}}
          if(op==='delete'){
            const [data]=rows.splice(index,1)
            mock.extensions=mock.extensions.filter(e=>e.trabajo_id!==data.id);mock.comments=mock.comments.filter(e=>e.trabajo_id!==data.id);mock.history=mock.history.filter(e=>e.trabajo_id!==data.id)
            return {data,error:null}
          }
          rows[index]={...rows[index],...payload}
          if(table==='trabajos'&&rows[index].estado==='finalizado')rows[index].archivado=true
          return {data:rows[index],error:null}
        },
      }
      return query
    },
  }}
})
function work(fields:Partial<Trabajo>={}):Trabajo{return {id:'ficticio-1',user_id:'test',descripcion:'Trabajo ficticio de prueba',numero_permiso:'FICTICIO-ORIGINAL',fecha_programada:null,estado:'pendiente',empresa:'Empresa ficticia A',zona:'Zona ficticia A',notas:null,archivado:false,created_at:`${localToday()}T09:00:00Z`,updated_at:'',...fields}}
const extension=(fields:Record<string,unknown>={})=>({id:'amp-1',trabajo_id:'ficticio-1',numero_ampliacion:'AMP-ANTERIOR',fecha_ampliacion:localToday(),created_at:`${addDays(localToday(),-1)}T09:00:00Z`,observaciones:null,...fields})
async function showApp(){render(<App/>);await screen.findByRole('heading',{name:'Panel diario'});await waitFor(()=>expect(mock.fetch).toHaveBeenCalledWith('trabajos'));await waitFor(()=>expect(screen.queryByText('Sincronizando datos…')).toBeNull())}
function submit(buttonName:string){fireEvent.submit(screen.getByRole('button',{name:buttonName,exact:true}).closest('form')!)}
beforeEach(()=>{
  mock.session={user:{id:'test'}};mock.records=[work() as unknown as Record<string,unknown>];mock.extensions=[];mock.comments=[];mock.history=[];mock.writes=[];mock.failNext=null;mock.fetchFail=false;mock.counter=0;mock.blob=null
  mock.fetch.mockImplementation(async table=>{if(mock.fetchFail)throw new Error('Failed to fetch');return table==='trabajos'?[...mock.records]:table==='ampliaciones'?[...mock.extensions]:table==='comentarios'?[...mock.comments]:[...mock.history]})
  mock.login.mockResolvedValue({error:null})
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn(blob=>{mock.blob=blob;return 'blob:test'})})
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()})
  vi.stubGlobal('Blob',NodeBlob)
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})

describe('flujos completos con backend simulado solo en pruebas',()=>{
  it('clasifica el panel por fecha vigente, estado y ampliaciones y muestra el año',async()=>{
    const today=localToday()
    mock.records=[
      work({id:'pasado',descripcion:'Pasado pendiente',fecha_programada:addDays(today,-1)}),
      work({id:'emitido-pasado',descripcion:'Pasado emitido',fecha_programada:addDays(today,-2),estado:'emitido'}),
      work({id:'ejecucion-pasada',descripcion:'Pasado en ejecución',fecha_programada:addDays(today,-3),estado:'ejecucion'}),
      work({id:'hoy',descripcion:'Trabajo de hoy',fecha_programada:today}),
      work({id:'futuro',descripcion:'Futuro pendiente',fecha_programada:addDays(today,1)}),
      work({id:'lejano',descripcion:'Futuro emitido',fecha_programada:addDays(today,45),estado:'emitido'}),
      work({id:'ampliado',descripcion:'Futuro ampliado',fecha_programada:addDays(today,-7),estado:'ejecucion'}),
      work({id:'ejecucion',descripcion:'Ejecución futura sin ampliar',fecha_programada:addDays(today,2),estado:'ejecucion'}),
      work({id:'final',descripcion:'Finalizado excluido',fecha_programada:addDays(today,-1),estado:'finalizado'}),
      work({id:'archivo',descripcion:'Archivado excluido',fecha_programada:addDays(today,1),archivado:true}),
    ] as unknown as Record<string,unknown>[]
    mock.extensions=[extension({trabajo_id:'ampliado',fecha_ampliacion:addDays(today,10)})]
    await showApp()
    const section=(name:string)=>within(screen.getByRole('heading',{name,exact:true}).closest('section')!)
    const descriptions=(name:string)=>section(name).getAllByRole('button',{name:/^Abrir /}).map(b=>b.getAttribute('aria-label'))
    expect(descriptions('Trabajos con fecha anterior aún abiertos')).toEqual(['Abrir Pasado en ejecución','Abrir Pasado emitido','Abrir Pasado pendiente'])
    expect(descriptions('Trabajos de hoy')).toEqual(['Abrir Trabajo de hoy'])
    expect(descriptions('Próximos trabajos')).toEqual(['Abrir Futuro pendiente','Abrir Futuro ampliado','Abrir Futuro emitido'])
    expect((section('Próximos trabajos').getByLabelText('Fecha programada de Futuro emitido') as HTMLInputElement).value).toBe(addDays(today,45))
    visualSnapshot('panel-fechas')
  })
  it('inicia automáticamente los permisos cuya fecha vigente es hoy',async()=>{
    const today=localToday()
    mock.records=[
      work({id:'pendiente-hoy',fecha_programada:today}),
      work({id:'emitido-hoy',fecha_programada:today,estado:'emitido'}),
      work({id:'finalizado-hoy',fecha_programada:today,estado:'finalizado'}),
      work({id:'archivado-hoy',fecha_programada:today,archivado:true}),
    ] as unknown as Record<string,unknown>[]
    await showApp()
    await waitFor(()=>expect(mock.records.every(work=>work.estado==='ejecucion')).toBe(true))
    expect(mock.records.every(work=>work.archivado===false)).toBe(true)
    expect(mock.writes.filter(write=>write.table==='trabajos'&&write.op==='update')).toHaveLength(4)
  })
  it('protege las vistas e informa de credenciales incorrectas',async()=>{
    mock.session=null;mock.login.mockResolvedValue({error:{message:'Invalid login credentials'}})
    render(<App/>);await screen.findByRole('heading',{name:'Acceso personal'});visualSnapshot('acceso')
    fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'ficticio@example.com'}});fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'solo-prueba'}})
    submit('Entrar en PT CONTROL')
    expect((await screen.findByRole('alert')).textContent).toContain('correo o la contraseña')
    expect(mock.fetch).not.toHaveBeenCalled()
  })
  it('valida descripción y guarda un trabajo sin número ni fecha',async()=>{
    await showApp();fireEvent.click(screen.getByRole('button',{name:'Nuevo trabajo'}))
    const input=screen.getByLabelText('Descripción del trabajo *')
    fireEvent.change(input,{target:{value:'   '}});submit('Guardar trabajo')
    expect(screen.getByRole('alert').textContent).toContain('Introduce una descripción');expect(mock.writes).toHaveLength(0)
    fireEvent.change(input,{target:{value:'Trabajo nuevo ficticio'}});visualSnapshot('formulario');submit('Guardar trabajo')
    await screen.findByRole('status')
    expect(mock.records.find(w=>w.descripcion==='Trabajo nuevo ficticio')).toMatchObject({numero_permiso:null,fecha_programada:null,estado:'pendiente',archivado:false})
  })
  it('no comunica éxito y conserva el formulario cuando falla un guardado',async()=>{
    await showApp();fireEvent.click(screen.getByRole('button',{name:'Nuevo trabajo'}))
    fireEvent.change(screen.getByLabelText('Descripción del trabajo *'),{target:{value:'Prueba con error'}});mock.failNext='duplicate key';submit('Guardar trabajo')
    expect((await screen.findByRole('alert')).textContent).toContain('ya está registrado');expect(screen.queryByRole('status')).toBeNull();expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('finalizar desde la tarjeta archiva y se mantiene al volver a cargar',async()=>{
    await showApp();fireEvent.change(screen.getByLabelText('Estado de Trabajo ficticio de prueba'),{target:{value:'finalizado'}})
    expect((await screen.findByRole('status')).textContent).toContain('finalizado y archivado')
    expect(mock.records[0]).toMatchObject({estado:'finalizado',archivado:true})
    expect(screen.queryByRole('button',{name:'Abrir Trabajo ficticio de prueba'})).toBeNull()
    cleanup();await showApp();expect(screen.queryByRole('button',{name:'Abrir Trabajo ficticio de prueba'})).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'Archivados',exact:true}));expect(screen.getByText('Trabajo ficticio de prueba')).toBeTruthy()
  })
  it('actualiza la fecha vigente desde la tarjeta sin abrir el detalle',async()=>{
    await showApp()
    const date=addDays(localToday(),4)
    const control=screen.getByLabelText('Fecha programada de Trabajo ficticio de prueba')
    fireEvent.click(control)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.change(control,{target:{value:date}})
    await screen.findByRole('status')
    expect(mock.records[0].fecha_programada).toBe(date)
    expect(mock.writes.at(-1)).toMatchObject({table:'trabajos',op:'update',payload:{fecha_programada:date}})
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('reprograma un permiso al arrastrar su ficha a otro día del calendario',async()=>{
    const today=localToday(),tomorrow=addDays(today,1)
    mock.records=[work({fecha_programada:today}) as unknown as Record<string,unknown>]
    await showApp();fireEvent.click(screen.getByRole('button',{name:'Calendario',exact:true}))
    const event=screen.getByRole('button',{name:/FICTICIO-ORIGINAL.*Trabajo ficticio de prueba/})
    const dataTransfer={data:{},effectAllowed:'',dropEffect:'',setData(key:string,value:string){this.data[key]=value},getData(key:string){return this.data[key]||''}}
    fireEvent.dragStart(event,{dataTransfer})
    const target=screen.getAllByText(String(Number(tomorrow.slice(8))),{selector:'.day-header strong'}).find(node=>node.closest('.day-column')?.querySelector('.day-event')===null)?.closest('.day-column')!
    fireEvent.drop(target,{dataTransfer})
    await screen.findByRole('status')
    expect(mock.records[0].fecha_programada).toBe(tomorrow)
    expect(mock.writes.at(-1)).toMatchObject({table:'trabajos',op:'update',payload:{fecha_programada:tomorrow}})
  })
  it('finalizar desde la ficha también archiva',async()=>{
    await showApp();fireEvent.click(screen.getByRole('button',{name:'Abrir Trabajo ficticio de prueba'}))
    fireEvent.change(screen.getByLabelText('Estado del permiso'),{target:{value:'finalizado'}});submit('Guardar trabajo')
    await screen.findByRole('status');expect(mock.records[0]).toMatchObject({estado:'finalizado',archivado:true})
  })
  it('cancelar ampliación conserva el borrador y cerrar diálogos anidados libera el scroll',async()=>{
    await showApp();fireEvent.click(screen.getByRole('button',{name:'Abrir Trabajo ficticio de prueba'}))
    fireEvent.change(screen.getByLabelText('Descripción del trabajo *'),{target:{value:'Borrador sin guardar'}})
    fireEvent.change(screen.getByLabelText('Estado del permiso'),{target:{value:'ampliar'}})
    fireEvent.click(within(screen.getByRole('dialog',{name:'Nueva ampliación'})).getByRole('button',{name:'Cancelar',exact:true}))
    expect((screen.getByLabelText('Descripción del trabajo *') as HTMLInputElement).value).toBe('Borrador sin guardar')
    expect(mock.writes).toHaveLength(0)
    fireEvent.click(screen.getByRole('button',{name:'Eliminar permiso',exact:true}))
    fireEvent.click(screen.getByRole('button',{name:'Eliminar definitivamente'}))
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(document.body.style.overflow).toBe('')
  })
  it('cancelar Ampliado no altera el estado ni crea ampliaciones',async()=>{
    await showApp();fireEvent.change(screen.getByLabelText('Estado de Trabajo ficticio de prueba'),{target:{value:'ampliar'}})
    expect(screen.getByRole('dialog',{name:'Nueva ampliación'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'Cancelar',exact:true}))
    expect(mock.writes).toHaveLength(0);expect(mock.extensions).toHaveLength(0);expect(mock.records[0].estado).toBe('pendiente')
  })
  it('puede reabrir un finalizado y volver a editarlo sin recuperar un estado obsoleto',async()=>{
    mock.records=[work({archivado:true,estado:'finalizado'}) as unknown as Record<string,unknown>]
    await showApp();fireEvent.click(screen.getByRole('button',{name:'Archivados',exact:true}))
    fireEvent.click(screen.getByRole('button',{name:'Trabajo ficticio de prueba',exact:true}))
    fireEvent.click(screen.getByRole('button',{name:'Reabrir y recuperar del archivo'}))
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
    expect(mock.records[0]).toMatchObject({estado:'pendiente',archivado:false})
    fireEvent.click(screen.getByRole('button',{name:'Panel diario',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Abrir Trabajo ficticio de prueba'}))
    expect((screen.getByLabelText('Estado del permiso') as HTMLSelectElement).value).toBe('pendiente')
  })
  it('completar desde la tarjeta abre la ampliación pendiente aunque sea anterior',async()=>{
    mock.extensions=[extension({numero_ampliacion:null,fecha_ampliacion:null}),extension({id:'latest',numero_ampliacion:'AMP-ACTUAL',created_at:`${localToday()}T09:00:00Z`})]
    await showApp();fireEvent.click(screen.getByRole('button',{name:'Completar ampliación'}))
    expect((screen.getByLabelText('Nuevo número de permiso') as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByLabelText('Nuevo número de permiso'),{target:{value:'12345'}});fireEvent.change(screen.getByLabelText('Nueva fecha de ampliación'),{target:{value:localToday()}});submit('Guardar ampliación')
    await waitFor(()=>expect(mock.writes.some(w=>w.op==='update'&&(w.conditions as Record<string,unknown>)?.id==='amp-1')).toBe(true))
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button',{name:'Abrir Trabajo ficticio de prueba'}).textContent).toContain('AMP-ACTUAL')
  })
  it('guarda una ampliación incompleta y la completa mediante UPDATE sin duplicar',async()=>{
    await showApp();fireEvent.change(screen.getByLabelText('Estado de Trabajo ficticio de prueba'),{target:{value:'ampliar'}});submit('Añadir ampliación')
    await screen.findByRole('status')
    expect(mock.extensions).toHaveLength(1);expect(mock.extensions[0]).toMatchObject({numero_ampliacion:null,fecha_ampliacion:null})
    expect(screen.getByText('Falta número de permiso ampliado')).toBeTruthy();expect(screen.getByText('Falta fecha de ampliación')).toBeTruthy()
    visualSnapshot('ampliacion-pendiente')
    fireEvent.click(screen.getByRole('button',{name:'Completar ampliación'}))
    fireEvent.change(screen.getByLabelText('Nuevo número de permiso'),{target:{value:'12345'}});fireEvent.change(screen.getByLabelText('Nueva fecha de ampliación'),{target:{value:localToday()}});submit('Guardar ampliación')
    await waitFor(()=>expect(mock.extensions[0].numero_ampliacion).toBe('12345'))
    await waitFor(()=>expect(screen.queryByText('Falta número de permiso ampliado')).toBeNull())
    expect(mock.extensions).toHaveLength(1);expect(mock.records[0].numero_permiso).toBe('FICTICIO-ORIGINAL');expect(mock.records[0].estado).toBe('ejecucion')
    expect(mock.writes.filter(w=>w.table==='ampliaciones').map(w=>w.op)).toEqual(['insert','update'])
  })
  it('muestra la ampliación actual en tarjeta, ficha, registro, calendario y CSV',async()=>{
    mock.extensions=[extension(),extension({id:'amp-2',numero_ampliacion:'AMP-ACTUAL',created_at:`${localToday()}T09:00:00Z`})]
    await showApp();const card=screen.getByRole('button',{name:'Abrir Trabajo ficticio de prueba'});expect(card.textContent).toContain('AMP-ACTUAL');visualSnapshot('panel')
    fireEvent.click(card);expect(screen.getByText('FICTICIO-ORIGINAL',{exact:false})).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:/Ver historial de ampliaciones/}));expect(screen.getByRole('heading',{name:'Historial de ampliaciones'})).toBeTruthy();expect(screen.getByRole('button',{name:'Eliminar ampliación AMP-ACTUAL'})).toBeTruthy();visualSnapshot('historial-ampliaciones')
    fireEvent.click(screen.getByRole('button',{name:'Cerrar',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Registro',exact:true}))
    expect(screen.getByRole('table').textContent).toContain('AMP-ACTUAL');visualSnapshot('registro')
    fireEvent.click(screen.getByRole('button',{name:'CSV Excel'}));const csv=await (mock.blob as NodeBlob).text();expect(csv).toContain('AMP-ACTUAL');expect(csv).toContain('FICTICIO-ORIGINAL')
    fireEvent.click(screen.getByRole('button',{name:'Calendario',exact:true}));expect(screen.getAllByRole('button',{name:/AMP-ACTUAL.*Trabajo ficticio/})).toHaveLength(1)
    const week=isoWeek(localToday()),next=isoWeek(addDays(mondayOf(localToday()),7))
    expect(screen.getByRole('heading',{name:`Semana ${week.week} · ${week.year}`})).toBeTruthy();expect(screen.getByRole('heading',{name:`Semana ${next.week} · ${next.year}`})).toBeTruthy();visualSnapshot('calendario')
  })
  it('permite editar desde la ficha y eliminar una ampliación desde su historial',async()=>{
    mock.extensions=[extension()]
    await showApp()
    fireEvent.click(screen.getByRole('button',{name:'Editar ampliación'}))
    expect(screen.getByRole('dialog',{name:'Editar ampliación'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'Cancelar',exact:true}))
    fireEvent.click(screen.getByRole('button',{name:'Abrir Trabajo ficticio de prueba'}))
    fireEvent.click(screen.getByRole('button',{name:/Ver historial de ampliaciones/}))
    fireEvent.click(screen.getByRole('button',{name:'Eliminar ampliación AMP-ANTERIOR'}))
    expect(screen.getByRole('alertdialog',{name:'Eliminar ampliación'}).textContent).toContain('no se puede deshacer')
    fireEvent.click(screen.getByRole('button',{name:'Cancelar',exact:true}))
    expect(mock.extensions).toHaveLength(1)
    fireEvent.click(screen.getByRole('button',{name:'Eliminar ampliación AMP-ANTERIOR'}))
    fireEvent.click(screen.getByRole('button',{name:'Eliminar ampliación',exact:true}))
    await waitFor(()=>expect(mock.extensions).toHaveLength(0))
    expect(mock.writes.some(write=>write.table==='ampliaciones'&&write.op==='delete')).toBe(true)
  })
  it('CSV combina filtros y exporta únicamente el listado visible',async()=>{
    mock.records=[work() as unknown as Record<string,unknown>,work({id:'other',descripcion:'Trabajo seleccionado ficticio',empresa:'Empresa ficticia B',fecha_programada:localToday()}) as unknown as Record<string,unknown>]
    await showApp();fireEvent.click(screen.getByRole('button',{name:'Registro',exact:true}));fireEvent.change(screen.getByLabelText('Empresa'),{target:{value:'Empresa ficticia B'}});fireEvent.change(screen.getByLabelText('Desde'),{target:{value:localToday()}})
    fireEvent.click(screen.getByRole('button',{name:'CSV Excel'}));const csv=await (mock.blob as NodeBlob).text();expect(csv).toContain('Trabajo seleccionado ficticio');expect(csv).not.toContain('Trabajo ficticio de prueba')
    fireEvent.click(screen.getByRole('button',{name:'Limpiar filtros'}));expect(screen.getByText('Trabajo ficticio de prueba')).toBeTruthy()
  })
  it('un cambio rápido fallido conserva el estado anterior',async()=>{
    await showApp();mock.failNext='Failed to fetch';fireEvent.change(screen.getByLabelText('Estado de Trabajo ficticio de prueba'),{target:{value:'ejecucion'}})
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo conectar');expect(mock.records[0].estado).toBe('pendiente');expect((screen.getByLabelText('Estado de Trabajo ficticio de prueba') as HTMLSelectElement).value).toBe('pendiente');expect(screen.queryByRole('status')).toBeNull()
  })
  it.each([false,true])('confirma y elimina permisos activos/archivados (archivado=%s)',async archived=>{
    mock.records=[work({archivado:archived}) as unknown as Record<string,unknown>];mock.extensions=[extension({fecha_ampliacion:addDays(localToday(),1)})]
    await showApp();if(archived)fireEvent.click(screen.getByRole('button',{name:'Archivados',exact:true}))
    fireEvent.click(screen.getByRole('button',{name:'Eliminar Trabajo ficticio de prueba'}));expect(screen.getByRole('alertdialog').textContent).toContain('no se puede deshacer')
    fireEvent.click(screen.getByRole('button',{name:'Cancelar',exact:true}));expect(mock.writes).toHaveLength(0)
    fireEvent.click(screen.getByRole('button',{name:'Eliminar Trabajo ficticio de prueba'}));mock.failNext='Failed to fetch';fireEvent.click(screen.getByRole('button',{name:'Eliminar definitivamente'}))
    await screen.findByRole('alert');expect(mock.records).toHaveLength(1)
    fireEvent.click(screen.getByRole('button',{name:'Eliminar definitivamente'}));await waitFor(()=>expect(mock.records).toHaveLength(0));expect(mock.extensions).toHaveLength(0)
  })
  it('bloquea la copia si falla la carga y ofrece reintentar',async()=>{
    mock.fetchFail=true;render(<App/>);expect((await screen.findByRole('alert')).textContent).toContain('No se pudo conectar');fireEvent.click(screen.getByRole('button',{name:'Registro',exact:true}));expect((screen.getByRole('button',{name:'Copia JSON'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.getByRole('button',{name:'Reintentar'})).toBeTruthy()
  })
})
