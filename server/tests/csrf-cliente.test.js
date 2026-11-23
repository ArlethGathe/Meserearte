import assert from 'node:assert/strict'
import { test } from 'node:test'
import { API_URL, apiFetch, limpiarCsrf, prepararCsrf } from '../../client/src/api.js'

test('cliente mantiene CSRF en memoria, reintenta una vez y limpia al vencer sesión', async (t) => {
  const navegador = new EventTarget()
  navegador.location = { href: 'http://localhost:5173/' }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: navegador })
  t.after(() => { delete globalThis.window; limpiarCsrf() })
  let expiradas = 0
  navegador.addEventListener('meserearte:sesion-vencida', () => expiradas++)
  let emitidos = 0
  let estado = 403
  const escrituras = []
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    assert.equal(opciones.credentials, 'include')
    if (String(url).endsWith('/auth/csrf')) {
      emitidos++
      return Response.json({ csrfToken: String(emitidos).repeat(43) })
    }
    if (!opciones.method || opciones.method === 'GET') {
      assert.equal(opciones.headers.has('X-CSRF-Token'), false)
      return Response.json([])
    }
    escrituras.push(opciones.headers.get('X-CSRF-Token'))
    return Response.json({ codigo: 'CSRF_INVALIDO' }, { status: estado })
  })

  assert.equal(await prepararCsrf(), true)
  await apiFetch(API_URL + '/salas')
  assert.equal((await apiFetch(API_URL + '/salas', { method: 'POST' })).status, 403)
  assert.deepEqual(escrituras, ['1'.repeat(43), '2'.repeat(43)])
  assert.equal(emitidos, 2)
  estado = 401
  assert.equal((await apiFetch(API_URL + '/salas', { method: 'POST' })).status, 401)
  assert.equal(expiradas, 1)
  await prepararCsrf()
  assert.equal(emitidos, 3)
  estado = 200
  await apiFetch(API_URL + '/auth/logout', { method: 'POST' })
  await prepararCsrf()
  assert.equal(emitidos, 4)
})
