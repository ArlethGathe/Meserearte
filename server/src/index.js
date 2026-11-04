
import express from 'express'
import cors from 'cors'
import { pool, probarConexion } from './db.js'

const app = express()

const PORT = Number(process.env.PORT || 3001)

/* =========================================================
   CONFIGURACIÓN GENERAL
========================================================= */

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        /^http:\/\/localhost:\d+$/.test(origin)
      ) {
        callback(null, true)
        return
      }

      callback(
        new Error(
          'Origen no permitido por CORS'
        )
      )
    }
  })
)

app.use(express.json())


/* =========================================================
   FUNCIONES GENERALES
========================================================= */

function normalizarCorreo(correo = '') {
  return String(correo)
    .trim()
    .toLowerCase()
}

function esEnlaceGoogleMaps(valor = '') {
  try {
    const url = new URL(
      String(valor).trim()
    )

    if (
      url.protocol !== 'https:' &&
      url.protocol !== 'http:'
    ) {
      return false
    }

    const host =
      url.hostname
        .toLowerCase()

    return (
      host === 'maps.app.goo.gl' ||
      host === 'goo.gl' ||
      host === 'share.google' ||
      host === 'maps.google.com' ||
      host.endsWith('.google.com') ||
      host.endsWith('.google.com.mx') ||
      host === 'google.com' ||
      host === 'google.com.mx'
    )
  } catch {
    return false
  }
}

function numero(valor) {
  const n = Number(valor)

  return Number.isFinite(n)
    ? n
    : null
}

function generarCodigoSala() {
  const caracteres =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  let codigo = 'MESA'

  for (let i = 0; i < 5; i += 1) {
    codigo +=
      caracteres[
        Math.floor(
          Math.random() *
          caracteres.length
        )
      ]
  }

  return codigo
}

function fechaTexto(valor) {
  if (!valor) {
    return ''
  }

  if (valor instanceof Date) {
    return valor
      .toISOString()
      .slice(0, 10)
  }

  return String(valor)
    .slice(0, 10)
}

function horaTexto(valor) {
  if (!valor) {
    return ''
  }

  return String(valor)
    .slice(0, 5)
}

function fechaHoyMexico() {
  const partes =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone:
          'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
    ).formatToParts(
      new Date()
    )

  const obtener =
    (tipo) =>
      partes.find(
        (parte) =>
          parte.type === tipo
      )?.value

  return `${obtener('year')}-${obtener('month')}-${obtener('day')}`
}


/* =========================================================
   HORARIOS Y TRASLAPES
========================================================= */

function eventoAIntervalo(evento) {
  const fecha =
    fechaTexto(evento.fecha)

  const inicio =
    horaTexto(
      evento.horaInicio ??
      evento.hora_inicio
    )

  const fin =
    horaTexto(
      evento.horaFin ??
      evento.hora_fin
    )

  if (
    !fecha ||
    !inicio ||
    !fin
  ) {
    return null
  }

  const [
    anio,
    mes,
    dia
  ] =
    fecha
      .split('-')
      .map(Number)

  const [
    horaInicio,
    minutoInicio
  ] =
    inicio
      .split(':')
      .map(Number)

  const [
    horaFin,
    minutoFin
  ] =
    fin
      .split(':')
      .map(Number)

  const inicioMs =
    Date.UTC(
      anio,
      mes - 1,
      dia,
      horaInicio,
      minutoInicio
    )

  let finMs =
    Date.UTC(
      anio,
      mes - 1,
      dia,
      horaFin,
      minutoFin
    )

  /*
    Ejemplo:
    19:00 -> 01:00

    Se interpreta internamente como
    término durante la madrugada.
    La interfaz NO necesita mostrar
    "+1 día".
  */

  if (finMs < inicioMs) {
    finMs +=
      24 *
      60 *
      60 *
      1000
  }

  return {
    inicio: inicioMs,
    fin: finMs
  }
}

function eventosSeTraslapan(
  eventoA,
  eventoB
) {
  const a =
    eventoAIntervalo(eventoA)

  const b =
    eventoAIntervalo(eventoB)

  if (!a || !b) {
    return false
  }

  return (
    a.inicio < b.fin &&
    b.inicio < a.fin
  )
}


/* =========================================================
   CONSULTAS REUTILIZABLES
========================================================= */

async function obtenerSala(
  salaId,
  cliente = pool
) {
  const resultado =
    await cliente.query(
      `
      SELECT
        s.id,
        s.nombre,
        s.descripcion,
        s.codigo,
        s.administrador_id
          AS "administradorId",
        s.estado,
        TO_CHAR(
          s.fecha_creacion,
          'YYYY-MM-DD'
        ) AS fecha
      FROM salas s
      WHERE s.id = $1
      `,
      [salaId]
    )

  return resultado.rows[0] ?? null
}

async function obtenerMesero(
  meseroId,
  cliente = pool
) {
  const resultado =
    await cliente.query(
      `
      SELECT
        m.id,
        m.usuario_id
          AS "usuarioId",
        m.sala_id
          AS "salaId",
        m.telefono,
        m.estado,

        u.nombre,
        u.apellidos,
        u.correo,

        TO_CHAR(
          m.fecha_creacion,
          'YYYY-MM-DD'
        ) AS fecha,

        (
          SELECT COUNT(*)::INTEGER
          FROM asignaciones a
          WHERE
            a.mesero_id = m.id
        ) AS "eventosParticipados"

      FROM meseros m

      INNER JOIN usuarios u
        ON u.id = m.usuario_id

      WHERE m.id = $1
      `,
      [meseroId]
    )

  const mesero =
    resultado.rows[0]

  if (!mesero) {
    return null
  }

  return {
    ...mesero,
    disponibilidad:
      'Disponible'
  }
}

async function obtenerEvento(
  eventoId,
  cliente = pool
) {
  const resultado =
    await cliente.query(
      `
      SELECT
        e.id,

        e.sala_id
          AS "salaId",

        e.nombre,
        e.tipo,

        TO_CHAR(
          e.fecha,
          'YYYY-MM-DD'
        ) AS fecha,

        TO_CHAR(
          e.hora_inicio,
          'HH24:MI'
        ) AS "horaInicio",

        TO_CHAR(
          e.hora_fin,
          'HH24:MI'
        ) AS "horaFin",

        CONCAT(
          TO_CHAR(
            e.hora_inicio,
            'HH24:MI'
          ),
          ' - ',
          TO_CHAR(
            e.hora_fin,
            'HH24:MI'
          )
        ) AS horario,

        e.lugar,
        e.ubicacion,
        e.invitados,

        e.meseros_requeridos
          AS "meserosRequeridos",

        e.uniforme,
        e.observaciones,
        e.estado

      FROM eventos e

      WHERE e.id = $1
      `,
      [eventoId]
    )

  return resultado.rows[0] ?? null
}


/* =========================================================
   VALIDACIÓN DE CONFLICTOS
========================================================= */

async function buscarConflictoMesero({
  meseroId,
  eventoNuevo,
  excluirEventoId = null,
  cliente = pool
}) {
  const parametros =
    [meseroId]

  let exclusion = ''

  if (excluirEventoId) {
    parametros.push(
      excluirEventoId
    )

    exclusion =
      `AND e.id <> $2`
  }

  const resultado =
    await cliente.query(
      `
      SELECT
        e.id,
        e.nombre,

        TO_CHAR(
          e.fecha,
          'YYYY-MM-DD'
        ) AS fecha,

        TO_CHAR(
          e.hora_inicio,
          'HH24:MI'
        ) AS "horaInicio",

        TO_CHAR(
          e.hora_fin,
          'HH24:MI'
        ) AS "horaFin",

        e.lugar,
        e.ubicacion

      FROM asignaciones a

      INNER JOIN eventos e
        ON e.id =
           a.evento_id

      WHERE
        a.mesero_id = $1

        ${exclusion}
      `,
      parametros
    )

  for (
    const eventoExistente
    of resultado.rows
  ) {
    if (
      eventosSeTraslapan(
        eventoNuevo,
        eventoExistente
      )
    ) {
      return eventoExistente
    }
  }

  return null
}


/* =========================================================
   DATOS DEMO INICIALES

   Se conservan para que puedas seguir
   entrando a la aplicación mientras
   migramos.
========================================================= */

