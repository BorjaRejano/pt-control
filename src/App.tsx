import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, Archive, ArrowRight, Calendar, CalendarClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3, Database, Download, LayoutDashboard, LogOut, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { AuthScreen, NoConfig } from './AuthScreens'
import { Brand } from './Brand'
import { dashboard, addDays, localToday, mondayOf, permitInfo, defaultFilters, filterWorks, buildCsv, stateChange, isArchived, type WorkFilters } from './domain'
import { configured, supabase, fetchAll, longDate, shortDate, type Trabajo, type Ampliacion, type Comentario, type Historial, type Status } from './lib'
import { readableError } from './errors'
import { WorkCard, CalendarWeeks, Registry, type WorkActions } from './WorkViews'
import { WorkDetail, ExtensionDialog, type WorkPayload } from './WorkDetail'
import { Modal } from './Modal'

type View='panel'|'calendario'|'registro'|'archivo'
export default function App() {
  const [session,setSession]=useState<Session|null>(null)
  const [authChecked,setAuthChecked]=useState(false)
  const [records,setRecords]=useState<Trabajo[]>([])
  const [extensions,setExtensions]=useState<Ampliacion[]>([])
  const [comments,setComments]=useState<Comentario[]>([])
  const [history,setHistory]=useState<Historial[]>([])
  const [loading,setLoading]=useState(false)
  const [loaded,setLoaded]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [loadError,setLoadError]=useState('')
  const [toast,setToast]=useState('')
  const [view,setView]=useState<View>('panel')
  const [filters,setFilters]=useState<WorkFilters>({...defaultFilters})
  const [weekShift,setWeekShift]=useState(0)
  const [today,setToday]=useState(localToday())
  const [editing,setEditing]=useState<{id:string,planDate?:string}|null>(null)
  const [extensionDialog,setExtensionDialog]=useState<{work:Trabajo,extension?:Ampliacion}|null>(null)
  const [deletingExtension,setDeletingExtension]=useState<{work:Trabajo,extension:Ampliacion}|null>(null)
  const [deleting,setDeleting]=useState<Trabajo|null>(null)
  const version=useRef(0)
  const userRef=useRef(session?.user.id)
  const autoStartAttempt=useRef('')
  userRef.current=session?.user.id

  useEffect(()=>{
    if(!supabase){setAuthChecked(true);return}
    let mounted=true
    supabase.auth.getSession().then(({data,error:authError})=>{if(mounted){setSession(data.session);setAuthChecked(true);if(authError)setError(readableError(authError))}}).catch(err=>{if(mounted){setError(readableError(err));setAuthChecked(true)}})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next))
    return ()=>{mounted=false;subscription.unsubscribe()}
  },[])
  const reload=useCallback(async()=>{
    if(!supabase)return
    const current=++version.current
    setLoading(true);setLoadError('')
    try{
      const [w,e,c,h]=await Promise.all([fetchAll('trabajos'),fetchAll('ampliaciones'),fetchAll('comentarios'),fetchAll('historial_cambios')])
      if(current!==version.current)return
      setRecords(w as unknown as Trabajo[]);setExtensions(e as unknown as Ampliacion[]);setComments(c as unknown as Comentario[]);setHistory(h as unknown as Historial[]);setLoaded(true)
    }catch(err){if(current===version.current){setLoaded(false);setLoadError(`No se pudo cargar la base de datos: ${readableError(err)}`)}}
    finally{if(current===version.current)setLoading(false)}
  },[])
  useEffect(()=>{
    setRecords([]);setExtensions([]);setComments([]);setHistory([]);setLoaded(false);setEditing(null);setExtensionDialog(null);setDeletingExtension(null);setDeleting(null);setToast('');setLoadError('')
    if(session?.user.id)void reload()
    return ()=>{++version.current}
  },[session?.user.id,reload])
  useEffect(()=>{
    const timer=window.setInterval(()=>setToday(localToday()),30_000)
    return ()=>window.clearInterval(timer)
  },[])
  useEffect(()=>{
    if(!session?.user.id)return
    const refresh=()=>{void reload()}
    window.addEventListener('focus',refresh)
    const timer=window.setInterval(refresh,60_000)
    return ()=>{window.removeEventListener('focus',refresh);window.clearInterval(timer)}
  },[session?.user.id,reload])
  useEffect(()=>{
    if(loaded&&editing&&editing.id!=='new'&&!records.some(w=>w.id===editing.id))setEditing(null)
  },[loaded,records,editing])
  useEffect(()=>{
    if(!supabase||!session?.user.id||!loaded||busy)return
    const candidates=records.filter(work=>work.estado!=='ejecucion'&&permitInfo(work,extensions).date===today)
    if(!candidates.length)return
    const signature=`${today}:${candidates.map(work=>work.id).sort().join(',')}`
    if(autoStartAttempt.current===signature)return
    autoStartAttempt.current=signature
    const owner=session.user.id
    setBusy(true);setError('')
    void Promise.all(candidates.map(async work=>{
      const {data,error:err}=await supabase!.from('trabajos').update({estado:'ejecucion',archivado:false}).eq('id',work.id).select('*').single()
      if(err||!data)throw err||new Error('No se pudo iniciar el permiso programado para hoy.')
      return data as Trabajo
    })).then(updated=>{
      if(userRef.current!==owner)return
      const byId=new Map(updated.map(work=>[work.id,work]))
      setRecords(rows=>rows.map(work=>byId.get(work.id)||work))
      setToast(updated.length===1?'Permiso de hoy iniciado automáticamente':'Permisos de hoy iniciados automáticamente')
    }).catch(err=>{if(userRef.current===owner)setError(readableError(err))}).finally(()=>setBusy(false))
  },[records,extensions,today,loaded,session?.user.id,busy])

  const panel=useMemo(()=>dashboard(records,today,extensions),[records,today,extensions])
  const listFilters={...filters,archive:view==='archivo'}
  const visibleRecords=filterWorks(records,extensions,listFilters)
  const selected=editing?records.find(w=>w.id===editing.id):undefined
  const starts=[addDays(mondayOf(today),weekShift*7),addDays(mondayOf(today),(weekShift+1)*7)]
  function navigate(next:View,state='todos') {setView(next);setFilters({...defaultFilters,state,archive:next==='archivo'})}
  function openWork(work?:Trabajo,planDate?:string) {if(!busy){setError('');setEditing({id:work?.id||'new',planDate})}}
  function openExtension(work:Trabajo,extension?:Ampliacion){if(!busy){setError('');setExtensionDialog({work,extension})}}
  async function mutate<T>(operation:()=>Promise<T>,success:(data:T)=>void,message:string):Promise<boolean>{
    if(busy||!session)return false
    const owner=session.user.id
    ++version.current;setLoading(false);setBusy(true);setError('');setToast('')
    try{
      const data=await operation()
      if(userRef.current!==owner)return false
      success(data);setToast(message);await reload();return true
    }catch(err){if(userRef.current===owner)setError(readableError(err));return false}
    finally{setBusy(false)}
  }
  function keepWork(work:Trabajo){setRecords(rows=>rows.some(w=>w.id===work.id)?rows.map(w=>w.id===work.id?work:w):[work,...rows])}
  async function updateWork(work:Trabajo,patch:Partial<Trabajo>,message='Permiso actualizado'){
    return mutate(async()=>{
      const {data,error:err}=await supabase!.from('trabajos').update(patch).eq('id',work.id).select('*').single()
      if(err||!data)throw err||new Error('No se pudo actualizar el trabajo.')
      return data as Trabajo
    },keepWork,message)
  }
  async function changeState(work:Trabajo,status:Status){await updateWork(work,stateChange(work,status),status==='finalizado'?'Trabajo finalizado y archivado':'Estado actualizado')}
  async function changeDate(work:Trabajo,extension:Ampliacion|undefined,date:string|null){
    if(extension){
      await mutate(async()=>{
        const {data,error:err}=await supabase!.from('ampliaciones').update({fecha_ampliacion:date}).eq('id',extension.id).eq('trabajo_id',work.id).select('*').single()
        if(err||!data)throw err||new Error('No se pudo actualizar la ampliación.')
        return data as Ampliacion
      },data=>setExtensions(rows=>[data,...rows.filter(ex=>ex.id!==data.id)]),'Fecha de ampliación actualizada')
      return
    }
    await updateWork(work,{fecha_programada:date},'Fecha programada actualizada')
  }
  async function archiveWork(work:Trabajo){
    const archived=isArchived(work)
    const saved=await updateWork(work,archived?{archivado:false,...(work.estado==='finalizado'?{estado:'pendiente' as Status}:{})}:{archivado:true},archived?'Trabajo recuperado del archivo':'Trabajo archivado')
    if(saved)setEditing(null)
  }
  async function saveWork(payload:WorkPayload){
    await mutate(async()=>{
      const patch={...payload,archivado:payload.estado==='finalizado'||!!selected?.archivado}
      const query=selected?supabase!.from('trabajos').update(patch).eq('id',selected.id):supabase!.from('trabajos').insert(patch)
      const {data,error:err}=await query.select('*').single()
      if(err||!data)throw err||new Error('No se pudo guardar el trabajo.')
      return data as Trabajo
    },data=>{keepWork(data);setEditing(null)},payload.estado==='finalizado'?'Trabajo finalizado y archivado':'Trabajo guardado correctamente')
  }
  async function saveExtension(payload:{numero_ampliacion:string|null,fecha_ampliacion:string|null,observaciones:string|null}){
    if(!extensionDialog)return
    const target=extensionDialog
    await mutate(async()=>{
      const query=target.extension?supabase!.from('ampliaciones').update(payload).eq('id',target.extension.id).eq('trabajo_id',target.work.id):supabase!.from('ampliaciones').insert({...payload,trabajo_id:target.work.id})
      const {data,error:err}=await query.select('*').single()
      if(err||!data)throw err||new Error('No se pudo guardar la ampliación.')
      return data as Ampliacion
    },data=>{setExtensions(rows=>[data,...rows.filter(ex=>ex.id!==data.id)]);setExtensionDialog(null)},target.extension?'Ampliación actualizada':'Ampliación añadida')
  }
  async function deleteWork(){
    if(!deleting)return
    const id=deleting.id
    await mutate(async()=>{
      const {data,error:err}=await supabase!.from('trabajos').delete().eq('id',id).select('id').single()
      if(err||!data)throw err||new Error('No se pudo eliminar el permiso.')
      return id
    },()=>{setRecords(rows=>rows.filter(w=>w.id!==id));setExtensions(rows=>rows.filter(e=>e.trabajo_id!==id));setComments(rows=>rows.filter(c=>c.trabajo_id!==id));setHistory(rows=>rows.filter(h=>h.trabajo_id!==id));setDeleting(null);if(editing?.id===id)setEditing(null);if(extensionDialog?.work.id===id)setExtensionDialog(null)},'Permiso eliminado')
  }
  async function deleteExtension(){
    if(!deletingExtension)return
    const target=deletingExtension
    await mutate(async()=>{
      const {data,error:err}=await supabase!.from('ampliaciones').delete().eq('id',target.extension.id).eq('trabajo_id',target.work.id).select('id').single()
      if(err||!data)throw err||new Error('No se pudo eliminar la ampliación.')
      return target.extension.id
    },id=>{setExtensions(rows=>rows.filter(extension=>extension.id!==id));setDeletingExtension(null)},'Ampliación eliminada')
  }
  async function addComment(id:string,contenido:string){
    return mutate(async()=>{
      const {data,error:err}=await supabase!.from('comentarios').insert({trabajo_id:id,contenido}).select('*').single()
      if(err||!data)throw err||new Error('No se pudo guardar el comentario.')
      return data as Comentario
    },data=>setComments(rows=>[data,...rows]),'Comentario añadido')
  }
  async function login(email:string,password:string){const {error:err}=await supabase!.auth.signInWithPassword({email,password});if(err)throw err}
  async function logout(){try{const {error:err}=await supabase!.auth.signOut({scope:'local'});if(err)throw err;setError('')}catch(err){setError(readableError(err))}}
  function download(content:string,type:string,filename:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function exportBackup(){download(JSON.stringify({format:'PT_CONTROL_v1',schema_version:3,exported_at:new Date().toISOString(),trabajos:records,ampliaciones:extensions,comentarios:comments,historial_cambios:history},null,2),'application/json',`PT_CONTROL_copia_${today}.json`)}
  const actions:WorkActions={busy,onOpen:openWork,onState:(w,s)=>{void changeState(w,s)},onDate:(w,e,date)=>{void changeDate(w,e,date)},onExtend:openExtension,onDeleteExtension:(work,extension)=>{setError('');setDeletingExtension({work,extension})},onDelete:work=>{setError('');setDeleting(work)}}
  const cards=(works:Trabajo[],empty:string)=><div className="compact-cards">{works.length?works.map(work=><WorkCard key={work.id} work={work} extensions={extensions} actions={actions}/>):<p className="empty">{empty}</p>}</div>

  if(!configured)return <NoConfig/>
  if(!authChecked)return <div className="loading-page"><RefreshCw className="spin"/> Comprobando sesión…</div>
  if(!session)return <AuthScreen onSignIn={login} initialError={error}/>
  const nav=[{id:'panel',name:'Panel diario',icon:LayoutDashboard},{id:'calendario',name:'Calendario',icon:CalendarDays},{id:'registro',name:'Registro',icon:ClipboardList},{id:'archivo',name:'Archivados',icon:Archive}] as const
  const summaryKpis=[{label:'Sin programar',count:panel.unplanned.length,color:'yellow',state:'sin_programar'}, {label:'Pendientes',count:panel.pending.length,color:'blue',state:'pendiente'}, {label:'Emitidos',count:panel.issued.length,color:'purple',state:'emitido'}, {label:'En ejecución',count:panel.executing.length,color:'green',state:'ejecucion'}, {label:'Finalizados',count:panel.finished.length,color:'gray',state:'finalizado'}] as const
  return <div className="app">
    <div inert={!!editing||!!extensionDialog||!!deletingExtension||!!deleting}>
      <div className="app-navigation"><header className="topbar"><div className="top-main"><Brand compact/><div className="top-actions"><span className="today-label">{longDate(today)}</span><button className="primary" onClick={()=>openWork()}><Plus size={16}/> Nuevo trabajo</button><button className="icon-button inverted" disabled={busy} aria-label="Cerrar sesión" onClick={()=>void logout()}><LogOut size={18}/></button></div></div></header><div className="tabs-bar"><div className="navigation-content"><nav className="tabs" aria-label="Secciones">{nav.map(({id,name,icon:Icon})=><button key={id} className={`navtab ${view===id?'selected':''}`} onClick={()=>navigate(id)}><Icon size={17}/>{name}</button>)}</nav><div className="nav-kpis" aria-label="Resumen del panel diario">{summaryKpis.map(k=><button key={k.state} className={`nav-kpi ${k.color}`} onClick={()=>navigate(k.state==='finalizado'?'archivo':'registro',k.state)}><span>{k.label}</span><b>{k.count}</b></button>)}</div></div></div></div>
      <main className="main">
        {loadError&&<div className="alert error global-error" role="alert"><span>{loadError}</span><button disabled={loading} onClick={()=>void reload()}>Reintentar</button></div>}
        {error&&!editing&&!extensionDialog&&!deleting&&<div className="alert error global-error" role="alert"><span>{error}</span><button aria-label="Ocultar error" onClick={()=>setError('')}><X size={15}/></button></div>}
        {toast&&<div className="alert success global-toast" role="status"><CheckCircle2 size={16}/>{toast}<button aria-label="Ocultar aviso" onClick={()=>setToast('')}><X size={15}/></button></div>}
        {loading&&<div className="sync-line"><RefreshCw size={13} className="spin"/> Sincronizando datos…</div>}
        {view==='panel'&&<>
          <div className="page-title"><div><h1>Panel diario</h1><p>Resumen de permisos y trabajos pendientes de gestión.</p></div><button className="secondary" onClick={()=>void reload()}><RefreshCw size={15}/> Actualizar</button></div>
          <section className="panel daily-section"><div className="panel-heading"><div><h2><Activity size={18}/> Trabajos de hoy</h2><small>{shortDate(today)} · {panel.todayJobs.length} trabajos activos</small></div></div>{cards(panel.todayJobs,'No tienes trabajos activos programados para hoy.')}</section>
          <section className="panel daily-section"><div className="panel-heading"><div><h2><Calendar size={18}/> Próximos trabajos</h2><small>Fecha posterior a hoy · Pendientes, emitidos o con ampliaciones</small></div><button className="text-button" onClick={()=>navigate('calendario')}>Ver calendario <ArrowRight size={14}/></button></div>{cards(panel.upcoming,'No hay permisos pendientes, emitidos o ampliados con fecha posterior a hoy.')}</section>
          <section className="panel attention daily-section"><div className="panel-heading"><h2><CalendarClock size={18}/> Permisos sin programar</h2><b className="counter orange-counter">{panel.unplanned.length}</b></div><div className="compact-cards">{panel.unplanned.map(work=><div className="unplanned-row" key={work.id} data-status={work.estado} data-incomplete={!!permitInfo(work,extensions).warnings.length}><WorkCard work={work} extensions={extensions} actions={actions}/><button className="small-action" disabled={busy} onClick={()=>openWork(work,today)}>Programar <ArrowRight size={13}/></button></div>)}{!panel.unplanned.length&&<p className="empty">No hay permisos pendientes de programar.</p>}</div></section>
          {panel.overdue.length>0&&<section className="panel overdue daily-section"><div className="panel-heading"><h2><Clock3 size={18}/> Trabajos con fecha anterior aún abiertos</h2><b className="counter">{panel.overdue.length}</b></div>{cards(panel.overdue,'')}</section>}
        </>}
        {view==='calendario'&&<><div className="page-title"><div><h1>Calendario de dos semanas</h1><p>Permisos activos según su fecha vigente o última fecha de referencia disponible.</p></div><div className="week-actions"><button className="secondary icon-only" title="Semana anterior" onClick={()=>setWeekShift(n=>n-1)}><ChevronLeft size={19}/></button><button className="secondary" onClick={()=>setWeekShift(0)}>Hoy</button><button className="secondary icon-only" title="Semana siguiente" onClick={()=>setWeekShift(n=>n+1)}><ChevronRight size={19}/></button></div></div><div className="calendar-layout"><CalendarWeeks starts={starts} today={today} records={panel.active} extensions={extensions} actions={actions}/><aside className="panel calendar-aside"><div className="panel-heading"><h2>Sin fecha</h2><b className="counter orange-counter">{panel.unplanned.length}</b></div>{panel.unplanned.map(work=><WorkCard key={work.id} work={work} extensions={extensions} actions={actions}/>)}{!panel.unplanned.length&&<p className="empty">Todo está programado.</p>}</aside></div></>}
        {(view==='registro'||view==='archivo')&&<><div className="page-title"><div><h1>{view==='archivo'?'Archivo de trabajos':'Registro de permisos'}</h1><p>{view==='archivo'?'Permisos finalizados o archivados; puedes reabrirlos o eliminarlos.':'Consulta y seguimiento de permisos activos.'}</p></div><div className="week-actions"><button className="secondary" disabled={!loaded||loading} onClick={()=>download(buildCsv(visibleRecords,extensions),'text/csv;charset=utf-8',`PT_CONTROL_${today}.csv`)}><Download size={16}/> CSV Excel</button><button className="secondary" disabled={!loaded||loading} onClick={exportBackup}><Database size={16}/> Copia JSON</button></div></div><button className="text-button clear-filters" onClick={()=>setFilters({...defaultFilters,archive:view==='archivo'})}>Limpiar filtros</button><Registry records={visibleRecords} allRecords={records} extensions={extensions} filters={listFilters} onFilters={patch=>setFilters(f=>({...f,...patch}))} actions={actions}/></>}
        <footer><span><ShieldCheck size={14}/> Acceso privado · Datos almacenados en Supabase</span><span>PT CONTROL</span></footer>
      </main>
    </div>
    {editing&&(editing.id==='new'||selected)&&<div inert={!!extensionDialog||!!deletingExtension||!!deleting}><WorkDetail key={editing.id} work={selected||null} planDate={editing.planDate} extensions={extensions} comments={comments} history={history} busy={busy} error={error} onClose={()=>{if(!busy)setEditing(null)}} onSave={saveWork} onExtend={openExtension} onDeleteExtension={actions.onDeleteExtension} onDelete={actions.onDelete} onArchive={archiveWork} onComment={addComment}/></div>}
    {extensionDialog&&<div inert={!!deletingExtension||!!deleting}><ExtensionDialog key={extensionDialog.extension?.id||`new-${extensionDialog.work.id}`} work={extensionDialog.work} extensions={extensions} extension={extensionDialog.extension} busy={busy} error={error} onClose={()=>{if(!busy){setExtensionDialog(null);setError('')}}} onSave={saveExtension}/></div>}
    {deletingExtension&&<Modal title="Eliminar ampliación" eyebrow={deletingExtension.extension.numero_ampliacion||'SIN NÚMERO'} busy={busy} onClose={()=>{if(!busy)setDeletingExtension(null)}} alert><div className="modal-body">{error&&<p className="alert error" role="alert">{error}</p>}<p>Vas a eliminar la ampliación de <strong>{deletingExtension.work.descripcion}</strong>.</p><p className="delete-explanation">El permiso volverá a mostrar su número y fecha anteriores. Esta acción no se puede deshacer.</p><div className="form-actions"><button className="secondary" disabled={busy} onClick={()=>setDeletingExtension(null)}>Cancelar</button><button className="danger-button" disabled={busy} onClick={()=>void deleteExtension()}>{busy?'Eliminando…':'Eliminar ampliación'}</button></div></div></Modal>}
    {deleting&&<Modal title="Eliminar permiso" eyebrow={permitInfo(deleting,extensions).number||'SIN NÚMERO'} busy={busy} onClose={()=>{if(!busy)setDeleting(null)}} alert><div className="modal-body">{error&&<p className="alert error" role="alert">{error}</p>}<p>Vas a eliminar definitivamente <strong>{deleting.descripcion}</strong>.</p><p className="delete-explanation">Se eliminarán el trabajo, sus ampliaciones, comentarios e historial. Esta acción no se puede deshacer.</p><div className="form-actions"><button className="secondary" disabled={busy} onClick={()=>setDeleting(null)}>Cancelar</button><button className="danger-button" disabled={busy} onClick={()=>void deleteWork()}>{busy?'Eliminando…':'Eliminar definitivamente'}</button></div></div></Modal>}
  </div>
}
