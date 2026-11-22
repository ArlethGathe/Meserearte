import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import pg from 'pg'
import { procesarCredenciales, validarClasificacion } from '../src/migrar-credenciales.js'
import { hashPassword, verifyPassword } from '../src/passwords.js'

const ejecutar = promisify(execFile)
const cwd = new URL('../', import.meta.url)
const plan = (...ids) => ids.map((id) => ({ id, accion: 'migrar' }))
const base = 'meserearte_migrar_test'

test('rechaza planes ambiguos y destinos no autorizados antes de conectarse', async () => {
  for (const entrada of [[], plan(1, 1), plan(0), [{ id: 1, accion: 'otra' }],
    [{ id: 1, accion: 'migrar', password: 'entrada ficticia' }]]) {
    assert.throws(() => validarClasificacion(entrada), TypeError)
  }
  for (const args of [
    ['--plan', 'no-se-lee.json'],
    ['--db', 'meserearte_db', '--plan', 'no-se-lee.json'],
    ['--db', base, '--plan', 'no-se-lee.json', '--apply'],
  ]) {
    await assert.rejects(ejecutar(process.execPath, ['src/migrar-credenciales-cli.js', ...args], {
      cwd, env: { ...process.env, MESEREARTE_CREDENTIALS_APPLY: '' },
    }), (error) => error.code === 1 && error.stderr.includes('Se requiere --db'))
  }
})

