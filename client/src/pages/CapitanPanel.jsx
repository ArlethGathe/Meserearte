import {
  useEffect,
  useState
} from 'react'

import './CapitanPanel.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

const API_URL =
  'http://localhost:3001/api'

function CapitanPanel({
  mesero,
  eventos
}) {
  const {
    salas,
    meseros,
    asignaciones,
    disponibilidades
  } = useMesereArte()

  const [
    eventoSeleccionado,
    setEventoSeleccionado
  ] = useState(
    eventos.length > 0
      ? String(
          eventos[0].id
        )
      : ''
  )

  const [
    asistencias,
    setAsistencias
  ] = useState([])

  const [
    asistenciaHabilitada,
    setAsistenciaHabilitada
  ] = useState(false)

  const [
    fechaActual,
    setFechaActual
  ] = useState('')

  const [
    cargandoAsistencia,
    setCargandoAsistencia
  ] = useState(false)

  const [
    procesandoMesero,
    setProcesandoMesero
  ] = useState(null)

  const [
    mensaje,
    setMensaje
  ] = useState('')

  const [
    error,
    setError
  ] = useState('')

  /* ========================================
     EVENTO
  ======================================== */

  const eventoActual =
    eventos.find(
      (evento) =>
        evento.id ===
        Number(
          eventoSeleccionado
        )
    )

  const salaActual =
    eventoActual
      ? salas.find(
          (sala) =>
            sala.id ===
            eventoActual.salaId
        )
      : null

  /* ========================================
     DISPONIBILIDAD
  ======================================== */

  const obtenerDisponibilidad = (
    eventoId,
    meseroId
  ) => {
    const registro =
      disponibilidades.find(
        (item) =>
          item.eventoId ===
            eventoId &&
          item.meseroId ===
            meseroId
      )

    return registro
      ? registro.estado
      : 'Pendiente'
  }

  /* ========================================
     EQUIPO DEL EVENTO
  ======================================== */

  const equipoEvento =
    eventoActual
      ? asignaciones
          .filter(
            (asignacion) =>
              asignacion.eventoId ===
              eventoActual.id
          )
          .map(
            (asignacion) => {
              const integrante =
                meseros.find(
                  (mesero) =>
                    mesero.id ===
                    asignacion.meseroId
                )

              if (!integrante) {
                return null
              }

              return {
                ...integrante,

                rolEvento:
                  asignacion.rol,

                disponibilidad:
                  obtenerDisponibilidad(
                    eventoActual.id,
                    integrante.id
                  )
              }
            }
          )
          .filter(Boolean)
          .sort(
            (a, b) => {
              if (
                a.rolEvento ===
                'Capitán'
              ) {
                return -1
              }

              if (
                b.rolEvento ===
                'Capitán'
              ) {
                return 1
              }

              return a.nombre.localeCompare(
                b.nombre
              )
            }
          )
      : []

  /* ========================================
     CARGAR ASISTENCIA
  ======================================== */

  const cargarAsistencias =
    async () => {
      if (!eventoActual) {
        return
      }

      try {
        setCargandoAsistencia(
          true
        )

        setError('')

        const respuesta =
          await fetch(
            `${API_URL}/asistencias/evento/${eventoActual.id}`
          )

        const resultado =
          await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(
            resultado.mensaje ||
            'No se pudo cargar la asistencia.'
          )
        }

        setAsistencias(
          resultado.asistencias ||
          []
        )

        setAsistenciaHabilitada(
          resultado.habilitado
        )

        setFechaActual(
          resultado.fechaActual
        )

      } catch (error) {
        setError(
          error.message
        )
      } finally {
        setCargandoAsistencia(
          false
        )
      }
    }

  useEffect(
    () => {
      cargarAsistencias()
    },
    [eventoSeleccionado]
  )

  /* ========================================
     ESTADO DE ASISTENCIA
  ======================================== */

  const obtenerAsistencia = (
    meseroId
  ) => {
    const registro =
      asistencias.find(
        (item) =>
          item.meseroId ===
          meseroId
      )

    return registro
      ? registro.estado
      : 'Pendiente'
  }

  /* ========================================
     REGISTRAR ASISTENCIA
  ======================================== */

  const registrarAsistencia =
    async (
      meseroId,
      estado
    ) => {
      if (
        !eventoActual ||
        !mesero
      ) {
        return
      }

      try {
        setMensaje('')
        setError('')

        setProcesandoMesero(
          meseroId
        )

        const respuesta =
          await fetch(
            `${API_URL}/asistencias`,
            {
              method:
                'PUT',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  eventoId:
                    eventoActual.id,

                  meseroId,

                  capitanMeseroId:
                    mesero.id,

                  estado
                })
            }
          )

        const resultado =
          await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(
            resultado.mensaje ||
            'No se pudo registrar la asistencia.'
          )
        }

        setAsistencias(
          (anteriores) => {
            const existe =
              anteriores.some(
                (item) =>
                  item.meseroId ===
                  meseroId
              )

            if (existe) {
              return anteriores.map(
                (item) =>
                  item.meseroId ===
                  meseroId
                    ? resultado
                    : item
              )
            }

            return [
              ...anteriores,
              resultado
            ]
          }
        )

        setMensaje(
          estado ===
          'Presente'
            ? 'Asistencia registrada como presente.'
            : 'Asistencia registrada como ausente.'
        )

      } catch (error) {
        setError(
          error.message
        )
      } finally {
        setProcesandoMesero(
          null
        )
      }
    }

  /* ========================================
     CONTADORES DISPONIBILIDAD
  ======================================== */

  const confirmados =
    equipoEvento.filter(
      (integrante) =>
        integrante.disponibilidad ===
        'Confirmado'
    ).length

  const pendientes =
    equipoEvento.filter(
      (integrante) =>
        integrante.disponibilidad ===
        'Pendiente'
    ).length

  const noDisponibles =
    equipoEvento.filter(
      (integrante) =>
        integrante.disponibilidad ===
        'No disponible'
    ).length

  /* ========================================
     CONTADORES ASISTENCIA
  ======================================== */

  const presentes =
    equipoEvento.filter(
      (integrante) =>
        obtenerAsistencia(
          integrante.id
        ) === 'Presente'
    ).length

  const ausentes =
    equipoEvento.filter(
      (integrante) =>
        obtenerAsistencia(
          integrante.id
        ) === 'Ausente'
    ).length

  const asistenciaPendiente =
    equipoEvento.length -
    presentes -
    ausentes

  /* ========================================
     FECHA
  ======================================== */

  const formatearFecha = (
    fecha
  ) => {
    if (!fecha) {
      return ''
    }

    const [
      anio,
      mes,
      dia
    ] = fecha.split('-')

    return `${dia}/${mes}/${anio}`
  }

  /* ========================================
     SIN EVENTOS
  ======================================== */

  if (
    !eventos ||
    eventos.length === 0
  ) {
    return (
      <div className="capitan-panel">

        <div className="capitan-vacio">

          Actualmente no tienes
          eventos asignados como
          capitán.

        </div>

      </div>
    )
  }

  return (
    <div className="capitan-panel">

      {/* =================================
          MENSAJES
      ================================= */}

      {mensaje && (

        <div className="capitan-mensaje correcto">

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

        <div className="capitan-mensaje error">

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

      {/* =================================
          ENCABEZADO
      ================================= */}

      <div className="capitan-encabezado">

        <div>

          <p className="capitan-etiqueta">
            FUNCIONES DE CAPITÁN
          </p>

          <h1>
            Gestión del equipo
          </h1>

          <p>
            Consulta al personal
            asignado y administra las
            funciones correspondientes
            al evento.
          </p>

        </div>

        <div className="capitan-identidad">

          <span>
            Capitán
          </span>

          <strong>
            {mesero?.nombre}{' '}
            {mesero?.apellidos}
          </strong>

        </div>

      </div>

      {/* =================================
          SELECT EVENTO
      ================================= */}

      <section className="capitan-selector">

        <label>
          Evento a gestionar
        </label>

        <select
          value={
            eventoSeleccionado
          }
          onChange={(e) => {
            setEventoSeleccionado(
              e.target.value
            )

            setMensaje('')
            setError('')
          }}
        >

          {eventos.map(
            (evento) => (

              <option
                key={evento.id}
                value={evento.id}
              >
                {evento.nombre}
              </option>

            )
          )}

        </select>

      </section>

      {eventoActual && (
        <>

          {/* =================================
              DATOS EVENTO
          ================================= */}

          <section className="capitan-evento-card">

            <div className="capitan-evento-titulo">

              <div>

                <span>
                  EVENTO
                </span>

                <h2>
                  {
                    eventoActual.nombre
                  }
                </h2>

              </div>

              <span className="capitan-rol-badge">
                Capitán
              </span>

            </div>

            <div className="capitan-evento-datos">

              <div>

                <span>
                  Fecha
                </span>

                <strong>
                  {formatearFecha(
                    eventoActual.fecha
                  )}
                </strong>

              </div>

              <div>

                <span>
                  Horario
                </span>

                <strong>
                  {
                    eventoActual.horario
                  }
                </strong>

              </div>

              <div>

                <span>
                  Ubicación
                </span>

                <strong>
                  {
                    eventoActual.ubicacion
                  }
                </strong>

              </div>

              <div>

                <span>
                  Sala
                </span>

                <strong>
                  {salaActual
                    ? salaActual.nombre
                    : 'Sin sala'}
                </strong>

              </div>

              <div>

                <span>
                  Uniforme
                </span>

                <strong>
                  {eventoActual.uniforme ||
                    'Sin especificar'}
                </strong>

              </div>

              <div>

                <span>
                  Personal requerido
                </span>

                <strong>
                  {
                    eventoActual
                      .meserosRequeridos
                  }
                </strong>

              </div>

            </div>

            {eventoActual.observaciones && (

              <div className="capitan-observaciones">

                <span>
                  Observaciones
                </span>

                <p>
                  {
                    eventoActual
                      .observaciones
                  }
                </p>

              </div>

            )}

          </section>

          {/* =================================
              DISPONIBILIDAD DEL EQUIPO
          ================================= */}

          <section className="capitan-resumen">

            <div>

              <span>
                Personal asignado
              </span>

              <strong>
                {
                  equipoEvento.length
                }
              </strong>

            </div>

            <div className="capitan-resumen-confirmado">

              <span>
                Confirmados
              </span>

              <strong>
                {confirmados}
              </strong>

            </div>

            <div className="capitan-resumen-pendiente">

              <span>
                Pendientes
              </span>

              <strong>
                {pendientes}
              </strong>

            </div>

            <div className="capitan-resumen-no-disponible">

              <span>
                No disponibles
              </span>

              <strong>
                {noDisponibles}
              </strong>

            </div>

          </section>

          {noDisponibles > 0 && (

            <div className="capitan-advertencia">

              <strong>
                Atención:
              </strong>{' '}

              hay {noDisponibles}{' '}
              integrante(s) que
              indicaron que no pueden
              asistir. El administrador
              deberá realizar el ajuste
              correspondiente.

            </div>

          )}

          {/* =================================
              PERSONAL ASIGNADO
          ================================= */}

          <section className="capitan-equipo">

            <div className="capitan-equipo-header">

              <div>

                <h2>
                  Personal asignado
                </h2>

                <p>
                  Consulta quién forma
                  parte del equipo y su
                  confirmación actual.
                </p>

              </div>

              <span>
                {
                  equipoEvento.length
                }{' '}
                integrante(s)
              </span>

            </div>

            {equipoEvento.length > 0 ? (

              <div className="capitan-tabla-responsive">

                <table className="capitan-tabla">

                  <thead>

                    <tr>

                      <th>
                        Personal
                      </th>

                      <th>
                        Rol
                      </th>

                      <th>
                        Confirmación
                      </th>

                      <th>
                        Estado
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {equipoEvento.map(
                      (integrante) => (

                        <tr
                          key={
                            integrante.id
                          }
                        >

                          <td>

                            <div className="capitan-personal-datos">

                              <strong>
                                {
                                  integrante.nombre
                                }{' '}
                                {
                                  integrante.apellidos
                                }
                              </strong>

                              <span>
                                {
                                  integrante.correo
                                }
                              </span>

                            </div>

                          </td>

                          <td>

                            <span
                              className={
                                integrante.rolEvento ===
                                'Capitán'
                                  ? 'capitan-tabla-rol capitan'
                                  : 'capitan-tabla-rol mesero'
                              }
                            >
                              {
                                integrante.rolEvento
                              }
                            </span>

                          </td>

                          <td>

                            <span
                              className={`capitan-disponibilidad ${integrante.disponibilidad
                                .toLowerCase()
                                .replaceAll(
                                  ' ',
                                  '-'
                                )}`}
                            >
                              {
                                integrante.disponibilidad
                              }
                            </span>

                          </td>

                          <td>

                            <span className="capitan-estado-activo">
                              {
                                integrante.estado
                              }
                            </span>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            ) : (

              <div className="capitan-vacio">

                No hay personal
                asignado a este evento.

              </div>

            )}

          </section>

          {/* =================================
              CONTROL DE ASISTENCIA
          ================================= */}

          <section className="capitan-asistencia">

            <div className="capitan-asistencia-header">

              <div>

                <h2>
                  Control de asistencia
                </h2>

                <p>
                  Registra la llegada
                  del personal el día
                  del evento.
                </p>

              </div>

              {asistenciaHabilitada ? (

                <span className="asistencia-disponible">
                  Disponible hoy
                </span>

              ) : (

                <span className="asistencia-bloqueada">
                  No disponible
                </span>

              )}

            </div>

            {!asistenciaHabilitada && (

              <div className="asistencia-aviso">

                El control de asistencia
                se habilitará el{' '}

                <strong>
                  {formatearFecha(
                    eventoActual.fecha
                  )}
                </strong>.

              </div>

            )}

            {cargandoAsistencia ? (

              <div className="capitan-vacio">

                Cargando control de
                asistencia...

              </div>

            ) : (

              <>
                <div className="asistencia-resumen">

                  <div>

                    <span>
                      Presentes
                    </span>

                    <strong>
                      {presentes}
                    </strong>

                  </div>

                  <div>

                    <span>
                      Ausentes
                    </span>

                    <strong>
                      {ausentes}
                    </strong>

                  </div>

                  <div>

                    <span>
                      Sin registrar
                    </span>

                    <strong>
                      {
                        asistenciaPendiente
                      }
                    </strong>

                  </div>

                </div>

                <div className="capitan-tabla-responsive">

                  <table className="capitan-tabla asistencia-tabla">

                    <thead>

                      <tr>

                        <th>
                          Personal
                        </th>

                        <th>
                          Rol
                        </th>

                        <th>
                          Asistencia
                        </th>

                        <th>
                          Registro
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {equipoEvento.map(
                        (integrante) => {
                          const estado =
                            obtenerAsistencia(
                              integrante.id
                            )

                          return (

                            <tr
                              key={
                                integrante.id
                              }
                            >

                              <td>

                                <div className="capitan-personal-datos">

                                  <strong>
                                    {
                                      integrante.nombre
                                    }{' '}
                                    {
                                      integrante.apellidos
                                    }
                                  </strong>

                                  <span>
                                    {
                                      integrante.correo
                                    }
                                  </span>

                                </div>

                              </td>

                              <td>

                                <span
                                  className={
                                    integrante.rolEvento ===
                                    'Capitán'
                                      ? 'capitan-tabla-rol capitan'
                                      : 'capitan-tabla-rol mesero'
                                  }
                                >
                                  {
                                    integrante.rolEvento
                                  }
                                </span>

                              </td>

                              <td>

                                <span
                                  className={`estado-asistencia ${estado.toLowerCase()}`}
                                >
                                  {estado}
                                </span>

                              </td>

                              <td>

                                {asistenciaHabilitada ? (

                                  <div className="asistencia-acciones">

                                    <button
                                      type="button"
                                      className={
                                        estado ===
                                        'Presente'
                                          ? 'asistencia-presente seleccionado'
                                          : 'asistencia-presente'
                                      }
                                      disabled={
                                        procesandoMesero ===
                                        integrante.id
                                      }
                                      onClick={() =>
                                        registrarAsistencia(
                                          integrante.id,
                                          'Presente'
                                        )
                                      }
                                    >
                                      Presente
                                    </button>

                                    <button
                                      type="button"
                                      className={
                                        estado ===
                                        'Ausente'
                                          ? 'asistencia-ausente seleccionado'
                                          : 'asistencia-ausente'
                                      }
                                      disabled={
                                        procesandoMesero ===
                                        integrante.id
                                      }
                                      onClick={() =>
                                        registrarAsistencia(
                                          integrante.id,
                                          'Ausente'
                                        )
                                      }
                                    >
                                      Ausente
                                    </button>

                                  </div>

                                ) : (

                                  <span className="asistencia-sin-acciones">
                                    Disponible el día
                                    del evento
                                  </span>

                                )}

                              </td>

                            </tr>

                          )
                        }
                      )}

                    </tbody>

                  </table>

                </div>
              </>
            )}

          </section>

          {/* =================================
              REPORTE
          ================================= */}

          <section className="capitan-proxima-funcion">

            <div>

              <h2>
                Reporte del evento
              </h2>

              <p>
                El reporte se habilitará
                a partir del día del
                evento y permanecerá
                disponible hasta que
                sea enviado de forma
                definitiva.
              </p>

            </div>

            <span>
              Siguiente función
            </span>

          </section>

        </>
      )}

    </div>
  )
}

export default CapitanPanel