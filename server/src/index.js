import express from 'express'
import cors from 'cors'
import { db } from './data.js'

const app = express()
const PORT = 3001

app.use(
  cors({
    origin: 'http://localhost:5173'
  })
)

app.use(express.json())

/* ========================================
   ARREGLOS AUXILIARES
======================================== */

if (!db.notificaciones) {
  db.notificaciones = []
}

if (!db.asistencias) {
  db.asistencias = []
}

if (!db.reportes) {
  db.reportes = []
}

/* ========================================
   FUNCIONES AUXILIARES
======================================== */

function generarId(lista) {
  if (lista.length === 0) {
    return 1
  }

  return (
    Math.max(
      ...lista.map(
        (item) => item.id
      )
    ) + 1
  )
}

function generarCodigoSala() {
  const caracteres =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  let codigo = 'MESA'

  for (let i = 0; i < 4; i++) {
    codigo += caracteres.charAt(
      Math.floor(
        Math.random() *
        caracteres.length
      )
    )
  }

  return codigo
}

function obtenerFechaMexico() {
  const partes =
    new Intl.DateTimeFormat(
      'es-MX',
      {
        timeZone:
          'America/Mexico_City',

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit'
      }
    ).formatToParts(
      new Date()
    )

  const obtener = (tipo) =>
    partes.find(
      (parte) =>
        parte.type === tipo
    )?.value

  return `${obtener('year')}-${obtener('month')}-${obtener('day')}`
}

function obtenerResumenAsistencia(
  eventoId
) {
  const asignados =
    db.asignaciones.filter(
      (asignacion) =>
        asignacion.eventoId ===
        eventoId
    )

  const registros =
    db.asistencias.filter(
      (asistencia) =>
        asistencia.eventoId ===
        eventoId
    )

  const presentes =
    registros.filter(
      (asistencia) =>
        asistencia.estado ===
        'Presente'
    ).length

  const ausentes =
    registros.filter(
      (asistencia) =>
        asistencia.estado ===
        'Ausente'
    ).length

  return {
    total:
      asignados.length,

    presentes,

    ausentes,

    sinRegistrar:
      Math.max(
        0,
        asignados.length -
        presentes -
        ausentes
      )
  }
}

/* ========================================
   HEALTH
======================================== */

app.get(
  '/api/health',
  (req, res) => {
    res.json({
      ok: true,
      mensaje:
        'API de MesereArte funcionando'
    })
  }
)

/* ========================================
   AUTENTICACIÓN
======================================== */

app.post(
  '/api/auth/login',
  (req, res) => {
    const {
      correo,
      password,
      rol
    } = req.body

    if (
      !correo ||
      !password ||
      !rol
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'Completa todos los campos.'
        })
    }

    const usuario =
      db.usuarios.find(
        (usuario) =>
          usuario.correo
            .toLowerCase() ===
            correo
              .trim()
              .toLowerCase() &&
          usuario.password ===
            password &&
          usuario.rol === rol
      )

    if (!usuario) {
      return res
        .status(401)
        .json({
          mensaje:
            'Correo, contraseña o tipo de usuario incorrectos.'
        })
    }

    if (
      usuario.estado !==
      'Activo'
    ) {
      return res
        .status(403)
        .json({
          mensaje:
            'El usuario se encuentra inactivo.'
        })
    }

    const {
      password:
        passwordOculto,
      ...usuarioSeguro
    } = usuario

    res.json({
      mensaje:
        'Inicio de sesión correcto',

      usuario:
        usuarioSeguro
    })
  }
)

/* ========================================
   REGISTRO ADMIN
======================================== */

