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

/* =========================================================
   ARREGLOS AUXILIARES
========================================================= */

if (!db.notificaciones) {
  db.notificaciones = []
}

if (!db.asistencias) {
  db.asistencias = []
}

if (!db.reportes) {
  db.reportes = []
}

/* =========================================================
   FUNCIONES GENERALES
========================================================= */

function generarId(lista) {
  if (!lista || lista.length === 0) {
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
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
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

function normalizarFecha(fecha) {
  if (!fecha) {
    return ''
  }

  return String(fecha)
    .split('T')[0]
}

function normalizarUbicacion(
  ubicacion
) {
  if (!ubicacion) {
    return ''
  }

  return ubicacion
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /\s+/g,
      ' '
    )
}

/* =========================================================
   HORARIOS Y TRASLAPES
========================================================= */

function extraerHorasEvento(
  evento
) {
  if (
    evento.horaInicio &&
    evento.horaFin
  ) {
    return {
      inicio:
        evento.horaInicio,

      fin:
        evento.horaFin
    }
  }

  if (!evento.horario) {
    return {
      inicio: null,
      fin: null
    }
  }

  const horas =
    String(
      evento.horario
    ).match(
      /\d{1,2}:\d{2}/g
    ) || []

  return {
    inicio:
      horas[0] || null,

    fin:
      horas[1] || null
  }
}

function convertirHoraAMinutos(
  hora
) {
  if (!hora) {
    return null
  }

  const [
    horas,
    minutos
  ] = hora
    .split(':')
    .map(Number)

  if (
    Number.isNaN(horas) ||
    Number.isNaN(minutos)
  ) {
    return null
  }

  return (
    horas * 60 +
    minutos
  )
}

function obtenerIntervaloEvento(
  evento
) {
  const fecha =
    normalizarFecha(
      evento.fecha
    )

  const {
    inicio,
    fin
  } =
    extraerHorasEvento(
      evento
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

  const minutosInicio =
    convertirHoraAMinutos(
      inicio
    )

  const minutosFin =
    convertirHoraAMinutos(
      fin
    )

  if (
    minutosInicio === null ||
    minutosFin === null
  ) {
    return null
  }

  const inicioDia =
    Date.UTC(
      anio,
      mes - 1,
      dia
    ) / 60000

  const inicioTotal =
    inicioDia +
    minutosInicio

  let finTotal =
    inicioDia +
    minutosFin

  /*
    Si la hora final es menor que
    la inicial, internamente se
    interpreta que termina después
    de medianoche.
  */

  if (
    finTotal <
    inicioTotal
  ) {
    finTotal += 24 * 60
  }

  return {
    inicio:
      inicioTotal,

    fin:
      finTotal
  }
}

function hayTraslapeEventos(
  eventoA,
  eventoB
) {
  const intervaloA =
    obtenerIntervaloEvento(
      eventoA
    )

  const intervaloB =
    obtenerIntervaloEvento(
      eventoB
    )

  if (
    !intervaloA ||
    !intervaloB
  ) {
    return false
  }

  return (
    intervaloA.inicio <
      intervaloB.fin &&
    intervaloA.fin >
      intervaloB.inicio
  )
}

function buscarConflictoMesero(
  meseroId,
  eventoNuevo,
  eventoIgnoradoId = null
) {
  const asignacionesMesero =
    db.asignaciones.filter(
      (asignacion) =>
        asignacion.meseroId ===
          meseroId &&
        asignacion.eventoId !==
          eventoIgnoradoId
    )

  for (
    const asignacion of
    asignacionesMesero
  ) {
    const otroEvento =
      db.eventos.find(
        (evento) =>
          evento.id ===
          asignacion.eventoId
      )

    if (
      otroEvento &&
      hayTraslapeEventos(
        eventoNuevo,
        otroEvento
      )
    ) {
      return otroEvento
    }
  }

  return null
}

/* =========================================================
   UBICACIÓN
========================================================= */

function buscarEventoMismaUbicacion(
  eventoNuevo,
  eventoIgnoradoId = null
) {
  const fecha =
    normalizarFecha(
      eventoNuevo.fecha
    )

  const ubicacion =
    normalizarUbicacion(
      eventoNuevo.ubicacion
    )

  if (
    !fecha ||
    !ubicacion
  ) {
    return null
  }

  return db.eventos.find(
    (evento) =>
      evento.id !==
        eventoIgnoradoId &&
      normalizarFecha(
        evento.fecha
      ) === fecha &&
      normalizarUbicacion(
        evento.ubicacion
      ) === ubicacion
  )
}

/* =========================================================
   ASISTENCIA
========================================================= */

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

/* =========================================================
   EVALUACIONES DE PERSONAL
========================================================= */

function normalizarEvaluacionesPersonal(
  evaluaciones = []
) {
  if (!Array.isArray(evaluaciones)) {
    return []
  }

  return evaluaciones.map(
    (evaluacion) => ({
      meseroId:
        Number(
          evaluacion.meseroId
        ),

      desempeno:
        evaluacion.desempeno === '' ||
        evaluacion.desempeno === null ||
        evaluacion.desempeno === undefined
          ? null
          : Number(
              evaluacion.desempeno
            ),

      puntualidad:
        evaluacion.puntualidad === '' ||
        evaluacion.puntualidad === null ||
        evaluacion.puntualidad === undefined
          ? null
          : Number(
              evaluacion.puntualidad
            ),

      actitud:
        evaluacion.actitud === '' ||
        evaluacion.actitud === null ||
        evaluacion.actitud === undefined
          ? null
          : Number(
              evaluacion.actitud
            ),

      incidencia:
        Boolean(
          evaluacion.incidencia
        ),

      observacion:
        (
          evaluacion.observacion ||
          ''
        ).trim()
    })
  )
}

function evaluacionValida(
  evaluacion
) {
  const valores = [
    evaluacion.desempeno,
    evaluacion.puntualidad,
    evaluacion.actitud
  ]

  return valores.every(
    (valor) =>
      Number.isInteger(
        valor
      ) &&
      valor >= 1 &&
      valor <= 5
  )
}

/* =========================================================
   HEALTH
========================================================= */

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

/* =========================================================
   LOGIN
========================================================= */

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
          usuario.rol ===
            rol
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

/* =========================================================
   REGISTRO ADMINISTRADOR
========================================================= */

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

    const existe =
      db.usuarios.some(
        (usuario) =>
          usuario.correo
            .toLowerCase() ===
          correoNormalizado
      )

    if (existe) {
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
          sala.codigo ===
          codigo
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

/* =========================================================
   REGISTRO MESERO
========================================================= */

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

    const existe =
      db.usuarios.some(
        (usuario) =>
          usuario.correo
            .toLowerCase() ===
          correoNormalizado
      )

    if (existe) {
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

/* =========================================================
   USUARIOS
========================================================= */

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

/* =========================================================
   SALAS
========================================================= */

app.get(
  '/api/salas',
  (req, res) => {
    res.json(
      db.salas
    )
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
        db.salas[indice].nombre,

      descripcion:
        req.body.descripcion ??
        db.salas[indice].descripcion
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

/* =========================================================
   MESEROS
========================================================= */

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

/* =========================================================
   EVENTOS
========================================================= */

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
    const {
      salaId,
      nombre,
      tipo,
      fecha,
      horaInicio,
      horaFin,
      horario,
      ubicacion
    } = req.body

    if (
      !salaId ||
      !nombre ||
      !fecha ||
      !ubicacion
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'Completa los datos obligatorios del evento.'
        })
    }

    if (
      horaInicio &&
      horaFin &&
      horaInicio ===
        horaFin
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'La hora de inicio y la hora de término no pueden ser iguales.'
        })
    }

    const eventoTemporal = {
      fecha,
      ubicacion,
      horaInicio,
      horaFin,
      horario
    }

    const conflictoUbicacion =
      buscarEventoMismaUbicacion(
        eventoTemporal
      )

    if (conflictoUbicacion) {
      return res
        .status(400)
        .json({
          mensaje:
            `Ya existe el evento "${conflictoUbicacion.nombre}" en esa ubicación para la misma fecha.`
        })
    }

    const nuevoEvento = {
      id:
        generarId(
          db.eventos
        ),

      salaId:
        Number(salaId),

      nombre,

      tipo,

      fecha:
        normalizarFecha(
          fecha
        ),

      horaInicio:
        horaInicio ||
        '',

      horaFin:
        horaFin ||
        '',

      horario:
        horario ||
        (
          horaInicio &&
          horaFin
            ? `${horaInicio} - ${horaFin}`
            : ''
        ),

      ubicacion,

      invitados:
        Number(
          req.body.invitados ||
          0
        ),

      meserosRequeridos:
        Number(
          req.body.meserosRequeridos ||
          0
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

    const eventoAnterior =
      db.eventos[indice]

    const eventoActualizado = {
      ...eventoAnterior,
      ...req.body,

      id,

      salaId:
        req.body.salaId !==
        undefined
          ? Number(
              req.body.salaId
            )
          : eventoAnterior.salaId,

      fecha:
        req.body.fecha
          ? normalizarFecha(
              req.body.fecha
            )
          : eventoAnterior.fecha,

      invitados:
        Number(
          req.body.invitados ??
          eventoAnterior.invitados
        ),

      meserosRequeridos:
        Number(
          req.body.meserosRequeridos ??
          eventoAnterior.meserosRequeridos
        )
    }

    if (
      eventoActualizado.horaInicio &&
      eventoActualizado.horaFin &&
      eventoActualizado.horaInicio ===
        eventoActualizado.horaFin
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'La hora de inicio y la hora de término no pueden ser iguales.'
        })
    }

    if (
      eventoActualizado.horaInicio &&
      eventoActualizado.horaFin
    ) {
      eventoActualizado.horario =
        `${eventoActualizado.horaInicio} - ${eventoActualizado.horaFin}`
    }

    const conflictoUbicacion =
      buscarEventoMismaUbicacion(
        eventoActualizado,
        id
      )

    if (conflictoUbicacion) {
      return res
        .status(400)
        .json({
          mensaje:
            `Ya existe el evento "${conflictoUbicacion.nombre}" en esa ubicación para la misma fecha.`
        })
    }

    const personalAsignado =
      db.asignaciones.filter(
        (asignacion) =>
          asignacion.eventoId === id
      )

    for (
      const asignacion of
      personalAsignado
    ) {
      const conflicto =
        buscarConflictoMesero(
          asignacion.meseroId,
          eventoActualizado,
          id
        )

      if (conflicto) {
        const mesero =
          db.meseros.find(
            (item) =>
              item.id ===
              asignacion.meseroId
          )

        return res
          .status(400)
          .json({
            mensaje:
              `${mesero?.nombre || 'Un mesero'} ${mesero?.apellidos || ''} tendría traslape con el evento "${conflicto.nombre}".`
          })
      }
    }

    db.eventos[indice] =
      eventoActualizado

    res.json(
      eventoActualizado
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
          asignacion.eventoId !==
          id
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

/* =========================================================
   ASIGNACIONES
========================================================= */

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
              `${mesero.nombre} ${mesero.apellidos} no se encuentra activo.`
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
              `${mesero.nombre} ${mesero.apellidos} no pertenece a la sala del evento.`
          })
      }

      const conflicto =
        buscarConflictoMesero(
          meseroId,
          evento,
          eventoId
        )

      if (conflicto) {
        return res
          .status(400)
          .json({
            mensaje:
              `${mesero.nombre} ${mesero.apellidos} ya está asignado al evento "${conflicto.nombre}" durante un horario que se traslapa.`
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

/* =========================================================
   DISPONIBILIDAD
========================================================= */

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

          destinatarioMeseroId:
            null,

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

/* =========================================================
   ENVIAR NOTIFICACIONES
========================================================= */

app.post(
  '/api/notificaciones',
  (req, res) => {
    const {
      tipo,
      titulo,
      mensaje,
      salaId,
      eventoId,
      modoDestinatario,
      meseroId
    } = req.body

    if (
      !tipo ||
      !titulo ||
      !mensaje ||
      !salaId ||
      !modoDestinatario
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'Completa los datos de la notificación.'
        })
    }

    const salaIdNumero =
      Number(salaId)

    const sala =
      db.salas.find(
        (sala) =>
          sala.id ===
          salaIdNumero
      )

    if (!sala) {
      return res
        .status(404)
        .json({
          mensaje:
            'La sala seleccionada no existe.'
        })
    }

    let destinatarios = []

    if (
      modoDestinatario ===
      'Todos'
    ) {
      destinatarios =
        db.meseros.filter(
          (mesero) =>
            mesero.salaId ===
              salaIdNumero &&
            mesero.estado ===
              'Activo'
        )
    }

    if (
      modoDestinatario ===
      'Evento'
    ) {
      const evento =
        db.eventos.find(
          (evento) =>
            evento.id ===
              Number(eventoId) &&
            evento.salaId ===
              salaIdNumero
        )

      if (!evento) {
        return res
          .status(400)
          .json({
            mensaje:
              'Selecciona un evento válido.'
          })
      }

      const ids =
        db.asignaciones
          .filter(
            (asignacion) =>
              asignacion.eventoId ===
              evento.id
          )
          .map(
            (asignacion) =>
              asignacion.meseroId
          )

      destinatarios =
        db.meseros.filter(
          (mesero) =>
            ids.includes(
              mesero.id
            ) &&
            mesero.estado ===
              'Activo'
        )
    }

    if (
      modoDestinatario ===
      'Individual'
    ) {
      const mesero =
        db.meseros.find(
          (mesero) =>
            mesero.id ===
              Number(meseroId) &&
            mesero.salaId ===
              salaIdNumero &&
            mesero.estado ===
              'Activo'
        )

      if (!mesero) {
        return res
          .status(400)
          .json({
            mensaje:
              'Selecciona un mesero válido.'
          })
      }

      destinatarios = [
        mesero
      ]
    }

    if (
      destinatarios.length ===
      0
    ) {
      return res
        .status(400)
        .json({
          mensaje:
            'No hay meseros disponibles para recibir este aviso.'
        })
    }

    const envioId =
      `ENV-${Date.now()}-${Math.floor(
        Math.random() *
        10000
      )}`

    const eventoNumero =
      eventoId
        ? Number(eventoId)
        : null

    const primerId =
      generarId(
        db.notificaciones
      )

    const nuevas =
      destinatarios.map(
        (
          mesero,
          index
        ) => ({
          id:
            primerId +
            index,

          envioId,

          tipo,

          titulo:
            titulo.trim(),

          mensaje:
            mensaje.trim(),

          salaId:
            salaIdNumero,

          eventoId:
            eventoNumero,

          meseroId:
            null,

          destinatario:
            'Mesero',

          destinatarioMeseroId:
            mesero.id,

          modoDestinatario,

          emisor:
            'Administrador',

          automatica:
            false,

          fecha:
            new Date()
              .toISOString(),

          leida:
            false
        })
      )

    db.notificaciones.push(
      ...nuevas
    )

    res
      .status(201)
      .json({
        mensaje:
          'Notificación enviada correctamente.',

        envioId,

        enviados:
          nuevas.length
      })
  }
)

app.get(
  '/api/notificaciones/enviadas',
  (req, res) => {
    const salaId =
      req.query.salaId
        ? Number(
            req.query.salaId
          )
        : null

    let enviadas =
      db.notificaciones.filter(
        (notificacion) =>
          notificacion.emisor ===
            'Administrador' &&
          notificacion.destinatario ===
            'Mesero'
      )

    if (salaId) {
      enviadas =
        enviadas.filter(
          (notificacion) =>
            notificacion.salaId ===
            salaId
        )
    }

    const grupos = {}

    enviadas.forEach(
      (notificacion) => {
        const clave =
          notificacion.envioId ||
          `IND-${notificacion.id}`

        if (!grupos[clave]) {
          grupos[clave] = {
            envioId:
              clave,

            tipo:
              notificacion.tipo,

            titulo:
              notificacion.titulo,

            mensaje:
              notificacion.mensaje,

            salaId:
              notificacion.salaId,

            eventoId:
              notificacion.eventoId,

            modoDestinatario:
              notificacion
                .modoDestinatario,

            fecha:
              notificacion.fecha,

            enviados: 0,

            leidos: 0
          }
        }

        grupos[clave]
          .enviados += 1

        if (
          notificacion.leida
        ) {
          grupos[clave]
            .leidos += 1
        }
      }
    )

    const resultado =
      Object.values(
        grupos
      ).sort(
        (a, b) =>
          new Date(b.fecha) -
          new Date(a.fecha)
      )

    res.json(
      resultado
    )
  }
)

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

    const meseroId =
      req.query.meseroId
        ? Number(
            req.query.meseroId
          )
        : null

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

    if (meseroId) {
      resultado =
        resultado.filter(
          (notificacion) =>
            notificacion.destinatarioMeseroId ===
            meseroId
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

/* =========================================================
   ASISTENCIAS
========================================================= */

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
        normalizarFecha(
          evento.fecha
        ),

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
      normalizarFecha(
        evento.fecha
      )
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

/* =========================================================
   REPORTES
========================================================= */

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
        normalizarFecha(
          evento.fecha
        ),

      reporte,

      resumenAsistencia:
        obtenerResumenAsistencia(
          eventoId
        )
    })
  }
)

