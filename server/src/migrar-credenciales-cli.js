import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import pg from 'pg'
import { procesarCredenciales, validarClasificacion } from './migrar-credenciales.js'

async function ejecutar() {
  const { values } = parseArgs({
    options: { db: { type: 'string' }, plan: { type: 'string' }, apply: { type: 'boolean' } },
  })
  const { db, plan, apply } = values
  if (!db || db.trim() !== db || !/^meserearte_[a-z0-9_]+_test$/.test(db) || !plan
    || (apply && process.env.MESEREARTE_CREDENTIALS_APPLY !== db)) {
    console.error('Se requiere --db meserearte_<nombre>_test y --plan. Para --apply confirma la base con MESEREARTE_CREDENTIALS_APPLY.')
    return 1
  }

  const cuentas = validarClasificacion(JSON.parse(await readFile(plan, 'utf8')))
  // Configuración independiente de .env y del pool que usa la aplicación.
  const cliente = new pg.Client({
    host: '127.0.0.1', port: 55439, database: db, user: 'meserearte_test',
    password: '',
    connectionTimeoutMillis: 5000,
    options: '-c lock_timeout=5000 -c statement_timeout=30000'
      + ' -c log_parameter_max_length=0 -c log_parameter_max_length_on_error=0'
      + (apply ? '' : ' -c default_transaction_read_only=on'),
  })

  try {
    await cliente.connect()
    const { rows: [destino] } = await cliente.query(`
      SELECT current_database() AS base, current_user AS usuario,
             host(inet_server_addr()) AS host, inet_server_port() AS puerto,
             current_setting('transaction_read_only') AS solo_lectura
    `)
    if (destino.base !== db || destino.usuario !== 'meserearte_test'
      || destino.host !== '127.0.0.1' || destino.puerto !== 55439
      || (!apply && destino.solo_lectura !== 'on')) {
      throw new Error('Destino inesperado.')
    }
    const informe = await procesarCredenciales(cliente, cuentas, { aplicar: apply })
    console.log(JSON.stringify(informe))
    return informe.interrumpida || informe.resultados.some(({ resultado }) =>
      ['inconsistente', 'conflicto', 'no_encontrada'].includes(resultado)
    ) ? 1 : 0
  } finally {
    await cliente.end()
  }
}

try {
  process.exitCode = await ejecutar()
} catch {
  console.error('No se pudo ejecutar la migración. Revisa el plan, las protecciones, el destino aislado y el esquema.')
  process.exitCode = 1
}