app.post(
  '/api/auth/registro-admin',
  (req, res) => {
    const {
      nombre,
      apellidos,
      correo,
      password,
      nombreSala
    } = req.body

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
          mensaje:
            'Completa todos los campos.'
        })
    }

    const correoNormalizado =
      correo
        .trim()
        .toLowerCase()

    if (
      db.usuarios.some(
        (usuario) =>
          usuario.correo
            .toLowerCase() ===
          correoNormalizado
      )
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'El correo ya está registrado.'
        })
    }

    let codigo =
      generarCodigoSala()

    while (
      db.salas.some(
        (sala) =>
          sala.codigo === codigo
      )
    ) {
      codigo =
        generarCodigoSala()
    }

    const nuevaSala = {
      id:
        generarId(
          db.salas
        ),

      nombre:
        nombreSala,

      descripcion:
        'Sala creada durante el registro',

      codigo,

      administrador:
        `${nombre} ${apellidos}`,

      estado:
        'Activa'
    }

    db.salas.push(
      nuevaSala
    )

    const nuevoUsuario = {
      id:
        generarId(
          db.usuarios
        ),

      nombre,
      apellidos,

      correo:
        correoNormalizado,

      password,

      rol:
        'Administrador',

      salaId:
        nuevaSala.id,

      estado:
        'Activo'
    }

    db.usuarios.push(
      nuevoUsuario
    )

    const {
      password:
        passwordOculto,
      ...usuarioSeguro
    } = nuevoUsuario

    res
      .status(201)
      .json({
        mensaje:
          'Administrador registrado correctamente.',

        usuario:
          usuarioSeguro,

        sala:
          nuevaSala
      })
  }
)

/* ========================================
   REGISTRO MESERO
======================================== */

app.post(
  '/api/auth/registro-mesero',
  (req, res) => {
    const {
      nombre,
      apellidos,
      correo,
      password,
      codigoSala
    } = req.body

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
          mensaje:
            'Completa todos los campos.'
        })
    }

    const correoNormalizado =
      correo
        .trim()
        .toLowerCase()

    if (
      db.usuarios.some(
        (usuario) =>
          usuario.correo
            .toLowerCase() ===
          correoNormalizado
      )
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'El correo ya está registrado.'
        })
    }

    const sala =
      db.salas.find(
        (sala) =>
          sala.codigo
            .toUpperCase() ===
            codigoSala
              .trim()
              .toUpperCase() &&
          sala.estado ===
            'Activa'
      )

    if (!sala) {
      return res
        .status(400)
        .json({
          mensaje:
            'El código de sala no existe o la sala no está activa.'
        })
    }

    const nuevoUsuario = {
      id:
        generarId(
          db.usuarios
        ),

      nombre,
      apellidos,

      correo:
        correoNormalizado,

      password,

      rol:
        'Mesero',

      salaId:
        sala.id,

      estado:
        'Activo'
    }

    db.usuarios.push(
      nuevoUsuario
    )

    const nuevoMesero = {
      id:
        generarId(
          db.meseros
        ),

      nombre,
      apellidos,

      correo:
        correoNormalizado,

      telefono: '',

      salaId:
        sala.id,

      eventosParticipados: 0,

      estado:
        'Activo',

      disponibilidad:
        'Disponible'
    }

    db.meseros.push(
      nuevoMesero
    )

    const {
      password:
        passwordOculto,
      ...usuarioSeguro
    } = nuevoUsuario

    res
      .status(201)
      .json({
        mensaje:
          'Mesero registrado correctamente.',

        usuario:
          usuarioSeguro,

        sala: {
          id:
            sala.id,

          nombre:
            sala.nombre
        }
      })
  }
)

/* ========================================
   USUARIOS
======================================== */

app.get(
  '/api/usuarios',
  (req, res) => {
    res.json(
      db.usuarios.map(
        ({
          password,
          ...usuario
        }) => usuario
      )
    )
  }
)

/* ========================================
   SALAS
======================================== */

app.get(
  '/api/salas',
  (req, res) => {
    res.json(db.salas)
  }
)

app.post(
  '/api/salas',
  (req, res) => {
    if (!req.body.nombre) {
      return res
        .status(400)
        .json({
          mensaje:
            'El nombre de la sala es obligatorio.'
        })
    }

    let codigo =
      generarCodigoSala()

    while (
      db.salas.some(
        (sala) =>
          sala.codigo === codigo
      )
    ) {
      codigo =
        generarCodigoSala()
    }

    const nuevaSala = {
      id:
        generarId(
          db.salas
        ),

      nombre:
        req.body.nombre,

      descripcion:
        req.body.descripcion ||
        '',

      codigo,

      administrador:
        req.body.administrador ||
        'Administrador',

      estado:
        'Activa'
    }

    db.salas.push(
      nuevaSala
    )

    res
      .status(201)
      .json(
        nuevaSala
      )
  }
)

