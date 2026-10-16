import type { Ampliacion, Status, Trabajo } from './lib'

export function localToday(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function nextWorkingDay(today: string): string {
  let day = addDays(today, 1)
  while ([0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())) day = addDays(day, 1)
  return day
}
export function mondayOf(iso: string): string {
  return addDays(iso, -((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7))
}
export function isoWeek(iso: string): { week: number, year: number } {
  const thursday = new Date(`${addDays(mondayOf(iso), 3)}T00:00:00Z`)
  const year = thursday.getUTCFullYear()
  const firstThursday = new Date(`${addDays(mondayOf(`${year}-01-04`), 3)}T00:00:00Z`)
  return { year, week: 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000) }
}

// La fecha de alta ordena las ampliaciones, incluso cuando falta su fecha de ejecución.
export function extensionsFor(extensions: Ampliacion[], workId: string): Ampliacion[] {
  return extensions.filter(e => e.trabajo_id === workId).sort((a, b) =>
    (b.created_at || '').localeCompare(a.created_at || '')
    || (b.fecha_ampliacion || '').localeCompare(a.fecha_ampliacion || '')
    || b.id.localeCompare(a.id))
}
export function extensionWarnings(extension: Ampliacion): string[] {
  return [!extension.numero_ampliacion?.trim() ? 'Falta número de permiso ampliado' : '', !extension.fecha_ampliacion ? 'Falta fecha de ampliación' : ''].filter(Boolean)
}
export function permitInfo(work: Trabajo, extensions: Ampliacion[]) {
  const ordered = extensionsFor(extensions, work.id)
  const latest = ordered[0] ?? null
  const numberPending = !!latest && !latest.numero_ampliacion?.trim()
  const datePending = !!latest && !latest.fecha_ampliacion
  const warnings = Array.from(new Set(ordered.flatMap((ex, index) => extensionWarnings(ex).map(w => index ? `Ampliación anterior: ${w}` : w))))
  return {
    extensions: ordered, latest, warnings, numberPending, datePending,
    number: ordered.find(ex => ex.numero_ampliacion?.trim())?.numero_ampliacion || work.numero_permiso,
    date: ordered.find(ex => ex.fecha_ampliacion)?.fecha_ampliacion || work.fecha_programada,
  }
}
export function isArchived(work: Trabajo): boolean { return work.archivado || work.estado === 'finalizado' }
export function stateChange(work: Trabajo, estado: Status) { return { estado, archivado: estado === 'finalizado' || work.archivado } }
export function dashboard(records: Trabajo[], today: string, extensions: Ampliacion[] = []) {
  const active = records.filter(w => !isArchived(w))
  const nextDay = nextWorkingDay(today)
  const date = (w: Trabajo) => permitInfo(w, extensions).date
  return {
    active, nextDay,
    unplanned: active.filter(w => !date(w)),
    pending: active.filter(w => w.estado === 'pendiente'),
    issued: active.filter(w => w.estado === 'emitido'),
    executing: active.filter(w => w.estado === 'ejecucion'),
    finished: records.filter(w => w.estado === 'finalizado'),
    todayJobs: active.filter(w => date(w) === today),
    upcoming: active.filter(w => date(w) === nextDay),
    overdue: active.filter(w => !!date(w) && date(w)! < today).sort((a,b) => date(a)!.localeCompare(date(b)!)),
  }
}
export type SortKey = 'fecha_programada' | 'numero_permiso' | 'descripcion' | 'zona' | 'estado'
export interface WorkFilters {
  archive: boolean; includeArchived: boolean; state: string; search: string;
  dateFrom: string; dateTo: string; company: string; zone: string; permitNumber: string;
  description: string; onlyExtended: boolean; sortBy: SortKey; sortAsc: boolean;
}
export const defaultFilters: WorkFilters = { archive: false, includeArchived: false, state: 'todos', search: '', dateFrom: '', dateTo: '', company: '', zone: '', permitNumber: '', description: '', onlyExtended: false, sortBy: 'fecha_programada', sortAsc: true }
const lower = (value: string | null) => (value || '').toLocaleLowerCase('es')
export function filterWorks(records: Trabajo[], extensions: Ampliacion[], filters: WorkFilters): Trabajo[] {
  const f = filters
  const info = new Map(records.map(w => [w.id, permitInfo(w, extensions)]))
  return records.filter(w => {
    const p = info.get(w.id)!
    if (f.archive ? !isArchived(w) : !f.includeArchived && isArchived(w)) return false
    if (f.state !== 'todos' && !(f.state === 'sin_programar' ? !p.date : f.state === 'ampliados' ? !!p.latest : w.estado === f.state)) return false
    const numbers = [w.numero_permiso, ...p.extensions.map(e => e.numero_ampliacion)].map(lower)
    const text = [w.descripcion, w.empresa, w.zona, w.notas, ...numbers].map(lower).join(' ')
    return text.includes(lower(f.search)) && numbers.some(n => n.includes(lower(f.permitNumber)))
      && lower(w.descripcion).includes(lower(f.description))
      && (!f.company || w.empresa === f.company) && (!f.zone || w.zona === f.zone)
      && (!f.dateFrom || !!p.date && p.date >= f.dateFrom) && (!f.dateTo || !!p.date && p.date <= f.dateTo)
      && (!f.onlyExtended || !!p.latest)
  }).sort((a,b) => {
    const value = (w: Trabajo) => f.sortBy === 'fecha_programada' ? info.get(w.id)!.date : f.sortBy === 'numero_permiso' ? info.get(w.id)!.number : w[f.sortBy]
    const left = value(a), right = value(b)
    if (left == null && right != null) return 1
    if (right == null && left != null) return -1
    return String(left ?? '').localeCompare(String(right ?? ''), 'es', { numeric: true }) * (f.sortAsc ? 1 : -1) || a.id.localeCompare(b.id)
  })
}
export function validateDescription(value: string): string | null {
  if (!value.trim()) return 'Introduce una descripción del trabajo.'
  if (value.trim().length > 300) return 'La descripción no puede superar 300 caracteres.'
  return null
}
export function csvCell(value: unknown): string {
  const raw = String(value ?? '')
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}
export function excelDate(iso: string | null): string { return iso ? iso.split('-').reverse().join('/') : '' }
export function buildCsv(records: Trabajo[], extensions: Ampliacion[]): string {
  const columns = ['Fecha vigente o de referencia', 'Número vigente o de referencia', 'Número original', 'Descripción', 'Empresa', 'Zona', 'Estado', 'Historial de ampliaciones', 'Avisos', 'Notas', 'Archivado']
  const labels: Record<Status,string> = {pendiente:'Pendiente',emitido:'Emitido',ejecucion:'En ejecución',finalizado:'Finalizado'}
  const rows = records.map(w => {
    const p = permitInfo(w, extensions)
    return [excelDate(p.date), p.number, w.numero_permiso, w.descripcion, w.empresa, w.zona, labels[w.estado],
      p.extensions.map(ex => `${ex.numero_ampliacion || 'Número pendiente'} (${excelDate(ex.fecha_ampliacion) || 'Fecha pendiente'})`).join(' | '),
      p.warnings.join(' | '), w.notas, isArchived(w) ? 'Sí' : 'No'].map(csvCell).join(';')
  })
  return '\ufeff' + [columns.map(csvCell).join(';'), ...rows].join('\r\n')
}
