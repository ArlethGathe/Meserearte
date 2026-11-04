import { pool } from './db.js'

async function probar() {
  try {
    const conexion = await pool.query(`
      SELECT
        current_database() AS base_datos,
        current_user AS usuario,
        NOW() AS fecha
    `)

    console.log('')
    console.log('========================================')
    console.log(' POSTGRESQL CONECTADO CORRECTAMENTE')
    console.log('========================================')
    console.log('')
    console.log(conexion.rows[0])

    const tablas = await pool.query(`
      SELECT
        table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)

    console.log('')
    console.log('TABLAS ENCONTRADAS:')
    console.log('')

    tablas.rows.forEach((tabla) => {
      console.log(`- ${tabla.table_name}`)
    })

    console.log('')
    console.log(`Total: ${tablas.rows.length} tablas`)
    console.log('')
  } catch (error) {
    console.error('')
    console.error('========================================')
    console.error(' ERROR AL CONECTAR CON POSTGRESQL')
    console.error('========================================')
    console.error('')
    console.error(error.message)
    console.error('')
  } finally {
    await pool.end()
  }
}

probar()