async function inicializarDatosDemo() {
  const resultado =
    await pool.query(
      `
      SELECT COUNT(*)::INTEGER
        AS total
      FROM usuarios
      `
    )

  if (
    resultado.rows[0].total > 0
  ) {
    return
  }

  const cliente =
    await pool.connect()

  try {
    await cliente.query('BEGIN')

    const admin =
      await cliente.query(
        `
        INSERT INTO usuarios (
          nombre,
          apellidos,
          correo,
          password,
          rol,
          estado
        )
        VALUES (
          'Administrador',
          'MesereArte',
          'admin@meserearte.com',
          '123456',
          'Administrador',
          'Activo'
        )
        RETURNING id
        `
      )

    const adminId =
      admin.rows[0].id

    const sala =
      await cliente.query(
        `
        INSERT INTO salas (
          nombre,
          descripcion,
          codigo,
          administrador_id,
          estado
        )
        VALUES (
          'Sala Principal',
          'Sala inicial de MesereArte',
          'MESA2026',
          $1,
          'Activa'
        )
        RETURNING id
        `,
        [adminId]
      )

    const salaId =
      sala.rows[0].id

    const usuarioMesero =
      await cliente.query(
        `
        INSERT INTO usuarios (
          nombre,
          apellidos,
          correo,
          password,
          rol,
          estado
        )
        VALUES (
          'María',
          'López',
          'maria@meserearte.com',
          '123456',
          'Mesero',
          'Activo'
        )
        RETURNING id
        `
      )

    await cliente.query(
      `
      INSERT INTO meseros (
        usuario_id,
        sala_id,
        telefono,
        estado
      )
      VALUES (
        $1,
        $2,
        '5512345678',
        'Activo'
      )
      `,
      [
        usuarioMesero.rows[0].id,
        salaId
      ]
    )

    await cliente.query(
      'COMMIT'
    )

    console.log(
      'Datos demo creados.'
    )

  } catch (error) {
    await cliente.query(
      'ROLLBACK'
    )

    throw error

  } finally {
    cliente.release()
  }
}


/* =========================================================
   HEALTH
========================================================= */

app.get(
  '/api/health',
  async (
    req,
    res
  ) => {
    try {
      await pool.query(
        'SELECT 1'
      )

      res.json({
        ok: true,
        mensaje:
          'API de MesereArte funcionando',
        baseDatos:
          'PostgreSQL'
      })

    } catch (error) {
      res.status(500).json({
        ok: false,
        mensaje:
          'No se pudo conectar a PostgreSQL'
      })
    }
  }
)


/* =========================================================
   AUTENTICACIÓN
========================================================= */

app.post(
  '/api/auth/login',
  async (
    req,
    res
  ) => {
    try {
      const correo =
        normalizarCorreo(
          req.body.correo
        )

      const password =
        String(
          req.body.password ?? ''
        )

      const rolSolicitado =
        req.body.rol

      const resultado =
        await pool.query(
          `
          SELECT
            u.id,
            u.nombre,
            u.apellidos,
            u.correo,
            u.rol,
            u.estado,

            m.id
              AS "meseroId",

            m.sala_id
              AS "salaId"

          FROM usuarios u

          LEFT JOIN meseros m
            ON m.usuario_id =
               u.id

          WHERE
            LOWER(u.correo) =
              LOWER($1)

            AND u.password =
              $2

          LIMIT 1
          `,
          [
            correo,
            password
          ]
        )

      const usuario =
        resultado.rows[0]

      if (!usuario) {
        return res
          .status(401)
          .json({
            ok: false,
            mensaje:
              'Correo o contraseña incorrectos.'
          })
      }

      if (
        usuario.estado !==
        'Activo'
      ) {
        return res
          .status(403)
          .json({
            ok: false,
            mensaje:
              'La cuenta se encuentra inactiva.'
          })
      }

      if (
        rolSolicitado &&
        rolSolicitado !==
          usuario.rol
      ) {
        return res
          .status(403)
          .json({
            ok: false,
            mensaje:
              'El rol seleccionado no corresponde a esta cuenta.'
          })
      }

      res.json({
        ok: true,
        usuario,

        /*
          Se incluyen también
          las propiedades arriba
          por compatibilidad.
        */
        ...usuario
      })

    } catch (error) {
      console.error(
        'Error login:',
        error
      )

      res
        .status(500)
        .json({
          ok: false,
          mensaje:
            'Error al iniciar sesión.'
        })
    }
  }
)


/* =========================================================
   REGISTRO ADMINISTRADOR
========================================================= */

app.post(
  '/api/auth/registro-admin',
  async (
    req,
    res
  ) => {
    const cliente =
      await pool.connect()

    try {
      const {
        nombre,
        apellidos,
        password
      } =
        req.body

      const correo =
        normalizarCorreo(
          req.body.correo
        )

      const nombreSala =
        req.body.nombreSala ??
        req.body.salaNombre ??
        'Mi sala'

      if (
        !nombre ||
        !apellidos ||
        !correo ||
        !password ||
        !nombreSala
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensaje:
              'Completa todos los campos obligatorios.'
          })
      }

      await cliente.query(
        'BEGIN'
      )

      const existe =
        await cliente.query(
          `
          SELECT id
          FROM usuarios
          WHERE
            LOWER(correo) =
            LOWER($1)
          `,
          [correo]
        )

      if (
        existe.rowCount > 0
      ) {
        await cliente.query(
          'ROLLBACK'
        )

        return res
          .status(409)
          .json({
            ok: false,
            mensaje:
              'Ya existe una cuenta con ese correo.'
          })
      }

      const usuarioResultado =
        await cliente.query(
          `
          INSERT INTO usuarios (
            nombre,
            apellidos,
            correo,
            password,
            rol,
            estado
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'Administrador',
            'Activo'
          )

          RETURNING
            id,
            nombre,
            apellidos,
            correo,
            rol,
            estado
          `,
          [
            nombre.trim(),
            apellidos.trim(),
            correo,
            String(password)
          ]
        )

      let codigo =
        generarCodigoSala()

      while (true) {
        const codigoExiste =
          await cliente.query(
            `
            SELECT id
            FROM salas
            WHERE codigo = $1
            `,
            [codigo]
          )

        if (
          codigoExiste.rowCount ===
          0
        ) {
          break
        }

        codigo =
          generarCodigoSala()
      }

      const salaResultado =
        await cliente.query(
          `
          INSERT INTO salas (
            nombre,
            descripcion,
            codigo,
            administrador_id,
            estado
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'Activa'
          )

          RETURNING
            id,
            nombre,
            descripcion,
            codigo,
            administrador_id
              AS "administradorId",
            estado
          `,
          [
            nombreSala.trim(),
            req.body.descripcion ??
              '',
            codigo,
            usuarioResultado
              .rows[0]
              .id
          ]
        )

      await cliente.query(
        'COMMIT'
      )

      res
        .status(201)
        .json({
          ok: true,
          usuario:
            usuarioResultado.rows[0],
          sala:
            salaResultado.rows[0]
        })

    } catch (error) {
      await cliente.query(
        'ROLLBACK'
      )

      console.error(
        'Error registro admin:',
        error
      )

      res
        .status(500)
        .json({
          ok: false,
          mensaje:
            'No fue posible crear la cuenta.'
        })

    } finally {
      cliente.release()
    }
  }
)


/* =========================================================
   REGISTRO MESERO
========================================================= */

app.post(
  '/api/auth/registro-mesero',
  async (
    req,
    res
  ) => {
    const cliente =
      await pool.connect()

    try {
      const {
        nombre,
        apellidos,
        telefono,
        password
      } =
        req.body

      const correo =
        normalizarCorreo(
          req.body.correo
        )

      const codigoSala =
        String(
          req.body.codigoSala ??
          req.body.codigo ??
          ''
        )
          .trim()
          .toUpperCase()

      if (
        !nombre ||
        !apellidos ||
        !correo ||
        !password ||
        !codigoSala
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensaje:
              'Completa todos los campos obligatorios.'
          })
      }

      await cliente.query(
        'BEGIN'
      )

      const salaResultado =
        await cliente.query(
          `
          SELECT
            id,
            nombre,
            codigo,
            estado
          FROM salas
          WHERE
            UPPER(codigo) =
              UPPER($1)

            AND estado =
              'Activa'
          LIMIT 1
          `,
          [codigoSala]
        )

      const sala =
        salaResultado.rows[0]

      if (!sala) {
        await cliente.query(
          'ROLLBACK'
        )

        return res
          .status(404)
          .json({
            ok: false,
            mensaje:
              'El código de sala no es válido o la sala está inactiva.'
          })
      }

      const existe =
        await cliente.query(
          `
          SELECT id
          FROM usuarios
          WHERE
            LOWER(correo) =
              LOWER($1)
          `,
          [correo]
        )

      if (
        existe.rowCount > 0
      ) {
        await cliente.query(
          'ROLLBACK'
        )

        return res
          .status(409)
          .json({
            ok: false,
            mensaje:
              'Ya existe una cuenta con ese correo.'
          })
      }

      const usuarioResultado =
        await cliente.query(
          `
          INSERT INTO usuarios (
            nombre,
            apellidos,
            correo,
            password,
            rol,
            estado
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'Mesero',
            'Activo'
          )

          RETURNING
            id,
            nombre,
            apellidos,
            correo,
            rol,
            estado
          `,
          [
            nombre.trim(),
            apellidos.trim(),
            correo,
            String(password)
          ]
        )

      const meseroResultado =
        await cliente.query(
          `
          INSERT INTO meseros (
            usuario_id,
            sala_id,
            telefono,
            estado
          )
          VALUES (
            $1,
            $2,
            $3,
            'Activo'
          )

          RETURNING
            id,
            usuario_id
              AS "usuarioId",
            sala_id
              AS "salaId",
            telefono,
            estado
          `,
          [
            usuarioResultado
              .rows[0]
              .id,

            sala.id,

            telefono ??
              ''
          ]
        )

      await cliente.query(
        'COMMIT'
      )

      res
        .status(201)
        .json({
          ok: true,

          usuario: {
            ...usuarioResultado.rows[0],
            meseroId:
              meseroResultado
                .rows[0]
                .id,
            salaId:
              sala.id
          },

          mesero:
            meseroResultado.rows[0],

          sala
        })

    } catch (error) {
      await cliente.query(
        'ROLLBACK'
      )

      console.error(
        'Error registro mesero:',
        error
      )

      res
        .status(500)
        .json({
          ok: false,
          mensaje:
            'No fue posible registrar al mesero.'
        })

    } finally {
      cliente.release()
    }
  }
)


