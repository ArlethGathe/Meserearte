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

  await t.test('CU10 distingue autor histórico, capitán actual y detalle de personal', async () => {
    await db.query(`
      INSERT INTO usuarios (id,nombre,apellidos,correo,rol,password_hash,estado_credencial)
      VALUES (16,'Persona','Ficticia 16','cuenta16@example.invalid','Mesero',$1,'migrada')
    `, [hash])
    await db.query(`
      INSERT INTO meseros (id,usuario_id,sala_id,telefono) VALUES (16,16,101,'5512345678');
      INSERT INTO eventos (id,sala_id,nombre,tipo,fecha,hora_inicio,hora_fin,ubicacion,lugar)
      VALUES (215,101,'Evento de reportes','Prueba','2020-01-01','08:00','10:00','Prueba','Lugar 215');
      INSERT INTO asignaciones (evento_id,mesero_id,rol) VALUES
        (215,16,'Capitán'),(215,13,'Mesero'),(215,14,'Mesero'),(215,15,'Mesero');
      INSERT INTO asistencias (evento_id,mesero_id,estado) VALUES
        (215,16,'Presente'),(215,13,'Presente'),(215,14,'Retardo'),(215,15,'Ausente');
    `)
    const autor = await login(16, 'Mesero')
    const ruta = '/reportes/evento/215'
    assert.equal((await pedir(ruta, adminA)).estado, 404)
    assert.equal((await pedir('/reportes/evento/208', adminA)).estado, 404)
    const observacion = 'Observación individual ficticia. '.repeat(25)
    assert.equal((await pedir('/reportes', autor, 'POST', {
      eventoId: 215, estado: 'Enviado', resumenServicio: 'Resumen ficticio',
      incidencias: 'Incidencia general', observaciones: 'Observación general',
      evaluacionesPersonal: [
        { meseroId: 13, desempeno: 4, puntualidad: 5, actitud: 3, incidencia: false },
        { meseroId: 14, desempeno: 5, puntualidad: 2, actitud: 4, incidencia: true, observacion }
      ]
    })).estado, 200)
    const listado = await pedir('/reportes?salaId=101', adminA)
    assert.equal(listado.estado, 200)
    assert.ok(!listado.cuerpo.some(({ eventoId }) => eventoId === 208))
    const tarjeta = listado.cuerpo.find(({ eventoId }) => eventoId === 215)
    assert.equal(tarjeta.eventoNombre, 'Evento de reportes')
    assert.deepEqual(tarjeta.autor, { meseroId: 16, nombreCompleto: 'Persona Ficticia 16' })
    assert.deepEqual(tarjeta.asistencia, { total: 4, presentes: 2, retardos: 1, ausentes: 1, sinRegistrar: 0 })
    assert.ok(!(await pedir('/reportes', adminB)).cuerpo.some(({ eventoId }) => eventoId === 215))
    assert.equal((await pedir('/reportes?salaId=101', adminB)).estado, 403)
    assert.equal((await pedir(ruta, adminB)).estado, 403)
    assert.equal((await pedir(ruta, meseroC)).estado, 403)
    // El esquema permite referencias separadas a reporte y evento.
    await db.query(`
      INSERT INTO evaluaciones_meseros (reporte_id,evento_id,mesero_id,desempeno,puntualidad,actitud)
      VALUES (801,215,15,1,1,1),($1,208,15,2,2,2)
    `, [tarjeta.id])
    const lecturaCapitan = await pedir(ruta, autor)
    assert.equal(lecturaCapitan.estado, 200)
    assert.deepEqual(lecturaCapitan.cuerpo.evaluacionesPersonal.map(({ meseroId }) => meseroId).sort(), [13, 14])
    await db.query(`
      UPDATE asignaciones SET rol = 'Mesero' WHERE evento_id = 215 AND mesero_id = 16;
      UPDATE asignaciones SET rol = 'Capitán' WHERE evento_id = 215 AND mesero_id = 13;
      DELETE FROM asistencias WHERE evento_id = 215 AND mesero_id = 15;
    `)
    const detalle = await pedir(ruta, adminA)
    assert.equal(detalle.estado, 200)
    assert.equal(detalle.cuerpo.autor.nombreCompleto, 'Persona Ficticia 16')
    assert.equal(detalle.cuerpo.autor.meseroId, 16)
    assert.equal(detalle.cuerpo.capitanActual.meseroId, 13)
    assert.equal(detalle.cuerpo.eventoFecha, '2020-01-01')
    assert.equal(detalle.cuerpo.resumenServicio, 'Resumen ficticio')
    assert.equal(detalle.cuerpo.incidencias, 'Incidencia general')
    assert.equal(detalle.cuerpo.observaciones, 'Observación general')
    assert.deepEqual(detalle.cuerpo.resumenAsistencia, { total: 4, presentes: 2, retardos: 1, ausentes: 0, sinRegistrar: 1 })
    const personal = new Map(detalle.cuerpo.personal.map((fila) => [fila.meseroId, fila]))
    assert.equal(personal.get(16).rol, 'Mesero')
    assert.equal(personal.get(16).evaluacion, null)
    assert.equal(personal.get(13).rol, 'Capitán')
    assert.equal(personal.get(13).evaluacion.puntualidad, 5)
    assert.equal(personal.get(14).asistencia, 'Retardo')
    assert.deepEqual(personal.get(14).evaluacion, { desempeno: 5, puntualidad: 2, actitud: 4, incidencia: true, observacion })
    assert.equal(personal.get(15).asistencia, 'Sin registrar')
    assert.equal(personal.get(15).evaluacion, null)
  })

  await t.test('CU15 consulta y edita el perfil propio conservando sesión, sala e historial', async () => {
    const ruta = '/meseros/mi-perfil'
    const historial = async () => (await pedir('/meseros/11/historial', adminA)).cuerpo
    const relaciones = async () => (await db.query(`
      SELECT m.id, m.usuario_id, m.sala_id, u.rol, u.estado,
             (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
                FROM asignaciones a WHERE a.mesero_id = m.id) AS asignaciones
      FROM meseros m JOIN usuarios u ON u.id = m.usuario_id WHERE m.id = 11
    `)).rows[0]
    const historialInicial = await historial()
    const relacionesIniciales = await relaciones()
    const inicial = await pedir(ruta, capA)
    assert.equal(inicial.estado, 200)
    assert.deepEqual(inicial.cuerpo, {
      nombre: 'Persona', apellidos: 'Ficticia 3', correo: 'cuenta3@example.invalid',
      telefono: '5511111111', rol: 'Mesero', sala: 'Sala A', estado: relacionesIniciales.estado,
      eventosParticipados: historialInicial.resumen.eventosParticipados, eventosComoCapitan: 1
    })
    assert.equal(inicial.cuerpo.eventosParticipados, 2)
    assert.equal((await pedir(ruta, adminA)).estado, 403)
    assert.equal((await pedir(ruta)).estado, 401)
    const datos = { nombre: 'Nombre ficticio', apellidos: 'Apellidos ficticios',
      correo: '  CUENTA3@Example.Invalid ', telefono: '(55) 1234-5678' }
    for (const [campo, valor] of Object.entries({
      usuarioId: 4, meseroId: 12, rol: 'Administrador', salaId: 102,
      estado: 'Inactivo', eventosParticipados: 30
    })) {
      assert.equal((await pedir(ruta, capA, 'PUT', { ...datos, [campo]: valor })).estado, 403)
    }
    assert.equal((await pedir('/meseros/12', capA, 'PUT', datos)).estado, 403)
    for (const [campo, valor] of [
      ['nombre', ' '], ['apellidos', ''], ['correo', ''], ['correo', 'invalido'], ['telefono', '123']
    ]) {
      assert.equal((await pedir(ruta, capA, 'PUT', { ...datos, [campo]: valor })).estado, 400)
    }
    assert.equal((await pedir(ruta, capA, 'PUT', { ...datos, correo: ' CUENTA4@EXAMPLE.INVALID ' })).estado, 409)
    assert.deepEqual((await pedir(ruta, capA)).cuerpo, inicial.cuerpo)
    const mismoCorreo = await pedir(ruta, capA, 'PUT', datos)
    assert.equal(mismoCorreo.estado, 200)
    assert.deepEqual(mismoCorreo.cuerpo, {
      ...inicial.cuerpo, nombre: datos.nombre, apellidos: datos.apellidos, telefono: '5512345678'
    })
    const correoNuevo = 'perfil-nuevo@example.invalid'
    const nuevo = await pedir(ruta, capA, 'PUT', { ...datos, correo: ' PERFIL-NUEVO@EXAMPLE.INVALID ' })
    assert.equal(nuevo.estado, 200)
    assert.deepEqual(nuevo.cuerpo, { ...mismoCorreo.cuerpo, correo: correoNuevo })
    assert.deepEqual((await pedir(ruta, capA)).cuerpo, nuevo.cuerpo)
    assert.deepEqual(await relaciones(), relacionesIniciales)
    const historialFinal = await historial()
    assert.deepEqual(historialFinal.resumen, historialInicial.resumen)
    assert.deepEqual(historialFinal.historial, historialInicial.historial)
    assert.ok([200, 204].includes((await pedir('/auth/logout', capA, 'POST')).estado))
    assert.equal((await pedir(ruta, capA)).estado, 401)
    const credenciales = { password, rol: 'Mesero' }
    assert.equal((await pedir('/auth/login', null, 'POST', { ...credenciales, correo: 'cuenta3@example.invalid' })).estado, 401)
    const reingreso = await pedir('/auth/login', null, 'POST', { ...credenciales, correo: correoNuevo })
    assert.equal(reingreso.estado, 200)
    assert.deepEqual((await pedir(ruta, reingreso.cookie)).cuerpo, nuevo.cuerpo)
  })

  await t.test('CU18 envía avisos solo al personal seleccionado y revoca acceso al reemplazar al capitán', async () => {
    await db.query(`
      INSERT INTO usuarios (id,nombre,apellidos,correo,rol,password_hash,estado_credencial)
      SELECT id,'Persona','Avisos ' || id,'cuenta' || id || '@example.invalid','Mesero',$1,'migrada'
      FROM generate_series(31,35) id
    `, [hash])
    await db.query(`
      INSERT INTO meseros (id,usuario_id,sala_id,telefono)
      SELECT id,id,101,'5512345678' FROM generate_series(31,35) id;
      INSERT INTO eventos (id,sala_id,nombre,tipo,fecha,hora_inicio,hora_fin,ubicacion,lugar)
      VALUES (231,101,'Avisos','Prueba',CURRENT_DATE,'08:00','10:00','Prueba','Lugar 231'),
             (232,101,'Otro evento','Prueba',CURRENT_DATE,'11:00','13:00','Prueba','Lugar 232'),
             (233,101,'Capitán solo','Prueba',CURRENT_DATE,'14:00','16:00','Prueba','Lugar 233');
      INSERT INTO asignaciones (evento_id,mesero_id,rol) VALUES
        (231,31,'Capitán'),(231,32,'Mesero'),(231,33,'Mesero'),(231,35,'Mesero'),
        (232,34,'Capitán'),(233,31,'Capitán');
    `)
    const base = '/notificaciones/eventos'
    const capitan = await login(31, 'Mesero')
    const primero = await login(32, 'Mesero')
    const segundo = await login(33, 'Mesero')
    const otroEvento = await login(34, 'Mesero')
    const tercero = await login(35, 'Mesero')
    const enviar = (destinatarioIds, campos = {}, actor = capitan, evento = 231) =>
      pedir(base + '/' + evento, actor, 'POST', { titulo: 'Aviso ficticio', mensaje: 'Llegada del equipo', destinatarioIds, ...campos })
    const bandeja = async (id, cookie) => {
      const respuesta = await pedir('/notificaciones/mesero/' + id, cookie)
      assert.equal(respuesta.estado, 200)
      return respuesta.cuerpo.filter(({ tipo }) => tipo === 'Aviso de evento')
    }

    assert.deepEqual((await pedir(base, capitan)).cuerpo.map(({ id }) => id).sort(), [231, 233])
    assert.deepEqual((await pedir(base, primero)).cuerpo, [])
    assert.equal((await pedir(base + '/231/destinatarios', primero)).estado, 403)
    assert.equal((await enviar([33], {}, primero)).estado, 403)
    assert.equal((await pedir(base + '/231/destinatarios', adminA)).estado, 403)
    assert.equal((await pedir(base + '/232/destinatarios', capitan)).estado, 403)
    assert.equal((await enviar([34], {}, capitan, 232)).estado, 403)
    const personal = await pedir(base + '/231/destinatarios', capitan)
    assert.equal(personal.estado, 200)
    assert.deepEqual(personal.cuerpo.map(({ id }) => id), [32, 33, 35])
    assert.deepEqual((await pedir(base + '/233/destinatarios', capitan)).cuerpo, [])
    for (const respuesta of [
      await enviar([]), await enviar([32], { titulo: '  ' }), await enviar([32], { mensaje: ' ' }),
      await enviar([32, 34]), await enviar([32, 12]), await enviar([31]), await enviar([32, '32x']),
      await enviar(undefined, { destinatarioId: 34 }), await enviar([32], { eventoId: 232, salaId: 102 })
    ]) assert.equal(respuesta.estado, 400)
    assert.deepEqual(await bandeja(32, primero), [])

    const uno = await enviar([32])
    assert.equal(uno.estado, 201)
    const todos = await enviar([32, '32', 33, 35])
    assert.equal(todos.estado, 201)
    assert.equal(todos.cuerpo.total, 3)
    assert.notEqual(uno.cuerpo.envioId, todos.cuerpo.envioId)

    const avisosPrimero = await bandeja(32, primero)
    assert.equal(avisosPrimero.length, 2)
    const individual = avisosPrimero.find(({ envioId }) => envioId === uno.cuerpo.envioId)
    assert.deepEqual([individual.eventoId, individual.salaId, individual.titulo, individual.mensaje,
      individual.emisor, individual.leida], [231, 101, 'Aviso ficticio', 'Llegada del equipo', 'Capitán', false])
    for (const [id, cookie] of [[33, segundo], [35, tercero]]) {
      assert.deepEqual((await bandeja(id, cookie)).map(({ envioId }) => envioId), [todos.cuerpo.envioId])
    }
    assert.deepEqual(await bandeja(34, otroEvento), [])
    assert.deepEqual(await bandeja(12, capB), [])
    for (const ruta of ['/notificaciones', '/notificaciones/enviadas']) {
      const admin = await pedir(ruta, adminA)
      assert.equal(admin.estado, 200)
      assert.ok(!admin.cuerpo.some(({ envioId }) => [uno.cuerpo.envioId, todos.cuerpo.envioId].includes(envioId)))
    }
    const leida = '/notificaciones/' + individual.id + '/leida'
    assert.equal((await pedir(leida, segundo, 'PUT', {})).estado, 404)
    assert.equal((await pedir(leida, primero, 'PUT', {})).estado, 200)
    assert.equal((await bandeja(32, primero)).find(({ id }) => id === individual.id).leida, true)

    await db.query(`
      UPDATE asignaciones SET rol = 'Mesero' WHERE evento_id = 231 AND mesero_id = 31;
      UPDATE asignaciones SET rol = 'Capitán' WHERE evento_id = 231 AND mesero_id = 32;
    `)
    assert.equal((await pedir('/auth/me', capitan)).estado, 200)
    assert.equal((await pedir(base + '/231/destinatarios', capitan)).estado, 403)
    assert.equal((await enviar([33])).estado, 403)
    assert.deepEqual((await pedir(base, capitan)).cuerpo, [{ id: 233 }])
    assert.deepEqual((await pedir(base, primero)).cuerpo, [{ id: 231 }])
  })

  await t.test('auditoría final: sala, evento, equipo, disponibilidad y asistencia por HTTP', async () => {
    const sala = await pedir('/salas', adminA, 'POST', { nombre: 'Sala ficticia de auditoría' })
    assert.equal(sala.estado, 201)
    assert.ok(sala.cuerpo.codigo)
    assert.equal(sala.cuerpo.administradorId, 1)
    assert.ok(!(await pedir('/salas', adminB)).cuerpo.some(({ id }) => id === sala.cuerpo.id))
    assert.equal((await pedir('/salas/' + sala.cuerpo.id, adminB, 'PUT', { nombre: 'Ajena' })).estado, 403)

    const [{ hoy, manana }] = (await db.query(`
      SELECT to_char(now() AT TIME ZONE 'America/Mexico_City','YYYY-MM-DD') AS hoy,
             to_char((now() AT TIME ZONE 'America/Mexico_City') + interval '1 day','YYYY-MM-DD') AS manana
    `)).rows
    const datos = { salaId: 101, nombre: 'Evento ficticio de auditoría', tipo: 'Otro', fecha: hoy,
      horaInicio: '20:00', horaFin: '22:00', lugar: 'Lugar ficticio de auditoría',
      direccion: 'Dirección ficticia', latitud: 19, longitud: -99, uniforme: 'Negro', observaciones: 'Indicaciones' }
    assert.equal((await pedir('/eventos', adminB, 'POST', datos)).estado, 403)
    const creado = await pedir('/eventos', adminA, 'POST', datos)
    assert.equal(creado.estado, 201)
    const eventoId = creado.cuerpo.id
    const rutaEvento = '/eventos/' + eventoId
    const rutaEquipo = '/asignaciones/evento/' + eventoId
    assert.ok(!(await pedir('/eventos', meseroC)).cuerpo.some(({ id }) => id === eventoId))
    assert.equal((await pedir(rutaEvento, adminB, 'PUT', { nombre: 'Ajeno' })).estado, 403)
    const editado = await pedir(rutaEvento, adminA, 'PUT', { nombre: 'Evento editado' })
    assert.equal(editado.estado, 200)
    const leerEvento = async () => (await pedir('/eventos', meseroC)).cuerpo.find(({ id }) => id === eventoId)
    const cuenta14 = await pedir('/auth/login', null, 'POST', { correo: 'historial@example.invalid', password, rol: 'Mesero' })
    assert.equal(cuenta14.estado, 200)
    const personal = cuenta14.cookie
    assert.equal((await pedir(rutaEquipo, adminA, 'PUT', { meseroIds: [13] })).estado, 400)
    assert.ok([400, 403].includes((await pedir(rutaEquipo, adminA, 'PUT', { meseroIds: [13, 12], capitanId: 13 })).estado))
    assert.ok([200, 201].includes((await pedir(rutaEquipo, adminA, 'PUT', { meseroIds: [13, 14, 14], capitanId: 13 })).estado))
    assert.equal((await leerEvento()).nombre, 'Evento editado')
    assert.equal((await leerEvento()).direccion, datos.direccion)
    assert.ok((await leerEvento()).ubicacion)
    assert.ok(!(await pedir('/eventos', capB)).cuerpo.some(({ id }) => id === eventoId))
    const equipo = (await pedir('/asignaciones', adminA)).cuerpo.filter((fila) => fila.eventoId === eventoId)
    assert.deepEqual(equipo.map(({ meseroId, rol }) => [meseroId, rol]).sort(), [[13, 'Capitán'], [14, 'Mesero']])
    const traslape = await pedir('/eventos', adminA, 'POST', { ...datos, lugar: 'Otro lugar el mismo día' })
    assert.equal(traslape.estado, 201)
    assert.equal((await pedir('/asignaciones/evento/' + traslape.cuerpo.id, adminA, 'PUT', {
      meseroIds: [13], capitanId: 13
    })).estado, 409)
    const avisoManual = await pedir('/notificaciones', adminA, 'POST', {
      salaId: 101, destinatarioMeseroId: 14, titulo: 'Aviso administrativo ficticio',
      mensaje: 'Indicaciones para el equipo', modoDestinatario: 'Individual'
    })
    assert.equal(avisoManual.estado, 201)
    const bandeja = await pedir('/notificaciones/mesero/14', personal)
    const aviso = bandeja.cuerpo.find(({ envioId }) => envioId === avisoManual.cuerpo.envioId)
    assert.equal(aviso.leida, false)
    assert.equal((await pedir('/notificaciones/' + aviso.id + '/leida', personal, 'PUT', {})).estado, 200)
    assert.ok((await pedir('/notificaciones/mesero/14', personal)).cuerpo.find(({ id }) => id === aviso.id).leida)
    assert.ok(!(await pedir('/notificaciones/mesero/13', meseroC)).cuerpo.some(({ id }) => id === aviso.id))
    const respuestas = async () => (await pedir('/disponibilidades', adminA)).cuerpo.filter((fila) => fila.eventoId === eventoId)
    assert.deepEqual((await respuestas()).map(({ estado }) => estado), ['Pendiente', 'Pendiente'])
    for (const [cookie, meseroId] of [[meseroC, 13], [personal, 14]]) {
      assert.equal((await pedir('/disponibilidades', cookie, 'PUT', { eventoId, meseroId, estado: 'Confirmado' })).estado, 200)
    }
    assert.equal((await pedir('/disponibilidades', personal, 'PUT', { eventoId, meseroId: 14, estado: 'No disponible' })).estado, 409)
    for (const estado of ['Presente', 'Retardo', 'Ausente']) {
      const registro = await pedir('/asistencias', meseroC, 'PUT', { eventoId, meseroId: 14, estado })
      assert.equal(registro.estado, 200)
      assert.equal(registro.cuerpo.estado, estado)
    }
    assert.equal((await pedir('/asistencias', meseroC, 'PUT', { eventoId, meseroId: 12, estado: 'Presente' })).estado, 400)
    assert.deepEqual((await db.query('SELECT estado FROM asistencias WHERE evento_id = $1 AND mesero_id = 14', [eventoId])).rows,
      [{ estado: 'Ausente' }])

    const futuro = await pedir('/eventos', adminA, 'POST', { ...datos, fecha: manana, lugar: 'Lugar futuro ficticio' })
    assert.equal(futuro.estado, 201)
    const futuroId = futuro.cuerpo.id
    assert.equal((await pedir('/asignaciones/evento/' + futuroId, adminA, 'PUT', { meseroIds: [13], capitanId: 13 })).estado, 200)
    assert.equal((await pedir('/asistencias', meseroC, 'PUT', { eventoId: futuroId, meseroId: 13, estado: 'Presente' })).estado, 403)
    assert.equal((await pedir('/reportes', meseroC, 'POST', { eventoId: futuroId, estado: 'Enviado' })).estado, 403)
    assert.equal((await pedir('/disponibilidades', meseroC, 'PUT', {
      eventoId: futuroId, meseroId: 13, estado: 'No disponible'
    })).estado, 200)
    const asignacion = (await pedir('/asignaciones', adminA)).cuerpo.find((fila) => fila.eventoId === futuroId)
    assert.equal(asignacion.rol, 'Capitán')
    const avisos = (await pedir('/notificaciones?destinatario=Administrador', adminA)).cuerpo
    assert.match(avisos.find((aviso) => aviso.eventoId === futuroId).mensaje, /reemplazar|nuevo capitán/i)
    assert.ok(!(await pedir('/notificaciones/mesero/13', meseroC)).cuerpo.some((aviso) => aviso.eventoId === futuroId))
    assert.equal((await pedir('/reportes/evento/' + futuroId, meseroC)).estado, 403)
    assert.ok([200, 204].includes((await pedir('/eventos/' + futuroId, adminA, 'DELETE')).estado))
    assert.equal((await db.query('SELECT id FROM eventos WHERE id = $1', [futuroId])).rowCount, 0)
  })
})
