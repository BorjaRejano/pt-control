const url = process.env.VITE_SUPABASE_URL?.trim()
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
if (!url || !key || !URL.canParse(url) || !url.startsWith('https://') || url.includes('TU-PROYECTO')) {
  throw new Error('Configura la URL HTTPS y la clave pública de Supabase antes de publicar.')
}
let publicKey = key.startsWith('sb_publishable_') && !key.includes('REEMPLAZAR')
if (key.startsWith('eyJ')) {
  try { publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon' } catch { publicKey = false }
}
if (!publicKey) throw new Error('La clave debe ser publishable o anon. No se admite una clave administrativa.')
