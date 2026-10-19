import { useState } from 'react'
import './AdminEventos.css'

function AdminEventos() {
  const [busqueda, setBusqueda] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  const [eventos, setEventos] = useState([
    {
      id: 1,
      nombre: 'Boda Hernández & Ruiz',
      tipo: 'Boda',
      fecha: '2026-06-14',
      horario: '18:00',
      ubicacion: 'Jardín Los Encinos',
      invitados: 180,
      meserosRequeridos: 12,
      meseros: 12,
      uniforme: 'Camisa blanca, pantalón negro',
      observaciones: 'Llegar una hora antes.',
      estado: 'Programado'
    },
    {
      id: 2,
      nombre: 'XV años Valentina',
      tipo: 'XV años',
      fecha: '2026-06-21',
      horario: '17:00',
      ubicacion: 'Salón Imperial',
      invitados: 150,
      meserosRequeridos: 10,
      meseros: 8,
      uniforme: 'Camisa negra y corbata vino',
      observaciones: '',
      estado: 'Pendiente'
    },
    {
      id: 3,
      nombre: 'Graduación ESCOM',
      tipo: 'Graduación',
      fecha: '2026-06-28',
      horario: '19:00',
      ubicacion: 'Centro de Convenciones',
      invitados: 300,
      meserosRequeridos: 15,
      meseros: 15,
      uniforme: 'Camisa blanca y corbata negra',
      observaciones: '',
      estado: 'Confirmado'
    }
  ])

  const [formulario, setFormulario] = useState({
    nombre: '',
    tipo: '',
    fecha: '',
    horario: '',
    ubicacion: '',
    invitados: '',
    meserosRequeridos: '',
    uniforme: '',
    observaciones: ''
  })

  const manejarCambio = (e) => {
    const { name, value } = e.target

    setFormulario({
      ...formulario,
      [name]: value
    })
  }

  const guardarEvento = (e) => {
    e.preventDefault()

    const nuevoEvento = {
      id: Date.now(),
      ...formulario,
      invitados: Number(formulario.invitados),
      meserosRequeridos: Number(formulario.meserosRequeridos),
      meseros: 0,
      estado: 'Pendiente'
    }

    setEventos([...eventos, nuevoEvento])

    setFormulario({
      nombre: '',
      tipo: '',
      fecha: '',
      horario: '',
      ubicacion: '',
      invitados: '',
      meserosRequeridos: '',
      uniforme: '',
      observaciones: ''
    })

    setMostrarFormulario(false)
  }

  const cerrarFormulario = () => {
    setMostrarFormulario(false)
  }

  const formatearFecha = (fecha) => {
    if (!fecha) return ''

    const partes = fecha.split('-')

    if (partes.length !== 3) {
      return fecha
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }

  const eventosFiltrados = eventos.filter((evento) =>
    evento.nombre
      .toLowerCase()
      .includes(busqueda.toLowerCase())
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
          onClick={() => setMostrarFormulario(true)}
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
            onChange={(e) => setBusqueda(e.target.value)}
          />

        </div>

        <div className="tabla-responsive">

          <table className="tabla-eventos">

            <thead>
              <tr>
                <th>Evento</th>
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
                    {formatearFecha(evento.fecha)}
                  </td>

                  <td>
                    {evento.ubicacion}
                  </td>

                  <td>
                    {evento.meseros} asignados
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

                      <button className="accion-ver">
                        Ver
                      </button>

                      <button className="accion-editar">
                        Editar
                      </button>

                      <button className="accion-eliminar">
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
                <h2>Nuevo evento</h2>

                <p>
                  Ingresa la información del evento.
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

                <div>

                  <label>
                    Nombre del evento
                  </label>

                  <input
                    type="text"
                    name="nombre"
                    value={formulario.nombre}
                    onChange={manejarCambio}
                    placeholder="Ej. Boda Hernández & Ruiz"
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

                  <label>
                    Fecha
                  </label>

                  <input
                    type="date"
                    name="fecha"
                    value={formulario.fecha}
                    onChange={manejarCambio}
                    required
                  />

                </div>

                <div>

                  <label>
                    Horario
                  </label>

                  <input
                    type="time"
                    name="horario"
                    value={formulario.horario}
                    onChange={manejarCambio}
                    required
                  />

                </div>

                <div className="campo-completo">

                  <label>
                    Ubicación
                  </label>

                  <input
                    type="text"
                    name="ubicacion"
                    value={formulario.ubicacion}
                    onChange={manejarCambio}
                    placeholder="Salón, jardín o dirección"
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
                    placeholder="150"
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
                    value={formulario.meserosRequeridos}
                    onChange={manejarCambio}
                    placeholder="10"
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
                    placeholder="Ej. camisa blanca, pantalón negro y corbata vino"
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
                    placeholder="Indicaciones adicionales..."
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
                  Guardar evento
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  )
}

export default AdminEventos