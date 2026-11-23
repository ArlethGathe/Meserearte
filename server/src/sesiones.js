import { createHash, randomBytes } from 'node:crypto'

export function digestSesion(token) {
  if (typeof token !== 'string' || token.length !== 43 || !/^[A-Za-z0-9_-]{43}$/.test(token)
    || Buffer.from(token, 'base64url').toString('base64url') !== token) return null
  return createHash('sha256').update(token).digest()
}

export function generarTokenSesion() {
  const token = randomBytes(32).toString('base64url')
  return { token, digest: digestSesion(token) }
}

function leerCookie(header, nombre) {
  const valores = (header ?? '').split(';').map((campo) => campo.trim())
    .filter((campo) => campo.startsWith(nombre + '='))
  if (valores.length === 0) return { motivo: 'cookie_ausente' }
  const digest = valores.length === 1 ? digestSesion(valores[0].slice(nombre.length + 1)) : null
  return digest ? { digest } : { motivo: 'token_malformado' }
}

export function crearSesiones(pool, config) {
  const { nombre: nombreCookie, cookie, inactividadSegundos, absolutaSegundos } = config

  async function emitir(res, usuarioId, versionCuenta) {
    const { token, digest } = generarTokenSesion()
    const ins = await pool.query(`
      INSERT INTO public.auth_sesiones
        (token_digest, usuario_id, creada_en, ultima_actividad, expira_inactividad_en, expira_absoluta_en)
      SELECT $1, u.id, statement_timestamp(), statement_timestamp(),
             statement_timestamp() + $3::integer * interval '1 second',
             statement_timestamp() + $4::integer * interval '1 second'
      FROM public.usuarios u
      WHERE u.id = $2 AND u.estado = 'Activo' AND u.xmin::text = $5
    `, [digest, usuarioId, inactividadSegundos, absolutaSegundos, versionCuenta])
    if (ins.rowCount !== 1) throw new Error('No se pudo persistir la sesión.')
    res.cookie(nombreCookie, token, { ...cookie, maxAge: absolutaSegundos * 1000 })
  }

  async function validar(header, { renovarActividad = false } = {}) {
    const entrada = leerCookie(header, nombreCookie)
    if (!entrada.digest) return entrada
    const { rows: [sesion] } = await pool.query(`
      SELECT (s.revocada_en IS NOT NULL) AS revocada,
             (s.expira_inactividad_en <= statement_timestamp()) AS inactiva,
             (s.expira_absoluta_en <= statement_timestamp()) AS vencida,
             u.id, u.nombre, u.apellidos, u.correo, u.rol, u.estado,
             m.id AS "meseroId", m.sala_id AS "salaId"
      FROM public.auth_sesiones s
      LEFT JOIN public.usuarios u ON u.id = s.usuario_id
      LEFT JOIN public.meseros m ON m.usuario_id = u.id
      WHERE s.token_digest = $1
    `, [entrada.digest])
    if (!sesion) return { motivo: 'sesion_inexistente' }
    if (sesion.revocada) return { motivo: 'sesion_revocada' }
    if (sesion.vencida) return { motivo: 'vencimiento_absoluto' }
    if (sesion.inactiva) return { motivo: 'inactividad_vencida' }
    if (sesion.id === null) return { motivo: 'usuario_inexistente' }
    if (sesion.estado !== 'Activo') return { motivo: 'cuenta_inactiva' }

    if (renovarActividad && !(await extender(entrada.digest))) return { motivo: 'sesion_cambio' }

    const { id, nombre, apellidos, correo, rol, estado, meseroId, salaId } = sesion
    return { usuario: { id, nombre, apellidos, correo, rol, estado, meseroId, salaId }, digest: entrada.digest }
  }

  async function extender(digest) {
    const renovada = await pool.query(`
        UPDATE public.auth_sesiones s
        SET ultima_actividad = GREATEST(s.ultima_actividad, statement_timestamp()),
            expira_inactividad_en = LEAST(s.expira_absoluta_en,
              GREATEST(s.expira_inactividad_en, statement_timestamp() + $2::integer * interval '1 second'))
        FROM public.usuarios u
        WHERE s.token_digest = $1 AND s.revocada_en IS NULL
          AND s.expira_inactividad_en > statement_timestamp()
          AND s.expira_absoluta_en > statement_timestamp()
          AND u.id = s.usuario_id AND u.estado = 'Activo'
      `, [digest, inactividadSegundos])
    return renovada.rowCount === 1
  }

  const noAutenticado = (res) => res.status(401).json({ ok: false, mensaje: 'Inicia sesión para continuar.' })
  const errorValidacion = (res) => {
    console.error('Sesión: fallo interno al validar.')
    return res.status(500).json({ ok: false, mensaje: 'No se pudo comprobar la sesión.' })
  }

  function autenticar({ renovarActividad = false, opcional = false } = {}) {
    return async (req, res, next) => {
      try {
        const { usuario, digest } = await validar(req.headers.cookie, { renovarActividad })
        if (!usuario && !opcional) return noAutenticado(res)
        req.usuarioAutenticado = usuario
        req.digestSesion = digest
        return next()
      } catch {
        return errorValidacion(res)
      }
    }
  }

  async function renovar(req, res, next) {
    try {
      if (!(await extender(req.digestSesion))) return noAutenticado(res)
      return next()
    } catch {
      return errorValidacion(res)
    }
  }

  async function logout(req, res) {
    try {
      const digest = req.digestSesion
      if (digest) {
        await pool.query(`
          UPDATE public.auth_sesiones SET revocada_en = GREATEST(creada_en, clock_timestamp())
          WHERE token_digest = $1 AND revocada_en IS NULL
        `, [digest])
      }
      res.clearCookie(nombreCookie, cookie)
      return res.status(204).end()
    } catch {
      console.error('Sesión: fallo interno al cerrar.')
      return res.status(500).json({ ok: false, mensaje: 'No se pudo cerrar la sesión.' })
    }
  }

  return { emitir, validar, autenticar, renovar, logout }
}