/* =========================================================
   SALAS
========================================================= */

app.get(
  '/api/salas',
  async (
    req,
    res
  ) => {
    try {
      const resultado =
        await pool.query(
          `
          SELECT
            s.id,
            s.nombre,
            s.descripcion,
            s.codigo,

            s.administrador_id
              AS "administradorId",

            s.estado,

            TO_CHAR(
              s.fecha_creacion,
              'YYYY-MM-DD'
            ) AS fecha,

            (
              SELECT COUNT(*)::INTEGER
              FROM meseros m
              WHERE
                m.sala_id = s.id
                AND
                m.estado =
                  'Activo'
            ) AS "meserosActivos"

          FROM salas s

          ORDER BY
            s.id
          `
        )

      res.json(
        resultado.rows
      )

    } catch (error) {
      console.error(
        'Error salas:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar las salas.'
        })
    }
  }
)


app.post(
  '/api/salas',
  async (
    req,
    res
  ) => {
    try {
      const {
        nombre,
        descripcion = ''
      } =
        req.body

      if (!nombre?.trim()) {
        return res
          .status(400)
          .json({
            mensaje:
              'El nombre de la sala es obligatorio.'
          })
      }

      let administradorId =
        numero(
          req.body.administradorId
        )

      if (!administradorId) {
        const admin =
          await pool.query(
            `
            SELECT id
            FROM usuarios
            WHERE
              rol =
                'Administrador'
              AND
              estado =
                'Activo'
            ORDER BY id
            LIMIT 1
            `
          )

        administradorId =
          admin.rows[0]?.id
      }

      if (!administradorId) {
        return res
          .status(400)
          .json({
            mensaje:
              'No existe un administrador activo.'
          })
      }

      let codigo =
        generarCodigoSala()

      while (true) {
        const existe =
          await pool.query(
            `
            SELECT id
            FROM salas
            WHERE codigo = $1
            `,
            [codigo]
          )

        if (
          existe.rowCount === 0
        ) {
          break
        }

        codigo =
          generarCodigoSala()
      }

      const resultado =
        await pool.query(
          `
          INSERT INTO salas (
            nombre,
            descripcion,
            codigo,
            administrador_id,
            estado
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'Activa'
          )

          RETURNING
            id,
            nombre,
            descripcion,
            codigo,

            administrador_id
              AS "administradorId",

            estado,

            TO_CHAR(
              fecha_creacion,
              'YYYY-MM-DD'
            ) AS fecha
          `,
          [
            nombre.trim(),
            descripcion,
            codigo,
            administradorId
          ]
        )

      res
        .status(201)
        .json(
          resultado.rows[0]
        )

    } catch (error) {
      console.error(
        'Error crear sala:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible crear la sala.'
        })
    }
  }
)


app.put(
  '/api/salas/:id',
  async (
    req,
    res
  ) => {
    try {
      const salaId =
        numero(req.params.id)

      const resultado =
        await pool.query(
          `
          UPDATE salas
          SET
            nombre =
              COALESCE(
                $1,
                nombre
              ),

            descripcion =
              COALESCE(
                $2,
                descripcion
              ),

            estado =
              COALESCE(
                $3,
                estado
              )

          WHERE id = $4

          RETURNING
            id,
            nombre,
            descripcion,
            codigo,

            administrador_id
              AS "administradorId",

            estado,

            TO_CHAR(
              fecha_creacion,
              'YYYY-MM-DD'
            ) AS fecha
          `,
          [
            req.body.nombre ??
              null,

            req.body.descripcion ??
              null,

            req.body.estado ??
              null,

            salaId
          ]
        )

      if (
        resultado.rowCount === 0
      ) {
        return res
          .status(404)
          .json({
            mensaje:
              'Sala no encontrada.'
          })
      }

      res.json(
        resultado.rows[0]
      )

    } catch (error) {
      console.error(
        'Error actualizar sala:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible actualizar la sala.'
        })
    }
  }
)


app.delete(
  '/api/salas/:id',
  async (
    req,
    res
  ) => {
    try {
      const resultado =
        await pool.query(
          `
          DELETE FROM salas
          WHERE id = $1
          RETURNING id
          `,
          [
            numero(
              req.params.id
            )
          ]
        )

      if (
        resultado.rowCount === 0
      ) {
        return res
          .status(404)
          .json({
            mensaje:
              'Sala no encontrada.'
          })
      }

      res.json({
        ok: true
      })

    } catch (error) {
      console.error(
        'Error eliminar sala:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible eliminar la sala.'
        })
    }
  }
)


/* =========================================================
   MESEROS / USUARIOS
========================================================= */

app.get(
  '/api/meseros',
  async (
    req,
    res
  ) => {
    try {
      const resultado =
        await pool.query(
          `
          SELECT
            m.id,

            m.usuario_id
              AS "usuarioId",

            m.sala_id
              AS "salaId",

            m.telefono,
            m.estado,

            u.nombre,
            u.apellidos,
            u.correo,

            TO_CHAR(
              m.fecha_creacion,
              'YYYY-MM-DD'
            ) AS fecha,

            (
              SELECT COUNT(*)::INTEGER
              FROM asignaciones a
              WHERE
                a.mesero_id =
                  m.id
            ) AS "eventosParticipados"

          FROM meseros m

          INNER JOIN usuarios u
            ON u.id =
               m.usuario_id

          ORDER BY
            u.nombre,
            u.apellidos
          `
        )

      res.json(
        resultado.rows.map(
          (mesero) => ({
            ...mesero,
            disponibilidad:
              'Disponible'
          })
        )
      )

    } catch (error) {
      console.error(
        'Error meseros:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar los meseros.'
        })
    }
  }
)


app.post(
  '/api/meseros',
  async (
    req,
    res
  ) => {
    const cliente =
      await pool.connect()

    try {
      const {
        nombre,
        apellidos,
        telefono = '',
        estado = 'Activo'
      } =
        req.body

      const correo =
        normalizarCorreo(
          req.body.correo
        )

      const salaId =
        numero(
          req.body.salaId
        )

      if (
        !nombre ||
        !apellidos ||
        !correo ||
        !salaId
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'Nombre, apellidos, correo y sala son obligatorios.'
          })
      }

      const sala =
        await obtenerSala(
          salaId,
          cliente
        )

      if (!sala) {
        return res
          .status(404)
          .json({
            mensaje:
              'La sala seleccionada no existe.'
          })
      }

      await cliente.query(
        'BEGIN'
      )

      /*
        Mientras terminamos seguridad,
        conserva el comportamiento
        actual sin bcrypt.

        Si AdminUsuarios no envía
        contraseña se crea una temporal.
      */

      const password =
        String(
          req.body.password ??
          '123456'
        )

      const usuario =
        await cliente.query(
          `
          INSERT INTO usuarios (
            nombre,
            apellidos,
            correo,
            password,
            rol,
            estado
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'Mesero',
            $5
          )
          RETURNING id
          `,
          [
            nombre.trim(),
            apellidos.trim(),
            correo,
            password,
            estado
          ]
        )

      const mesero =
        await cliente.query(
          `
          INSERT INTO meseros (
            usuario_id,
            sala_id,
            telefono,
            estado
          )
          VALUES (
            $1,
            $2,
            $3,
            $4
          )
          RETURNING id
          `,
          [
            usuario.rows[0].id,
            salaId,
            telefono,
            estado
          ]
        )

      await cliente.query(
        'COMMIT'
      )

      const creado =
        await obtenerMesero(
          mesero.rows[0].id
        )

      res
        .status(201)
        .json(creado)

    } catch (error) {
      await cliente.query(
        'ROLLBACK'
      )

      console.error(
        'Error crear mesero:',
        error
      )

      if (
        error.code ===
        '23505'
      ) {
        return res
          .status(409)
          .json({
            mensaje:
              'Ya existe un usuario con ese correo.'
          })
      }

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible crear al mesero.'
        })

    } finally {
      cliente.release()
    }
  }
)


