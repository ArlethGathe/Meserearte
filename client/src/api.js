export const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3001/api'

const HEADER_CSRF = 'X-CSRF-Token'
const escrituras = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
let tokenCsrf
let solicitudCsrf
let generacion = 0

export function limpiarCsrf() {
  generacion++
  tokenCsrf = undefined
  solicitudCsrf = undefined
}

function notificarSesionVencida() {
  limpiarCsrf()
  window.dispatchEvent(new Event('meserearte:sesion-vencida'))
}

function obtenerCsrf() {
  if (tokenCsrf) return Promise.resolve({ token: tokenCsrf })
  if (!solicitudCsrf) {
    const version = generacion
    solicitudCsrf = fetch(API_URL + '/auth/csrf', { credentials: 'include' })
      .then(async (respuesta) => {
        const token = respuesta.ok ? (await respuesta.json()).csrfToken : undefined
        if (version !== generacion) throw new Error('La sesión cambió.')
        if (typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)) {
          tokenCsrf = token
        }
        return { token: tokenCsrf, respuesta }
      })
      .finally(() => {
        if (version === generacion) solicitudCsrf = undefined
      })
  }
  return solicitudCsrf
}

export async function prepararCsrf() {
  return Boolean((await obtenerCsrf()).token)
}

export async function apiFetch(url, options) {
  const version = generacion
  const destino = new URL(url, window.location.href)
  const api = new URL(API_URL + '/', window.location.href)
  if (destino.origin !== api.origin || !destino.pathname.startsWith(api.pathname)) {
    throw new Error('Destino fuera de la API.')
  }
  const escritura = escrituras.has((options?.method ?? 'GET').toUpperCase())
  const logout = destino.pathname === api.pathname + 'auth/logout'
  const enviar = (token) => {
    const headers = new Headers(options?.headers)
    headers.delete(HEADER_CSRF)
    if (token) headers.set(HEADER_CSRF, token)
    return fetch(destino, { ...options, headers, credentials: 'include' })
  }
  const intento = async () => {
    if (!escritura) return { respuesta: await enviar() }
    const { token, respuesta } = await obtenerCsrf()
    if (version !== generacion) throw new Error('La sesión cambió.')
    if (!token && !(logout && respuesta?.status === 401)) {
      if (respuesta?.ok) throw new Error('La API no entregó un token CSRF válido.')
      return { respuesta }
    }
    return { respuesta: await enviar(token), token }
  }
  let { respuesta, token } = await intento()
  if (escritura && respuesta.status === 403 && version === generacion) {
    const error = await respuesta.clone().json().catch(() => null)
    if (error?.codigo === 'CSRF_INVALIDO') {
      if (tokenCsrf === token) tokenCsrf = undefined
      respuesta = (await intento()).respuesta
    }
  }
  if (respuesta.status === 401 && version === generacion) notificarSesionVencida()
  if (logout && respuesta.ok && version === generacion) limpiarCsrf()
  return respuesta
}
