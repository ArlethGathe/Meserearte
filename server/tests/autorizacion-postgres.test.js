import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { setTimeout as esperar } from 'node:timers/promises'
import { test } from 'node:test'
import pg from 'pg'
import { hashPassword } from '../src/passwords.js'
import { digestSesion } from '../src/sesiones.js'

test('permisos e IDOR sobre Express y PostgreSQL aislado', {
  skip: process.env.MESEREARTE_ENSAYO_AUTORIZACION !== '1',
}, async (t) => {
  const base = 'meserearte_autorizacion_test'
  const conexion = { host: '127.0.0.1', port: 55439, database: base, user: 'meserearte_test', password: '' }
  const db = new pg.Client(conexion)
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
  const password = 'Credencial ficticia de alcance'
  const hash = await hashPassword(password)
  await db.query(`
    INSERT INTO usuarios (id,nombre,apellidos,correo,rol,password_hash,estado_credencial)
    SELECT id, 'Persona', 'Ficticia ' || id, 'cuenta' || id || '@example.invalid',
           CASE WHEN id <= 2 THEN 'Administrador' ELSE 'Mesero' END, $1, 'migrada'
    FROM unnest(ARRAY[1,2,3,4,5]) AS id
  `, [hash])
  await db.query(`
    INSERT INTO salas (id,nombre,codigo,administrador_id) VALUES
      (101,'Sala A','ARTIFICIALA',1),(102,'Sala B','ARTIFICIALB',2);
    INSERT INTO meseros (id,usuario_id,sala_id,telefono) VALUES
      (11,3,101,'5511111111'),(12,4,102,'5522222222'),(13,5,101,'5533333333');
    INSERT INTO eventos (id,sala_id,nombre,tipo,fecha,hora_inicio,hora_fin,ubicacion,lugar)
    VALUES (201,101,'Evento A','Prueba',(now() AT TIME ZONE 'America/Mexico_City')::date,'08:00','10:00','Prueba','Lugar A'),
           (202,102,'Evento B','Prueba',(now() AT TIME ZONE 'America/Mexico_City')::date,'08:00','10:00','Prueba','Lugar B');
    INSERT INTO asignaciones (evento_id,mesero_id,rol) VALUES
      (201,11,'Capitán'),(202,12,'Capitán'),(201,13,'Mesero');
    INSERT INTO disponibilidades (evento_id,mesero_id,estado) VALUES
      (201,11,'Confirmado'),(202,12,'Confirmado'),(201,13,'Pendiente');
    INSERT INTO notificaciones (id,tipo,titulo,mensaje,sala_id,destinatario_mesero_id,destinatario)
    VALUES (301,'Aviso','Solo A','Ficticia',101,11,'Individual'),
           (302,'Aviso','Solo B','Ficticia',102,12,'Individual'),
           (303,'Aviso','Solo admin B','Ficticia',102,NULL,'Administrador');
    INSERT INTO reportes (evento_id,sala_id,capitan_mesero_id,estado)
    VALUES (202,102,12,'Enviado');
  `)

  const reserva = createServer().listen(0, '127.0.0.1')
  await once(reserva, 'listening')
  const port = reserva.address().port
  await new Promise((resolve) => reserva.close(resolve))
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: new URL('../', import.meta.url),
    env: {
      ...process.env, PORT: String(port), DB_HOST: conexion.host, DB_PORT: String(conexion.port),
      DB_NAME: base, DB_USER: conexion.user, DB_PASSWORD: conexion.password,
    },
    stdio: 'ignore',
  })
  const cierre = once(child, 'close')
  t.after(async () => { child.kill(); await cierre })
  const url = 'http://127.0.0.1:' + port + '/api'
  let listo = false
  for (let i = 0; i < 80 && child.exitCode === null; i++) {
    try { listo = (await fetch(url + '/health', { signal: AbortSignal.timeout(500) })).ok } catch { /* arrancando */ }
    if (listo) break
    await esperar(100)
  }
  assert.equal(listo, true)

  const tokens = new Map()
  async function pedir(ruta, cookie, method = 'GET', body, opciones = {}) {
    let { csrf, origin } = opciones
    if (cookie && !['GET', 'HEAD'].includes(method) && csrf === undefined) {
      if (!tokens.has(cookie)) tokens.set(cookie, (await pedir('/auth/csrf', cookie)).cuerpo.csrfToken)
      csrf = tokens.get(cookie)
    }
    const res = await fetch(url + ruta, {
      method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(origin ? { Origin: origin } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return { estado: res.status, cuerpo: res.status === 204 ? null : await res.json(),
      cookie: res.headers.get('Set-Cookie')?.split(';')[0], cache: res.headers.get('Cache-Control') }
  }
  async function login(id, rol) {
    const respuesta = await pedir('/auth/login', null, 'POST', { correo: 'cuenta' + id + '@example.invalid', password, rol })
    assert.equal(respuesta.estado, 200)
    return respuesta.cookie
  }
  const adminA = await login(1, 'Administrador')
  const adminB = await login(2, 'Administrador')
  const capA = await login(3, 'Mesero')
  const capB = await login(4, 'Mesero')
  const meseroC = await login(5, 'Mesero')
  const ids = (respuesta) => respuesta.cuerpo.map((fila) => fila.id)

  await t.test('CSRF bloquea escrituras, impide intercambiar sesiones y protege logout', async () => {
    const primera = await login(1, 'Administrador')
    const segunda = await login(1, 'Administrador')
    const a = await pedir('/auth/csrf', primera)
    const b = await pedir('/auth/csrf', segunda)
    const tokenA = a.cuerpo.csrfToken
    const tokenB = b.cuerpo.csrfToken
    assert.equal(a.estado, 200)
    assert.equal(a.cache, 'no-store')
    assert.deepEqual(Object.keys(a.cuerpo), ['csrfToken'])
    assert.match(tokenA, /^[A-Za-z0-9_-]{43}$/)
    assert.notEqual(tokenA, tokenB)
    assert.notEqual(tokenA, primera.split('=')[1])
    assert.equal((await pedir('/auth/csrf')).estado, 401)
    assert.equal((await pedir('/salas', primera)).estado, 200)
    const digest = digestSesion(primera.split('=')[1])
    const actividad = async () => (await db.query(
      'SELECT ultima_actividad FROM auth_sesiones WHERE token_digest = $1', [digest]
    )).rows[0].ultima_actividad
    const antes = await actividad()
    for (const [ruta, metodo, cuerpo] of [
      ['/salas?csrfToken=' + tokenA, 'POST', { nombre: 'Bloqueada', csrfToken: tokenA, usuarioId: 2 }],
      ['/salas/101', 'PUT', { nombre: 'Bloqueada' }],
      ['/salas/101', 'DELETE', undefined],
      ['/disponibilidades', 'PATCH', { meseroId: 12 }],
    ]) {
      const falta = await pedir(ruta, primera, metodo, cuerpo, { csrf: null })
      assert.equal(falta.estado, 403)
      assert.equal(falta.cuerpo.codigo, 'CSRF_INVALIDO')
      assert.equal(JSON.stringify(falta.cuerpo).includes(tokenA), false)
    }
    assert.deepEqual(await actividad(), antes)
    for (const falso of ['inventado', tokenB]) {
      assert.equal((await pedir('/salas', primera, 'POST', { nombre: 'Bloqueada' }, { csrf: falso })).estado, 403)
    }
    assert.equal((await pedir('/salas', segunda, 'POST', { nombre: 'Bloqueada' }, { csrf: tokenA })).estado, 403)
    const creada = await pedir('/salas', primera, 'POST', { nombre: 'CSRF permitido' }, { csrf: tokenA })
    assert.equal(creada.estado, 201)
    assert.equal((await pedir('/salas/' + creada.cuerpo.id, primera, 'DELETE', undefined, { csrf: tokenA })).estado, 200)
    assert.equal((await pedir('/auth/logout', primera, 'POST', undefined, { csrf: null })).estado, 403)
    assert.equal((await pedir('/auth/logout', primera, 'POST', undefined, {
      csrf: tokenA, origin: 'https://externo.example.invalid',
    })).estado, 403)
    assert.equal((await pedir('/auth/me', primera)).estado, 200)
    assert.equal((await pedir('/auth/logout', primera, 'POST', undefined, { csrf: tokenA })).estado, 204)
    assert.equal((await pedir('/salas', primera, 'POST', { nombre: 'Bloqueada' }, { csrf: tokenA })).estado, 401)
    assert.equal((await pedir('/auth/csrf', primera)).estado, 401)
    assert.equal((await pedir('/auth/me', segunda)).estado, 200)
    assert.equal((await pedir('/auth/logout', null, 'POST')).estado, 204)
    const { rows } = await db.query('SELECT to_jsonb(s)::text AS datos FROM auth_sesiones s')
    assert(rows.every(({ datos }) => !datos.includes(tokenA) && !datos.includes(tokenB)))
    const preflight = await fetch(url + '/salas', {
      method: 'OPTIONS', headers: { Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-csrf-token' },
    })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173')
    assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), 'true')
    assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /x-csrf-token/i)
  })

  await t.test('administradores aislados por propiedad real y cookie obligatoria', async () => {
    for (const ruta of ['/salas', '/meseros', '/eventos', '/asignaciones', '/disponibilidades',
      '/notificaciones', '/notificaciones/enviadas', '/reportes', '/meseros/11/historial',
      '/asistencias/evento/201', '/reportes/evento/201']) assert.equal((await pedir(ruta)).estado, 401)
    assert.deepEqual(ids(await pedir('/salas?administradorId=2', adminA)), [101])
    assert.deepEqual(ids(await pedir('/eventos?salaId=102', adminA)), [201])
    assert.deepEqual(ids(await pedir('/meseros', adminA)).sort(), [11, 13])
    assert.deepEqual(ids(await pedir('/reportes?todos=true', adminA)), [])
    assert.equal((await pedir('/reportes/evento/202', adminB)).estado, 200)
    assert.equal((await pedir('/reportes/evento/202', adminA)).estado, 403)
    assert.equal((await pedir('/reportes?salaId=102', adminA)).estado, 403)
    assert.equal((await pedir('/meseros/12/historial', adminA)).estado, 403)
    assert.equal((await pedir('/salas/102', adminA, 'PUT', { nombre: 'Falsificada' })).estado, 403)
    assert.equal((await pedir('/eventos/202', adminA, 'DELETE')).estado, 403)
    assert.equal((await pedir('/eventos/201', adminA, 'PUT', { salaId: 102 })).estado, 403)
    assert.equal((await pedir('/asignaciones/evento/201', adminA, 'PUT', { meseroIds: [12], capitanId: 12 })).estado, 403)
    assert.equal((await pedir('/meseros/11', adminA, 'PUT', { correo: 'ajeno@example.invalid' })).estado, 403)
    const propia = await pedir('/salas', adminA, 'POST', { nombre: 'Propia', administradorId: 2 })
    assert.equal(propia.estado, 201)
    assert.equal(propia.cuerpo.administradorId, 1)
  })

  await t.test('perfil y disponibilidad solo actúan sobre la identidad de sesión', async () => {
    assert.deepEqual(ids(await pedir('/meseros?meseroId=12', meseroC)), [13])
    assert.equal((await pedir('/salas', meseroC)).cuerpo[0].codigo, null)
    assert.equal((await pedir('/meseros/12/historial', meseroC)).estado, 403)
    assert.equal((await pedir('/meseros/12', meseroC, 'PUT', { nombre: 'Otro' })).estado, 403)
    assert.equal((await pedir('/meseros/13', meseroC, 'PUT', { nombre: 'Propia' })).estado, 200)
    assert.equal((await pedir('/meseros/13', meseroC, 'PUT', { estado: 'Inactivo' })).estado, 403)
    assert.equal((await pedir('/meseros/13', meseroC, 'PUT', { salaId: 102 })).estado, 403)
    assert.equal((await pedir('/disponibilidades', meseroC, 'PUT', {
      eventoId: 201, meseroId: 11, estado: 'Confirmado',
    })).estado, 403)
    assert.equal((await pedir('/disponibilidades', meseroC, 'PUT', {
      eventoId: 201, estado: 'Confirmado',
    })).estado, 200)
    assert.equal((await pedir('/eventos', meseroC, 'POST', { rol: 'Administrador', salaId: 101 })).estado, 403)
  })

  await t.test('capitanía vigente por evento y atribución desde sesión', async () => {
    const asistencia = (cookie, datos) => pedir('/asistencias', cookie, 'PUT', datos)
    const datos = { eventoId: 201, meseroId: 13, estado: 'Presente', capitanMeseroId: 12 }
    assert.equal((await asistencia(capA, datos)).estado, 200)
    assert.equal((await db.query('SELECT registrado_por FROM asistencias WHERE evento_id = 201')).rows[0].registrado_por, 11)
    assert.equal((await asistencia(capA, { ...datos, eventoId: 202, meseroId: 12 })).estado, 403)
    assert.equal((await asistencia(capB, datos)).estado, 403)
    assert.equal((await asistencia(meseroC, { ...datos, capitanMeseroId: 11 })).estado, 403)
    assert.equal((await pedir('/reportes/evento/201', adminA, 'PUT', { eventoId: 201 })).estado, 403)
    assert.equal((await pedir('/reportes/evento/201', capA, 'PUT', {
      eventoId: 202, capitanMeseroId: 12, estado: 'Borrador',
    })).estado, 200)
    assert.equal((await db.query('SELECT capitan_mesero_id FROM reportes WHERE evento_id = 201')).rows[0].capitan_mesero_id, 11)
    assert.equal((await pedir('/reportes/evento/201', meseroC)).estado, 403)
    assert.equal((await pedir('/asignaciones/evento/201', adminA, 'PUT', {
      meseroIds: [11, 13], capitanId: 13,
    })).estado, 200)
    assert.equal((await asistencia(capA, datos)).estado, 403)
    assert.equal((await pedir('/reportes/evento/201', capA)).estado, 403)
    assert.equal((await pedir('/reportes/evento/201', capA, 'PUT', { estado: 'Borrador' })).estado, 403)
    assert.equal((await pedir('/reportes/evento/201', meseroC)).estado, 200)
    assert.equal((await pedir('/auth/me', capA)).estado, 200)
  })

  await t.test('el polling solo ve destinatario propio y no renueva actividad', async () => {
    const digest = digestSesion(capA.slice(capA.indexOf('=') + 1))
    const actividad = async () => (await db.query(
      'SELECT ultima_actividad FROM auth_sesiones WHERE token_digest = $1', [digest]
    )).rows[0].ultima_actividad
    const antes = await actividad()
    assert.deepEqual(ids(await pedir('/notificaciones/mesero/11?meseroId=12', capA)), [301])
    assert.equal((await pedir('/notificaciones/mesero/12', capA)).estado, 403)
    assert.equal((await pedir('/notificaciones/mesero/11', capB)).estado, 403)
    assert.equal((await pedir('/notificaciones?salaId=102', adminA)).estado, 403)
    assert.deepEqual(ids(await pedir('/notificaciones?salaId=102&destinatario=Administrador', adminB)), [303])
    assert.deepEqual(await actividad(), antes)
    assert.equal((await pedir('/notificaciones/302/leida', capA, 'PUT', { meseroId: 12 })).estado, 404)
    assert.equal((await pedir('/notificaciones/301/leida', capA, 'PUT', {})).estado, 200)
    assert(await actividad() > antes)
    assert.equal((await pedir('/notificaciones', adminA, 'POST', {
      salaId: 101, destinatarioMeseroId: 12, titulo: 'Ficticio', mensaje: 'Ficticio', modoDestinatario: 'Individual',
    })).estado, 403)
  })

  await t.test('CU11 reúne participaciones reales y permite evaluar un retardo', async () => {
    await db.query(`
      INSERT INTO usuarios (id,nombre,apellidos,correo,password_hash,estado_credencial,rol)
      VALUES (6,'Persona','Historial','historial@example.invalid',$1,'migrada','Mesero'),
             (7,'Persona','Sin eventos','vacia@example.invalid',$1,'migrada','Mesero')
    `, [hash])
    await db.query(`
      INSERT INTO meseros (id,usuario_id,sala_id,telefono) VALUES
        (14,6,101,'5544444444'),(15,7,101,'5555555555');
      INSERT INTO eventos (id,sala_id,nombre,tipo,fecha,hora_inicio,hora_fin,ubicacion,lugar)
      SELECT id,101,'Evento ' || id,'Prueba',
             (now() AT TIME ZONE 'America/Mexico_City')::date - (id - 205),
             '08:00','10:00','Prueba','Lugar ' || id
      FROM generate_series(205,209) AS id;
      INSERT INTO asignaciones (evento_id,mesero_id,rol) VALUES
        (205,11,'Capitán'),(205,14,'Mesero'),(206,14,'Capitán'),
        (207,14,'Mesero'),(208,14,'Mesero'),(209,14,'Mesero');
      INSERT INTO disponibilidades (evento_id,mesero_id,estado) VALUES
        (205,11,'Confirmado'),(205,14,'Confirmado');
      INSERT INTO asistencias (evento_id,mesero_id,estado) VALUES
        (206,14,'Presente'),(207,14,'Ausente'),(209,14,'Presente');
      INSERT INTO reportes (id,evento_id,sala_id,capitan_mesero_id,estado) VALUES
        (801,208,101,11,'Borrador'),(802,209,101,11,'Enviado');
      INSERT INTO evaluaciones_meseros (reporte_id,evento_id,mesero_id,desempeno,puntualidad,actitud,incidencia)
      VALUES (801,208,14,1,1,1,TRUE),(802,209,14,3,NULL,5,FALSE);
    `)

    const retardo = await pedir('/asistencias', capA, 'PUT', { eventoId: 205, meseroId: 14, estado: 'Retardo' })
    assert.equal(retardo.estado, 200)
    assert.equal(retardo.cuerpo.estado, 'Retardo')
    const sinEvaluar = await pedir('/reportes/evento/205', capA, 'PUT', { estado: 'Enviado' })
    assert.equal(sinEvaluar.estado, 400)
    assert.match(sinEvaluar.cuerpo.mensaje, /retardo/)
    const enviado = await pedir('/reportes/evento/205', capA, 'PUT', {
      estado: 'Enviado',
      evaluacionesPersonal: [{ meseroId: 14, desempeno: 5, puntualidad: 2, actitud: 4,
        incidencia: true, observacion: 'Observación individual ficticia' }],
    })
    assert.equal(enviado.estado, 200)
    const reportes = await pedir('/reportes', adminA)
    assert.equal(reportes.estado, 200)
    assert.deepEqual(reportes.cuerpo.find((r) => r.eventoId === 205).asistencia, {
      total: 2, presentes: 0, retardos: 1, ausentes: 0, sinRegistrar: 1,
    })

    const vacio = await pedir('/meseros/15/historial', adminA)
    assert.equal(vacio.estado, 200)
    assert.deepEqual(vacio.cuerpo.historial, [])
    assert.equal(vacio.cuerpo.resumen.eventosParticipados, 0)
    assert.equal(vacio.cuerpo.resumen.promedioDesempeno, null)

    const resultado = await pedir('/meseros/14/historial', adminA)
    assert.equal(resultado.estado, 200)
    assert.equal(resultado.cuerpo.mesero.id, 14)
    assert.deepEqual(resultado.cuerpo.resumen, {
      eventosParticipados: 5, comoCapitan: 1, comoMesero: 4, asistencias: 3, presentes: 2,
      retardos: 1, ausentes: 1, sinRegistrar: 1, incidencias: 1,
      promedioDesempeno: 4, promedioPuntualidad: 2, promedioActitud: 4.5,
    })
    const historial = resultado.cuerpo.historial
    assert.deepEqual(historial.map((fila) => [fila.eventoId, fila.rol, fila.asistencia, fila.evaluacionRegistrada]), [
      [205, 'Mesero', 'Retardo', true], [206, 'Capitán', 'Presente', false],
      [207, 'Mesero', 'Ausente', false], [208, 'Mesero', 'Sin registrar', false],
      [209, 'Mesero', 'Presente', true],
    ])
    assert.equal(historial[0].eventoNombre, 'Evento 205')
    assert.equal(historial[0].eventoTipo, 'Prueba')
    assert.equal(historial[0].lugar, 'Lugar 205')
    assert.match(historial[0].fecha, /^\d{4}-\d{2}-\d{2}$/)
    assert.deepEqual([historial[0].desempeno, historial[0].puntualidad, historial[0].actitud], [5, 2, 4])
    assert.equal(historial[0].incidencia, true)
    assert.equal(historial[0].observacion, 'Observación individual ficticia')
    assert.equal(historial[3].desempeno, null)
    assert.equal(historial[3].incidencia, null)
    assert.equal((await pedir('/meseros/14/historial', adminB)).estado, 403)
    assert.equal((await pedir('/meseros/14/historial', meseroC)).estado, 403)
    assert.equal((await pedir('/meseros/14/historial', adminA, 'PUT', { observacion: 'Cambio' })).estado, 404)
    assert.deepEqual((await pedir('/meseros/14/historial', adminA)).cuerpo, resultado.cuerpo)
  })
})