test('migración reanudable con PostgreSQL aislado', {
  skip: process.env.MESEREARTE_ENSAYO_MIGRAR !== '1',
}, async (t) => {
  const db = new pg.Client({
    host: '127.0.0.1', port: 55439, database: base, user: 'meserearte_test', password: '',
  })
  await db.connect()
  t.after(() => db.end())
  const destino = await db.query(`
    SELECT current_database() AS base, inet_server_port() AS puerto,
           NOT EXISTS (SELECT 1 FROM public.usuarios) AS vacia
  `)
  assert.deepEqual(destino.rows[0], { base, puerto: 55439, vacia: true })
  for (const nombre of ['001_auth.up', '002_credenciales.up']) {
    await db.query(await readFile(new URL('../migrations/' + nombre + '.sql', import.meta.url), 'utf8'))
  }
  const password = 'Credencial ficticia para migrar'
  const hash = await hashPassword(password)
  await db.query(`
    INSERT INTO public.usuarios (id, nombre, apellidos, correo, password, rol)
    SELECT id, 'Usuario', 'Ficticio', 'ensayo' || id || '@example.invalid', $1,
           CASE WHEN id = 2 THEN 'Administrador' ELSE 'Mesero' END
    FROM unnest(ARRAY[1, 2, 6, 7, 8, 9, 10]) AS id
  `, [password])
  await db.query(`
    INSERT INTO public.usuarios (id, nombre, apellidos, correo, password_hash, estado_credencial, rol)
    VALUES (3, 'Usuario', 'Ficticio', 'ensayo3@example.invalid', $1, 'migrada', 'Mesero'),
           (4, 'Usuario', 'Ficticio', 'ensayo4@example.invalid', NULL, 'requiere_restablecimiento', 'Mesero')
  `, [hash])
  await db.query(`
    INSERT INTO public.salas (id, nombre, codigo, administrador_id) VALUES (1, 'Ficticia', 'FICCION', 2);
    INSERT INTO public.meseros (id, usuario_id, sala_id) VALUES (1, 1, 1), (2, 6, 1);
    INSERT INTO public.eventos (id,sala_id,nombre,tipo,fecha,hora_inicio,hora_fin,ubicacion)
    VALUES (1,1,'Ficticio','Prueba','2040-01-01','12:00','14:00','Ficticia');
    INSERT INTO public.asignaciones (evento_id,mesero_id,rol) VALUES (1,1,'Capitán');
  `)
  // Solo la copia de ensayo contiene una fila previa a la validación del CHECK.
  const { rows: [check] } = await db.query(`
    SELECT pg_get_constraintdef(oid) AS ddl FROM pg_constraint
    WHERE conrelid = 'public.usuarios'::regclass AND conname = 'usuarios_credencial_coherente_ck'
  `)
  await db.query(`
    BEGIN;
    ALTER TABLE public.usuarios DROP CONSTRAINT usuarios_credencial_coherente_ck;
    INSERT INTO public.usuarios (id, nombre, apellidos, correo, rol)
    VALUES (5, 'Usuario', 'Ficticio', 'ensayo5@example.invalid', 'Mesero');
    ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_credencial_coherente_ck ${check.ddl} NOT VALID;
    COMMIT;
  `)

  const dir = await mkdtemp(join(tmpdir(), 'meserearte-plan-'))
  const ruta = join(dir, 'plan.json')
  await writeFile(ruta, '[]')
  t.after(async () => {
    await unlink(ruta)
    await rmdir(dir)
  })
  const informeSeguro = (contenido) => {
    for (const secreto of [password, hash, '$argon2id$', 'FICCION']) assert.equal(contenido.includes(secreto), false)
  }
  const cli = (args = [], confirmado = '') => ejecutar(process.execPath, [
    'src/migrar-credenciales-cli.js', '--db', base, '--plan', ruta, ...args,
  ], { cwd, env: { ...process.env, MESEREARTE_CREDENTIALS_APPLY: confirmado } })
  const estado = async () => (await db.query(`
    SELECT id, estado_credencial, password IS NULL AS sin_password, password_hash IS NOT NULL AS con_hash
    FROM public.usuarios ORDER BY id
  `)).rows
  const relaciones = async () => (await db.query(`
    SELECT u.id, u.rol, u.estado, m.id AS mesero_id, m.sala_id, s.administrador_id, a.evento_id
    FROM public.usuarios u LEFT JOIN public.meseros m ON m.usuario_id = u.id
    LEFT JOIN public.salas s ON s.id = m.sala_id
    LEFT JOIN public.asignaciones a ON a.mesero_id = m.id
    ORDER BY u.id
  `)).rows
  const vinculos = await relaciones()

  await t.test('dry-run informa sin leer valores de credenciales ni modificar filas', async () => {
    const antes = await estado()
    await writeFile(ruta, JSON.stringify([...plan(1, 3, 4, 5), { id: 2, accion: 'restablecer' }]))
    const error = await cli().then(() => assert.fail('La inconsistencia debe señalarse'), (e) => e)
    assert.equal(error.code, 1)
    informeSeguro(error.stdout + error.stderr)
    const informe = JSON.parse(error.stdout)
    assert.equal(informe.modo, 'dry-run')
    assert.equal(informe.totalPendientesInicial, 8)
    assert.deepEqual(informe.resultados.map((item) => item.resultado), [
      'seleccionada', 'ignorada', 'ignorada', 'inconsistente', 'seleccionada',
    ])
    assert.deepEqual(await estado(), antes)
    const observador = { query(sql, params) {
      assert.doesNotMatch(sql, /THEN password|UPDATE/)
      return db.query(sql, params)
    } }
    assert.equal((await procesarCredenciales(observador, plan(1))).resultados[0].resultado, 'seleccionada')
  })

  await t.test('apply es explícito, selectivo e idempotente', async () => {
    await writeFile(ruta, JSON.stringify([...plan(1, 3, 4), { id: 2, accion: 'restablecer' }]))
    const { stdout, stderr } = await cli(['--apply'], base)
    informeSeguro(stdout + stderr)
    assert.deepEqual(JSON.parse(stdout).resultados.map((item) => item.resultado), [
      'migrada', 'ignorada', 'ignorada', 'requiere_restablecimiento',
    ])
    const filas = await estado()
    assert.deepEqual(filas[0], { id: 1, estado_credencial: 'migrada', sin_password: true, con_hash: true })
    assert.deepEqual(filas[1], { id: 2, estado_credencial: 'requiere_restablecimiento', sin_password: true, con_hash: false })
    assert.equal(filas[5].estado_credencial, 'pendiente')
    const { rows } = await db.query('SELECT password_hash FROM public.usuarios WHERE id = 1')
    assert.equal(await verifyPassword(password, rows[0].password_hash), true)
    const segunda = await cli(['--apply'], base)
    informeSeguro(segunda.stdout + segunda.stderr)
    assert(JSON.parse(segunda.stdout).resultados.every((item) => item.resultado === 'ignorada'))
    assert.deepEqual(await estado(), filas)
    assert.deepEqual(await relaciones(), vinculos)
  })

  await t.test('un fallo parcial conserva lo completado y se puede reanudar', async () => {
    const conFallo = { query(sql, params) {
      if (/UPDATE public\.usuarios/.test(sql) && params[0] === 8) throw new Error(password + hash)
      return db.query(sql, params)
    } }
    const seleccion = plan(7, 8, 9)
    const parcial = await procesarCredenciales(conFallo, seleccion, { aplicar: true })
    informeSeguro(JSON.stringify(parcial))
    assert.equal(parcial.interrumpida, true)
    assert.deepEqual(parcial.resultados.map((r) => r.resultado), ['migrada', 'fallo_operativo'])
    assert.deepEqual((await estado()).slice(6, 9).map((r) => r.estado_credencial), ['migrada', 'pendiente', 'pendiente'])
    const reanudada = await procesarCredenciales(db, seleccion, { aplicar: true })
    assert.deepEqual(reanudada.resultados.map((r) => r.resultado), ['ignorada', 'migrada', 'migrada'])
  })

  await t.test('una modificación entre lectura y escritura se conserva', async () => {
    const otro = new pg.Client({
      host: '127.0.0.1', port: 55439, database: base, user: 'meserearte_test', password: '',
    })
    await otro.connect()
    try {
      const conCarrera = { async query(sql, params) {
        if (/UPDATE public\.usuarios/.test(sql)) {
          await otro.query(`
            UPDATE public.usuarios SET password = NULL, estado_credencial = 'requiere_restablecimiento' WHERE id = 10
          `)
        }
        return db.query(sql, params)
      } }
      const informe = await procesarCredenciales(conCarrera, plan(10), { aplicar: true })
      assert.equal(informe.resultados[0].resultado, 'conflicto')
      assert.deepEqual((await estado()).at(-1), {
        id: 10, estado_credencial: 'requiere_restablecimiento', sin_password: true, con_hash: false,
      })
      const cambioPendiente = { async query(sql, params) {
        if (/UPDATE public\.usuarios/.test(sql)) {
          await otro.query("UPDATE public.usuarios SET nombre = 'Ficticio actualizado' WHERE id = 6")
        }
        return db.query(sql, params)
      } }
      const pendiente = await procesarCredenciales(cambioPendiente, plan(6), { aplicar: true })
      assert.equal(pendiente.resultados[0].resultado, 'conflicto')
      assert.equal((await estado()).find((fila) => fila.id === 6).estado_credencial, 'pendiente')
      assert.deepEqual(await relaciones(), vinculos)
    } finally {
      await otro.end()
    }
  })
})