app.put(
  '/api/meseros/:id',
  async (
    req,
    res
  ) => {
    const cliente =
      await pool.connect()

    try {
      const meseroId =
        numero(req.params.id)

      const actual =
        await obtenerMesero(
          meseroId,
          cliente
        )

      if (!actual) {
        return res
          .status(404)
          .json({
            mensaje:
              'Mesero no encontrado.'
          })
      }

      const salaId =
        numero(
          req.body.salaId ??
          actual.salaId
        )

      const sala =
        await obtenerSala(
          salaId,
          cliente
        )

      if (!sala) {
        return res
          .status(404)
          .json({
            mensaje:
              'La sala seleccionada no existe.'
          })
      }

      await cliente.query(
        'BEGIN'
      )

      await cliente.query(
        `
        UPDATE usuarios
        SET
          nombre = $1,
          apellidos = $2,
          correo = $3,
          estado = $4

        WHERE id = $5
        `,
        [
          req.body.nombre ??
            actual.nombre,

          req.body.apellidos ??
            actual.apellidos,

          normalizarCorreo(
            req.body.correo ??
            actual.correo
          ),

          req.body.estado ??
            actual.estado,

          actual.usuarioId
        ]
      )

      await cliente.query(
        `
        UPDATE meseros
        SET
          sala_id = $1,
          telefono = $2,
          estado = $3

        WHERE id = $4
        `,
        [
          salaId,

          req.body.telefono ??
            actual.telefono,

          req.body.estado ??
            actual.estado,

          meseroId
        ]
      )

      await cliente.query(
        'COMMIT'
      )

      res.json(
        await obtenerMesero(
          meseroId
        )
      )

    } catch (error) {
      await cliente.query(
        'ROLLBACK'
      )

      console.error(
        'Error actualizar mesero:',
        error
      )

      if (
        error.code ===
        '23505'
      ) {
        return res
          .status(409)
          .json({
            mensaje:
              'Ese correo ya está registrado.'
          })
      }

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible actualizar al mesero.'
        })

    } finally {
      cliente.release()
    }
  }
)


app.delete(
  '/api/meseros/:id',
  async (
    req,
    res
  ) => {
    const cliente =
      await pool.connect()

    try {
      const meseroId =
        numero(req.params.id)

      const mesero =
        await obtenerMesero(
          meseroId,
          cliente
        )

      if (!mesero) {
        return res
          .status(404)
          .json({
            mensaje:
              'Mesero no encontrado.'
          })
      }

      await cliente.query(
        'BEGIN'
      )

      await cliente.query(
        `
        DELETE FROM meseros
        WHERE id = $1
        `,
        [meseroId]
      )

      await cliente.query(
        `
        DELETE FROM usuarios
        WHERE id = $1
        `,
        [mesero.usuarioId]
      )

      await cliente.query(
        'COMMIT'
      )

      res.json({
        ok: true
      })

    } catch (error) {
      await cliente.query(
        'ROLLBACK'
      )

      console.error(
        'Error eliminar mesero:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible eliminar al mesero.'
        })

    } finally {
      cliente.release()
    }
  }
)


/* =========================================================
   EVENTOS
========================================================= */

app.get(
  '/api/eventos',
  async (
    req,
    res
  ) => {
    try {
      const resultado =
        await pool.query(
          `
          SELECT
            e.id,

            e.sala_id
              AS "salaId",

            e.nombre,
            e.tipo,

            TO_CHAR(
              e.fecha,
              'YYYY-MM-DD'
            ) AS fecha,

            TO_CHAR(
              e.hora_inicio,
              'HH24:MI'
            ) AS "horaInicio",

            TO_CHAR(
              e.hora_fin,
              'HH24:MI'
            ) AS "horaFin",

            CONCAT(
              TO_CHAR(
                e.hora_inicio,
                'HH24:MI'
              ),
              ' - ',
              TO_CHAR(
                e.hora_fin,
                'HH24:MI'
              )
            ) AS horario,

            e.lugar,
            e.ubicacion,
            e.invitados,

            e.meseros_requeridos
              AS "meserosRequeridos",

            e.uniforme,
            e.observaciones,
            e.estado

          FROM eventos e

          ORDER BY
            e.fecha,
            e.hora_inicio
          `
        )

      res.json(
        resultado.rows
      )

    } catch (error) {
      console.error(
        'Error eventos:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar los eventos.'
        })
    }
  }
)


app.post(
  '/api/eventos',
  async (
    req,
    res
  ) => {
    try {
      const salaId =
        numero(
          req.body.salaId
        )

      const nombre =
        req.body.nombre?.trim()

      const tipo =
        req.body.tipo ??
        'Otro'

      const fecha =
        fechaTexto(
          req.body.fecha
        )

      const horaInicio =
        horaTexto(
          req.body.horaInicio
        )

      const horaFin =
        horaTexto(
          req.body.horaFin
        )

      const lugar =
        req.body.lugar
          ?.trim()

      const ubicacion =
        req.body.ubicacion
          ?.trim()

      if (
        !salaId ||
        !nombre ||
        !fecha ||
        !horaInicio ||
        !horaFin ||
        !lugar ||
        !ubicacion
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'Completa los datos obligatorios del evento.'
          })
      }

      if (!esEnlaceGoogleMaps(ubicacion)) {
        return res
          .status(400)
          .json({
            mensaje:
              'La ubicación debe ser un enlace válido de Google Maps.'
          })
      }

      if (
        horaInicio ===
        horaFin
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'La hora de inicio y término no pueden ser iguales.'
          })
      }

      const mismoLugar =
        await pool.query(
          `
          SELECT id
          FROM eventos

          WHERE
            fecha = $1

            AND
            LOWER(
              TRIM(lugar)
            ) =
            LOWER(
              TRIM($2)
            )

          LIMIT 1
          `,
          [
            fecha,
            lugar
          ]
        )

      if (
        mismoLugar.rowCount > 0
      ) {
        return res
          .status(409)
          .json({
            mensaje:
              'Ya existe un evento en ese lugar para la fecha seleccionada.'
          })
      }

      const resultado =
        await pool.query(
          `
          INSERT INTO eventos (
            sala_id,
            nombre,
            tipo,
            fecha,
            hora_inicio,
            hora_fin,
            lugar,
            ubicacion,
            invitados,
            meseros_requeridos,
            uniforme,
            observaciones,
            estado
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13
          )
          RETURNING id
          `,
          [
            salaId,
            nombre,
            tipo,
            fecha,
            horaInicio,
            horaFin,
            lugar,
            ubicacion,

            Number(
              req.body.invitados ??
              0
            ),

            Number(
              req.body.meserosRequeridos ??
              0
            ),

            req.body.uniforme ??
              '',

            req.body.observaciones ??
              '',

            req.body.estado ??
              'Pendiente'
          ]
        )

      res
        .status(201)
        .json(
          await obtenerEvento(
            resultado.rows[0].id
          )
        )

    } catch (error) {
      console.error(
        'Error crear evento:',
        error
      )

      if (
        error.code ===
        '23505'
      ) {
        return res
          .status(409)
          .json({
            mensaje:
              'Ya existe un evento en ese lugar para esa fecha.'
          })
      }

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible crear el evento.'
        })
    }
  }
)


