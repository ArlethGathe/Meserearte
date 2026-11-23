import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { crearCsrf, leerOrigenesDesarrollo, leerSecretoCsrf } from '../src/csrf.js'

test('producción exige un secreto aleatorio explícito y rechaza claves débiles', () => {
  for (const CSRF_SECRET of [undefined, '', 'débil', Buffer.alloc(32, 3).toString('base64url')]) {
    assert.throws(() => leerSecretoCsrf({ NODE_ENV: 'production', CSRF_SECRET }), /CSRF_SECRET/)
  }
  const secreto = randomBytes(32)
  assert.deepEqual(leerSecretoCsrf({ NODE_ENV: 'production', CSRF_SECRET: secreto.toString('base64url') }), secreto)
  assert.notDeepEqual(leerSecretoCsrf({}), leerSecretoCsrf({}))
  assert.deepEqual(leerOrigenesDesarrollo({ NODE_ENV: 'production' }), [])
  assert.throws(() => leerOrigenesDesarrollo({ APP_DEV_ORIGINS: 'https://ajeno.example.invalid' }))
})

test('la rotación invalida el token y la respuesta no revela datos internos', () => {
  const digestSesion = randomBytes(32)
  let respuesta
  const res = {
    set(nombre, valor) {
      assert.equal(nombre, 'Cache-Control')
      assert.equal(valor, 'no-store')
      return this
    },
    status(codigo) { this.codigo = codigo; return this },
    json(cuerpo) { respuesta = cuerpo },
  }
  const secreto = randomBytes(32)
  const antes = crearCsrf(secreto)
  antes.entregar({ digestSesion }, res)
  assert.deepEqual(Object.keys(respuesta), ['csrfToken'])
  const token = respuesta.csrfToken
  assert.notEqual(token, digestSesion.toString('base64url'))
  assert.notEqual(token, secreto.toString('base64url'))
  const req = { digestSesion, get: () => token }
  let autorizado = false
  antes.verificar(req, res, () => { autorizado = true })
  assert.equal(autorizado, true)
  crearCsrf(randomBytes(32)).verificar(req, res, () => assert.fail('Token anterior aceptado'))
  assert.equal(res.codigo, 403)
  assert.deepEqual(Object.keys(respuesta), ['ok', 'codigo', 'mensaje'])
})
