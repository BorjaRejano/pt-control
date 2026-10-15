import type { Trabajo } from './lib'

export function localToday(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function dashboard(records: Trabajo[], today: string) {
  const active = records.filter(w => !w.archivado)
  return {
    active,
    unplanned: active.filter(w => !w.fecha_programada && w.estado !== 'finalizado'),
    pending: active.filter(w => w.estado === 'pendiente'),
    issued: active.filter(w => w.estado === 'emitido'),
    executing: active.filter(w => w.estado === 'ejecucion'),
    finished: active.filter(w => w.estado === 'finalizado'),
    todayJobs: active.filter(w => w.fecha_programada === today),
    upcoming: active.filter(w => !!w.fecha_programada && w.fecha_programada > today && w.estado !== 'finalizado').sort((a,b)=>a.fecha_programada!.localeCompare(b.fecha_programada!)),
    overdue: active.filter(w => !!w.fecha_programada && w.fecha_programada < today && w.estado !== 'finalizado'),
  }
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
