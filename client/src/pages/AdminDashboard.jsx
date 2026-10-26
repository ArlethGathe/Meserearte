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

function AdminDashboard({ onLogout }) {
  const [seccion, setSeccion] =
    useState('inicio')

  const {
    salas,
    meseros,
    eventos,
    asignaciones
  } = useMesereArte()

  /* =========================
     DATOS DEL DASHBOARD
  ========================= */

  const totalSalas =
    salas.length

  const totalMeseros =
    meseros.length

  const totalEventos =
    eventos.length

  const eventosConPersonal =
    eventos.filter((evento) =>
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

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return ''
    }

    const partes =
      fecha.split('-')

    if (partes.length !== 3) {
      return fecha
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`
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

  /* =========================
     CAMBIO DE SECCIÓN
  ========================= */

  const cambiarSeccion = (
    nuevaSeccion
  ) => {
    setSeccion(
      nuevaSeccion
    )
  }

  return (
    <div className="admin-layout">

      {/* ======================
          MENÚ LATERAL
      ====================== */}

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
              cambiarSeccion(
                'inicio'
              )
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
              cambiarSeccion(
                'salas'
              )
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
              cambiarSeccion(
                'usuarios'
              )
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
              cambiarSeccion(
                'eventos'
              )
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
              cambiarSeccion(
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
              cambiarSeccion(
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
              cambiarSeccion(
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

      {/* ======================
          CONTENIDO
      ====================== */}

      <main className="admin-main">

        {seccion === 'salas' ? (

          <AdminSalas />

        ) : seccion ===
          'usuarios' ? (

          <AdminUsuarios />

        ) : seccion ===
          'eventos' ? (

          <AdminEventos />

        ) : seccion ===
          'asignaciones' ? (

          <AdminAsignaciones />

        ) : seccion ===
          'notificaciones' ? (

          <AdminNotificaciones />

        ) : seccion ===
          'reportes' ? (

          <AdminReportes />

        ) : (

          <div className="dashboard-pagina">

            {/* ==================
                ENCABEZADO
            ================== */}

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

            {/* ==================
                TARJETAS
            ================== */}

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

            {/* ==================
                PRÓXIMOS EVENTOS
            ================== */}

            <div className="dashboard-seccion">

              <div className="dashboard-seccion-header">

                <div>

                  <h2>
                    Próximos eventos
                  </h2>

                  <p>
                    Consulta los eventos
                    registrados recientemente.
                  </p>

                </div>

                <button
                  onClick={() =>
                    cambiarSeccion(
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
                    (evento) => {

                      const asignados =
                        obtenerCantidadAsignados(
                          evento.id
                        )

                      return (

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
                              {asignados}
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
                    }
                  )

                ) : (

                  <div className="dashboard-sin-eventos">

                    <p>
                      No hay eventos
                      registrados.
                    </p>

                    <button
                      onClick={() =>
                        cambiarSeccion(
                          'eventos'
                        )
                      }
                    >
                      Crear evento
                    </button>

                  </div>

                )}

              </div>

            </div>

            {/* ==================
                RESUMEN
            ================== */}

            <div className="dashboard-resumen">

              <div>

                <h2>
                  Resumen general
                </h2>

                <p>
                  Información actual del
                  sistema MesereArte.
                </p>

              </div>

              <div className="dashboard-resumen-grid">

                <div>

                  <span>
                    Meseros por sala
                  </span>

                  <strong>
                    {totalSalas > 0
                      ? (
                          totalMeseros /
                          totalSalas
                        ).toFixed(1)
                      : '0'}
                  </strong>

                </div>

                <div>

                  <span>
                    Eventos con personal
                  </span>

                  <strong>
                    {eventosConPersonal}
                    {' / '}
                    {totalEventos}
                  </strong>

                </div>

                <div>

                  <span>
                    Asignaciones
                  </span>

                  <strong>
                    {asignaciones.length}
                  </strong>

                </div>

              </div>

            </div>

          </div>

        )}

      </main>

    </div>
  )
}

export default AdminDashboard