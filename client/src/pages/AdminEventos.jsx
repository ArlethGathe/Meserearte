
import {
  useMemo,
  useState
} from 'react'

import './AdminEventos.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

const formularioVacio = {
  salaId: '',
  nombre: '',
  tipo: '',
  fecha: '',
  horaInicio: '',
  horaFin: '',
  lugar: '',
  ubicacion: '',
  invitados: '',
  meserosRequeridos: '',
  uniforme: '',
  observaciones: ''
}

function AdminEventos() {
  const {
    salas,
    eventos,
    asignaciones,
    crearEventoAPI,
    actualizarEventoAPI,
    eliminarEventoAPI
  } = useMesereArte()

  const [
    busqueda,
    setBusqueda
  ] = useState('')

  const [
    mostrarFormulario,
    setMostrarFormulario
  ] = useState(false)

  const [
    eventoDetalle,
    setEventoDetalle
  ] = useState(null)

  const [
    idEdicion,
    setIdEdicion
  ] = useState(null)

  const [
    formulario,
    setFormulario
  ] = useState(
    formularioVacio
  )

  const [
    guardando,
    setGuardando
  ] = useState(false)

  const [
    mensaje,
    setMensaje
  ] = useState('')

  const [
    error,
    setError
  ] = useState('')

  /* ========================================
     TIPOS DE EVENTO
  ======================================== */

  const tiposEvento = [
    'Boda',
    'XV años',
    'Bautizo',
    'Primera comunión',
    'Cumpleaños',
    'Graduación',
    'Aniversario',
    'Evento empresarial',
    'Evento escolar',
    'Otro'
  ]

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
     PERSONAL ASIGNADO
  ======================================== */

  const obtenerCantidadAsignados = (
    eventoId
  ) => {
    return asignaciones.filter(
      (asignacion) =>
        asignacion.eventoId ===
        eventoId
    ).length
  }

  /* ========================================
     FECHA
  ======================================== */

  const obtenerFechaSimple = (
    fecha
  ) => {
    if (!fecha) {
      return ''
    }

    return fecha.includes('T')
      ? fecha.split('T')[0]
      : fecha
  }

  const formatearFecha = (
    fecha
  ) => {
    if (!fecha) {
      return ''
    }

    const fechaSimple =
      obtenerFechaSimple(
        fecha
      )

    const [
      anio,
      mes,
      dia
    ] =
      fechaSimple.split('-')

    return `${dia}/${mes}/${anio}`
  }

  /* ========================================
     HORARIO
  ======================================== */

  const obtenerHorario = (
    evento
  ) => {
    if (
      evento.horaInicio &&
      evento.horaFin
    ) {
      return `${evento.horaInicio} - ${evento.horaFin}`
    }

    return (
      evento.horario ||
      'Sin horario'
    )
  }

  /*
    Compatibilidad con eventos anteriores
    que solamente tengan el campo horario.
  */

  const extraerHoras = (
    horario
  ) => {
    if (!horario) {
      return {
        horaInicio: '',
        horaFin: ''
      }
    }

    const coincidencias =
      horario.match(
        /\d{1,2}:\d{2}/g
      ) || []

    return {
      horaInicio:
        coincidencias[0] ||
        '',

      horaFin:
        coincidencias[1] ||
        ''
    }
  }

  /* ========================================
     FILTRAR EVENTOS
  ======================================== */

  const eventosFiltrados =
    useMemo(
      () => {
        const texto =
          busqueda
            .trim()
            .toLowerCase()

        if (!texto) {
          return eventos
        }

        return eventos.filter(
          (evento) => {
            const sala =
              obtenerNombreSala(
                evento.salaId
              ).toLowerCase()

            const nombre =
              evento.nombre
                ?.toLowerCase() ||
              ''

            const tipo =
              evento.tipo
                ?.toLowerCase() ||
              ''

            const lugar =
              evento.lugar
                ?.toLowerCase() ||
              ''

            const ubicacion =
              evento.ubicacion
                ?.toLowerCase() ||
              ''

            return (
              nombre.includes(
                texto
              ) ||
              tipo.includes(
                texto
              ) ||
              lugar.includes(
                texto
              ) ||
              ubicacion.includes(
                texto
              ) ||
              sala.includes(
                texto
              )
            )
          }
        )
      },
      [
        eventos,
        busqueda,
        salas
      ]
    )

  /* ========================================
     CAMBIAR CAMPOS
  ======================================== */

  const manejarCambio = (
    e
  ) => {
    const {
      name,
      value
    } = e.target

    setFormulario(
      (anterior) => ({
        ...anterior,

        [name]:
          value
      })
    )

    setMensaje('')
    setError('')
  }

  /* ========================================
     NUEVO EVENTO
  ======================================== */

  const abrirNuevoEvento =
    () => {
      setIdEdicion(null)

      setFormulario(
        formularioVacio
      )

      setEventoDetalle(null)

      setMensaje('')
      setError('')

      setMostrarFormulario(
        true
      )
    }

  /* ========================================
     EDITAR EVENTO
  ======================================== */

  const abrirEdicion = (
    evento
  ) => {
    const horas =
      extraerHoras(
        evento.horario
      )

    setIdEdicion(
      evento.id
    )

    setFormulario({
      salaId:
        String(
          evento.salaId
        ),

      nombre:
        evento.nombre ||
        '',

      tipo:
        evento.tipo ||
        '',

      fecha:
        obtenerFechaSimple(
          evento.fecha
        ),

      horaInicio:
        evento.horaInicio ||
        horas.horaInicio,

      horaFin:
        evento.horaFin ||
        horas.horaFin,

      lugar:
        evento.lugar ||
        '',

      ubicacion:
        evento.ubicacion ||
        '',

      invitados:
        evento.invitados ??
        '',

      meserosRequeridos:
        evento.meserosRequeridos ??
        '',

      uniforme:
        evento.uniforme ||
        '',

      observaciones:
        evento.observaciones ||
        ''
    })

    setEventoDetalle(null)

    setMensaje('')
    setError('')

    setMostrarFormulario(
      true
    )
  }

  /* ========================================
     CERRAR FORMULARIO
  ======================================== */

  const cerrarFormulario =
    () => {
      setMostrarFormulario(
        false
      )

      setIdEdicion(null)

      setFormulario(
        formularioVacio
      )

      setError('')
    }

  /* ========================================
     GUARDAR EVENTO
  ======================================== */

  const guardarEvento =
    async (e) => {
      e.preventDefault()

      setMensaje('')
      setError('')

      if (
        !formulario.salaId ||
        !formulario.nombre.trim() ||
        !formulario.tipo ||
        !formulario.fecha ||
        !formulario.horaInicio ||
        !formulario.horaFin ||
        !formulario.lugar.trim() ||
        !formulario.ubicacion.trim()
      ) {
        setError(
          'Completa todos los campos obligatorios.'
        )

        return
      }

      try {
        const url = new URL(
          formulario.ubicacion.trim()
        )

        if (
          url.protocol !== 'https:' &&
          url.protocol !== 'http:'
        ) {
          throw new Error()
        }
      } catch {
        setError(
          'La ubicación debe ser un enlace válido de Google Maps.'
        )
        return
      }

      /*
        La hora final puede ser menor
        que la inicial.

        Ejemplo:
        19:00 - 01:00

        Esto representa un evento
        nocturno y debe permitirse.

        Solamente rechazamos que ambas
        horas sean exactamente iguales.
      */

      if (
        formulario.horaInicio ===
        formulario.horaFin
      ) {
        setError(
          'La hora de inicio y la hora de término no pueden ser iguales.'
        )

        return
      }

      const datos = {
        salaId:
          Number(
            formulario.salaId
          ),

        nombre:
          formulario.nombre
            .trim(),

        tipo:
          formulario.tipo,

        fecha:
          formulario.fecha,

        horaInicio:
          formulario.horaInicio,

        horaFin:
          formulario.horaFin,

        /*
          Conservamos horario porque
          otras pantallas de MesereArte
          todavía utilizan este campo.
        */

        horario:
          `${formulario.horaInicio} - ${formulario.horaFin}`,

        lugar:
          formulario.lugar
            .trim(),

        ubicacion:
          formulario.ubicacion
            .trim(),

        invitados:
          Number(
            formulario.invitados ||
            0
          ),

        meserosRequeridos:
          Number(
            formulario.meserosRequeridos ||
            0
          ),

        uniforme:
          formulario.uniforme
            .trim(),

        observaciones:
          formulario.observaciones
            .trim()
      }

      try {
        setGuardando(true)

        if (idEdicion) {
          await actualizarEventoAPI(
            idEdicion,
            datos
          )

          setMensaje(
            'Evento actualizado correctamente.'
          )
        } else {
          await crearEventoAPI(
            datos
          )

          setMensaje(
            'Evento creado correctamente.'
          )
        }

        setMostrarFormulario(
          false
        )

        setIdEdicion(null)

        setFormulario(
          formularioVacio
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
     ELIMINAR EVENTO
  ======================================== */

  const eliminarEvento =
    async (evento) => {
      const confirmar =
        window.confirm(
          `¿Deseas eliminar el evento "${evento.nombre}"?`
        )

      if (!confirmar) {
        return
      }

      try {
        setError('')
        setMensaje('')

        await eliminarEventoAPI(
          evento.id
        )

        setMensaje(
          'Evento eliminado correctamente.'
        )

      } catch (error) {
        setError(
          error.message
        )
      }
    }

  /* ========================================
     COMPONENTE
  ======================================== */

  return (
    <div className="eventos-pagina">

      {/* ===================================
          ENCABEZADO
      =================================== */}

      <div className="eventos-encabezado">

        <div>

          <h1>
            Eventos
          </h1>

          <p>
            Crea y administra los
            eventos de tus equipos.
          </p>

        </div>

        <button
          type="button"
          onClick={
            abrirNuevoEvento
          }
        >
          + Nuevo evento
        </button>

      </div>

      {/* ===================================
          MENSAJES
      =================================== */}

      {mensaje && (

        <div className="mensaje-exito">

          {mensaje}

        </div>

      )}

      {error &&
        !mostrarFormulario && (

        <div className="mensaje-error">

          {error}

        </div>

      )}

      {/* ===================================
          LISTADO DE EVENTOS
      =================================== */}

      <div className="eventos-contenedor">

        <div className="eventos-filtros">

          <input
            type="text"
            placeholder="Buscar evento, tipo, lugar o sala..."
            value={
              busqueda
            }
            onChange={(e) =>
              setBusqueda(
                e.target.value
              )
            }
          />

        </div>

        <div className="tabla-responsive">

          <table className="tabla-eventos">

            <thead>

              <tr>

                <th>
                  Evento
                </th>

                <th>
                  Sala
                </th>

                <th>
                  Fecha
                </th>

                <th>
                  Horario
                </th>

                <th>
                  Lugar
                </th>

                <th>
                  Personal
                </th>

                <th>
                  Estado
                </th>

                <th>
                  Acciones
                </th>

              </tr>

            </thead>

            <tbody>

              {eventosFiltrados.length ===
              0 ? (

                <tr>

                  <td colSpan="8">

                    No hay eventos registrados.

                  </td>

                </tr>

              ) : (

                eventosFiltrados.map(
                  (evento) => (

                    <tr
                      key={
                        evento.id
                      }
                    >

                      <td>

                        <strong>
                          {
                            evento.nombre
                          }
                        </strong>

                        <span>
                          {evento.tipo ||
                            'Sin tipo'}
                        </span>

                      </td>

                      <td>
                        {obtenerNombreSala(
                          evento.salaId
                        )}
                      </td>

                      <td>
                        {formatearFecha(
                          evento.fecha
                        )}
                      </td>

                      <td>
                        {obtenerHorario(
                          evento
                        )}
                      </td>

                      <td>
                        {
                          evento.lugar ||
                          'Sin especificar'
                        }
                      </td>

                      <td>

                        {obtenerCantidadAsignados(
                          evento.id
                        )}

                        {' / '}

                        {
                          evento
                            .meserosRequeridos
                        }

                      </td>

                      <td>

                        {evento.estado ||
                          'Pendiente'}

                      </td>

                      <td>

                        <div className="acciones-evento">

                          <button
                            type="button"
                            onClick={() =>
                              setEventoDetalle(
                                evento
                              )
                            }
                          >
                            Ver
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              abrirEdicion(
                                evento
                              )
                            }
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              eliminarEvento(
                                evento
                              )
                            }
                          >
                            Eliminar
                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ===================================
          MODAL NUEVO / EDITAR
      =================================== */}

      {mostrarFormulario && (

        <div
          className="modal-fondo"
          onClick={
            cerrarFormulario
          }
        >

          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <h2>
                  {idEdicion
                    ? 'Editar evento'
                    : 'Nuevo evento'}
                </h2>

                <p>
                  Registra la información
                  general del evento.
                </p>

              </div>

              <button
                type="button"
                onClick={
                  cerrarFormulario
                }
              >
                ×
              </button>

            </div>

            {error && (

              <div className="mensaje-error">

                {error}

              </div>

            )}

            <form
              onSubmit={
                guardarEvento
              }
            >

              <div className="form-grid">

                {/* SALA */}

                <div>

                  <label>
                    Sala *
                  </label>

                  <select
                    name="salaId"
                    value={
                      formulario.salaId
                    }
                    onChange={
                      manejarCambio
                    }
                  >

                    <option value="">
                      Selecciona una sala
                    </option>

                    {salas
                      .filter(
                        (sala) =>
                          sala.estado ===
                            'Activa' ||
                          sala.id ===
                            Number(
                              formulario.salaId
                            )
                      )
                      .map(
                        (sala) => (

                          <option
                            key={
                              sala.id
                            }
                            value={
                              sala.id
                            }
                          >
                            {
                              sala.nombre
                            }
                          </option>

                        )
                      )}

                  </select>

                </div>

                {/* NOMBRE */}

                <div>

                  <label>
                    Nombre del evento *
                  </label>

                  <input
                    type="text"
                    name="nombre"
                    value={
                      formulario.nombre
                    }
                    onChange={
                      manejarCambio
                    }
                    placeholder="Ejemplo: Boda Martínez"
                  />

                </div>

                {/* TIPO */}

                <div>

                  <label>
                    Tipo de evento *
                  </label>

                  <select
                    name="tipo"
                    value={
                      formulario.tipo
                    }
                    onChange={
                      manejarCambio
                    }
                  >

                    <option value="">
                      Selecciona el tipo de evento
                    </option>

                    {tiposEvento.map(
                      (tipo) => (

                        <option
                          key={tipo}
                          value={tipo}
                        >
                          {tipo}
                        </option>

                      )
                    )}

                  </select>

                </div>

                {/* FECHA */}

                <div>

                  <label>
                    Fecha *
                  </label>

                  <input
                    type="date"
                    name="fecha"
                    value={
                      formulario.fecha
                    }
                    onChange={
                      manejarCambio
                    }
                  />

                </div>

                {/* HORA DE INICIO */}

                <div>

                  <label>
                    Hora de inicio *
                  </label>

                  <input
                    type="time"
                    name="horaInicio"
                    value={
                      formulario.horaInicio
                    }
                    onChange={
                      manejarCambio
                    }
                  />

                </div>

                {/* HORA DE TÉRMINO */}

                <div>

                  <label>
                    Hora de término *
                  </label>

                  <input
                    type="time"
                    name="horaFin"
                    value={
                      formulario.horaFin
                    }
                    onChange={
                      manejarCambio
                    }
                  />

                </div>

                {/* LUGAR */}

                <div className="campo-completo">

                  <label>
                    Lugar *
                  </label>

                  <input
                    type="text"
                    name="lugar"
                    value={
                      formulario.lugar
                    }
                    onChange={
                      manejarCambio
                    }
                    placeholder="Ejemplo: Jardín Los Encinos"
                  />

                </div>

                {/* UBICACIÓN */}

                <div className="campo-completo">

                  <label>
                    Ubicación *
                  </label>

                  <input
                    type="url"
                    name="ubicacion"
                    value={
                      formulario.ubicacion
                    }
                    onChange={
                      manejarCambio
                    }
                    placeholder="Pega el link de Google Maps"
                  />

                </div>

                {/* INVITADOS */}

                <div>

                  <label>
                    Número de invitados
                  </label>

                  <input
                    type="number"
                    min="0"
                    name="invitados"
                    value={
                      formulario.invitados
                    }
                    onChange={
                      manejarCambio
                    }
                    placeholder="0"
                  />

                </div>

                {/* MESEROS */}

                <div>

                  <label>
                    Meseros requeridos
                  </label>

                  <input
                    type="number"
                    min="0"
                    name="meserosRequeridos"
                    value={
                      formulario
                        .meserosRequeridos
                    }
                    onChange={
                      manejarCambio
                    }
                    placeholder="0"
                  />

                </div>

                {/* UNIFORME */}

                <div className="campo-completo">

                  <label>
                    Uniforme
                  </label>

                  <input
                    type="text"
                    name="uniforme"
                    value={
                      formulario.uniforme
                    }
                    onChange={
                      manejarCambio
                    }
                    placeholder="Ejemplo: Camisa blanca, pantalón negro y zapatos negros"
                  />

                </div>

                {/* OBSERVACIONES */}

                <div className="campo-completo">

                  <label>
                    Observaciones
                  </label>

                  <textarea
                    rows="4"
                    name="observaciones"
                    value={
                      formulario
                        .observaciones
                    }
                    onChange={
                      manejarCambio
                    }
                    placeholder="Agrega información adicional del evento..."
                  />

                </div>

              </div>

              <div className="modal-acciones">

                <button
                  type="button"
                  onClick={
                    cerrarFormulario
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    guardando
                  }
                >
                  {guardando
                    ? 'Guardando...'
                    : idEdicion
                      ? 'Guardar cambios'
                      : 'Crear evento'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ===================================
          DETALLE DEL EVENTO
      =================================== */}

      {eventoDetalle && (

        <div
          className="modal-fondo"
          onClick={() =>
            setEventoDetalle(
              null
            )
          }
        >

          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <h2>
                  {
                    eventoDetalle.nombre
                  }
                </h2>

                <p>
                  Detalle del evento
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setEventoDetalle(
                    null
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="detalle-evento">

              <p>

                <strong>
                  Tipo:
                </strong>{' '}

                {eventoDetalle.tipo ||
                  'Sin especificar'}

              </p>

              <p>

                <strong>
                  Sala:
                </strong>{' '}

                {obtenerNombreSala(
                  eventoDetalle.salaId
                )}

              </p>

              <p>

                <strong>
                  Fecha:
                </strong>{' '}

                {formatearFecha(
                  eventoDetalle.fecha
                )}

              </p>

              <p>

                <strong>
                  Horario:
                </strong>{' '}

                {obtenerHorario(
                  eventoDetalle
                )}

              </p>

              <p>

                <strong>
                  Lugar:
                </strong>{' '}

                {eventoDetalle.lugar ||
                  'Sin especificar'}

              </p>

              <p>

                <strong>
                  Ubicación:
                </strong>{' '}

                {eventoDetalle.ubicacion
                  ?.startsWith('http') ? (

                  <a
                    href={
                      eventoDetalle.ubicacion
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir en Google Maps
                  </a>

                ) : (
                  'Sin enlace registrado'
                )}

              </p>

              <p>

                <strong>
                  Invitados:
                </strong>{' '}

                {
                  eventoDetalle.invitados
                }

              </p>

              <p>

                <strong>
                  Meseros requeridos:
                </strong>{' '}

                {
                  eventoDetalle
                    .meserosRequeridos
                }

              </p>

              <p>

                <strong>
                  Estado:
                </strong>{' '}

                {eventoDetalle.estado ||
                  'Pendiente'}

              </p>

              <p>

                <strong>
                  Uniforme:
                </strong>{' '}

                {eventoDetalle.uniforme ||
                  'Sin especificar'}

              </p>

              <p>

                <strong>
                  Observaciones:
                </strong>{' '}

                {eventoDetalle
                  .observaciones ||
                  'Sin observaciones'}

              </p>

            </div>

          </div>

        </div>

      )}

    </div>
  )
}

export default AdminEventos
