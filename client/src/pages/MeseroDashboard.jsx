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
    salas,
    disponibilidades,
    actualizarDisponibilidadAPI
  } = useMesereArte()

  const [seccion, setSeccion] =
    useState('inicio')

  const [
    procesandoEvento,
    setProcesandoEvento
  ] = useState(null)

  const [mensaje, setMensaje] =
    useState('')

  const [error, setError] =
    useState('')

  /* ========================================
     MESERO ACTUAL
  ======================================== */

  const meseroActual =
    meseros.find(
      (mesero) =>
        mesero.correo
          .toLowerCase() ===
        usuario.correo
          .toLowerCase()
    )

  /* ========================================
     SALA
  ======================================== */

  const salaActual =
    salas.find(
      (sala) =>
        sala.id === usuario.salaId
    )

  /* ========================================
     ASIGNACIONES DEL MESERO
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
      })
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
          estado === 'Confirmado'
        ) {
          setMensaje(
            'Asistencia confirmada correctamente.'
          )
        }

        if (
          estado === 'No disponible'
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

  const eventosComoCapitan =
    eventosAsignados.filter(
      (evento) =>
        evento.rolEvento ===
        'Capitán'
    ).length

  return (
    <div className="mesero-layout">

      {/* ===================================
          SIDEBAR
      =================================== */}

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
              seccion ===
              'disponibilidad'
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
              seccion ===
              'notificaciones'
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
              setSeccion(
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

        {/* MENSAJE */}

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

        {/* ERROR */}

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
                  Hola, {usuario.nombre}
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
                  Eventos en los que participas.
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
                  {eventosComoCapitan}
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
                    Mis eventos
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
                            {evento.nombre}
                          </h3>

                          <p>
                            {formatearFecha(
                              evento.fecha
                            )}
                            {' · '}
                            {evento.horario}
                          </p>

                          <small>
                            {evento.ubicacion}
                          </small>

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

        {/* =================================
            MIS EVENTOS
        ================================= */}

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
                        key={evento.id}
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
                            {evento.nombre}
                          </h2>

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

                          {evento.fechaRespuesta && (

                            <small>
                              Respuesta registrada
                              el{' '}
                              {formatearFecha(
                                evento.fechaRespuesta
                              )}
                            </small>

                          )}

                        </div>

                        <div className="disponibilidad-acciones">

                          {/* PENDIENTE */}

                          {estado === 'Pendiente' && (
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

                          {/* CONFIRMADO */}

                          {estado === 'Confirmado' && (

                            <button
                              type="button"
                              className="confirmar-asistencia estado-actual"
                              disabled
                            >
                              ✓ Asistencia confirmada
                            </button>

                          )}

                          {/* NO DISPONIBLE */}

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

                  No tienes eventos asignados.

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

          <div className="mesero-pagina">

            <div className="mesero-titulo">

              <h1>
                Notificaciones
              </h1>

              <p>
                Avisos relacionados con
                tus eventos y tu equipo.
              </p>

            </div>

            <div className="mesero-vacio">

              No tienes notificaciones
              nuevas.

            </div>

          </div>

        )}

        {/* =================================
            PERFIL
        ================================= */}

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
                  Teléfono
                </span>

                <strong>
                  {meseroActual?.telefono ||
                    'Sin registrar'}
                </strong>

              </div>

              <div>

                <span>
                  Rol de cuenta
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

              <div>

                <span>
                  Eventos asignados
                </span>

                <strong>
                  {
                    eventosAsignados.length
                  }
                </strong>

              </div>

              <div>

                <span>
                  Eventos como capitán
                </span>

                <strong>
                  {eventosComoCapitan}
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