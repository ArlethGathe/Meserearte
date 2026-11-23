import express from 'express'
import cors from 'cors'
import { pool, probarConexion } from './db.js'
import { crearLogin } from './login.js'
import { hashPassword } from './passwords.js'
import { leerConfiguracionSesion } from './session-config.js'
import { crearSesiones } from './sesiones.js'
import { crearCsrf, HEADER_CSRF, leerOrigenesDesarrollo, leerSecretoCsrf, METODOS_ESCRITURA } from './csrf.js'
import { ambito, capitanVigente, crearAutorizacion, denegar, eventoAsignado, salaPropia } from './autorizacion.js'
import { configurarEntregaRestablecimiento, crearRestablecimiento } from './restablecimiento.js'
import { leerConfiguracionLimiteLogin, leerConfiguracionLimiteRegistro } from './login-limit-config.js'
import { crearLimitadorIntentos, crearLimitadorLogin, limitarIntentos, limitarLogin } from './login-limit.js'

const app = express()

const PORT = Number(process.env.PORT || 3001)
const configSesion = leerConfiguracionSesion()
const csrf = crearCsrf(leerSecretoCsrf())
const rutaSolicitarRestablecimiento = '/api/auth/restablecimiento/solicitar'
const rutaConfirmarRestablecimiento = '/api/auth/restablecimiento/confirmar'
const entregarRestablecimiento = configurarEntregaRestablecimiento()
const origenRestablecimiento = entregarRestablecimiento
  ? new URL(process.env.PASSWORD_RESET_APP_URL).origin
  : null

/* =========================================================
   CONFIGURACIÓN GENERAL
========================================================= */

const origenesAplicacion = new Set([...leerOrigenesDesarrollo(), configSesion.origen].filter(Boolean))
const corsApi = cors({
  origin: true,
  credentials: true,
  allowedHeaders: ['Content-Type', HEADER_CSRF],
})
app.use('/api', (req, res, next) => {
  const origen = req.get('Origin')
  if (origen && !origenesAplicacion.has(origen)
    && !(origen === origenRestablecimiento
      && ['/auth/restablecimiento/solicitar', '/auth/restablecimiento/confirmar'].includes(req.path))) {
    return res.status(403).json({ ok: false, mensaje: 'Origen no permitido.' })
  }
  return corsApi(req, res, next)
})

app.use(express.json())


/* =========================================================
   FUNCIONES GENERALES
========================================================= */

function normalizarCorreo(correo = '') {
  return String(correo)
    .trim()
    .toLowerCase()
}

function crearEnlaceGoogleMaps(
  latitud,
  longitud
) {
  const lat =
    Number(latitud)

  const lon =
    Number(longitud)

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return ''
  }

  return (
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(
      `${lat},${lon}`
    )
  )
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
        e.direccion,
        e.latitud,
        e.longitud,
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

const limitadorLogin = crearLimitadorLogin(leerConfiguracionLimiteLogin())
const sesiones = crearSesiones(pool, configSesion)
app.post('/api/auth/login', limitarLogin(limitadorLogin, normalizarCorreo), crearLogin(pool, normalizarCorreo, sesiones.emitir))
app.get('/api/auth/me', sesiones.autenticar(), (req, res) => {
  res.set('Cache-Control', 'no-store').json({ ok: true, usuario: req.usuarioAutenticado })
})
app.get('/api/auth/csrf', sesiones.autenticar(), csrf.entregar)
app.post('/api/auth/logout', sesiones.autenticar({ opcional: true }), (req, res, next) =>
  req.digestSesion ? csrf.verificar(req, res, next) : next(), sesiones.logout)

const cuposRestablecimiento = { ventanaMs: 600000, maxPorIp: 30, maxPorIpCorreo: 3, maxClaves: 10000 }
const restablecimiento = crearRestablecimiento({
  pool,
  entregar: entregarRestablecimiento,
  limitarSolicitud: crearLimitadorIntentos(cuposRestablecimiento),
})
app.post(rutaSolicitarRestablecimiento, restablecimiento.solicitar)
app.post(rutaConfirmarRestablecimiento,
  limitarIntentos(crearLimitadorIntentos({ ...cuposRestablecimiento, maxPorIpCorreo: 30 }), () => ''),
  restablecimiento.confirmar)


