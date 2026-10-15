export function validPublicConfig(url?: string, key?: string): boolean {
  if (!url || !key || url.includes('TU-PROYECTO') || key.includes('REEMPLAZAR')) return false
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    if (key.startsWith('sb_publishable_')) return true
    if (key.startsWith('eyJ')) {
      const encoded = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      return JSON.parse(atob(encoded)).role === 'anon'
    }
  } catch { return false }
  return false
}