app.put(
  '/api/salas/:id',
  (req, res) => {
    const id =
      Number(
        req.params.id
      )

    const indice =
      db.salas.findIndex(
        (sala) =>
          sala.id === id
      )

    if (indice === -1) {
      return res
        .status(404)
        .json({
          mensaje:
            'Sala no encontrada.'
        })
    }

    db.salas[indice] = {
      ...db.salas[indice],

      nombre:
        req.body.nombre ??
        db.salas[indice]
          .nombre,

      descripcion:
        req.body.descripcion ??
        db.salas[indice]
          .descripcion
    }

    res.json(
      db.salas[indice]
    )
  }
)

app.delete(
  '/api/salas/:id',
  (req, res) => {
    const id =
      Number(
        req.params.id
      )

    const tieneMeseros =
      db.meseros.some(
        (mesero) =>
          mesero.salaId === id
      )

    const tieneEventos =
      db.eventos.some(
        (evento) =>
          evento.salaId === id
      )

    if (
      tieneMeseros ||
      tieneEventos
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'No se puede eliminar una sala con meseros o eventos relacionados.'
        })
    }

    db.salas =
      db.salas.filter(
        (sala) =>
          sala.id !== id
      )

    res.json({
      mensaje:
        'Sala eliminada correctamente.'
    })
  }
)

/* ========================================
   MESEROS
======================================== */

app.get(
  '/api/meseros',
  (req, res) => {
    res.json(
      db.meseros
    )
  }
)

app.post(
  '/api/meseros',
  (req, res) => {
    const nuevoMesero = {
      id:
        generarId(
          db.meseros
        ),

      nombre:
        req.body.nombre,

      apellidos:
        req.body.apellidos,

      correo:
        req.body.correo,

      telefono:
        req.body.telefono ||
        '',

      salaId:
        Number(
          req.body.salaId
        ),

      eventosParticipados: 0,

      estado:
        req.body.estado ||
        'Activo',

      disponibilidad:
        req.body.disponibilidad ||
        'Disponible'
    }

    db.meseros.push(
      nuevoMesero
    )

    res
      .status(201)
      .json(
        nuevoMesero
      )
  }
)

app.put(
  '/api/meseros/:id',
  (req, res) => {
    const id =
      Number(
        req.params.id
      )

    const indice =
      db.meseros.findIndex(
        (mesero) =>
          mesero.id === id
      )

    if (indice === -1) {
      return res
        .status(404)
        .json({
          mensaje:
            'Mesero no encontrado.'
        })
    }

    db.meseros[indice] = {
      ...db.meseros[indice],
      ...req.body,

      id,

      salaId:
        req.body.salaId !==
        undefined
          ? Number(
              req.body.salaId
            )
          : db.meseros[
              indice
            ].salaId,

      eventosParticipados:
        db.meseros[
          indice
        ].eventosParticipados
    }

    res.json(
      db.meseros[indice]
    )
  }
)

app.delete(
  '/api/meseros/:id',
  (req, res) => {
    const id =
      Number(
        req.params.id
      )

    db.meseros =
      db.meseros.filter(
        (mesero) =>
          mesero.id !== id
      )

    db.asignaciones =
      db.asignaciones.filter(
        (asignacion) =>
          asignacion.meseroId !==
          id
      )

    db.disponibilidades =
      db.disponibilidades.filter(
        (item) =>
          item.meseroId !== id
      )

    db.asistencias =
      db.asistencias.filter(
        (item) =>
          item.meseroId !== id
      )

    res.json({
      mensaje:
        'Mesero eliminado correctamente.'
    })
  }
)

/* ========================================
   EVENTOS
======================================== */

app.get(
  '/api/eventos',
  (req, res) => {
    res.json(
      db.eventos
    )
  }
)

app.post(
  '/api/eventos',
  (req, res) => {
    const nuevoEvento = {
      id:
        generarId(
          db.eventos
        ),

      salaId:
        Number(
          req.body.salaId
        ),

      nombre:
        req.body.nombre,

      tipo:
        req.body.tipo,

      fecha:
        req.body.fecha,

      horario:
        req.body.horario,

      ubicacion:
        req.body.ubicacion,

      invitados:
        Number(
          req.body.invitados
        ),

      meserosRequeridos:
        Number(
          req.body
            .meserosRequeridos
        ),

      uniforme:
        req.body.uniforme ||
        '',

      observaciones:
        req.body.observaciones ||
        '',

      estado:
        req.body.estado ||
        'Pendiente'
    }

    db.eventos.push(
      nuevoEvento
    )

    res
      .status(201)
      .json(
        nuevoEvento
      )
  }
)

