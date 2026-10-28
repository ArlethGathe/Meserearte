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
     DISPONIBILIDAD
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
     PERSONAL DE LA SALA
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
     SELECCIONAR / QUITAR MESERO
  ======================================== */

  const seleccionarMesero = (
    meseroId
  ) => {
    setMensaje('')
    setError('')

    const yaSeleccionado =
      meserosSeleccionados.includes(
        meseroId
      )

    /*
      Si ya está seleccionado,
      el administrador sí puede quitarlo.
    */

    if (yaSeleccionado) {
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

    /*
      Si no estaba asignado,
      simplemente lo agregamos.
      Su disponibilidad comenzará
      como Pendiente al guardar.
    */

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

      /*
        No permitimos guardar como capitán
        a alguien que indicó No disponible.
      */

      if (capitan) {
        const disponibilidadCapitan =
          obtenerDisponibilidad(
            eventoActual.id,
            Number(capitan)
          )

        if (
          disponibilidadCapitan ===
          'No disponible'
        ) {
          setError(
            'El mesero seleccionado como capitán indicó que no está disponible.'
          )
          return
        }
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
          'Asignación actualizada correctamente.'
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

  const confirmados =
    eventoActual
      ? meserosSeleccionados.filter(
          (meseroId) =>
            obtenerDisponibilidad(
              eventoActual.id,
              meseroId
            ) === 'Confirmado'
        ).length
      : 0

  const pendientes =
    eventoActual
      ? meserosSeleccionados.filter(
          (meseroId) =>
            obtenerDisponibilidad(
              eventoActual.id,
              meseroId
            ) === 'Pendiente'
        ).length
      : 0

  const noDisponibles =
    eventoActual
      ? meserosSeleccionados.filter(
          (meseroId) =>
            obtenerDisponibilidad(
              eventoActual.id,
              meseroId
            ) ===
            'No disponible'
        ).length
      : 0

  const obtenerRolMesero = (
    meseroId
  ) => {
    if (
      !meserosSeleccionados.includes(
        meseroId
      )
    ) {
      return 'Sin asignar'
    }

    if (
      Number(capitan) === meseroId
    ) {
      return 'Capitán'
    }

    return 'Mesero'
  }

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
            Asigna al personal del evento
            y consulta el estado de
            confirmación de cada mesero.
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

      {/* SELECCIÓN DE EVENTO */}

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

          {/* DATOS DEL EVENTO */}

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

          {/* CONTADORES */}

          <section className="resumen-confirmaciones">

            <div className="confirmacion-card confirmados">

              <span>
                Confirmados
              </span>

              <strong>
                {confirmados}
              </strong>

            </div>

            <div className="confirmacion-card pendientes">

              <span>
                Pendientes
              </span>

              <strong>
                {pendientes}
              </strong>

            </div>

            <div className="confirmacion-card no-disponibles">

              <span>
                No disponibles
              </span>

              <strong>
                {noDisponibles}
              </strong>

            </div>

          </section>

          {/* TABLA */}

          <section className="personal-disponible">

            <div className="personal-titulo">

              <div>

                <h2>
                  Personal de la sala
                </h2>

                <p>
                  Los cambios se aplicarán
                  cuando presiones
                  Guardar asignación.
                </p>

              </div>

              <span>
                {
                  meserosDeLaSala.length
                }{' '}
                meseros activos
              </span>

            </div>

            <div className="tabla-responsive">

              <table className="tabla-asignaciones">

                <thead>

                  <tr>
                    <th>
                      Asignado
                    </th>

                    <th>
                      Mesero
                    </th>

                    <th>
                      Rol
                    </th>

                    <th>
                      Disponibilidad
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

                      const rol =
                        obtenerRolMesero(
                          mesero.id
                        )

                      const disponibilidad =
                        seleccionado
                          ? obtenerDisponibilidad(
                              eventoActual.id,
                              mesero.id
                            )
                          : 'Sin asignar'

                      return (

                        <tr
                          key={mesero.id}
                          className={
                            disponibilidad ===
                            'No disponible'
                              ? 'fila-no-disponible'
                              : ''
                          }
                        >

                          <td>

                            <input
                              type="checkbox"
                              className="check-mesero"
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
                                {
                                  mesero.correo
                                }
                              </span>

                            </div>

                          </td>

                          <td>

                            <span
                              className={`rol-tabla ${
                                rol === 'Capitán'
                                  ? 'capitan'
                                  : rol === 'Mesero'
                                    ? 'mesero'
                                    : 'sin-rol'
                              }`}
                            >
                              {rol}
                            </span>

                          </td>

                          <td>

                            <span
                              className={`estado-respuesta ${disponibilidad
                                .toLowerCase()
                                .replaceAll(
                                  ' ',
                                  '-'
                                )}`}
                            >
                              {
                                disponibilidad
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
                Capitán del evento
              </h2>

              <p>
                Debe ser un mesero que
                permanezca asignado al
                evento.
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

                    const seleccionado =
                      meserosSeleccionados.includes(
                        mesero.id
                      )

                    if (!seleccionado) {
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

          {/* GUARDAR */}

          <div className="resumen-asignacion">

            <div>

              <h3>
                Resumen
              </h3>

              <p>
                Asignados:{' '}

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
                  {confirmados}
                </strong>
              </p>

              {noDisponibles > 0 && (

                <p className="advertencia-no-disponibles">

                  Hay{' '}
                  <strong>
                    {noDisponibles}
                  </strong>{' '}
                  mesero(s) que indicaron
                  que no pueden asistir.

                </p>

              )}

            </div>

            <button
              className="guardar-asignacion"
              disabled={
                guardando
              }
              onClick={
                guardarAsignacion
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