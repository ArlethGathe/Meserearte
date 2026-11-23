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

function AdminUsuarios({ administradorId }) {
  const {
    salas,
    meseros,
    actualizarMeseroAPI,
    eliminarMeseroAPI
  } = useMesereArte()

  const salasInvitacion = salas.filter((sala) =>
    sala.estado === 'Activa' && Number(sala.administradorId) === Number(administradorId)
  )

  const [busqueda, setBusqueda] =
    useState('')

  const [filtroSala, setFiltroSala] =
    useState('Todas')

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false)

  const [meseroDetalle, setMeseroDetalle] =
    useState(null)

  const [idEdicion, setIdEdicion] =
    useState(null)

  const [guardando, setGuardando] =
    useState(false)

  const [formulario, setFormulario] =
    useState(formularioVacio)

  const obtenerNombreSala = (salaId) => {
    const sala = salas.find(
      (sala) =>
        sala.id === Number(salaId)
    )

    return sala
      ? sala.nombre
      : 'Sin sala'
  }

  const manejarCambio = (e) => {
    const {
      name,
      value
    } = e.target

    setFormulario({
      ...formulario,
      [name]: value
    })
  }

  const abrirNuevo = () => {
    setIdEdicion(null)
    setMostrarFormulario(true)
  }

  const abrirEdicion = (mesero) => {
    setIdEdicion(mesero.id)

    setFormulario({
      nombre: mesero.nombre,
      apellidos: mesero.apellidos,
      correo: mesero.correo,
      telefono:
        mesero.telefono || '',
      salaId: mesero.salaId,
      estado: mesero.estado
    })

    setMostrarFormulario(true)
  }

  const cerrarFormulario = () => {
    setMostrarFormulario(false)
    setIdEdicion(null)

    setFormulario(
      formularioVacio
    )
  }

  const guardarMesero = async (e) => {
    e.preventDefault()

    try {
      setGuardando(true)

      const datos = {
        ...formulario,

        salaId:
          Number(
            formulario.salaId
          )
      }

      await actualizarMeseroAPI(idEdicion, datos)

      cerrarFormulario()
    } catch (error) {
      window.alert(
        error.message
      )
    } finally {
      setGuardando(false)
    }
  }

  const eliminarMesero = async (
    mesero
  ) => {
    const confirmar =
      window.confirm(
        `¿Deseas eliminar a ${mesero.nombre} ${mesero.apellidos}?`
      )

    if (!confirmar) {
      return
    }

    try {
      await eliminarMeseroAPI(
        mesero.id
      )

      if (
        meseroDetalle?.id ===
        mesero.id
      ) {
        setMeseroDetalle(null)
      }
    } catch (error) {
      window.alert(
        error.message
      )
    }
  }

  const meserosFiltrados =
    meseros.filter(
      (mesero) => {
        const texto =
          busqueda.toLowerCase()

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
          + Invitar mesero
        </button>

      </div>

      <div className="usuarios-contenedor">

        <div className="usuarios-filtros">

          <input
            type="text"
            placeholder="Buscar mesero..."
            value={busqueda}
            onChange={(e) =>
              setBusqueda(
                e.target.value
              )
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

        <div className="tabla-responsive">

          <table className="tabla-usuarios">

            <thead>
              <tr>
                <th>Mesero</th>
                <th>Sala</th>
                <th>
                  Eventos participados
                </th>
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
                        mesero.eventosParticipados ??
                        0
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
                    : 'Invitar mesero'}
                </h2>

                <p>
                  {idEdicion
                    ? 'Actualiza la información del mesero.'
                    : 'Comparte el código de una sala activa. El mesero puede elegir Registrarse como mesero y crear su cuenta con ese código.'}
                </p>

              </div>

              <button
                className="cerrar-modal-usuario"
                onClick={
                  cerrarFormulario
                }
              >
                ×
              </button>

            </div>

            {idEdicion ? <form
              onSubmit={
                guardarMesero
              }
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
                    readOnly
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

              <div className="aviso-eventos">

                  Los eventos participados
                  no pueden modificarse
                  manualmente.

              </div>

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
                  disabled={
                    guardando
                  }
                >
                  {guardando
                    ? 'Guardando...'
                    : 'Guardar cambios'}
                </button>

              </div>

            </form> : salasInvitacion.length > 0 ? (
              <ul>
                {salasInvitacion.map((sala) => (
                  <li key={sala.id}>{sala.nombre} <strong>{sala.codigo}</strong></li>
                ))}
              </ul>
            ) : <p>Crea o activa una sala para invitar meseros.</p>}

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
                  setMeseroDetalle(
                    null
                  )
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
                  {
                    meseroDetalle.apellidos
                  }
                </strong>

              </div>

              <div>

                <span>
                  Estado
                </span>

                <strong>
                  {
                    meseroDetalle.estado
                  }
                </strong>

              </div>

              <div>

                <span>
                  Correo
                </span>

                <strong>
                  {
                    meseroDetalle.correo
                  }
                </strong>

              </div>

              <div>

                <span>
                  Teléfono
                </span>

                <strong>
                  {meseroDetalle.telefono ||
                    'Sin registrar'}
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
                    meseroDetalle.eventosParticipados ??
                    0
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