app.put(
  '/api/eventos/:id',
  async (
    req,
    res
  ) => {
    const cliente =
      await pool.connect()

    try {
      const eventoId =
        numero(req.params.id)

      const actual =
        await obtenerEvento(
          eventoId,
          cliente
        )

      if (!actual) {
        return res
          .status(404)
          .json({
            mensaje:
              'Evento no encontrado.'
          })
      }

      const propuesto = {
        salaId:
          numero(
            req.body.salaId ??
            actual.salaId
          ),

        nombre:
          req.body.nombre ??
          actual.nombre,

        tipo:
          req.body.tipo ??
          actual.tipo,

        fecha:
          fechaTexto(
            req.body.fecha ??
            actual.fecha
          ),

        horaInicio:
          horaTexto(
            req.body.horaInicio ??
            actual.horaInicio
          ),

        horaFin:
          horaTexto(
            req.body.horaFin ??
            actual.horaFin
          ),

        lugar:
          req.body.lugar ??
          actual.lugar,

        ubicacion:
          req.body.ubicacion ??
          actual.ubicacion,

        invitados:
          Number(
            req.body.invitados ??
            actual.invitados ??
            0
          ),

        meserosRequeridos:
          Number(
            req.body.meserosRequeridos ??
            actual.meserosRequeridos ??
            0
          ),

        uniforme:
          req.body.uniforme ??
          actual.uniforme,

        observaciones:
          req.body.observaciones ??
          actual.observaciones,

        estado:
          req.body.estado ??
          actual.estado
      }

      if (
        !String(propuesto.lugar ?? '').trim() ||
        !String(propuesto.ubicacion ?? '').trim()
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'Lugar y ubicación son obligatorios.'
          })
      }

      if (!esEnlaceGoogleMaps(propuesto.ubicacion)) {
        return res
          .status(400)
          .json({
            mensaje:
              'La ubicación debe ser un enlace válido de Google Maps.'
          })
      }

      if (
        propuesto.horaInicio ===
        propuesto.horaFin
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'La hora de inicio y término no pueden ser iguales.'
          })
      }

      const mismoLugar =
        await cliente.query(
          `
          SELECT id
          FROM eventos

          WHERE
            fecha = $1

            AND
            LOWER(
              TRIM(lugar)
            ) =
            LOWER(
              TRIM($2)
            )

            AND id <> $3

          LIMIT 1
          `,
          [
            propuesto.fecha,
            propuesto.lugar,
            eventoId
          ]
        )

      if (
        mismoLugar.rowCount > 0
      ) {
        return res
          .status(409)
          .json({
            mensaje:
              'Ya existe otro evento en ese lugar para la fecha seleccionada.'
          })
      }

      const asignados =
        await cliente.query(
          `
          SELECT mesero_id
            AS "meseroId"
          FROM asignaciones
          WHERE evento_id = $1
          `,
          [eventoId]
        )

      for (
        const asignacion
        of asignados.rows
      ) {
        const conflicto =
          await buscarConflictoMesero({
            meseroId:
              asignacion.meseroId,

            eventoNuevo:
              propuesto,

            excluirEventoId:
              eventoId,

            cliente
          })

        if (conflicto) {
          return res
            .status(409)
            .json({
              mensaje:
                `El cambio genera un conflicto con "${conflicto.nombre}".`
            })
        }
      }

      await cliente.query(
        `
        UPDATE eventos
        SET
          sala_id = $1,
          nombre = $2,
          tipo = $3,
          fecha = $4,
          hora_inicio = $5,
          hora_fin = $6,
          lugar = $7,
          ubicacion = $8,
          invitados = $9,
          meseros_requeridos = $10,
          uniforme = $11,
          observaciones = $12,
          estado = $13

        WHERE id = $14
        `,
        [
          propuesto.salaId,
          propuesto.nombre,
          propuesto.tipo,
          propuesto.fecha,
          propuesto.horaInicio,
          propuesto.horaFin,
          propuesto.lugar,
          propuesto.ubicacion,
          propuesto.invitados,
          propuesto.meserosRequeridos,
          propuesto.uniforme,
          propuesto.observaciones,
          propuesto.estado,
          eventoId
        ]
      )

      res.json(
        await obtenerEvento(
          eventoId
        )
      )

    } catch (error) {
      console.error(
        'Error actualizar evento:',
        error
      )

      if (
        error.code ===
        '23505'
      ) {
        return res
          .status(409)
          .json({
            mensaje:
              'Ya existe un evento en ese lugar para esa fecha.'
          })
      }

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible actualizar el evento.'
        })

    } finally {
      cliente.release()
    }
  }
)


app.delete(
  '/api/eventos/:id',
  async (
    req,
    res
  ) => {
    try {
      const resultado =
        await pool.query(
          `
          DELETE FROM eventos
          WHERE id = $1
          RETURNING id
          `,
          [
            numero(
              req.params.id
            )
          ]
        )

      if (
        resultado.rowCount === 0
      ) {
        return res
          .status(404)
          .json({
            mensaje:
              'Evento no encontrado.'
          })
      }

      res.json({
        ok: true
      })

    } catch (error) {
      console.error(
        'Error eliminar evento:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible eliminar el evento.'
        })
    }
  }
)


/* =========================================================
   ASIGNACIONES
========================================================= */

app.get(
  '/api/asignaciones',
  async (
    req,
    res
  ) => {
    try {
      const resultado =
        await pool.query(
          `
          SELECT
            id,

            evento_id
              AS "eventoId",

            mesero_id
              AS "meseroId",

            rol

          FROM asignaciones

          ORDER BY
            evento_id,
            id
          `
        )

      res.json(
        resultado.rows
      )

    } catch (error) {
      console.error(
        'Error asignaciones:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar las asignaciones.'
        })
    }
  }
)


app.put(
  '/api/asignaciones/evento/:eventoId',
  async (
    req,
    res
  ) => {
    const cliente =
      await pool.connect()

    try {
      const eventoId =
        numero(
          req.params.eventoId
        )

      const evento =
        await obtenerEvento(
          eventoId,
          cliente
        )

      if (!evento) {
        return res
          .status(404)
          .json({
            mensaje:
              'Evento no encontrado.'
          })
      }

      const meseroIds =
        Array.from(
          new Set(
            (
              req.body.meseroIds ??
              []
            )
              .map(Number)
              .filter(
                Number.isFinite
              )
          )
        )

      const capitanId =
        req.body.capitanId
          ? Number(
              req.body.capitanId
            )
          : null

      if (
        capitanId &&
        !meseroIds.includes(
          capitanId
        )
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'El capitán debe formar parte de los meseros asignados.'
          })
      }

      for (
        const meseroId
        of meseroIds
      ) {
        const mesero =
          await obtenerMesero(
            meseroId,
            cliente
          )

        if (!mesero) {
          return res
            .status(404)
            .json({
              mensaje:
                `No existe el mesero ${meseroId}.`
            })
        }

        if (
          mesero.estado !==
          'Activo'
        ) {
          return res
            .status(400)
            .json({
              mensaje:
                `${mesero.nombre} ${mesero.apellidos} no está activo.`
            })
        }

        if (
          Number(
            mesero.salaId
          ) !==
          Number(
            evento.salaId
          )
        ) {
          return res
            .status(400)
            .json({
              mensaje:
                `${mesero.nombre} ${mesero.apellidos} no pertenece a la sala del evento.`
            })
        }

        const conflicto =
          await buscarConflictoMesero({
            meseroId,
            eventoNuevo:
              evento,
            excluirEventoId:
              eventoId,
            cliente
          })

        if (conflicto) {
          return res
            .status(409)
            .json({
              mensaje:
                `${mesero.nombre} ${mesero.apellidos} ya está asignado a "${conflicto.nombre}" en un horario que se traslapa.`
            })
        }
      }

      if (capitanId) {
        const disponibilidad =
          await cliente.query(
            `
            SELECT estado
            FROM disponibilidades

            WHERE
              evento_id = $1

              AND
              mesero_id = $2
            `,
            [
              eventoId,
              capitanId
            ]
          )

        if (
          disponibilidad.rows[0]
            ?.estado ===
          'No disponible'
        ) {
          return res
            .status(400)
            .json({
              mensaje:
                'Un mesero que indicó No disponible no puede ser capitán.'
            })
        }
      }

      await cliente.query(
        'BEGIN'
      )

      const anteriores =
        await cliente.query(
          `
          SELECT mesero_id
            AS "meseroId"
          FROM asignaciones
          WHERE evento_id = $1
          `,
          [eventoId]
        )

      const anterioresIds =
        anteriores.rows.map(
          (fila) =>
            Number(
              fila.meseroId
            )
        )

      const eliminados =
        anterioresIds.filter(
          (id) =>
            !meseroIds.includes(id)
        )

      /*
        Primero quitamos el rol capitán
        para no chocar con el índice
        único al cambiar de capitán.
      */

      await cliente.query(
        `
        UPDATE asignaciones
        SET rol = 'Mesero'
        WHERE evento_id = $1
        `,
        [eventoId]
      )

      if (
        eliminados.length > 0
      ) {
        await cliente.query(
          `
          DELETE FROM asignaciones

          WHERE
            evento_id = $1

            AND
            mesero_id =
              ANY($2::int[])
          `,
          [
            eventoId,
            eliminados
          ]
        )

        await cliente.query(
          `
          DELETE FROM disponibilidades

          WHERE
            evento_id = $1

            AND
            mesero_id =
              ANY($2::int[])
          `,
          [
            eventoId,
            eliminados
          ]
        )
      }

      for (
        const meseroId
        of meseroIds
      ) {
        await cliente.query(
          `
          INSERT INTO asignaciones (
            evento_id,
            mesero_id,
            rol
          )
          VALUES (
            $1,
            $2,
            'Mesero'
          )

          ON CONFLICT (
            evento_id,
            mesero_id
          )

          DO UPDATE SET
            rol = 'Mesero'
          `,
          [
            eventoId,
            meseroId
          ]
        )

        await cliente.query(
          `
          INSERT INTO disponibilidades (
            evento_id,
            mesero_id,
            estado
          )
          VALUES (
            $1,
            $2,
            'Pendiente'
          )

          ON CONFLICT (
            evento_id,
            mesero_id
          )

          DO NOTHING
          `,
          [
            eventoId,
            meseroId
          ]
        )
      }

      if (capitanId) {
        await cliente.query(
          `
          UPDATE asignaciones
          SET rol = 'Capitán'

          WHERE
            evento_id = $1

            AND
            mesero_id = $2
          `,
          [
            eventoId,
            capitanId
          ]
        )
      }

      await cliente.query(
        'COMMIT'
      )

      const resultado =
        await pool.query(
          `
          SELECT
            id,

            evento_id
              AS "eventoId",

            mesero_id
              AS "meseroId",

            rol

          FROM asignaciones

          WHERE evento_id = $1

          ORDER BY id
          `,
          [eventoId]
        )

      res.json(
        resultado.rows
      )

    } catch (error) {
      await cliente.query(
        'ROLLBACK'
      )

      console.error(
        'Error guardar asignaciones:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible guardar las asignaciones.'
        })

    } finally {
      cliente.release()
    }
  }
)


