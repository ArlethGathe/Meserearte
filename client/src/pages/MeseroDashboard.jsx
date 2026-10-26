import { useState } from 'react'
import './MeseroDashboard.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

function MeseroDashboard({
  usuario,
  onLogout
}) {
  const {
    meseros,
    eventos,
    asignaciones,
    salas
  } = useMesereArte()

  const [seccion, setSeccion] =
    useState('inicio')

  const meseroActual =
    meseros.find(
      (mesero) =>
        mesero.correo.toLowerCase() ===
        usuario.correo.toLowerCase()
    )

  const salaActual =
    salas.find(
      (sala) =>
        sala.id === usuario.salaId
    )

  const asignacionesMesero =
    meseroActual
      ? asignaciones.filter(
          (asignacion) =>
            asignacion.meseroId ===
            meseroActual.id
        )
      : []

  const eventosAsignados =
    asignacionesMesero
      .map((asignacion) => {
        const evento =
          eventos.find(
            (evento) =>
              evento.id ===
              asignacion.eventoId
          )

        if (!evento) {
          return null
        }

        return {
          ...evento,
          rolEvento:
            asignacion.rol
        }
      })
      .filter(Boolean)

  const formatearFecha = (fecha) => {
    if (!fecha) return ''

    const [
      anio,
      mes,
      dia
    ] = fecha.split('-')

    return `${dia}/${mes}/${anio}`
  }

  return (
    <div className="mesero-layout">

      <aside className="mesero-sidebar">

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
              setSeccion('inicio')
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
              setSeccion('eventos')
            }
          >
            Mis eventos
          </button>

          <button
            className={
              seccion === 'disponibilidad'
                ? 'activo'
                : ''
            }
            onClick={() =>
              setSeccion(
                'disponibilidad'
              )
            }
          >
            Disponibilidad
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
              seccion === 'perfil'
                ? 'activo'
                : ''
            }
            onClick={() =>
              setSeccion('perfil')
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

      <main className="mesero-main">

        {seccion === 'inicio' && (

          <div className="mesero-pagina">

            <div className="mesero-bienvenida">

              <div>

                <p className="mesero-etiqueta">
                  PANEL DE MESERO
                </p>

                <h1>
                  Hola, {usuario.nombre}
                </h1>

                <p>
                  Consulta tus eventos,
                  asignaciones y estado
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
                  Disponibilidad
                </span>

                <strong className="texto-estado">
                  {meseroActual
                    ? meseroActual.disponibilidad
                    : 'Sin registrar'}
                </strong>

                <p>
                  Estado actual.
                </p>

              </div>

              <div className="mesero-card">

                <span>
                  Como capitán
                </span>

                <strong>
                  {
                    eventosAsignados.filter(
                      (evento) =>
                        evento.rolEvento ===
                        'Capitán'
                    ).length
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
                    Mis próximos eventos
                  </h2>

                  <p>
                    Eventos que tienes
                    asignados actualmente.
                  </p>

                </div>

                <button
                  onClick={() =>
                    setSeccion('eventos')
                  }
                >
                  Ver todos
                </button>

              </div>

              <div className="mesero-eventos">

                {eventosAsignados.length >
                0 ? (

                  eventosAsignados
                    .slice(0, 3)
                    .map(
                      (evento) => (

                        <div
                          className="mesero-evento"
                          key={evento.id}
                        >

                          <div>

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

                            <h3>
                              {evento.nombre}
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
                              {
                                evento.ubicacion
                              }
                            </small>

                          </div>

                        </div>

                      )
                    )

                ) : (

                  <div className="mesero-vacio">

                    No tienes eventos
                    asignados actualmente.

                  </div>

                )}

              </div>

            </section>

          </div>

        )}

        {seccion === 'eventos' && (

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
                      key={evento.id}
                    >

                      <div className="mesero-evento-superior">

                        <div>

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

                          <h2>
                            {evento.nombre}
                          </h2>

                        </div>

                        <span className="evento-estado-mesero">
                          {evento.estado}
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
                            {evento.horario}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Ubicación
                          </span>

                          <strong>
                            {evento.ubicacion}
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
                  No tienes eventos asignados.
                </div>

              )}

            </div>

          </div>

        )}

        {seccion ===
          'disponibilidad' && (

          <div className="mesero-pagina">

            <div className="mesero-titulo">

              <h1>
                Disponibilidad
              </h1>

              <p>
                Consulta tu estado actual
                de disponibilidad.
              </p>

            </div>

            <div className="mesero-panel-simple">

              <span>
                Estado actual
              </span>

              <h2>
                {meseroActual
                  ? meseroActual.disponibilidad
                  : 'Sin registrar'}
              </h2>

              <p>
                Más adelante podrás indicar
                disponibilidad específica
                para cada evento.
              </p>

            </div>

          </div>

        )}

        {seccion ===
          'notificaciones' && (

          <div className="mesero-pagina">

            <div className="mesero-titulo">

              <h1>
                Notificaciones
              </h1>

              <p>
                Avisos relacionados con tus
                eventos y tu equipo.
              </p>

            </div>

            <div className="mesero-vacio">

              No tienes notificaciones
              nuevas.

            </div>

          </div>

        )}

        {seccion === 'perfil' && (

          <div className="mesero-pagina">

            <div className="mesero-titulo">

              <h1>
                Mi perfil
              </h1>

              <p>
                Información de tu cuenta
                en MesereArte.
              </p>

            </div>

            <div className="mesero-perfil">

              <div>
                <span>
                  Nombre
                </span>

                <strong>
                  {usuario.nombre}{' '}
                  {usuario.apellidos}
                </strong>
              </div>

              <div>
                <span>
                  Correo
                </span>

                <strong>
                  {usuario.correo}
                </strong>
              </div>

              <div>
                <span>
                  Rol
                </span>

                <strong>
                  {usuario.rol}
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
                  Estado
                </span>

                <strong>
                  {usuario.estado}
                </strong>
              </div>

            </div>

          </div>

        )}

      </main>

    </div>
  )
}

export default MeseroDashboard