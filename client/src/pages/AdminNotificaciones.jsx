import { useState } from 'react'
import './AdminNotificaciones.css'

const formularioVacio = {
  tipo: '',
  titulo: '',
  mensaje: '',
  evento: '',
  destinatarios: []
}

function AdminNotificaciones() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [mensajeSistema, setMensajeSistema] = useState('')

  const [formulario, setFormulario] = useState(formularioVacio)

  const eventos = [
    {
      id: 1,
      nombre: 'Boda Hernández & Ruiz'
    },
    {
      id: 2,
      nombre: 'XV años Valentina'
    },
    {
      id: 3,
      nombre: 'Graduación ESCOM'
    }
  ]

  const meseros = [
    {
      id: 1,
      nombre: 'María López'
    },
    {
      id: 2,
      nombre: 'Juan Pérez'
    },
    {
      id: 3,
      nombre: 'Ana Torres'
    },
    {
      id: 4,
      nombre: 'Carlos Ramírez'
    }
  ]

  const [notificaciones, setNotificaciones] = useState([
    {
      id: 1,
      tipo: 'Recordatorio',
      titulo: 'Recordatorio: Boda Hernández & Ruiz',
      mensaje: 'Llegar 45 minutos antes del inicio del evento.',
      evento: 'Boda Hernández & Ruiz',
      destinatarios: [
        'María López',
        'Juan Pérez'
      ],
      fecha: '20/10/2026 18:30',
      emisor: 'Administrador'
    },
    {
      id: 2,
      tipo: 'Cambio de horario',
      titulo: 'Cambio de horario',
      mensaje: 'El evento comenzará a las 17:00 horas.',
      evento: 'XV años Valentina',
      destinatarios: [
        'Ana Torres'
      ],
      fecha: '19/10/2026 14:15',
      emisor: 'Administrador'
    },
    {
      id: 3,
      tipo: 'Uniforme',
      titulo: 'Uniforme actualizado',
      mensaje: 'Usar camisa blanca y pantalón negro.',
      evento: 'Graduación ESCOM',
      destinatarios: [
        'María López',
        'Juan Pérez',
        'Ana Torres'
      ],
      fecha: '18/10/2026 10:20',
      emisor: 'Administrador'
    }
  ])

  const manejarCambio = (e) => {
    const { name, value } = e.target

    setFormulario({
      ...formulario,
      [name]: value
    })
  }

  const seleccionarDestinatario = (id) => {
    if (formulario.destinatarios.includes(id)) {
      setFormulario({
        ...formulario,
        destinatarios: formulario.destinatarios.filter(
          (destinatarioId) => destinatarioId !== id
        )
      })
    } else {
      setFormulario({
        ...formulario,
        destinatarios: [
          ...formulario.destinatarios,
          id
        ]
      })
    }
  }

  const seleccionarTodos = () => {
    if (
      formulario.destinatarios.length ===
      meseros.length
    ) {
      setFormulario({
        ...formulario,
        destinatarios: []
      })
    } else {
      setFormulario({
        ...formulario,
        destinatarios: meseros.map(
          (mesero) => mesero.id
        )
      })
    }
  }

  const enviarNotificacion = (e) => {
    e.preventDefault()

    if (formulario.destinatarios.length === 0) {
      setMensajeSistema(
        'Selecciona al menos un destinatario.'
      )
      return
    }

    const nombresDestinatarios = meseros
      .filter((mesero) =>
        formulario.destinatarios.includes(
          mesero.id
        )
      )
      .map((mesero) => mesero.nombre)

    const eventoRelacionado = eventos.find(
      (evento) =>
        evento.id === Number(formulario.evento)
    )

    const fechaActual = new Date()

    const nuevaNotificacion = {
      id: Date.now(),
      tipo: formulario.tipo,
      titulo: formulario.titulo,
      mensaje: formulario.mensaje,
      evento: eventoRelacionado
        ? eventoRelacionado.nombre
        : 'Sin evento relacionado',
      destinatarios: nombresDestinatarios,
      fecha: fechaActual.toLocaleString('es-MX'),
      emisor: 'Administrador'
    }

    setNotificaciones([
      nuevaNotificacion,
      ...notificaciones
    ])

    setFormulario(formularioVacio)
    setMostrarFormulario(false)

    setMensajeSistema(
      'Notificación enviada correctamente.'
    )
  }

  return (
    <div className="notificaciones-pagina">

      <div className="notificaciones-encabezado">

        <div>
          <h1>Notificaciones</h1>

          <p>
            Crea, envía y consulta las notificaciones
            enviadas.
          </p>
        </div>

        <button
          className="nueva-notificacion"
          onClick={() => {
            setFormulario(formularioVacio)
            setMensajeSistema('')
            setMostrarFormulario(true)
          }}
        >
          + Crear notificación
        </button>

      </div>

      {mensajeSistema && (

        <div className="mensaje-notificacion">

          <span>
            {mensajeSistema}
          </span>

          <button
            onClick={() =>
              setMensajeSistema('')
            }
          >
            ×
          </button>

        </div>

      )}

      <section className="historial-notificaciones">

        <div className="historial-titulo">

          <div>
            <h2>Historial de notificaciones</h2>

            <p>
              Consulta las notificaciones enviadas.
            </p>
          </div>

          <span>
            {notificaciones.length} enviadas
          </span>

        </div>

        <div className="lista-notificaciones">

          {notificaciones.map((notificacion) => (

            <div
              className="tarjeta-notificacion"
              key={notificacion.id}
            >

              <div className="notificacion-principal">

                <span
                  className={`tipo-notificacion tipo-${notificacion.tipo
                    .toLowerCase()
                    .replaceAll(' ', '-')}`}
                >
                  {notificacion.tipo}
                </span>

                <h3>
                  {notificacion.titulo}
                </h3>

                <p>
                  {notificacion.mensaje}
                </p>

                <div className="notificacion-meta">

                  <span>
                    Evento: {notificacion.evento}
                  </span>

                  <span>
                    {notificacion.fecha}
                  </span>

                </div>

              </div>

              <div className="notificacion-acciones">

                <span>
                  {notificacion.destinatarios.length}{' '}
                  destinatario(s)
                </span>

                <button
                  onClick={() =>
                    setDetalle(notificacion)
                  }
                >
                  Ver
                </button>

              </div>

            </div>

          ))}

        </div>

      </section>

      {/* CREAR NOTIFICACIÓN */}

      {mostrarFormulario && (

        <div className="modal-fondo-notificacion">

          <div className="modal-notificacion">

            <div className="modal-notificacion-header">

              <div>

                <h2>
                  Crear notificación
                </h2>

                <p>
                  Redacta el mensaje y selecciona
                  los destinatarios.
                </p>

              </div>

              <button
                className="cerrar-modal-notificacion"
                onClick={() =>
                  setMostrarFormulario(false)
                }
              >
                ×
              </button>

            </div>

            <form
              onSubmit={enviarNotificacion}
            >

              <div className="notificacion-form-grid">

                <div>

                  <label>
                    Tipo de notificación
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

                    <option value="Recordatorio">
                      Recordatorio
                    </option>

                    <option value="Aviso">
                      Aviso
                    </option>

                    <option value="Cambio de horario">
                      Cambio de horario
                    </option>

                    <option value="Uniforme">
                      Uniforme
                    </option>

                    <option value="Información adicional">
                      Información adicional
                    </option>

                  </select>

                </div>

                <div>

                  <label>
                    Evento relacionado
                  </label>

                  <select
                    name="evento"
                    value={formulario.evento}
                    onChange={manejarCambio}
                  >

                    <option value="">
                      Sin evento relacionado
                    </option>

                    {eventos.map((evento) => (

                      <option
                        key={evento.id}
                        value={evento.id}
                      >
                        {evento.nombre}
                      </option>

                    ))}

                  </select>

                </div>

                <div className="notificacion-campo-completo">

                  <label>
                    Título
                  </label>

                  <input
                    type="text"
                    name="titulo"
                    value={formulario.titulo}
                    onChange={manejarCambio}
                    placeholder="Título de la notificación"
                    required
                  />

                </div>

                <div className="notificacion-campo-completo">

                  <label>
                    Mensaje
                  </label>

                  <textarea
                    name="mensaje"
                    value={formulario.mensaje}
                    onChange={manejarCambio}
                    rows="5"
                    placeholder="Escribe el mensaje..."
                    required
                  />

                </div>

              </div>

              <div className="destinatarios-seccion">

                <div className="destinatarios-header">

                  <div>

                    <h3>
                      Destinatarios
                    </h3>

                    <p>
                      Selecciona los meseros que recibirán
                      la notificación.
                    </p>

                  </div>

                  <button
                    type="button"
                    className="seleccionar-todos"
                    onClick={seleccionarTodos}
                  >
                    {formulario.destinatarios.length ===
                    meseros.length
                      ? 'Quitar todos'
                      : 'Seleccionar todos'}
                  </button>

                </div>

                <div className="lista-destinatarios">

                  {meseros.map((mesero) => (

                    <label
                      className="destinatario-item"
                      key={mesero.id}
                    >

                      <input
                        type="checkbox"
                        checked={
                          formulario.destinatarios.includes(
                            mesero.id
                          )
                        }
                        onChange={() =>
                          seleccionarDestinatario(
                            mesero.id
                          )
                        }
                      />

                      <span>
                        {mesero.nombre}
                      </span>

                    </label>

                  ))}

                </div>

              </div>

              <div className="modal-notificacion-botones">

                <button
                  type="button"
                  className="cancelar-notificacion"
                  onClick={() =>
                    setMostrarFormulario(false)
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="enviar-notificacion"
                >
                  Enviar notificación
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* DETALLE */}

      {detalle && (

        <div className="modal-fondo-notificacion">

          <div className="modal-notificacion">

            <div className="modal-notificacion-header">

              <div>
                <h2>
                  Detalles de la notificación
                </h2>

                <p>
                  Información de la notificación enviada.
                </p>
              </div>

              <button
                className="cerrar-modal-notificacion"
                onClick={() =>
                  setDetalle(null)
                }
              >
                ×
              </button>

            </div>

            <div className="detalle-notificacion">

              <div>
                <span>Tipo</span>

                <strong>
                  {detalle.tipo}
                </strong>
              </div>

              <div>
                <span>Emisor</span>

                <strong>
                  {detalle.emisor}
                </strong>
              </div>

              <div>
                <span>Fecha</span>

                <strong>
                  {detalle.fecha}
                </strong>
              </div>

              <div>
                <span>Evento</span>

                <strong>
                  {detalle.evento}
                </strong>
              </div>

              <div className="detalle-notificacion-completo">

                <span>Título</span>

                <strong>
                  {detalle.titulo}
                </strong>

              </div>

              <div className="detalle-notificacion-completo">

                <span>Mensaje</span>

                <p>
                  {detalle.mensaje}
                </p>

              </div>

              <div className="detalle-notificacion-completo">

                <span>Destinatarios</span>

                <p>
                  {detalle.destinatarios.join(', ')}
                </p>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  )
}

export default AdminNotificaciones