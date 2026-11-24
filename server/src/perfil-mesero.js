const campos = ['nombre', 'apellidos', 'correo', 'telefono']

async function consultarPerfil(db, { id, meseroId }) {
  const { rows } = await db.query(
    `SELECT u.nombre, u.apellidos, u.correo, m.telefono, u.rol,
            s.nombre AS sala, u.estado,
            (SELECT count(*)::integer FROM asignaciones a WHERE a.mesero_id = m.id) AS "eventosParticipados",
            (SELECT count(*)::integer FROM asignaciones a
              WHERE a.mesero_id = m.id AND a.rol = 'Capitán') AS "eventosComoCapitan"
     FROM usuarios u
     JOIN meseros m ON m.usuario_id = u.id
     LEFT JOIN salas s ON s.id = m.sala_id
     WHERE u.id = $1 AND m.id = $2`,
    [id, meseroId]
  )
  return rows[0]
}

export function crearPerfilMesero(pool, normalizarCorreo, denegar) {
  const noEncontrado = (res) => res.status(404).json({ mensaje: 'Perfil no encontrado.' })
  const duplicado = (res) => res.status(409).json({ mensaje: 'El correo ya está registrado.' })

  return {
    async consultar(req, res) {
      const perfil = await consultarPerfil(pool, req.usuarioAutenticado)
      return perfil ? res.json(perfil) : noEncontrado(res)
    },

    async actualizar(req, res) {
      const datos = req.body ?? {}
      if (Object.keys(datos).some((campo) => !campos.includes(campo))) return denegar(res)
      if (campos.some((campo) => typeof datos[campo] !== 'string' || !datos[campo].trim())) {
        return res.status(400).json({ mensaje: 'Completa todos los datos personales.' })
      }

      const nombre = datos.nombre.trim()
      const apellidos = datos.apellidos.trim()
      const correo = normalizarCorreo(datos.correo)
      const telefono = datos.telefono.replace(/\D/g, '')

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        return res.status(400).json({ mensaje: 'Ingresa un correo válido.' })
      }
      if (telefono.length < 10) {
        return res.status(400).json({ mensaje: 'Ingresa un teléfono de al menos 10 dígitos.' })
      }

      const { id, meseroId } = req.usuarioAutenticado
      const cliente = await pool.connect()
      try {
        await cliente.query('BEGIN')
        const { rowCount } = await cliente.query(
          `UPDATE usuarios u SET nombre = $1, apellidos = $2, correo = $3
           WHERE u.id = $4 AND EXISTS (
             SELECT 1 FROM meseros m WHERE m.usuario_id = u.id AND m.id = $5
           )`,
          [nombre, apellidos, correo, id, meseroId]
        )
        if (!rowCount) {
          await cliente.query('ROLLBACK')
          return noEncontrado(res)
        }
        const conflicto = await cliente.query(
          'SELECT 1 FROM usuarios WHERE lower(btrim(correo)) = $1 AND id <> $2 LIMIT 1',
          [correo, id]
        )
        if (conflicto.rowCount) {
          await cliente.query('ROLLBACK')
          return duplicado(res)
        }
        await cliente.query('UPDATE meseros SET telefono = $1 WHERE id = $2 AND usuario_id = $3',
          [telefono, meseroId, id])
        const perfil = await consultarPerfil(cliente, req.usuarioAutenticado)
        await cliente.query('COMMIT')
        return res.json(perfil)
      } catch (error) {
        await cliente.query('ROLLBACK')
        if (error.code === '23505' && error.constraint === 'usuarios_correo_key') return duplicado(res)
        if (error.code === '22001') {
          return res.status(400).json({ mensaje: 'Uno de los datos supera la longitud permitida.' })
        }
        throw error
      } finally {
        cliente.release()
      }
    }
  }
}