/* =========================================================
   REGISTRO ADMINISTRADOR
========================================================= */

async function generarHashRegistro(password) {
  try {
    return await hashPassword(password)
  } catch (error) {
    if (error instanceof TypeError) return null
    throw error
  }
}

const limitarRegistro = limitarIntentos(
  crearLimitadorIntentos(leerConfiguracionLimiteRegistro()), normalizarCorreo
)

async function buscarSalaRegistro(conexion, codigo, bloqueo = false) {
  const resultado = await conexion.query(
    `
    SELECT id, nombre, codigo, estado
    FROM salas
    WHERE UPPER(codigo) = UPPER($1) AND estado = 'Activa'
    LIMIT 1
    ${bloqueo ? 'FOR SHARE' : ''}
    `,
    [codigo]
  )
  return resultado.rows[0]
}

app.post(
  '/api/auth/registro-admin',
  limitarRegistro,
  async (
    req,
    res
  ) => {
    let cliente

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

      const existe =
        await pool.query(
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
        return res
          .status(409)
          .json({
            ok: false,
            mensaje:
              'Ya existe una cuenta con ese correo.'
          })
      }

      const passwordHash = await generarHashRegistro(password)
      if (passwordHash === null) {
        return res.status(400).json({
          ok: false,
          mensaje: 'La contraseña no tiene un formato válido.'
        })
      }

      cliente = await pool.connect()
      await cliente.query('BEGIN')

      const usuarioResultado =
        await cliente.query(
          `
          INSERT INTO usuarios (
            nombre,
            apellidos,
            correo,
            password,
            password_hash,
            estado_credencial,
            rol,
            estado
          )
          VALUES (
            $1,
            $2,
            $3,
            NULL,
            $4,
            'migrada',
            'Administrador',
            'Activo'
          )

          ON CONFLICT (correo) DO NOTHING
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
            passwordHash
          ]
        )

      if (usuarioResultado.rowCount === 0) {
        await cliente.query('ROLLBACK')
        return res.status(409).json({
          ok: false,
          mensaje: 'Ya existe una cuenta con ese correo.'
        })
      }

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

    } catch {
      if (cliente) await cliente.query('ROLLBACK')

      console.error('Error interno en registro admin')

      res
        .status(500)
        .json({
          ok: false,
          mensaje:
            'No fue posible crear la cuenta.'
        })

    } finally {
      cliente?.release()
    }
  }
)

/* =========================================================
   REGISTRO MESERO
========================================================= */

app.post(
  '/api/auth/registro-mesero',
  limitarRegistro,
  async (
    req,
    res
  ) => {
    let cliente

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
        !telefono ||
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
      const telefonoLimpio =
  String(telefono)
    .replace(/\D/g, '')

          if (
               telefonoLimpio.length < 10
              ) {
                 return res
                 .status(400)
                 .json({
                 ok: false,
                 mensaje:
                'Ingresa un número de teléfono válido de al menos 10 dígitos.'
                 })
}


      let sala = await buscarSalaRegistro(pool, codigoSala)

      if (!sala) {
        return res
          .status(404)
          .json({
            ok: false,
            mensaje:
              'El código de sala no es válido o la sala está inactiva.'
          })
      }

      const existe =
        await pool.query(
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
        return res
          .status(409)
          .json({
            ok: false,
            mensaje:
              'Ya existe una cuenta con ese correo.'
          })
      }

      const passwordHash = await generarHashRegistro(password)
      if (passwordHash === null) {
        return res.status(400).json({
          ok: false,
          mensaje: 'La contraseña no tiene un formato válido.'
        })
      }

      cliente = await pool.connect()
      await cliente.query('BEGIN')

      const salaActual = await buscarSalaRegistro(cliente, codigoSala, true)
      if (!salaActual || salaActual.id !== sala.id) {
        await cliente.query('ROLLBACK')
        return res.status(404).json({
          ok: false,
          mensaje: 'El código de sala no es válido o la sala está inactiva.'
        })
      }
      sala = salaActual

      const usuarioResultado =
        await cliente.query(
          `
          INSERT INTO usuarios (
            nombre,
            apellidos,
            correo,
            password,
            password_hash,
            estado_credencial,
            rol,
            estado
          )
          VALUES (
            $1,
            $2,
            $3,
            NULL,
            $4,
            'migrada',
            'Mesero',
            'Activo'
          )

          ON CONFLICT (correo) DO NOTHING
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
            passwordHash
          ]
        )

      if (usuarioResultado.rowCount === 0) {
        await cliente.query('ROLLBACK')
        return res.status(409).json({
          ok: false,
          mensaje: 'Ya existe una cuenta con ese correo.'
        })
      }

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

            telefonoLimpio
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

    } catch {
      if (cliente) await cliente.query('ROLLBACK')

      console.error('Error interno en registro mesero')

      res
        .status(500)
        .json({
          ok: false,
          mensaje:
            'No fue posible registrar al mesero.'
        })

    } finally {
      cliente?.release()
    }
  }
)