/* =========================================================
   DISPONIBILIDADES
========================================================= */

app.get(
  '/api/disponibilidades',
  async (
    req,
    res
  ) => {
    try {
      const resultado =
        await pool.query(
          `
          SELECT
            id,

            evento_id
              AS "eventoId",

            mesero_id
              AS "meseroId",

            estado,

            fecha_respuesta
              AS "fechaRespuesta"

          FROM disponibilidades

          ORDER BY id
          `
        )

      res.json(
        resultado.rows
      )

    } catch (error) {
      console.error(
        'Error disponibilidades:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar disponibilidades.'
        })
    }
  }
)


app.put(
  '/api/disponibilidades',
  async (
    req,
    res
  ) => {
    const cliente =
      await pool.connect()

    try {
      const eventoId =
        numero(
          req.body.eventoId
        )

      const meseroId =
        numero(
          req.body.meseroId
        )

      const estado =
        req.body.estado

      if (
        ![
          'Confirmado',
          'No disponible'
        ].includes(estado)
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'Estado de disponibilidad no válido.'
          })
      }

      const asignacion =
        await cliente.query(
          `
          SELECT id
          FROM asignaciones

          WHERE
            evento_id = $1

            AND
            mesero_id = $2
          `,
          [
            eventoId,
            meseroId
          ]
        )

      if (
        asignacion.rowCount === 0
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'El mesero no está asignado a este evento.'
          })
      }

      const actual =
        await cliente.query(
          `
          SELECT
            id,
            estado

          FROM disponibilidades

          WHERE
            evento_id = $1

            AND
            mesero_id = $2
          `,
          [
            eventoId,
            meseroId
          ]
        )

      if (
        actual.rows[0] &&
        [
          'Confirmado',
          'No disponible'
        ].includes(
          actual.rows[0].estado
        )
      ) {
        if (
          actual.rows[0].estado ===
          estado
        ) {
          return res.json(
            actual.rows[0]
          )
        }

        return res
          .status(409)
          .json({
            mensaje:
              'Tu respuesta ya fue registrada y no puede modificarse.'
          })
      }

      await cliente.query(
        'BEGIN'
      )

      const resultado =
        await cliente.query(
          `
          INSERT INTO disponibilidades (
            evento_id,
            mesero_id,
            estado,
            fecha_respuesta
          )
          VALUES (
            $1,
            $2,
            $3,
            NOW()
          )

          ON CONFLICT (
            evento_id,
            mesero_id
          )

          DO UPDATE SET
            estado =
              EXCLUDED.estado,

            fecha_respuesta =
              NOW()

          RETURNING
            id,

            evento_id
              AS "eventoId",

            mesero_id
              AS "meseroId",

            estado,

            fecha_respuesta
              AS "fechaRespuesta"
          `,
          [
            eventoId,
            meseroId,
            estado
          ]
        )

      if (
        estado ===
        'No disponible'
      ) {
        const evento =
          await obtenerEvento(
            eventoId,
            cliente
          )

        const mesero =
          await obtenerMesero(
            meseroId,
            cliente
          )

        await cliente.query(
          `
          INSERT INTO notificaciones (
            tipo,
            titulo,
            mensaje,
            sala_id,
            evento_id,
            mesero_id,
            destinatario,
            modo_destinatario,
            emisor,
            automatica
          )
          VALUES (
            'Disponibilidad',
            'Mesero no disponible',
            $1,
            $2,
            $3,
            $4,
            'Administrador',
            'Administrador',
            'Sistema',
            TRUE
          )
          `,
          [
            `${mesero.nombre} ${mesero.apellidos} indicó que no está disponible para ${evento.nombre}.`,

            evento.salaId,
            eventoId,
            meseroId
          ]
        )
      }

      await cliente.query(
        'COMMIT'
      )

      res.json(
        resultado.rows[0]
      )

    } catch (error) {
      await cliente.query(
        'ROLLBACK'
      )

      console.error(
        'Error disponibilidad:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible actualizar la disponibilidad.'
        })

    } finally {
      cliente.release()
    }
  }
)


/* =========================================================
   NOTIFICACIONES
========================================================= */

async function consultarNotificaciones() {
  const resultado =
    await pool.query(
      `
      SELECT
        n.id,

        n.envio_id
          AS "envioId",

        n.tipo,
        n.titulo,
        n.mensaje,

        n.sala_id
          AS "salaId",

        n.evento_id
          AS "eventoId",

        n.mesero_id
          AS "meseroId",

        n.destinatario,

        n.destinatario_mesero_id
          AS "destinatarioMeseroId",

        n.modo_destinatario
          AS "modoDestinatario",

        n.emisor,
        n.automatica,
        n.fecha,
        n.leida

      FROM notificaciones n

      ORDER BY
        n.fecha DESC,
        n.id DESC
      `
    )

  return resultado.rows
}


app.get(
  '/api/notificaciones',
  async (
    req,
    res
  ) => {
    try {
      res.json(
        await consultarNotificaciones()
      )

    } catch (error) {
      console.error(
        'Error notificaciones:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar notificaciones.'
        })
    }
  }
)


app.get(
  '/api/notificaciones/mesero/:meseroId',
  async (
    req,
    res
  ) => {
    try {
      const resultado =
        await pool.query(
          `
          SELECT
            id,

            envio_id
              AS "envioId",

            tipo,
            titulo,
            mensaje,

            sala_id
              AS "salaId",

            evento_id
              AS "eventoId",

            destinatario,

            modo_destinatario
              AS "modoDestinatario",

            emisor,
            automatica,
            fecha,
            leida

          FROM notificaciones

          WHERE
            destinatario_mesero_id =
              $1

          ORDER BY
            fecha DESC,
            id DESC
          `,
          [
            numero(
              req.params.meseroId
            )
          ]
        )

      res.json(
        resultado.rows
      )

    } catch (error) {
      console.error(
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar las notificaciones.'
        })
    }
  }
)


async function enviarNotificacion(
  req,
  res
) {
  const cliente =
    await pool.connect()

  try {
    const {
      tipo = 'Aviso',
      titulo,
      mensaje
    } =
      req.body

    const salaId =
      numero(
        req.body.salaId
      )

    const eventoId =
      numero(
        req.body.eventoId
      )

    const meseroId =
      numero(
        req.body.meseroId ??
        req.body.destinatarioMeseroId
      )

    let modo =
      String(
        req.body.modoDestinatario ??
        req.body.destinatario ??
        ''
      )
        .trim()
        .toLowerCase()

    if (!titulo || !mensaje) {
      return res
        .status(400)
        .json({
          mensaje:
            'Título y mensaje son obligatorios.'
        })
    }

    if (!modo) {
      if (meseroId) {
        modo =
          'individual'

      } else if (eventoId) {
        modo =
          'evento'

      } else {
        modo =
          'sala'
      }
    }

    let destinatarios = []

    if (
      modo.includes(
        'individual'
      ) ||
      modo.includes(
        'mesero'
      )
    ) {
      if (meseroId) {
        destinatarios =
          [meseroId]
      }

    } else if (
      modo.includes(
        'evento'
      ) ||
      modo.includes(
        'asign'
      )
    ) {
      const resultado =
        await cliente.query(
          `
          SELECT mesero_id
            AS "meseroId"

          FROM asignaciones

          WHERE evento_id = $1
          `,
          [eventoId]
        )

      destinatarios =
        resultado.rows.map(
          (fila) =>
            Number(
              fila.meseroId
            )
        )

    } else {
      const resultado =
        await cliente.query(
          `
          SELECT id
          FROM meseros

          WHERE
            sala_id = $1
            AND
            estado =
              'Activo'
          `,
          [salaId]
        )

      destinatarios =
        resultado.rows.map(
          (fila) =>
            Number(
              fila.id
            )
        )
    }

    if (
      destinatarios.length ===
      0
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'No se encontraron destinatarios para el aviso.'
        })
    }

    const envioId =
      `ENV-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}`

    await cliente.query(
      'BEGIN'
    )

    const creadas = []

    for (
      const destinatarioId
      of destinatarios
    ) {
      const resultado =
        await cliente.query(
          `
          INSERT INTO notificaciones (
            envio_id,
            tipo,
            titulo,
            mensaje,
            sala_id,
            evento_id,
            destinatario,
            destinatario_mesero_id,
            modo_destinatario,
            emisor,
            automatica
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            'Administrador',
            FALSE
          )

          RETURNING id
          `,
          [
            envioId,
            tipo,
            titulo,
            mensaje,
            salaId,
            eventoId,

            String(
              req.body.destinatario ??
              req.body.modoDestinatario ??
              ''
            ),

            destinatarioId,

            String(
              req.body.modoDestinatario ??
              req.body.destinatario ??
              ''
            )
          ]
        )

      creadas.push(
        resultado.rows[0].id
      )
    }

    await cliente.query(
      'COMMIT'
    )

    res
      .status(201)
      .json({
        ok: true,
        envioId,
        total:
          creadas.length
      })

  } catch (error) {
    await cliente.query(
      'ROLLBACK'
    )

    console.error(
      'Error enviar notificación:',
      error
    )

    res
      .status(500)
      .json({
        mensaje:
          'No fue posible enviar la notificación.'
      })

  } finally {
    cliente.release()
  }
}

