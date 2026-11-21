import { pool } from './db.js'
import { hashPassword } from './passwords.js'

async function cargarDemo() {
  if (process.env.NODE_ENV !== 'development'
    || !['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST)
    || !/^[a-z0-9_]+_(demo|test)$/.test(process.env.DB_NAME ?? '')) {
    throw new Error('La carga requiere una base local de desarrollo terminada en _demo o _test.')
  }

  const adminPassword = process.env.DEMO_ADMIN_PASSWORD
  const meseroPassword = process.env.DEMO_MESERO_PASSWORD
  if (!adminPassword || !meseroPassword) {
    throw new Error('Define DEMO_ADMIN_PASSWORD y DEMO_MESERO_PASSWORD para la carga ficticia.')
  }

  const adminHash = await hashPassword(adminPassword)
  const meseroHash = await hashPassword(meseroPassword)
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    await cliente.query("SET LOCAL lock_timeout = '5s'")
    await cliente.query('LOCK TABLE public.usuarios IN SHARE ROW EXCLUSIVE MODE')
    const { rows: [estado] } = await cliente.query(
      'SELECT EXISTS (SELECT 1 FROM public.usuarios) AS hay_usuarios'
    )
    if (estado.hay_usuarios) {
      await cliente.query('ROLLBACK')
      return false
    }

    const { rows: usuarios } = await cliente.query(`
      INSERT INTO public.usuarios (nombre, apellidos, correo, password_hash, estado_credencial, rol, estado)
      VALUES ('Administrador', 'Demo', 'admin-demo@example.invalid', $1, 'migrada', 'Administrador', 'Activo'),
             ('Mesero', 'Demo', 'mesero-demo@example.invalid', $2, 'migrada', 'Mesero', 'Activo')
      RETURNING id, rol
    `, [adminHash, meseroHash])
    const admin = usuarios.find((usuario) => usuario.rol === 'Administrador')
    const mesero = usuarios.find((usuario) => usuario.rol === 'Mesero')
    const { rows: [sala] } = await cliente.query(`
      INSERT INTO public.salas (nombre, descripcion, codigo, administrador_id, estado)
      VALUES ('Equipo de demostración', 'Datos ficticios', 'DEMOMESA', $1, 'Activa')
      RETURNING id
    `, [admin.id])
    await cliente.query(`
      INSERT INTO public.meseros (usuario_id, sala_id, estado)
      VALUES ($1, $2, 'Activo')
    `, [mesero.id, sala.id])
    await cliente.query('COMMIT')
    return true
  } catch (error) {
    await cliente.query('ROLLBACK')
    throw error
  } finally {
    cliente.release()
  }
}

try {
  const creada = await cargarDemo()
  console.log(creada ? 'Datos ficticios creados.' : 'La base ya contiene usuarios.')
} catch {
  console.error('No se pudo cargar la demostración. Revisa el destino local, las migraciones y las variables requeridas.')
  process.exitCode = 1
} finally {
  await pool.end()
}
