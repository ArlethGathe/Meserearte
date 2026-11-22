import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import argon2 from 'argon2'
import express from 'express'
import pg from 'pg'
import { crearLogin } from '../src/login.js'
import { crearSesiones } from '../src/sesiones.js'
import { leerConfiguracionSesion } from '../src/session-config.js'
import { leerConfiguracionLimiteLogin } from '../src/login-limit-config.js'
import { crearLimitadorLogin, limitarLogin } from '../src/login-limit.js'
import { hashPassword } from '../src/passwords.js'

test('login HTTP con limitador y PostgreSQL aislado', {
  skip: process.env.MESEREARTE_ENSAYO_LOGIN !== '1',
}, async (t) => {
  const db = new pg.Client({
    host: '127.0.0.1', port: 55439, database: 'meserearte_login_test',
    user: 'meserearte_test', password: '',
  })
  await db.connect()
  t.after(() => db.end())
  const catalogo = await db.query(`
    SELECT current_database() AS base, inet_server_port() AS puerto,
           to_regclass('public.auth_sesiones') IS NULL AS sin_migrar,
           NOT EXISTS (SELECT 1 FROM public.usuarios) AS vacia
  `)
  assert.deepEqual(catalogo.rows[0], {
    base: 'meserearte_login_test', puerto: 55439, sin_migrar: true, vacia: true,
  })
  for (const nombre of ['001_auth.up', '002_credenciales.up', '004_sesiones.up']) {
    await db.query(await readFile(new URL('../migrations/' + nombre + '.sql', import.meta.url), 'utf8'))
  }

  const password = 'Credencial exclusiva del ensayo HTTP'
  const hash = await hashPassword(password)
  const pendiente = 'pendiente@example.invalid'
  const migrada = 'migrada@example.invalid'
  const reset = 'reset@example.invalid'
  const inactiva = 'inactiva@example.invalid'
  const inexistente = 'inexistente@example.invalid'
  await db.query(`
    INSERT INTO public.usuarios (id, nombre, apellidos, correo, password, password_hash, rol, estado, estado_credencial)
    VALUES (101, 'Prueba', 'Pendiente', $1, $5, NULL, 'Administrador', 'Activo', 'pendiente'),
           (102, 'Prueba', 'Migrada', $2, NULL, $6, 'Mesero', 'Activo', 'migrada'),
           (103, 'Prueba', 'Restablecer', $3, NULL, NULL, 'Mesero', 'Activo', 'requiere_restablecimiento'),
           (104, 'Prueba', 'Inactiva', $4, NULL, $6, 'Mesero', 'Inactivo', 'migrada')
  `, [pendiente, migrada, reset, inactiva, password, hash])
  await db.query(`
    INSERT INTO public.salas (id, nombre, codigo, administrador_id)
    VALUES (301, 'Sala ficticia', 'ENSAYOHTTP', 101);
    INSERT INTO public.meseros (id, usuario_id, sala_id) VALUES (201, 102, 301);
  `)

  const verificar = t.mock.method(argon2, 'verify')
  const consulta = t.mock.method(db, 'query')
  let ahora = 0
  const configuracion = leerConfiguracionLimiteLogin({
    LOGIN_WINDOW_SECONDS: '2', LOGIN_MAX_PER_IP: '20', LOGIN_MAX_PER_IP_EMAIL: '3',
  })
  const normalizar = (valor = '') => String(valor).trim().toLowerCase()
  const app = express()
  app.use(express.json())
  app.post('/api/auth/login',
    limitarLogin(crearLimitadorLogin(configuracion, () => ahora), normalizar),
    crearLogin(db, normalizar, crearSesiones(db, leerConfiguracionSesion({})).emitir))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const url = 'http://127.0.0.1:' + server.address().port + '/api/auth/login'

  async function login(correo, clave = password, rol = 'Mesero') {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password: clave, rol }),
    })
    const json = await response.text()
    for (const secreto of [password, hash, '"password"', '"password_hash"', '"passwordLegado"', '"hash"']) {
      assert.equal(json.includes(secreto), false)
    }
    return { status: response.status, body: JSON.parse(json), retry: response.headers.get('retry-after') }
  }

  await t.test('HTTP conserva éxitos, perfil, 401 uniforme y 403', async () => {
    assert.equal((await login(pendiente, password, 'Administrador')).status, 200)
    const resultado = await login(migrada)
    assert.equal(resultado.status, 200)
    assert.equal(resultado.body.usuario.meseroId, 201)
    assert.equal(resultado.body.usuario.salaId, 301)
    const incorrecta = await login(migrada, 'incorrecta')
    assert.equal(incorrecta.status, 401)
    assert.deepEqual(await login(inexistente), incorrecta)
    assert.deepEqual(await login(reset), incorrecta)
    assert.equal((await login(inactiva)).status, 403)
    assert.equal((await login(pendiente)).status, 403)
  })

  await t.test('los fallos agotan el cupo y el 429 evita SQL y Argon2id hasta expirar', async () => {
    ahora = 2000
    for (let i = 0; i < 3; i++) {
      assert.equal((await login(migrada, 'incorrecta')).status, 401)
    }
    const totalConsultas = consulta.mock.callCount()
    const totalVerificaciones = verificar.mock.callCount()
    assert(totalVerificaciones >= 3)
    assert.deepEqual(await login('  ' + migrada.toUpperCase() + '  '), {
      status: 429,
      body: { ok: false, mensaje: 'Demasiados intentos. Intenta de nuevo más tarde.' },
      retry: '2',
    })
    ahora = 3999
    assert.equal((await login(migrada)).retry, '1')
    assert.equal(consulta.mock.callCount(), totalConsultas)
    assert.equal(verificar.mock.callCount(), totalVerificaciones)
    ahora = 4000
    assert.equal((await login(migrada)).status, 200)
    assert.equal(verificar.mock.callCount(), totalVerificaciones + 1)
  })
})