/* =========================================================
   SALAS
========================================================= */

const permisos = crearAutorizacion(pool)
const leerSesion = sesiones.autenticar({ renovarActividad: false })
app.use('/api', leerSesion, (req, res, next) => {
  if (!METODOS_ESCRITURA.has(req.method)) return next()
  return csrf.verificar(req, res, () => sesiones.renovar(req, res, next))
})

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
            CASE WHEN s.administrador_id = $1 THEN s.codigo END AS codigo,

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
          WHERE s.administrador_id = $1 OR EXISTS (SELECT 1 FROM meseros m WHERE m.id = $2 AND m.sala_id = s.id)

          ORDER BY
            s.id
          `,
          ambito(req.usuarioAutenticado)
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
  permisos.admin,
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

      const administradorId = req.usuarioAutenticado.id

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
  permisos.salaAdmin((req) => req.params.id),
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
  permisos.salaAdmin((req) => req.params.id),
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
                AND (m.id = $2 OR EXISTS (
                  SELECT 1 FROM eventos historia WHERE historia.id = a.evento_id
                    AND ${salaPropia('historia.sala_id')}
                ) OR ${capitanVigente('a.evento_id')})
            ) AS "eventosParticipados"

          FROM meseros m

          INNER JOIN usuarios u
            ON u.id =
               m.usuario_id
          WHERE ${salaPropia('m.sala_id')} OR m.id = $2 OR EXISTS (SELECT 1 FROM asignaciones equipo JOIN eventos e ON e.id = equipo.evento_id AND e.sala_id = m.sala_id WHERE equipo.mesero_id = m.id AND ${capitanVigente('equipo.evento_id')})

          ORDER BY
            u.nombre,
            u.apellidos
          `,
          ambito(req.usuarioAutenticado)
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


app.post('/api/meseros', (_req, res) => {
  return res.set('Allow', 'GET').status(405).json({
    mensaje: 'El alta de meseros se realiza mediante autorregistro con el código de una sala activa.'
  })
})


