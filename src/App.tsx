import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { dashboard, validateDescription, csvCell } from './domain'
import {
  Activity, Archive, ArrowRight, Calendar, CalendarClock, CalendarDays,
  CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3,
  Database, Download, FileClock, Files, History,
  LayoutDashboard, LockKeyhole, LogOut, MessageSquare, Plus, RefreshCw,
  RotateCcw, Search, ShieldCheck, X,
} from 'lucide-react'
import {
  addDays, configured, dateTime, fetchAll, localToday, longDate, shortDate,
  statusLabels, statusOptions, supabase,
  type Ampliacion, type Comentario, type Historial, type Status, type Trabajo,
} from './lib'

type View = 'panel' | 'calendario' | 'registro' | 'archivo'
type DetailTab = 'datos' | 'ampliaciones' | 'comentarios' | 'historial'
interface WorkDraft {
  descripcion: string
  numero_permiso: string
  fecha_programada: string
  zona: string
  empresa: string
  estado: Status
  notas: string
}
const emptyDraft: WorkDraft = {
  descripcion: '', numero_permiso: '', fecha_programada: '', zona: '',
  empresa: '', estado: 'pendiente', notas: '',
}
function draftOf(work: Trabajo): WorkDraft {
  return {
    descripcion: work.descripcion, numero_permiso: work.numero_permiso ?? '',
    fecha_programada: work.fecha_programada ?? '', zona: work.zona ?? '',
    empresa: work.empresa ?? '', estado: work.estado, notas: work.notas ?? '',
  }
}
function tag(status: Status) {
  return <span className={`tag status-${status}`}><span className="tag-dot" />{statusLabels[status]}</span>
}
function readableError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message)
    if (message.includes('duplicate key')) return 'Ese número de permiso o ampliación ya está registrado.'
    if (/invalid login credentials/i.test(message)) return 'El correo o la contraseña no son correctos.'
    if (/fetch|network|connection/i.test(message)) return 'No se pudo conectar con Supabase. Comprueba tu conexión e inténtalo de nuevo.'
    if (/row-level security|permission denied/i.test(message)) return 'Tu sesión no permite esta operación. Vuelve a iniciar sesión y comprueba las políticas de acceso.'
    return message
  }
  return 'Ha ocurrido un error al guardar los datos.'
}

