import { hashPassword } from './passwords.js'

export function validarClasificacion(entrada) {
  if (!Array.isArray(entrada) || entrada.length === 0) {
    throw new TypeError('La clasificación debe ser un arreglo no vacío.')
  }

  const ids = new Set()
  return entrada.map((fila) => {
    if (!fila || Object.keys(fila).length !== 2 || !Object.hasOwn(fila, 'id')
      || !Object.hasOwn(fila, 'accion') || !Number.isInteger(fila.id)
      || fila.id < 1 || fila.id > 2147483647 || ids.has(fila.id)
      || !['migrar', 'restablecer'].includes(fila.accion)) {
      throw new TypeError('Clasificación inválida. Usa IDs únicos y acciones migrar o restablecer.')
    }
    ids.add(fila.id)
    return { id: fila.id, accion: fila.accion }
  })
}

export async function procesarCredenciales(db, clasificacion, { aplicar = false } = {}) {
  const cuentas = validarClasificacion(clasificacion)
  const { rows: [totales] } = await db.query(`
    SELECT count(*)::text AS pendientes FROM public.usuarios WHERE estado_credencial = 'pendiente'
  `)
  const informe = {
    modo: aplicar ? 'apply' : 'dry-run',
    totalPendientesInicial: Number(totales.pendientes),
    seleccionadas: {
      migrar: cuentas.filter((cuenta) => cuenta.accion === 'migrar').length,
      restablecer: cuentas.filter((cuenta) => cuenta.accion === 'restablecer').length,
    },
    resultados: [],
    interrumpida: false,
  }

  for (const cuenta of cuentas) {
    let resultado
    try {
      resultado = await procesarCuenta(db, cuenta, aplicar)
    } catch {
      resultado = 'fallo_operativo'
      informe.interrumpida = true
    }
    informe.resultados.push({ ...cuenta, resultado })
    if (informe.interrumpida) break
  }

  return informe
}

async function procesarCuenta(db, { id, accion }, aplicar) {
  const leerPassword = aplicar && accion === 'migrar'
  const { rows: [fila] } = await db.query(`
    SELECT estado_credencial, password IS NOT NULL AS tiene_password,
           password_hash IS NOT NULL AS tiene_hash, xmin::text AS version
           ${leerPassword ? ", CASE WHEN estado_credencial = 'pendiente' AND password_hash IS NULL THEN password END AS legado" : ''}
    FROM public.usuarios WHERE id = $1
  `, [id])

  if (!fila) return 'no_encontrada'
  if (!fila.tiene_password && (
    (fila.estado_credencial === 'migrada' && fila.tiene_hash)
    || (fila.estado_credencial === 'requiere_restablecimiento' && !fila.tiene_hash)
  )) return 'ignorada'
  if (fila.estado_credencial !== 'pendiente' || !fila.tiene_password || fila.tiene_hash) {
    return 'inconsistente'
  }
  if (!aplicar) return 'seleccionada'

  const migrar = accion === 'migrar'
  const hash = migrar ? await hashPassword(fila.legado) : null
  const estado = migrar ? 'migrada' : 'requiere_restablecimiento'
  const escritura = await db.query(`
    UPDATE public.usuarios
    SET password = NULL, password_hash = $2, estado_credencial = $3
    WHERE id = $1 AND estado_credencial = 'pendiente'
      AND password IS NOT NULL AND password_hash IS NULL AND xmin::text = $4
  `, [id, hash, estado, fila.version])
  return escritura.rowCount === 1 ? estado : 'conflicto'
}
