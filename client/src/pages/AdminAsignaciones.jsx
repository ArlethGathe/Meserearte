import {
  useEffect,
  useState
} from 'react'

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
    advertenciaCapitan,
    setAdvertenciaCapitan
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
        Number(
          eventoSeleccionado
        )
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
        horas[0] ||
        null,

      fin:
        horas[1] ||
        null
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
          Number(
            item.eventoId
          ) ===
            Number(
              eventoId
            ) &&
          Number(
            item.meseroId
          ) ===
            Number(
              meseroId
            )
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
          Number(
            asignacion.meseroId
          ) ===
            Number(
              meseroId
            ) &&
          Number(
            asignacion.eventoId
          ) !==
            Number(
              eventoActual.id
            )
      )

    for (
      const asignacion of
      otrasAsignaciones
    ) {
      const otroEvento =
        eventos.find(
          (evento) =>
            Number(
              evento.id
            ) ===
            Number(
              asignacion.eventoId
            )
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
            Number(
              mesero.salaId
            ) ===
              Number(
                eventoActual.salaId
              ) &&
            mesero.estado ===
              'Activo'
        )
      : []

  /* ========================================
     CAPITÁN GUARDADO
  ======================================== */

  const asignacionesEvento =
    eventoActual
      ? asignaciones.filter(
          (asignacion) =>
            Number(
              asignacion.eventoId
            ) ===
            Number(
              eventoActual.id
            )
        )
      : []

  const capitanGuardado =
    asignacionesEvento.find(
      (asignacion) =>
        asignacion.rol ===
        'Capitán'
    )

  /* ========================================
     CAPITÁN NO DISPONIBLE
  ======================================== */

  useEffect(
    () => {
      if (!eventoActual) {
        setAdvertenciaCapitan('')
        return
      }

      /*
        Puede existir personal pero temporalmente
        no haber capitán porque el anterior
        indicó "No disponible".
      */

      if (
        asignacionesEvento.length >
          0 &&
        !capitanGuardado
      ) {
        setAdvertenciaCapitan(
          'Este evento tiene personal asignado pero actualmente no cuenta con capitán. Debes seleccionar un nuevo capitán antes de guardar cambios.'
        )

        return
      }

      if (!capitanGuardado) {
        setAdvertenciaCapitan('')
        return
      }

      const disponibilidad =
        obtenerDisponibilidad(
          eventoActual.id,
          capitanGuardado.meseroId
        )

      if (
        disponibilidad ===
        'No disponible'
      ) {
        const datosCapitan =
          meseros.find(
            (item) =>
              Number(
                item.id
              ) ===
              Number(
                capitanGuardado.meseroId
              )
          )

        /*
          Si el capitán seleccionado en
          pantalla es el que se volvió
          no disponible, lo quitamos.
        */

        setCapitan(
          (capitanActual) =>
            Number(
              capitanActual
            ) ===
            Number(
              capitanGuardado.meseroId
            )
              ? ''
              : capitanActual
        )

        setCambiosGuardados(
          false
        )

        setAdvertenciaCapitan(
          `${datosCapitan?.nombre || 'El capitán'} ${datosCapitan?.apellidos || ''} indicó que no está disponible para este evento. Debes seleccionar otro mesero como capitán antes de guardar cambios.`
        )

        return
      }

      setAdvertenciaCapitan('')
    },
    [
      eventoSeleccionado,
      disponibilidades,
      asignaciones
    ]
  )

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
    setAdvertenciaCapitan('')
    setCambiosGuardados(false)

    if (!eventoId) {
      setMeserosSeleccionados([])
      setCapitan('')
      return
    }

    const actuales =
      asignaciones.filter(
        (asignacion) =>
          Number(
            asignacion.eventoId
          ) ===
          eventoId
      )

    setMeserosSeleccionados(
      actuales.map(
        (asignacion) =>
          Number(
            asignacion.meseroId
          )
      )
    )

    const capitanActual =
      actuales.find(
        (asignacion) =>
          asignacion.rol ===
          'Capitán'
      )

    if (!capitanActual) {
      setCapitan('')

      if (
        actuales.length >
        0
      ) {
        setAdvertenciaCapitan(
          'Este evento tiene personal asignado pero no cuenta con capitán. Selecciona uno antes de guardar cambios.'
        )
      }

      return
    }

    const disponibilidadCapitan =
      obtenerDisponibilidad(
        eventoId,
        capitanActual.meseroId
      )

    if (
      disponibilidadCapitan ===
      'No disponible'
    ) {
      const datosCapitan =
        meseros.find(
          (item) =>
            Number(
              item.id
            ) ===
            Number(
              capitanActual.meseroId
            )
        )

      setCapitan('')

      setAdvertenciaCapitan(
        `${datosCapitan?.nombre || 'El capitán'} ${datosCapitan?.apellidos || ''} indicó que no está disponible para este evento. Selecciona un nuevo capitán.`
      )

      return
    }

    setCapitan(
      String(
        capitanActual.meseroId
      )
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
      const nuevosSeleccionados =
        meserosSeleccionados.filter(
          (id) =>
            id !==
            meseroId
        )

      setMeserosSeleccionados(
        nuevosSeleccionados
      )

      if (
        Number(capitan) ===
        Number(meseroId)
      ) {
        setCapitan('')

        if (
          nuevosSeleccionados.length >
          0
        ) {
          setAdvertenciaCapitan(
            'Quitaste al capitán del personal asignado. Debes seleccionar un nuevo capitán antes de guardar.'
          )
        }
      }

      if (
        nuevosSeleccionados.length ===
        0
      ) {
        setAdvertenciaCapitan('')
      }

      return
    }

    setMeserosSeleccionados([
      ...meserosSeleccionados,
      meseroId
    ])

    /*
      Si se agrega el primer mesero,
      recordamos que también debe
      seleccionarse un capitán.
    */

    if (
      meserosSeleccionados.length ===
        0 &&
      !capitan
    ) {
      setAdvertenciaCapitan(
        'Si asignas personal al evento debes seleccionar obligatoriamente un capitán.'
      )
    }
  }

  /* ========================================
     CAMBIAR CAPITÁN
  ======================================== */

  const cambiarCapitan = (
    e
  ) => {
    const nuevoCapitan =
      e.target.value

    setMensaje('')
    setError('')
    setCambiosGuardados(false)

    if (!nuevoCapitan) {
      setCapitan('')

      if (
        meserosSeleccionados.length >
        0
      ) {
        setAdvertenciaCapitan(
          'El evento tiene personal asignado. Debes seleccionar un capitán antes de guardar.'
        )
      }

      return
    }

    const disponibilidad =
      obtenerDisponibilidad(
        eventoActual.id,
        Number(
          nuevoCapitan
        )
      )

    if (
      disponibilidad ===
      'No disponible'
    ) {
      setError(
        'Un mesero que indicó "No disponible" no puede ser capitán.'
      )

      return
    }

    setCapitan(
      nuevoCapitan
    )

    setAdvertenciaCapitan('')
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

      /*
        REGLA NUEVA:
        puede existir un evento sin personal,
        pero si tiene uno o más meseros,
        obligatoriamente debe existir capitán.
      */

      if (
        meserosSeleccionados.length >
          0 &&
        !capitan
      ) {
        setError(
          'Debes seleccionar un capitán antes de guardar el personal asignado.'
        )

        setAdvertenciaCapitan(
          'El evento no puede guardar personal asignado sin un capitán.'
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
          setCapitan('')

          setError(
            'El mesero seleccionado como capitán indicó que no está disponible. Selecciona otro capitán.'
          )

          setAdvertenciaCapitan(
            'El evento necesita un nuevo capitán antes de guardar cambios.'
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

        setAdvertenciaCapitan('')

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
      Number(meseroId)
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

      {advertenciaCapitan && (

        <div className="asignacion-mensaje error">

          <strong>
            Atención:
          </strong>{' '}

          {advertenciaCapitan}

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

                            ) : disponibilidad ===
                              'No disponible' ? (

                              <span className="mesero-traslape">

                                No disponible para
                                este evento

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
                Si existe personal asignado,
                el evento debe contar
                obligatoriamente con un capitán.
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
                Selecciona un capitán
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

              <p>
                Capitán:{' '}

                <strong>
                  {capitan
                    ? (
                        meseros.find(
                          (item) =>
                            Number(
                              item.id
                            ) ===
                            Number(
                              capitan
                            )
                        )
                          ?.nombre ||
                        'Asignado'
                      )
                    : 'Sin capitán'}
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