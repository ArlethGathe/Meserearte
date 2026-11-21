import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import pg from 'pg'
import { hashPassword, verifyPassword } from '../src/passwords.js'

const sql = (file) => readFile(new URL('../migrations/' + file + '.sql', import.meta.url), 'utf8')
const passwordFicticia = 'Credencial exclusiva del ensayo 🧪'
const tablasOriginales = [
  'asignaciones', 'asistencias', 'disponibilidades', 'evaluaciones_meseros', 'eventos',
  'meseros', 'notificaciones', 'reportes', 'salas', 'usuarios',
]

test('001 y transición 002 en una copia aislada del esquema completo', {
  skip: process.env.MESEREARTE_ENSAYO_CREDENCIALES !== '1',
}, async (t) => {
  const db = new pg.Client({
    host: '127.0.0.1',
    port: 55439,
    database: 'meserearte_credenciales_test',
    user: 'meserearte_test',
    password: '',
  })
  await db.connect()
  t.after(() => db.end())

  const tablas = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")
  assert.deepEqual(tablas.rows.map((row) => row.tablename), tablasOriginales)
  for (const tabla of tablasOriginales) {
    const datos = await db.query('SELECT EXISTS (SELECT 1 FROM public.' + tabla + ') AS poblada')
    assert.equal(datos.rows[0].poblada, false, 'La copia de prueba debe estar vacía')
  }

  const up = await sql('002_credenciales.up')
  const down = await sql('002_credenciales.down')
  const verify = await sql('002_credenciales.verify')
  const catalogo = await sql('001_auth.verify')
  const inspect = async () => {
    const result = await db.query(verify)
    assert.equal(result[1].rows[0].solo_lectura, 'on')
    return { columnas: result[2].rows, restricciones: result[3].rows }
  }
  const inventory = async () => (await db.query(catalogo)).slice(2, 5).map((result) => result.rows)
  const verifyRelationships = async () => (await db.query(`
    SELECT u.id AS usuario_id, u.rol, m.id AS mesero_id, s.id AS sala_id,
           s.administrador_id, e.id AS evento_id, a.rol AS rol_evento
    FROM public.usuarios u
    JOIN public.meseros m ON m.usuario_id = u.id
    JOIN public.salas s ON s.id = m.sala_id
    JOIN public.asignaciones a ON a.mesero_id = m.id
    JOIN public.eventos e ON e.id = a.evento_id AND e.sala_id = s.id
    ORDER BY u.id
  `)).rows

  await db.query(await sql('001_auth.up'))
  await db.query(`
    INSERT INTO public.usuarios (id, nombre, apellidos, correo, password, rol)
    VALUES (101, 'Cuenta', 'Ensayo', 'admin@example.invalid', $1, 'Administrador'),
           (102, 'Cuenta', 'Ensayo', 'mesero@example.invalid', $1, 'Mesero'),
           (103, 'Cuenta', 'Ensayo', 'pendiente@example.invalid', $1, 'Mesero')
  `, [passwordFicticia])
  await db.query(`
    INSERT INTO public.salas (id, nombre, codigo, administrador_id)
    VALUES (201, 'Sala de ensayo', 'ENSAYO', 101);
    INSERT INTO public.meseros (id, usuario_id, sala_id) VALUES (301, 102, 201), (302, 103, 201);
    INSERT INTO public.eventos (id, sala_id, nombre, tipo, fecha, hora_inicio, hora_fin, ubicacion)
    VALUES (401, 201, 'Evento de ensayo', 'Prueba', '2040-01-01', '12:00', '14:00', 'Prueba');
    INSERT INTO public.asignaciones (evento_id, mesero_id, rol)
    VALUES (401, 301, 'Capitán'), (401, 302, 'Mesero');
  `)

  const baseline = await inspect()
  assert.deepEqual(baseline.columnas.map(({ column_name, is_nullable }) => [column_name, is_nullable]), [
    ['password', 'NO'], ['password_hash', 'YES'],
  ])
  const previousInventory = await inventory()
  const relationships = await verifyRelationships()
  assert.equal(relationships.length, 2)

  await t.test('UP retira NOT NULL y deja las cuentas existentes pendientes', async () => {
    await db.query(up)
    const metadata = await inspect()
    assert.deepEqual(metadata.columnas.map(({ column_name, is_nullable }) => [column_name, is_nullable]), [
      ['password', 'YES'], ['password_hash', 'YES'], ['estado_credencial', 'NO'],
    ])
    assert.equal(metadata.restricciones[0].convalidated, true)
    const pending = await db.query(`
      SELECT id FROM public.usuarios WHERE estado_credencial = 'pendiente'
        AND password IS NOT NULL AND password_hash IS NULL ORDER BY id
    `)
    assert.deepEqual(pending.rows.map(({ id }) => id), [101, 102, 103])
    const current = await inventory()
    assert.deepEqual(current[1].filter((row) => row.restriccion !== 'usuarios_credencial_coherente_ck'), previousInventory[1])
    assert.deepEqual(current[2], previousInventory[2])
    assert.deepEqual(await verifyRelationships(), relationships)
  })

  await t.test('DOWN restaura 001 cuando todas las cuentas mantienen su credencial legada', async () => {
    await db.query(down)
    assert.deepEqual(await inspect(), baseline)
    assert.deepEqual(await inventory(), previousInventory)
    assert.deepEqual(await verifyRelationships(), relationships)
    const preserved = await db.query('SELECT count(*)::int AS total FROM public.usuarios WHERE password = $1', [passwordFicticia])
    assert.equal(preserved.rows[0].total, 3)
    await db.query(up)
  })

  await t.test('migración, restablecimiento y alta solo con hash conservan las relaciones', async () => {
    const migratedHash = await hashPassword(passwordFicticia)
    await db.query(`
      UPDATE public.usuarios SET password = NULL, password_hash = $1, estado_credencial = 'migrada'
      WHERE id = 102 AND estado_credencial = 'pendiente'
    `, [migratedHash])
    const stored = await db.query('SELECT password_hash FROM public.usuarios WHERE id = 102')
    assert.equal(await verifyPassword(passwordFicticia, stored.rows[0].password_hash), true)
    await db.query(`
      UPDATE public.usuarios SET password = NULL, estado_credencial = 'requiere_restablecimiento' WHERE id = 101
    `)
    const newHash = await hashPassword('Otra credencial exclusiva del ensayo')
    await db.query(`
      INSERT INTO public.usuarios (id, nombre, apellidos, correo, password_hash, rol, estado_credencial)
      VALUES (104, 'Alta', 'Ensayo', 'alta@example.invalid', $1, 'Administrador', 'migrada')
    `, [newHash])
    const state = await db.query(`
      SELECT id, estado_credencial, password IS NULL AS sin_legado, password_hash IS NOT NULL AS con_hash
      FROM public.usuarios ORDER BY id
    `)
    assert.deepEqual(state.rows.map((row) => Object.values(row)), [
      [101, 'requiere_restablecimiento', true, false],
      [102, 'migrada', true, true],
      [103, 'pendiente', false, false],
      [104, 'migrada', true, true],
    ])
    assert.deepEqual(await verifyRelationships(), relationships)
  })

  await t.test('las combinaciones inválidas y la reversión insegura se rechazan', async () => {
    await assert.rejects(db.query('UPDATE public.usuarios SET password = NULL WHERE id = 103'), { code: '23514' })
    await assert.rejects(db.query("UPDATE public.usuarios SET estado_credencial = 'migrada', password = NULL WHERE id = 103"), { code: '23514' })
    await assert.rejects(db.query('UPDATE public.usuarios SET password = $1 WHERE id = 102', [passwordFicticia]), { code: '23514' })
    await assert.rejects(db.query('UPDATE public.meseros SET usuario_id = 999 WHERE id = 301'), { code: '23503' })
    await assert.rejects(db.query("UPDATE public.asignaciones SET rol = 'Capitán' WHERE mesero_id = 302"), { code: '23505' })
    const before = await inspect()
    await assert.rejects(db.query(down), { code: 'P0001' })
    await db.query('ROLLBACK')
    assert.deepEqual(await inspect(), before)
    assert.deepEqual(await verifyRelationships(), relationships)
    const accounts = await db.query('SELECT id FROM public.usuarios ORDER BY id')
    assert.deepEqual(accounts.rows.map(({ id }) => id), [101, 102, 103, 104])
  })
})
