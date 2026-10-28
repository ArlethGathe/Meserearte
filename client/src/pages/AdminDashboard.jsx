import { useState } from 'react'
import './AdminDashboard.css'

import AdminSalas from './AdminSalas.jsx'
import AdminUsuarios from './AdminUsuarios.jsx'
import AdminEventos from './AdminEventos.jsx'
import AdminAsignaciones from './AdminAsignaciones.jsx'
import AdminNotificaciones from './AdminNotificaciones.jsx'
import AdminReportes from './AdminReportes.jsx'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

function AdminDashboard({
  usuario,
  onLogout
}) {
  const [
    seccion,
    setSeccion
  ] = useState('inicio')

  const {
    salas,
    meseros,
    eventos,
    asignaciones
  } = useMesereArte()

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
              seccion === 'inicio'
                ? 'activo'
                : ''
            }
            onClick={() =>
              setSeccion('inicio')
            }
          >
            Inicio
          </button>

          <button
            className={
              seccion === 'salas'
                ? 'activo'
                : ''
            }
            onClick={() =>
              setSeccion('salas')
            }
          >
            Salas
          </button>

          <button
            className={
              seccion === 'usuarios'
                ? 'activo'
                : ''
            }
            onClick={() =>
              setSeccion('usuarios')
            }
          >
            Usuarios
          </button>

          <button
            className={
              seccion === 'eventos'
                ? 'activo'
                : ''
            }
            onClick={() =>
              setSeccion('eventos')
            }
          >
            Eventos
          </button>

          <button
            className={
              seccion === 'asignaciones'
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

          <button
            className={
              seccion === 'notificaciones'
                ? 'activo'
                : ''
            }
            onClick={() =>
              setSeccion(
                'notificaciones'
              )
            }
          >
            Notificaciones
          </button>

          <button
            className={
              seccion === 'reportes'
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

        </nav>

        <div className="admin-logout">

          <button
            onClick={onLogout}
          >
            Cerrar sesión
          </button>

        </div>

      </aside>

      <main className="admin-main">

        {seccion === 'salas' ? (

          <AdminSalas />

        ) : seccion === 'usuarios' ? (

          <AdminUsuarios />

        ) : seccion === 'eventos' ? (

          <AdminEventos />

        ) : seccion === 'asignaciones' ? (

          <AdminAsignaciones />

        ) : seccion === 'notificaciones' ? (

          <AdminNotificaciones
            usuario={usuario}
          />

        ) : seccion === 'reportes' ? (

          <AdminReportes />

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
                <span>Salas</span>
                <strong>{totalSalas}</strong>
                <p>Equipos registrados</p>
              </div>

              <div className="dashboard-card">
                <span>Meseros</span>
                <strong>{totalMeseros}</strong>
                <p>Usuarios registrados</p>
              </div>

              <div className="dashboard-card">
                <span>Eventos</span>
                <strong>{totalEventos}</strong>
                <p>Eventos registrados</p>
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
                        key={evento.id}
                      >

                        <div className="dashboard-evento-info">

                          <h3>
                            {evento.nombre}
                          </h3>

                          <p>
                            {formatearFecha(
                              evento.fecha
                            )}
                            {' · '}
                            {evento.horario}
                          </p>

                          <span>
                            {evento.ubicacion}
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