import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import express from 'express'
import pg from 'pg'
import { crearLogin } from '../src/login.js'
import { hashPassword } from '../src/passwords.js'
import { leerConfiguracionSesion } from '../src/session-config.js'
import { crearSesiones, digestSesion, generarTokenSesion } from '../src/sesiones.js'
import { crearCsrf } from '../src/csrf.js'

test('tokens aleatorios, digest y validación', () => {
  const a = generarTokenSesion()
  const b = generarTokenSesion()
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(a.token, b.token)
  assert.notDeepEqual(a.digest, b.digest)
  assert.deepEqual(digestSesion(a.token), a.digest)
  assert.equal(a.digest.length, 32)
  assert.notEqual(a.digest.toString('base64url'), a.token)
  for (const valor of ['', 'inválido', a.token + '=', null]) assert.equal(digestSesion(valor), null)
})

test('configuración valida cookie y duración de sesión', () => {
  const config = leerConfiguracionSesion({})
  assert.equal(config.inactividadSegundos, 1800)
  assert.equal(config.absolutaSegundos, 28800)
  assert.deepEqual(config.cookie, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
  for (const env of [
    { SESSION_IDLE_MINUTES: '0' }, { SESSION_ABSOLUTE_HOURS: '1.5' },
    { SESSION_IDLE_MINUTES: '61', SESSION_ABSOLUTE_HOURS: '1' },
    { NODE_ENV: 'production', SESSION_COOKIE_SECURE: 'false' },
    { SESSION_COOKIE_SAMESITE: 'none' }, { SESSION_COOKIE_NAME: 'sesión inválida' },
    { SESSION_APP_ORIGIN: 'https://app.example.invalid/ruta' },
  ]) assert.throws(() => leerConfiguracionSesion(env))
  assert.equal(leerConfiguracionSesion({
    NODE_ENV: 'development', SESSION_COOKIE_SECURE: 'false', SESSION_COOKIE_SAMESITE: 'strict',
  }).cookie.secure, false)
})

test('sesiones HTTP sobre PostgreSQL desechable', {
  skip: process.env.MESEREARTE_ENSAYO_SESIONES !== '1',
}, async (t) => {
  const base = 'meserearte_sesiones_test'
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
  const sql = (nombre) => readFile(new URL('../migrations/' + nombre + '.sql', import.meta.url), 'utf8')
  for (const nombre of ['001_auth.up', '002_credenciales.up', '003_restablecimiento.up']) {
    await db.query(await sql(nombre))
  }
  await db.query(await sql('004_sesiones.up'))
  await db.query(await sql('004_sesiones.verify'))
  await db.query(await sql('004_sesiones.down'))
  await db.query(await sql('004_sesiones.up'))

  const correo = 'sesion@example.invalid'
  const password = 'Contraseña ficticia de sesión'
  const hash = await hashPassword(password)
  await db.query(`
    INSERT INTO public.usuarios (id, nombre, apellidos, correo, password_hash, estado_credencial, rol)
    VALUES (1, 'Usuario', 'Ficticio', $1, $2, 'migrada', 'Mesero')
  `, [correo, hash])
  const sesiones = crearSesiones(db, leerConfiguracionSesion({}))
  const local = crearSesiones(db, leerConfiguracionSesion({ NODE_ENV: 'development', SESSION_COOKIE_SECURE: 'false' }))
  const app = express()
  app.use(express.json())
  app.post('/api/auth/login', crearLogin(db, (valor) => valor, sesiones.emitir))
  app.post('/login-local', crearLogin(db, (valor) => valor, local.emitir))
  const csrf = crearCsrf(Buffer.alloc(32, 17))
  app.get('/api/auth/csrf', sesiones.autenticar(), csrf.entregar)
  app.post('/api/auth/logout', sesiones.autenticar({ opcional: true }),
    (req, res, next) => req.digestSesion ? csrf.verificar(req, res, next) : next(), sesiones.logout)
  const me = (req, res) => res.json({ ok: true, usuario: req.usuarioAutenticado })
  app.get('/api/auth/me', sesiones.autenticar(), me)
  app.get('/actividad', sesiones.autenticar({ renovarActividad: true }), me)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolver) => server.close(resolver)))
  const url = 'http://127.0.0.1:' + server.address().port
  const secretos = [hash, password]

  async function pedir(ruta, { cookie, body, method, csrf } = {}) {
    const res = await fetch(url + ruta, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const texto = await res.text()
    for (const secreto of [...secretos, 'token_digest', 'password_hash', '"password"']) {
      assert.equal(texto.includes(secreto), false)
    }
    return { estado: res.status, cookie: res.headers.get('Set-Cookie'), cuerpo: texto ? JSON.parse(texto) : null }
  }
  const contar = async () => (await db.query('SELECT count(*)::int AS total FROM public.auth_sesiones')).rows[0].total
  const login = (ruta = '/api/auth/login', clave = password) => pedir(ruta, { body: { correo, password: clave, rol: 'Mesero' } })
  const consultar = (cookie) => pedir('/api/auth/me', { cookie })
  const partir = (header) => header.split(';')[0]
  const token = (cookie) => cookie.slice(cookie.indexOf('=') + 1)
  const estado = async (cookie) => (await db.query(`
    SELECT *, extract(epoch FROM expira_inactividad_en - creada_en)::integer AS idle,
              extract(epoch FROM expira_absoluta_en - creada_en)::integer AS absoluta
    FROM public.auth_sesiones WHERE token_digest = $1
  `, [digestSesion(token(cookie))])).rows[0]

  let primera
  let segunda
  await t.test('login persiste solo el digest y permite sesiones simultáneas', async () => {
    const fallo = await login(undefined, 'clave incorrecta')
    assert.equal(fallo.estado, 401)
    assert.equal(fallo.cookie, null)
    assert.equal(await contar(), 0)
    const a = await login()
    const b = await login('/login-local')
    assert.equal(a.estado, 200)
    assert.equal(b.estado, 200)
    assert.match(a.cookie, /; HttpOnly/i)
    assert.match(a.cookie, /; Secure/i)
    assert.match(a.cookie, /; SameSite=Lax/i)
    assert.match(a.cookie, /; Path=\//i)
    assert.match(a.cookie, /; Max-Age=28800/i)
    assert.doesNotMatch(b.cookie, /; Secure/i)
    primera = partir(a.cookie)
    segunda = partir(b.cookie)
    assert.notEqual(primera, segunda)
    secretos.push(token(primera), token(segunda), digestSesion(token(primera)).toString('hex'))
    assert.equal(JSON.stringify(a.cuerpo).includes(token(primera)), false)
    assert.equal(await contar(), 2)
    const fila = await estado(primera)
    assert.deepEqual(fila.token_digest, digestSesion(token(primera)))
    assert.equal(fila.idle, 1800)
    assert.equal(fila.absoluta, 28800)
    assert.equal(fila.usuario_id, 1)
    assert.deepEqual(Object.keys(fila).sort(), [
      'absoluta', 'creada_en', 'expira_absoluta_en', 'expira_inactividad_en',
      'idle', 'revocada_en', 'token_digest', 'ultima_actividad', 'usuario_id',
    ].sort())
    assert.equal((await consultar(primera)).cuerpo.usuario.rol, 'Mesero')
    assert.equal((await consultar(segunda)).estado, 200)
  })

  await t.test('401 uniforme, inactividad, expiración absoluta y renovación acotada', async () => {
    const anonima = await consultar()
    assert.equal(anonima.estado, 401)
    for (const candidata of ['inválida', generarTokenSesion().token]) {
      assert.deepEqual(await consultar('meserearte_session=' + candidata), anonima)
    }
    const digest = digestSesion(token(segunda))
    await db.query(`
      UPDATE public.auth_sesiones SET creada_en = now() - interval '2 hours',
        ultima_actividad = now() - interval '1 hour', expira_inactividad_en = now() + interval '1 minute',
        expira_absoluta_en = now() + interval '2 minutes' WHERE token_digest = $1
    `, [digest])
    const antes = await estado(segunda)
    assert.equal((await consultar(segunda)).estado, 200)
    assert.deepEqual((await estado(segunda)).ultima_actividad, antes.ultima_actividad)
    assert.equal((await pedir('/actividad', { cookie: segunda })).estado, 200)
    const despues = await estado(segunda)
    assert(despues.ultima_actividad > antes.ultima_actividad)
    assert.deepEqual(despues.expira_inactividad_en, antes.expira_absoluta_en)
    for (const [absoluta, motivo] of [
      ["now() + interval '1 minute'", 'inactividad_vencida'],
      ["now() - interval '1 minute'", 'vencimiento_absoluto'],
    ]) {
      await db.query(`
        UPDATE public.auth_sesiones SET ultima_actividad = now() - interval '1 hour',
          expira_inactividad_en = now() - interval '1 minute', expira_absoluta_en = ${absoluta}
        WHERE token_digest = $1
      `, [digest])
      assert.deepEqual(await sesiones.validar(segunda), { motivo })
      assert.deepEqual(await consultar(segunda), anonima)
    }
  })

  await t.test('logout revoca solo la sesión actual y una cuenta inactiva pierde acceso', async () => {
    const otra = partir((await login()).cookie)
    const csrf = (await pedir('/api/auth/csrf', { cookie: primera })).cuerpo.csrfToken
    const salida = await pedir('/api/auth/logout', { method: 'POST', cookie: primera, csrf })
    assert.equal(salida.estado, 204)
    assert.match(salida.cookie, /^meserearte_session=;/)
    assert.match(salida.cookie, /Expires=Thu, 01 Jan 1970/i)
    assert((await estado(primera)).revocada_en)
    assert.deepEqual(await sesiones.validar(primera), { motivo: 'sesion_revocada' })
    assert.equal((await consultar(primera)).estado, 401)
    assert.equal((await consultar(otra)).estado, 200)
    for (const cookie of [undefined, primera, segunda]) {
      assert.equal((await pedir('/api/auth/logout', { method: 'POST', cookie })).estado, 204)
    }
    await db.query("UPDATE public.usuarios SET estado = 'Inactivo' WHERE id = 1")
    assert.deepEqual(await sesiones.validar(otra), { motivo: 'cuenta_inactiva' })
    assert.equal((await consultar(otra)).estado, 401)
  })

  await t.test('un fallo real de persistencia no entrega cookie ni crea otra sesión', async () => {
    await db.query("UPDATE public.usuarios SET estado = 'Activo' WHERE id = 1")
    await db.query('ALTER TABLE public.auth_sesiones ADD CONSTRAINT fallo_ensayo CHECK (false) NOT VALID')
    const antes = await contar()
    const resultado = await login()
    assert.equal(resultado.estado, 500)
    assert.equal(resultado.cookie, null)
    assert.equal(await contar(), antes)
    await db.query('ALTER TABLE public.auth_sesiones DROP CONSTRAINT fallo_ensayo')
  })
})
