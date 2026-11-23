import {
  useEffect,
  useState
} from 'react'

import './CapitanReporte.css'

import { API_URL, apiFetch } from '../api.js'

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

function CapitanReporte({
  evento,
  mesero,
  actualizacionAsistencia = 0
}) {
  const [
    cargando,
    setCargando
  ] = useState(true)

  const [
    guardando,
    setGuardando
  ] = useState(false)

  const [
    error,
    setError
  ] = useState('')

  const [
    mensaje,
    setMensaje
  ] = useState('')

  const [
    habilitado,
    setHabilitado
  ] = useState(false)

  const [
    reporteEnviado,
    setReporteEnviado
  ] = useState(false)

  const [
    resumenAsistencia,
    setResumenAsistencia
  ] = useState({
    total: 0,
    presentes: 0,
    ausentes: 0,
    sinRegistrar: 0
  })

  const [
    resumenServicio,
    setResumenServicio
  ] = useState('')

  const [
    incidencias,
    setIncidencias
  ] = useState('')

  const [
    observaciones,
    setObservaciones
  ] = useState('')

  const [
    evaluaciones,
    setEvaluaciones
  ] = useState([])

  /* ========================================
     CARGAR REPORTE
  ======================================== */

  useEffect(
    () => {
      if (
        !evento?.id ||
        !mesero?.id
      ) {
        return
      }

      cargarReporte()
    },
    [
      evento?.id,
      evento?.fecha,
      mesero?.id,
      actualizacionAsistencia
    ]
  )

  const cargarReporte =
  async () => {
    try {
      setCargando(true)

      setError('')
      setMensaje('')

      const [
        respuestaReporte,
        respuestaAsignaciones,
        respuestaMeseros,
        respuestaAsistencias
      ] =
        await Promise.all([
          apiFetch(
            `${API_URL}/reportes/evento/${evento.id}`
          ),

          apiFetch(
            `${API_URL}/asignaciones`
          ),

          apiFetch(
            `${API_URL}/meseros`
          ),

          apiFetch(
            `${API_URL}/asistencias/evento/${evento.id}`
          )
        ])

      /*
        Que no exista todavía un reporte
        NO es un error.

        404 significa simplemente que
        todavía no se ha creado.
      */

      let reporte = null

      if (
        respuestaReporte.ok
      ) {
        reporte =
          await respuestaReporte.json()

      } else if (
        respuestaReporte.status !==
        404
      ) {
        const datosError =
          await respuestaReporte.json()

        throw new Error(
          datosError.mensaje ||
          'No se pudo cargar el reporte.'
        )
      }

      if (
        !respuestaAsignaciones.ok ||
        !respuestaMeseros.ok ||
        !respuestaAsistencias.ok
      ) {
        throw new Error(
          'No se pudo cargar la información del personal.'
        )
      }

      const todasAsignaciones =
        await respuestaAsignaciones.json()

      const meseros =
        await respuestaMeseros.json()

      const datosAsistencia =
        await respuestaAsistencias.json()

      /*
        /api/asignaciones devuelve todas
        las asignaciones.

        Aquí conservamos solamente las
        correspondientes al evento actual.
      */

      const asignaciones =
        todasAsignaciones.filter(
          (asignacion) =>
            Number(
              asignacion.eventoId
            ) ===
            Number(
              evento.id
            )
        )

      /*
        Determinar si el reporte ya puede
        elaborarse.

        La regla es:
        desde el día del evento en adelante.
      */

      const fechaEvento =
  String(
    evento.fecha ||
    ''
  ).slice(
    0,
    10
  )

const hoy =
  fechaHoyMexico()

const puedeReportar =
  Boolean(
    fechaEvento &&
    fechaEvento <= hoy
  )

setHabilitado(
  puedeReportar
)
      /*
        RESUMEN DE ASISTENCIA

        El backend devuelve directamente
        un arreglo.
      */

      const asistencias =
        Array.isArray(
          datosAsistencia
        )
          ? datosAsistencia
          : []

      const presentes =
        asistencias.filter(
          (asistencia) =>
            asistencia.estado ===
            'Presente'
        )

      const ausentes =
        asistencias.filter(
          (asistencia) =>
            asistencia.estado ===
            'Ausente'
        )

      const sinRegistrar =
        asistencias.filter(
          (asistencia) =>
            asistencia.estado ===
            'Sin registrar'
        )

      setResumenAsistencia({
        total:
          asistencias.length,

        presentes:
          presentes.length,

        ausentes:
          ausentes.length,

        sinRegistrar:
          sinRegistrar.length
      })

      /*
        Si existe un reporte previo,
        cargamos sus datos.
      */

      if (reporte) {
        setResumenServicio(
          reporte.resumenServicio ||
          ''
        )

        setIncidencias(
          reporte.incidencias ||
          ''
        )

        setObservaciones(
          reporte.observaciones ||
          ''
        )

        setReporteEnviado(
          reporte.estado ===
          'Enviado'
        )

      } else {
        setResumenServicio('')
        setIncidencias('')
        setObservaciones('')

        setReporteEnviado(
          false
        )
      }

      /*
        Solamente se evalúan meseros
        presentes.

        El capitán no se evalúa
        a sí mismo.
      */

      const presentesIds =
        presentes.map(
          (asistencia) =>
            Number(
              asistencia.meseroId
            )
        )

      const personalEvaluable =
        asignaciones
          .filter(
            (asignacion) =>
              Number(
                asignacion.meseroId
              ) !==
                Number(
                  mesero.id
                ) &&

              presentesIds.includes(
                Number(
                  asignacion.meseroId
                )
              )
          )
          .map(
            (asignacion) => {
              const datosMesero =
                meseros.find(
                  (item) =>
                    Number(
                      item.id
                    ) ===
                    Number(
                      asignacion.meseroId
                    )
                )

              const evaluacionAnterior =
                reporte
                  ?.evaluacionesPersonal
                  ?.find(
                    (evaluacion) =>
                      Number(
                        evaluacion.meseroId
                      ) ===
                      Number(
                        asignacion.meseroId
                      )
                  )

              return {
                meseroId:
                  Number(
                    asignacion.meseroId
                  ),

                nombre:
                  datosMesero
                    ? `${datosMesero.nombre} ${datosMesero.apellidos}`
                    : 'Mesero',

                desempeno:
                  evaluacionAnterior
                    ?.desempeno ??
                  '',

                puntualidad:
                  evaluacionAnterior
                    ?.puntualidad ??
                  '',

                actitud:
                  evaluacionAnterior
                    ?.actitud ??
                  '',

                incidencia:
                  evaluacionAnterior
                    ?.incidencia ??
                  false,

                observacion:
                  evaluacionAnterior
                    ?.observacion ||
                  ''
              }
            }
          )

      setEvaluaciones(
        personalEvaluable
      )

    } catch (error) {
      console.error(
        'Error cargar reporte:',
        error
      )

      setError(
        error.message
      )

    } finally {
      setCargando(
        false
      )
    }
  }

  /* ========================================
   CAMBIAR EVALUACIÓN
======================================== */

const cambiarEvaluacion = (
  meseroId,
  campo,
  valor
) => {
  setMensaje('')
  setError('')

  setEvaluaciones(
    (anteriores) =>
      anteriores.map(
        (evaluacion) =>
          Number(
            evaluacion.meseroId
          ) ===
          Number(
            meseroId
          )
            ? {
                ...evaluacion,

                [campo]:
                  campo === 'incidencia'
                    ? Boolean(valor)
                    : String(valor)
              }
            : evaluacion
      )
  )
}


/* ========================================
   EVALUACIONES COMPLETAS
======================================== */

const evaluacionesCompletas =
  () => {
    return evaluaciones.every(
      (evaluacion) =>
        String(
          evaluacion.desempeno ??
          ''
        ) !== '' &&

        String(
          evaluacion.puntualidad ??
          ''
        ) !== '' &&

        String(
          evaluacion.actitud ??
          ''
        ) !== ''
    )
  }

  /* ========================================
     GUARDAR REPORTE
  ======================================== */
const guardarReporte =
  async (estado) => {
    if (reporteEnviado) {
      setError(
        'El reporte ya fue enviado y no puede modificarse.'
      )
      return
    }

    if (!habilitado) {
      setError(
        'El reporte todavía no está disponible.'
      )
      return
    }

    if (
      estado === 'Enviado' &&
      !resumenServicio.trim()
    ) {
      setError(
        'Escribe el resumen del servicio antes de enviar el reporte final.'
      )
      return
    }

    if (
      estado === 'Enviado' &&
      !evaluacionesCompletas()
    ) {
      setError(
        'Debes evaluar a todos los meseros presentes antes de enviar el reporte final.'
      )
      return
    }

    try {
      setGuardando(true)
      setError('')
      setMensaje('')

      const respuesta =
        await apiFetch(
          `${API_URL}/reportes/evento/${evento.id}`,
          {
            method: 'PUT',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                eventoId:
                  Number(evento.id),

                capitanMeseroId:
                  Number(mesero.id),

                resumenServicio:
                  resumenServicio.trim(),

                incidencias:
                  incidencias.trim(),

                observaciones:
                  observaciones.trim(),

                evaluacionesPersonal:
                  evaluaciones.map(
                    (evaluacion) => ({
                      meseroId:
                        Number(
                          evaluacion.meseroId
                        ),

                      desempeno:
                        evaluacion.desempeno === ''
                          ? null
                          : Number(
                              evaluacion.desempeno
                            ),

                      puntualidad:
                        evaluacion.puntualidad === ''
                          ? null
                          : Number(
                              evaluacion.puntualidad
                            ),

                      actitud:
                        evaluacion.actitud === ''
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
                  ),

                estado
              })
          }
        )

      const datos =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje ||
          'No se pudo guardar el reporte.'
        )
      }

      /*
        El backend devuelve directamente
        el reporte guardado.
      */

      setResumenServicio(
        datos.resumenServicio ??
        resumenServicio
      )

      setIncidencias(
        datos.incidencias ??
        incidencias
      )

      setObservaciones(
        datos.observaciones ??
        observaciones
      )

      if (
        datos.estado === 'Enviado' ||
        estado === 'Enviado'
      ) {
        setReporteEnviado(
          true
        )

        setMensaje(
          'Reporte enviado correctamente.'
        )

      } else {
        setReporteEnviado(
          false
        )

        setMensaje(
          'Borrador guardado correctamente.'
        )
      }

    } catch (error) {
      console.error(
        'Error guardar reporte:',
        error
      )

      setError(
        error.message ||
        'No se pudo guardar el reporte.'
      )

    } finally {
      setGuardando(false)
    }
  }  /* ========================================
     CARGANDO
  ======================================== */

  if (cargando) {
    return (
      <section className="capitan-reporte">

        <div className="reporte-cargando">
          Cargando reporte...
        </div>

      </section>
    )
  }

  /* ========================================
     COMPONENTE
  ======================================== */

  return (
    <section className="capitan-reporte">

      {/* ENCABEZADO */}

      <div className="reporte-encabezado">

        <div>

          <h2>
            Reporte del evento
          </h2>

          <p>
            Registra el resultado del servicio
            y evalúa el desempeño del personal.
          </p>

        </div>

        {reporteEnviado && (

          <span className="reporte-enviado">

            Reporte enviado

          </span>

        )}

      </div>

      {/* AVISO */}

      {!habilitado && (

        <div className="reporte-aviso">

          El reporte estará disponible
          a partir del día del evento.

        </div>

      )}

      {/* MENSAJES */}

      {mensaje && (

        <div className="reporte-mensaje correcto">

          {mensaje}

        </div>

      )}

      {error && (

        <div className="reporte-mensaje error">

          {error}

        </div>

      )}

      {/* ASISTENCIA */}

      <div className="reporte-asistencia">

        <div>

          <span>
            Asignados
          </span>

          <strong>
            {
              resumenAsistencia.total
            }
          </strong>

        </div>

        <div>

          <span>
            Presentes
          </span>

          <strong>
            {
              resumenAsistencia.presentes
            }
          </strong>

        </div>

        <div>

          <span>
            Ausentes
          </span>

          <strong>
            {
              resumenAsistencia.ausentes
            }
          </strong>

        </div>

        <div>

          <span>
            Sin registrar
          </span>

          <strong>
            {
              resumenAsistencia.sinRegistrar
            }
          </strong>

        </div>

      </div>

      {/* REPORTE GENERAL */}

      <div className="reporte-formulario">

        <div className="reporte-campo">

          <label>
            Resumen del servicio *
          </label>

          <textarea
            rows="5"
            value={
              resumenServicio
            }
            disabled={
              !habilitado ||
              reporteEnviado
            }
            onChange={(e) =>
              setResumenServicio(
                e.target.value
              )
            }
            placeholder="Describe brevemente cómo se desarrolló el servicio..."
          />

        </div>

        <div className="reporte-campo">

          <label>
            Incidencias generales
          </label>

          <textarea
            rows="4"
            value={
              incidencias
            }
            disabled={
              !habilitado ||
              reporteEnviado
            }
            onChange={(e) =>
              setIncidencias(
                e.target.value
              )
            }
            placeholder="Registra retrasos, problemas, cambios o situaciones ocurridas..."
          />

        </div>

        <div className="reporte-campo">

          <label>
            Observaciones
          </label>

          <textarea
            rows="4"
            value={
              observaciones
            }
            disabled={
              !habilitado ||
              reporteEnviado
            }
            onChange={(e) =>
              setObservaciones(
                e.target.value
              )
            }
            placeholder="Agrega cualquier comentario adicional..."
          />

        </div>

      </div>

      {/* EVALUACIÓN DE PERSONAL */}

      <div className="evaluacion-personal">

        <div className="evaluacion-titulo">

          <h3>
            Evaluación del personal
          </h3>

          <p>
            Evalúa a los meseros registrados
            como presentes. La escala va
            de 1 a 5.
          </p>

        </div>

        {evaluaciones.length ===
        0 ? (

          <div className="evaluacion-vacia">

            No hay meseros presentes
            para evaluar.

          </div>

        ) : (

          evaluaciones.map(
            (evaluacion) => (

              <div
                className="evaluacion-card"
                key={
                  evaluacion.meseroId
                }
              >

                <div className="evaluacion-mesero">

                  <strong>
                    {
                      evaluacion.nombre
                    }
                  </strong>

                  <span>
                    Mesero
                  </span>

                </div>

                <div className="evaluacion-grid">

                  <div>

                    <label>
                      Desempeño *
                    </label>

                    <select
                      value={
                        evaluacion.desempeno
                      }
                      disabled={
                        reporteEnviado
                      }
                      onChange={(e) =>
                        cambiarEvaluacion(
                          evaluacion.meseroId,
                          'desempeno',
                          e.target.value
                        )
                      }
                    >

                      <option value="">
                        Selecciona
                      </option>

                      <option value="1">
                        1 - Deficiente
                      </option>

                      <option value="2">
                        2 - Bajo
                      </option>

                      <option value="3">
                        3 - Adecuado
                      </option>

                      <option value="4">
                        4 - Muy bueno
                      </option>

                      <option value="5">
                        5 - Excelente
                      </option>

                    </select>

                  </div>

                  <div>

                    <label>
                      Puntualidad *
                    </label>

                    <select
                      value={
                        evaluacion.puntualidad
                      }
                      disabled={
                        reporteEnviado
                      }
                      onChange={(e) =>
                        cambiarEvaluacion(
                          evaluacion.meseroId,
                          'puntualidad',
                          e.target.value
                        )
                      }
                    >

                      <option value="">
                        Selecciona
                      </option>

                      <option value="1">
                        1 - Deficiente
                      </option>

                      <option value="2">
                        2 - Baja
                      </option>

                      <option value="3">
                        3 - Adecuada
                      </option>

                      <option value="4">
                        4 - Muy buena
                      </option>

                      <option value="5">
                        5 - Excelente
                      </option>

                    </select>

                  </div>

                  <div>

                    <label>
                      Actitud y servicio *
                    </label>

                    <select
                      value={
                        evaluacion.actitud
                      }
                      disabled={
                        reporteEnviado
                      }
                      onChange={(e) =>
                        cambiarEvaluacion(
                          evaluacion.meseroId,
                          'actitud',
                          e.target.value
                        )
                      }
                    >

                      <option value="">
                        Selecciona
                      </option>

                      <option value="1">
                        1 - Deficiente
                      </option>

                      <option value="2">
                        2 - Baja
                      </option>

                      <option value="3">
                        3 - Adecuada
                      </option>

                      <option value="4">
                        4 - Muy buena
                      </option>

                      <option value="5">
                        5 - Excelente
                      </option>

                    </select>

                  </div>

                </div>

                <label className="evaluacion-incidencia">

                  <input
                    type="checkbox"
                    checked={
                      evaluacion.incidencia
                    }
                    disabled={
                      reporteEnviado
                    }
                    onChange={(e) =>
                      cambiarEvaluacion(
                        evaluacion.meseroId,
                        'incidencia',
                        e.target.checked
                      )
                    }
                  />

                  <span>
                    Se presentó una incidencia
                    relacionada con este mesero
                  </span>

                </label>

                <div className="evaluacion-observacion">

                  <label>
                    Observación individual
                  </label>

                  <textarea
                    rows="3"
                    value={
                      evaluacion.observacion
                    }
                    disabled={
                      reporteEnviado
                    }
                    onChange={(e) =>
                      cambiarEvaluacion(
                        evaluacion.meseroId,
                        'observacion',
                        e.target.value
                      )
                    }
                    placeholder="Comentario opcional sobre su participación..."
                  />

                </div>

              </div>

            )
          )

        )}

      </div>

      {!reporteEnviado && (

        <div className="reporte-acciones">

          <button
            type="button"
            className="reporte-borrador"
            disabled={
              !habilitado ||
              guardando
            }
            onClick={() =>
              guardarReporte(
                'Borrador'
              )
            }
          >
            {guardando
              ? 'Guardando...'
              : 'Guardar borrador'}
          </button>

          <button
            type="button"
            className="reporte-enviar"
            disabled={
              guardando
            }
            onClick={() =>
              guardarReporte(
                'Enviado'
              )
            }
          >
            {guardando
              ? 'Guardando...'
              : 'Enviar reporte final'}
          </button>

        </div>

      )}

    </section>
  )
}

export default CapitanReporte