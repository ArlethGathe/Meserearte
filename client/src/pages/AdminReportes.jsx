import {
  useEffect,
  useMemo,
  useState
} from 'react'

import './AdminReportes.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

const API_URL =
  'http://localhost:3001/api'

function AdminReportes({
  usuario
}) {
  const {
    eventos,
    meseros
  } = useMesereArte()

  const [
    reportes,
    setReportes
  ] = useState([])

  const [
    cargando,
    setCargando
  ] = useState(true)

  const [
    error,
    setError
  ] = useState('')

  const [
    pestaña,
    setPestaña
  ] = useState('reportes')

  const [
    busqueda,
    setBusqueda
  ] = useState('')

  const [
    reporteSeleccionado,
    setReporteSeleccionado
  ] = useState(null)

  /* ========================================
     CARGAR REPORTES
  ======================================== */

  const cargarReportes =
    async () => {
      try {
        setCargando(true)
        setError('')

        const url =
          usuario?.salaId
            ? `${API_URL}/reportes?salaId=${usuario.salaId}`
            : `${API_URL}/reportes`

        const respuesta =
          await fetch(url)

        const resultado =
          await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(
            resultado.mensaje ||
            'No se pudieron cargar los reportes.'
          )
        }

        setReportes(
          resultado
        )

      } catch (error) {
        setError(
          error.message
        )
      } finally {
        setCargando(false)
      }
    }

  useEffect(() => {
    cargarReportes()
  }, [usuario?.salaId])

  /* ========================================
     REPORTES FINALES
  ======================================== */

  const reportesFinales =
    useMemo(
      () =>
        reportes
          .filter(
            (reporte) =>
              reporte.estado ===
              'Enviado'
          )
          .map(
            (reporte) => {
              const evento =
                eventos.find(
                  (evento) =>
                    evento.id ===
                    reporte.eventoId
                )

              const capitan =
                meseros.find(
                  (mesero) =>
                    mesero.id ===
                    reporte.capitanMeseroId
                )

              return {
                ...reporte,

                evento,

                capitan
              }
            }
          )
          .sort(
            (a, b) =>
              new Date(
                b.fechaEnvio
              ) -
              new Date(
                a.fechaEnvio
              )
          ),
      [
        reportes,
        eventos,
        meseros
      ]
    )

  /* ========================================
     FILTRO
  ======================================== */

  const reportesFiltrados =
    reportesFinales.filter(
      (reporte) => {
        const texto =
          busqueda
            .trim()
            .toLowerCase()

        if (!texto) {
          return true
        }

        const nombreEvento =
          reporte.evento?.nombre
            ?.toLowerCase() ||
          ''

        const nombreCapitan =
          `${reporte.capitan?.nombre || ''} ${reporte.capitan?.apellidos || ''}`
            .toLowerCase()

        return (
          nombreEvento.includes(
            texto
          ) ||
          nombreCapitan.includes(
            texto
          )
        )
      }
    )

  /* ========================================
     HISTORIAL
  ======================================== */

  const historialEventos =
    eventos
      .filter(
        (evento) =>
          !usuario?.salaId ||
          evento.salaId ===
          usuario.salaId
      )
      .map(
        (evento) => {
          const reporte =
            reportesFinales.find(
              (reporte) =>
                reporte.eventoId ===
                evento.id
            )

          return {
            ...evento,

            reporte:
              reporte || null
          }
        }
      )
      .sort(
        (a, b) =>
          new Date(
            b.fecha
          ) -
          new Date(
            a.fecha
          )
      )

  /* ========================================
     CONTADORES
  ======================================== */

  const totalReportes =
    reportesFinales.length

  const totalPresentes =
    reportesFinales.reduce(
      (
        acumulado,
        reporte
      ) =>
        acumulado +
        (
          reporte.asistencia
            ?.presentes ||
          0
        ),
      0
    )

  const totalAusentes =
    reportesFinales.reduce(
      (
        acumulado,
        reporte
      ) =>
        acumulado +
        (
          reporte.asistencia
            ?.ausentes ||
          0
        ),
      0
    )

  const totalIncidencias =
    reportesFinales.filter(
      (reporte) =>
        reporte.incidencias &&
        reporte.incidencias.trim()
    ).length

  /* ========================================
     FECHAS
  ======================================== */

  const formatearFecha = (
    fecha
  ) => {
    if (!fecha) {
      return 'Sin fecha'
    }

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

  const formatearFechaHora = (
    fecha
  ) => {
    if (!fecha) {
      return ''
    }

    return new Date(
      fecha
    ).toLocaleString(
      'es-MX',
      {
        dateStyle:
          'short',

        timeStyle:
          'short'
      }
    )
  }

  /* ========================================
     COMPONENTE
  ======================================== */

  return (
    <div className="reportes-pagina">

      {/* ===================================
          ENCABEZADO
      =================================== */}

      <div className="reportes-encabezado">

        <div>

          <h1>
            Reportes e historiales
          </h1>

          <p>
            Consulta los reportes finales
            enviados por los capitanes y
            el historial de los eventos.
          </p>

        </div>

        <button
          type="button"
          className="actualizar-reportes"
          onClick={
            cargarReportes
          }
        >
          Actualizar
        </button>

      </div>

      {/* ===================================
          RESUMEN
      =================================== */}

      <section className="reportes-resumen">

        <div>

          <span>
            Reportes recibidos
          </span>

          <strong>
            {totalReportes}
          </strong>

          <p>
            Reportes finales enviados.
          </p>

        </div>

        <div className="resumen-presentes">

          <span>
            Asistencias
          </span>

          <strong>
            {totalPresentes}
          </strong>

          <p>
            Personal registrado
            como presente.
          </p>

        </div>

        <div className="resumen-ausentes">

          <span>
            Ausencias
          </span>

          <strong>
            {totalAusentes}
          </strong>

          <p>
            Ausencias registradas
            por los capitanes.
          </p>

        </div>

        <div className="resumen-incidencias">

          <span>
            Con incidencias
          </span>

          <strong>
            {totalIncidencias}
          </strong>

          <p>
            Reportes con alguna
            incidencia registrada.
          </p>

        </div>

      </section>

      {/* ===================================
          PESTAÑAS
      =================================== */}

      <div className="reportes-tabs">

        <button
          type="button"
          className={
            pestaña ===
            'reportes'
              ? 'activo'
              : ''
          }
          onClick={() =>
            setPestaña(
              'reportes'
            )
          }
        >
          Reportes recibidos
        </button>

        <button
          type="button"
          className={
            pestaña ===
            'historial'
              ? 'activo'
              : ''
          }
          onClick={() =>
            setPestaña(
              'historial'
            )
          }
        >
          Historial de eventos
        </button>

      </div>

      {/* ===================================
          ERROR
      =================================== */}

      {error && (

        <div className="reportes-error">

          {error}

        </div>

      )}

      {/* ===================================
          REPORTES RECIBIDOS
      =================================== */}

      {pestaña ===
        'reportes' && (

        <>

          <div className="reportes-filtros">

            <input
              type="text"
              placeholder="Buscar por evento o capitán..."
              value={
                busqueda
              }
              onChange={(e) =>
                setBusqueda(
                  e.target.value
                )
              }
            />

          </div>

          {cargando ? (

            <div className="reportes-vacio">

              Cargando reportes...

            </div>

          ) : reportesFiltrados.length ===
            0 ? (

            <div className="reportes-vacio">

              <strong>
                No hay reportes finales
                disponibles.
              </strong>

              <p>
                Cuando un capitán envíe
                el reporte final de un
                evento, aparecerá en
                este apartado.
              </p>

            </div>

          ) : (

            <div className="reportes-lista">

              {reportesFiltrados.map(
                (reporte) => (

                  <article
                    className="reporte-admin-card"
                    key={
                      reporte.id
                    }
                  >

                    <div className="reporte-admin-superior">

                      <div>

                        <span className="reporte-admin-etiqueta">
                          REPORTE FINAL
                        </span>

                        <h2>
                          {reporte.evento
                            ?.nombre ||
                            `Evento #${reporte.eventoId}`}
                        </h2>

                        <p>
                          {formatearFecha(
                            reporte.evento
                              ?.fecha
                          )}

                          {reporte.evento
                            ?.horario
                            ? ` · ${reporte.evento.horario}`
                            : ''}
                        </p>

                      </div>

                      <span className="reporte-admin-enviado">
                        Recibido
                      </span>

                    </div>

                    <div className="reporte-admin-datos">

                      <div>

                        <span>
                          Capitán
                        </span>

                        <strong>
                          {reporte.capitan
                            ? `${reporte.capitan.nombre} ${reporte.capitan.apellidos}`
                            : 'Sin información'}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Fecha de envío
                        </span>

                        <strong>
                          {formatearFechaHora(
                            reporte.fechaEnvio
                          )}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Presentes
                        </span>

                        <strong>
                          {reporte.asistencia
                            ?.presentes ||
                            0}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Ausentes
                        </span>

                        <strong>
                          {reporte.asistencia
                            ?.ausentes ||
                            0}
                        </strong>

                      </div>

                    </div>

                    <div className="reporte-admin-resumen">

                      <span>
                        Resumen del servicio
                      </span>

                      <p>
                        {
                          reporte.resumenServicio
                        }
                      </p>

                    </div>

                    {reporte.incidencias && (

                      <div className="reporte-admin-incidencia">

                        <strong>
                          Incidencias registradas
                        </strong>

                        <p>
                          {
                            reporte.incidencias
                          }
                        </p>

                      </div>

                    )}

                    <div className="reporte-admin-pie">

                      <span>
                        Estado: Reporte
                        finalizado
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setReporteSeleccionado(
                            reporte
                          )
                        }
                      >
                        Ver reporte completo
                      </button>

                    </div>

                  </article>

                )
              )}

            </div>

          )}

        </>

      )}

      {/* ===================================
          HISTORIAL
      =================================== */}

      {pestaña ===
        'historial' && (

        <section className="historial-eventos">

          {historialEventos.length ===
          0 ? (

            <div className="reportes-vacio">

              No hay eventos
              registrados.

            </div>

          ) : (

            <div className="tabla-reportes-responsive">

              <table className="tabla-historial-reportes">

                <thead>

                  <tr>

                    <th>
                      Evento
                    </th>

                    <th>
                      Fecha
                    </th>

                    <th>
                      Ubicación
                    </th>

                    <th>
                      Estado del reporte
                    </th>

                    <th>
                      Acción
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {historialEventos.map(
                    (evento) => (

                      <tr
                        key={
                          evento.id
                        }
                      >

                        <td>

                          <strong>
                            {
                              evento.nombre
                            }
                          </strong>

                        </td>

                        <td>
                          {formatearFecha(
                            evento.fecha
                          )}
                        </td>

                        <td>
                          {
                            evento.ubicacion
                          }
                        </td>

                        <td>

                          {evento.reporte ? (

                            <span className="historial-reporte recibido">
                              Reporte recibido
                            </span>

                          ) : (

                            <span className="historial-reporte pendiente">
                              Sin reporte final
                            </span>

                          )}

                        </td>

                        <td>

                          {evento.reporte ? (

                            <button
                              type="button"
                              className="ver-historial"
                              onClick={() =>
                                setReporteSeleccionado(
                                  evento.reporte
                                )
                              }
                            >
                              Ver reporte
                            </button>

                          ) : (

                            <span className="sin-accion-reporte">
                              —
                            </span>

                          )}

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>

      )}

      {/* ===================================
          MODAL DETALLE
      =================================== */}

      {reporteSeleccionado && (

        <div
          className="modal-reporte-fondo"
          onClick={() =>
            setReporteSeleccionado(
              null
            )
          }
        >

          <div
            className="modal-reporte"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-reporte-header">

              <div>

                <span>
                  REPORTE FINAL
                </span>

                <h2>
                  {reporteSeleccionado
                    .evento?.nombre ||
                    `Evento #${reporteSeleccionado.eventoId}`}
                </h2>

                <p>
                  Enviado el{' '}
                  {formatearFechaHora(
                    reporteSeleccionado
                      .fechaEnvio
                  )}
                </p>

              </div>

              <button
                type="button"
                className="cerrar-reporte"
                onClick={() =>
                  setReporteSeleccionado(
                    null
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="modal-reporte-info">

              <div>

                <span>
                  Fecha del evento
                </span>

                <strong>
                  {formatearFecha(
                    reporteSeleccionado
                      .evento?.fecha
                  )}
                </strong>

              </div>

              <div>

                <span>
                  Capitán
                </span>

                <strong>
                  {reporteSeleccionado
                    .capitan
                    ? `${reporteSeleccionado.capitan.nombre} ${reporteSeleccionado.capitan.apellidos}`
                    : 'Sin información'}
                </strong>

              </div>

              <div>

                <span>
                  Personal asignado
                </span>

                <strong>
                  {reporteSeleccionado
                    .asistencia
                    ?.total ||
                    0}
                </strong>

              </div>

              <div>

                <span>
                  Presentes
                </span>

                <strong>
                  {reporteSeleccionado
                    .asistencia
                    ?.presentes ||
                    0}
                </strong>

              </div>

              <div>

                <span>
                  Ausentes
                </span>

                <strong>
                  {reporteSeleccionado
                    .asistencia
                    ?.ausentes ||
                    0}
                </strong>

              </div>

              <div>

                <span>
                  Sin registrar
                </span>

                <strong>
                  {reporteSeleccionado
                    .asistencia
                    ?.sinRegistrar ||
                    0}
                </strong>

              </div>

            </div>

            <div className="modal-reporte-seccion">

              <span>
                Resumen del servicio
              </span>

              <p>
                {
                  reporteSeleccionado
                    .resumenServicio
                }
              </p>

            </div>

            <div className="modal-reporte-seccion">

              <span>
                Incidencias
              </span>

              <p>
                {reporteSeleccionado
                  .incidencias ||
                  'No se registraron incidencias.'}
              </p>

            </div>

            <div className="modal-reporte-seccion">

              <span>
                Observaciones
              </span>

              <p>
                {reporteSeleccionado
                  .observaciones ||
                  'Sin observaciones adicionales.'}
              </p>

            </div>

            <div className="modal-reporte-botones">

              <button
                type="button"
                onClick={() =>
                  setReporteSeleccionado(
                    null
                  )
                }
              >
                Cerrar
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  )
}

export default AdminReportes