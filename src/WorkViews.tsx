import { Calendar, Files, History, Trash2 } from 'lucide-react'
import { addDays, extensionWarnings, isoWeek, permitInfo, type WorkFilters, type SortKey } from './domain'
import { shortDate, statusLabels, statusOptions, type Trabajo, type Ampliacion, type Status } from './lib'

export interface WorkActions {
  busy: boolean
  onOpen: (work: Trabajo) => void
  onState: (work: Trabajo, status: Status) => void
  onDate: (work: Trabajo, extension: Ampliacion | undefined, date: string | null) => void
  onExtend: (work: Trabajo, extension?: Ampliacion) => void
  onDelete: (work: Trabajo) => void
}
export function Warnings({ messages }: {messages:string[]}) {
  return messages.length ? <ul className="permit-warnings" aria-label="Datos pendientes">{messages.map(message=><li key={message}>{message}</li>)}</ul> : null
}
export function StatusControl({ work, actions }: {work:Trabajo,actions:WorkActions}) {
  return <select aria-label={`Estado de ${work.descripcion}`} value={work.estado} disabled={actions.busy} onChange={e=>{
    if(e.target.value==='ampliar')actions.onExtend(work)
    else actions.onState(work,e.target.value as Status)
  }}>{statusOptions.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}<option value="ampliar">Ampliado…</option></select>
}
export function StateTag({ status }: {status:Status}) {return <span className={`tag status-${status}`}><span className="tag-dot"/>{statusLabels[status]}</span>}
export function WorkCard({ work, extensions, actions }: {work:Trabajo,extensions:Ampliacion[],actions:WorkActions}) {
  const p=permitInfo(work,extensions)
  const extensionToOpen=p.extensions.find(ex=>extensionWarnings(ex).length>0)||p.latest
  const dateTarget=p.latest
  const dateValue=dateTarget?.fecha_ampliacion ?? work.fecha_programada ?? ''
  const dateLabel=dateTarget?'Fecha de ampliación':'Fecha programada'
  return <article className="permit-card" data-status={work.estado} data-incomplete={!!p.warnings.length}>
    <button className="permit-open" onClick={()=>actions.onOpen(work)} aria-label={`Abrir ${work.descripcion}`}>
      <span className="permit-top"><span className="permit-no">{p.number || 'SIN Nº · BORRADOR'}{p.numberPending&&<small className="reference-label">Número de referencia</small>}</span><StateTag status={work.estado}/></span>
      <strong className="permit-title">{work.descripcion}</strong>
      <span className="permit-meta">{work.zona || 'Sin zona'}{work.empresa?` · ${work.empresa}`:''}</span>
      <span className="permit-bottom"><span><Calendar size={12}/>{shortDate(p.date)}{p.datePending?' · referencia':''}</span>{p.extensions.length>0&&<span className="extension-mark"><Files size={12}/>{p.extensions.length} ampl.</span>}</span>
    </button>
    <Warnings messages={p.warnings}/>
    <div className="permit-actions"><StatusControl work={work} actions={actions}/><label className="card-date-control">{dateLabel}<input aria-label={`${dateLabel} de ${work.descripcion}`} type="date" value={dateValue} disabled={actions.busy} onChange={e=>actions.onDate(work,dateTarget,e.target.value||null)}/></label>{extensionToOpen&&<button className="text-button" disabled={actions.busy} onClick={()=>actions.onExtend(work,extensionToOpen)}><History size={14}/>{p.warnings.length?'Completar ampliación':'Ver ampliación'}</button>}<button className="icon-button delete-icon" disabled={actions.busy} onClick={()=>actions.onDelete(work)} aria-label={`Eliminar ${work.descripcion}`}><Trash2 size={14}/></button></div>
  </article>
}
export function CalendarWeeks({ starts, today, records, extensions, actions }: {starts:string[],today:string,records:Trabajo[],extensions:Ampliacion[],actions:WorkActions}) {
  return <div className="calendar-weeks">{starts.map(start=>{
    const week=isoWeek(start),days=Array.from({length:7},(_,i)=>addDays(start,i))
    return <section className="panel" key={start}><div className="panel-heading"><div><h2>Semana {week.week} · {week.year}</h2><small>Del {shortDate(start)} al {shortDate(days[6])}</small></div></div>
      <p className="calendar-scroll-hint">Desliza horizontalmente para consultar todos los días.</p><div className="calendar-grid" tabIndex={0} role="region" aria-label={`Días de la semana ${week.week}`}>{days.map((day,i)=><div className={`day-column ${day===today?'today':''}`} key={day}><div className="day-header"><small>{['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'][i]}</small><strong>{Number(day.slice(8))}</strong></div><div className="day-events">
        {records.filter(w=>permitInfo(w,extensions).date===day).map(w=>{const p=permitInfo(w,extensions);return <button key={w.id} className={`day-event event-${w.estado}`} data-status={w.estado} data-incomplete={!!p.warnings.length} onClick={()=>actions.onOpen(w)}><b>{p.number || 'SIN Nº'}</b>{p.numberPending&&<small>Número de referencia</small>}<span>{w.descripcion}</span><small>{statusLabels[w.estado]}</small>{p.datePending&&<small>Fecha de referencia</small>}{p.warnings.map(message=><small className="calendar-warning" key={message}>{message}</small>)}</button>})}
      </div></div>)}</div></section>
  })}</div>
}
export function Registry({ records, allRecords, extensions, filters, onFilters, actions }: {records:Trabajo[],allRecords:Trabajo[],extensions:Ampliacion[],filters:WorkFilters,onFilters:(f:Partial<WorkFilters>)=>void,actions:WorkActions}) {
  const f=filters
  const sort=(key:SortKey,label:string)=><th aria-sort={f.sortBy===key?f.sortAsc?'ascending':'descending':'none'}><button className="sort-button" onClick={()=>onFilters({sortBy:key,sortAsc:f.sortBy===key?!f.sortAsc:true})}>{label}{f.sortBy===key?f.sortAsc?' ↑':' ↓':' ↕'}</button></th>
  return <div className="panel register-panel"><div className="list-tools"><div className="filters">{[['todos','Todos'],['sin_programar','Sin programar'],['pendiente','Pendientes'],['emitido','Emitidos'],['ejecucion','En ejecución'],['finalizado','Finalizados'],['ampliados','Ampliados']].map(([value,label])=><button key={value} className={`filter ${f.state===value?'on':''}`} onClick={()=>onFilters({state:value})}>{label}</button>)}</div><input className="quick-search" aria-label="Buscar permisos" placeholder="Buscar nº, zona, empresa o trabajo" value={f.search} onChange={e=>onFilters({search:e.target.value})}/></div>
    <div className="advanced-filters"><label className="form-field">Desde<input type="date" value={f.dateFrom} onChange={e=>onFilters({dateFrom:e.target.value})}/></label><label className="form-field">Hasta<input type="date" min={f.dateFrom||undefined} value={f.dateTo} onChange={e=>onFilters({dateTo:e.target.value})}/></label>
      <label className="form-field">Empresa<select value={f.company} onChange={e=>onFilters({company:e.target.value})}><option value="">Todas</option>{Array.from(new Set(allRecords.map(w=>w.empresa).filter((v):v is string=>!!v))).sort().map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="form-field">Zona<select value={f.zone} onChange={e=>onFilters({zone:e.target.value})}><option value="">Todas</option>{Array.from(new Set(allRecords.map(w=>w.zona).filter((v):v is string=>!!v))).sort().map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="form-field">Número de permiso<input value={f.permitNumber} onChange={e=>onFilters({permitNumber:e.target.value})}/></label><label className="form-field">Descripción<input value={f.description} onChange={e=>onFilters({description:e.target.value})}/></label>
      <label className="check-filter"><input type="checkbox" checked={f.onlyExtended} onChange={e=>onFilters({onlyExtended:e.target.checked})}/> Solo ampliados</label>{!f.archive&&<label className="check-filter"><input type="checkbox" checked={f.includeArchived} onChange={e=>onFilters({includeArchived:e.target.checked})}/> Incluir archivados</label>}
      {f.dateFrom&&f.dateTo&&f.dateFrom>f.dateTo&&<p role="alert">La fecha inicial debe ser anterior a la final.</p>}
    </div>
    <div className="table-scroll"><table className="registry"><thead><tr>{sort('fecha_programada','Fecha vigente')}{sort('numero_permiso','Nº PT')}{sort('descripcion','Trabajo')}{sort('zona','Zona')}{sort('estado','Estado')}<th>Acciones</th></tr></thead><tbody>{records.map(w=>{const p=permitInfo(w,extensions);return <tr key={w.id} data-incomplete={!!p.warnings.length}><td>{shortDate(p.date)}{p.datePending&&<small className="table-sub">Fecha de referencia</small>}</td><td className="cell-number">{p.number||'Sin asignar'}{p.numberPending&&<small className="reference-label">Número de referencia</small>}{p.latest&&<small className="table-sub">Original: {w.numero_permiso||'Sin asignar'}</small>}</td><td><button className="row-open" onClick={()=>actions.onOpen(w)}>{w.descripcion}</button><span className="table-sub">{w.empresa||'Empresa sin indicar'}{w.archivado||w.estado==='finalizado'?' · Archivado':''}</span><Warnings messages={p.warnings}/></td><td>{w.zona||'—'}</td><td><StatusControl work={w} actions={actions}/></td><td><div className="row-actions"><button className="text-button" onClick={()=>actions.onOpen(w)}>Abrir</button>{p.latest&&<button className="text-button" onClick={()=>actions.onExtend(w,p.latest)}>Ampliaciones ({p.extensions.length})</button>}<button className="icon-button delete-icon" disabled={actions.busy} onClick={()=>actions.onDelete(w)} aria-label={`Eliminar ${w.descripcion}`}><Trash2 size={14}/></button></div></td></tr>})}</tbody></table>{!records.length&&<p className="empty">No se encontraron permisos con esos filtros.</p>}</div><div className="table-footer">Mostrando {records.length} registros · CSV exporta estos resultados con su orden.</div>
  </div>
}
