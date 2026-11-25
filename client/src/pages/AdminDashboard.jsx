import {
  useEffect,
  useRef,
  useState
} from 'react'

import './AdminDashboard.css'

import AdminSalas from './AdminSalas.jsx'
import AdminUsuarios from './AdminUsuarios.jsx'
import AdminEventos from './AdminEventos.jsx'
import AdminAsignaciones from './AdminAsignaciones.jsx'
import AdminNotificaciones from './AdminNotificaciones.jsx'
import AdminReportes from './AdminReportes.jsx'
import AdminPerfil from './AdminPerfil.jsx'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

import { API_URL, apiFetch } from '../api.js'
import { obtenerProximosEventos } from '../proximos-eventos.js'

function AdminDashboard({
  usuario,
  onLogout
}) {
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
    notificacionesNoLeidas,
    setNotificacionesNoLeidas
  ] = useState(0)

  const {
    salas,
    meseros,
    eventos,
    asignaciones
  } = useMesereArte()

  /* ========================================
     CONTADOR DE NOTIFICACIONES
  ======================================== */

  const cargarContadorNotificaciones =
    async () => {
      try {
        /*
          Obtenemos todas las salas que
          pertenecen al administrador.
        */

        let salasAdministrador =
          salas.filter(
            (sala) =>
              Number(
                sala.administradorId
              ) ===
              Number(
                usuario?.id
              )
          )

        /*
          Compatibilidad:
          si el usuario ya trae salaId.
        */

        if (
          salasAdministrador.length ===
            0 &&
          usuario?.salaId
        ) {
          const salaUsuario =
            salas.find(
              (sala) =>
                Number(
                  sala.id
                ) ===
                Number(
                  usuario.salaId
                )
            )

          if (salaUsuario) {
            salasAdministrador = [
              salaUsuario
            ]
          }
        }

        /*
          Respaldo para la etapa actual
          del proyecto cuando sólo exista
          una sala.
        */

        if (
          salasAdministrador.length ===
            0 &&
          salas.length ===
            1
        ) {
          salasAdministrador = [
            salas[0]
          ]
        }

        if (
          salasAdministrador.length ===
          0
        ) {
          setNotificacionesNoLeidas(
            0
          )

          return
        }

        /*
          Consultamos las alertas de
          todas las salas del admin.
        */

        const respuestas =
          await Promise.all(
            salasAdministrador.map(
              (sala) =>
                apiFetch(
                  `${API_URL}/notificaciones?salaId=${sala.id}&destinatario=Administrador`
                )
            )
          )

        const resultados =
          await Promise.all(
            respuestas.map(
              async (
                respuesta
              ) => {
                const datos =
                  await respuesta.json()

                if (
                  !respuesta.ok
                ) {
                  throw new Error(
                    datos.mensaje ||
                    'No se pudieron consultar las notificaciones.'
                  )
                }

                return Array.isArray(
                  datos
                )
                  ? datos
                  : []
              }
            )
          )

        /*
          Juntamos las notificaciones
          de todas las salas.
        */

        const todas =
          resultados.flat()

        /*
          Evitamos contar dos veces
          una misma notificación.
        */

        const unicas =
          Array.from(
            new Map(
              todas.map(
                (
                  notificacion
                ) => [
                  notificacion.id,
                  notificacion
                ]
              )
            ).values()
          )

        const noLeidas =
          unicas.filter(
            (
              notificacion
            ) =>
              !notificacion.leida
          ).length

        setNotificacionesNoLeidas(
          noLeidas
        )

      } catch (error) {
        console.error(
          'Error contador de notificaciones:',
          error
        )
      }
    }

  /* ========================================
     ACTUALIZAR CONTADOR AUTOMÁTICAMENTE
  ======================================== */

  useEffect(
    () => {
      cargarContadorNotificaciones()

      const intervalo =
        setInterval(
          () => {
            cargarContadorNotificaciones()
          },
          5000
        )

      return () =>
        clearInterval(
          intervalo
        )
    },
    [
      salas,
      usuario?.id,
      usuario?.salaId
    ]
  )

  /* ========================================
     CONTADORES GENERALES
  ======================================== */

  const totalSalas =
    salas.length

  const totalMeseros =
    meseros.length

  const totalEventos =
    eventos.length

  const eventosConPersonal =
    eventos.filter(
      (evento) =>
        asignaciones.some(
          (asignacion) =>
            asignacion.eventoId ===
            evento.id
        )
    ).length

  const obtenerCantidadAsignados = (
    eventoId
  ) => {
    return asignaciones.filter(
      (asignacion) =>
        asignacion.eventoId ===
        eventoId
    ).length
  }

  /* ========================================
     FECHA
  ======================================== */

  const formatearFecha = (
    fecha
  ) => {
    if (!fecha) return ''

    const [
      anio,
      mes,
      dia
    ] = fecha.split('-')

    return `${dia}/${mes}/${anio}`
  }

  /* ========================================
     PRÓXIMOS EVENTOS
  ======================================== */

  const proximosEventos = obtenerProximosEventos(eventos).slice(0, 3)

  /* ========================================
     COMPONENTE
  ======================================== */

  return (
    <div className="admin-layout">

      <header className="admin-barra-movil">
        <button type="button" ref={botonMenu} aria-label="Abrir menú"
          aria-expanded={menuAbierto} aria-controls="admin-menu-lateral"
          onClick={() => setMenuAbierto(true)}>
          <span aria-hidden="true">☰</span>
        </button>
        <span className="admin-logo-movil" aria-hidden="true">M</span>
        <strong>MesereArte</strong>
      </header>

      {menuAbierto && (
        <div className="admin-fondo-menu" aria-hidden="true" onClick={cerrarMenu} />
      )}

      <aside id="admin-menu-lateral"
        className={menuAbierto ? 'admin-sidebar admin-sidebar--abierto' : 'admin-sidebar'}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') cerrarMenu()
        }}>

        <button type="button" className="admin-cerrar-menu" ref={botonCerrarMenu}
          aria-label="Cerrar menú" onClick={cerrarMenu}>
          <span aria-hidden="true">×</span>
        </button>

        <div className="admin-logo">

          <h2>
            MesereArte
          </h2>

          <span>
            Gestión de eventos
          </span>

        </div>

        <nav className="admin-menu">

          <button
            className={
              seccion ===
              'inicio'
                ? 'activo'
                : ''
            }
            onClick={() =>
              navegarMenu(
                'inicio'
              )
            }
          >
            Inicio
          </button>

          <button
            className={
              seccion ===
              'salas'
                ? 'activo'
                : ''
            }
            onClick={() =>
              navegarMenu(
                'salas'
              )
            }
          >
            Salas
          </button>

          <button
            className={
              seccion ===
              'usuarios'
                ? 'activo'
                : ''
            }
            onClick={() =>
              navegarMenu(
                'usuarios'
              )
            }
          >
            Usuarios
          </button>

          <button
            className={
              seccion ===
              'eventos'
                ? 'activo'
                : ''
            }
            onClick={() =>
              navegarMenu(
                'eventos'
              )
            }
          >
            Eventos
          </button>

          <button
            className={
              seccion ===
              'asignaciones'
                ? 'activo'
                : ''
            }
            onClick={() =>
              navegarMenu(
                'asignaciones'
              )
            }
          >
            Asignaciones
          </button>

          {/* =================================
              NOTIFICACIONES + CONTADOR
          ================================= */}

        <button
  className={
    seccion ===
    'notificaciones'
      ? 'activo admin-menu-notificaciones'
      : 'admin-menu-notificaciones'
  }
  onClick={() => {
    setSeccion(
      'notificaciones'
    )

    cargarContadorNotificaciones()
    cerrarMenu()
  }}
