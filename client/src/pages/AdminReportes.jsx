import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import './AdminReportes.css'
import HistorialMeseros from './HistorialMeseros.jsx'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

import { API_URL, apiFetch } from '../api.js'

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

  const [consultaDetalle, setConsultaDetalle] = useState(null)
  const [observacion, setObservacion] = useState(null)
  const dialogoObservacion = useRef(null)
  const eventoDetalleId = reporteSeleccionado?.eventoId
  const consultaActual = consultaDetalle?.eventoId === eventoDetalleId ? consultaDetalle : null
  const detalle = consultaActual?.datos

  useEffect(() => {
    if (!eventoDetalleId) return
    const controlador = new AbortController()
    apiFetch(`${API_URL}/reportes/evento/${eventoDetalleId}`, { signal: controlador.signal })
      .then(async (respuesta) => {
        const datos = await respuesta.json()
        if (!respuesta.ok) throw new Error(datos.mensaje || 'No fue posible consultar el reporte.')
        if (!controlador.signal.aborted) setConsultaDetalle({ eventoId: eventoDetalleId, datos })
      })
      .catch((error) => {
        if (!controlador.signal.aborted) setConsultaDetalle({ eventoId: eventoDetalleId, error: error.message })
      })
    return () => controlador.abort()
  }, [eventoDetalleId])

  function cerrarReporte() {
    setReporteSeleccionado(null)
    setConsultaDetalle(null)
    setObservacion(null)
  }

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
          await apiFetch(url)

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

              return { ...reporte, evento }
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
        eventos
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
          (reporte.eventoNombre ?? reporte.evento?.nombre ?? '').toLowerCase()

        const nombreAutor =
          reporte.autor?.nombreCompleto?.toLowerCase() ?? ''

        return (
          nombreEvento.includes(
            texto
          ) ||
          nombreAutor.includes(
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

  const totalRetardos = reportesFinales.reduce((total, reporte) => total + (reporte.asistencia?.retardos ?? 0), 0)

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
            los historiales de eventos y de meseros.
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
            Presentes
          </span>

          <strong>
            {totalPresentes}
          </strong>

          <p>
            Personal registrado
            como presente.
          </p>

        </div>

        <div className="resumen-retardos">
          <span>Retardos</span>
          <strong>{totalRetardos}</strong>
          <p>Personal que llegó con retardo.</p>
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
          Reportes de eventos
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

        <button type="button" className={pestaña === 'meseros' ? 'activo' : ''}
          onClick={() => setPestaña('meseros')}>
          Historial de meseros
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

      {pestaña === 'meseros' && <HistorialMeseros meseros={meseros} />}

      {pestaña ===
        'reportes' && (

        <>

          <div className="reportes-filtros">

            <input
              type="text"
              placeholder="Buscar por evento o autor..."
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
                          {reporte.eventoNombre ||
                            `Evento #${reporte.eventoId}`}
                        </h2>

                        <p>
                          {formatearFecha(
                            reporte.eventoFecha
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
                          Autor del reporte
                        </span>

                        <strong>
                          {reporte.autor?.nombreCompleto || 'Sin información'}
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
                          Retardos
                        </span>
                        <strong>{reporte.asistencia?.retardos ?? 0}</strong>
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
          onClick={cerrarReporte}
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
                    .eventoNombre ||
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
                onClick={cerrarReporte}
              >
                ×
              </button>

            </div>

            {!consultaActual && <p role="status">Cargando detalle del reporte…</p>}
            {consultaActual?.error && <p role="alert">{consultaActual.error}</p>}
            {detalle && <>
            <div className="modal-reporte-info">

              <div>

                <span>
                  Fecha del evento
                </span>

                <strong>
                  {formatearFecha(
                    detalle.eventoFecha
                  )}
                </strong>

              </div>

              <div>
                <span>Autor del reporte</span>
                <strong>{detalle.autor?.nombreCompleto || 'Sin información'}</strong>
              </div>
              <div>
                <span>Capitán actual</span>
                <strong>{detalle.capitanActual?.nombreCompleto || 'Sin asignar'}</strong>
              </div>

              <div>

                <span>
                  Personal asignado
                </span>

                <strong>
                  {detalle.resumenAsistencia
                    ?.total ||
                    0}
                </strong>

              </div>

              <div>

                <span>
                  Presentes
                </span>

                <strong>
                  {detalle.resumenAsistencia
                    ?.presentes ||
                    0}
                </strong>

              </div>

              <div>

                <span>
                  Retardos
                </span>
                <strong>{detalle.resumenAsistencia?.retardos ?? 0}</strong>
              </div>

              <div>
                <span>
                  Ausentes
                </span>

                <strong>
                  {detalle.resumenAsistencia
                    ?.ausentes ||
                    0}
                </strong>

              </div>

              <div>

                <span>
                  Sin registrar
                </span>

                <strong>
                  {detalle.resumenAsistencia
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
                  detalle.resumenServicio
                }
              </p>

            </div>

            <div className="modal-reporte-seccion">

              <span>
                Incidencias
              </span>

              <p>
                {detalle.incidencias ||
                  'No se registraron incidencias.'}
              </p>

            </div>

            <div className="modal-reporte-seccion">

              <span>
                Observaciones
              </span>

              <p>
                {detalle.observaciones ||
                  'Sin observaciones adicionales.'}
              </p>

            </div>

            <section className="modal-reporte-seccion">
              <h3>Personal asignado</h3>
              {detalle.personal.length === 0 ? <p>No hay personal asignado.</p> : (
                <div className="tabla-reportes-responsive">
                  <table className="reporte-personal">
                    <thead>
                      <tr>
                        {['Nombre', 'Rol', 'Asistencia', 'Desempeño', 'Puntualidad', 'Actitud', 'Incidencia', 'Observación'].map(
                          (columna) => <th key={columna} scope="col">{columna}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.personal.map(({ meseroId, nombreCompleto, rol, asistencia, evaluacion }) => (
                        <tr key={meseroId}>
                          <th scope="row">{nombreCompleto}</th>
                          <td>{rol}</td>
                          <td>{asistencia}</td>
                          {evaluacion ? <>
                            <td>{evaluacion.desempeno ?? '—'}</td>
                            <td>{evaluacion.puntualidad ?? '—'}</td>
                            <td>{evaluacion.actitud ?? '—'}</td>
                            <td>{evaluacion.incidencia == null ? '—' : evaluacion.incidencia ? 'Sí' : 'No'}</td>
                            <td>{evaluacion.observacion ? (
                              <button type="button" className="historial-observacion-enlace" onClick={() => {
                                setObservacion({ nombreCompleto, texto: evaluacion.observacion })
                                dialogoObservacion.current.showModal()
                              }}>Ver observación</button>
                            ) : '—'}</td>
                          </> : <td colSpan={5}>Sin evaluación</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <dialog className="historial-observacion-modal reporte-observacion" ref={dialogoObservacion}
                aria-labelledby="titulo-reporte-observacion">
                <header>
                  <h3 id="titulo-reporte-observacion">Observación del mesero</h3>
                  <button type="button" className="historial-observacion-x" aria-label="Cerrar observación"
                    onClick={() => dialogoObservacion.current.close()}>×</button>
                </header>
                <p className="historial-observacion-evento">{observacion?.nombreCompleto}</p>
                <p className="historial-observacion-texto">{observacion?.texto}</p>
                <footer><button type="button" onClick={() => dialogoObservacion.current.close()}>Cerrar</button></footer>
              </dialog>
            </section>
            </>}

            <div className="modal-reporte-botones">

              <button
                type="button"
                onClick={cerrarReporte}
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
