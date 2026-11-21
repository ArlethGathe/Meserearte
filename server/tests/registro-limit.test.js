import assert from 'node:assert/strict'
import { test } from 'node:test'
import { leerConfiguracionLimiteLogin, leerConfiguracionLimiteRegistro } from '../src/login-limit-config.js'
import { crearLimitadorIntentos } from '../src/login-limit.js'

test('valida la configuración independiente de registro', () => {
  assert.deepEqual(leerConfiguracionLimiteRegistro({}), {
    ventanaMs: 600000, maxPorIp: 30, maxPorIpCorreo: 5, maxClaves: 10000,
  })
  for (const env of [
    { REGISTER_WINDOW_SECONDS: '0' },
    { REGISTER_MAX_KEYS: '1' },
    { REGISTER_MAX_PER_IP: '3', REGISTER_MAX_PER_IP_EMAIL: '4' },
    { REGISTER_MAX_PER_IP_EMAIL: '5.5' },
  ]) assert.throws(() => leerConfiguracionLimiteRegistro(env), RangeError)
  assert.equal(leerConfiguracionLimiteLogin({ REGISTER_WINDOW_SECONDS: '10' }).ventanaMs, 60000)
})

test('separa pares, orígenes y almacenes de login y registro', () => {
  let ahora = 0
  const opciones = { ventanaMs: 2000, maxPorIp: 3, maxPorIpCorreo: 2, maxClaves: 20 }
  const registro = crearLimitadorIntentos(opciones, () => ahora)
  const login = crearLimitadorIntentos(opciones, () => ahora)
  assert.equal(registro.reservar('ip-a', 'a').permitido, true)
  assert.equal(registro.reservar('ip-a', 'a').permitido, true)
  assert.deepEqual(registro.reservar('ip-a', 'a'), { permitido: false, retryAfter: 2 })
  assert.equal(registro.reservar('ip-b', 'a').permitido, true)
  assert.equal(registro.reservar('ip-a', 'b').permitido, true)
  assert.equal(registro.reservar('ip-a', 'c').permitido, false)
  assert.equal(login.reservar('ip-a', 'a').permitido, true)
  ahora = 2000
  assert.equal(registro.reservar('ip-a', 'a').permitido, true)
})

test('el máximo de claves rechaza entradas nuevas hasta liberar espacio', () => {
  let ahora = 0
  const registro = crearLimitadorIntentos(
    { ventanaMs: 1000, maxPorIp: 5, maxPorIpCorreo: 2, maxClaves: 2 },
    () => ahora
  )
  assert.equal(registro.reservar('ip-a', 'a').permitido, true)
  assert.deepEqual(registro.reservar('ip-b', 'b'), { permitido: false, retryAfter: 1 })
  assert.equal(registro.reservar('ip-a', 'a').permitido, true)
  ahora = 1000
  assert.equal(registro.reservar('ip-b', 'b').permitido, true)
})
