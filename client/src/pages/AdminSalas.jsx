import { useState } from 'react'
import './AdminSalas.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

function AdminSalas() {
  const {
    salas,
    meseros,
    crearSalaAPI,
    actualizarSalaAPI,
    eliminarSalaAPI
  } = useMesereArte()

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false)

  const [idEdicion, setIdEdicion] =
    useState(null)

  const [salaDetalle, setSalaDetalle] =
    useState(null)

  const [formulario, setFormulario] =
    useState({
      nombre: '',
      descripcion: ''
    })

  const [guardando, setGuardando] =
    useState(false)

  const cantidadMeseros = (salaId) => {
    return meseros.filter(
      (mesero) =>
        mesero.salaId === salaId
    ).length
  }

  const abrirNuevaSala = () => {
    setIdEdicion(null)

    setFormulario({
      nombre: '',
      descripcion: ''
    })

    setMostrarFormulario(true)
  }

  const abrirEdicion = (sala) => {
    setIdEdicion(sala.id)

    setFormulario({
      nombre: sala.nombre,
      descripcion:
        sala.descripcion || ''
    })

    setMostrarFormulario(true)
  }

  const cerrarFormulario = () => {
    setMostrarFormulario(false)
    setIdEdicion(null)

    setFormulario({
      nombre: '',
      descripcion: ''
    })
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

  const guardarSala = async (e) => {
    e.preventDefault()

    try {
      setGuardando(true)

      if (idEdicion) {
        await actualizarSalaAPI(
          idEdicion,
          formulario
        )
      } else {
        await crearSalaAPI({
          nombre:
            formulario.nombre,

          descripcion:
            formulario.descripcion,

          administrador:
            'Administrador'
        })
      }

      cerrarFormulario()
    } catch (error) {
      window.alert(
        error.message
      )
    } finally {
      setGuardando(false)
    }
  }

  const eliminarSala = async (sala) => {
    const confirmar =
      window.confirm(
        `¿Deseas eliminar la sala "${sala.nombre}"?`
      )

    if (!confirmar) {
      return
    }

    try {
      await eliminarSalaAPI(
        sala.id
      )

      if (
        salaDetalle?.id ===
        sala.id
      ) {
        setSalaDetalle(null)
      }
    } catch (error) {
      window.alert(
        error.message
      )
    }
  }

  const copiarCodigo = async (
    codigo
  ) => {
    try {
      await navigator.clipboard.writeText(
        codigo
      )

      window.alert(
        `Código ${codigo} copiado.`
      )
    } catch {
      window.alert(
        `Código de sala: ${codigo}`
      )
    }
  }

  return (
    <div className="salas-pagina">

      <div className="salas-encabezado">

        <div>
          <h1>
            Gestión de salas
          </h1>

          <p>
            Administra tus equipos
            de meseros y sus códigos
            de acceso.
          </p>
        </div>

        <button
          className="nueva-sala"
          onClick={abrirNuevaSala}
        >
          + Nueva sala
        </button>

      </div>

      <div className="salas-contenedor">

        {salas.map(
          (sala) => (

            <div
              className="sala-card"
              key={sala.id}
            >

              <div>

                <span className="sala-estado">
                  {sala.estado}
                </span>

                <h2>
                  {sala.nombre}
                </h2>

                <p>
                  {sala.descripcion ||
                    'Sin descripción'}
                </p>

              </div>

              <div className="sala-datos">

                <div>

                  <span>
                    Código de acceso
                  </span>

                  <strong>
                    {sala.codigo}
                  </strong>

                </div>

                <div>

                  <span>
                    Meseros registrados
                  </span>

                  <strong>
                    {cantidadMeseros(
                      sala.id
                    )}
                  </strong>

                </div>

              </div>

              <div className="sala-acciones">

                <button
                  onClick={() =>
                    setSalaDetalle(
                      sala
                    )
                  }
                >
                  Ver
                </button>

                <button
                  onClick={() =>
                    copiarCodigo(
                      sala.codigo
                    )
                  }
                >
                  Copiar código
                </button>

                <button
                  onClick={() =>
                    abrirEdicion(
                      sala
                    )
                  }
                >
                  Editar
                </button>

                <button
                  onClick={() =>
                    eliminarSala(
                      sala
                    )
                  }
                >
                  Eliminar
                </button>

              </div>

            </div>

          )
        )}

      </div>

      {mostrarFormulario && (

        <div className="modal-fondo-sala">

          <div className="modal-sala">

            <div className="modal-sala-header">

              <div>

                <h2>
                  {idEdicion
                    ? 'Editar sala'
                    : 'Nueva sala'}
                </h2>

                <p>
                  {idEdicion
                    ? 'Modifica la información de la sala.'
                    : 'El código de acceso será generado automáticamente.'}
                </p>

              </div>

              <button
                className="cerrar-modal-sala"
                onClick={
                  cerrarFormulario
                }
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                guardarSala
              }
            >

              <div>

                <label>
                  Nombre de la sala
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
                  Descripción
                </label>

                <textarea
                  name="descripcion"
                  value={
                    formulario.descripcion
                  }
                  onChange={
                    manejarCambio
                  }
                  rows="4"
                />

              </div>

              {idEdicion && (

                <div className="aviso-codigo">

                  El código de acceso
                  de la sala no puede
                  modificarse.

                </div>

              )}

              <div className="modal-sala-botones">

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
                      : 'Crear sala'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {salaDetalle && (

        <div className="modal-fondo-sala">

          <div className="modal-sala">

            <div className="modal-sala-header">

              <div>

                <h2>
                  {salaDetalle.nombre}
                </h2>

                <p>
                  Información de la sala
                </p>

              </div>

              <button
                className="cerrar-modal-sala"
                onClick={() =>
                  setSalaDetalle(
                    null
                  )
                }
              >
                ×
              </button>

            </div>

            <div>

              <p>
                <strong>
                  Descripción:
                </strong>{' '}

                {salaDetalle.descripcion ||
                  'Sin descripción'}
              </p>

              <p>
                <strong>
                  Código:
                </strong>{' '}

                {salaDetalle.codigo}
              </p>

              <p>
                <strong>
                  Meseros:
                </strong>{' '}

                {cantidadMeseros(
                  salaDetalle.id
                )}
              </p>

              <p>
                <strong>
                  Estado:
                </strong>{' '}

                {salaDetalle.estado}
              </p>

            </div>

          </div>

        </div>

      )}

    </div>
  )
}

export default AdminSalas