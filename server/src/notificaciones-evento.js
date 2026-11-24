import { randomUUID } from 'node:crypto'
import { capitanVigente, denegar, idRecurso } from './autorizacion.js'

const personalEvento = `
  FROM asignaciones a
  JOIN eventos e ON e.id = a.evento_id
  JOIN meseros m ON m.id = a.mesero_id AND m.sala_id = e.sala_id
  WHERE a.evento_id = $1 AND m.id <> $2`

export function registrarNotificacionesEvento(app, pool, permisos) {
  const base = '/api/notificaciones/eventos'
  const soloMesero = permisos.propio((req) => req.usuarioAutenticado.meseroId)
  const soloCapitan = permisos.evento((req) => req.params.eventoId, true)

  app.get(base, soloMesero, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT e.id FROM eventos e
       WHERE ${capitanVigente('e.id', '$1')}`,
      [req.usuarioAutenticado.meseroId]
    )
    res.json(rows)
  })

  app.get(base + '/:eventoId/destinatarios', soloCapitan, async (req, res) => {
    const { rows: [evento] } = await pool.query(
      `SELECT ARRAY(
         SELECT json_build_object('id', m.id, 'nombre', u.nombre, 'apellidos', u.apellidos)
         FROM asignaciones a
         JOIN meseros m ON m.id = a.mesero_id AND m.sala_id = e.sala_id
         JOIN usuarios u ON u.id = m.usuario_id
         WHERE a.evento_id = e.id AND m.id <> $2
         ORDER BY u.nombre, u.apellidos, m.id
       ) AS personal
       FROM eventos e WHERE e.id = $1 AND ${capitanVigente('e.id')}`,
      [req.params.eventoId, req.usuarioAutenticado.meseroId]
    )
    return evento ? res.json(evento.personal) : denegar(res)
  })

  app.post(base + '/:eventoId', soloCapitan, async (req, res) => {
    const datos = req.body ?? {}
    if (Object.keys(datos).some((campo) => !['titulo', 'mensaje', 'destinatarioIds'].includes(campo))) {
      return res.status(400).json({ mensaje: 'El envío contiene campos que no están permitidos.' })
    }
    const { titulo, mensaje, destinatarioIds } = datos
    const tituloLimpio = typeof titulo === 'string' ? titulo.trim() : ''
    const mensajeLimpio = typeof mensaje === 'string' ? mensaje.trim() : ''
    if (!tituloLimpio || !mensajeLimpio || Array.from(tituloLimpio).length > 200
      || tituloLimpio.includes('\0') || mensajeLimpio.includes('\0')) {
      return res.status(400).json({ mensaje: 'Escribe un título de hasta 200 caracteres y un mensaje válido.' })
    }
    const ids = Array.isArray(destinatarioIds) ? [...new Set(destinatarioIds.map(idRecurso))] : []
    if (!ids.length || ids.includes(null)) {
      return res.status(400).json({ mensaje: 'Selecciona al menos un destinatario válido.' })
    }

    const eventoId = req.params.eventoId
    const capitanId = req.usuarioAutenticado.meseroId
    const cliente = await pool.connect()
    try {
      await cliente.query('BEGIN')
      const permiso = await cliente.query(
        `SELECT sala_id FROM eventos WHERE id = $1 AND ${capitanVigente('$1', '$2', true)}`,
        [eventoId, capitanId]
      )
      if (!permiso.rowCount) {
        await cliente.query('ROLLBACK')
        return denegar(res)
      }
      const destino = await cliente.query(
        `SELECT m.id ${personalEvento} AND m.id = ANY($3::integer[]) FOR SHARE OF a, m`,
        [eventoId, capitanId, ids]
      )
      if (destino.rowCount !== ids.length) {
        await cliente.query('ROLLBACK')
        return res.status(400).json({ mensaje: 'Todos los destinatarios deben estar asignados a este evento.' })
      }
      const envioId = randomUUID()
      await cliente.query(
        `INSERT INTO notificaciones
           (envio_id, tipo, titulo, mensaje, sala_id, evento_id, destinatario,
            destinatario_mesero_id, modo_destinatario, emisor)
         SELECT $1, 'Aviso de evento', $2, $3, $4, $5, 'Individual',
                destinatario_id, 'Evento', 'Capitán'
         FROM unnest($6::integer[]) AS destino(destinatario_id)`,
        [envioId, tituloLimpio, mensajeLimpio, permiso.rows[0].sala_id, eventoId, ids]
      )
      await cliente.query('COMMIT')
      return res.status(201).json({ ok: true, envioId, total: ids.length })
    } catch (error) {
      await cliente.query('ROLLBACK')
      throw error
    } finally {
      cliente.release()
    }
  })
}