app.put(
  '/api/eventos/:id',
  (req, res) => {
    const id =
      Number(
        req.params.id
      )

    const indice =
      db.eventos.findIndex(
        (evento) =>
          evento.id === id
      )

    if (indice === -1) {
      return res
        .status(404)
        .json({
          mensaje:
            'Evento no encontrado.'
        })
    }

    db.eventos[indice] = {
      ...db.eventos[indice],
      ...req.body,

      id,

      salaId:
        req.body.salaId !==
        undefined
          ? Number(
              req.body.salaId
            )
          : db.eventos[
              indice
            ].salaId,

      invitados:
        Number(
          req.body.invitados ??
          db.eventos[
            indice
          ].invitados
        ),

      meserosRequeridos:
        Number(
          req.body
            .meserosRequeridos ??
          db.eventos[
            indice
          ].meserosRequeridos
        )
    }

    res.json(
      db.eventos[indice]
    )
  }
)

app.delete(
  '/api/eventos/:id',
  (req, res) => {
    const id =
      Number(
        req.params.id
      )

    db.eventos =
      db.eventos.filter(
        (evento) =>
          evento.id !== id
      )

    db.asignaciones =
      db.asignaciones.filter(
        (asignacion) =>
          asignacion.eventoId !== id
      )

    db.disponibilidades =
      db.disponibilidades.filter(
        (item) =>
          item.eventoId !== id
      )

    db.asistencias =
      db.asistencias.filter(
        (item) =>
          item.eventoId !== id
      )

    db.reportes =
      db.reportes.filter(
        (item) =>
          item.eventoId !== id
      )

    res.json({
      mensaje:
        'Evento eliminado correctamente.'
    })
  }
)

/* ========================================
   ASIGNACIONES
======================================== */

app.get(
  '/api/asignaciones',
  (req, res) => {
    res.json(
      db.asignaciones
    )
  }
)

app.get(
  '/api/asignaciones/evento/:eventoId',
  (req, res) => {
    const eventoId =
      Number(
        req.params.eventoId
      )

    res.json(
      db.asignaciones.filter(
        (asignacion) =>
          asignacion.eventoId ===
          eventoId
      )
    )
  }
)

app.put(
  '/api/asignaciones/evento/:eventoId',
  (req, res) => {
    const eventoId =
      Number(
        req.params.eventoId
      )

    const evento =
      db.eventos.find(
        (evento) =>
          evento.id ===
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

    const meseroIds = [
      ...new Set(
        (
          req.body.meseroIds ||
          []
        ).map(Number)
      )
    ]

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
            'El capitán debe pertenecer al personal asignado.'
        })
    }

    for (
      const meseroId of
      meseroIds
    ) {
      const mesero =
        db.meseros.find(
          (mesero) =>
            mesero.id ===
            meseroId
        )

      if (!mesero) {
        return res
          .status(400)
          .json({
            mensaje:
              'Uno de los meseros seleccionados no existe.'
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
              `${mesero.nombre} no se encuentra activo.`
          })
      }

      if (
        mesero.salaId !==
        evento.salaId
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              `${mesero.nombre} no pertenece a la sala del evento.`
          })
      }
    }

    db.asignaciones =
      db.asignaciones.filter(
        (asignacion) =>
          asignacion.eventoId !==
          eventoId
      )

    const primerId =
      generarId(
        db.asignaciones
      )

    const nuevasAsignaciones =
      meseroIds.map(
        (
          meseroId,
          index
        ) => ({
          id:
            primerId +
            index,

          eventoId,

          meseroId,

          rol:
            meseroId ===
            capitanId
              ? 'Capitán'
              : 'Mesero'
        })
      )

    db.asignaciones.push(
      ...nuevasAsignaciones
    )

    db.disponibilidades =
      db.disponibilidades.filter(
        (item) =>
          item.eventoId !==
            eventoId ||
          meseroIds.includes(
            item.meseroId
          )
      )

    db.asistencias =
      db.asistencias.filter(
        (item) =>
          item.eventoId !==
            eventoId ||
          meseroIds.includes(
            item.meseroId
          )
      )

    meseroIds.forEach(
      (meseroId) => {
        const existe =
          db.disponibilidades.some(
            (item) =>
              item.eventoId ===
                eventoId &&
              item.meseroId ===
                meseroId
          )

        if (!existe) {
          db.disponibilidades.push({
            id:
              generarId(
                db.disponibilidades
              ),

            eventoId,

            meseroId,

            estado:
              'Pendiente',

            fechaRespuesta:
              null
          })
        }
      }
    )

    res.json(
      nuevasAsignaciones
    )
  }
)