/* =========================================================
   GUARDAR / ENVIAR REPORTE DEL CAPITÁN
========================================================= */

app.put(
  '/api/reportes/evento/:eventoId',
  (req, res) => {
    const eventoId =
      Number(
        req.params.eventoId
      )

    const capitanMeseroId =
      Number(
        req.body.capitanMeseroId
      )

    const resumenServicio =
      (
        req.body.resumenServicio ||
        ''
      ).trim()

    const incidencias =
      (
        req.body.incidencias ||
        ''
      ).trim()

    const observaciones =
      (
        req.body.observaciones ||
        ''
      ).trim()

    const estado =
      req.body.estado

    const evaluacionesPersonal =
      normalizarEvaluacionesPersonal(
        req.body.evaluacionesPersonal
      )

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
      normalizarFecha(
        evento.fecha
      )
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

    /*
      Validación de evaluaciones.
    */

    for (
      const evaluacion of
      evaluacionesPersonal
    ) {
      const asignado =
        db.asignaciones.some(
          (asignacion) =>
            asignacion.eventoId ===
              eventoId &&
            asignacion.meseroId ===
              evaluacion.meseroId
        )

      if (!asignado) {
        return res
          .status(400)
          .json({
            mensaje:
              'Existe una evaluación para un mesero que no pertenece al evento.'
          })
      }

      if (
        evaluacion.meseroId ===
        capitanMeseroId
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'El capitán no puede evaluarse a sí mismo.'
          })
      }

      if (
        estado ===
          'Enviado' &&
        !evaluacionValida(
          evaluacion
        )
      ) {
        return res
          .status(400)
          .json({
            mensaje:
              'Todas las evaluaciones deben tener calificaciones del 1 al 5.'
          })
      }
    }

    /*
      Para enviar el reporte final,
      todos los meseros presentes
      deben estar evaluados.
    */

    if (
      estado ===
      'Enviado'
    ) {
      const presentes =
        db.asistencias
          .filter(
            (asistencia) =>
              asistencia.eventoId ===
                eventoId &&
              asistencia.estado ===
                'Presente' &&
              asistencia.meseroId !==
                capitanMeseroId
          )
          .map(
            (asistencia) =>
              asistencia.meseroId
          )

      for (
        const meseroId of
        presentes
      ) {
        const evaluacion =
          evaluacionesPersonal.find(
            (item) =>
              item.meseroId ===
              meseroId
          )

        if (
          !evaluacion ||
          !evaluacionValida(
            evaluacion
          )
        ) {
          const mesero =
            db.meseros.find(
              (item) =>
                item.id ===
                meseroId
            )

          return res
            .status(400)
            .json({
              mensaje:
                `Debes evaluar a ${mesero?.nombre || 'todos los meseros presentes'} antes de enviar el reporte final.`
            })
        }
      }
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

        evaluacionesPersonal,

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

      reporte.evaluacionesPersonal =
        evaluacionesPersonal

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

/* =========================================================
   SERVIDOR
========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `MesereArte API ejecutándose en http://localhost:${PORT}`
    )
  }
)