import assert from 'node:assert/strict'
import { test } from 'node:test'
import { leerConfiguracionLimiteLogin } from '../src/login-limit-config.js'
import { crearLimitadorLogin } from '../src/login-limit.js'

test('lee los valores predeterminados y rechaza parámetros inválidos', () => {
  assert.deepEqual(leerConfiguracionLimiteLogin({}), {
    ventanaMs: 60000, maxPorIp: 30, maxPorIpCorreo: 5, maxClaves: 10000,
  })
  for (const env of [
    { LOGIN_WINDOW_SECONDS: '0' },
    { LOGIN_WINDOW_SECONDS: '3601' },
    { LOGIN_WINDOW_SECONDS: '1\n' },
    { LOGIN_MAX_PER_IP: '1.5' },
    { LOGIN_MAX_PER_IP: '2', LOGIN_MAX_PER_IP_EMAIL: '3' },
    { LOGIN_MAX_KEYS: '1' },
  ]) {
    assert.throws(() => leerConfiguracionLimiteLogin(env), RangeError)
  }
})

test('limita el par IP y correo y el total por IP con ventanas que no se prolongan', () => {
  let ahora = 0
  const limite = crearLimitadorLogin(
    { ventanaMs: 1500, maxPorIp: 3, maxPorIpCorreo: 2, maxClaves: 10 },
    () => ahora
  )
  const ip = '192.0.2.1'
  const correo = 'cuenta@example.invalid'
  assert.deepEqual(limite.reservar(ip, correo), { permitido: true })
  assert.deepEqual(limite.reservar(ip, correo), { permitido: true })
  assert.deepEqual(limite.reservar(ip, correo), { permitido: false, retryAfter: 2 })
  assert.deepEqual(limite.reservar('192.0.2.2', correo), { permitido: true })
  assert.deepEqual(limite.reservar(ip, 'otra@example.invalid'), { permitido: true })
  assert.deepEqual(limite.reservar(ip, 'tercera@example.invalid'), { permitido: false, retryAfter: 2 })
  ahora = 1499
  assert.deepEqual(limite.reservar(ip, correo), { permitido: false, retryAfter: 1 })
  ahora = 1500
  assert.deepEqual(limite.reservar(ip, correo), { permitido: true })
})

test('acota el almacenamiento sin expulsar contadores vigentes ni subestimar el reintento', () => {
  let ahora = 0
  const limite = crearLimitadorLogin(
    { ventanaMs: 2000, maxPorIp: 10, maxPorIpCorreo: 5, maxClaves: 3 },
    () => ahora
  )
  const ip = '192.0.2.1'
  assert.equal(limite.reservar(ip, 'a@example.invalid').permitido, true)
  ahora = 1200
  assert.equal(limite.reservar(ip, 'b@example.invalid').permitido, true)
  ahora = 1500
  // Solo expirarán dos claves en t=2000. Una pertenecerá al intento que espera.
  assert.deepEqual(limite.reservar(ip, 'c@example.invalid'), { permitido: false, retryAfter: 1 })
  assert.deepEqual(limite.reservar('192.0.2.2', 'a@example.invalid'), { permitido: false, retryAfter: 1 })
  ahora = 2000
  assert.equal(limite.reservar(ip, 'c@example.invalid').permitido, true)
})
