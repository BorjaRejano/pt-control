import { useState, type FormEvent } from 'react'
import { Archive, History, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { extensionWarnings, extensionsFor, isArchived, permitInfo, validateDescription, validateExtensionProgression, validatePermitNumber } from './domain'
import { dateTime, shortDate, statusLabels, statusOptions, type Trabajo, type Status, type Ampliacion, type Comentario, type Historial } from './lib'
import { Warnings } from './WorkViews'

export type WorkPayload = Pick<Trabajo,'descripcion'|'numero_permiso'|'fecha_programada'|'zona'|'empresa'|'estado'|'notas'>
type Tab='datos'|'ampliaciones'|'comentarios'|'historial'
export function WorkDetail({ work, extensions, comments, history, busy, error, planDate, onClose, onSave, onSaveEffectiveExtension, onArchive, onExtend, onDeleteExtension, onDelete, onComment }: {
  work:Trabajo|null,extensions:Ampliacion[],comments:Comentario[],history:Historial[],busy:boolean,error:string,planDate?:string,
  onClose:()=>void,onSave:(payload:WorkPayload)=>Promise<void>,onSaveEffectiveExtension:(work:Trabajo,extension:Ampliacion,payload:{numero_ampliacion:string|null,fecha_ampliacion:string|null})=>Promise<boolean>,onArchive:(work:Trabajo)=>void,
  onExtend:(work:Trabajo,ex?:Ampliacion)=>void,onDeleteExtension:(work:Trabajo,ex:Ampliacion)=>void,onDelete:(work:Trabajo)=>void,onComment:(id:string,content:string)=>Promise<boolean>,
}) {
  const [tab,setTab]=useState<Tab>('datos')
  const [draft,setDraft]=useState(()=>{const latest=work?permitInfo(work,extensions).latest:null;return {descripcion:work?.descripcion||'',numero_permiso:latest?latest.numero_ampliacion||'':work?.numero_permiso||'',fecha_programada:planDate||latest?.fecha_ampliacion||work?.fecha_programada||'',empresa:work?.empresa||'',zona:work?.zona||'',estado:work?.estado||'pendiente' as Status,notas:work?.notas||''}})
  const [validation,setValidation]=useState('')
  const [comment,setComment]=useState('')
  const p=work?permitInfo(work,extensions):null
  const field=(name:keyof typeof draft,value:string)=>setDraft(d=>({...d,[name]:value}))
  async function save(e:FormEvent){
    e.preventDefault()
    const numberChanged=!work||draft.numero_permiso!==(p?.latest?p.latest.numero_ampliacion||'':work.numero_permiso||'')
    const message=validateDescription(draft.descripcion)||(numberChanged?validatePermitNumber(draft.numero_permiso):'')
    setValidation(message||'')
    if(message)return
    if(work&&p?.latest&&(draft.fecha_programada!==(p.latest.fecha_ampliacion||'')||draft.numero_permiso!==(p.latest.numero_ampliacion||''))){
      if(!await onSaveEffectiveExtension(work,p.latest,{numero_ampliacion:draft.numero_permiso.trim()||null,fecha_ampliacion:draft.fecha_programada||null}))return
    }
    await onSave({descripcion:draft.descripcion.trim(),numero_permiso:p?.latest?work?.numero_permiso||null:draft.numero_permiso.trim()||null,fecha_programada:p?.latest?work?.fecha_programada||null:draft.fecha_programada||null,empresa:draft.empresa.trim()||null,zona:draft.zona.trim()||null,estado:draft.estado,notas:draft.notas.trim()||null})
  }
  return <Modal title={work?'Detalle del trabajo':'Nuevo trabajo'} eyebrow={work?p?.number||'TRABAJO SIN Nº':'NUEVO REGISTRO'} busy={busy} onClose={onClose}>
    {work&&<div className="modal-tabs">{([['datos','Datos'],['ampliaciones','Ampliaciones'],['comentarios','Comentarios'],['historial','Historial']] as [Tab,string][]).map(([id,label])=><button key={id} disabled={busy} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div>}
    <div className="modal-body">{(error||validation)&&<div role="alert" className="alert error">{error||validation}</div>}
      {p&&<><Warnings messages={p.warnings}/>{p.latest&&<div className="extension-summary"><div><span>{p.numberPending?'Último número disponible (referencia)':'Permiso actual'}</span><strong>{p.number||'Sin número disponible'}</strong><small>Permiso original: {work?.numero_permiso||'Sin asignar'}</small><small>{p.datePending?'Última fecha disponible (referencia)':'Fecha vigente'}: {shortDate(p.date)}</small></div>{tab!=='ampliaciones'&&<button className="text-button" onClick={()=>setTab('ampliaciones')}><History size={15}/> Ver historial de ampliaciones ({p.extensions.length})</button>}</div>}</>}
      {tab==='datos'&&<form onSubmit={save}><fieldset disabled={busy}><div className="form-grid">
        <label className="form-field full">Descripción del trabajo *<input required maxLength={300} value={draft.descripcion} onChange={e=>field('descripcion',e.target.value)}/></label>
        <label className="form-field">{p?.latest?'Número de ampliación vigente':'Número de permiso original'}<input inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={draft.numero_permiso} onChange={e=>field('numero_permiso',e.target.value.replace(/\D/g,'').slice(0,5))}/></label>
        <label className="form-field">{p?.latest?'Fecha de ampliación vigente':'Fecha programada original'}<input type="date" value={draft.fecha_programada} onChange={e=>field('fecha_programada',e.target.value)}/></label>
        <label className="form-field">Zona / instalación<input maxLength={150} value={draft.zona} onChange={e=>field('zona',e.target.value)}/></label>
        <label className="form-field">Empresa ejecutante<input maxLength={150} value={draft.empresa} onChange={e=>field('empresa',e.target.value)}/></label>
        <label className="form-field">Estado del permiso<select value={draft.estado} onChange={e=>{if(e.target.value==='ampliar'&&work)onExtend(work);else field('estado',e.target.value)}}>{statusOptions.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}{work&&<option value="ampliar">Ampliado…</option>}</select></label>
        <div className="form-field"><span>Programación</span><div className="schedule-summary">{p?.latest?shortDate(p.date):draft.fecha_programada?shortDate(draft.fecha_programada):'Sin programar'}</div></div>
        {p?.latest&&<p className="form-field full">La fecha y el número vigentes se actualizan desde Ampliaciones. Estos campos conservan los datos originales.</p>}
        <label className="form-field full">Notas generales<textarea maxLength={6000} rows={3} value={draft.notas} onChange={e=>field('notas',e.target.value)}/></label>
      </div><div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" type="submit">{busy?'Guardando…':'Guardar trabajo'}</button></div></fieldset>
      {work&&<div className="archive-action"><button type="button" disabled={busy} className="text-button" onClick={()=>onArchive(work)}>{isArchived(work)?<RotateCcw size={15}/>:<Archive size={15}/>} {isArchived(work)?work.estado==='finalizado'?'Reabrir y recuperar del archivo':'Recuperar del archivo':'Archivar trabajo'}</button><button type="button" disabled={busy} className="text-button danger" onClick={()=>onDelete(work)}><Trash2 size={15}/> Eliminar permiso</button></div>}</form>}
      {tab==='ampliaciones'&&work&&<section className="modal-section"><h3>Historial de ampliaciones</h3><p className="section-intro">Permiso original: <strong>{work.numero_permiso||'Sin asignar'}</strong>. De la más reciente a la más antigua según su registro.</p><div className="timeline">{p?.extensions.map((ex,i)=><div className="timeline-row" key={ex.id}><strong>{ex.numero_ampliacion||'Número pendiente'}</strong>{i===0&&<span className="extension-current">Última ampliación</span>}<small>{ex.fecha_ampliacion?shortDate(ex.fecha_ampliacion):'Fecha pendiente'}</small><Warnings messages={extensionWarnings(ex)}/>{ex.observaciones&&<p>{ex.observaciones}</p>}<div className="timeline-actions"><button className="text-button" disabled={busy} onClick={()=>onExtend(work,ex)}>Editar ampliación</button><button className="icon-button delete-icon" disabled={busy} onClick={()=>onDeleteExtension(work,ex)} aria-label={`Eliminar ampliación ${ex.numero_ampliacion||'pendiente'}`} title="Eliminar ampliación"><Trash2 size={14}/></button></div></div>)}{!p?.latest&&<p className="empty">Todavía no se han registrado ampliaciones.</p>}</div><button className="primary" disabled={busy} onClick={()=>onExtend(work)}><Plus size={15}/> Nueva ampliación</button></section>}
      {tab==='comentarios'&&work&&<section className="modal-section"><h3>Seguimiento y comentarios</h3><div className="timeline">{comments.filter(c=>c.trabajo_id===work.id).map(c=><div className="timeline-row" key={c.id}><small>{dateTime(c.created_at)}</small><p>{c.contenido}</p></div>)}</div><form onSubmit={async e=>{e.preventDefault();if(!comment.trim()){setValidation('Escribe un comentario antes de guardarlo.');return}setValidation('');if(await onComment(work.id,comment.trim()))setComment('')}}><label className="form-field">Añadir comentario<textarea required maxLength={3000} rows={3} value={comment} onChange={e=>setComment(e.target.value)}/></label><button className="primary" disabled={busy} type="submit">Guardar comentario</button></form></section>}
      {tab==='historial'&&work&&<section className="modal-section"><h3>Historial de cambios</h3><div className="timeline">{history.filter(h=>h.trabajo_id===work.id).map(h=><div className="timeline-row" key={h.id}><small>{dateTime(h.created_at)} · {h.tipo.replace('_',' ')}</small><p>{h.resumen}</p></div>)}</div></section>}
    </div>
  </Modal>
}

export function ExtensionDialog({ work, extensions, extension, busy, error, onClose, onSave, onDelete }: {work:Trabajo,extensions:Ampliacion[],extension?:Ampliacion,busy:boolean,error:string,onClose:()=>void,onSave:(data:{numero_ampliacion:string|null,fecha_ampliacion:string|null,observaciones:string|null})=>Promise<void>,onDelete:(work:Trabajo,extension:Ampliacion)=>void}) {
  const [number,setNumber]=useState(extension?.numero_ampliacion||'')
  const [date,setDate]=useState(extension?.fecha_ampliacion||'')
  const [notes,setNotes]=useState(extension?.observaciones||'')
  const [validation,setValidation]=useState('')
  const ordered=extensionsFor(extensions,work.id)
  const previous=extension ? permitInfo(work,ordered.slice(ordered.findIndex(item=>item.id===extension.id)+1)) : permitInfo(work,ordered)
  return <Modal title={extension?'Editar ampliación':'Nueva ampliación'} eyebrow={work.descripcion} busy={busy} onClose={onClose}><div className="modal-body">{(error||validation)&&<p className="alert error" role="alert">{error||validation}</p>}<p className="section-intro">El número y la fecha de una ampliación deben ser superiores a los del permiso anterior. Puedes dejar ambos datos pendientes y completarlos después.</p><form onSubmit={async e=>{e.preventDefault();const numberChanged=!extension||number!==(extension.numero_ampliacion||'');const message=(numberChanged?validatePermitNumber(number):'')||validateExtensionProgression(number,date,previous);setValidation(message);if(message)return;await onSave({numero_ampliacion:number.trim()||null,fecha_ampliacion:date||null,observaciones:notes.trim()||null})}}><fieldset disabled={busy}><div className="form-grid"><label className="form-field">Nuevo número de permiso<input inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={number} onChange={e=>setNumber(e.target.value.replace(/\D/g,'').slice(0,5))}/></label><label className="form-field">Nueva fecha de ampliación<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="form-field full">Observaciones<textarea maxLength={2000} rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label></div><div className="form-actions">{extension&&<button type="button" className="icon-button delete-icon" disabled={busy} onClick={()=>onDelete(work,extension)} aria-label="Eliminar ampliación" title="Eliminar ampliación"><Trash2 size={15}/></button>}<button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary">{busy?'Guardando…':extension?'Guardar ampliación':'Añadir ampliación'}</button></div></fieldset></form></div></Modal>
}
