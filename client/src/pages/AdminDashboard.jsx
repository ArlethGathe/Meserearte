import { useState } from 'react'
import './AdminDashboard.css'
import AdminEventos from './AdminEventos'
import AdminSalas from './AdminSalas'
import AdminUsuarios from './AdminUsuarios'
import AdminAsignaciones from './AdminAsignaciones'
import AdminNotificaciones from './AdminNotificaciones'
import AdminReportes from './AdminReportes'


function AdminDashboard({ onLogout }) {
  const [seccion, setSeccion] = useState('inicio')

  return (
    <div className="admin-layout">

      <aside className="sidebar">

        <div>
          <h2 className="sidebar-logo">MesereArte</h2>
          <p className="sidebar-subtitulo">Gestión de eventos</p>
        </div>

        <nav className="sidebar-menu">

          <button
            className={seccion === 'inicio' ? 'menu-activo' : ''}
            onClick={() => setSeccion('inicio')}
          >
            Inicio
          </button>

          <button
            className={seccion === 'salas' ? 'menu-activo' : ''}
            onClick={() => setSeccion('salas')}
          >
            Salas
          </button>

          <button
            className={seccion === 'usuarios' ? 'menu-activo' : ''}
            onClick={() => setSeccion('usuarios')}
          >
            Usuarios
          </button>

          <button
            className={seccion === 'eventos' ? 'menu-activo' : ''}
            onClick={() => setSeccion('eventos')}
          >
            Eventos
          </button>

          <button
            className={seccion === 'asignaciones' ? 'menu-activo' : ''}
            onClick={() => setSeccion('asignaciones')}
          >
            Asignaciones
          </button>

          <button
            className={seccion === 'notificaciones' ? 'menu-activo' : ''}
            onClick={() => setSeccion('notificaciones')}
          >
            Notificaciones
          </button>

          <button
            className={seccion === 'reportes' ? 'menu-activo' : ''}
            onClick={() => setSeccion('reportes')}
          >
            Reportes e historiales
          </button>

        </nav>

        <button
          className="cerrar-sesion"
          onClick={onLogout}
        >
          Cerrar sesión
        </button>

      </aside>

      <main className="admin-contenido">

        {seccion === 'salas' ? (
           <AdminSalas />
         ) : seccion === 'usuarios' ? (
           <AdminUsuarios />
         ) : seccion === 'eventos' ? (
           <AdminEventos />
         ) : seccion === 'asignaciones' ? (
           <AdminAsignaciones /> 
         ) : seccion === 'notificaciones' ? (
           <AdminNotificaciones />
         ) : seccion === 'reportes' ? (
           <AdminReportes />
         ) : (
          <>
            <header className="admin-header">

              <div>
                <h1>Panel principal</h1>
                <p>Resumen general de la organización.</p>
              </div>

              <div className="usuario-admin">
                Administrador: Arleth Gathe
              </div>

            </header>

            <section className="tarjetas-resumen">

              <div className="tarjeta">
                <span>Eventos próximos</span>
                <strong>12</strong>
              </div>

              <div className="tarjeta">
                <span>Meseros activos</span>
                <strong>24</strong>
              </div>

              <div className="tarjeta">
                <span>Asignaciones pendientes</span>
                <strong>6</strong>
              </div>

              <div className="tarjeta">
                <span>Notificaciones</span>
                <strong>9</strong>
              </div>

            </section>

            <section className="admin-grid">

              <div className="panel-eventos">

                <h2>Próximos eventos</h2>

                <div className="evento-card">

                  <div>
                    <h3>Boda Hernández & Ruiz</h3>
                    <p>
                      14/06/2026 · 18:00 · Jardín Los Encinos
                    </p>
                  </div>

                  <span className="estado programado">
                    Programado
                  </span>

                </div>

                <div className="evento-card">

                  <div>
                    <h3>Evento Corporativo ABC</h3>
                    <p>
                      21/06/2026 · 15:00 · Salón Imperial
                    </p>
                  </div>

                  <span className="estado pendiente">
                    Pendiente
                  </span>

                </div>

                <div className="evento-card">

                  <div>
                    <h3>Graduación ESCOM</h3>
                    <p>
                      28/06/2026 · 17:00 · Centro de Convenciones
                    </p>
                  </div>

                  <span className="estado confirmado">
                    Confirmado
                  </span>

                </div>

              </div>

              <div className="panel-resumen">

                <h2>Resumen</h2>

                <div className="resumen-item">
                  <span className="circulo confirmado"></span>
                  Confirmados
                </div>

                <div className="resumen-item">
                  <span className="circulo pendiente"></span>
                  Pendientes
                </div>

                <div className="resumen-item">
                  <span className="circulo cancelado"></span>
                  Cancelados
                </div>

              </div>

            </section>
          </>
        )}

      </main>

    </div>
  )
}

export default AdminDashboard