app.put(
  '/api/meseros/:id',
  permisos.perfil, permisos.destinoOpcional,
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

      const personal = req.usuarioAutenticado.rol === 'Mesero'
      if ((personal && Object.keys(req.body ?? {}).some((clave) => !['nombre', 'apellidos', 'telefono'].includes(clave)))
        || (req.body.correo !== undefined && normalizarCorreo(req.body.correo) !== normalizarCorreo(actual.correo))) {
        return denegar(res)
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

      if (personal) {
        await cliente.query('UPDATE usuarios SET nombre = COALESCE($1, nombre), apellidos = COALESCE($2, apellidos) WHERE id = $3',
          [req.body.nombre ?? null, req.body.apellidos ?? null, req.usuarioAutenticado.id])
      } else await cliente.query(
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
      
      const telefonoActualizado =
          req.body.telefono !==
          undefined
           ? String(
        req.body.telefono
        ).replace(/\D/g, '')
        : actual.telefono

      if ((!personal || req.body.telefono !== undefined)
        && (!telefonoActualizado || telefonoActualizado.length < 10)) {
             await cliente.query('ROLLBACK')
             return res
             .status(400)
             .json({
                    mensaje:
            'Ingresa un número de teléfono válido de al menos 10 dígitos.'
             })
           }
           
      if (personal) {
        await cliente.query('UPDATE meseros SET telefono = $1 WHERE id = $2 AND usuario_id = $3',
          [telefonoActualizado, req.usuarioAutenticado.meseroId, req.usuarioAutenticado.id])
      } else await cliente.query(
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

          telefonoActualizado,

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
  permisos.recurso('meseros', (req) => numero(req.params.id)),
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
            e.direccion,
            e.latitud,
            e.longitud,
            e.ubicacion,
            e.invitados,
            e.meseros_requeridos
              AS "meserosRequeridos",

            e.uniforme,
            e.observaciones,
            e.estado

          FROM eventos e
          WHERE ${salaPropia('e.sala_id')} OR ${eventoAsignado('e.id')}

          ORDER BY
            e.fecha,
            e.hora_inicio
          `,
          ambito(req.usuarioAutenticado)
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
  permisos.salaAdmin((req) => req.body?.salaId),
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

const direccion =
  req.body.direccion
    ?.trim()

const latitud =
  numero(
    req.body.latitud
  )

const longitud =
  numero(
    req.body.longitud
  )

const ubicacion =
  crearEnlaceGoogleMaps(
    latitud,
    longitud
  )
if (
  !salaId ||
  !nombre ||
  !fecha ||
  !horaInicio ||
  !horaFin ||
  !lugar ||
  !direccion ||
  latitud === null ||
  longitud === null
) {
  return res
    .status(400)
    .json({
      mensaje:
        'Completa los datos obligatorios del evento.'
    })
}

if (
  latitud < -90 ||
  latitud > 90 ||
  longitud < -180 ||
  longitud > 180
) {
  return res
    .status(400)
    .json({
      mensaje:
        'Las coordenadas de la ubicación no son válidas.'
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
      direccion,
      latitud,
      longitud,
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
      $13,
      $14,
      $15,
      $16
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
      direccion,
      latitud,
      longitud,
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
  permisos.destinoOpcional,
  permisos.recurso('eventos', (req) => numero(req.params.id)),
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

        direccion:
            req.body.direccion ??
            actual.direccion,

        latitud:
            req.body.latitud !==
    undefined
           ? numero(
            req.body.latitud
            )
            : actual.latitud,

        longitud:
            req.body.longitud !==
            undefined
               ? numero(
        req.body.longitud
      )
    : actual.longitud,

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
      propuesto.ubicacion =
             crearEnlaceGoogleMaps(
                 propuesto.latitud,
                 propuesto.longitud
  )

 if (
  !String(
    propuesto.lugar ??
    ''
  ).trim() ||

  !String(
    propuesto.direccion ??
    ''
  ).trim() ||

  propuesto.latitud ===
    null ||

  propuesto.longitud ===
    null
) {
  return res
    .status(400)
    .json({
      mensaje:
        'Lugar y ubicación son obligatorios.'
    })
}

if (
  propuesto.latitud < -90 ||
  propuesto.latitud > 90 ||
  propuesto.longitud < -180 ||
  propuesto.longitud > 180
) {
  return res
    .status(400)
    .json({
      mensaje:
        'Las coordenadas de la ubicación no son válidas.'
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
                'El cambio genera un conflicto con otra asignación.'
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
  permisos.recurso('eventos', (req) => numero(req.params.id)),
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
          WHERE ${salaPropia('(SELECT e.sala_id FROM eventos e WHERE e.id = asignaciones.evento_id)')} OR asignaciones.mesero_id = $2 OR ${capitanVigente('asignaciones.evento_id')}

          ORDER BY
            evento_id,
            id
          `,
          ambito(req.usuarioAutenticado)
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
  permisos.recurso('eventos', (req) => numero(req.params.eventoId)),
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

      /*
        REGLA DE NEGOCIO:
        Si existe personal asignado,
        debe existir un capitán.
      */

      if (
        meseroIds.length > 0 &&
        !capitanId
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'El evento debe tener un capitán para guardar personal asignado.'
          })
      }

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

        if (!mesero || Number(mesero.salaId) !== Number(evento.salaId)) return denegar(res)

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
                'El mesero ya tiene otra asignación en un horario que se traslapa.'
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
          WHERE ${salaPropia('(SELECT e.sala_id FROM eventos e WHERE e.id = disponibilidades.evento_id)')} OR disponibilidades.mesero_id = $2 OR ${capitanVigente('disponibilidades.evento_id')}

          ORDER BY id
          `,
          ambito(req.usuarioAutenticado)
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
  permisos.disponibilidad,
  async (
    req,
    res
  ) => {
    const cliente =
      await pool.connect()

    let transaccionIniciada =
      false

    try {
      const eventoId =
        numero(
          req.body.eventoId
        )

      const meseroId =
        req.usuarioAutenticado.meseroId

      const estado =
        req.body.estado

      if (
        !eventoId ||
        !meseroId
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'Evento y mesero son obligatorios.'
          })
      }

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
          SELECT
            id,
            rol

          FROM asignaciones

          WHERE
            evento_id = $1

            AND
            mesero_id = $2

          LIMIT 1
          `,
          [
            eventoId,
            meseroId
          ]
        )

      if (
        asignacion.rowCount ===
        0
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

            evento_id
              AS "eventoId",

            mesero_id
              AS "meseroId",

            estado,

            fecha_respuesta
              AS "fechaRespuesta"

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

      const asegurarAlertaNoDisponible =
        async () => {
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

          if (
            !evento ||
            !mesero
          ) {
            return
          }

          const esCapitan =
            asignacion.rows[0]
              ?.rol ===
            'Capitán'

          const tituloAlerta =
            esCapitan
              ? 'Capitán no disponible'
              : 'Mesero no disponible'

          const mensajeAlerta =
            esCapitan
              ? `${mesero.nombre} ${mesero.apellidos}, capitán del evento "${evento.nombre}", indicó que no está disponible. Debes seleccionar un nuevo capitán y actualizar las asignaciones del evento.`
              : `${mesero.nombre} ${mesero.apellidos} indicó que no está disponible para el evento "${evento.nombre}".`

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

            SELECT
              'Disponibilidad',
              $1,
              $2,
              $3,
              $4,
              $5,
              'Administrador',
              'Administrador',
              'Sistema',
              TRUE

            WHERE NOT EXISTS (
              SELECT 1

              FROM notificaciones

              WHERE
                automatica = TRUE

                AND tipo =
                  'Disponibilidad'

                AND evento_id = $4

                AND mesero_id = $5

                AND destinatario =
                  'Administrador'
            )
            `,
            [
              tituloAlerta,
              mensajeAlerta,
              evento.salaId,
              eventoId,
              meseroId
            ]
          )
        }

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
          if (
            estado ===
            'No disponible'
          ) {
            await cliente.query(
              'BEGIN'
            )

            transaccionIniciada =
              true

            await asegurarAlertaNoDisponible()

            await cliente.query(
              'COMMIT'
            )

            transaccionIniciada =
              false
          }

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

      transaccionIniciada =
        true

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
        await asegurarAlertaNoDisponible()
      }

      await cliente.query(
        'COMMIT'
      )

      transaccionIniciada =
        false

      res.json(
        resultado.rows[0]
      )

    } catch (error) {
      if (
        transaccionIniciada
      ) {
        try {
          await cliente.query(
            'ROLLBACK'
          )
        } catch (
          rollbackError
        ) {
          console.error(
            'Error al revertir disponibilidad:',
            rollbackError
          )
        }
      }

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

async function consultarNotificaciones({
  administradorId,
  salaId = null,
  destinatario = null
} = {}) {
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

      WHERE ${salaPropia('n.sala_id', '$3')} AND
        (
          $1::INTEGER IS NULL
          OR
          n.sala_id = $1
        )

        AND
        (
          $2::TEXT IS NULL
          OR
          LOWER(
            COALESCE(
              n.destinatario,
              ''
            )
          ) =
          LOWER($2)
        )

      ORDER BY
        n.fecha DESC,
        n.id DESC
      `,
      [
        salaId,
        destinatario, administradorId
      ]
    )

  return resultado.rows
}


app.get(
  '/api/notificaciones',
  permisos.admin, permisos.filtroSala,
  async (
    req,
    res
  ) => {
    try {
      const salaId =
        numero(
          req.query.salaId
        )

      const destinatario =
        req.query.destinatario
          ? String(
              req.query.destinatario
            ).trim()
          : null

      res.json(
        await consultarNotificaciones({
          administradorId: req.usuarioAutenticado.id,
          salaId,
          destinatario
        })
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
  '/api/notificaciones/enviadas',
  permisos.admin, permisos.filtroSala,
  async (
    req,
    res
  ) => {
    try {
      const salaId =
        numero(
          req.query.salaId
        )

      const resultado =
        await pool.query(
          `
          SELECT
            n.envio_id
              AS "envioId",

            MAX(n.tipo)
              AS tipo,

            MAX(n.titulo)
              AS titulo,

            MAX(n.mensaje)
              AS mensaje,

            MAX(n.sala_id)
              AS "salaId",

            MAX(n.evento_id)
              AS "eventoId",

            MAX(n.modo_destinatario)
              AS "modoDestinatario",

            MAX(n.fecha)
              AS fecha,

            COUNT(*)::INTEGER
              AS enviados,

            COUNT(*) FILTER (
              WHERE n.leida = TRUE
            )::INTEGER
              AS leidos

          FROM notificaciones n

          WHERE
            ${salaPropia('n.sala_id', '$2')} AND n.envio_id IS NOT NULL

            AND
            n.automatica = FALSE

            AND
            (
              $1::INTEGER IS NULL
              OR
              n.sala_id = $1
            )

          GROUP BY
            n.envio_id

          ORDER BY
            MAX(n.fecha) DESC
          `,
          [salaId, req.usuarioAutenticado.id]
        )

      res.json(
        resultado.rows
      )

    } catch (error) {
      console.error(
        'Error historial de notificaciones:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar el historial de notificaciones.'
        })
    }
  }
)


app.get(
  '/api/notificaciones/mesero/:meseroId',
  permisos.propio((req) => req.params.meseroId),
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
            req.usuarioAutenticado.meseroId
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

          FROM asignaciones a JOIN meseros m ON m.id = a.mesero_id
          WHERE a.evento_id = $1 AND m.sala_id = $2
          `,
          [eventoId, salaId]
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
          creadas.length,

        enviados:
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
  permisos.aviso,
  enviarNotificacion
)

app.post(
  '/api/notificaciones/enviar',
  permisos.aviso,
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

        WHERE id = $1 AND (destinatario_mesero_id = $3 OR (
          ${salaPropia('notificaciones.sala_id', '$2')} AND destinatario = 'Administrador'
          AND destinatario_mesero_id IS NULL
        ))

        RETURNING
          id,
          leida
        `,
        [
          numero(
            req.params.id
          ), ...ambito(req.usuarioAutenticado)
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
  permisos.evento((req) => req.params.eventoId),
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
  permisos.evento((req) => req.body?.eventoId, true),
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

      const capitanId = req.usuarioAutenticado.meseroId

      if (
        ![
          'Presente',
          'Retardo',
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

      const asignado =
  await pool.query(
    `
    SELECT
      a.id,

      COALESCE(
        d.estado,
        'Pendiente'
      ) AS disponibilidad

    FROM asignaciones a

    LEFT JOIN disponibilidades d
      ON
        d.evento_id =
          a.evento_id

        AND

        d.mesero_id =
          a.mesero_id

    WHERE
      a.evento_id = $1

      AND

      a.mesero_id = $2

    LIMIT 1
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
      if (
  asignado.rows[0]
    .disponibilidad !==
  'Confirmado'
) {
  return res
    .status(409)
    .json({
      mensaje:
        'Sólo se puede registrar asistencia del personal que confirmó su participación.'
    })
}

      const disponibilidad =
            await pool.query(
    `
            SELECT estado
            FROM disponibilidades

            WHERE
            evento_id = $1
            AND
            mesero_id = $2

           LIMIT 1
           `,
        [
           eventoId,
           meseroId
        ]
  )

if (
  disponibilidad.rows[0]
    ?.estado !==
  'Confirmado'
) {
  return res
    .status(400)
    .json({
      mensaje:
        'Sólo se puede registrar asistencia del personal que confirmó su asistencia.'
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
          SELECT $1, $2, $3, $4
          WHERE ${capitanVigente('$1', '$4', true)}
            AND EXISTS (SELECT 1 FROM asignaciones a JOIN disponibilidades d
              ON d.evento_id = a.evento_id AND d.mesero_id = a.mesero_id
              JOIN eventos e ON e.id = a.evento_id JOIN meseros m ON m.id = a.mesero_id AND m.sala_id = e.sala_id
              WHERE a.evento_id = $1 AND a.mesero_id = $2 AND d.estado = 'Confirmado'
              FOR SHARE OF a, d, m)

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

      if (resultado.rowCount === 0) return denegar(res)
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
   HISTORIAL DE MESEROS
========================================================= */

app.get(
  '/api/meseros/:id/historial',
  permisos.perfil,
  async (
    req,
    res
  ) => {
    try {
      const meseroId =
        numero(
          req.params.id
        )

      if (!meseroId) {
        return res
          .status(400)
          .json({
            mensaje:
              'El mesero indicado no es válido.'
          })
      }

      /*
        DATOS GENERALES DEL MESERO
      */

      const resultadoMesero =
        await pool.query(
          `
          SELECT
            m.id,

            m.sala_id
              AS "salaId",

            m.telefono,
            m.estado,

            u.nombre,
            u.apellidos,
            u.correo

          FROM meseros m

          INNER JOIN usuarios u
            ON u.id =
               m.usuario_id

          WHERE
            m.id = $1

          LIMIT 1
          `,
          [
            meseroId
          ]
        )

      const mesero =
        resultadoMesero
          .rows[0]

      if (!mesero) {
        return res
          .status(404)
          .json({
            mensaje:
              'Mesero no encontrado.'
          })
      }

      /*
        HISTORIAL DE EVENTOS

        Se incluyen:
        - evento
        - rol
        - asistencia
        - evaluación final
        - incidencia individual
        - observación individual
      */

      const resultadoHistorial =
        await pool.query(
          `
          SELECT
            e.id
              AS "eventoId",

            e.nombre
              AS "eventoNombre",

            e.tipo
              AS "eventoTipo",

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

            a.rol,

            COALESCE(
              asi.estado,
              'Sin registrar'
            ) AS asistencia,

            r.estado
              AS "reporteEstado",

            ev.desempeno,
            ev.puntualidad,
            ev.actitud,
            ev.id IS NOT NULL AS "evaluacionRegistrada",
            ev.incidencia,
            ev.observacion

          FROM asignaciones a

          INNER JOIN eventos e
            ON e.id =
               a.evento_id

          LEFT JOIN asistencias asi
            ON
              asi.evento_id =
                a.evento_id

              AND

              asi.mesero_id =
                a.mesero_id

          LEFT JOIN reportes r
            ON r.evento_id =
               a.evento_id

          LEFT JOIN evaluaciones_meseros ev
            ON
              ev.reporte_id = r.id
              AND ev.evento_id =
                a.evento_id

              AND

              ev.mesero_id =
                a.mesero_id

              AND

              r.estado =
                'Enviado'

          WHERE
            a.mesero_id = $1 AND ($2::integer IS NULL OR ${salaPropia('e.sala_id', '$2')})

          ORDER BY
            e.fecha DESC,
            e.hora_inicio DESC
          `,
          [
            meseroId, ambito(req.usuarioAutenticado)[0]
          ]
        )

      const historial =
        resultadoHistorial.rows

      /*
        RESUMEN DEL HISTORIAL
      */

      const eventosParticipados =
        historial.length

      const comoCapitan =
        historial.filter(
          (registro) =>
            registro.rol ===
            'Capitán'
        ).length

      const comoMesero =
        historial.filter(
          (registro) =>
            registro.rol ===
            'Mesero'
        ).length

      const presentes =
        historial.filter(
          (registro) =>
            registro.asistencia ===
            'Presente'
        ).length

      const retardos = historial.filter((registro) => registro.asistencia === 'Retardo').length

      const ausentes =
        historial.filter(
          (registro) =>
            registro.asistencia ===
            'Ausente'
        ).length

      const sinRegistrar =
        historial.filter(
          (registro) =>
            registro.asistencia ===
            'Sin registrar'
        ).length

      const incidencias =
        historial.filter(
          (registro) =>
            registro.incidencia ===
            true
        ).length

      /*
        PROMEDIOS

        El capitán no se evalúa
        a sí mismo, por lo que esos
        eventos simplemente no entran
        al promedio.
      */

      const obtenerPromedio =
        (campo) => {
          const valores =
            historial
              .map(
                (registro) =>
                  Number(
                    registro[campo]
                  )
              )
              .filter(
                (valor) =>
                  Number.isFinite(
                    valor
                  ) &&
                  valor >= 1 &&
                  valor <= 5
              )

          if (
            valores.length ===
            0
          ) {
            return null
          }

          const suma =
            valores.reduce(
              (
                acumulado,
                valor
              ) =>
                acumulado +
                valor,
              0
            )

          return Number(
            (
              suma /
              valores.length
            ).toFixed(2)
          )
        }

      res.json({
        mesero,

        resumen: {
          eventosParticipados,
          comoCapitan,
          comoMesero,
          asistencias: presentes + retardos,
          presentes,
          retardos,
          ausentes,
          sinRegistrar,
          incidencias,

          promedioDesempeno:
            obtenerPromedio(
              'desempeno'
            ),

          promedioPuntualidad:
            obtenerPromedio(
              'puntualidad'
            ),

          promedioActitud:
            obtenerPromedio(
              'actitud'
            )
        },

        historial
      })

    } catch (error) {
      console.error(
        'Error historial mesero:',
        error
      )

      res
        .status(500)
        .json({
          mensaje:
            'No fue posible consultar el historial del mesero.'
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
  permisos.admin, permisos.filtroSala,
  async (
    req,
    res
  ) => {
    try {
      const salaId = numero(req.query.salaId)

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

            (
              SELECT json_build_object(
                'total', count(*),
                'presentes', count(*) FILTER (WHERE asi.estado = 'Presente'),
                'retardos', count(*) FILTER (WHERE asi.estado = 'Retardo'),
                'ausentes', count(*) FILTER (WHERE asi.estado = 'Ausente'),
                'sinRegistrar', count(*) FILTER (WHERE asi.estado IS NULL)
              )
              FROM asignaciones a
              LEFT JOIN asistencias asi ON asi.evento_id = a.evento_id AND asi.mesero_id = a.mesero_id
              WHERE a.evento_id = e.id
            ) AS asistencia,

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
            r.estado = 'Enviado' AND ${salaPropia('e.sala_id', '$1')}
            AND ($2::integer IS NULL OR e.sala_id = $2)

          ORDER BY
            e.fecha DESC,
            r.id DESC
          `,
          [req.usuarioAutenticado.id, salaId]
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
  permisos.evento((req) => req.params.eventoId),
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

      if (!reporte || (req.usuarioAutenticado.rol === 'Administrador' && reporte.estado !== 'Enviado')) {
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

  let transaccion = false
  try {
    const eventoId =
      numero(
        req.params.eventoId ??
        req.body.eventoId
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

    const capitanAsignado = req.usuarioAutenticado.meseroId
    await cliente.query('BEGIN')
    transaccion = true
    const permisoVigente = await cliente.query(`SELECT 1 WHERE ${capitanVigente('$1', '$2', true)}`, [eventoId, capitanAsignado])
    if (permisoVigente.rowCount === 0) return denegar(res)

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

    if (
      estado ===
      'Enviado'
    ) {
      const asistentes =
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
            asi.estado IN ('Presente', 'Retardo')

            AND
            a.rol <>
              'Capitán'
          `,
          [eventoId]
        )

      for (
        const asistente
        of asistentes.rows
      ) {
        const evaluacion =
          evaluaciones.find(
            (item) =>
              Number(
                item.meseroId
              ) ===
              Number(
                asistente.meseroId
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
                'Debes evaluar a los meseros presentes y con retardo antes de enviar el reporte.'
            })
        }
      }
    }

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
        WHEN $8::BOOLEAN
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

      estado,

      estado === 'Enviado'
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

    await cliente.query('COMMIT')
    transaccion = false

    res.json(
      await obtenerReporteEvento(
        eventoId
      )
    )

  } catch {
    console.error('Error interno al guardar el reporte.')
    res.status(500).json({ mensaje: 'No fue posible guardar el reporte.' })
  } finally {
    try {
      if (transaccion) await cliente.query('ROLLBACK')
    } finally {
      cliente.release()
    }
  }
}

app.post(
  '/api/reportes',
  permisos.evento((req) => req.params.eventoId ?? req.body?.eventoId, true),
  guardarReporte
)

app.put(
  '/api/reportes/evento/:eventoId',
  permisos.evento((req) => req.params.eventoId ?? req.body?.eventoId, true),
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
