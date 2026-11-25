import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

import './MeseroDashboard.css'

import CapitanPanel from './CapitanPanel.jsx'

import MeseroPerfil from './MeseroPerfil.jsx'

import MeseroNotificaciones from './MeseroNotificaciones.jsx'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

import { API_URL, apiFetch } from '../api.js'
import { obtenerProximosEventos } from '../proximos-eventos.js'

function MeseroDashboard({
  usuario,
  onLogout
}) {
  const {
    meseros,
    eventos,
    asignaciones,
    salas,
    disponibilidades,
    actualizarDisponibilidadAPI
  } = useMesereArte()

  const [
    seccion,
    setSeccion
  ] = useState('inicio')

  const [menuAbierto, setMenuAbierto] = useState(false)
  const botonMenu = useRef(null)
  const botonCerrarMenu = useRef(null)

  useEffect(() => {
    if (menuAbierto) botonCerrarMenu.current?.focus()
  }, [menuAbierto])

  function cerrarMenu() {
    if (!menuAbierto) return
    setMenuAbierto(false)
    botonMenu.current?.focus()
  }

  function navegarMenu(destino) {
    setSeccion(destino)
    cerrarMenu()
  }

  const [
    procesandoEvento,
    setProcesandoEvento
  ] = useState(null)

  const [
    mensaje,
    setMensaje
  ] = useState('')

  const [
    error,
    setError
  ] = useState('')

  const [notificacionesMesero, setNotificacionesMesero] = useState([])
  const [avisoNotificacion, setAvisoNotificacion] = useState(null)
  const [cargandoNotificaciones, setCargandoNotificaciones] = useState(true)
  const [errorNotificaciones, setErrorNotificaciones] = useState('')
  const idsNotificacionesRef = useRef(null)
  const consultaNotificacionesRef = useRef(null)

  const meseroActual = meseros.find((mesero) => mesero.id === usuario.meseroId)
  const meseroId = meseroActual?.id

  const cargarNotificaciones = useCallback(async () => {
    if (!meseroId || consultaNotificacionesRef.current) return

    const controlador = new AbortController()
    consultaNotificacionesRef.current = controlador
    setErrorNotificaciones('')
    try {
      const respuesta = await apiFetch(`${API_URL}/notificaciones/mesero/${meseroId}`, {
        signal: controlador.signal
      })
      const datos = await respuesta.json()
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudieron consultar las notificaciones.')
      if (controlador.signal.aborted) return

      const claves = new Set()
      const unicas = datos.filter(({ id, envioId }) => {
        const clave = envioId ? `envio-${envioId}` : `notificacion-${id}`
        if (claves.has(clave)) return false
        claves.add(clave)
        return true
      })

      const idsAnteriores = idsNotificacionesRef.current
      idsNotificacionesRef.current = new Set(unicas.map(({ id }) => id))
      const nueva = idsAnteriores && unicas.find(({ id, leida }) => !leida && !idsAnteriores.has(id))
      if (nueva) setAvisoNotificacion(nueva)
      setNotificacionesMesero((anteriores) => {
        // Un GET iniciado antes de marcar un aviso no puede devolverlo a «sin leer».
        const leidas = new Set(anteriores.filter(({ leida }) => leida).map(({ id }) => id))
        return unicas.map((item) => leidas.has(item.id) ? { ...item, leida: true } : item)
      })
    } catch (error) {
      if (!controlador.signal.aborted) setErrorNotificaciones(error.message)
    } finally {
      if (consultaNotificacionesRef.current === controlador) {
        consultaNotificacionesRef.current = null
        setCargandoNotificaciones(false)
      }
    }
  }, [meseroId])

  useEffect(() => {
    idsNotificacionesRef.current = null
    setNotificacionesMesero([])
    setAvisoNotificacion(null)
    setCargandoNotificaciones(Boolean(meseroId))
    if (!meseroId) return

    cargarNotificaciones()
    const intervalo = setInterval(cargarNotificaciones, 5000)
    return () => {
      clearInterval(intervalo)
      consultaNotificacionesRef.current?.abort()
      consultaNotificacionesRef.current = null
    }
  }, [meseroId, cargarNotificaciones])

  const notificacionesNoLeidas = notificacionesMesero.filter(({ leida }) => !leida).length

  function confirmarNotificacionLeida(id) {
    setNotificacionesMesero((anteriores) =>
      anteriores.map((item) => item.id === id ? { ...item, leida: true } : item)
    )
  }

  function abrirNotificaciones() {
    setSeccion('notificaciones')
    setAvisoNotificacion(null)
  }

  /* ========================================
     SALA
  ======================================== */

  const salaActual =
    salas.find(
      (sala) =>
        sala.id ===
        usuario.salaId
    )

  /* ========================================
     ASIGNACIONES
  ======================================== */

  const asignacionesMesero =
    meseroActual
      ? asignaciones.filter(
          (asignacion) =>
            asignacion.meseroId ===
            meseroActual.id
        )
      : []

  /* ========================================
     EVENTOS ASIGNADOS
  ======================================== */

  const eventosAsignados =
    asignacionesMesero
      .map(
        (asignacion) => {
          const evento =
            eventos.find(
              (evento) =>
                evento.id ===
                asignacion.eventoId
            )

          if (!evento) {
            return null
          }

          const registroDisponibilidad =
            disponibilidades.find(
              (item) =>
                item.eventoId ===
                  evento.id &&
                item.meseroId ===
                  meseroActual.id
            )

          return {
            ...evento,

            rolEvento:
              asignacion.rol,

            disponibilidad:
              registroDisponibilidad
                ?.estado ||
              'Pendiente',

            fechaRespuesta:
              registroDisponibilidad
                ?.fechaRespuesta ||
              null
          }
        }
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(
            `${a.fecha}T${a.horario || '00:00'}`
          ) -
          new Date(
            `${b.fecha}T${b.horario || '00:00'}`
          )
      )

  /* ========================================
     EVENTOS COMO CAPITÁN
  ======================================== */

  const eventosCapitan =
    eventosAsignados.filter(
      (evento) =>
        evento.rolEvento === 'Capitán'
        && evento.disponibilidad !== 'No disponible'
    )

  const totalEventosCapitan =
    eventosCapitan.length

  const proximosEventos = obtenerProximosEventos(eventosAsignados).slice(0, 3)

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
     RESPONDER DISPONIBILIDAD
  ======================================== */

  const cambiarDisponibilidad =
    async (
      eventoId,
      estado
    ) => {
      if (!meseroActual) {
        return
      }

      try {
        setMensaje('')
        setError('')

        setProcesandoEvento(
          eventoId
        )

        await actualizarDisponibilidadAPI(
          eventoId,
          meseroActual.id,
          estado
        )

        if (
          estado ===
          'Confirmado'
        ) {
          setMensaje(
            'Asistencia confirmada correctamente.'
          )
        }

        if (
          estado ===
          'No disponible'
        ) {
          setMensaje(
            'Se registró que no estás disponible para este evento.'
          )
        }

      } catch (error) {

        setError(
          error.message
        )

      } finally {

        setProcesandoEvento(
          null
        )

      }
    }

  /* ========================================
     CONTADORES
  ======================================== */

  const eventosConfirmados =
    eventosAsignados.filter(
      (evento) =>
        evento.disponibilidad ===
        'Confirmado'
    ).length

  const eventosPendientes =
    eventosAsignados.filter(
      (evento) =>
        evento.disponibilidad ===
        'Pendiente'
    ).length

  return (
    <div className="mesero-layout">

      <header className="mesero-barra-movil">
        <button type="button" ref={botonMenu} aria-label="Abrir menú"
          aria-expanded={menuAbierto} aria-controls="mesero-menu-lateral"
          onClick={() => setMenuAbierto(true)}>
          <span aria-hidden="true">☰</span>
        </button>
        <span className="mesero-logo-icono" aria-hidden="true">M</span>
        <strong>MesereArte</strong>
      </header>

      {menuAbierto && (
        <div className="mesero-fondo-menu" aria-hidden="true" onClick={cerrarMenu} />
      )}

      {/* ===================================
          SIDEBAR
      =================================== */}

      <aside id="mesero-menu-lateral"
        className={menuAbierto ? 'mesero-sidebar mesero-sidebar--abierto' : 'mesero-sidebar'}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') cerrarMenu()
        }}>

        <button type="button" className="mesero-cerrar-menu" ref={botonCerrarMenu}
          aria-label="Cerrar menú" onClick={cerrarMenu}>
          <span aria-hidden="true">×</span>
        </button>

        <div className="mesero-logo">

          <div className="mesero-logo-icono">
            M
          </div>

          <div>

            <h2>
              MesereArte
            </h2>

            <span>
              Panel del mesero
            </span>

          </div>

        </div>

        <nav className="mesero-menu">

          <button
            className={
              seccion === 'inicio'
                ? 'activo'
                : ''
            }
            onClick={() =>
              navegarMenu('inicio')
            }
          >
            Inicio
          </button>

          <button
            className={
              seccion === 'eventos'
                ? 'activo'
                : ''
            }
            onClick={() =>
              navegarMenu('eventos')
            }
          >
            Mis eventos
          </button>

          <button
            className={
              seccion === 'disponibilidad' ? 'mesero-opcion-contador activo' : 'mesero-opcion-contador'
            }
            onClick={() =>
              navegarMenu(
                'disponibilidad'
              )
            }
          >
            <span>Disponibilidad</span>
            {eventosPendientes > 0 && (
              <span className="mesero-notificaciones-contador">
                {eventosPendientes > 99 ? '99+' : eventosPendientes}
              </span>
            )}
          </button>

          <button
            className={
              seccion === 'notificaciones' ? 'mesero-opcion-contador activo' : 'mesero-opcion-contador'
            }
            onClick={() => {
              abrirNotificaciones()
              cerrarMenu()
            }}
          >
            <span>
              Notificaciones
            </span>

            {notificacionesNoLeidas >
              0 && (

              <span className="mesero-notificaciones-contador">
                {notificacionesNoLeidas >
                99
                  ? '99+'
                  : notificacionesNoLeidas}
              </span>

            )}
          </button>

          <button
            className={seccion === 'capitan' ? 'activo' : ''}
            onClick={() => navegarMenu('capitan')}
          >
            Funciones de capitán
          </button>

          <button
            className={
              seccion === 'perfil'
                ? 'activo'
                : ''
            }
            onClick={() =>
              navegarMenu(
                'perfil'
              )
            }
          >
            Mi perfil
          </button>

        </nav>

        <div className="mesero-logout">

          <button
            onClick={onLogout}
          >
            Cerrar sesión
          </button>

        </div>

      </aside>

      {/* ===================================
          CONTENIDO
      =================================== */}

      <main className="mesero-main">

        {avisoNotificacion &&
          seccion !==
            'notificaciones' && (

          <div className="mesero-notificacion-emergente">

            <div className="mesero-notificacion-emergente-texto">

              <strong>
                {avisoNotificacion.titulo}
              </strong>

              <span>
                {avisoNotificacion.mensaje}
              </span>

            </div>

            <div className="mesero-notificacion-emergente-acciones">

              <button
                type="button"
                onClick={
                  abrirNotificaciones
                }
              >
                Ver
              </button>

              <button
                type="button"
                aria-label="Cerrar aviso"
                onClick={() =>
                  setAvisoNotificacion(
                    null
                  )
                }
              >
                ×
              </button>

            </div>

          </div>

        )}

        {mensaje && (

          <div className="mesero-mensaje correcto">

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

          <div className="mesero-mensaje error">

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
            INICIO
        ================================= */}

        {seccion === 'inicio' && (

          <div className="mesero-pagina">

            <div className="mesero-bienvenida">

              <div>

                <p className="mesero-etiqueta">
                  PANEL DE MESERO
                </p>

                <h1>
                  Hola, {
                    usuario.nombre
                  }
                </h1>

                <p>
                  Consulta tus eventos,
                  disponibilidad y funciones
                  dentro de MesereArte.
                </p>

              </div>

              <div className="mesero-sala">

                <span>
                  Sala
                </span>

                <strong>
                  {salaActual
                    ? salaActual.nombre
                    : 'Sin sala'}
                </strong>

              </div>

            </div>

            <div className="mesero-cards">

              <div className="mesero-card">

                <span>
                  Eventos asignados
                </span>

                <strong>
                  {
                    eventosAsignados.length
                  }
                </strong>

                <p>
                  Eventos en los que
                  participas.
                </p>

              </div>

              <div className="mesero-card">

                <span>
                  Confirmados
                </span>

                <strong>
                  {eventosConfirmados}
                </strong>

                <p>
                  Asistencias confirmadas.
                </p>

              </div>

              <div className="mesero-card">

                <span>
                  Pendientes
                </span>

                <strong>
                  {eventosPendientes}
                </strong>

                <p>
                  Eventos por responder.
                </p>

              </div>

              <div className="mesero-card">

                <span>
                  Como capitán
                </span>

                <strong>
                  {
                    totalEventosCapitan
                  }
                </strong>

                <p>
                  Eventos con rol temporal
                  de capitán.
                </p>

              </div>

            </div>

            <section className="mesero-seccion">

              <div className="mesero-seccion-header">

                <div>

                  <h2>
                    Próximos eventos
                  </h2>

                  <p>
                    Tus eventos asignados que aún no terminan.
                  </p>

                </div>

                <button
                  onClick={() =>
                    setSeccion(
                      'eventos'
                    )
                  }
                >
                  Ver todos
                </button>

              </div>

              <div className="mesero-eventos">

                {proximosEventos.length >
                0 ? (

                  proximosEventos
                    .map(
                      (evento) => (

                        <div
                          className="mesero-evento"
                          key={
                            evento.id
                          }
                        >

                          <div className="mesero-evento-etiquetas">

                            <span
                              className={
                                evento.rolEvento ===
                                'Capitán'
                                  ? 'rol-capitan'
                                  : 'rol-mesero'
                              }
                            >
                              {
                                evento.rolEvento
                              }
                            </span>

                            <span
                              className={`disponibilidad-estado ${evento.disponibilidad
                                .toLowerCase()
                                .replaceAll(
                                  ' ',
                                  '-'
                                )}`}
                            >
                              {
                                evento.disponibilidad
                              }
                            </span>

                          </div>

                          <h3>
                            {
                              evento.nombre
                            }
                          </h3>

                          <p>
                            {formatearFecha(
                              evento.fecha
                            )}
                            {' · '}
                            {
                              evento.horario
                            }
                          </p>

                          <small>
                            {evento.lugar ||
                              'Lugar sin especificar'}
                          </small>

                          {evento.ubicacion
                            ?.startsWith('http') && (

                            <a
                              href={evento.ubicacion}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Abrir en Google Maps
                            </a>

                          )}

                        </div>

                      )
                    )

                ) : (

                  <div className="mesero-vacio">

                    No tienes próximos eventos asignados.

                  </div>

                )}

              </div>

            </section>

          </div>

        )}

        {/* =================================
            MIS EVENTOS
        ================================= */}

        {seccion ===
          'eventos' && (

          <div className="mesero-pagina">

            <div className="mesero-titulo">

              <h1>
                Mis eventos
              </h1>

              <p>
                Consulta los eventos a los
                que has sido asignado.
              </p>

            </div>

            <div className="mesero-eventos-lista">

              {eventosAsignados.length >
              0 ? (

                eventosAsignados.map(
                  (evento) => (

                    <div
                      className="mesero-evento-card"
                      key={
                        evento.id
                      }
                    >

                      <div className="mesero-evento-superior">

                        <div>

                          <div className="mesero-evento-etiquetas">

                            <span
                              className={
                                evento.rolEvento ===
                                'Capitán'
                                  ? 'rol-capitan'
                                  : 'rol-mesero'
                              }
                            >
                              {
                                evento.rolEvento
                              }
                            </span>

                            <span
                              className={`disponibilidad-estado ${evento.disponibilidad
                                .toLowerCase()
                                .replaceAll(
                                  ' ',
                                  '-'
                                )}`}
                            >
                              {
                                evento.disponibilidad
                              }
                            </span>

                          </div>

                          <h2>
                            {
                              evento.nombre
                            }
                          </h2>

                        </div>

                        <span className="evento-estado-mesero">
                          {
                            evento.estado
                          }
                        </span>

                      </div>

                      <div className="mesero-evento-datos">

                        <div>

                          <span>
                            Fecha
                          </span>

                          <strong>
                            {formatearFecha(
                              evento.fecha
                            )}
                          </strong>

                        </div>

                        <div>

                          <span>
                            Horario
                          </span>

                          <strong>
                            {
                              evento.horario
                            }
                          </strong>

                        </div>

                        <div>

                          <span>
                            Lugar
                          </span>

                          <strong>
                            {evento.lugar ||
                              'Sin especificar'}
                          </strong>

                        </div>

                        <div>

                          <span>
                            Ubicación
                          </span>

                          <strong>
                            {evento.ubicacion
                              ?.startsWith('http') ? (

                              <a
                                href={evento.ubicacion}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Abrir en Google Maps
                              </a>

                            ) : (
                              'Sin enlace registrado'
                            )}
                          </strong>

                        </div>

                        <div>

                          <span>
                            Uniforme
                          </span>

                          <strong>
                            {evento.uniforme ||
                              'Sin especificar'}
                          </strong>

                        </div>

                      </div>

                      {evento.observaciones && (

                        <div className="mesero-observaciones">

                          <strong>
                            Observaciones
                          </strong>

                          <p>
                            {
                              evento.observaciones
                            }
                          </p>

                        </div>

                      )}

                    </div>

                  )
                )

              ) : (

                <div className="mesero-vacio">

                  No tienes eventos
                  asignados.

                </div>

              )}

            </div>

          </div>

        )}

        {/* =================================
            DISPONIBILIDAD
        ================================= */}

        {seccion ===
          'disponibilidad' && (

          <div className="mesero-pagina">

            <div className="mesero-titulo">

              <h1>
                Disponibilidad
              </h1>

              <p>
                Confirma si puedes asistir
                a cada uno de los eventos
                que tienes asignados.
              </p>

            </div>

            <div className="disponibilidad-lista">

              {eventosAsignados.length >
              0 ? (

                eventosAsignados.map(
                  (evento) => {

                    const estado =
                      evento.disponibilidad

                    return (

                      <div
                        className="disponibilidad-card"
                        key={
                          evento.id
                        }
                      >

                        <div className="disponibilidad-info">

                          <div className="mesero-evento-etiquetas">

                            <span
                              className={
                                evento.rolEvento ===
                                'Capitán'
                                  ? 'rol-capitan'
                                  : 'rol-mesero'
                              }
                            >
                              {
                                evento.rolEvento
                              }
                            </span>

                            <span
                              className={`disponibilidad-estado ${estado
                                .toLowerCase()
                                .replaceAll(
                                  ' ',
                                  '-'
                                )}`}
                            >
                              {estado}
                            </span>

                          </div>

                          <h2>
                            {
                              evento.nombre
                            }
                          </h2>

                          <p>
                            {formatearFecha(
                              evento.fecha
                            )}
                            {' · '}
                            {
                              evento.horario
                            }
                          </p>

                          <span>
                            {evento.lugar ||
                              'Lugar sin especificar'}
                          </span>

                          {evento.ubicacion
                            ?.startsWith('http') && (

                            <a
                              href={evento.ubicacion}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Abrir en Google Maps
                            </a>

                          )}

                        </div>

                        <div className="disponibilidad-acciones">

                          {estado ===
                            'Pendiente' && (
                            <>

                              <button
                                type="button"
                                className="confirmar-asistencia"
                                disabled={
                                  procesandoEvento ===
                                  evento.id
                                }
                                onClick={() =>
                                  cambiarDisponibilidad(
                                    evento.id,
                                    'Confirmado'
                                  )
                                }
                              >
                                {procesandoEvento ===
                                evento.id
                                  ? 'Guardando...'
                                  : 'Confirmar asistencia'}
                              </button>

                              <button
                                type="button"
                                className="no-disponible"
                                disabled={
                                  procesandoEvento ===
                                  evento.id
                                }
                                onClick={() =>
                                  cambiarDisponibilidad(
                                    evento.id,
                                    'No disponible'
                                  )
                                }
                              >
                                No disponible
                              </button>

                            </>
                          )}

                          {estado ===
                            'Confirmado' && (

                            <button
                              type="button"
                              className="confirmar-asistencia estado-actual"
                              disabled
                            >
                              ✓ Asistencia confirmada
                            </button>

                          )}

                          {estado ===
                            'No disponible' && (

                            <button
                              type="button"
                              className="no-disponible estado-actual"
                              disabled
                            >
                              ✕ No disponible
                            </button>

                          )}

                        </div>

                      </div>

                    )
                  }
                )

              ) : (

                <div className="mesero-vacio">

                  No tienes eventos
                  asignados.

                </div>

              )}

            </div>

          </div>

        )}

        {/* =================================
            NOTIFICACIONES
        ================================= */}

        {seccion ===
          'notificaciones' && (
            
          <MeseroNotificaciones
            notificaciones={notificacionesMesero}
            cargando={cargandoNotificaciones}
            errorConsulta={errorNotificaciones}
            cargarNotificaciones={cargarNotificaciones}
            onLeida={confirmarNotificacionLeida}
          />
          
        )}

        {/* =================================
            FUNCIONES DE CAPITÁN
        ================================= */}

        {seccion ===
          'capitan' && (

          <CapitanPanel
            mesero={
              meseroActual
            }
            eventos={
              eventosCapitan
            }
          />

        )}

        {/* =================================
            PERFIL
        ================================= */}

        {seccion === 'perfil' && <MeseroPerfil />}

      </main>

    </div>
  )
}

export default MeseroDashboard
