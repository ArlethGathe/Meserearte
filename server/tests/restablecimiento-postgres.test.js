import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { setTimeout as esperar } from 'node:timers/promises'
import { test } from 'node:test'
import express from 'express'
import pg from 'pg'
import { crearLogin } from '../src/login.js'
import { crearSesiones } from '../src/sesiones.js'
import { leerConfiguracionSesion } from '../src/session-config.js'
import { configurarEntregaRestablecimiento, crearRestablecimiento } from '../src/restablecimiento.js'
import { hashPassword, verifyPassword } from '../src/passwords.js'

test('el adaptador de entrega usa únicamente HTTPS y coloca el token en el fragmento', async (t) => {
  const env = {
    PASSWORD_RESET_APP_URL: 'https://app.example.invalid/',
    PASSWORD_RESET_DELIVERY_URL: 'https://correo.example.invalid/entregar',
    PASSWORD_RESET_DELIVERY_KEY: 'secreto ficticio',
  }
  assert.equal(configurarEntregaRestablecimiento({}), null)
  assert.throws(() => configurarEntregaRestablecimiento({ ...env, PASSWORD_RESET_APP_URL: 'http://app.example.invalid' }))
  const envio = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 202 }))
  await configurarEntregaRestablecimiento(env)({ correo: 'cuenta@example.invalid', token: 'token-ficticio' })
  const [destino, opciones] = envio.mock.calls[0].arguments
  assert.equal(destino.href, env.PASSWORD_RESET_DELIVERY_URL)
  assert.equal(opciones.redirect, 'error')
  assert.deepEqual(JSON.parse(opciones.body), {
    correo: 'cuenta@example.invalid',
    enlace: 'https://app.example.invalid/#restablecer=token-ficticio',
  })
})

