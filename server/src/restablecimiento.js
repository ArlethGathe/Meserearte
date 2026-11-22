import { createHash, randomBytes } from 'node:crypto'
import { hashPassword } from './passwords.js'

const mensaje = 'Si el correo puede recibir instrucciones, te enviaremos un enlace para restablecer tu contraseña.'
const invalido = 'El enlace no es válido o ha caducado.'
const digest = (token) => createHash('sha256').update(token).digest()
const elegible = "u.estado = 'Activo' AND u.estado_credencial IN ('migrada', 'requiere_restablecimiento')"

export function configurarEntregaRestablecimiento(env = process.env) {
  const { PASSWORD_RESET_DELIVERY_URL: endpoint, PASSWORD_RESET_DELIVERY_KEY: clave,
    PASSWORD_RESET_APP_URL: destino } = env
  if (!endpoint && !clave && !destino) return null
  const segura = (value) => {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) {
      throw new Error('Configura URLs HTTPS válidas para el restablecimiento.')
    }
    return url
  }
  if (!endpoint || !clave || !destino) {
    throw new Error('Configura todas las variables de entrega de restablecimiento.')
  }
  const urlEntrega = segura(endpoint)
  const urlApp = segura(destino)
  return async ({ correo, token }) => {
    const enlace = new URL(urlApp)
    enlace.hash = new URLSearchParams({ restablecer: token }).toString()
    const respuesta = await fetch(urlEntrega, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clave },
      body: JSON.stringify({ correo, enlace: enlace.href }),
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    })
    if (respuesta.body) await respuesta.body.cancel()
    if (!respuesta.ok) throw new Error('Falló la entrega de restablecimiento.')
  }
}

export function crearRestablecimiento({ pool, entregar, limitarSolicitud }) {
  async function emitir(correo, ip) {
    if (!entregar || !(await limitarSolicitud.reservar(ip, correo)).permitido) return
    const token = randomBytes(32).toString('base64url')
    const { rows: [cuenta] } = await pool.query(`
      WITH cuenta AS MATERIALIZED (
        SELECT u.id, u.correo FROM public.usuarios u
        WHERE lower(u.correo) = $1 AND ${elegible}
        ORDER BY u.id LIMIT 1 FOR UPDATE
      ), emitido AS (
        INSERT INTO public.auth_restablecimiento (usuario_id, token_digest, expira_en)
        SELECT id, $2, clock_timestamp() + interval '30 minutes' FROM cuenta
        ON CONFLICT (usuario_id) DO UPDATE
        SET token_digest = EXCLUDED.token_digest, expira_en = EXCLUDED.expira_en
        RETURNING usuario_id
      )
      SELECT cuenta.correo FROM cuenta JOIN emitido ON emitido.usuario_id = cuenta.id
    `, [correo, digest(token)])
    if (cuenta) await entregar({ correo: cuenta.correo, token })
  }

  function solicitar(req, res) {
    const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim().toLowerCase() : ''
    res.status(202).json({ ok: true, mensaje })
    if (correo && correo.length <= 180) {
      const ip = req.ip ?? req.socket.remoteAddress ?? 'origen-desconocido'
      void emitir(correo, ip).catch(() => console.error('Restablecimiento: fallo interno al emitir o entregar.'))
    }
  }

  async function confirmar(req, res) {
    const { token, password } = req.body ?? {}
    const rechazar = () => res.status(400).json({ ok: false, mensaje: invalido })
    if (!entregar || typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)
      || token.length !== 43 || typeof password !== 'string') return rechazar()
    try {
      const clave = digest(token)
      const { rows: [cuenta] } = await pool.query(`
        SELECT t.usuario_id FROM public.auth_restablecimiento t
        JOIN public.usuarios u ON u.id = t.usuario_id
        WHERE t.token_digest = $1 AND t.expira_en > clock_timestamp() AND ${elegible}
      `, [clave])
      if (!cuenta) return rechazar()

      let hash
      try {
        hash = await hashPassword(password)
      } catch (error) {
        if (error instanceof TypeError) {
          return res.status(400).json({ ok: false, mensaje: 'La contraseña no tiene un formato válido.' })
        }
        throw error
      }

      const cambio = await pool.query(`
        WITH cuenta AS MATERIALIZED (
          SELECT u.id FROM public.usuarios u WHERE u.id = $1 AND ${elegible} FOR UPDATE
        ), consumido AS (
          DELETE FROM public.auth_restablecimiento t USING cuenta
          WHERE t.usuario_id = cuenta.id AND t.token_digest = $2 AND t.expira_en > clock_timestamp()
          RETURNING t.usuario_id
        )
        UPDATE public.usuarios u
        SET password_hash = $3, password = NULL, estado_credencial = 'migrada'
        FROM consumido WHERE u.id = consumido.usuario_id
      `, [cuenta.usuario_id, clave, hash])
      if (cambio.rowCount !== 1) return rechazar()
      return res.json({ ok: true, mensaje: 'Contraseña restablecida.' })
    } catch {
      console.error('Restablecimiento: fallo interno al confirmar.')
      return res.status(500).json({ ok: false, mensaje: 'No se pudo restablecer la contraseña.' })
    }
  }

  return { solicitar, confirmar }
}
