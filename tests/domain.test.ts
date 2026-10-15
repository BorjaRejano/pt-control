import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localToday, addDays, dashboard, validateDescription, csvCell } from '../src/domain.ts'
import { validPublicConfig } from '../src/config.ts'

const work = (overrides = {}) => ({ id: 'test', user_id: 'test', descripcion: 'Trabajo ficticio', numero_permiso: null, fecha_programada: null, zona: null, empresa: null, estado: 'pendiente', notas: null, archivado: false, created_at: '', updated_at: '', ...overrides })

test('fecha de Madrid independiente de la zona del ordenador y horario de verano', () => {
  assert.equal(localToday(new Date('2026-10-14T22:30:00Z')), '2026-10-15')
  assert.equal(localToday(new Date('2026-12-14T23:30:00Z')), '2026-12-15')
  assert.equal(localToday(new Date('2026-10-25T01:30:00Z')), '2026-10-25')
})
test('aritmética de calendario cruza meses, años y cambios de hora', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-28', 2), '2026-03-30')
  assert.equal(addDays('2028-03-01', -1), '2028-02-29')
})
test('sin programar es independiente del estado; finalizados y archivados se conservan', () => {
  const records = [work(), work({id:'finished',estado:'finalizado'}), work({id:'archived',archivado:true}), work({id:'execution',estado:'ejecucion'})]
  // El objeto de prueba permite construir los cuatro estados válidos del dominio.
  const result = dashboard(records as Parameters<typeof dashboard>[0], '2026-10-15')
  assert.equal(result.active.length, 3)
  assert.equal(result.unplanned.length, 2)
  assert.equal(result.pending.length, 1)
  assert.equal(result.executing.length, 1)
  assert.equal(result.finished.length, 1)
  assert.equal(records.length, 4)
})
test('clasifica hoy, vencidos y próximos por fecha; finalizados de hoy siguen visibles', () => {
  const records = [work({fecha_programada:'2026-10-14'}),work({fecha_programada:'2026-10-17'}),work({fecha_programada:'2026-10-16'}),work({fecha_programada:'2026-10-15',estado:'finalizado'})]
  const result = dashboard(records as Parameters<typeof dashboard>[0], '2026-10-15')
  assert.equal(result.overdue.length, 1)
  assert.equal(result.todayJobs.length, 1)
  assert.deepEqual(result.upcoming.map(w=>w.fecha_programada), ['2026-10-16','2026-10-17'])
})
test('las ampliaciones no alteran el estado ni el número del permiso original', () => {
  const record = work({estado:'ejecucion',numero_permiso:'FICTICIO-1',ampliaciones:[{numero_ampliacion:'FICTICIO-2'}]})
  const result = dashboard([record] as Parameters<typeof dashboard>[0], '2026-10-15')
  assert.equal(result.executing.length, 1)
  assert.equal(result.executing[0].numero_permiso, 'FICTICIO-1')
})
test('valida descripción obligatoria, espacios y longitud máxima', () => {
  assert.ok(validateDescription('   '))
  assert.ok(validateDescription('a'.repeat(301)))
  assert.equal(validateDescription('Trabajo ficticio'), null)
})
test('CSV protege fórmulas de Excel y escapa comillas, saltos y valores vacíos', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"')
  assert.equal(csvCell('  @SUM(A1)'), '"\'  @SUM(A1)"')
  assert.equal(csvCell('Texto "prueba"\nSiguiente'), '"Texto ""prueba""\nSiguiente"')
  assert.equal(csvCell(null), '""')
})
test('rechaza configuraciones inválidas y claves administrativas', () => {
  assert.equal(validPublicConfig('incorrecto','sb_publishable_prueba'), false)
  assert.equal(validPublicConfig('https://example.supabase.co','sb_secret_prueba'), false)
  assert.equal(validPublicConfig('https://example.supabase.co','sb_publishable_REEMPLAZAR'), false)
  assert.equal(validPublicConfig('https://example.supabase.co','sb_publishable_prueba'), true)
  const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({role}))}.firma`
  assert.equal(validPublicConfig('https://example.supabase.co',jwt('service_role')), false)
  assert.equal(validPublicConfig('https://example.supabase.co',jwt('anon')), true)
})
