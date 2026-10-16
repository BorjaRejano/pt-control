export function readableError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Ha ocurrido un error al guardar los datos.'
  if (/duplicate key/i.test(message)) return 'Ese número de permiso o ampliación ya está registrado.'
  if (/invalid login credentials/i.test(message)) return 'El correo o la contraseña no son correctos.'
  if (/fetch|network|connection/i.test(message)) return 'No se pudo conectar con Supabase. Comprueba tu conexión e inténtalo de nuevo.'
  if (/null value.*(numero_ampliacion|fecha_ampliacion)|permission denied for table (ampliaciones|trabajos)|schema cache/i.test(message)) return `No se pudo completar la operación. Comprueba que has aplicado la migración 003 en Supabase y vuelve a intentarlo. Detalle: ${message}`
  if (/row-level security|permission denied/i.test(message)) return 'Tu sesión no permite esta operación. Vuelve a iniciar sesión y comprueba las políticas de acceso.'
  return message
}