app.post(
  '/api/notificaciones',
  enviarNotificacion
)

app.post(
  '/api/notificaciones/enviar',
  enviarNotificacion
)


async function marcarNotificacionLeida(
  req,
  res
) {
  try {
    const resultado =
      await pool.query(
        `
        UPDATE notificaciones
        SET leida = TRUE

        WHERE id = $1

        RETURNING
          id,
          leida
        `,
        [
          numero(
            req.params.id
          )
        ]
      )

    if (
      resultado.rowCount === 0
    ) {
      return res
        .status(404)
        .json({
          mensaje:
            'Notificación no encontrada.'
        })
    }

    res.json(
      resultado.rows[0]
    )

  } catch (error) {
    console.error(
      error
    )

    res
      .status(500)
      .json({
        mensaje:
          'No fue posible actualizar la notificación.'
      })
  }
}

app.put(
  '/api/notificaciones/:id/leida',
  marcarNotificacionLeida
)

app.put(
  '/api/notificaciones/:id/marcar-leida',
  marcarNotificacionLeida
)


/* =========================================================
   ASISTENCIAS
========================================================= */

app.get(
  '/api/asistencias/evento/:eventoId',
  async (
    req,
    res
  ) => {
    try {
      const resultado =
        await pool.query(
          `
          SELECT
            a.evento_id
              AS "eventoId",

            a.mesero_id
              AS "meseroId",

            a.rol,

            u.nombre,
            u.apellidos,

            COALESCE(
              asi.estado,
              'Sin registrar'
            ) AS estado

          FROM asignaciones a

          INNER JOIN meseros m
            ON m.id =
               a.mesero_id

          INNER JOIN usuarios u
            ON u.id =
               m.usuario_id

          LEFT JOIN asistencias asi
            ON
              asi.evento_id =
                a.evento_id

              AND
              asi.mesero_id =
                a.mesero_id

          WHERE
            a.evento_id = $1

          ORDER BY
            CASE
              WHEN a.rol =
                'Capitán'
              THEN 0
              ELSE 1
            END,

            u.nombre
          `,
          [
            numero(
              req.params.eventoId
            )
          ]
        )

      res.json(
        resultado.rows
      )

    } catch (error) {
      console.error(
        'Error asistencias:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar las asistencias.'
        })
    }
  }
)


app.put(
  '/api/asistencias',
  async (
    req,
    res
  ) => {
    try {
      const eventoId =
        numero(
          req.body.eventoId
        )

      const meseroId =
        numero(
          req.body.meseroId
        )

      const estado =
        req.body.estado

      let capitanId =
        numero(
          req.body.capitanId ??
          req.body.capitanMeseroId
        )

      if (
        ![
          'Presente',
          'Ausente'
        ].includes(estado)
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'Estado de asistencia no válido.'
          })
      }

      const evento =
        await obtenerEvento(
          eventoId
        )

      if (!evento) {
        return res
          .status(404)
          .json({
            mensaje:
              'Evento no encontrado.'
          })
      }

      if (
        evento.fecha !==
        fechaHoyMexico()
      ) {
        return res
          .status(403)
          .json({
            mensaje:
              'La asistencia sólo puede registrarse el día del evento.'
          })
      }

      if (!capitanId) {
        const capitan =
          await pool.query(
            `
            SELECT mesero_id
              AS "meseroId"

            FROM asignaciones

            WHERE
              evento_id = $1

              AND
              rol =
                'Capitán'

            LIMIT 1
            `,
            [eventoId]
          )

        capitanId =
          capitan.rows[0]
            ?.meseroId
      }

      const esCapitan =
        await pool.query(
          `
          SELECT id
          FROM asignaciones

          WHERE
            evento_id = $1

            AND
            mesero_id = $2

            AND
            rol =
              'Capitán'
          `,
          [
            eventoId,
            capitanId
          ]
        )

      if (
        esCapitan.rowCount === 0
      ) {
        return res
          .status(403)
          .json({
            mensaje:
              'Sólo el capitán del evento puede registrar asistencias.'
          })
      }

      const asignado =
        await pool.query(
          `
          SELECT id
          FROM asignaciones

          WHERE
            evento_id = $1

            AND
            mesero_id = $2
          `,
          [
            eventoId,
            meseroId
          ]
        )

      if (
        asignado.rowCount === 0
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'El mesero no está asignado a este evento.'
          })
      }

      const resultado =
        await pool.query(
          `
          INSERT INTO asistencias (
            evento_id,
            mesero_id,
            estado,
            registrado_por
          )
          VALUES (
            $1,
            $2,
            $3,
            $4
          )

          ON CONFLICT (
            evento_id,
            mesero_id
          )

          DO UPDATE SET
            estado =
              EXCLUDED.estado,

            registrado_por =
              EXCLUDED.registrado_por,

            fecha_registro =
              NOW()

          RETURNING
            id,

            evento_id
              AS "eventoId",

            mesero_id
              AS "meseroId",

            estado
          `,
          [
            eventoId,
            meseroId,
            estado,
            capitanId
          ]
        )

      res.json(
        resultado.rows[0]
      )

    } catch (error) {
      console.error(
        'Error registrar asistencia:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible registrar la asistencia.'
        })
    }
  }
)


/* =========================================================
   REPORTES
========================================================= */

async function obtenerReporteEvento(
  eventoId
) {
  const resultado =
    await pool.query(
      `
      SELECT
        r.id,

        r.evento_id
          AS "eventoId",

        r.sala_id
          AS "salaId",

        r.capitan_mesero_id
          AS "capitanId",

        r.resumen_servicio
          AS "resumenServicio",

        r.incidencias,
        r.observaciones,
        r.estado,

        r.fecha_creacion
          AS "fechaCreacion",

        r.fecha_actualizacion
          AS "fechaActualizacion",

        r.fecha_envio
          AS "fechaEnvio",

        e.nombre
          AS "eventoNombre",

        TO_CHAR(
          e.fecha,
          'YYYY-MM-DD'
        ) AS "eventoFecha"

      FROM reportes r

      INNER JOIN eventos e
        ON e.id =
           r.evento_id

      WHERE
        r.evento_id = $1

      LIMIT 1
      `,
      [eventoId]
    )

  const reporte =
    resultado.rows[0]

  if (!reporte) {
    return null
  }

  const asistencias =
    await pool.query(
      `
      SELECT
        mesero_id
          AS "meseroId",

        estado

      FROM asistencias

      WHERE evento_id = $1
      `,
      [eventoId]
    )

  const evaluaciones =
    await pool.query(
      `
      SELECT
        ev.id,

        ev.mesero_id
          AS "meseroId",

        ev.desempeno,
        ev.puntualidad,
        ev.actitud,
        ev.incidencia,
        ev.observacion,

        u.nombre,
        u.apellidos

      FROM evaluaciones_meseros ev

      INNER JOIN meseros m
        ON m.id =
           ev.mesero_id

      INNER JOIN usuarios u
        ON u.id =
           m.usuario_id

      WHERE
        ev.evento_id = $1

      ORDER BY
        u.nombre
      `,
      [eventoId]
    )

  return {
    ...reporte,

    resumen:
      reporte.resumenServicio,

    asistencia:
      asistencias.rows,

    evaluacionesPersonal:
      evaluaciones.rows
  }
}


app.get(
  '/api/reportes',
  async (
    req,
    res
  ) => {
    try {
      const verTodos =
        req.query.todos ===
        'true'

      const resultado =
        await pool.query(
          `
          SELECT
            r.id,

            r.evento_id
              AS "eventoId",

            r.sala_id
              AS "salaId",

            r.capitan_mesero_id
              AS "capitanId",

            r.resumen_servicio
              AS "resumenServicio",

            r.incidencias,
            r.observaciones,
            r.estado,

            r.fecha_envio
              AS "fechaEnvio",

            e.nombre
              AS "eventoNombre",

            TO_CHAR(
              e.fecha,
              'YYYY-MM-DD'
            ) AS "eventoFecha"

          FROM reportes r

          INNER JOIN eventos e
            ON e.id =
               r.evento_id

          WHERE
            (
              $1::BOOLEAN = TRUE
              OR
              r.estado =
                'Enviado'
            )

          ORDER BY
            e.fecha DESC,
            r.id DESC
          `,
          [verTodos]
        )

      res.json(
        resultado.rows
      )

    } catch (error) {
      console.error(
        'Error reportes:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar los reportes.'
        })
    }
  }
)


