import { createClient } from '@supabase/supabase-js'
import { validPublicConfig } from './config'
export { localToday, addDays } from './domain'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
export const configured = validPublicConfig(url, publishableKey)
export const supabase = configured
  ? createClient(url!, publishableKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

export type Status = 'pendiente' | 'emitido' | 'ejecucion' | 'finalizado'
export const statusLabels: Record<Status, string> = {
  pendiente: 'Pendiente', emitido: 'Emitido', ejecucion: 'En ejecución', finalizado: 'Finalizado',
}
export const statusOptions: Status[] = ['pendiente', 'emitido', 'ejecucion', 'finalizado']

export interface Trabajo {
  id: string
  user_id: string
  descripcion: string
  numero_permiso: string | null
  fecha_programada: string | null
  zona: string | null
  empresa: string | null
  estado: Status
  notas: string | null
  archivado: boolean
  created_at: string
  updated_at: string
}
export interface Ampliacion {
  id: string
  trabajo_id: string
  numero_ampliacion: string
  fecha_ampliacion: string
  observaciones: string | null
}
export interface Comentario {
  id: string
  trabajo_id: string
  contenido: string
  created_at: string
}
export interface Historial {
  id: string
  trabajo_id: string
  tipo: string
  resumen: string
  created_at: string
}

export function shortDate(iso?: string | null): string {
  if (!iso) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`))
}
export function longDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00`))
}
export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

// Supabase aplica un límite de filas por respuesta; traemos todas las páginas para
// que el histórico no desaparezca cuando supere los 1.000 registros.
export async function fetchAll(table: 'trabajos' | 'ampliaciones' | 'comentarios' | 'historial_cambios') {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const rows: Record<string, unknown>[] = []
  const PAGE = 500
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false }).order('id').range(from, from + PAGE - 1)
    if (error) throw error
    const batch = (data || []) as Record<string, unknown>[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}
