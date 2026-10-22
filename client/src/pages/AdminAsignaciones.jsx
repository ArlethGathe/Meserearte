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
    setAsignaciones
  } = useMesereArte()

  const [eventoSeleccionado, setEventoSeleccionado] = useState('')
  const [meserosSeleccionados, setMeserosSeleccionados] = useState([])
  const [capitan, setCapitan] = useState('')
  const [mensaje, setMensaje] = useState('')

  const eventoActual = eventos.find(
    (evento) =>
      evento.id === Number(eventoSeleccionado)
  )

  const obtenerNombreSala = (salaId) => {
    const sala = salas.find(
      (sala) => sala.id === Number(salaId)
    )

    return sala
      ? sala.nombre
      : 'Sin sala'
  }

  const meserosDisponibles = eventoActual
    ? meseros.filter(
        (mesero) =>
          mesero.salaId === eventoActual.salaId &&
          mesero.estado === 'Activo' &&
          mesero.disponibilidad === 'Disponible'
      )
    : []

  const cambiarEvento = (e) => {
    const eventoId = Number(e.target.value)

    setEventoSeleccionado(e.target.value)
    setMensaje('')

    if (!eventoId) {
      setMeserosSeleccionados([])
      setCapitan('')
      return
    }

    const asignacionesExistentes =
      asignaciones.filter(
        (asignacion) =>
          asignacion.eventoId === eventoId
      )

    setMeserosSeleccionados(
      asignacionesExistentes.map(
        (asignacion) =>
          asignacion.meseroId
      )
    )

    const capitanExistente =
      asignacionesExistentes.find(
        (asignacion) =>
          asignacion.rol === 'Capitán'
      )

    setCapitan(
      capitanExistente
        ? String(capitanExistente.meseroId)
        : ''
    )
  }

  const seleccionarMesero = (id) => {
    if (
      meserosSeleccionados.includes(id)
    ) {
      setMeserosSeleccionados(
        meserosSeleccionados.filter(
          (meseroId) =>
            meseroId !== id
        )
      )

      if (
        Number(capitan) === id
      ) {
        setCapitan('')
      }
    } else {
      setMeserosSeleccionados([
        ...meserosSeleccionados,
        id
      ])
    }
  }

  const guardarAsignacion = () => {
    if (!eventoActual) {
      setMensaje(
        'Selecciona un evento.'
      )

      return
    }

    if (
      meserosSeleccionados.length === 0
    ) {
      setMensaje(
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
      setMensaje(
        'El capitán debe ser uno de los meseros asignados.'
      )

      return
    }

    const asignacionesOtrosEventos =
      asignaciones.filter(
        (asignacion) =>
          asignacion.eventoId !==
          eventoActual.id
      )

    const nuevasAsignaciones =
      meserosSeleccionados.map(
        (meseroId, index) => ({
          id:
            Date.now() + index,

          eventoId:
            eventoActual.id,

          meseroId,

          rol:
            Number(capitan) ===
            meseroId
              ? 'Capitán'
              : 'Mesero'
        })
      )

    setAsignaciones([
      ...asignacionesOtrosEventos,
      ...nuevasAsignaciones
    ])

    setMensaje(
      `Asignación guardada correctamente: ${meserosSeleccionados.length} mesero(s) asignado(s) a ${eventoActual.nombre}.`
    )
  }

  const nombreCapitan = capitan
    ? meseros.find(
        (mesero) =>
          mesero.id === Number(capitan)
      )
    : null

  return (
    <div className="asignaciones-pagina">

      <div className="asignaciones-encabezado">

        <h1>
          Asignación de meseros
        </h1>

        <p>
          Consulta la disponibilidad y asigna
          personal a los eventos.
        </p>

      </div>

      {mensaje && (

        <div className="mensaje-asignacion">

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

      <section className="seleccion-evento">

        <label>
          Selecciona un evento
        </label>

        <select
          value={eventoSeleccionado}
          onChange={cambiarEvento}
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
                Meseros requeridos
              </span>

              <strong>
                {
                  eventoActual.meserosRequeridos
                }
              </strong>

            </div>

            <div>

              <span>
                Seleccionados
              </span>

              <strong
                className={
                  meserosSeleccionados.length >=
                  eventoActual.meserosRequeridos
                    ? 'cantidad-completa'
                    : 'cantidad-pendiente'
                }
              >
                {
                  meserosSeleccionados.length
                }
              </strong>

            </div>

          </section>

          <section className="personal-disponible">

            <div className="personal-titulo">

              <div>

                <h2>
                  Meseros disponibles
                </h2>

                <p>
                  Solo se muestran meseros
                  activos y disponibles de la
                  sala del evento.
                </p>

              </div>

              <span>
                {
                  meserosDisponibles.length
                }{' '}
                disponibles
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
                      Estado
                    </th>

                    <th>
                      Disponibilidad
                    </th>
                  </tr>

                </thead>

                <tbody>

                  {meserosDisponibles.length >
                  0 ? (

                    meserosDisponibles.map(
                      (mesero) => (

                        <tr
                          key={mesero.id}
                        >

                          <td>

                            <input
                              className="check-mesero"
                              type="checkbox"
                              checked={
                                meserosSeleccionados.includes(
                                  mesero.id
                                )
                              }
                              onChange={() =>
                                seleccionarMesero(
                                  mesero.id
                                )
                              }
                            />

                          </td>

                          <td>

                            <strong>
                              {mesero.nombre}{' '}
                              {mesero.apellidos}
                            </strong>

                          </td>

                          <td>

                            <span className="estado-activo">
                              {
                                mesero.estado
                              }
                            </span>

                          </td>

                          <td>

                            <span className="estado-disponible">
                              {
                                mesero.disponibilidad
                              }
                            </span>

                          </td>

                        </tr>

                      )
                    )

                  ) : (

                    <tr>

                      <td
                        colSpan="4"
                        style={{
                          textAlign: 'center',
                          padding: '25px'
                        }}
                      >
                        No hay meseros
                        disponibles para este
                        evento.
                      </td>

                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </section>

          <section className="capitan-seccion">

            <div>

              <h2>
                Capitán de meseros
              </h2>

              <p>
                El capitán debe ser uno de
                los meseros seleccionados
                para este evento.
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
                  (mesero) =>
                    meserosSeleccionados.includes(
                      mesero.id
                    )
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

          <div className="resumen-asignacion">

            <div>

              <h3>
                Resumen de asignación
              </h3>

              <p>
                Meseros seleccionados:{' '}

                <strong>
                  {
                    meserosSeleccionados.length
                  }
                </strong>

                {' / '}

                {
                  eventoActual.meserosRequeridos
                }
              </p>

              <p>
                Capitán:{' '}

                <strong>
                  {nombreCapitan
                    ? `${nombreCapitan.nombre} ${nombreCapitan.apellidos}`
                    : 'Sin asignar'}
                </strong>
              </p>

            </div>

            <button
              className="guardar-asignacion"
              onClick={
                guardarAsignacion
              }
            >
              Guardar asignación
            </button>

          </div>

        </>
      )}

    </div>
  )
}

export default AdminAsignaciones