/* ========================================
   DISPONIBILIDAD
======================================== */

app.get(
  '/api/disponibilidades',
  (req, res) => {
    res.json(
      db.disponibilidades
    )
  }
)

app.get(
  '/api/disponibilidades/mesero/:meseroId',
  (req, res) => {
    const meseroId =
      Number(
        req.params.meseroId
      )

    res.json(
      db.disponibilidades.filter(
        (item) =>
          item.meseroId ===
          meseroId
      )
    )
  }
)

app.put(
  '/api/disponibilidades',
  (req, res) => {
    const eventoId =
      Number(
        req.body.eventoId
      )

    const meseroId =
      Number(
        req.body.meseroId
      )

    const estado =
      req.body.estado

    const estadosPermitidos = [
      'Pendiente',
      'Confirmado',
      'No disponible'
    ]

    if (
      !estadosPermitidos.includes(
        estado
      )
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'Estado de disponibilidad no válido.'
        })
    }

    const asignacionExiste =
      db.asignaciones.some(
        (asignacion) =>
          asignacion.eventoId ===
            eventoId &&
          asignacion.meseroId ===
            meseroId
      )

    if (!asignacionExiste) {
      return res
        .status(400)
        .json({
          mensaje:
            'El mesero no está asignado a este evento.'
        })
    }

    let registro =
      db.disponibilidades.find(
        (item) =>
          item.eventoId ===
            eventoId &&
          item.meseroId ===
            meseroId
      )

    if (
      registro &&
      (
        registro.estado ===
          'Confirmado' ||
        registro.estado ===
          'No disponible'
      ) &&
      estado !==
        registro.estado
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'La respuesta ya fue registrada de forma definitiva. El administrador debe modificar la asignación.'
        })
    }

    if (!registro) {
      registro = {
        id:
          generarId(
            db.disponibilidades
          ),

        eventoId,
        meseroId,

        estado:
          'Pendiente',

        fechaRespuesta:
          null
      }

      db.disponibilidades.push(
        registro
      )
    }

    registro.estado =
      estado

    registro.fechaRespuesta =
      obtenerFechaMexico()

    if (
      estado ===
      'No disponible'
    ) {
      const evento =
        db.eventos.find(
          (evento) =>
            evento.id ===
            eventoId
        )

      const mesero =
        db.meseros.find(
          (mesero) =>
            mesero.id ===
            meseroId
        )

      const yaExiste =
        db.notificaciones.some(
          (notificacion) =>
            notificacion.automatica ===
              true &&
            notificacion.tipo ===
              'Disponibilidad' &&
            notificacion.eventoId ===
              eventoId &&
            notificacion.meseroId ===
              meseroId
        )

      if (
        evento &&
        mesero &&
        !yaExiste
      ) {
        db.notificaciones.push({
          id:
            generarId(
              db.notificaciones
            ),

          tipo:
            'Disponibilidad',

          titulo:
            'Mesero no disponible',

          mensaje:
            `${mesero.nombre} ${mesero.apellidos} indicó que no está disponible para el evento "${evento.nombre}".`,

          eventoId:
            evento.id,

          meseroId:
            mesero.id,

          salaId:
            evento.salaId,

          destinatario:
            'Administrador',

          emisor:
            'Sistema',

          automatica:
            true,

          fecha:
            new Date()
              .toISOString(),

          leida:
            false
        })
      }
    }

    res.json(
      registro
    )
  }
)

/* ========================================
   NOTIFICACIONES
======================================== */

