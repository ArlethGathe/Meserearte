import { useState } from 'react'
import './CapitanPanel.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

function CapitanPanel({
  mesero,
  eventos
}) {
  const {
    salas,
    meseros,
    asignaciones,
    disponibilidades
  } = useMesereArte()

  const [
    eventoSeleccionado,
    setEventoSeleccionado
  ] = useState(
    eventos.length > 0
      ? String(eventos[0].id)
      : ''
  )

  const eventoActual =
    eventos.find(
      (evento) =>
        evento.id ===
        Number(eventoSeleccionado)
    )

  const salaActual =
    eventoActual
      ? salas.find(
          (sala) =>
            sala.id ===
            eventoActual.salaId
        )
      : null

  const obtenerDisponibilidad = (
    eventoId,
    meseroId
  ) => {
    const registro =
      disponibilidades.find(
        (item) =>
          item.eventoId ===
            eventoId &&
          item.meseroId ===
            meseroId
      )

    return registro
      ? registro.estado
      : 'Pendiente'
  }

  const equipoEvento =
    eventoActual
      ? asignaciones
          .filter(
            (asignacion) =>
              asignacion.eventoId ===
              eventoActual.id
          )
          .map(
            (asignacion) => {
              const integrante =
                meseros.find(
                  (mesero) =>
                    mesero.id ===
                    asignacion.meseroId
                )

              if (!integrante) {
                return null
              }

              return {
                ...integrante,

                rolEvento:
                  asignacion.rol,

                disponibilidad:
                  obtenerDisponibilidad(
                    eventoActual.id,
                    integrante.id
                  )
              }
            }
          )
          .filter(Boolean)
          .sort((a, b) => {
            if (
              a.rolEvento ===
              'Capitán'
            ) {
              return -1
            }

            if (
              b.rolEvento ===
              'Capitán'
            ) {
              return 1
            }

            return a.nombre.localeCompare(
              b.nombre
            )
          })
      : []

  const confirmados =
    equipoEvento.filter(
      (integrante) =>
        integrante.disponibilidad ===
        'Confirmado'
    ).length

  const pendientes =
    equipoEvento.filter(
      (integrante) =>
        integrante.disponibilidad ===
        'Pendiente'
    ).length

  const noDisponibles =
    equipoEvento.filter(
      (integrante) =>
        integrante.disponibilidad ===
        'No disponible'
    ).length

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

  if (
    !eventos ||
    eventos.length === 0
  ) {
    return (
      <div className="capitan-panel">

        <div className="capitan-vacio">

          Actualmente no tienes
          eventos asignados como
          capitán.

        </div>

      </div>
    )
  }

  return (
    <div className="capitan-panel">

      {/* =================================
          ENCABEZADO
      ================================= */}

      <div className="capitan-encabezado">

        <div>

          <p className="capitan-etiqueta">
            FUNCIONES DE CAPITÁN
          </p>

          <h1>
            Gestión del equipo
          </h1>

          <p>
            Consulta al personal
            asignado y el estado de
            confirmación del equipo
            para los eventos donde
            eres capitán.
          </p>

        </div>

        <div className="capitan-identidad">

          <span>
            Capitán
          </span>

          <strong>
            {mesero?.nombre}{' '}
            {mesero?.apellidos}
          </strong>

        </div>

      </div>

      {/* =================================
          SELECCIÓN DE EVENTO
      ================================= */}

      <section className="capitan-selector">

        <label>
          Evento a gestionar
        </label>

        <select
          value={
            eventoSeleccionado
          }
          onChange={(e) =>
            setEventoSeleccionado(
              e.target.value
            )
          }
        >

          {eventos.map(
            (evento) => (

              <option
                key={evento.id}
                value={evento.id}
              >
                {evento.nombre}
              </option>

            )
          )}

        </select>

      </section>

      {eventoActual && (
        <>

          {/* =================================
              DATOS DEL EVENTO
          ================================= */}

          <section className="capitan-evento-card">

            <div className="capitan-evento-titulo">

              <div>

                <span>
                  EVENTO
                </span>

                <h2>
                  {
                    eventoActual.nombre
                  }
                </h2>

              </div>

              <span className="capitan-rol-badge">
                Capitán
              </span>

            </div>

            <div className="capitan-evento-datos">

              <div>

                <span>
                  Fecha
                </span>

                <strong>
                  {formatearFecha(
                    eventoActual.fecha
                  )}
                </strong>

              </div>

              <div>

                <span>
                  Horario
                </span>

                <strong>
                  {
                    eventoActual.horario
                  }
                </strong>

              </div>

              <div>

                <span>
                  Ubicación
                </span>

                <strong>
                  {
                    eventoActual.ubicacion
                  }
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
                  Uniforme
                </span>

                <strong>
                  {eventoActual.uniforme ||
                    'Sin especificar'}
                </strong>

              </div>

              <div>

                <span>
                  Personal requerido
                </span>

                <strong>
                  {
                    eventoActual
                      .meserosRequeridos
                  }
                </strong>

              </div>

            </div>

            {eventoActual.observaciones && (

              <div className="capitan-observaciones">

                <span>
                  Observaciones
                </span>

                <p>
                  {
                    eventoActual
                      .observaciones
                  }
                </p>

              </div>

            )}

          </section>

          {/* =================================
              RESUMEN
          ================================= */}

          <section className="capitan-resumen">

            <div>

              <span>
                Personal asignado
              </span>

              <strong>
                {
                  equipoEvento.length
                }
              </strong>

            </div>

            <div className="capitan-resumen-confirmado">

              <span>
                Confirmados
              </span>

              <strong>
                {confirmados}
              </strong>

            </div>

            <div className="capitan-resumen-pendiente">

              <span>
                Pendientes
              </span>

              <strong>
                {pendientes}
              </strong>

            </div>

            <div className="capitan-resumen-no-disponible">

              <span>
                No disponibles
              </span>

              <strong>
                {noDisponibles}
              </strong>

            </div>

          </section>

          {noDisponibles > 0 && (

            <div className="capitan-advertencia">

              <strong>
                Atención:
              </strong>{' '}

              hay{' '}
              {noDisponibles}{' '}
              integrante(s) que
              indicaron que no pueden
              asistir. El administrador
              deberá realizar el ajuste
              correspondiente.

            </div>

          )}

          {/* =================================
              EQUIPO
          ================================= */}

          <section className="capitan-equipo">

            <div className="capitan-equipo-header">

              <div>

                <h2>
                  Personal asignado
                </h2>

                <p>
                  Consulta quién forma
                  parte del equipo y si
                  ya confirmó su
                  asistencia.
                </p>

              </div>

              <span>
                {
                  equipoEvento.length
                }{' '}
                integrante(s)
              </span>

            </div>

            {equipoEvento.length > 0 ? (

              <div className="capitan-tabla-responsive">

                <table className="capitan-tabla">

                  <thead>

                    <tr>

                      <th>
                        Personal
                      </th>

                      <th>
                        Rol
                      </th>

                      <th>
                        Confirmación
                      </th>

                      <th>
                        Estado
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {equipoEvento.map(
                      (integrante) => (

                        <tr
                          key={
                            integrante.id
                          }
                        >

                          <td>

                            <div className="capitan-personal-datos">

                              <strong>
                                {
                                  integrante.nombre
                                }{' '}
                                {
                                  integrante.apellidos
                                }
                              </strong>

                              <span>
                                {
                                  integrante.correo
                                }
                              </span>

                            </div>

                          </td>

                          <td>

                            <span
                              className={
                                integrante.rolEvento ===
                                'Capitán'
                                  ? 'capitan-tabla-rol capitan'
                                  : 'capitan-tabla-rol mesero'
                              }
                            >
                              {
                                integrante.rolEvento
                              }
                            </span>

                          </td>

                          <td>

                            <span
                              className={`capitan-disponibilidad ${integrante.disponibilidad
                                .toLowerCase()
                                .replaceAll(
                                  ' ',
                                  '-'
                                )}`}
                            >
                              {
                                integrante.disponibilidad
                              }
                            </span>

                          </td>

                          <td>

                            <span className="capitan-estado-activo">
                              {
                                integrante.estado
                              }
                            </span>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            ) : (

              <div className="capitan-vacio">

                No hay personal
                asignado a este evento.

              </div>

            )}

          </section>

          {/* =================================
              SIGUIENTE FUNCIÓN
          ================================= */}

          <section className="capitan-proxima-funcion">

            <div>

              <h2>
                Control de asistencia
              </h2>

              <p>
                El registro de llegada
                y asistencia del personal
                se habilitará en este
                apartado para el día del
                evento.
              </p>

            </div>

            <span>
              Siguiente función
            </span>

          </section>

        </>
      )}

    </div>
  )
}

export default CapitanPanel