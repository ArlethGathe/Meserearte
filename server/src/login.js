import { timingSafeEqual } from 'node:crypto'
import { verifyPassword } from './passwords.js'

async function credencialValida(cuenta, password) {
  const { passwordLegado, sinPassword, hash, estadoCredencial } = cuenta

  switch (estadoCredencial) {
    case 'migrada':
      if (sinPassword && typeof hash === 'string' && hash.length > 0) {
        return verifyPassword(password, hash)
      }
      break
    case 'pendiente':
      if (!sinPassword && typeof passwordLegado === 'string' && hash === null) {
        // Compatibilidad temporal. Retirar al terminar la migración controlada.
        const legado = Buffer.from(passwordLegado, 'utf8')
        const recibido = Buffer.from(password, 'utf8')
        return legado.length === recibido.length && timingSafeEqual(legado, recibido)
      }
      break
    case 'requiere_restablecimiento':
      if (sinPassword && hash === null) return false
      break
  }

  console.warn('Login: credencial inconsistente', { usuarioId: cuenta.id })
  return false
}

export function crearLogin(pool, normalizarCorreo, emitirSesion) {
  return async (req, res) => {
    try {
      const correo = normalizarCorreo(req.body.correo)
      const password = String(req.body.password ?? '')
      const rolSolicitado = req.body.rol
      const resultado = await pool.query(
        `
        SELECT u.id, u.nombre, u.apellidos, u.correo, u.rol, u.estado,
               m.id AS "meseroId", m.sala_id AS "salaId",
               u.xmin::text AS "versionCuenta",
               u.estado_credencial AS "estadoCredencial",
               u.password IS NULL AS "sinPassword",
               CASE WHEN u.estado_credencial = 'pendiente' AND u.password_hash IS NULL
                    THEN u.password END AS "passwordLegado",
               u.password_hash AS hash
        FROM usuarios u
        LEFT JOIN meseros m ON m.usuario_id = u.id
        WHERE LOWER(u.correo) = LOWER($1)
        LIMIT 1
        `,
        [correo]
      )

      const cuenta = resultado.rows[0]
      if (!cuenta || !(await credencialValida(cuenta, password))) {
        return res.status(401).json({ ok: false, mensaje: 'Correo o contraseña incorrectos.' })
      }

      if (cuenta.estado !== 'Activo') {
        return res.status(403).json({ ok: false, mensaje: 'La cuenta se encuentra inactiva.' })
      }

      if (rolSolicitado && rolSolicitado !== cuenta.rol) {
        return res.status(403).json({
          ok: false,
          mensaje: 'El rol seleccionado no corresponde a esta cuenta.'
        })
      }

      const { id, nombre, apellidos, rol, estado, meseroId, salaId } = cuenta
      const usuario = { id, nombre, apellidos, correo: cuenta.correo, rol, estado, meseroId, salaId }
      await emitirSesion(res, id, cuenta.versionCuenta)
      return res.set('Cache-Control', 'no-store').json({ ok: true, usuario, ...usuario })
    } catch {
      console.error('Login: error interno al consultar o verificar la credencial')
      return res.status(500).json({ ok: false, mensaje: 'Error al iniciar sesión.' })
    }
  }
}
