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
    reporte,
    setReporte
  ] = useState(null)

  const [
    habilitado,
    setHabilitado
  ] = useState(false)

  const [
    fechaActual,
    setFechaActual
  ] = useState('')

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
    cargando,
    setCargando
  ] = useState(true)

  const [
    guardando,
    setGuardando
  ] = useState(false)

  const [
    mensaje,
    setMensaje
  ] = useState('')

  const [
    error,
    setError
  ] = useState('')

  /* ========================================
     FECHA
  ======================================== */

  const formatearFecha = (
    fecha
  ) => {
    if (!fecha) return ''

    const fechaSimple =
      fecha.includes('T')
        ? fecha.split('T')[0]
        : fecha

    const [
      anio,
      mes,
      dia
    ] = fechaSimple.split('-')

    return `${dia}/${mes}/${anio}`
  }

  /* ========================================
     CARGAR REPORTE
  ======================================== */

  const cargarReporte =
    async () => {
      if (!evento) return

      try {
        setCargando(true)
        setError('')
        setMensaje('')

        const respuesta =
          await fetch(
            `${API_URL}/reportes/evento/${evento.id}`
          )

        const resultado =
          await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(
            resultado.mensaje ||
            'No se pudo cargar el reporte.'
          )
        }

        setHabilitado(
          resultado.habilitado
        )

        setFechaActual(
          resultado.fechaActual
        )

        setResumenAsistencia(
          resultado.resumenAsistencia || {
            total: 0,
            presentes: 0,
            ausentes: 0,
            sinRegistrar: 0
          }
        )

        if (resultado.reporte) {
          setReporte(
            resultado.reporte
          )

          setResumenServicio(
            resultado.reporte
              .resumenServicio || ''
          )

          setIncidencias(
            resultado.reporte
              .incidencias || ''
          )

          setObservaciones(
            resultado.reporte
              .observaciones || ''
          )
        } else {
          setReporte(null)
          setResumenServicio('')
          setIncidencias('')
          setObservaciones('')
        }

      } catch (error) {
        setError(
          error.message
        )
      } finally {
        setCargando(false)
      }
    }

  useEffect(() => {
    cargarReporte()
  }, [evento?.id])

  /* ========================================
     GUARDAR
  ======================================== */

  const guardarReporte =
    async (
      estado
    ) => {
      if (
        !evento ||
        !mesero
      ) {
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
        estado === 'Enviado'
      ) {
        const confirmar =
          window.confirm(
            'El reporte quedará cerrado y ya no podrá modificarse. ¿Deseas enviarlo definitivamente?'
          )

        if (!confirmar) {
          return
        }
      }

      try {
        setGuardando(true)

        setMensaje('')
        setError('')

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

                  resumenServicio:
                    resumenServicio.trim(),

                  incidencias:
                    incidencias.trim(),

                  observaciones:
                    observaciones.trim(),

                  estado
                })
            }
          )

        const resultado =
          await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(
            resultado.mensaje ||
            'No se pudo guardar el reporte.'
          )
        }

        setReporte(
          resultado.reporte
        )

        setResumenAsistencia(
          resultado.resumenAsistencia
        )

        if (
          estado ===
          'Enviado'
        ) {
          setMensaje(
            'Reporte final enviado correctamente.'
          )
        } else {
          setMensaje(
            'Borrador guardado correctamente.'
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
      <section className="reporte-capitan">

        <div className="reporte-cargando">
          Cargando reporte del evento...
        </div>

      </section>
    )
  }

  const reporteEnviado =
    reporte?.estado ===
    'Enviado'

  /* ========================================
     COMPONENTE
  ======================================== */

  return (
    <section className="reporte-capitan">

      <div className="reporte-header">

        <div>

          <h2>
            Reporte del evento
          </h2>

          <p>
            Registra el resultado general
            del servicio, incidencias y
            observaciones del evento.
          </p>

        </div>

        {reporteEnviado ? (

          <span className="reporte-estado enviado">
            Reporte enviado
          </span>

        ) : reporte?.estado ===
          'Borrador' ? (

          <span className="reporte-estado borrador">
            Borrador guardado
          </span>

        ) : habilitado ? (

          <span className="reporte-estado disponible">
            Disponible
          </span>

        ) : (

          <span className="reporte-estado bloqueado">
            No disponible
          </span>

        )}

      </div>

      {mensaje && (

        <div className="reporte-mensaje correcto">

          <span>
            {mensaje}
          </span>

          <button
            onClick={() =>
              setMensaje('')
            }
          >
            ×
          </button>

        </div>

      )}

      {error && (

        <div className="reporte-mensaje error">

          <span>
            {error}
          </span>

          <button
            onClick={() =>
              setError('')
            }
          >
            ×
          </button>

        </div>

      )}

      {/* ===================================
          BLOQUEADO
      =================================== */}

      {!habilitado &&
        !reporteEnviado && (

        <div className="reporte-bloqueado">

          <strong>
            Reporte todavía no disponible
          </strong>

          <p>
            Podrás comenzar a elaborar
            el reporte a partir del{' '}

            <strong>
              {formatearFecha(
                evento.fecha
              )}
            </strong>.
          </p>

        </div>

      )}

      {/* ===================================
          RESUMEN DE ASISTENCIA
      =================================== */}

      <div className="reporte-asistencia">

        <div>

          <span>
            Personal asignado
          </span>

          <strong>
            {
              resumenAsistencia.total
            }
          </strong>

        </div>

        <div className="reporte-presentes">

          <span>
            Presentes
          </span>

          <strong>
            {
              resumenAsistencia
                .presentes
            }
          </strong>

        </div>

        <div className="reporte-ausentes">

          <span>
            Ausentes
          </span>

          <strong>
            {
              resumenAsistencia
                .ausentes
            }
          </strong>

        </div>

        <div className="reporte-pendientes">

          <span>
            Sin registrar
          </span>

          <strong>
            {
              resumenAsistencia
                .sinRegistrar
            }
          </strong>

        </div>

      </div>

      {/* ===================================
          REPORTE YA ENVIADO
      =================================== */}

      {reporteEnviado ? (

        <div className="reporte-final">

          <div className="reporte-final-aviso">

            <strong>
              Reporte final enviado
            </strong>

            <p>
              Este reporte ya forma parte
              del historial del evento y
              no puede modificarse.
            </p>

          </div>

          <div className="reporte-final-grid">

            <div>

              <span>
                Evento
              </span>

              <strong>
                {evento.nombre}
              </strong>

            </div>

            <div>

              <span>
                Fecha del evento
              </span>

              <strong>
                {formatearFecha(
                  evento.fecha
                )}
              </strong>

            </div>

            <div>

              <span>
                Capitán
              </span>

              <strong>
                {mesero.nombre}{' '}
                {mesero.apellidos}
              </strong>

            </div>

            <div>

              <span>
                Fecha de envío
              </span>

              <strong>
                {formatearFecha(
                  reporte.fechaEnvio
                )}
              </strong>

            </div>

          </div>

          <div className="reporte-final-seccion">

            <span>
              Resumen del servicio
            </span>

            <p>
              {
                reporte.resumenServicio
              }
            </p>

          </div>

          <div className="reporte-final-seccion">

            <span>
              Incidencias
            </span>

            <p>
              {reporte.incidencias ||
                'No se registraron incidencias.'}
            </p>

          </div>

          <div className="reporte-final-seccion">

            <span>
              Observaciones
            </span>

            <p>
              {reporte.observaciones ||
                'Sin observaciones adicionales.'}
            </p>

          </div>

        </div>

      ) : (

        /* =================================
           FORMULARIO
        ================================= */

        <div
          className={
            habilitado
              ? 'reporte-formulario'
              : 'reporte-formulario deshabilitado'
          }
        >

          <div className="reporte-campo">

            <label>
              Resumen del servicio
              <span>
                *
              </span>
            </label>

            <textarea
              value={
                resumenServicio
              }
              disabled={
                !habilitado
              }
              onChange={(e) =>
                setResumenServicio(
                  e.target.value
                )
              }
              placeholder="Describe de manera general cómo se desarrolló el servicio..."
              rows="5"
            />

            <small>
              Este campo será obligatorio
              para enviar el reporte final.
            </small>

          </div>

          <div className="reporte-campo">

            <label>
              Incidencias
            </label>

            <textarea
              value={
                incidencias
              }
              disabled={
                !habilitado
              }
              onChange={(e) =>
                setIncidencias(
                  e.target.value
                )
              }
              placeholder="Registra retrasos, ausencias, problemas con el servicio o cualquier situación importante..."
              rows="4"
            />

          </div>

          <div className="reporte-campo">

            <label>
              Observaciones generales
            </label>

            <textarea
              value={
                observaciones
              }
              disabled={
                !habilitado
              }
              onChange={(e) =>
                setObservaciones(
                  e.target.value
                )
              }
              placeholder="Agrega comentarios adicionales que puedan ser útiles para el administrador..."
              rows="4"
            />

          </div>

          <div className="reporte-acciones">

            <button
              type="button"
              className="guardar-borrador"
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
              className="enviar-reporte"
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
              Enviar reporte final
            </button>

          </div>

        </div>

      )}

      {fechaActual && (

        <div className="reporte-fecha-sistema">

          Fecha actual del sistema:{' '}

          <strong>
            {formatearFecha(
              fechaActual
            )}
          </strong>

        </div>

      )}

    </section>
  )
}

export default CapitanReporte