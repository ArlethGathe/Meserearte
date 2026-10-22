import { useState } from 'react'
import './AdminUsuarios.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

const formularioVacio = {
  nombre: '',
  apellidos: '',
  correo: '',
  telefono: '',
  salaId: '',
  estado: 'Activo'
}

function AdminUsuarios() {
  const {
    salas,
    meseros,
    setMeseros
  } = useMesereArte()

  const [busqueda, setBusqueda] = useState('')
  const [filtroSala, setFiltroSala] = useState('Todas')

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false)

  const [meseroDetalle, setMeseroDetalle] =
    useState(null)

  const [idEdicion, setIdEdicion] =
    useState(null)

  const [formulario, setFormulario] =
    useState(formularioVacio)

  const obtenerNombreSala = (salaId) => {
    const sala = salas.find(
      (sala) => sala.id === Number(salaId)
    )

    return sala
      ? sala.nombre
      : 'Sin sala'
  }

  const manejarCambio = (e) => {
    const { name, value } = e.target

    setFormulario({
      ...formulario,
      [name]: value
    })
  }

  const abrirNuevo = () => {
    setIdEdicion(null)

    setFormulario({
      ...formularioVacio,
      salaId: salas.length > 0
        ? salas[0].id
        : ''
    })

    setMostrarFormulario(true)
  }

  const abrirEdicion = (mesero) => {
    setIdEdicion(mesero.id)

    setFormulario({
      nombre: mesero.nombre,
      apellidos: mesero.apellidos,
      correo: mesero.correo,
      telefono: mesero.telefono,
      salaId: mesero.salaId,
      estado: mesero.estado
    })

    setMostrarFormulario(true)
  }

  const cerrarFormulario = () => {
    setMostrarFormulario(false)
    setIdEdicion(null)
    setFormulario(formularioVacio)
  }

  const guardarMesero = (e) => {
    e.preventDefault()

    if (idEdicion) {
      setMeseros(
        meseros.map((mesero) =>
          mesero.id === idEdicion
            ? {
                ...mesero,
                ...formulario,
                salaId: Number(
                  formulario.salaId
                )
              }
            : mesero
        )
      )
    } else {
      const nuevoMesero = {
        id: Date.now(),

        ...formulario,

        salaId: Number(
          formulario.salaId
        ),

        eventosParticipados: 0,

        disponibilidad: 'Disponible'
      }

      setMeseros([
        ...meseros,
        nuevoMesero
      ])
    }

    cerrarFormulario()
  }

  const eliminarMesero = (mesero) => {
    const confirmar = window.confirm(
      `¿Deseas eliminar a ${mesero.nombre} ${mesero.apellidos}?`
    )

    if (!confirmar) {
      return
    }

    setMeseros(
      meseros.filter(
        (item) => item.id !== mesero.id
      )
    )
  }

  const meserosFiltrados = meseros.filter(
    (mesero) => {
      const texto = busqueda.toLowerCase()

      const coincideBusqueda =
        mesero.nombre
          .toLowerCase()
          .includes(texto) ||
        mesero.apellidos
          .toLowerCase()
          .includes(texto) ||
        mesero.correo
          .toLowerCase()
          .includes(texto)

      const coincideSala =
        filtroSala === 'Todas' ||
        mesero.salaId ===
          Number(filtroSala)

      return (
        coincideBusqueda &&
        coincideSala
      )
    }
  )

  return (
    <div className="usuarios-pagina">

      <div className="usuarios-encabezado">

        <div>
          <h1>
            Gestión de usuarios
          </h1>

          <p>
            Consulta y administra los
            meseros vinculados a tus salas.
          </p>
        </div>

        <button
          className="nuevo-mesero"
          onClick={abrirNuevo}
        >
          + Nuevo mesero
        </button>

      </div>

      <div className="usuarios-contenedor">

        <div className="usuarios-filtros">

          <input
            type="text"
            placeholder="Buscar mesero..."
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
          />

          <select
            value={filtroSala}
            onChange={(e) =>
              setFiltroSala(
                e.target.value
              )
            }
          >

            <option value="Todas">
              Todas las salas
            </option>

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

        <div className="tabla-responsive">

          <table className="tabla-usuarios">

            <thead>
              <tr>
                <th>Mesero</th>
                <th>Sala</th>
                <th>Eventos participados</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>

              {meserosFiltrados.map(
                (mesero) => (

                  <tr key={mesero.id}>

                    <td>

                      <strong>
                        {mesero.nombre}{' '}
                        {mesero.apellidos}
                      </strong>

                      <span className="correo-mesero">
                        {mesero.correo}
                      </span>

                    </td>

                    <td>
                      {obtenerNombreSala(
                        mesero.salaId
                      )}
                    </td>

                    <td>
                      {
                        mesero.eventosParticipados
                      }
                    </td>

                    <td>

                      <span
                        className={`estado-usuario ${mesero.estado.toLowerCase()}`}
                      >
                        {mesero.estado}
                      </span>

                    </td>

                    <td>

                      <div className="acciones-usuario">

                        <button
                          className="usuario-ver"
                          onClick={() =>
                            setMeseroDetalle(
                              mesero
                            )
                          }
                        >
                          Ver
                        </button>

                        <button
                          className="usuario-editar"
                          onClick={() =>
                            abrirEdicion(
                              mesero
                            )
                          }
                        >
                          Editar
                        </button>

                        <button
                          className="usuario-eliminar"
                          onClick={() =>
                            eliminarMesero(
                              mesero
                            )
                          }
                        >
                          Eliminar
                        </button>

                      </div>

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      </div>

      {mostrarFormulario && (

        <div className="modal-fondo-usuario">

          <div className="modal-usuario">

            <div className="modal-usuario-header">

              <div>

                <h2>
                  {idEdicion
                    ? 'Editar mesero'
                    : 'Nuevo mesero'}
                </h2>

                <p>
                  Captura la información
                  del mesero.
                </p>

              </div>

              <button
                className="cerrar-modal-usuario"
                onClick={cerrarFormulario}
              >
                ×
              </button>

            </div>

            <form
              onSubmit={guardarMesero}
            >

              <div className="usuario-form-grid">

                <div>

                  <label>
                    Nombre
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
                    required
                  />

                </div>

                <div>

                  <label>
                    Apellidos
                  </label>

                  <input
                    type="text"
                    name="apellidos"
                    value={
                      formulario.apellidos
                    }
                    onChange={
                      manejarCambio
                    }
                    required
                  />

                </div>

                <div className="usuario-campo-completo">

                  <label>
                    Correo electrónico
                  </label>

                  <input
                    type="email"
                    name="correo"
                    value={
                      formulario.correo
                    }
                    onChange={
                      manejarCambio
                    }
                    required
                  />

                </div>

                <div>

                  <label>
                    Teléfono
                  </label>

                  <input
                    type="text"
                    name="telefono"
                    value={
                      formulario.telefono
                    }
                    onChange={
                      manejarCambio
                    }
                  />

                </div>

                <div>

                  <label>
                    Sala
                  </label>

                  <select
                    name="salaId"
                    value={
                      formulario.salaId
                    }
                    onChange={
                      manejarCambio
                    }
                    required
                  >

                    {salas.map(
                      (sala) => (

                        <option
                          key={sala.id}
                          value={sala.id}
                        >
                          {sala.nombre}
                        </option>

                      )
                    )}

                  </select>

                </div>

                <div className="usuario-campo-completo">

                  <label>
                    Estado
                  </label>

                  <select
                    name="estado"
                    value={
                      formulario.estado
                    }
                    onChange={
                      manejarCambio
                    }
                  >

                    <option value="Activo">
                      Activo
                    </option>

                    <option value="Inactivo">
                      Inactivo
                    </option>

                  </select>

                </div>

              </div>

              {idEdicion && (

                <div className="aviso-eventos">

                  Los eventos participados
                  no pueden editarse
                  manualmente.

                </div>

              )}

              <div className="modal-usuario-botones">

                <button
                  type="button"
                  className="cancelar-usuario"
                  onClick={
                    cerrarFormulario
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="guardar-usuario"
                >
                  {idEdicion
                    ? 'Guardar cambios'
                    : 'Registrar mesero'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {meseroDetalle && (

        <div className="modal-fondo-usuario">

          <div className="modal-usuario">

            <div className="modal-usuario-header">

              <div>

                <h2>
                  Información del mesero
                </h2>

                <p>
                  Datos generales del usuario.
                </p>

              </div>

              <button
                className="cerrar-modal-usuario"
                onClick={() =>
                  setMeseroDetalle(null)
                }
              >
                ×
              </button>

            </div>

            <div className="detalle-usuario-grid">

              <div>

                <span>
                  Nombre
                </span>

                <strong>
                  {meseroDetalle.nombre}{' '}
                  {meseroDetalle.apellidos}
                </strong>

              </div>

              <div>

                <span>
                  Estado
                </span>

                <strong>
                  {meseroDetalle.estado}
                </strong>

              </div>

              <div>

                <span>
                  Correo
                </span>

                <strong>
                  {meseroDetalle.correo}
                </strong>

              </div>

              <div>

                <span>
                  Teléfono
                </span>

                <strong>
                  {
                    meseroDetalle.telefono ||
                    'Sin registrar'
                  }
                </strong>

              </div>

              <div className="detalle-usuario-completo">

                <span>
                  Sala
                </span>

                <strong>
                  {obtenerNombreSala(
                    meseroDetalle.salaId
                  )}
                </strong>

              </div>

              <div className="detalle-usuario-completo">

                <span>
                  Eventos participados
                </span>

                <strong>
                  {
                    meseroDetalle.eventosParticipados
                  }
                </strong>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  )
}

export default AdminUsuarios