app.get(
  '/api/reportes/evento/:eventoId',
  async (
    req,
    res
  ) => {
    try {
      const reporte =
        await obtenerReporteEvento(
          numero(
            req.params.eventoId
          )
        )

      if (!reporte) {
        return res
          .status(404)
          .json({
            mensaje:
              'Todavía no existe un reporte para este evento.'
          })
      }

      res.json(reporte)

    } catch (error) {
      console.error(
        'Error reporte evento:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar el reporte.'
        })
    }
  }
)


async function guardarReporte(
  req,
  res
) {
  const cliente =
    await pool.connect()

  try {
    const eventoId =
      numero(
        req.body.eventoId ??
        req.params.eventoId
      )

    const evento =
      await obtenerEvento(
        eventoId,
        cliente
      )

    if (!evento) {
      return res
        .status(404)
        .json({
          mensaje:
            'Evento no encontrado.'
        })
    }

    if (
      evento.fecha >
      fechaHoyMexico()
    ) {
      return res
        .status(403)
        .json({
          mensaje:
            'El reporte sólo puede elaborarse a partir del día del evento.'
        })
    }

    const capitanResultado =
      await cliente.query(
        `
        SELECT mesero_id
          AS "meseroId"

        FROM asignaciones

        WHERE
          evento_id = $1

          AND
          rol =
            'Capitán'

        LIMIT 1
        `,
        [eventoId]
      )

    const capitanAsignado =
      capitanResultado
        .rows[0]
        ?.meseroId

    if (!capitanAsignado) {
      return res
        .status(400)
        .json({
          mensaje:
            'El evento no tiene un capitán asignado.'
        })
    }

    const capitanSolicitado =
      numero(
        req.body.capitanId ??
        req.body.capitanMeseroId
      )

    if (
      capitanSolicitado &&
      Number(
        capitanSolicitado
      ) !==
      Number(
        capitanAsignado
      )
    ) {
      return res
        .status(403)
        .json({
          mensaje:
            'Sólo el capitán asignado puede elaborar este reporte.'
        })
    }

    const existente =
      await cliente.query(
        `
        SELECT
          id,
          estado

        FROM reportes

        WHERE evento_id = $1
        `,
        [eventoId]
      )

    if (
      existente.rows[0]
        ?.estado ===
      'Enviado'
    ) {
      return res
        .status(409)
        .json({
          mensaje:
            'El reporte ya fue enviado y no puede modificarse.'
        })
    }

    const estado =
      req.body.estado ===
      'Enviado'
        ? 'Enviado'
        : 'Borrador'

    const evaluaciones =
      req.body
        .evaluacionesPersonal ??
      req.body.evaluaciones ??
      []

    /*
      Para enviar definitivamente,
      todos los meseros presentes
      que NO sean capitán deben
      tener evaluación completa.
    */

    if (
      estado ===
      'Enviado'
    ) {
      const presentes =
        await cliente.query(
          `
          SELECT
            asi.mesero_id
              AS "meseroId"

          FROM asistencias asi

          INNER JOIN asignaciones a
            ON
              a.evento_id =
                asi.evento_id

              AND
              a.mesero_id =
                asi.mesero_id

          WHERE
            asi.evento_id = $1

            AND
            asi.estado =
              'Presente'

            AND
            a.rol <>
              'Capitán'
          `,
          [eventoId]
        )

      for (
        const presente
        of presentes.rows
      ) {
        const evaluacion =
          evaluaciones.find(
            (item) =>
              Number(
                item.meseroId
              ) ===
              Number(
                presente.meseroId
              )
          )

        const completa =
          evaluacion &&
          Number(
            evaluacion.desempeno
          ) >= 1 &&
          Number(
            evaluacion.desempeno
          ) <= 5 &&
          Number(
            evaluacion.puntualidad
          ) >= 1 &&
          Number(
            evaluacion.puntualidad
          ) <= 5 &&
          Number(
            evaluacion.actitud
          ) >= 1 &&
          Number(
            evaluacion.actitud
          ) <= 5

        if (!completa) {
          return res
            .status(400)
            .json({
              mensaje:
                'Debes evaluar a todos los meseros presentes antes de enviar el reporte.'
            })
        }
      }
    }

    await cliente.query(
      'BEGIN'
    )

    const reporteResultado =
      await cliente.query(
        `
        INSERT INTO reportes (
          evento_id,
          sala_id,
          capitan_mesero_id,
          resumen_servicio,
          incidencias,
          observaciones,
          estado,
          fecha_actualizacion,
          fecha_envio
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          NOW(),

          CASE
            WHEN $7 =
              'Enviado'
            THEN NOW()
            ELSE NULL
          END
        )

        ON CONFLICT (
          evento_id
        )

        DO UPDATE SET
          sala_id =
            EXCLUDED.sala_id,

          capitan_mesero_id =
            EXCLUDED.capitan_mesero_id,

          resumen_servicio =
            EXCLUDED.resumen_servicio,

          incidencias =
            EXCLUDED.incidencias,

          observaciones =
            EXCLUDED.observaciones,

          estado =
            EXCLUDED.estado,

          fecha_actualizacion =
            NOW(),

          fecha_envio =
            CASE
              WHEN
                EXCLUDED.estado =
                  'Enviado'
              THEN NOW()
              ELSE
                reportes.fecha_envio
            END

        RETURNING id
        `,
        [
          eventoId,
          evento.salaId,
          capitanAsignado,

          req.body.resumenServicio ??
          req.body.resumen ??
          '',

          req.body.incidencias ??
          '',

          req.body.observaciones ??
          '',

          estado
        ]
      )

    const reporteId =
      reporteResultado
        .rows[0]
        .id

    /*
      El capitán nunca se evalúa
      a sí mismo.
    */

    for (
      const evaluacion
      of evaluaciones
    ) {
      const meseroId =
        numero(
          evaluacion.meseroId
        )

      if (
        !meseroId ||
        Number(meseroId) ===
        Number(capitanAsignado)
      ) {
        continue
      }

      const asignado =
        await cliente.query(
          `
          SELECT id
          FROM asignaciones

          WHERE
            evento_id = $1

            AND
            mesero_id = $2
          `,
          [
            eventoId,
            meseroId
          ]
        )

      if (
        asignado.rowCount === 0
      ) {
        continue
      }

      await cliente.query(
        `
        INSERT INTO evaluaciones_meseros (
          reporte_id,
          evento_id,
          mesero_id,
          desempeno,
          puntualidad,
          actitud,
          incidencia,
          observacion
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )

        ON CONFLICT (
          reporte_id,
          mesero_id
        )

        DO UPDATE SET
          desempeno =
            EXCLUDED.desempeno,

          puntualidad =
            EXCLUDED.puntualidad,

          actitud =
            EXCLUDED.actitud,

          incidencia =
            EXCLUDED.incidencia,

          observacion =
            EXCLUDED.observacion,

          fecha_evaluacion =
            NOW()
        `,
        [
          reporteId,
          eventoId,
          meseroId,

          numero(
            evaluacion.desempeno
          ),

          numero(
            evaluacion.puntualidad
          ),

          numero(
            evaluacion.actitud
          ),

          Boolean(
            evaluacion.incidencia
          ),

          evaluacion.observacion ??
          ''
        ]
      )
    }

    await cliente.query(
      'COMMIT'
    )

    res.json(
      await obtenerReporteEvento(
        eventoId
      )
    )

  } catch (error) {
    await cliente.query(
      'ROLLBACK'
    )

    console.error(
      'Error guardar reporte:',
      error
    )

    res
      .status(500)
      .json({
        mensaje:
          'No fue posible guardar el reporte.'
      })

  } finally {
    cliente.release()
  }
}


app.post(
  '/api/reportes',
  guardarReporte
)

app.put(
  '/api/reportes/evento/:eventoId',
  guardarReporte
)


/* =========================================================
   RUTA 404 API
========================================================= */

app.use(
  '/api',
  (
    req,
    res
  ) => {
    res
      .status(404)
      .json({
        mensaje:
          'Ruta de API no encontrada.'
      })
  }
)


/* =========================================================
   INICIAR SERVIDOR
========================================================= */

async function iniciarServidor() {
  try {
    const conexion =
      await probarConexion()

    console.log(
      ''
    )

    console.log(
      'PostgreSQL conectado:'
    )

    console.log(
      conexion
    )

    await inicializarDatosDemo()

    app.listen(
      PORT,
      () => {
        console.log(
          ''
        )

        console.log(
          `MesereArte API funcionando en http://localhost:${PORT}`
        )

        console.log(
          ''
        )
      }
    )

  } catch (error) {
    console.error(
      ''
    )

    console.error(
      'No fue posible iniciar MesereArte.'
    )

    console.error(
      error
    )

    process.exit(1)
  }
}

iniciarServidor()
