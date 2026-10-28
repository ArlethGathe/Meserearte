import { useState } from 'react'
import './AdminAsignaciones.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

function AdminAsignaciones() {
  const {
    salas,
    eventos,
    meseros,
    asignaciones,
    disponibilidades,
    guardarAsignacionesAPI
  } = useMesereArte()

  const [
    eventoSeleccionado,
    setEventoSeleccionado
  ] = useState('')

  const [
    meserosSeleccionados,
    setMeserosSeleccionados
  ] = useState([])

  const [capitan, setCapitan] =
    useState('')

  const [mensaje, setMensaje] =
    useState('')

  const [error, setError] =
    useState('')

  const [guardando, setGuardando] =
    useState(false)

  /* ========================================
     EVENTO ACTUAL
  ======================================== */

  const eventoActual =
    eventos.find(
      (evento) =>
        evento.id ===
        Number(eventoSeleccionado)
    )

  /* ========================================
     SALA
  ======================================== */

  const obtenerNombreSala = (
    salaId
  ) => {
    const sala =
      salas.find(
        (sala) =>
          sala.id ===
          Number(salaId)
      )

    return sala
      ? sala.nombre
      : 'Sin sala'
  }

  /* ========================================
     DISPONIBILIDAD POR EVENTO
  ======================================== */

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

  /* ========================================
     MESEROS DE LA SALA
  ======================================== */

  const meserosDeLaSala =
    eventoActual
      ? meseros.filter(
          (mesero) =>
            mesero.salaId ===
              eventoActual.salaId &&
            mesero.estado ===
              'Activo'
        )
      : []

  /* ========================================
     CAMBIAR EVENTO
  ======================================== */

  const cambiarEvento = (e) => {
    const eventoId =
      Number(e.target.value)

    setEventoSeleccionado(
      e.target.value
    )

    setMensaje('')
    setError('')

    if (!eventoId) {
      setMeserosSeleccionados([])
      setCapitan('')
      return
    }

    const actuales =
      asignaciones.filter(
        (asignacion) =>
          asignacion.eventoId ===
          eventoId
      )

    setMeserosSeleccionados(
      actuales.map(
        (asignacion) =>
          asignacion.meseroId
      )
    )

    const capitanActual =
      actuales.find(
        (asignacion) =>
          asignacion.rol ===
          'Capitán'
      )

    setCapitan(
      capitanActual
        ? String(
            capitanActual.meseroId
          )
        : ''
    )
  }

  /* ========================================
     SELECCIONAR MESERO
  ======================================== */

  const seleccionarMesero = (
    meseroId
  ) => {
    const seleccionado =
      meserosSeleccionados.includes(
        meseroId
      )

    if (seleccionado) {
      setMeserosSeleccionados(
        meserosSeleccionados.filter(
          (id) =>
            id !== meseroId
        )
      )

      if (
        Number(capitan) ===
        meseroId
      ) {
        setCapitan('')
      }

      return
    }

    const estado =
      obtenerDisponibilidad(
        eventoActual.id,
        meseroId
      )

    if (
      estado === 'No disponible'
    ) {
      setError(
        'Este mesero indicó que no está disponible para el evento.'
      )

      return
    }

    setMeserosSeleccionados([
      ...meserosSeleccionados,
      meseroId
    ])
  }

  /* ========================================
     GUARDAR
  ======================================== */

  const guardarAsignacion =
    async () => {
      if (!eventoActual) {
        setError(
          'Selecciona un evento.'
        )

        return
      }

      if (
        meserosSeleccionados.length ===
        0
      ) {
        setError(
          'Selecciona al menos un mesero.'
        )

        return
      }

      if (
        capitan &&
        !meserosSeleccionados.includes(
          Number(capitan)
        )
      ) {
        setError(
          'El capitán debe pertenecer a los meseros asignados.'
        )

        return
      }

      try {
        setGuardando(true)
        setMensaje('')
        setError('')

        await guardarAsignacionesAPI(
          eventoActual.id,
          meserosSeleccionados,
          capitan
        )

        setMensaje(
          'Asignación guardada correctamente.'
        )

      } catch (error) {
        setError(
          error.message
        )
      } finally {
        setGuardando(false)
      }
    }

  /* ========================================
     CONTADORES
  ======================================== */

  const seleccionadosConfirmados =
    meserosSeleccionados.filter(
      (meseroId) =>
        obtenerDisponibilidad(
          eventoActual?.id,
          meseroId
        ) === 'Confirmado'
    ).length

  const seleccionadosPendientes =
    meserosSeleccionados.filter(
      (meseroId) =>
        obtenerDisponibilidad(
          eventoActual?.id,
          meseroId
        ) === 'Pendiente'
    ).length

  const seleccionadosNoDisponibles =
    meserosSeleccionados.filter(
      (meseroId) =>
        obtenerDisponibilidad(
          eventoActual?.id,
          meseroId
        ) === 'No disponible'
    ).length

  /* ========================================
     COMPONENTE
  ======================================== */

  return (
    <div className="asignaciones-pagina">

      <div className="asignaciones-encabezado">

        <div>

          <h1>
            Asignación de meseros
          </h1>

          <p>
            Asigna personal, consulta
            sus confirmaciones y designa
            al capitán del evento.
          </p>

        </div>

      </div>

      {/* MENSAJES */}

      {mensaje && (

        <div className="asignacion-mensaje correcto">

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

        <div className="asignacion-mensaje error">

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

      {/* SELECCIÓN EVENTO */}

      <section className="seleccion-evento">

        <label>
          Selecciona un evento
        </label>

        <select
          value={
            eventoSeleccionado
          }
          onChange={
            cambiarEvento
          }
        >

          <option value="">
            Selecciona un evento
          </option>

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

          {/* RESUMEN EVENTO */}

          <section className="resumen-evento-asignacion">

            <div>

              <span>
                Evento
              </span>

              <strong>
                {eventoActual.nombre}
              </strong>

            </div>

            <div>

              <span>
                Sala
              </span>

              <strong>
                {obtenerNombreSala(
                  eventoActual.salaId
                )}
              </strong>

            </div>

            <div>

              <span>
                Fecha
              </span>

              <strong>
                {eventoActual.fecha}
              </strong>

            </div>

            <div>

              <span>
                Horario
              </span>

              <strong>
                {eventoActual.horario}
              </strong>

            </div>

            <div>

              <span>
                Requeridos
              </span>

              <strong>
                {
                  eventoActual
                    .meserosRequeridos
                }
              </strong>

            </div>

            <div>

              <span>
                Asignados
              </span>

              <strong>
                {
                  meserosSeleccionados.length
                }
              </strong>

            </div>

          </section>

          {/* ESTADO DE CONFIRMACIONES */}

          <section className="resumen-confirmaciones">

            <div className="confirmacion-card confirmados">

              <span>
                Confirmados
              </span>

              <strong>
                {
                  seleccionadosConfirmados
                }
              </strong>

            </div>

            <div className="confirmacion-card pendientes">

              <span>
                Pendientes
              </span>

              <strong>
                {
                  seleccionadosPendientes
                }
              </strong>

            </div>

            <div className="confirmacion-card no-disponibles">

              <span>
                No disponibles
              </span>

              <strong>
                {
                  seleccionadosNoDisponibles
                }
              </strong>

            </div>

          </section>

          {/* PERSONAL */}

          <section className="personal-disponible">

            <div className="personal-titulo">

              <div>

                <h2>
                  Personal de la sala
                </h2>

                <p>
                  Consulta el estado de
                  respuesta de cada mesero.
                </p>

              </div>

              <span>
                {
                  meserosDeLaSala.length
                }{' '}
                meseros
              </span>

            </div>

            <div className="tabla-responsive">

              <table className="tabla-asignaciones">

                <thead>

                  <tr>

                    <th>
                      Asignar
                    </th>

                    <th>
                      Mesero
                    </th>

                    <th>
                      Rol
                    </th>

                    <th>
                      Respuesta
                    </th>

                    <th>
                      Estado
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {meserosDeLaSala.map(
                    (mesero) => {

                      const seleccionado =
                        meserosSeleccionados.includes(
                          mesero.id
                        )

                      const estadoDisponibilidad =
                        seleccionado
                          ? obtenerDisponibilidad(
                              eventoActual.id,
                              mesero.id
                            )
                          : 'Sin asignar'

                      const esCapitan =
                        seleccionado &&
                        Number(capitan) ===
                          mesero.id

                      return (

                        <tr
                          key={
                            mesero.id
                          }
                        >

                          <td>

                            <input
                              className="check-mesero"
                              type="checkbox"
                              checked={
                                seleccionado
                              }
                              onChange={() =>
                                seleccionarMesero(
                                  mesero.id
                                )
                              }
                            />

                          </td>

                          <td>

                            <div className="datos-mesero-asignacion">

                              <strong>
                                {mesero.nombre}{' '}
                                {mesero.apellidos}
                              </strong>

                              <span>
                                {mesero.correo}
                              </span>

                            </div>

                          </td>

                          <td>

                            {esCapitan ? (

                              <span className="rol-tabla capitan">
                                Capitán
                              </span>

                            ) : seleccionado ? (

                              <span className="rol-tabla mesero">
                                Mesero
                              </span>

                            ) : (

                              <span className="rol-tabla sin-rol">
                                —
                              </span>

                            )}

                          </td>

                          <td>

                            <span
                              className={`estado-respuesta ${estadoDisponibilidad
                                .toLowerCase()
                                .replaceAll(
                                  ' ',
                                  '-'
                                )}`}
                            >
                              {
                                estadoDisponibilidad
                              }
                            </span>

                          </td>

                          <td>

                            <span className="estado-activo">
                              {
                                mesero.estado
                              }
                            </span>

                          </td>

                        </tr>

                      )
                    }
                  )}

                </tbody>

              </table>

            </div>

          </section>

          {/* CAPITÁN */}

          <section className="capitan-seccion">

            <div>

              <h2>
                Capitán de meseros
              </h2>

              <p>
                El capitán debe ser uno
                de los meseros asignados
                al evento.
              </p>

            </div>

            <select
              value={capitan}
              onChange={(e) =>
                setCapitan(
                  e.target.value
                )
              }
            >

              <option value="">
                Sin capitán asignado
              </option>

              {meseros
                .filter(
                  (mesero) => {
                    if (
                      !meserosSeleccionados.includes(
                        mesero.id
                      )
                    ) {
                      return false
                    }

                    return (
                      obtenerDisponibilidad(
                        eventoActual.id,
                        mesero.id
                      ) !==
                      'No disponible'
                    )
                  }
                )
                .map(
                  (mesero) => (

                    <option
                      key={mesero.id}
                      value={mesero.id}
                    >
                      {mesero.nombre}{' '}
                      {mesero.apellidos}
                    </option>

                  )
                )}

            </select>

          </section>

          {/* PIE */}

          <div className="resumen-asignacion">

            <div>

              <h3>
                Resumen de asignación
              </h3>

              <p>
                Personal seleccionado:{' '}

                <strong>
                  {
                    meserosSeleccionados.length
                  }
                </strong>

                {' / '}

                {
                  eventoActual
                    .meserosRequeridos
                }
              </p>

              <p>
                Confirmados:{' '}

                <strong>
                  {
                    seleccionadosConfirmados
                  }
                </strong>
              </p>

            </div>

            <button
              className="guardar-asignacion"
              onClick={
                guardarAsignacion
              }
              disabled={
                guardando
              }
            >
              {guardando
                ? 'Guardando...'
                : 'Guardar asignación'}
            </button>

          </div>

        </>
      )}

    </div>
  )
}

export default AdminAsignaciones