function AuthScreen({ onSignIn, initialError }: { onSignIn: (email: string, password: string) => Promise<void>, initialError?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await onSignIn(email, password) } catch (err) { setError(readableError(err)) } finally { setBusy(false) }
  }
  return <div className="auth-page">
    <div className="auth-box">
      <div className="brand big-brand"><span className="brand-icon"><ClipboardList size={22}/></span><span><strong>PT CONTROL</strong><small>Gestión y seguimiento de permisos</small></span></div>
      <div className="auth-icon"><LockKeyhole size={26}/></div>
      <h1>Acceso personal</h1><p>Introduce tus credenciales para consultar y actualizar tus permisos de trabajo.</p>
      <form onSubmit={submit} className="auth-form">
        <label>Correo electrónico<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com"/></label>
        <label>Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Tu contraseña"/></label>
        {(error || initialError) && <div className="alert error" role="alert">{error || initialError}</div>}
        <button className="primary full" disabled={busy} type="submit">{busy ? 'Accediendo…' : 'Entrar en PT CONTROL'} <ArrowRight size={16}/></button>
      </form>
      <p className="fineprint"><ShieldCheck size={14}/> No hay registro público. El acceso se configura en Supabase.</p>
    </div>
  </div>
}
function NoConfig() {
  return <div className="auth-page"><div className="auth-box">
    <div className="brand big-brand"><span className="brand-icon"><ClipboardList/></span><strong>PT CONTROL</strong></div>
    <div className="auth-icon"><Database/></div>
    <h1>Falta conectar la base de datos</h1>
    <p>El proyecto todavía no tiene configuradas las variables de entorno de Supabase. Consulta <code>README.md</code> y crea tu archivo <code>.env.local</code>.</p>
    <div className="alert info">Esta pantalla no simula persistencia: no se crearán permisos hasta configurar la conexión real.</div>
  </div></div>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [view, setView] = useState<View>('panel')
  const [records, setRecords] = useState<Trabajo[]>([])
  const [extensions, setExtensions] = useState<Ampliacion[]>([])
  const [comments, setComments] = useState<Comentario[]>([])
  const [history, setHistory] = useState<Historial[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('datos')
  const [draft, setDraft] = useState<WorkDraft>(emptyDraft)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [company, setCompany] = useState('')
  const [zone, setZone] = useState('')
  const [permitNumber, setPermitNumber] = useState('')
  const [description, setDescription] = useState('')
  const [onlyExtended, setOnlyExtended] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [sortBy, setSortBy] = useState<keyof Trabajo>('fecha_programada')
  const [sortAsc, setSortAsc] = useState(true)
  const [weekShift, setWeekShift] = useState(0)
  const [extensionNumber, setExtensionNumber] = useState('')
  const [extensionDate, setExtensionDate] = useState(localToday())
  const [extensionNotes, setExtensionNotes] = useState('')
  const [newComment, setNewComment] = useState('')
  const [today, setToday] = useState(localToday())
  const loadVersion = useRef(0)
  const [loaded, setLoaded] = useState(false)
  const modalRef = useRef<HTMLElement>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy

  useEffect(() => {
    if (!editing) return
    const previousFocus = document.activeElement as HTMLElement | null
    const dialog = modalRef.current
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]') || [])
    focusable()[0]?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) setEditing(null)
      if (e.key !== 'Tab') return
      const elements = focusable(), first = elements[0], last = elements[elements.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = overflow; previousFocus?.focus() }
  }, [editing])

  useEffect(() => {
    const timer = window.setInterval(() => setToday(localToday()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!supabase) { setAuthChecked(true); return }
    const client = supabase
    let mounted = true
    client.auth.getSession().then(({ data, error: authErr }) => {
      if (!mounted) return
      if (authErr) setError(readableError(authErr))
      setSession(data.session); setAuthChecked(true)
    }).catch(err => { if (mounted) { setError(readableError(err)); setAuthChecked(true) } })
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const reload = useCallback(async () => {
    if (!supabase) return
    const version = ++loadVersion.current
    setLoading(true); setLoadError('')
    try {
      const [w, ex, co, hi] = await Promise.all([
        fetchAll('trabajos'), fetchAll('ampliaciones'), fetchAll('comentarios'), fetchAll('historial_cambios'),
      ])
      if (version !== loadVersion.current) return
      setRecords(w as unknown as Trabajo[])
      setExtensions(ex as unknown as Ampliacion[])
      setComments(co as unknown as Comentario[])
      setHistory(hi as unknown as Historial[])
      setLoaded(true)
    } catch (err) { if (version === loadVersion.current) { setLoaded(false); setLoadError(`No se pudo cargar la base de datos: ${readableError(err)}`) } }
    finally { if (version === loadVersion.current) setLoading(false) }
  }, [])

  useEffect(() => {
    if (session?.user.id) { void reload() }
    else { setRecords([]); setExtensions([]); setComments([]); setHistory([]); setEditing(null); setLoaded(false); setToast(''); setLoadError('') }
    return () => { ++loadVersion.current }
  }, [session?.user.id, reload])

  useEffect(() => {
    if (!session) return
    const refresh = () => { void reload() }
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer) }
  }, [session?.user.id, reload])

  const { active, unplanned, pending, issued, executing, finished, todayJobs, upcoming, overdue } = useMemo(() => dashboard(records, today), [records, today])
  const selected = editing && editing !== 'new' ? records.find(w => w.id === editing) : undefined
  const extensionsOf = (id: string) => extensions.filter(e => e.trabajo_id === id)

  async function login(email: string, password: string) {
    if (!supabase) return
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr) throw authErr
  }
  async function logout() {
    if (!supabase) return
    try {
      const { error: authErr } = await supabase.auth.signOut({ scope: 'local' })
      if (authErr) throw authErr
      setEditing(null); setError('')
    } catch (err) { setError(readableError(err)) }
  }
  function openWork(id?: string, tab: DetailTab = 'datos', plan = false) {
    if (busy) return
    const work = records.find(w => w.id === id)
    setEditing(work ? work.id : 'new')
    setDraft(work ? { ...draftOf(work), ...(plan ? { fecha_programada: today } : {}) } : { ...emptyDraft })
    setDetailTab(tab); setExtensionNumber(''); setExtensionDate(today)
    setExtensionNotes(''); setNewComment(''); setError('')
  }
  function closeWork() { if (!busy) setEditing(null) }
  async function saveWork(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !session) return
    const desc = draft.descripcion.trim()
    const validation = validateDescription(desc)
    if (validation) { setError(validation); return }
    setBusy(true); setError('')
    try {
      const payload = {
        descripcion: desc,
        numero_permiso: draft.numero_permiso.trim() || null,
        fecha_programada: draft.fecha_programada || null,
        zona: draft.zona.trim() || null,
        empresa: draft.empresa.trim() || null,
        estado: draft.estado,
        notas: draft.notas.trim() || null,
      }
      if (editing === 'new') {
        const { error: saveError } = await supabase.from('trabajos').insert(payload)
        if (saveError) throw saveError
      } else if (editing) {
        const { data, error: saveError } = await supabase.from('trabajos').update(payload).eq('id', editing).select('id').single()
        if (saveError || !data) throw saveError || new Error('No se pudo actualizar el trabajo.')
      }
      setEditing(null); setToast('Trabajo guardado correctamente')
      await reload()
    } catch (err) { setError(readableError(err)) }
    finally { setBusy(false) }
  }
  async function quickUpdate(id: string, data: Partial<Pick<Trabajo, 'estado' | 'fecha_programada' | 'archivado'>>) {
    if (!supabase) return
    setBusy(true); setError('')
    try {
      const { data: saved, error: updateError } = await supabase.from('trabajos').update(data).eq('id', id).select('id').single()
      if (updateError || !saved) throw updateError || new Error('No se pudo actualizar el permiso.')
      setToast('Permiso actualizado'); await reload()
    } catch (err) { setError(readableError(err)) }
    finally { setBusy(false) }
  }
  async function addExtension(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !selected) return
    if (!extensionNumber.trim()) { setError('Introduce el número de ampliación.'); return }
    setBusy(true); setError('')
    try {
      const { error: saveError } = await supabase.from('ampliaciones').insert({
        trabajo_id: selected.id,
        numero_ampliacion: extensionNumber.trim(),
        fecha_ampliacion: extensionDate,
        observaciones: extensionNotes.trim() || null,
      })
      if (saveError) throw saveError
      setExtensionNumber(''); setExtensionNotes(''); setToast('Ampliación añadida')
      await reload()
    } catch (err) { setError(readableError(err)) }
    finally { setBusy(false) }
  }
  async function addComment(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !selected) return
    if (!newComment.trim()) { setError('Escribe un comentario antes de guardarlo.'); return }
    setBusy(true); setError('')
    try {
      const { error: saveError } = await supabase.from('comentarios').insert({ trabajo_id: selected.id, contenido: newComment.trim() })
      if (saveError) throw saveError
      setNewComment(''); setToast('Comentario añadido'); await reload()
    } catch (err) { setError(readableError(err)) }
    finally { setBusy(false) }
  }
  function exportCSV() {
    const columns = ['fecha_programada', 'numero_permiso', 'descripcion', 'zona', 'empresa', 'estado', 'ampliaciones', 'notas', 'archivado']
    // Neutralizar fórmulas al abrir el CSV en Excel (inyección CSV).
    const rows = records.map(w => {
      const fields: Record<string, string | boolean | null> = {
        ...w,
        ampliaciones: extensionsOf(w.id).map(e => e.numero_ampliacion).join(' | '),
      }
      return columns.map(c => csvCell(fields[c])).join(';')
    })
    const csv = '\ufeff' + [columns.join(';'), ...rows].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `PT_CONTROL_${today}.csv`; anchor.click()
    URL.revokeObjectURL(url)
  }
  function exportBackup() {
    const backup = { format: 'PT_CONTROL_v1', exported_at: new Date().toISOString(),
      trabajos: records, ampliaciones: extensions, comentarios: comments, historial_cambios: history }
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `PT_CONTROL_copia_${today}.json`; anchor.click()
    URL.revokeObjectURL(url)
  }
  const PermitCard = ({ work }: { work: Trabajo }) => <div className="permit-card" onClick={() => openWork(work.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWork(work.id) } }} tabIndex={0} role="button" aria-label={`Abrir ${work.descripcion}`}>
    <div className="permit-top"><span className="permit-no">{work.numero_permiso || 'SIN Nº · BORRADOR'}</span>{tag(work.estado)}</div>
    <strong className="permit-title">{work.descripcion}</strong>
    <div className="permit-meta">{work.zona || 'Sin zona'}{work.empresa ? ` · ${work.empresa}` : ''}</div>
    <div className="permit-bottom"><span><Calendar size={12}/>{shortDate(work.fecha_programada)}</span>{extensionsOf(work.id).length > 0 && <span className="extension-mark"><Files size={12}/>{extensionsOf(work.id).length} ampl.</span>}</div>
  </div>

  if (!configured) return <NoConfig />
  if (!authChecked) return <div className="loading-page"><RefreshCw className="spin"/> Comprobando sesión…</div>
  if (!session) return <AuthScreen onSignIn={login} initialError={error}/>
  const nav: { id: View, name: string, icon: typeof LayoutDashboard }[] = [
    { id: 'panel', name: 'Panel diario', icon: LayoutDashboard },
    { id: 'calendario', name: 'Calendario', icon: CalendarDays },
    { id: 'registro', name: 'Registro', icon: ClipboardList },
    { id: 'archivo', name: 'Archivados', icon: Archive },
  ]
  const totalActive = active.length
  const weekStart = (() => { const d = new Date(`${today}T12:00:00`); const weekday = (d.getDay() + 6) % 7; return addDays(today, -weekday + weekShift * 7) })()
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const visibleRecords = (view === 'archivo' ? records.filter(w => w.archivado) : includeArchived ? records : active)
    .filter(w => filter === 'todos' || (filter === 'sin_programar' ? !w.fecha_programada && w.estado !== 'finalizado'
      : filter === 'ampliados' ? extensionsOf(w.id).length > 0 : w.estado === filter))
    .filter(w => `${w.descripcion} ${w.numero_permiso ?? ''} ${w.empresa ?? ''} ${w.zona ?? ''} ${w.notas ?? ''} ${extensionsOf(w.id).map(e => e.numero_ampliacion).join(' ')}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
    .filter(w => (!dateFrom || !!w.fecha_programada && w.fecha_programada >= dateFrom) && (!dateTo || !!w.fecha_programada && w.fecha_programada <= dateTo))
    .filter(w => (!company || w.empresa === company) && (!zone || w.zona === zone))
    .filter(w => (w.numero_permiso || '').toLocaleLowerCase('es').includes(permitNumber.toLocaleLowerCase('es')) && w.descripcion.toLocaleLowerCase('es').includes(description.toLocaleLowerCase('es')))
    .filter(w => !onlyExtended || extensionsOf(w.id).length > 0)
    .sort((a, b) => {
      const left = a[sortBy], right = b[sortBy]
      if (left == null && right != null) return 1
      if (right == null && left != null) return -1
      return String(left ?? '').localeCompare(String(right ?? ''), 'es', { numeric: true }) * (sortAsc ? 1 : -1) || a.id.localeCompare(b.id)
    })
  function sortColumn(key: keyof Trabajo, label: string) {
    return <button type="button" className="sort-button" onClick={() => { setSortBy(key); setSortAsc(sortBy === key ? !sortAsc : true) }}>{label}{sortBy === key ? sortAsc ? ' ↑' : ' ↓' : ' ↕'}</button>
  }

  return <div className="app">
    <header className="topbar"><div className="top-main"><div className="brand"><span className="brand-icon"><ClipboardList size={21}/></span><div><strong>PT CONTROL</strong><small>Gestión y planificación de permisos</small></div></div>
      <div className="top-actions"><span className="today-label">{longDate(today)}</span><button className="primary" onClick={() => openWork()}><Plus size={16}/> Nuevo trabajo</button><button className="icon-button inverted" onClick={() => void logout()} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={18}/></button></div>
    </div></header>
    <div className="tabs-bar"><nav className="tabs" aria-label="Secciones">{nav.map(({id,name,icon:Icon}) => <button key={id} className={`navtab ${view===id?'selected':''}`} onClick={() => { setView(id); setFilter('todos'); setSearch('') }}><Icon size={17}/>{name}</button>)}</nav></div>
    <main className="main">
      {loadError && <div className="alert error global-error" role="alert"><span>{loadError}</span><button disabled={loading} onClick={()=>void reload()}>Reintentar</button></div>}
      {error && !editing && <div className="alert error global-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Ocultar error"><X size={15}/></button></div>}
      {toast && <div className="alert success global-toast" role="status"><CheckCircle2 size={16}/><span>{toast}</span><button onClick={() => setToast('')} aria-label="Ocultar aviso"><X size={15}/></button></div>}
      {loading && <div className="sync-line"><RefreshCw size={13} className="spin"/> Sincronizando datos…</div>}
      {view === 'panel' && <>
        <div className="page-title"><div><h1>Panel diario</h1><p>Resumen de los permisos y trabajos pendientes de gestión.</p></div><button className="secondary" onClick={() => void reload()}><RefreshCw size={15}/> Actualizar</button></div>
        <div className="kpis">
          <button className="kpi orange" onClick={() => { setView('registro'); setFilter('sin_programar') }}><span>Sin programar</span><strong>{unplanned.length}</strong><small>Sin fecha asignada</small></button>
          <button className="kpi purple" onClick={() => { setView('registro'); setFilter('pendiente') }}><span>Pendientes</span><strong>{pending.length}</strong><small>Pendientes de emisión</small></button>
          <button className="kpi blue" onClick={() => { setView('registro'); setFilter('emitido') }}><span>Emitidos</span><strong>{issued.length}</strong><small>Permisos emitidos</small></button>
          <button className="kpi green" onClick={() => { setView('registro'); setFilter('ejecucion') }}><span>En ejecución</span><strong>{executing.length}</strong><small>Trabajos en curso</small></button>
          <button className="kpi gray" onClick={() => { setView('registro'); setFilter('finalizado') }}><span>Finalizados</span><strong>{finished.length}</strong><small>Conservados en el registro</small></button>
        </div>
        <div className="dashboard-grid">
          <section className="panel"><div className="panel-heading"><div><h2><Activity size={18}/> Trabajos de hoy</h2><small>{shortDate(today)} · {todayJobs.length} trabajos programados</small></div></div>
            <div className="card-list">{todayJobs.length ? todayJobs.map(w => <PermitCard key={w.id} work={w}/>) : <Empty message="No tienes trabajos programados para hoy."/>}</div>
          </section>
          <section className="panel attention"><div className="panel-heading"><div><h2><CalendarClock size={18}/> Sin programar</h2><small>Trabajos que necesitan fecha</small></div><b className="counter orange-counter">{unplanned.length}</b></div>
            <div className="card-list">{unplanned.length ? unplanned.map(w => <div className="unplanned-row" key={w.id}><PermitCard work={w}/><button className="small-action" onClick={() => openWork(w.id, 'datos', true)}>Programar <ArrowRight size={13}/></button></div>) : <Empty message="No hay trabajos pendientes de programar."/>}</div>
          </section>
        </div>
        {overdue.length > 0 && <section className="panel overdue"><div className="panel-heading"><h2><Clock3 size={18}/> Trabajos con fecha anterior aún abiertos</h2><b className="counter">{overdue.length}</b></div><div className="compact-cards">{overdue.map(w => <PermitCard key={w.id} work={w}/>)}</div></section>}
        <section className="panel next-panel"><div className="panel-heading"><h2><Calendar size={18}/> Próximos trabajos</h2><button className="text-button" onClick={() => setView('calendario')}>Ver calendario <ArrowRight size={14}/></button></div>
          <div className="compact-cards">{upcoming.length ? upcoming.slice(0, 6).map(w => <PermitCard key={w.id} work={w}/>) : <Empty message="No hay próximos trabajos programados."/>}</div>
        </section>
      </>}
      {view === 'calendario' && <>
        <div className="page-title"><div><h1>Calendario semanal</h1><p>Distribución de trabajos por fecha programada.</p></div><div className="week-actions"><button className="secondary icon-only" title="Semana anterior" onClick={() => setWeekShift(s => s - 1)}><ChevronLeft size={19}/></button><button className="secondary" onClick={() => setWeekShift(0)}>Hoy</button><button className="secondary icon-only" title="Semana siguiente" onClick={() => setWeekShift(s => s + 1)}><ChevronRight size={19}/></button></div></div>
        <div className="calendar-layout"><section className="panel"><div className="panel-heading"><h2>Semana del {shortDate(days[0])} al {shortDate(days[6])}</h2></div><div className="calendar-grid">
          {days.map((day,i) => <div key={day} className={`day-column ${day===today?'today':''}`}><div className="day-header"><small>{['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'][i]}</small><strong>{Number(day.slice(8))}</strong></div><div className="day-events">{active.filter(w => w.fecha_programada === day).sort((a,b)=>a.descripcion.localeCompare(b.descripcion)).map(w => <button key={w.id} className={`day-event event-${w.estado}`} onClick={() => openWork(w.id)}><b>{w.numero_permiso || 'SIN Nº'}</b><span>{w.descripcion}</span></button>)}</div></div>)}
        </div></section><aside className="panel calendar-aside"><div className="panel-heading"><h2>Sin fecha</h2><b className="counter orange-counter">{unplanned.length}</b></div>{unplanned.map(w => <PermitCard key={w.id} work={w}/>)}{!unplanned.length && <Empty message="Todo está programado."/>}</aside></div>
      </>}
      {(view === 'registro' || view === 'archivo') && <>
        <div className="page-title"><div><h1>{view === 'archivo' ? 'Archivo de trabajos' : 'Registro de permisos'}</h1><p>{view === 'archivo' ? 'Trabajos ocultos del panel que puedes recuperar.' : `${totalActive} trabajos no archivados · Consulta y seguimiento.`}</p></div><div className="week-actions"><button className="secondary" disabled={!loaded || loading} onClick={exportCSV}><Download size={16}/> CSV Excel</button><button className="secondary" disabled={!loaded || loading} onClick={exportBackup}><Database size={16}/> Copia JSON</button></div></div>
        <div className="panel register-panel"><div className="list-tools"><div className="filters">{[['todos','Todos'],['sin_programar','Sin programar'],['pendiente','Pendientes'],['emitido','Emitidos'],['ejecucion','En ejecución'],['finalizado','Finalizados'],['ampliados','Ampliados']].map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`filter ${filter===value?'on':''}`}>{label}</button>)}</div><div className="searchbox"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nº, zona, empresa o trabajo" aria-label="Buscar permisos"/></div></div>
          <div className="advanced-filters">
            <label className="form-field">Desde<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/></label>
            <label className="form-field">Hasta<input type="date" min={dateFrom || undefined} value={dateTo} onChange={e => setDateTo(e.target.value)}/></label>
            <label className="form-field">Empresa<select value={company} onChange={e => setCompany(e.target.value)}><option value="">Todas</option>{Array.from(new Set(records.map(w=>w.empresa).filter((v): v is string=>!!v))).sort().map(v=><option key={v}>{v}</option>)}</select></label>
            <label className="form-field">Zona<select value={zone} onChange={e => setZone(e.target.value)}><option value="">Todas</option>{Array.from(new Set(records.map(w=>w.zona).filter((v): v is string=>!!v))).sort().map(v=><option key={v}>{v}</option>)}</select></label>
            <label className="form-field">Número de permiso<input value={permitNumber} onChange={e=>setPermitNumber(e.target.value)}/></label>
            <label className="form-field">Descripción<input value={description} onChange={e=>setDescription(e.target.value)}/></label>
            <label className="check-filter"><input type="checkbox" checked={onlyExtended} onChange={e=>setOnlyExtended(e.target.checked)}/> Solo ampliados</label>
            {view !== 'archivo' && <label className="check-filter"><input type="checkbox" checked={includeArchived} onChange={e=>setIncludeArchived(e.target.checked)}/> Incluir archivados</label>}
            <button className="text-button" onClick={()=>{setFilter('todos');setSearch('');setDateFrom('');setDateTo('');setCompany('');setZone('');setPermitNumber('');setDescription('');setOnlyExtended(false);setIncludeArchived(false)}}>Limpiar filtros</button>
            {dateFrom && dateTo && dateFrom > dateTo && <p role="alert">La fecha inicial debe ser anterior a la final.</p>}
          </div>
          <div className="table-scroll"><table className="registry"><thead><tr>{(['fecha_programada','numero_permiso','descripcion','zona','estado'] as const).map((key,i)=><th key={key} aria-sort={sortBy===key ? sortAsc?'ascending':'descending':'none'}>{sortColumn(key,['Fecha','Nº PT','Trabajo','Zona','Estado'][i])}</th>)}<th>Ampliación</th><th></th></tr></thead><tbody>{visibleRecords.map(w => <tr key={w.id} onClick={() => openWork(w.id)} tabIndex={0} onKeyDown={e => { if(e.key==='Enter')openWork(w.id) }}><td>{shortDate(w.fecha_programada)}</td><td className="cell-number">{w.numero_permiso || 'Sin asignar'}</td><td><strong>{w.descripcion}</strong><span className="table-sub">{w.empresa || 'Empresa sin indicar'}{w.archivado ? ' · Archivado' : ''}</span></td><td>{w.zona || '—'}</td><td>{tag(w.estado)}</td><td>{extensionsOf(w.id).length ? <span className="extension-mark"><Files size={12}/>{extensionsOf(w.id).length}</span> : '—'}</td><td className="cell-arrow"><ChevronRight size={16}/></td></tr>)}</tbody></table>{!visibleRecords.length && <Empty message="No se encontraron permisos con esos filtros."/>}</div><div className="table-footer">Mostrando {visibleRecords.length} registros · Las exportaciones incluyen todos los trabajos.</div>
        </div>
      </>}
      <footer><span><ShieldCheck size={14}/> Acceso privado · Datos almacenados en Supabase</span><span>PT CONTROL v1.0</span></footer>
    </main>
    {editing !== null && <div className="modal-overlay" onMouseDown={e => { if (e.target===e.currentTarget) closeWork() }}>
      <section ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-label="Detalle del trabajo">
        <header className="modal-head"><div><small>{editing === 'new' ? 'NUEVO REGISTRO' : selected?.numero_permiso || 'TRABAJO SIN Nº'}</small><h2>{editing === 'new' ? 'Nuevo trabajo' : selected?.descripcion}</h2></div><button className="icon-button" disabled={busy} onClick={closeWork} aria-label="Cerrar"><X size={21}/></button></header>
        {editing !== 'new' && <div className="modal-tabs">{([['datos','Datos'],['ampliaciones','Ampliaciones'],['comentarios','Comentarios'],['historial','Historial']] as [DetailTab,string][]).map(([id,label])=><button key={id} className={detailTab===id?'active':''} onClick={()=>setDetailTab(id)}>{label}</button>)}</div>}
        <div className="modal-body">
          {error && <div className="alert error" role="alert">{error}</div>}
          {detailTab === 'datos' && <form id="work-form" onSubmit={saveWork}>
            <div className="form-grid"><label className="form-field full">Descripción del trabajo *<input maxLength={300} required value={draft.descripcion} onChange={e=>setDraft(d=>({...d,descripcion:e.target.value}))} placeholder="Ej. Mantenimiento preventivo de batería de condensadores"/></label>
              <label className="form-field">Número de permiso<input maxLength={70} value={draft.numero_permiso} onChange={e=>setDraft(d=>({...d,numero_permiso:e.target.value}))} placeholder="Ej. PT-2684"/></label>
              <label className="form-field">Fecha programada<input type="date" value={draft.fecha_programada} onChange={e=>setDraft(d=>({...d,fecha_programada:e.target.value}))}/></label>
              <label className="form-field">Zona / instalación<input maxLength={150} value={draft.zona} onChange={e=>setDraft(d=>({...d,zona:e.target.value}))} placeholder="Ej. Sala eléctrica"/></label>
              <label className="form-field">Empresa ejecutante<input maxLength={150} value={draft.empresa} onChange={e=>setDraft(d=>({...d,empresa:e.target.value}))} placeholder="Ej. Empresa contratista"/></label>
              <label className="form-field">Estado del permiso<select value={draft.estado} onChange={e=>setDraft(d=>({...d,estado:e.target.value as Status}))}>{statusOptions.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
              <div className="form-field"><span>Programación</span><div className="schedule-summary">{draft.fecha_programada ? <><Calendar size={15}/> {shortDate(draft.fecha_programada)}</> : <><CalendarClock size={15}/> Sin programar</>}</div></div>
              <label className="form-field full">Notas generales<textarea maxLength={6000} rows={3} value={draft.notas} onChange={e=>setDraft(d=>({...d,notas:e.target.value}))} placeholder="Información del trabajo, requisitos o incidencias generales"/></label>
            </div><div className="form-actions"><button type="button" className="secondary" onClick={closeWork}>Cancelar</button><button disabled={busy} className="primary" type="submit">{busy ? 'Guardando…' : 'Guardar trabajo'} <ArrowRight size={15}/></button></div>
            {selected && <div className="archive-action">{selected.archivado ? <button type="button" className="text-button" disabled={busy} onClick={()=>void quickUpdate(selected.id,{archivado:false})}><RotateCcw size={15}/> Recuperar del archivo</button> : <button type="button" className="text-button muted" disabled={busy} onClick={()=>void quickUpdate(selected.id,{archivado:true})}><Archive size={15}/> Archivar trabajo</button>}<small>Archivar no elimina el registro.</small></div>}
          </form>}
          {detailTab === 'ampliaciones' && selected && <div className="modal-section"><h3><Files size={17}/> Ampliaciones vinculadas</h3><p className="section-intro">El número original permanece en el trabajo. Puedes incorporar varias ampliaciones.</p>
            <div className="timeline">{extensionsOf(selected.id).map(ex=><div className="timeline-row" key={ex.id}><div><strong>{ex.numero_ampliacion}</strong><small>{shortDate(ex.fecha_ampliacion)}</small>{ex.observaciones && <p>{ex.observaciones}</p>}</div></div>)}{!extensionsOf(selected.id).length&&<Empty message="Todavía no se han registrado ampliaciones."/>}</div>
            <form onSubmit={addExtension} className="subform"><h4>Nueva ampliación</h4><div className="form-grid"><label className="form-field">Nº ampliación *<input maxLength={70} required value={extensionNumber} onChange={e=>setExtensionNumber(e.target.value)} placeholder="PT-2695"/></label><label className="form-field">Fecha<input type="date" required value={extensionDate} onChange={e=>setExtensionDate(e.target.value)}/></label><label className="form-field full">Observaciones<textarea maxLength={2000} value={extensionNotes} onChange={e=>setExtensionNotes(e.target.value)} rows={2}/></label></div><button disabled={busy} className="primary" type="submit"><Plus size={15}/> Añadir ampliación</button></form>
          </div>}
          {detailTab === 'comentarios' && selected && <div className="modal-section"><h3><MessageSquare size={17}/> Seguimiento y comentarios</h3><div className="timeline">{comments.filter(c=>c.trabajo_id===selected.id).map(c=><div className="timeline-row" key={c.id}><small>{dateTime(c.created_at)}</small><p>{c.contenido}</p></div>)}{!comments.some(c=>c.trabajo_id===selected.id)&&<Empty message="Aún no existen comentarios."/>}</div><form onSubmit={addComment} className="subform"><label className="form-field">Añadir comentario<textarea maxLength={3000} required rows={3} value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Escribe un seguimiento o incidencia…"/></label><button disabled={busy} className="primary" type="submit"><Plus size={15}/> Guardar comentario</button></form></div>}
          {detailTab === 'historial' && selected && <div className="modal-section"><h3><History size={17}/> Historial de cambios</h3><p className="section-intro">Generado automáticamente al crear, editar o ampliar un trabajo.</p><div className="timeline">{history.filter(h=>h.trabajo_id===selected.id).map(h=><div className="timeline-row" key={h.id}><small>{dateTime(h.created_at)} · {h.tipo.replace('_',' ')}</small><p>{h.resumen}</p></div>)}{!history.some(h=>h.trabajo_id===selected.id)&&<Empty message="No hay movimientos registrados."/>}</div></div>}
        </div>
      </section>
    </div>}
  </div>
}

function Empty({ message }: { message: string }) { return <div className="empty"><FileClock size={25}/><p>{message}</p></div> }