app.get(
  '/api/notificaciones',
  (req, res) => {
    const salaId =
      req.query.salaId
        ? Number(
            req.query.salaId
          )
        : null

    const destinatario =
      req.query.destinatario

    let resultado = [
      ...db.notificaciones
    ]

    if (salaId) {
      resultado =
        resultado.filter(
          (notificacion) =>
            notificacion.salaId ===
            salaId
        )
    }

    if (destinatario) {
      resultado =
        resultado.filter(
          (notificacion) =>
            notificacion
              .destinatario ===
            destinatario
        )
    }

    resultado.sort(
      (a, b) =>
        new Date(b.fecha) -
        new Date(a.fecha)
    )

    res.json(
      resultado
    )
  }
)

app.put(
  '/api/notificaciones/:id/leida',
  (req, res) => {
    const id =
      Number(
        req.params.id
      )

    const notificacion =
      db.notificaciones.find(
        (item) =>
          item.id === id
      )

    if (!notificacion) {
      return res
        .status(404)
        .json({
          mensaje:
            'Notificación no encontrada.'
        })
    }

    notificacion.leida =
      true

    res.json(
      notificacion
    )
  }
)

/* ========================================
   ASISTENCIA
======================================== */

app.get(
  '/api/asistencias/evento/:eventoId',
  (req, res) => {
    const eventoId =
      Number(
        req.params.eventoId
      )

    const evento =
      db.eventos.find(
        (evento) =>
          evento.id ===
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

    const fechaActual =
      obtenerFechaMexico()

    res.json({
      eventoId,

      fechaEvento:
        evento.fecha,

      fechaActual,

      habilitado:
        fechaActual ===
        evento.fecha,

      asistencias:
        db.asistencias.filter(
          (item) =>
            item.eventoId ===
            eventoId
        )
    })
  }
)

app.put(
  '/api/asistencias',
  (req, res) => {
    const eventoId =
      Number(
        req.body.eventoId
      )

    const meseroId =
      Number(
        req.body.meseroId
      )

    const capitanMeseroId =
      Number(
        req.body.capitanMeseroId
      )

    const estado =
      req.body.estado

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
      db.eventos.find(
        (evento) =>
          evento.id ===
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
      obtenerFechaMexico() !==
      evento.fecha
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'El control de asistencia solamente está disponible el día del evento.'
        })
    }

    const asignacionCapitan =
      db.asignaciones.find(
        (asignacion) =>
          asignacion.eventoId ===
            eventoId &&
          asignacion.meseroId ===
            capitanMeseroId &&
          asignacion.rol ===
            'Capitán'
      )

    if (!asignacionCapitan) {
      return res
        .status(403)
        .json({
          mensaje:
            'Este usuario no tiene asignado el rol de capitán en el evento.'
        })
    }

    const asignacionMesero =
      db.asignaciones.find(
        (asignacion) =>
          asignacion.eventoId ===
            eventoId &&
          asignacion.meseroId ===
            meseroId
      )

    if (!asignacionMesero) {
      return res
        .status(400)
        .json({
          mensaje:
            'El mesero no pertenece al personal asignado a este evento.'
        })
    }

    let asistencia =
      db.asistencias.find(
        (item) =>
          item.eventoId ===
            eventoId &&
          item.meseroId ===
            meseroId
      )

    if (!asistencia) {
      asistencia = {
        id:
          generarId(
            db.asistencias
          ),

        eventoId,
        meseroId,

        estado,

        registradoPor:
          capitanMeseroId,

        fechaRegistro:
          new Date()
            .toISOString()
      }

      db.asistencias.push(
        asistencia
      )
    } else {
      asistencia.estado =
        estado

      asistencia.registradoPor =
        capitanMeseroId

      asistencia.fechaRegistro =
        new Date()
          .toISOString()
    }

    res.json(
      asistencia
    )
  }
)

/* ========================================
   REPORTES
======================================== */

/*
  Lista general.
  La utilizaremos posteriormente
  en Reportes e historiales del
  administrador.
*/

app.get(
  '/api/reportes',
  (req, res) => {
    const salaId =
      req.query.salaId
        ? Number(
            req.query.salaId
          )
        : null

    let reportes = [
      ...db.reportes
    ]

    if (salaId) {
      reportes =
        reportes.filter(
          (reporte) =>
            reporte.salaId ===
            salaId
        )
    }

    reportes.sort(
      (a, b) =>
        new Date(
          b.fechaActualizacion
        ) -
        new Date(
          a.fechaActualizacion
        )
    )

    res.json(
      reportes
    )
  }
)