>
  <span>
    Notificaciones
  </span>

  {notificacionesNoLeidas >
    0 && (

    <span className="admin-notificaciones-badge">
      {
        notificacionesNoLeidas >
        99
          ? '99+'
          : notificacionesNoLeidas
      }
    </span>

  )}
</button>

          <button
            className={
              seccion ===
              'reportes'
                ? 'activo'
                : ''
            }
            onClick={() =>
              navegarMenu(
                'reportes'
              )
            }
          >
            Reportes e historiales
          </button>

          <button
            className={
              seccion ===
              'perfil'
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

        <div className="admin-logout">

          <button
            onClick={
              onLogout
            }
          >
            Cerrar sesión
          </button>

        </div>

      </aside>

      <main className="admin-main">

        {seccion ===
          'salas' ? (

          <AdminSalas />

        ) : seccion ===
          'usuarios' ? (

          <AdminUsuarios administradorId={usuario.id} />

        ) : seccion ===
          'eventos' ? (

          <AdminEventos />

        ) : seccion ===
          'asignaciones' ? (

          <AdminAsignaciones />

        ) : seccion ===
          'notificaciones' ? (

          <AdminNotificaciones
            usuario={
              usuario
            }
          />

        ) : seccion ===
          'reportes' ? (

          <AdminReportes />

        ) : seccion ===
          'perfil' ? (

          <AdminPerfil
            usuario={
              usuario
            }
          />

        ) : (

          <div className="dashboard-pagina">

            <div className="dashboard-encabezado">

              <div>

                <h1>
                  Panel de administración
                </h1>

                <p>
                  Bienvenido a MesereArte.
                  Consulta el estado general
                  de tus equipos y eventos.
                </p>

              </div>

            </div>

            <div className="dashboard-cards">

              <div className="dashboard-card">

                <span>
                  Salas
                </span>

                <strong>
                  {totalSalas}
                </strong>

                <p>
                  Equipos registrados
                </p>

              </div>

              <div className="dashboard-card">

                <span>
                  Meseros
                </span>

                <strong>
                  {totalMeseros}
                </strong>

                <p>
                  Usuarios registrados
                </p>

              </div>

              <div className="dashboard-card">

                <span>
                  Eventos
                </span>

                <strong>
                  {totalEventos}
                </strong>

                <p>
                  Eventos registrados
                </p>

              </div>

              <div className="dashboard-card">

                <span>
                  Con personal
                </span>

                <strong>
                  {eventosConPersonal}
                </strong>

                <p>
                  Eventos con asignaciones
                </p>

              </div>

            </div>

            <div className="dashboard-seccion">

              <div className="dashboard-seccion-header">

                <div>

                  <h2>
                    Próximos eventos
                  </h2>

                  <p>
                    Consulta los eventos
                    registrados.
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

              <div className="dashboard-eventos">

                {proximosEventos.length >
                0 ? (

                  proximosEventos.map(
                    (evento) => (

                      <div
                        className="dashboard-evento"
                        key={
                          evento.id
                        }
                      >

                        <div className="dashboard-evento-info">

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

                          <span>
                            {
                              evento.ubicacion
                            }
                          </span>

                        </div>

                        <div className="dashboard-evento-personal">

                          <span>
                            Personal
                          </span>

                          <strong>
                            {obtenerCantidadAsignados(
                              evento.id
                            )}

                            {' / '}

                            {
                              evento
                                .meserosRequeridos
                            }
                          </strong>

                          <small>
                            meseros
                          </small>

                        </div>

                      </div>

                    )
                  )

                ) : (

                  <div className="dashboard-sin-eventos">

                    No hay eventos
                    registrados.

                  </div>

                )}

              </div>

            </div>

          </div>

        )}

      </main>

    </div>
  )
}

export default AdminDashboard
