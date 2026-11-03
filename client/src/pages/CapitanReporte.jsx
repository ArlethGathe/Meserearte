import {
  useEffect,
  useState
} from 'react'

import './CapitanReporte.css'

const API_URL =
  'http://localhost:3001/api'

function CapitanReporte({
  evento,
  mesero
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
      mesero?.id
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
            fetch(
              `${API_URL}/reportes/evento/${evento.id}`
            ),

            fetch(
              `${API_URL}/asignaciones/evento/${evento.id}`
            ),

            fetch(
              `${API_URL}/meseros`
            ),

            fetch(
              `${API_URL}/asistencias/evento/${evento.id}`
            )
          ])

        if (
          !respuestaReporte.ok
        ) {
          const datos =
            await respuestaReporte.json()

          throw new Error(
            datos.mensaje ||
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

        const datosReporte =
          await respuestaReporte.json()

        const asignaciones =
          await respuestaAsignaciones.json()

        const meseros =
          await respuestaMeseros.json()

        const datosAsistencia =
          await respuestaAsistencias.json()

        setHabilitado(
          datosReporte.habilitado
        )

        setResumenAsistencia(
          datosReporte.resumenAsistencia ||
          {
            total: 0,
            presentes: 0,
            ausentes: 0,
            sinRegistrar: 0
          }
        )

        const reporte =
          datosReporte.reporte

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
          Solo se evalúan meseros
          registrados como presentes.

          El capitán no se evalúa
          a sí mismo.
        */

        const presentes =
          datosAsistencia
            .asistencias
            ?.filter(
              (asistencia) =>
                asistencia.estado ===
                'Presente'
            )
            .map(
              (asistencia) =>
                asistencia.meseroId
            ) || []

        const personalEvaluable =
          asignaciones
            .filter(
              (asignacion) =>
                asignacion.meseroId !==
                  mesero.id &&
                presentes.includes(
                  asignacion.meseroId
                )
            )
            .map(
              (asignacion) => {
                const datosMesero =
                  meseros.find(
                    (item) =>
                      item.id ===
                      asignacion.meseroId
                  )

                const evaluacionAnterior =
                  reporte
                    ?.evaluacionesPersonal
                    ?.find(
                      (evaluacion) =>
                        evaluacion.meseroId ===
                        asignacion.meseroId
                    )

                return {
                  meseroId:
                    asignacion.meseroId,

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
        setError(
          error.message
        )

      } finally {
        setCargando(false)
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
            evaluacion.meseroId ===
            meseroId
              ? {
                  ...evaluacion,

                  [campo]:
                    valor
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
          evaluacion.desempeno !==
            '' &&
          evaluacion.puntualidad !==
            '' &&
          evaluacion.actitud !==
            ''
      )
    }

  /* ========================================
     GUARDAR REPORTE
  ======================================== */

  const guardarReporte =
    async (estado) => {
      if (
        reporteEnviado
      ) {
        return
      }

      if (!habilitado) {
        setError(
          'El reporte todavía no está disponible.'
        )

        return
      }

      if (
        estado ===
          'Enviado' &&
        !resumenServicio.trim()
      ) {
        setError(
          'Escribe el resumen del servicio antes de enviar el reporte final.'
        )

        return
      }

      if (
        estado ===
          'Enviado' &&
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
          await fetch(
            `${API_URL}/reportes/evento/${evento.id}`,
            {
              method:
                'PUT',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  capitanMeseroId:
                    mesero.id,

                  resumenServicio,

                  incidencias,

                  observaciones,

                  evaluacionesPersonal:
                    evaluaciones.map(
                      (evaluacion) => ({
                        meseroId:
                          evaluacion.meseroId,

                        desempeno:
                          evaluacion.desempeno,

                        puntualidad:
                          evaluacion.puntualidad,

                        actitud:
                          evaluacion.actitud,

                        incidencia:
                          evaluacion.incidencia,

                        observacion:
                          evaluacion.observacion
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

        setMensaje(
          datos.mensaje
        )

        if (
          estado ===
          'Enviado'
        ) {
          setReporteEnviado(
            true
          )
        }

      } catch (error) {
        setError(
          error.message
        )

      } finally {
        setGuardando(false)
      }
    }

  /* ========================================
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

                  {/* DESEMPEÑO */}

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

                  {/* PUNTUALIDAD */}

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

                  {/* ACTITUD */}

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

                {/* INCIDENCIA */}

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

                {/* OBSERVACIÓN */}

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

      {/* BOTONES */}

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
              !habilitado ||
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