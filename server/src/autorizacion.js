export function idRecurso(valor) {
  const id = typeof valor === 'number' || (typeof valor === 'string' && /^\d+$/.test(valor))
    ? Number(valor) : 0
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null
}

// Los argumentos de estos helpers SQL son expresiones fijas del servidor.
export const salaPropia = (sala, usuario = '$1') => `EXISTS (
  SELECT 1 FROM salas alcance_sala WHERE alcance_sala.id = ${sala}
    AND alcance_sala.administrador_id = ${usuario}
)`

export const capitanVigente = (evento, mesero = '$2', bloquear = false) => `EXISTS (
  SELECT 1 FROM asignaciones permiso_a
  JOIN eventos permiso_e ON permiso_e.id = permiso_a.evento_id
  JOIN meseros permiso_m ON permiso_m.id = permiso_a.mesero_id
  WHERE permiso_a.evento_id = ${evento} AND permiso_a.mesero_id = ${mesero}
    AND permiso_a.rol = 'Capitán' AND permiso_m.estado = 'Activo'
    AND permiso_m.sala_id = permiso_e.sala_id
    AND COALESCE((
      SELECT permiso_d.estado FROM disponibilidades permiso_d WHERE permiso_d.evento_id = permiso_a.evento_id
        AND permiso_d.mesero_id = permiso_a.mesero_id
      ${bloquear ? 'FOR SHARE OF permiso_d' : ''}
    ), 'Pendiente') <> 'No disponible'
    ${bloquear ? 'FOR SHARE OF permiso_a, permiso_m, permiso_e' : ''}
)`

export const eventoAsignado = (evento, mesero = '$2') => `EXISTS (
  SELECT 1 FROM asignaciones alcance_a
  WHERE alcance_a.evento_id = ${evento} AND alcance_a.mesero_id = ${mesero}
)`

export const ambito = (usuario) => [
  usuario.rol === 'Administrador' ? usuario.id : null,
  usuario.rol === 'Mesero' ? usuario.meseroId : null,
]

export const denegar = (res) => res.status(403).json({ mensaje: 'No tienes permiso para realizar esta operación.' })

export function crearAutorizacion(pool) {
  const permitido = (comprobar) => async (req, res, next) => {
    try {
      if (!(await comprobar(req))) return denegar(res)
      return next()
    } catch {
      console.error('Autorización: fallo al verificar el alcance.')
      return res.status(500).json({ mensaje: 'No fue posible comprobar el permiso.' })
    }
  }
  const existe = async (sql, params) => (await pool.query(sql, params)).rowCount > 0
  const rol = (req, esperado) => req.usuarioAutenticado.rol === esperado
  const admin = permitido((req) => rol(req, 'Administrador'))
  const sala = (req, id) => id && existe(
    'SELECT 1 FROM salas WHERE id = $1 AND administrador_id = $2', [id, req.usuarioAutenticado.id]
  )
  const recurso = (tabla, obtener) => permitido((req) => rol(req, 'Administrador')
    && (obtener(req) && existe(`SELECT 1 FROM ${tabla} r WHERE r.id = $1 AND ${salaPropia('r.sala_id', '$2')}`,
      [obtener(req), req.usuarioAutenticado.id])))
  const salaAdmin = (obtener) => permitido((req) => rol(req, 'Administrador') && sala(req, idRecurso(obtener(req))))
  const destinoOpcional = permitido((req) => req.body?.salaId === undefined
    || (rol(req, 'Administrador') && sala(req, idRecurso(req.body.salaId))))
  const evento = (obtener, soloCapitan = false) => permitido((req) => {
    const id = idRecurso(obtener(req))
    if (!id) return false
    if (rol(req, 'Administrador') && !soloCapitan) {
      return existe(`SELECT 1 FROM eventos e WHERE e.id = $1 AND ${salaPropia('e.sala_id', '$2')}`,
        [id, req.usuarioAutenticado.id])
    }
    return rol(req, 'Mesero') && existe(`SELECT 1 WHERE ${capitanVigente('$1')}`,
      [id, req.usuarioAutenticado.meseroId])
  })
  const propio = (valor) => permitido((req) => rol(req, 'Mesero')
    && idRecurso(valor(req)) !== null && idRecurso(valor(req)) === req.usuarioAutenticado.meseroId)
  const perfil = permitido((req) => {
    const id = idRecurso(req.params.id)
    if (!id) return false
    if (rol(req, 'Mesero')) return id === req.usuarioAutenticado.meseroId
    return rol(req, 'Administrador') && existe(
      `SELECT 1 FROM meseros m WHERE m.id = $1 AND ${salaPropia('m.sala_id', '$2')}`,
      [id, req.usuarioAutenticado.id]
    )
  })
  const disponibilidad = permitido((req) => {
    const actor = req.usuarioAutenticado
    const eventoId = idRecurso(req.body?.eventoId)
    return rol(req, 'Mesero') && eventoId && actor.meseroId
      && (req.body.meseroId === undefined || idRecurso(req.body.meseroId) === actor.meseroId)
      && existe(`SELECT 1 WHERE ${eventoAsignado('$1')}`, [eventoId, actor.meseroId])
  })
  const filtroSala = permitido((req) => req.query.salaId === undefined
    || sala(req, idRecurso(req.query.salaId)))

  const aviso = permitido(async (req) => {
    if (!rol(req, 'Administrador')) return false
    const { salaId, eventoId, meseroId, destinatarioMeseroId } = req.body ?? {}
    const salaElegida = idRecurso(salaId)
    const eventoElegido = idRecurso(eventoId)
    const destinatario = idRecurso(meseroId ?? destinatarioMeseroId)
    if (!salaElegida || !(await sala(req, salaElegida))
      || (eventoId != null && !eventoElegido)
      || ((meseroId ?? destinatarioMeseroId) != null && !destinatario)) return false
    if (eventoElegido && !(await existe('SELECT 1 FROM eventos WHERE id = $1 AND sala_id = $2',
      [eventoElegido, salaElegida]))) return false
    return !destinatario || existe(`SELECT 1 FROM meseros m WHERE m.id = $1 AND m.sala_id = $2
      AND ($3::integer IS NULL OR EXISTS (SELECT 1 FROM asignaciones a WHERE a.evento_id = $3 AND a.mesero_id = m.id))`,
    [destinatario, salaElegida, eventoElegido])
  })

  return { admin, recurso, salaAdmin, destinoOpcional, evento, propio, perfil, disponibilidad, filtroSala, aviso }
}
