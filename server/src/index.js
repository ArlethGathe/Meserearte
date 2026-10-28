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

/*
  Por compatibilidad con data.js actual.
*/
if (!db.notificaciones) {
  db.notificaciones = []
}

function generarId(lista) {
  if (lista.length === 0) return 1

  return Math.max(
    ...lista.map((item) => item.id)
  ) + 1
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

/* ========================================
   HEALTH
======================================== */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mensaje:
      'API de MesereArte funcionando'
  })
})

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

    const usuario =
      db.usuarios.find(
        (usuario) =>
          usuario.correo.toLowerCase() ===
            correo.trim().toLowerCase() &&
          usuario.password === password &&
          usuario.rol === rol
      )

    if (!usuario) {
      return res.status(401).json({
        mensaje:
          'Correo, contraseña o tipo de usuario incorrectos.'
      })
    }

    if (usuario.estado !== 'Activo') {
      return res.status(403).json({
        mensaje:
          'El usuario se encuentra inactivo.'
      })
    }

    const {
      password: passwordOculto,
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
      return res.status(400).json({
        mensaje:
          'Completa todos los campos.'
      })
    }

    const correoExiste =
      db.usuarios.some(
        (usuario) =>
          usuario.correo.toLowerCase() ===
          correo.trim().toLowerCase()
      )

    if (correoExiste) {
      return res.status(400).json({
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
        generarId(db.salas),

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

    db.salas.push(nuevaSala)

    const nuevoUsuario = {
      id:
        generarId(db.usuarios),

      nombre,
      apellidos,

      correo:
        correo.trim().toLowerCase(),

      password,

      rol:
        'Administrador',

      salaId:
        nuevaSala.id,

      estado:
        'Activo'
    }

    db.usuarios.push(nuevoUsuario)

    const {
      password: passwordOculto,
      ...usuarioSeguro
    } = nuevoUsuario

    res.status(201).json({
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
      return res.status(400).json({
        mensaje:
          'Completa todos los campos.'
      })
    }

    const correoExiste =
      db.usuarios.some(
        (usuario) =>
          usuario.correo.toLowerCase() ===
          correo.trim().toLowerCase()
      )

    if (correoExiste) {
      return res.status(400).json({
        mensaje:
          'El correo ya está registrado.'
      })
    }

    const sala =
      db.salas.find(
        (sala) =>
          sala.codigo.toUpperCase() ===
            codigoSala
              .trim()
              .toUpperCase() &&
          sala.estado === 'Activa'
      )

    if (!sala) {
      return res.status(400).json({
        mensaje:
          'El código de sala no existe o la sala no está activa.'
      })
    }

    const nuevoUsuario = {
      id:
        generarId(db.usuarios),

      nombre,
      apellidos,

      correo:
        correo.trim().toLowerCase(),

      password,

      rol:
        'Mesero',

      salaId:
        sala.id,

      estado:
        'Activo'
    }

    db.usuarios.push(nuevoUsuario)

    const nuevoMesero = {
      id:
        generarId(db.meseros),

      nombre,
      apellidos,

      correo:
        correo.trim().toLowerCase(),

      telefono: '',

      salaId:
        sala.id,

      eventosParticipados: 0,

      estado:
        'Activo',

      disponibilidad:
        'Disponible'
    }

    db.meseros.push(nuevoMesero)

    const {
      password: passwordOculto,
      ...usuarioSeguro
    } = nuevoUsuario

    res.status(201).json({
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
    const usuariosSeguros =
      db.usuarios.map(
        ({
          password,
          ...usuario
        }) => usuario
      )

    res.json(
      usuariosSeguros
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
        generarId(db.salas),

      nombre:
        req.body.nombre,

      descripcion:
        req.body.descripcion || '',

      codigo,

      administrador:
        req.body.administrador ||
        'Administrador',

      estado:
        'Activa'
    }

    db.salas.push(nuevaSala)

    res.status(201).json(
      nuevaSala
    )
  }
)

app.put(
  '/api/salas/:id',
  (req, res) => {
    const id =
      Number(req.params.id)

    const indice =
      db.salas.findIndex(
        (sala) =>
          sala.id === id
      )

    if (indice === -1) {
      return res.status(404).json({
        mensaje:
          'Sala no encontrada'
      })
    }

    db.salas[indice] = {
      ...db.salas[indice],

      nombre:
        req.body.nombre ??
        db.salas[indice].nombre,

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
      Number(req.params.id)

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
      return res.status(400).json({
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
        'Sala eliminada correctamente'
    })
  }
)

/* ========================================
   MESEROS
======================================== */

app.get(
  '/api/meseros',
  (req, res) => {
    res.json(db.meseros)
  }
)

app.post(
  '/api/meseros',
  (req, res) => {
    const nuevoMesero = {
      id:
        generarId(db.meseros),

      nombre:
        req.body.nombre,

      apellidos:
        req.body.apellidos,

      correo:
        req.body.correo,

      telefono:
        req.body.telefono || '',

      salaId:
        Number(req.body.salaId),

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

    res.status(201).json(
      nuevoMesero
    )
  }
)

app.put(
  '/api/meseros/:id',
  (req, res) => {
    const id =
      Number(req.params.id)

    const indice =
      db.meseros.findIndex(
        (mesero) =>
          mesero.id === id
      )

    if (indice === -1) {
      return res.status(404).json({
        mensaje:
          'Mesero no encontrado'
      })
    }

    db.meseros[indice] = {
      ...db.meseros[indice],
      ...req.body,

      salaId:
        req.body.salaId !== undefined
          ? Number(
              req.body.salaId
            )
          : db.meseros[indice]
              .salaId,

      eventosParticipados:
        db.meseros[indice]
          .eventosParticipados
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
      Number(req.params.id)

    db.meseros =
      db.meseros.filter(
        (mesero) =>
          mesero.id !== id
      )

    db.asignaciones =
      db.asignaciones.filter(
        (asignacion) =>
          asignacion.meseroId !== id
      )

    db.disponibilidades =
      db.disponibilidades.filter(
        (disponibilidad) =>
          disponibilidad.meseroId !== id
      )

    res.json({
      mensaje:
        'Mesero eliminado correctamente'
    })
  }
)

/* ========================================
   EVENTOS
======================================== */

app.get(
  '/api/eventos',
  (req, res) => {
    res.json(db.eventos)
  }
)

app.post(
  '/api/eventos',
  (req, res) => {
    const nuevoEvento = {
      id:
        generarId(db.eventos),

      salaId:
        Number(req.body.salaId),

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
        req.body.uniforme || '',

      observaciones:
        req.body.observaciones || '',

      estado:
        req.body.estado ||
        'Pendiente'
    }

    db.eventos.push(
      nuevoEvento
    )

    res.status(201).json(
      nuevoEvento
    )
  }
)

app.put(
  '/api/eventos/:id',
  (req, res) => {
    const id =
      Number(req.params.id)

    const indice =
      db.eventos.findIndex(
        (evento) =>
          evento.id === id
      )

    if (indice === -1) {
      return res.status(404).json({
        mensaje:
          'Evento no encontrado'
      })
    }

    db.eventos[indice] = {
      ...db.eventos[indice],
      ...req.body,

      salaId:
        req.body.salaId !== undefined
          ? Number(
              req.body.salaId
            )
          : db.eventos[indice]
              .salaId,

      invitados:
        Number(
          req.body.invitados ??
          db.eventos[indice]
            .invitados
        ),

      meserosRequeridos:
        Number(
          req.body
            .meserosRequeridos ??
          db.eventos[indice]
            .meserosRequeridos
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
      Number(req.params.id)

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
        (disponibilidad) =>
          disponibilidad.eventoId !== id
      )

    res.json({
      mensaje:
        'Evento eliminado correctamente'
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

app.put(
  '/api/asignaciones/evento/:eventoId',
  (req, res) => {
    const eventoId =
      Number(
        req.params.eventoId
      )

    const meseroIds =
      (
        req.body.meseroIds ||
        []
      ).map(Number)

    const capitanId =
      req.body.capitanId
        ? Number(
            req.body.capitanId
          )
        : null

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
        (meseroId, index) => ({
          id:
            primerId + index,

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

    /*
      Quitamos disponibilidad
      de quienes fueron retirados.
    */

    db.disponibilidades =
      db.disponibilidades.filter(
        (item) =>
          item.eventoId !==
            eventoId ||
          meseroIds.includes(
            item.meseroId
          )
      )

    /*
      Nueva asignación = Pendiente.
    */

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

    const asignacionExiste =
      db.asignaciones.some(
        (asignacion) =>
          asignacion.eventoId ===
            eventoId &&
          asignacion.meseroId ===
            meseroId
      )

    if (!asignacionExiste) {
      return res.status(400).json({
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

    /*
      Confirmación definitiva.
    */

    if (
      registro?.estado ===
        'Confirmado' &&
      estado !== 'Confirmado'
    ) {
      return res.status(400).json({
        mensaje:
          'La asistencia ya fue confirmada. El administrador debe modificar la asignación.'
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
      new Date()
        .toISOString()
        .split('T')[0]

    /*
      ==========================
      NOTIFICACIÓN AUTOMÁTICA
      ==========================
    */

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
            notificacion
              .automatica === true &&
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

    res.json(registro)
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
            notificacion.destinatario ===
            destinatario
        )
    }

    resultado.sort(
      (a, b) =>
        new Date(b.fecha) -
        new Date(a.fecha)
    )

    res.json(resultado)
  }
)

app.put(
  '/api/notificaciones/:id/leida',
  (req, res) => {
    const id =
      Number(req.params.id)

    const notificacion =
      db.notificaciones.find(
        (item) =>
          item.id === id
      )

    if (!notificacion) {
      return res.status(404).json({
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
   SERVIDOR
======================================== */

app.listen(PORT, () => {
  console.log(
    `MesereArte API ejecutándose en http://localhost:${PORT}`
  )
})