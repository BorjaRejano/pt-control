import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../src/App'
import { localToday, type Trabajo } from '../src/lib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

function visualSnapshot(name: string) {
  if (!process.env.PT_QA_EXPORT) return
  mkdirSync('.qa',{recursive:true})
  const css=readFileSync('src/styles.css','utf8')
  writeFileSync(`.qa/${name}.html`,`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PT CONTROL · Prueba visual</title><style>${css}</style><body><div style="background:#fff0e1;padding:8px;text-align:center;font:12px Arial">PRUEBA VISUAL · Datos ficticios · Captura estática sin guardado</div>${document.body.innerHTML}</body></html>`)
}

const mock = vi.hoisted(() => ({
  session: null as unknown,
  records: [] as unknown[],
  extensions: [] as unknown[],
  fetch: vi.fn(), insert: vi.fn(), update: vi.fn(), login: vi.fn(),
}))
vi.mock('../src/lib', async original => {
  const actual = await original<typeof import('../src/lib')>()
  return { ...actual, configured: true, fetchAll: mock.fetch, supabase: {
    auth: {
      getSession: async () => ({data:{session:mock.session},error:null}),
      onAuthStateChange: () => ({data:{subscription:{unsubscribe:vi.fn()}}}),
      signInWithPassword: mock.login,
      signOut: async () => ({error:null}),
    },
    from: () => ({insert:mock.insert, update:mock.update}),
  }}
})

function work(fields: Partial<Trabajo> = {}): Trabajo {
  return {id:'ficticio-1',user_id:'test',descripcion:'Trabajo ficticio de prueba',numero_permiso:null,fecha_programada:null,estado:'pendiente',empresa:'Empresa ficticia A',zona:'Zona ficticia A',notas:null,archivado:false,created_at:'2026-10-15T09:00:00Z',updated_at:'2026-10-15T09:00:00Z',...fields}
}
async function showApp() {
  render(<App/> )
  await screen.findByRole('heading',{name:'Panel diario'})
  await waitFor(()=>expect(mock.fetch).toHaveBeenCalledWith('trabajos'))
  await waitFor(()=>expect(screen.queryByText('Sincronizando datos…')).toBeNull())
}
beforeEach(()=>{
  mock.session = {user:{id:'test'}}
  mock.records = [work()]
  mock.extensions = []
  mock.fetch.mockImplementation(async table => table==='trabajos'?mock.records:table==='ampliaciones'?mock.extensions:[])
  mock.insert.mockResolvedValue({error:null})
  mock.login.mockResolvedValue({error:null})
})
afterEach(cleanup)

