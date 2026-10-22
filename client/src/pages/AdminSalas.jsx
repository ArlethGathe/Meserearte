import { useState } from 'react'
import './AdminSalas.css'
import { useMesereArte } from '../context/MesereArteContexto.jsx'

function AdminSalas() {
  const {
  salas,
  setSalas,
  meseros
} = useMesereArte()

  const [salaSeleccionada, setSalaSeleccionada] = useState(1)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editando, setEditando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const [nuevaSala, setNuevaSala] = useState({
    nombre: '',
    descripcion: ''
  })

  const salaActual = salas.find(
    (sala) => sala.id === salaSeleccionada
  )

  const generarCodigoUnico = () => {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

    let codigo
    let existe

    do {
      codigo = 'MESA'

      for (let i = 0; i < 4; i++) {
        codigo += caracteres.charAt(
          Math.floor(Math.random() * caracteres.length)
        )
      }

      existe = salas.some(
        (sala) => sala.codigo === codigo
      )
    } while (existe)

    return codigo
  }

  const manejarCambioNuevaSala = (e) => {
    const { name, value } = e.target

    setNuevaSala({
      ...nuevaSala,
      [name]: value
    })
  }

  const crearSala = (e) => {
    e.preventDefault()

    const sala = {
      id: Date.now(),
      nombre: nuevaSala.nombre.trim(),
      descripcion: nuevaSala.descripcion.trim(),
      codigo: generarCodigoUnico(),
      administrador: 'Arleth Gathe',
      meseros: 0,
      estado: 'Activa'
    }

    setSalas([...salas, sala])
    setSalaSeleccionada(sala.id)

    setNuevaSala({
      nombre: '',
      descripcion: ''
    })

    setMostrarFormulario(false)

    setMensaje(
      `Sala creada correctamente. Código generado: ${sala.codigo}`
    )
  }

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(
        salaActual.codigo
      )

      setMensaje('Código copiado al portapapeles.')
    } catch {
      setMensaje(
        `Código de sala: ${salaActual.codigo}`
      )
    }
  }

  const guardarCambios = (e) => {
    e.preventDefault()

    const formulario = new FormData(e.target)

    const nombre = formulario.get('nombre')
    const descripcion = formulario.get('descripcion')

    setSalas(
      salas.map((sala) =>
        sala.id === salaActual.id
          ? {
              ...sala,
              nombre: nombre.trim(),
              descripcion: descripcion.trim()
            }
          : sala
      )
    )

    setEditando(false)
    setMensaje('Información de la sala actualizada.')
  }

  return (
    <div className="salas-pagina">

      <div className="salas-encabezado">

        <div>
          <h1>Gestión de salas</h1>

          <p>
            Crea salas y consulta sus códigos de acceso.
          </p>
        </div>

        <button
          className="nueva-sala"
          onClick={() => setMostrarFormulario(true)}
        >
          + Nueva sala
        </button>

      </div>

      {mensaje && (

        <div className="mensaje-sala">

          <span>{mensaje}</span>

          <button
            onClick={() => setMensaje('')}
          >
            ×
          </button>

        </div>

      )}

      <div className="salas-layout">

        <section className="lista-salas">

          <h2>Mis salas</h2>

          {salas.map((sala) => (

            <button
              key={sala.id}
              className={
                salaSeleccionada === sala.id
                  ? 'tarjeta-sala seleccionada'
                  : 'tarjeta-sala'
              }
              onClick={() =>
                setSalaSeleccionada(sala.id)
              }
            >

              <div>
                <strong>{sala.nombre}</strong>

                <span>
                  {sala.meseros} meseros
                </span>
              </div>

              <span className="mini-estado">
                {sala.estado}
              </span>

            </button>

          ))}

        </section>

        {salaActual && (

          <section className="sala-principal">

            <div className="sala-titulo">

              <div>

                <span className="etiqueta-sala">
                  Sala activa
                </span>

                <h2>
                  {salaActual.nombre}
                </h2>

                <p>
                  {salaActual.descripcion ||
                    'Sin descripción'}
                </p>

              </div>

              <div className="acciones-sala">

                <span className="estado-sala">
                  {salaActual.estado}
                </span>

                <button
                  className="editar-sala"
                  onClick={() => setEditando(true)}
                >
                  Editar
                </button>

              </div>

            </div>

            <div className="sala-datos">

              <div className="dato-sala">

                <span>Administrador</span>

                <strong>
                  {salaActual.administrador}
                </strong>

              </div>

              <div className="dato-sala">

                <span>Meseros registrados</span>

                <strong>
                  {meseros.filter(
                     (mesero) => mesero.salaId === salaActual.id
                   ).length}
                </strong>

              </div>

            </div>

            <div className="codigo-contenedor">

              <div>

                <span className="codigo-titulo">
                  Código de acceso
                </span>

                <p>
                  Este código fue generado al crear la sala
                  y permanece asociado a ella.
                </p>

              </div>

              <div className="codigo-sala">
                {salaActual.codigo}
              </div>

              <div className="codigo-botones">

                <button
                  className="copiar-codigo"
                  onClick={copiarCodigo}
                >
                  Copiar código
                </button>

              </div>

            </div>

          </section>

        )}

      </div>

      <section className="sala-informacion">

        <h2>¿Cómo funciona?</h2>

        <div className="pasos-sala">

          <div>

            <strong>1</strong>

            <p>
              El administrador crea una sala y el sistema
              genera automáticamente un código único.
            </p>

          </div>

          <div>

            <strong>2</strong>

            <p>
              El administrador comparte el código con los
              meseros que desea incorporar.
            </p>

          </div>

          <div>

            <strong>3</strong>

            <p>
              El mesero ingresa el código durante su
              registro y queda vinculado a la sala.
            </p>

          </div>

        </div>

      </section>

      {/* NUEVA SALA */}

      {mostrarFormulario && (

        <div className="modal-fondo-sala">

          <div className="modal-sala">

            <div className="modal-sala-header">

              <div>
                <h2>Nueva sala</h2>

                <p>
                  Registra los datos de la nueva sala.
                </p>
              </div>

              <button
                className="cerrar-modal-sala"
                onClick={() =>
                  setMostrarFormulario(false)
                }
              >
                ×
              </button>

            </div>

            <form onSubmit={crearSala}>

              <label>
                Nombre de la sala
              </label>

              <input
                type="text"
                name="nombre"
                value={nuevaSala.nombre}
                onChange={manejarCambioNuevaSala}
                placeholder="Ej. Salón El Triunfo"
                required
              />

              <label>
                Descripción
              </label>

              <textarea
                name="descripcion"
                value={nuevaSala.descripcion}
                onChange={manejarCambioNuevaSala}
                placeholder="Descripción de la sala o equipo"
                rows="4"
              />

              <div className="aviso-codigo">

                El código de acceso se generará
                automáticamente al crear la sala.

              </div>

              <div className="modal-sala-botones">

                <button
                  type="button"
                  className="cancelar-sala"
                  onClick={() =>
                    setMostrarFormulario(false)
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="crear-sala"
                >
                  Crear sala
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* EDITAR SALA */}

      {editando && salaActual && (

        <div className="modal-fondo-sala">

          <div className="modal-sala">

            <div className="modal-sala-header">

              <div>
                <h2>Editar sala</h2>

                <p>
                  Modifica los datos generales de la sala.
                </p>
              </div>

              <button
                className="cerrar-modal-sala"
                onClick={() => setEditando(false)}
              >
                ×
              </button>

            </div>

            <form onSubmit={guardarCambios}>

              <label>
                Nombre de la sala
              </label>

              <input
                type="text"
                name="nombre"
                defaultValue={salaActual.nombre}
                required
              />

              <label>
                Descripción
              </label>

              <textarea
                name="descripcion"
                defaultValue={salaActual.descripcion}
                rows="4"
              />

              <div className="codigo-no-editable">

                <span>
                  Código de acceso
                </span>

                <strong>
                  {salaActual.codigo}
                </strong>

                <p>
                  El código no puede modificarse porque
                  pertenece a esta sala.
                </p>

              </div>

              <div className="modal-sala-botones">

                <button
                  type="button"
                  className="cancelar-sala"
                  onClick={() => setEditando(false)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="crear-sala"
                >
                  Guardar cambios
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  )
}

export default AdminSalas