import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, ShieldCheck, Database } from 'lucide-react'
import { Brand } from './Brand'
import { readableError } from './errors'

export function AuthScreen({ onSignIn, initialError }: { onSignIn: (email: string, password: string) => Promise<void>, initialError?: string }) {
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
      <Brand/>
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
export function NoConfig() {
  return <div className="auth-page"><div className="auth-box">
    <Brand/>
    <div className="auth-icon"><Database/></div>
    <h1>Falta conectar la base de datos</h1>
    <p>El proyecto todavía no tiene configuradas las variables de entorno de Supabase. Consulta <code>README.md</code> y crea tu archivo <code>.env.local</code>.</p>
    <div className="alert info">Esta pantalla no simula persistencia: no se crearán permisos hasta configurar la conexión real.</div>
  </div></div>
}