describe('interfaz privada con backend simulado exclusivamente en pruebas', ()=>{
  it('protege el panel y comunica credenciales incorrectas', async ()=>{
    mock.session=null
    mock.login.mockResolvedValue({error:{message:'Invalid login credentials'}})
    render(<App/> )
    await screen.findByRole('heading',{name:'Acceso personal'})
    expect(screen.queryByText('Panel diario')).toBeNull()
    fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'ficticio@example.com'}})
    fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'solo-prueba'}})
    fireEvent.submit(screen.getByRole('button',{name:/Entrar en PT CONTROL/}).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent','El correo o la contraseña no son correctos.')
    expect(mock.fetch).not.toHaveBeenCalled()
  })
  it('rechaza descripciones vacías y guarda trabajos sin fecha ni número',async()=>{
    await showApp()
    fireEvent.click(screen.getByRole('button',{name:'Nuevo trabajo'}))
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByLabelText('Descripción del trabajo *')
    visualSnapshot('formulario')
    fireEvent.change(input,{target:{value:'   '}})
    fireEvent.submit(input.closest('form')!)
    expect(within(dialog).getByRole('alert').textContent).toContain('Introduce una descripción')
    expect(mock.insert).not.toHaveBeenCalled()
    fireEvent.change(input,{target:{value:'Prueba sin programar'}})
    fireEvent.submit(input.closest('form')!)
    await screen.findByRole('status')
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({descripcion:'Prueba sin programar',fecha_programada:null,numero_permiso:null,estado:'pendiente'}))
  })
  it('conserva el formulario y muestra el error real si falla el guardado',async()=>{
    mock.insert.mockResolvedValue({error:{message:'duplicate key value violates unique constraint'}})
    await showApp()
    fireEvent.click(screen.getByRole('button',{name:'Nuevo trabajo'}))
    const input=screen.getByLabelText('Descripción del trabajo *')
    fireEvent.change(input,{target:{value:'Prueba con error'}})
    fireEvent.submit(input.closest('form')!)
    expect((await screen.findByRole('alert')).textContent).toContain('ya está registrado')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('Prueba con error')
  })
  it('muestra cinco contadores y mantiene los finalizados de hoy',async()=>{
    mock.records=[work(),work({id:'finalizado',descripcion:'Finalizado ficticio de hoy',fecha_programada:localToday(),estado:'finalizado'})]
    await showApp()
    expect(screen.getByRole('button',{name:/Finalizados\s*1/})).toBeTruthy()
    expect(screen.getByRole('button',{name:'Abrir Finalizado ficticio de hoy'})).toBeTruthy()
    visualSnapshot('panel')
  })
  it('combina filtros de empresa, fecha, descripción y ampliación',async()=>{
    mock.records=[work(),work({id:'ficticio-2',descripcion:'Trabajo futuro ficticio',empresa:'Empresa ficticia B',fecha_programada:'2026-11-01'})]
    mock.extensions=[{id:'extension-1',trabajo_id:'ficticio-2',numero_ampliacion:'FICTICIO-AMP',fecha_ampliacion:'2026-11-01'}]
    await showApp()
    fireEvent.click(screen.getByRole('button',{name:'Registro',exact:true}))
    fireEvent.change(screen.getByLabelText('Empresa'),{target:{value:'Empresa ficticia B'}})
    fireEvent.change(screen.getByLabelText('Desde'),{target:{value:'2026-11-01'}})
    fireEvent.change(screen.getByLabelText('Descripción'),{target:{value:'futuro'}})
    fireEvent.click(screen.getByLabelText('Solo ampliados'))
    expect(screen.getByText('Trabajo futuro ficticio')).toBeTruthy()
    expect(screen.queryByText('Trabajo ficticio de prueba')).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'Limpiar filtros'}))
    expect(screen.getByText('Trabajo ficticio de prueba')).toBeTruthy()
    visualSnapshot('registro')
  })
  it('añade ampliaciones sin modificar el trabajo original',async()=>{
    mock.records=[work({numero_permiso:'FICTICIO-ORIGINAL',estado:'ejecucion'})]
    await showApp()
    fireEvent.click(screen.getByRole('button',{name:'Abrir Trabajo ficticio de prueba'}))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Ampliaciones'}))
    fireEvent.change(screen.getByLabelText('Nº ampliación *'),{target:{value:'FICTICIO-AMP'}})
    fireEvent.submit(screen.getByRole('button',{name:'Añadir ampliación'}).closest('form')!)
    await screen.findByRole('status')
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({trabajo_id:'ficticio-1',numero_ampliacion:'FICTICIO-AMP'}))
    expect(mock.update).not.toHaveBeenCalled()
  })
  it('informa del fallo de conexión y bloquea copias incompletas',async()=>{
    mock.fetch.mockRejectedValue(new Error('Failed to fetch'))
    render(<App/> )
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo conectar con Supabase')
    fireEvent.click(screen.getByRole('button',{name:'Registro',exact:true}))
    expect((screen.getByRole('button',{name:'Copia JSON'}) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button',{name:'Reintentar'})).toBeTruthy()
  })
  it('navega semanas y permite abrir trabajos del calendario',async()=>{
    mock.records=[work({fecha_programada:localToday()})]
    await showApp()
    fireEvent.click(screen.getByRole('button',{name:'Calendario',exact:true}))
    expect(screen.getByRole('button',{name:/SIN Nº.*Trabajo ficticio/})).toBeTruthy()
    visualSnapshot('calendario')
    fireEvent.click(screen.getByTitle('Semana siguiente'))
    expect(screen.queryByRole('button',{name:/SIN Nº.*Trabajo ficticio/})).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'Hoy',exact:true}))
    fireEvent.click(screen.getByRole('button',{name:/SIN Nº.*Trabajo ficticio/}))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
