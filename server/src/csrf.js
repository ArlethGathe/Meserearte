import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const HEADER_CSRF = 'X-CSRF-Token'
export const METODOS_ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function leerSecretoCsrf(env = process.env) {
  const valor = env.CSRF_SECRET
  if (valor === undefined && env.NODE_ENV !== 'production') return randomBytes(32)
  if (typeof valor === 'string' && /^[A-Za-z0-9_-]{43}$/.test(valor)) {
    const bytes = Buffer.from(valor, 'base64url')
    if (bytes.toString('base64url') === valor && new Set(bytes).size >= 16) return bytes
  }
  throw new Error('CSRF_SECRET debe contener 32 bytes aleatorios codificados en Base64URL.')
}

export function leerOrigenesDesarrollo(env = process.env) {
  if (env.NODE_ENV === 'production') return []
  return (env.APP_DEV_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((valor) => {
    const url = new URL(valor.trim())
    if (url.origin !== valor.trim() || url.protocol !== 'http:'
      || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('APP_DEV_ORIGINS solo admite orígenes HTTP locales explícitos.')
    }
    return url.origin
  })
}

export function crearCsrf(secreto) {
  const generar = (digest) => createHmac('sha256', secreto).update('meserearte:csrf:v1\0').update(digest).digest()

  function entregar(req, res) {
    return res.set('Cache-Control', 'no-store').json({ csrfToken: generar(req.digestSesion).toString('base64url') })
  }

  function verificar(req, res, next) {
    const recibido = req.get(HEADER_CSRF)
    if (typeof recibido === 'string' && recibido.length === 43 && /^[A-Za-z0-9_-]{43}$/.test(recibido)) {
      const bytes = Buffer.from(recibido, 'base64url')
      if (bytes.toString('base64url') === recibido && timingSafeEqual(bytes, generar(req.digestSesion))) return next()
    }
    return res.status(403).json({ ok: false, codigo: 'CSRF_INVALIDO', mensaje: 'La solicitud no se pudo validar.' })
  }

  return { entregar, verificar }
}
