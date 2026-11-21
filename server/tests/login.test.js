import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import argon2 from 'argon2'
import express from 'express'
import { crearLogin } from '../src/login.js'
import { hashPassword } from '../src/passwords.js'

test('POST /api/auth/login durante la transición', async (t) => {
  const correo = 'cuenta@example.invalid'
  const password = 'Credencial ficticia de login'
  const hash = await hashPassword(password)
  const usuario = {
    id: 42, nombre: 'Cuenta', apellidos: 'Ficticia', correo, rol: 'Mesero',
    estado: 'Activo', meseroId: 21, salaId: 5,
  }
  const migrada = { ...usuario, estadoCredencial: 'migrada', sinPassword: true, passwordLegado: null, hash }
  const pendiente = { ...usuario, estadoCredencial: 'pendiente', sinPassword: false, passwordLegado: password, hash: null }
  const reset = { ...usuario, estadoCredencial: 'requiere_restablecimiento', sinPassword: true, passwordLegado: null, hash: null }
  const rechazo = {
    status: 401,
    body: { ok: false, mensaje: 'Correo o contraseña incorrectos.' },
  }
  const exito = { status: 200, body: { ok: true, usuario, ...usuario } }
  const warn = t.mock.method(console, 'warn', () => {})
  const logError = t.mock.method(console, 'error', () => {})
  const verificar = t.mock.method(argon2, 'verify')
  let cuenta
  let falloConsulta
  let consultas = 0

  const app = express()
  app.use(express.json())
  app.post('/api/auth/login', crearLogin({
    async query(sql, params) {
      consultas++
      assert.match(sql, /^\s*SELECT\b/)
      assert.match(sql, /LOWER\(\$1\)/)
      assert.deepEqual(params, [correo])
      if (falloConsulta) throw falloConsulta
      return { rows: cuenta ? [cuenta] : [] }
    },
  }, (value) => String(value ?? '').trim().toLowerCase()))

  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const url = 'http://127.0.0.1:' + server.address().port + '/api/auth/login'

  async function login(row, candidate = password, rol = 'Mesero') {
    cuenta = row
    const anterior = consultas
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: '  ' + correo.toUpperCase() + '  ', password: candidate, rol }),
    })
    const body = await response.json()
    assert.equal(consultas, anterior + 1)
    for (const perfil of [body, body.usuario].filter(Boolean)) {
      for (const clave of ['password', 'password_hash', 'passwordLegado', 'hash', 'estadoCredencial', 'sinPassword']) {
        assert.equal(Object.hasOwn(perfil, clave), false)
      }
    }
    return { status: response.status, body }
  }

  await t.test('migrada delega la verificación al módulo Argon2id', async () => {
    assert.deepEqual(await login(migrada), exito)
    assert.deepEqual(await login(migrada, 'incorrecta'), rechazo)
    assert.equal(verificar.mock.callCount(), 2)
    assert.deepEqual(verificar.mock.calls[0].arguments, [hash, password])
  })

  await t.test('pendiente admite la credencial legada sin escrituras ni uso de Argon2', async () => {
    assert.deepEqual(await login(pendiente), exito)
    assert.deepEqual(await login(pendiente, 'incorrecta'), rechazo)
    assert.deepEqual(await login(pendiente, 'X' + password.slice(1)), rechazo)
    assert.equal(verificar.mock.callCount(), 2)
  })

  await t.test('restablecimiento, hash inválido y cuenta inexistente devuelven el mismo 401', async () => {
    assert.deepEqual(await login(reset), rechazo)
    assert.deepEqual(await login({ ...migrada, hash: 'PHC inválido' }), rechazo)
    assert.deepEqual(await login(undefined), rechazo)
    assert.equal(warn.mock.callCount(), 0)
  })

  await t.test('inconsistencias se rechazan y solo se registra el identificador', async () => {
    const inconsistencias = [
      { ...migrada, hash: null },
      { ...migrada, sinPassword: false },
      { ...pendiente, sinPassword: true, passwordLegado: null },
      { ...pendiente, hash },
      { ...reset, hash },
      { ...reset, estadoCredencial: 'desconocida' },
    ]
    for (const row of inconsistencias) assert.deepEqual(await login(row), rechazo)
    assert.equal(warn.mock.callCount(), inconsistencias.length)
    for (const call of warn.mock.calls) {
      assert.deepEqual(call.arguments, ['Login: credencial inconsistente', { usuarioId: usuario.id }])
    }
    assert.equal(verificar.mock.callCount(), 2)
  })

  await t.test('conserva las respuestas por cuenta inactiva y rol incorrecto', async () => {
    assert.deepEqual(await login({ ...pendiente, estado: 'Inactivo' }), {
      status: 403,
      body: { ok: false, mensaje: 'La cuenta se encuentra inactiva.' },
    })
    assert.deepEqual(await login(pendiente, password, 'Administrador'), {
      status: 403,
      body: { ok: false, mensaje: 'El rol seleccionado no corresponde a esta cuenta.' },
    })
  })

  await t.test('un fallo interno no incluye detalles en la respuesta ni en el registro', async () => {
    falloConsulta = new Error(password)
    assert.deepEqual(await login(pendiente), {
      status: 500,
      body: { ok: false, mensaje: 'Error al iniciar sesión.' },
    })
    assert.deepEqual(logError.mock.calls[0].arguments, [
      'Login: error interno al consultar o verificar la credencial',
    ])
  })
})
