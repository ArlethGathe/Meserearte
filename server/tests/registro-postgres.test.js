import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { setTimeout as esperar } from 'node:timers/promises'
import { test } from 'node:test'
import { promisify } from 'node:util'
import pg from 'pg'
import { verifyPassword } from '../src/passwords.js'

const ejecutar = promisify(execFile)

test('registro y login HTTP con PostgreSQL aislado', {
  skip: process.env.MESEREARTE_ENSAYO_REGISTRO !== '1',
}, async (t) => {
  const conexion = {
    host: '127.0.0.1', port: 55439, database: 'meserearte_registro_test',
    user: 'meserearte_test', password: '',
  }
  const db = new pg.Client(conexion)
  await db.connect()
  t.after(() => db.end())
  const identidad = await db.query(`
    SELECT current_database() AS base, inet_server_port() AS puerto,
           NOT EXISTS (SELECT 1 FROM public.usuarios) AS vacia,
           to_regclass('public.auth_sesiones') IS NULL AS sin_migrar
  `)
  assert.deepEqual(identidad.rows[0], {
    base: conexion.database, puerto: conexion.port, vacia: true, sin_migrar: true,
  })
  for (const nombre of ['001_auth.up', '002_credenciales.up', '004_sesiones.up']) {
    await db.query(await readFile(new URL('../migrations/' + nombre + '.sql', import.meta.url), 'utf8'))
  }
  await db.query(`
    INSERT INTO public.salas (nombre, codigo, estado)
    VALUES ('Sala inactiva ficticia', 'ENSAYOINACTIVA', 'Inactiva');
  `)

  const socket = createServer().listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const puerto = socket.address().port
  await new Promise((resolve) => socket.close(resolve))
  const cwd = new URL('../', import.meta.url)
  const env = {
    ...process.env,
    DB_HOST: conexion.host, DB_PORT: String(conexion.port), DB_NAME: conexion.database,
    DB_USER: conexion.user, DB_PASSWORD: conexion.password, PORT: String(puerto),
    REGISTER_WINDOW_SECONDS: '600', REGISTER_MAX_PER_IP: '30',
    REGISTER_MAX_PER_IP_EMAIL: '5', REGISTER_MAX_KEYS: '10000',
  }
  await assert.rejects(ejecutar(process.execPath, ['src/index.js'], {
    cwd, env: { ...env, REGISTER_WINDOW_SECONDS: '0' },
  }), (error) => error.code === 1 && error.stderr.includes('REGISTER_WINDOW_SECONDS'))

  const child = spawn(process.execPath, ['--import', './tests/fixtures/registro-observador.js', 'src/index.js'], {
    cwd, env,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  })
  const operaciones = []
  child.on('message', (evento) => {
    if (evento !== 'barrera') operaciones.push(evento)
  })
  async function barrera() {
    await new Promise((resolve) => {
      const recibir = (evento) => {
        if (evento !== 'barrera') return
        child.off('message', recibir)
        resolve()
      }
      child.on('message', recibir)
      child.send('barrera')
    })
  }
  const cerrado = once(child, 'close')
  t.after(async () => {
    child.kill()
    await cerrado
  })
  const base = 'http://127.0.0.1:' + puerto + '/api'
  let listo = false
  for (let i = 0; i < 80 && child.exitCode === null; i++) {
    try {
      listo = (await fetch(base + '/health', { signal: AbortSignal.timeout(500) })).ok
    } catch {
      // El proceso aún puede estar comprobando la conexión.
    }
    if (listo) break
    await esperar(100)
  }
  assert.equal(listo, true, 'El backend de ensayo debe iniciar')

  const password = 'Credencial ficticia de registro 🧪'
  const admin = { nombre: ' Ana ', apellidos: ' Ficticia ', correo: 'ADMIN@example.invalid',
    nombreSala: ' Sala de ensayo ', descripcion: 'Descripción ficticia', password }
  const mesero = { nombre: ' Luis ', apellidos: ' Ficticio ', correo: 'MESERO@example.invalid',
    telefono: '+52 55-1234-5678', password }

  async function post(ruta, datos) {
    const rutaApi = ruta.startsWith('/') ? ruta : '/auth/' + ruta
    const respuesta = await fetch(base + rutaApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    const json = await respuesta.text()
    for (const secreto of [password, '"password"', '"password_hash"', '$argon2id$']) {
      assert.equal(json.includes(secreto), false)
    }
    const retryAfter = respuesta.headers.get('Retry-After')
    return { estado: respuesta.status, cuerpo: JSON.parse(json), ...(retryAfter ? { retryAfter } : {}) }
  }

  async function verificarCredencial(id, clave = password) {
    const { rows: [cuenta] } = await db.query(`
      SELECT password IS NULL AS sin_password, password_hash, estado_credencial
      FROM public.usuarios WHERE id = $1
    `, [id])
    assert.equal(cuenta.sin_password, true)
    assert.equal(cuenta.estado_credencial, 'migrada')
    assert.equal(cuenta.password_hash.startsWith('$argon2id$'), true)
    assert.equal(await verifyPassword(clave, cuenta.password_hash), true)
  }

  await t.test('el arranque omite la demo y la carga explícita solo crea cuentas ficticias con hash', async () => {
    const contar = async () => (await db.query('SELECT count(*)::int AS total FROM public.usuarios')).rows[0].total
    assert.equal(await contar(), 0)
    const adminDemo = 'Credencial ficticia de demo admin'
    const meseroDemo = 'Credencial ficticia de demo mesero'
    const demoEnv = { ...env, DEMO_ADMIN_PASSWORD: adminDemo, DEMO_MESERO_PASSWORD: meseroDemo }
    const seed = (NODE_ENV) => ejecutar(process.execPath, ['src/seed-demo.js'], {
      cwd, env: { ...demoEnv, NODE_ENV },
    })
    await assert.rejects(seed('production'), { code: 1 })
    assert.equal(await contar(), 0)
    const resultado = await seed('development')
    assert.equal(resultado.stdout.includes(adminDemo) || resultado.stdout.includes(meseroDemo), false)
    const { rows: usuarios } = await db.query(`
      SELECT u.id, u.correo, u.rol, COALESCE(s.codigo, sala_mesero.codigo) AS codigo
      FROM public.usuarios u LEFT JOIN public.salas s ON s.administrador_id = u.id
      LEFT JOIN public.meseros m ON m.usuario_id = u.id
      LEFT JOIN public.salas sala_mesero ON sala_mesero.id = m.sala_id
      ORDER BY u.rol
    `)
    assert.deepEqual(usuarios.map(({ correo, rol, codigo }) => [correo, rol, codigo]), [
      ['admin-demo@example.invalid', 'Administrador', 'DEMOMESA'],
      ['mesero-demo@example.invalid', 'Mesero', 'DEMOMESA'],
    ])
    await verificarCredencial(usuarios[0].id, adminDemo)
    await verificarCredencial(usuarios[1].id, meseroDemo)
    await seed('development')
    assert.equal(await contar(), 2)
  })

  let sala
  await t.test('registro de administrador crea la sala y permite login con Argon2id', async () => {
    const { estado, cuerpo } = await post('registro-admin', admin)
    assert.equal(estado, 201)
    const { usuario } = cuerpo
    sala = cuerpo.sala
    assert.deepEqual(usuario, {
      id: usuario.id, nombre: 'Ana', apellidos: 'Ficticia',
      correo: 'admin@example.invalid', rol: 'Administrador', estado: 'Activo',
    })
    assert.equal(sala.administradorId, usuario.id)
    assert.equal(sala.nombre, 'Sala de ensayo')
    assert.equal(sala.descripcion, admin.descripcion)
    assert.equal(sala.estado, 'Activa')
    await verificarCredencial(usuario.id)
    const login = await post('login', { correo: admin.correo, password, rol: 'Administrador' })
    assert.equal(login.estado, 200)
    assert.equal(login.cuerpo.usuario.id, usuario.id)
  })

  await t.test('registro de mesero conserva perfil y permite login con Argon2id', async () => {
    const { estado, cuerpo } = await post('registro-mesero', {
      ...mesero, codigoSala: ' ' + sala.codigo.toLowerCase() + ' ',
    })
    assert.equal(estado, 201)
    const { usuario, mesero: perfil } = cuerpo
    assert.equal(usuario.correo, 'mesero@example.invalid')
    assert.equal(usuario.nombre, 'Luis')
    assert.equal(usuario.apellidos, 'Ficticio')
    assert.equal(usuario.rol, 'Mesero')
    assert.equal(usuario.estado, 'Activo')
    assert.equal(usuario.meseroId, perfil.id)
    assert.equal(usuario.salaId, sala.id)
    const relacion = await db.query(`
      SELECT id, usuario_id, sala_id, telefono, estado FROM public.meseros WHERE id = $1
    `, [perfil.id])
    assert.deepEqual(relacion.rows, [{
      id: perfil.id, usuario_id: usuario.id, sala_id: sala.id, telefono: '525512345678', estado: 'Activo',
    }])
    await verificarCredencial(usuario.id)
    const login = await post('login', { correo: mesero.correo, password, rol: 'Mesero' })
    assert.equal(login.estado, 200)
    assert.equal(login.cuerpo.usuario.meseroId, perfil.id)
    assert.equal(login.cuerpo.usuario.salaId, sala.id)
  })

  await t.test('duplicados, códigos de sala y teléfono conservan el contrato', async () => {
    for (const [ruta, datos] of [
      ['registro-admin', admin],
      ['registro-mesero', { ...mesero, codigoSala: sala.codigo }],
    ]) {
      assert.deepEqual(await post(ruta, datos), {
        estado: 409, cuerpo: { ok: false, mensaje: 'Ya existe una cuenta con ese correo.' },
      })
    }
    for (const codigoSala of ['INEXISTENTE', 'ENSAYOINACTIVA']) {
      const rechazo = await post('registro-mesero', { ...mesero, correo: 'rechazo@example.invalid', codigoSala })
      assert.equal(rechazo.estado, 404)
      assert.equal(rechazo.cuerpo.mensaje, 'El código de sala no es válido o la sala está inactiva.')
    }
    const telefono = await post('registro-mesero', { ...mesero, codigoSala: sala.codigo, telefono: '123' })
    assert.equal(telefono.estado, 400)
  })

  await t.test('contraseña inválida y fallos reales de relaciones dejan la base intacta', async () => {
    const conteo = async () => (await db.query(`
      SELECT (SELECT count(*) FROM public.usuarios) AS usuarios,
             (SELECT count(*) FROM public.meseros) AS meseros,
             (SELECT count(*) FROM public.salas) AS salas
    `)).rows[0]
    const antes = await conteo()
    const adminNuevo = { ...admin, correo: 'otro-admin@example.invalid' }
    const meseroNuevo = { ...mesero, correo: 'otro-mesero@example.invalid', codigoSala: sala.codigo }
    assert.equal((await post('registro-admin', { ...adminNuevo, password: 'a'.repeat(4097) })).estado, 400)
    assert.equal((await post('registro-mesero', { ...meseroNuevo, password: '\uD800' })).estado, 400)
    assert.equal((await post('registro-admin', { ...adminNuevo, nombreSala: 'a'.repeat(151) })).estado, 500)
    assert.equal((await post('registro-mesero', { ...meseroNuevo, telefono: '1'.repeat(31) })).estado, 500)
    assert.deepEqual(await conteo(), antes)
  })

  await t.test('el alta directa rechaza credenciales y conserva los perfiles existentes', async () => {
    const datos = {
      nombre: 'Personal', apellidos: 'Ficticio', correo: 'personal@example.invalid',
      telefono: '55-1234-5678', salaId: sala.id, estado: 'Activo',
    }
    const inventario = async () => (await db.query(`
      SELECT (SELECT count(*) FROM public.usuarios) AS usuarios,
             (SELECT count(*) FROM public.meseros) AS meseros
    `)).rows[0]
    const antes = await inventario()
    for (const solicitud of [datos, { ...datos, password }]) {
      assert.deepEqual(await post('/meseros', solicitud), {
        estado: 405,
        cuerpo: { mensaje: 'El alta de meseros se realiza mediante autorregistro con el código de una sala activa.' },
      })
    }
    assert.deepEqual(await inventario(), antes)
    const listado = await fetch(base + '/meseros')
    assert.equal(listado.status, 200)
    assert((await listado.json()).some((perfil) => perfil.correo === 'mesero@example.invalid'))
  })

  await t.test('el registro comparte cupo entre rutas y bloquea antes de SQL, conexión y Argon2id', async () => {
    const cuenta = { ...admin, correo: 'cupo@example.invalid' }
    await barrera()
    operaciones.length = 0
    const creada = await post('registro-admin', cuenta)
    assert.equal(creada.estado, 201)
    await barrera()
    const inicio = operaciones.indexOf('hash-inicio')
    const fin = operaciones.indexOf('hash-fin')
    const begin = operaciones.indexOf('begin')
    assert(inicio > 0 && fin > inicio && begin > fin)
    assert.deepEqual(operaciones.slice(inicio, fin + 1), ['hash-inicio', 'hash-fin'])
    assert(operaciones.slice(fin + 1, begin).includes('conexion'))
    await verificarCredencial(creada.cuerpo.usuario.id)

    for (let i = 0; i < 4; i++) assert.equal((await post('registro-admin', cuenta)).estado, 409)
    const total = async () => (await db.query('SELECT count(*) FROM public.usuarios')).rows[0].count
    const antes = await total()
    await barrera()
    operaciones.length = 0
    const bloqueado = await post('registro-admin', cuenta)
    const otraRuta = await post('registro-mesero', {
      ...mesero, correo: ' CUPO@example.invalid ', codigoSala: 'INEXISTENTE',
    })
    for (const rechazo of [bloqueado, otraRuta]) {
      assert.equal(rechazo.estado, 429)
      assert.deepEqual(rechazo.cuerpo, { ok: false, mensaje: 'Demasiados intentos. Intenta de nuevo más tarde.' })
      assert(Number(rechazo.retryAfter) > 0 && Number(rechazo.retryAfter) <= 600)
    }
    await barrera()
    assert.deepEqual(operaciones, [])
    assert.equal(await total(), antes)
    assert.equal((await post('login', { correo: cuenta.correo, password, rol: 'Administrador' })).estado, 200)
  })
})
