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

  const [
    capitan,
    setCapitan
  ] = useState('')

  const [
    mensaje,
    setMensaje
  ] = useState('')

  const [
    error,
    setError
  ] = useState('')

  const [
    guardando,
    setGuardando
  ] = useState(false)

  const [
    cambiosGuardados,
    setCambiosGuardados
  ] = useState(false)

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
     FECHA
  ======================================== */

  const formatearFecha = (
    fecha
  ) => {
    if (!fecha) {
      return 'Sin fecha'
    }

    const fechaSimple =
      fecha.includes('T')
        ? fecha.split('T')[0]
        : fecha

    const [
      anio,
      mes,
      dia
    ] = fechaSimple.split('-')

    return `${dia}/${mes}/${anio}`
  }

  /* ========================================
     HORARIO
  ======================================== */

  const obtenerHorario = (
    evento
  ) => {
    if (!evento) {
      return 'Sin horario'
    }

    if (
      evento.horaInicio &&
      evento.horaFin
    ) {
      return `${evento.horaInicio} - ${evento.horaFin}`
    }

    if (evento.horario) {
      return evento.horario
    }

    return 'Sin horario'
  }

  /*
    Esta función también se utiliza
    para detectar traslapes.

    Si el evento tiene horaInicio y
    horaFin se utilizan directamente.

    Si es un evento anterior que
    solamente tiene "horario",
    extraemos las horas de ahí.
  */

  const extraerRango = (
    evento
  ) => {
    if (!evento) {
      return {
        inicio: null,
        fin: null
      }
    }

    if (
      evento.horaInicio &&
      evento.horaFin
    ) {
      return {
        inicio:
          evento.horaInicio,

        fin:
          evento.horaFin
      }
    }

    const horas =
      evento.horario?.match(
        /\d{1,2}:\d{2}/g
      ) || []

    return {
      inicio:
        horas[0] || null,

      fin:
        horas[1] || null
    }
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
     DETECTAR TRASLAPE
  ======================================== */

  const hayTraslape = (
    eventoA,
    eventoB
  ) => {
    if (
      !eventoA ||
      !eventoB
    ) {
      return false
    }

    if (
      eventoA.fecha !==
      eventoB.fecha
    ) {
      return false
    }

    const rangoA =
      extraerRango(
        eventoA
      )

    const rangoB =
      extraerRango(
        eventoB
      )

    if (
      !rangoA.inicio ||
      !rangoA.fin ||
      !rangoB.inicio ||
      !rangoB.fin
    ) {
      return false
    }

    /*
      Por ahora esta validación
      trabaja con eventos del mismo día.

      Los eventos nocturnos que cruzan
      medianoche los ajustaremos después
      directamente en backend.
    */

    return (
      rangoA.inicio <
        rangoB.fin &&
      rangoA.fin >
        rangoB.inicio
    )
  }

  /* ========================================
     CONFLICTO DE MESERO
  ======================================== */

  const obtenerConflicto = (
    meseroId
  ) => {
    if (!eventoActual) {
      return null
    }

    const otrasAsignaciones =
      asignaciones.filter(
        (asignacion) =>
          asignacion.meseroId ===
            meseroId &&
          asignacion.eventoId !==
            eventoActual.id
      )

    for (
      const asignacion of
      otrasAsignaciones
    ) {
      const otroEvento =
        eventos.find(
          (evento) =>
            evento.id ===
            asignacion.eventoId
        )

      if (
        otroEvento &&
        hayTraslape(
          eventoActual,
          otroEvento
        )
      ) {
        return otroEvento
      }
    }

    return null
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

  const cambiarEvento = (
    e
  ) => {
    const eventoId =
      Number(
        e.target.value
      )

    setEventoSeleccionado(
      e.target.value
    )

    setMensaje('')
    setError('')
    setCambiosGuardados(false)

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

    const conflicto =
      obtenerConflicto(
        meseroId
      )

    if (
      conflicto &&
      !seleccionado
    ) {
      setError(
        `Este mesero ya está asignado al evento "${conflicto.nombre}" en el horario ${obtenerHorario(conflicto)}.`
      )

      return
    }

    setMensaje('')
    setError('')
    setCambiosGuardados(false)

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

    setMeserosSeleccionados([
      ...meserosSeleccionados,
      meseroId
    ])
  }

  /* ========================================
     CAMBIAR CAPITÁN
  ======================================== */

  const cambiarCapitan = (
    e
  ) => {
    setCapitan(
      e.target.value
    )

    setMensaje('')
    setError('')
    setCambiosGuardados(false)
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

      for (
        const meseroId of
        meserosSeleccionados
      ) {
        const conflicto =
          obtenerConflicto(
            meseroId
          )

        if (conflicto) {
          const mesero =
            meseros.find(
              (item) =>
                item.id ===
                meseroId
            )

          setError(
            `${mesero?.nombre || 'El mesero'} ya está asignado al evento "${conflicto.nombre}" en el horario ${obtenerHorario(conflicto)}.`
          )

          return
        }
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
        setCambiosGuardados(false)

        setMensaje('')
        setError('')

        await guardarAsignacionesAPI(
          eventoActual.id,
          meserosSeleccionados,
          capitan
        )

        setCambiosGuardados(
          true
        )

        setMensaje(
          meserosSeleccionados.length ===
          0
            ? 'El evento quedó sin personal asignado.'
            : 'Los cambios fueron guardados correctamente.'
        )

      } catch (error) {
        setError(
          error.message
        )

        setCambiosGuardados(
          false
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
            ) ===
            'Confirmado'
        ).length
      : 0

  const pendientes =
    eventoActual
      ? meserosSeleccionados.filter(
          (meseroId) =>
            obtenerDisponibilidad(
              eventoActual.id,
              meseroId
            ) ===
            'Pendiente'
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

  /* ========================================
     ROL
  ======================================== */

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
      Number(capitan) ===
      meseroId
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

      {/* ENCABEZADO */}

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

          {mensaje}

        </div>

      )}

      {error && (

        <div className="asignacion-mensaje error">

          {error}

        </div>

      )}

      {/* SELECTOR */}

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
                key={
                  evento.id
                }
                value={
                  evento.id
                }
              >
                {
                  evento.nombre
                }
              </option>

            )
          )}

        </select>

      </section>

      {eventoActual && (
        <>

          {/* DATOS EVENTO */}

          <section className="resumen-evento-asignacion">

            <div>

              <span>
                Evento
              </span>

              <strong>
                {
                  eventoActual.nombre
                }
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
                {obtenerHorario(
                  eventoActual
                )}
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
                  meserosSeleccionados
                    .length
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

          {/* PERSONAL */}

          <section className="personal-disponible">

            <div className="personal-titulo">

              <div>

                <h2>
                  Personal de la sala
                </h2>

                <p>
                  Los meseros con otro
                  evento traslapado no
                  pueden seleccionarse.
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
                      Confirmación
                    </th>

                    <th>
                      Disponibilidad
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

                      const conflicto =
                        obtenerConflicto(
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
                          key={
                            mesero.id
                          }
                        >

                          <td>

                            <input
                              type="checkbox"
                              className="check-mesero"
                              checked={
                                seleccionado
                              }
                              disabled={
                                Boolean(
                                  conflicto
                                ) &&
                                !seleccionado
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
                                {
                                  mesero.nombre
                                }{' '}
                                {
                                  mesero.apellidos
                                }
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
                                rol ===
                                'Capitán'
                                  ? 'capitan'
                                  : rol ===
                                    'Mesero'
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

                            {conflicto ? (

                              <span className="mesero-traslape">

                                No disponible por
                                traslape con{' '}

                                <strong>
                                  {
                                    conflicto.nombre
                                  }
                                </strong>

                                {' · '}

                                {obtenerHorario(
                                  conflicto
                                )}

                              </span>

                            ) : (

                              <span className="mesero-disponible">

                                Disponible

                              </span>

                            )}

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
                El capitán debe formar
                parte del personal
                asignado.
              </p>

            </div>

            <select
              value={
                capitan
              }
              onChange={
                cambiarCapitan
              }
            >

              <option value="">
                Sin capitán asignado
              </option>

              {meserosDeLaSala
                .filter(
                  (mesero) => {
                    if (
                      !meserosSeleccionados.includes(
                        mesero.id
                      )
                    ) {
                      return false
                    }

                    if (
                      obtenerConflicto(
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
                      key={
                        mesero.id
                      }
                      value={
                        mesero.id
                      }
                    >
                      {
                        mesero.nombre
                      }{' '}
                      {
                        mesero.apellidos
                      }
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
                    meserosSeleccionados
                      .length
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
              type="button"
              className="guardar-asignacion"
              disabled={
                guardando ||
                cambiosGuardados
              }
              onClick={
                guardarAsignacion
              }
            >
              {guardando
                ? 'Guardando...'
                : cambiosGuardados
                  ? '✓ Cambios guardados'
                  : 'Guardar cambios'}
            </button>

          </div>

        </>
      )}

    </div>
  )
}

export default AdminAsignaciones