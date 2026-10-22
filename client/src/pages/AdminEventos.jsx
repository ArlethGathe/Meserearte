import { useState } from 'react'
import './AdminEventos.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

const formularioVacio = {
  salaId: '',
  nombre: '',
  tipo: '',
  fecha: '',
  horario: '',
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
    setEventos,
    asignaciones
  } = useMesereArte()

  const [busqueda, setBusqueda] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [eventoDetalle, setEventoDetalle] = useState(null)
  const [idEdicion, setIdEdicion] = useState(null)

  const [formulario, setFormulario] = useState(formularioVacio)

  const obtenerNombreSala = (salaId) => {
    const sala = salas.find(
      (sala) => sala.id === Number(salaId)
    )

    return sala
      ? sala.nombre
      : 'Sin sala'
  }

  const obtenerMeserosAsignados = (eventoId) => {
    return asignaciones.filter(
      (asignacion) =>
        asignacion.eventoId === eventoId
    ).length
  }

  const manejarCambio = (e) => {
    const { name, value } = e.target

    setFormulario({
      ...formulario,
      [name]: value
    })
  }

  const abrirNuevoEvento = () => {
    setIdEdicion(null)

    setFormulario({
      ...formularioVacio,
      salaId: salas.length > 0
        ? salas[0].id
        : ''
    })

    setMostrarFormulario(true)
  }

  const abrirEdicion = (evento) => {
    setIdEdicion(evento.id)

    setFormulario({
      salaId: evento.salaId,
      nombre: evento.nombre,
      tipo: evento.tipo,
      fecha: evento.fecha,
      horario: evento.horario,
      ubicacion: evento.ubicacion,
      invitados: evento.invitados,
      meserosRequeridos: evento.meserosRequeridos,
      uniforme: evento.uniforme,
      observaciones: evento.observaciones
    })

    setMostrarFormulario(true)
  }

  const cerrarFormulario = () => {
    setMostrarFormulario(false)
    setIdEdicion(null)
    setFormulario(formularioVacio)
  }

  const guardarEvento = (e) => {
    e.preventDefault()

    if (idEdicion) {
      setEventos(
        eventos.map((evento) =>
          evento.id === idEdicion
            ? {
                ...evento,
                ...formulario,
                salaId: Number(formulario.salaId),
                invitados: Number(formulario.invitados),
                meserosRequeridos: Number(
                  formulario.meserosRequeridos
                )
              }
            : evento
        )
      )
    } else {
      const nuevoEvento = {
        id: Date.now(),

        ...formulario,

        salaId: Number(formulario.salaId),

        invitados: Number(
          formulario.invitados
        ),

        meserosRequeridos: Number(
          formulario.meserosRequeridos
        ),

        estado: 'Pendiente'
      }

      setEventos([
        ...eventos,
        nuevoEvento
      ])
    }

    cerrarFormulario()
  }

  const eliminarEvento = (evento) => {
    const tieneAsignaciones = asignaciones.some(
      (asignacion) =>
        asignacion.eventoId === evento.id
    )

    if (tieneAsignaciones) {
      window.alert(
        'Este evento tiene meseros asignados. Retira primero sus asignaciones.'
      )
      return
    }

    const confirmar = window.confirm(
      `¿Deseas eliminar el evento "${evento.nombre}"?`
    )

    if (!confirmar) {
      return
    }

    setEventos(
      eventos.filter(
        (item) => item.id !== evento.id
      )
    )
  }

  const formatearFecha = (fecha) => {
    if (!fecha) return ''

    const partes = fecha.split('-')

    if (partes.length !== 3) {
      return fecha
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }

  const eventosFiltrados = eventos.filter(
    (evento) => {
      const texto = busqueda.toLowerCase()

      return (
        evento.nombre
          .toLowerCase()
          .includes(texto) ||
        evento.ubicacion
          .toLowerCase()
          .includes(texto) ||
        obtenerNombreSala(evento.salaId)
          .toLowerCase()
          .includes(texto)
      )
    }
  )

  return (
    <div className="eventos-pagina">

      <div className="eventos-encabezado">

        <div>
          <h1>Gestión de eventos</h1>

          <p>
            Registra, consulta, edita y elimina eventos.
          </p>
        </div>

        <button
          className="nuevo-evento"
          onClick={abrirNuevoEvento}
        >
          + Nuevo evento
        </button>

      </div>

      <div className="eventos-contenedor">

        <div className="eventos-filtros">

          <input
            type="text"
            placeholder="Buscar evento..."
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
          />

        </div>

        <div className="tabla-responsive">

          <table className="tabla-eventos">

            <thead>
              <tr>
                <th>Evento</th>
                <th>Sala</th>
                <th>Fecha</th>
                <th>Ubicación</th>
                <th>Meseros</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>

              {eventosFiltrados.map((evento) => (

                <tr key={evento.id}>

                  <td className="evento-nombre">
                    {evento.nombre}
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
                    {evento.ubicacion}
                  </td>

                  <td>
                    {obtenerMeserosAsignados(
                      evento.id
                    )}{' '}
                    asignados
                  </td>

                  <td>

                    <span
                      className={`etiqueta-estado ${evento.estado.toLowerCase()}`}
                    >
                      {evento.estado}
                    </span>

                  </td>

                  <td>

                    <div className="acciones-evento">

                      <button
                        className="accion-ver"
                        onClick={() =>
                          setEventoDetalle(evento)
                        }
                      >
                        Ver
                      </button>

                      <button
                        className="accion-editar"
                        onClick={() =>
                          abrirEdicion(evento)
                        }
                      >
                        Editar
                      </button>

                      <button
                        className="accion-eliminar"
                        onClick={() =>
                          eliminarEvento(evento)
                        }
                      >
                        Eliminar
                      </button>

                    </div>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

      {mostrarFormulario && (

        <div className="modal-fondo">

          <div className="modal-evento">

            <div className="modal-encabezado">

              <div>

                <h2>
                  {idEdicion
                    ? 'Editar evento'
                    : 'Nuevo evento'}
                </h2>

                <p>
                  {idEdicion
                    ? 'Modifica la información del evento.'
                    : 'Ingresa la información del evento.'}
                </p>

              </div>

              <button
                type="button"
                className="cerrar-modal"
                onClick={cerrarFormulario}
              >
                ×
              </button>

            </div>

            <form
              className="form-evento"
              onSubmit={guardarEvento}
            >

              <div className="form-grid">

                <div className="campo-completo">

                  <label>
                    Sala
                  </label>

                  <select
                    name="salaId"
                    value={formulario.salaId}
                    onChange={manejarCambio}
                    required
                  >

                    {salas.map((sala) => (

                      <option
                        key={sala.id}
                        value={sala.id}
                      >
                        {sala.nombre}
                      </option>

                    ))}

                  </select>

                </div>

                <div>

                  <label>
                    Nombre del evento
                  </label>

                  <input
                    type="text"
                    name="nombre"
                    value={formulario.nombre}
                    onChange={manejarCambio}
                    required
                  />

                </div>

                <div>

                  <label>
                    Tipo de evento
                  </label>

                  <select
                    name="tipo"
                    value={formulario.tipo}
                    onChange={manejarCambio}
                    required
                  >

                    <option value="">
                      Selecciona
                    </option>

                    <option value="Boda">
                      Boda
                    </option>

                    <option value="XV años">
                      XV años
                    </option>

                    <option value="Graduación">
                      Graduación
                    </option>

                    <option value="Cumpleaños">
                      Cumpleaños
                    </option>

                    <option value="Corporativo">
                      Corporativo
                    </option>

                    <option value="Bautizo">
                      Bautizo
                    </option>

                    <option value="Otro">
                      Otro
                    </option>

                  </select>

                </div>

                <div>

                  <label>Fecha</label>

                  <input
                    type="date"
                    name="fecha"
                    value={formulario.fecha}
                    onChange={manejarCambio}
                    required
                  />

                </div>

                <div>

                  <label>Horario</label>

                  <input
                    type="time"
                    name="horario"
                    value={formulario.horario}
                    onChange={manejarCambio}
                    required
                  />

                </div>

                <div className="campo-completo">

                  <label>Ubicación</label>

                  <input
                    type="text"
                    name="ubicacion"
                    value={formulario.ubicacion}
                    onChange={manejarCambio}
                    required
                  />

                </div>

                <div>

                  <label>
                    Número de invitados
                  </label>

                  <input
                    type="number"
                    name="invitados"
                    min="1"
                    value={formulario.invitados}
                    onChange={manejarCambio}
                    required
                  />

                </div>

                <div>

                  <label>
                    Meseros requeridos
                  </label>

                  <input
                    type="number"
                    name="meserosRequeridos"
                    min="1"
                    value={
                      formulario.meserosRequeridos
                    }
                    onChange={manejarCambio}
                    required
                  />

                </div>

                <div className="campo-completo">

                  <label>
                    Uniforme
                  </label>

                  <input
                    type="text"
                    name="uniforme"
                    value={formulario.uniforme}
                    onChange={manejarCambio}
                  />

                </div>

                <div className="campo-completo">

                  <label>
                    Observaciones
                  </label>

                  <textarea
                    name="observaciones"
                    value={formulario.observaciones}
                    onChange={manejarCambio}
                    rows="4"
                  />

                </div>

              </div>

              <div className="modal-botones">

                <button
                  type="button"
                  className="boton-cancelar"
                  onClick={cerrarFormulario}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="boton-guardar-evento"
                >
                  {idEdicion
                    ? 'Guardar cambios'
                    : 'Guardar evento'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {eventoDetalle && (

        <div className="modal-fondo">

          <div className="modal-evento">

            <div className="modal-encabezado">

              <div>
                <h2>
                  Detalles del evento
                </h2>

                <p>
                  Información completa del evento.
                </p>
              </div>

              <button
                className="cerrar-modal"
                onClick={() =>
                  setEventoDetalle(null)
                }
              >
                ×
              </button>

            </div>

            <div className="detalle-grid">

              <div>
                <span>Evento</span>
                <strong>
                  {eventoDetalle.nombre}
                </strong>
              </div>

              <div>
                <span>Sala</span>
                <strong>
                  {obtenerNombreSala(
                    eventoDetalle.salaId
                  )}
                </strong>
              </div>

              <div>
                <span>Tipo</span>
                <strong>
                  {eventoDetalle.tipo}
                </strong>
              </div>

              <div>
                <span>Fecha</span>
                <strong>
                  {formatearFecha(
                    eventoDetalle.fecha
                  )}
                </strong>
              </div>

              <div>
                <span>Horario</span>
                <strong>
                  {eventoDetalle.horario}
                </strong>
              </div>

              <div>
                <span>Meseros asignados</span>
                <strong>
                  {obtenerMeserosAsignados(
                    eventoDetalle.id
                  )}
                </strong>
              </div>

              <div className="detalle-completo">
                <span>Ubicación</span>
                <strong>
                  {eventoDetalle.ubicacion}
                </strong>
              </div>

              <div>
                <span>Invitados</span>
                <strong>
                  {eventoDetalle.invitados}
                </strong>
              </div>

              <div>
                <span>
                  Meseros requeridos
                </span>

                <strong>
                  {
                    eventoDetalle.meserosRequeridos
                  }
                </strong>
              </div>

              <div className="detalle-completo">

                <span>Uniforme</span>

                <strong>
                  {eventoDetalle.uniforme ||
                    'Sin especificar'}
                </strong>

              </div>

              <div className="detalle-completo">

                <span>Observaciones</span>

                <strong>
                  {eventoDetalle.observaciones ||
                    'Sin observaciones'}
                </strong>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  )
}

export default AdminEventos