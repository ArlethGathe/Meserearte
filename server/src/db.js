import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
})

pool.on('error', (error) => {
  console.error('Error inesperado de PostgreSQL:', error)
})

export async function probarConexion() {
  const cliente = await pool.connect()

  try {
    const resultado = await cliente.query(`
      SELECT
        current_database() AS base_datos,
        current_user AS usuario,
        NOW() AS fecha
    `)

    return resultado.rows[0]
  } finally {
    cliente.release()
  }
}