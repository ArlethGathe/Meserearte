export function leerConfiguracionSesion(env = process.env) {
  const entero = (nombre, predeterminado, maximo) => {
    const valor = env[nombre] ?? String(predeterminado)
    if (typeof valor !== 'string' || valor.trim() !== valor
      || !/^[1-9][0-9]*$/.test(valor) || Number(valor) > maximo) {
      throw new Error(nombre + ' debe ser un entero entre 1 y ' + maximo + '.')
    }
    return Number(valor)
  }
  const inactividadSegundos = entero('SESSION_IDLE_MINUTES', 30, 1440) * 60
  const absolutaSegundos = entero('SESSION_ABSOLUTE_HOURS', 8, 168) * 3600
  if (inactividadSegundos > absolutaSegundos) {
    throw new Error('SESSION_IDLE_MINUTES no puede superar la duración absoluta.')
  }

  const secure = env.SESSION_COOKIE_SECURE ?? 'true'
  if (!['true', 'false'].includes(secure) || (secure === 'false' && env.NODE_ENV !== 'development')) {
    throw new Error('SESSION_COOKIE_SECURE=false solo se permite durante desarrollo local.')
  }
 const sameSite = (env.SESSION_COOKIE_SAMESITE ?? 'lax').toLowerCase()

if (!['lax', 'strict', 'none'].includes(sameSite)) {
  throw new Error(
    'SESSION_COOKIE_SAMESITE debe ser lax, strict o none.'
  )
}

if (sameSite === 'none' && secure !== 'true') {
  throw new Error(
    'SESSION_COOKIE_SAMESITE=none requiere SESSION_COOKIE_SECURE=true.'
  )
}
  const nombre = env.SESSION_COOKIE_NAME ?? 'meserearte_session'
  if (typeof nombre !== 'string' || nombre.trim() !== nombre
    || !/^[a-zA-Z0-9_-]{1,64}$/.test(nombre) || (secure === 'false' && /^__(host|secure)-/i.test(nombre))) {
    throw new Error('SESSION_COOKIE_NAME no es válido para esta configuración.')
  }
  let origen = null
  if (env.SESSION_APP_ORIGIN !== undefined) {
    const url = new URL(env.SESSION_APP_ORIGIN)
    if (url.origin !== env.SESSION_APP_ORIGIN || url.protocol !== 'https:') {
      throw new Error('SESSION_APP_ORIGIN debe ser un origen HTTPS exacto.')
    }
    origen = url.origin
  }
  return {
    nombre, origen, inactividadSegundos, absolutaSegundos,
    cookie: { httpOnly: true, secure: secure === 'true', sameSite, path: '/' },
  }
}
