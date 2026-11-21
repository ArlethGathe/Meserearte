import {
  useEffect,
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

const API_URL =
  'http://localhost:3001/api'

function AdminDashboard({
  usuario,
  onLogout
}) {
  const [
    seccion,
    setSeccion
  ] = useState('inicio')

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
                fetch(
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

  const proximosEventos = [
    ...eventos
  ]
    .sort(
      (a, b) =>
        new Date(
          `${a.fecha}T${a.horario || '00:00'}`
        ) -
        new Date(
          `${b.fecha}T${b.horario || '00:00'}`
        )
    )
    .slice(0, 3)

  /* ========================================
     COMPONENTE
  ======================================== */

  return (
    <div className="admin-layout">

      <aside className="admin-sidebar">

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
              setSeccion(
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
              setSeccion(
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
              setSeccion(
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
              setSeccion(
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
              setSeccion(
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
              setSeccion(
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
              setSeccion(
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
