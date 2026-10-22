import { useState } from 'react'
import './AdminReportes.css'

const reporteVacio = {
  tipo: 'Evento',
  evento: '',
  mesero: '',
  fecha: '',
  descripcion: ''
}

function AdminReportes() {
  const [vista, setVista] = useState('reportes')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [detalleReporte, setDetalleReporte] = useState(null)

  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('Todos')

  const [formulario, setFormulario] = useState(reporteVacio)

  const eventos = [
    'Boda Hernández & Ruiz',
    'XV años Valentina',
    'Graduación ESCOM'
  ]

  const meseros = [
    'María López',
    'Juan Pérez',
    'Ana Torres',
    'Carlos Ramírez'
  ]

  const [reportes, setReportes] = useState([
    {
      id: 1,
      tipo: 'Evento',
      nombre: 'Reporte Boda Hernández & Ruiz',
      evento: 'Boda Hernández & Ruiz',
      mesero: '',
      fecha: '2026-10-20',
      descripcion:
        'Evento realizado correctamente. Se registraron 12 meseros y una incidencia menor.',
      autor: 'Administrador'
    },
    {
      id: 2,
      tipo: 'Mesero',
      nombre: 'Reporte María López',
      evento: 'Boda Hernández & Ruiz',
      mesero: 'María López',
      fecha: '2026-10-20',
      descripcion:
        'Asistencia puntual y desempeño satisfactorio durante el evento.',
      autor: 'Administrador'
    }
  ])

  const historiales = [
    {
      id: 1,
      mesero: 'María López',
      eventos: 15,
      comoMesero: 12,
      comoCapitan: 3,
      asistencias: 14,
      retardos: 1,
      inasistencias: 0,
      incidencias: 1,
      observacion:
        'Buen desempeño general y experiencia como capitán.'
    },
    {
      id: 2,
      mesero: 'Juan Pérez',
      eventos: 8,
      comoMesero: 8,
      comoCapitan: 0,
      asistencias: 7,
      retardos: 0,
      inasistencias: 1,
      incidencias: 0,
      observacion:
        'Buen desempeño general.'
    },
    {
      id: 3,
      mesero: 'Ana Torres',
      eventos: 11,
      comoMesero: 9,
      comoCapitan: 2,
      asistencias: 11,
      retardos: 0,
      inasistencias: 0,
      incidencias: 0,
      observacion:
        'Participación constante.'
    }
  ]

  const [historialDetalle, setHistorialDetalle] = useState(null)

  const manejarCambio = (e) => {
    const { name, value } = e.target

    setFormulario({
      ...formulario,
      [name]: value
    })
  }

  const crearReporte = (e) => {
    e.preventDefault()

    const nombre =
      formulario.tipo === 'Evento'
        ? `Reporte ${formulario.evento}`
        : `Reporte ${formulario.mesero}`

    const nuevoReporte = {
      id: Date.now(),
      tipo: formulario.tipo,
      nombre,
      evento: formulario.evento,
      mesero: formulario.mesero,
      fecha: formulario.fecha,
      descripcion: formulario.descripcion,
      autor: 'Administrador'
    }

    setReportes([
      nuevoReporte,
      ...reportes
    ])

    setFormulario(reporteVacio)
    setMostrarFormulario(false)
  }

  const formatearFecha = (fecha) => {
    if (!fecha) return ''

    const partes = fecha.split('-')

    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }

  const reportesFiltrados = reportes.filter((reporte) => {
    const texto = busqueda.toLowerCase()

    const coincideBusqueda =
      reporte.nombre.toLowerCase().includes(texto) ||
      reporte.evento.toLowerCase().includes(texto) ||
      reporte.mesero.toLowerCase().includes(texto)

    const coincideTipo =
      filtroTipo === 'Todos' ||
      reporte.tipo === filtroTipo

    return coincideBusqueda && coincideTipo
  })

  return (
    <div className="reportes-pagina">

      <div className="reportes-encabezado">

        <div>
          <h1>Reportes e historiales</h1>

          <p>
            Consulta reportes de eventos y el historial
            de participación de los meseros.
          </p>
        </div>

        {vista === 'reportes' && (
          <button
            className="nuevo-reporte"
            onClick={() => setMostrarFormulario(true)}
          >
            + Crear reporte
          </button>
        )}

      </div>

      <div className="selector-reportes">

        <button
          className={
            vista === 'reportes'
              ? 'selector-activo'
              : ''
          }
          onClick={() => setVista('reportes')}
        >
          Reportes
        </button>

        <button
          className={
            vista === 'historial'
              ? 'selector-activo'
              : ''
          }
          onClick={() => setVista('historial')}
        >
          Historial de meseros
        </button>

      </div>

      {vista === 'reportes' ? (

        <section className="reportes-contenedor">

          <div className="filtros-reportes">

            <input
              type="text"
              placeholder="Buscar por nombre, evento o mesero..."
              value={busqueda}
              onChange={(e) =>
                setBusqueda(e.target.value)
              }
            />

            <select
              value={filtroTipo}
              onChange={(e) =>
                setFiltroTipo(e.target.value)
              }
            >
              <option value="Todos">
                Todos los tipos
              </option>

              <option value="Evento">
                Evento
              </option>

              <option value="Mesero">
                Mesero
              </option>

            </select>

          </div>

          <div className="tabla-responsive">

            <table className="tabla-reportes">

              <thead>

                <tr>
                  <th>Tipo</th>
                  <th>Reporte</th>
                  <th>Fecha</th>
                  <th>Autor</th>
                  <th>Acción</th>
                </tr>

              </thead>

              <tbody>

                {reportesFiltrados.map((reporte) => (

                  <tr key={reporte.id}>

                    <td>

                      <span
                        className={`tipo-reporte ${reporte.tipo.toLowerCase()}`}
                      >
                        {reporte.tipo}
                      </span>

                    </td>

                    <td>

                      <strong>
                        {reporte.nombre}
                      </strong>

                      <span className="reporte-secundario">
                        {reporte.tipo === 'Evento'
                          ? reporte.evento
                          : reporte.mesero}
                      </span>

                    </td>

                    <td>
                      {formatearFecha(reporte.fecha)}
                    </td>

                    <td>
                      {reporte.autor}
                    </td>

                    <td>

                      <button
                        className="ver-reporte"
                        onClick={() =>
                          setDetalleReporte(reporte)
                        }
                      >
                        Ver
                      </button>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </section>

      ) : (

        <section className="reportes-contenedor">

          <div className="historial-cards">

            {historiales.map((historial) => (

              <div
                className="historial-card"
                key={historial.id}
              >

                <div>

                  <h3>
                    {historial.mesero}
                  </h3>

                  <p>
                    {historial.eventos} eventos participados
                  </p>

                </div>

                <div className="historial-resumen">

                  <span>
                    Asistencias
                    <strong>
                      {historial.asistencias}
                    </strong>
                  </span>

                  <span>
                    Retardos
                    <strong>
                      {historial.retardos}
                    </strong>
                  </span>

                  <span>
                    Inasistencias
                    <strong>
                      {historial.inasistencias}
                    </strong>
                  </span>

                </div>

                <button
                  onClick={() =>
                    setHistorialDetalle(historial)
                  }
                >
                  Ver historial
                </button>

              </div>

            ))}

          </div>

        </section>

      )}

      {/* CREAR REPORTE */}

      {mostrarFormulario && (

        <div className="modal-fondo-reporte">

          <div className="modal-reporte">

            <div className="modal-reporte-header">

              <div>

                <h2>Crear reporte</h2>

                <p>
                  Registra la información del reporte.
                </p>

              </div>

              <button
                className="cerrar-modal-reporte"
                onClick={() =>
                  setMostrarFormulario(false)
                }
              >
                ×
              </button>

            </div>

            <form onSubmit={crearReporte}>

              <label>
                Tipo de reporte
              </label>

              <select
                name="tipo"
                value={formulario.tipo}
                onChange={manejarCambio}
              >
                <option value="Evento">
                  Reporte de evento
                </option>

                <option value="Mesero">
                  Reporte de mesero
                </option>
              </select>

              <label>
                Evento relacionado
              </label>

              <select
                name="evento"
                value={formulario.evento}
                onChange={manejarCambio}
                required
              >

                <option value="">
                  Selecciona un evento
                </option>

                {eventos.map((evento) => (

                  <option
                    key={evento}
                    value={evento}
                  >
                    {evento}
                  </option>

                ))}

              </select>

              {formulario.tipo === 'Mesero' && (
                <>
                  <label>
                    Mesero
                  </label>

                  <select
                    name="mesero"
                    value={formulario.mesero}
                    onChange={manejarCambio}
                    required
                  >

                    <option value="">
                      Selecciona un mesero
                    </option>

                    {meseros.map((mesero) => (

                      <option
                        key={mesero}
                        value={mesero}
                      >
                        {mesero}
                      </option>

                    ))}

                  </select>
                </>
              )}

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

              <label>
                Descripción / observaciones
              </label>

              <textarea
                name="descripcion"
                value={formulario.descripcion}
                onChange={manejarCambio}
                rows="5"
                placeholder="Registra incidencias, observaciones o información del seguimiento..."
                required
              />

              <div className="modal-reporte-botones">

                <button
                  type="button"
                  className="cancelar-reporte"
                  onClick={() =>
                    setMostrarFormulario(false)
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="guardar-reporte"
                >
                  Crear reporte
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* DETALLE REPORTE */}

      {detalleReporte && (

        <div className="modal-fondo-reporte">

          <div className="modal-reporte">

            <div className="modal-reporte-header">

              <div>
                <h2>
                  {detalleReporte.nombre}
                </h2>

                <p>
                  Información completa del reporte.
                </p>
              </div>

              <button
                className="cerrar-modal-reporte"
                onClick={() =>
                  setDetalleReporte(null)
                }
              >
                ×
              </button>

            </div>

            <div className="detalle-reporte-grid">

              <div>
                <span>Tipo</span>
                <strong>
                  {detalleReporte.tipo}
                </strong>
              </div>

              <div>
                <span>Fecha</span>
                <strong>
                  {formatearFecha(
                    detalleReporte.fecha
                  )}
                </strong>
              </div>

              <div>
                <span>Evento</span>
                <strong>
                  {detalleReporte.evento}
                </strong>
              </div>

              <div>
                <span>Autor</span>
                <strong>
                  {detalleReporte.autor}
                </strong>
              </div>

              {detalleReporte.mesero && (

                <div className="detalle-reporte-completo">

                  <span>Mesero</span>

                  <strong>
                    {detalleReporte.mesero}
                  </strong>

                </div>

              )}

              <div className="detalle-reporte-completo">

                <span>
                  Descripción / observaciones
                </span>

                <p>
                  {detalleReporte.descripcion}
                </p>

              </div>

            </div>

          </div>

        </div>

      )}

      {/* HISTORIAL DEL MESERO */}

      {historialDetalle && (

        <div className="modal-fondo-reporte">

          <div className="modal-reporte">

            <div className="modal-reporte-header">

              <div>

                <h2>
                  Historial de {historialDetalle.mesero}
                </h2>

                <p>
                  Participación y cumplimiento registrado.
                </p>

              </div>

              <button
                className="cerrar-modal-reporte"
                onClick={() =>
                  setHistorialDetalle(null)
                }
              >
                ×
              </button>

            </div>

            <div className="detalle-reporte-grid">

              <div>
                <span>
                  Eventos participados
                </span>

                <strong>
                  {historialDetalle.eventos}
                </strong>
              </div>

              <div>
                <span>
                  Como mesero
                </span>

                <strong>
                  {historialDetalle.comoMesero}
                </strong>
              </div>

              <div>
                <span>
                  Como capitán
                </span>

                <strong>
                  {historialDetalle.comoCapitan}
                </strong>
              </div>

              <div>
                <span>Asistencias</span>

                <strong>
                  {historialDetalle.asistencias}
                </strong>
              </div>

              <div>
                <span>Retardos</span>

                <strong>
                  {historialDetalle.retardos}
                </strong>
              </div>

              <div>
                <span>Inasistencias</span>

                <strong>
                  {historialDetalle.inasistencias}
                </strong>
              </div>

              <div>
                <span>Incidencias</span>

                <strong>
                  {historialDetalle.incidencias}
                </strong>
              </div>

              <div className="detalle-reporte-completo">

                <span>Observaciones</span>

                <p>
                  {historialDetalle.observacion}
                </p>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  )
}

export default AdminReportes