test('restablecimiento HTTP para cuentas migradas y por restablecer', {
  skip: process.env.MESEREARTE_ENSAYO_RESTABLECER !== '1',
}, async (t) => {
  const base = 'meserearte_restablecer_test'
  const db = new pg.Client({
    host: '127.0.0.1', port: 55439, database: base, user: 'meserearte_test', password: '',
  })
  await db.connect()
  t.after(() => db.end())
  const { rows: [destino] } = await db.query(`
    SELECT current_database() AS base, inet_server_port() AS puerto,
           NOT EXISTS (SELECT 1 FROM public.usuarios) AS vacia
  `)
  assert.deepEqual(destino, { base, puerto: 55439, vacia: true })
  for (const nombre of ['001_auth.up', '002_credenciales.up', '003_restablecimiento.up', '004_sesiones.up']) {
    await db.query(await readFile(new URL('../migrations/' + nombre + '.sql', import.meta.url), 'utf8'))
  }

  const migrada = 'migrada@example.invalid'
  const pendienteReset = 'restablecer@example.invalid'
  const inexistente = 'inexistente@example.invalid'
  const anterior = 'Credencial ficticia anterior'
  const nueva = 'Credencial ficticia nueva'
  const previo = await hashPassword(anterior)
  await db.query(`
    INSERT INTO public.usuarios (id, nombre, apellidos, correo, password_hash, estado_credencial, rol)
    VALUES (1, 'Cuenta', 'Ficticia', $1, $3, 'migrada', 'Mesero'),
           (2, 'Cuenta', 'Ficticia', $2, NULL, 'requiere_restablecimiento', 'Mesero')
  `, [migrada, pendienteReset, previo])

  const emitidos = []
  const app = express()
  app.use(express.json())
  const rutas = crearRestablecimiento({
    pool: db,
    entregar: async (entrega) => { emitidos.push(entrega) },
    limitarSolicitud: { reservar: () => ({ permitido: true }) },
  })
  app.post('/solicitar', rutas.solicitar)
  app.post('/confirmar', rutas.confirmar)
  app.post('/login', crearLogin(db, (correo) => correo.trim().toLowerCase(),
    crearSesiones(db, leerConfiguracionSesion({})).emitir))
  const http = app.listen(0, '127.0.0.1')
  await once(http, 'listening')
  t.after(() => new Promise((resolve) => http.close(resolve)))
  const url = 'http://127.0.0.1:' + http.address().port

  async function post(ruta, data) {
    const res = await fetch(url + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const texto = await res.text()
    for (const secreto of [previo, anterior, nueva, 'password_hash', 'estado_credencial', ...emitidos.map((e) => e.token)]) {
      assert.equal(texto.includes(secreto), false)
    }
    return { estado: res.status, cuerpo: JSON.parse(texto) }
  }

  let respuestaGenerica
  async function solicitar(correo) {
    const antes = emitidos.length
    const respuesta = await post('/solicitar', { correo })
    assert.equal(respuesta.estado, 202)
    respuestaGenerica ??= respuesta
    assert.deepEqual(respuesta, respuestaGenerica)
    for (let i = 0; i < 100 && emitidos.length === antes; i++) await esperar(10)
    assert.equal(emitidos.length, antes + 1)
    assert.equal(emitidos.at(-1).correo, correo)
    return emitidos.at(-1).token
  }
  const confirmar = (token) => post('/confirmar', { token, password: nueva })
  const login = (correo, password) => post('/login', { correo, password, rol: 'Mesero' })

  await t.test('la solicitud da la misma respuesta y solo entrega fuera del HTTP', async () => {
    await solicitar(migrada)
    assert.deepEqual(await post('/solicitar', { correo: inexistente }), respuestaGenerica)
    assert.equal(emitidos.length, 1)
    const token = emitidos[0].token
    const { rows: [guardado] } = await db.query('SELECT token_digest FROM public.auth_restablecimiento')
    assert.equal(guardado.token_digest.length, 32)
    assert.equal(guardado.token_digest.includes(Buffer.from(token)), false)
  })

  await t.test('cuenta migrada: el segundo token invalida el primero y se sustituye el hash', async () => {
    const segundo = await solicitar(migrada)
    const primero = emitidos[0].token
    assert.notEqual(primero, segundo)
    assert.equal((await confirmar(primero)).estado, 400)
    const alterado = (segundo[0] === 'A' ? 'B' : 'A') + segundo.slice(1)
    assert.equal((await confirmar(alterado)).estado, 400)
    assert.equal((await login(migrada, anterior)).estado, 200)
    const confirmaciones = await Promise.all([confirmar(segundo), confirmar(segundo)])
    assert.deepEqual(confirmaciones.map((res) => res.estado).sort(), [200, 400])
    assert.equal((await confirmar(segundo)).estado, 400)
    assert.equal((await login(migrada, anterior)).estado, 401)
    assert.equal((await login(migrada, nueva)).estado, 200)
  })

  await t.test('cuenta que requiere restablecimiento: rechaza expirados y vuelve a migrada', async () => {
    const vencido = await solicitar(pendienteReset)
    await db.query("UPDATE public.auth_restablecimiento SET expira_en = now() - interval '1 second' WHERE usuario_id = 2")
    assert.equal((await confirmar(vencido)).estado, 400)
    const token = await solicitar(pendienteReset)
    assert.equal((await confirmar(token)).estado, 200)
    assert.equal((await login(pendienteReset, nueva)).estado, 200)
    const { rows } = await db.query(`
      SELECT password IS NULL AS sin_legado, password_hash, estado_credencial
      FROM public.usuarios ORDER BY id
    `)
    for (const fila of rows) {
      assert.equal(fila.sin_legado, true)
      assert.equal(fila.estado_credencial, 'migrada')
      assert.equal(await verifyPassword(nueva, fila.password_hash), true)
    }
    assert.equal((await db.query('SELECT 1 FROM public.auth_restablecimiento')).rowCount, 0)
  })
})