/*
  Consulta del reporte de un evento.
*/

app.get(
  '/api/reportes/evento/:eventoId',
  (req, res) => {
    const eventoId =
      Number(
        req.params.eventoId
      )

    const evento =
      db.eventos.find(
        (evento) =>
          evento.id ===
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

    const fechaActual =
      obtenerFechaMexico()

    const reporte =
      db.reportes.find(
        (reporte) =>
          reporte.eventoId ===
          eventoId
      ) || null

    res.json({
      eventoId,

      fechaEvento:
        evento.fecha,

      fechaActual,

      habilitado:
        fechaActual >=
        evento.fecha,

      reporte,

      resumenAsistencia:
        obtenerResumenAsistencia(
          eventoId
        )
    })
  }
)

/*
  Crea o actualiza el reporte.

  Borrador:
  puede seguir editándose.

  Enviado:
  queda cerrado definitivamente.
*/

app.put(
  '/api/reportes/evento/:eventoId',
  (req, res) => {
    const eventoId =
      Number(
        req.params.eventoId
      )

    const capitanMeseroId =
      Number(
        req.body
          .capitanMeseroId
      )

    const resumenServicio =
      (
        req.body
          .resumenServicio ||
        ''
      ).trim()

    const incidencias =
      (
        req.body
          .incidencias ||
        ''
      ).trim()

    const observaciones =
      (
        req.body
          .observaciones ||
        ''
      ).trim()

    const estado =
      req.body.estado

    if (
      ![
        'Borrador',
        'Enviado'
      ].includes(estado)
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'Estado de reporte no válido.'
        })
    }

    const evento =
      db.eventos.find(
        (evento) =>
          evento.id ===
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

    const fechaActual =
      obtenerFechaMexico()

    if (
      fechaActual <
      evento.fecha
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'El reporte se habilitará a partir del día del evento.'
        })
    }

    const asignacionCapitan =
      db.asignaciones.find(
        (asignacion) =>
          asignacion.eventoId ===
            eventoId &&
          asignacion.meseroId ===
            capitanMeseroId &&
          asignacion.rol ===
            'Capitán'
      )

    if (!asignacionCapitan) {
      return res
        .status(403)
        .json({
          mensaje:
            'Este usuario no tiene asignado el rol de capitán en el evento.'
        })
    }

    if (
      estado ===
        'Enviado' &&
      !resumenServicio
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'El resumen del servicio es obligatorio para enviar el reporte final.'
        })
    }

    let reporte =
      db.reportes.find(
        (reporte) =>
          reporte.eventoId ===
          eventoId
      )

    if (
      reporte?.estado ===
      'Enviado'
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'El reporte final ya fue enviado y no puede modificarse.'
        })
    }

    const resumenAsistencia =
      obtenerResumenAsistencia(
        eventoId
      )

    if (!reporte) {
      reporte = {
        id:
          generarId(
            db.reportes
          ),

        eventoId,

        salaId:
          evento.salaId,

        capitanMeseroId,

        resumenServicio,

        incidencias,

        observaciones,

        estado,

        asistencia:
          resumenAsistencia,

        fechaCreacion:
          new Date()
            .toISOString(),

        fechaActualizacion:
          new Date()
            .toISOString(),

        fechaEnvio:
          estado ===
          'Enviado'
            ? new Date()
                .toISOString()
            : null
      }

      db.reportes.push(
        reporte
      )
    } else {
      reporte.capitanMeseroId =
        capitanMeseroId

      reporte.resumenServicio =
        resumenServicio

      reporte.incidencias =
        incidencias

      reporte.observaciones =
        observaciones

      reporte.estado =
        estado

      reporte.asistencia =
        resumenAsistencia

      reporte.fechaActualizacion =
        new Date()
          .toISOString()

      if (
        estado ===
        'Enviado'
      ) {
        reporte.fechaEnvio =
          new Date()
            .toISOString()
      }
    }

    res.json({
      mensaje:
        estado ===
        'Enviado'
          ? 'Reporte final enviado correctamente.'
          : 'Borrador guardado correctamente.',

      reporte,

      resumenAsistencia
    })
  }
)

/* ========================================
   SERVIDOR
======================================== */

app.listen(
  PORT,
  () => {
    console.log(
      `MesereArte API ejecutándose en http://localhost:${PORT}`
    )
  }
)