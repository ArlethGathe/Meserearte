import { useEffect, useRef, useState } from 'react'
import { API_URL, apiFetch } from '../api.js'
import './HistorialMeseros.css'

const indicadores = [
  ['eventosParticipados', 'Eventos asignados'],
  ['comoCapitan', 'Como capitán'],
  ['comoMesero', 'Como mesero'],
  ['asistencias', 'Asistencias totales'],
  ['presentes', 'Presentes'],
  ['retardos', 'Retardos'],
  ['ausentes', 'Ausencias'],
  ['sinRegistrar', 'Sin registrar'],
  ['incidencias', 'Incidencias individuales'],
  ['promedioDesempeno', 'Promedio de desempeño'],
  ['promedioPuntualidad', 'Promedio de puntualidad'],
  ['promedioActitud', 'Promedio de actitud'],
]

const fechaCorta = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' })
const nombreCompleto = (mesero) => [mesero.nombre, mesero.apellidos].filter(Boolean).join(' ')
const estilosEstado = {
  Capitán: 'capitan',
  Mesero: 'mesero',
  Presente: 'presente',
  Retardo: 'retardo',
  Ausente: 'ausente',
  'Sin registrar': 'sin-registrar',
}

export default function HistorialMeseros({ meseros }) {
  const [busqueda, setBusqueda] = useState('')
  const [meseroId, setMeseroId] = useState('')
  const [resultado, setResultado] = useState(null)
  const [observacion, setObservacion] = useState(null)
  const dialogo = useRef(null)
  const termino = busqueda.trim().toLocaleLowerCase('es-MX')
  const opciones = meseros.filter((mesero) =>
    [nombreCompleto(mesero), mesero.correo].join(' ').toLocaleLowerCase('es-MX').includes(termino)
  )

  useEffect(() => {
    if (!meseroId) return
    const control = new AbortController()
    async function consultar() {
      try {
        const respuesta = await apiFetch(`${API_URL}/meseros/${encodeURIComponent(meseroId)}/historial`, {
          signal: control.signal,
        })
        const datos = await respuesta.json()
        if (!respuesta.ok) throw new Error(datos.mensaje || 'No fue posible consultar el historial.')
        if (!control.signal.aborted) setResultado({ meseroId, datos })
      } catch (error) {
        if (!control.signal.aborted) setResultado({ meseroId, error: error.message })
      }
    }
    void consultar()
    return () => control.abort()
  }, [meseroId])

  useEffect(() => {
    if (observacion && !dialogo.current.open) dialogo.current.showModal()
  }, [observacion])

  const cerrarObservacion = () => {
    dialogo.current.close()
    setObservacion(null)
  }

  const actual = resultado?.meseroId === meseroId ? resultado : null
  const datos = actual?.datos
  const limpiarSeleccion = (id = '') => {
    setResultado(null)
    setMeseroId(id)
  }

  return (
    <section className="historial-meseros" aria-label="Historial de meseros">
      <div className="reportes-filtros historial-meseros-filtros">
        <label>
          Buscar mesero
          <input type="search" value={busqueda} placeholder="Nombre o correo" onChange={(event) => {
            setBusqueda(event.target.value)
            limpiarSeleccion()
          }} />
        </label>
        <label>
          Seleccionar mesero
          <select value={meseroId} onChange={(event) => limpiarSeleccion(event.target.value)}>
            <option value="">Seleccionar</option>
            {opciones.map((mesero) => <option key={mesero.id} value={mesero.id}>
              {nombreCompleto(mesero)}
            </option>)}
          </select>
        </label>
      </div>

      {!opciones.length && <p className="reportes-vacio">No hay meseros que coincidan con la búsqueda.</p>}
      {meseroId && !actual && <p className="reportes-vacio" role="status">Cargando historial…</p>}
      {actual?.error && <p className="reportes-error" role="alert">{actual.error}</p>}

      {datos && <>
        <h2 className="historial-meseros-nombre">{nombreCompleto(datos.mesero)}</h2>
        <div className="historial-meseros-resumen">
          {indicadores.map(([campo, etiqueta]) => <div key={campo}>
            <span>{etiqueta}</span>
            <strong className={datos.resumen[campo] == null ? 'historial-meseros-sin-evaluacion' : undefined}>
              {datos.resumen[campo] ?? 'Sin evaluación'}
            </strong>
          </div>)}
        </div>
        {datos.historial.length === 0 ? (
          <p className="reportes-vacio">Este mesero aún no tiene eventos asignados.</p>
        ) : (
          <section className="historial-meseros-participacion" aria-labelledby="titulo-participacion-mesero">
            <h3 id="titulo-participacion-mesero">Participación por evento</h3>
            <div className="historial-meseros-scroll" tabIndex={0} role="region" aria-labelledby="titulo-participacion-mesero">
              <table className="historial-meseros-tabla" aria-labelledby="titulo-participacion-mesero">
                <thead><tr>
                  {['Evento', 'Fecha', 'Tipo', 'Lugar', 'Rol', 'Asistencia', 'Desempeño', 'Puntualidad',
                    'Actitud', 'Incidencia', 'Observación'].map((texto) => <th key={texto} scope="col">{texto}</th>)}
                </tr></thead>
                <tbody>
                  {datos.historial.map((evento) => <tr key={evento.eventoId}>
                    <td>{evento.eventoNombre}</td>
                    <td>{fechaCorta.format(new Date(evento.fecha + 'T00:00:00Z'))}</td>
                    <td>{evento.eventoTipo || '—'}</td>
                    <td>{evento.lugar || '—'}</td>
                    <td><span className={`historial-badge historial-badge--${estilosEstado[evento.rol]}`}>{evento.rol}</span></td>
                    <td><span className={`historial-badge historial-badge--${estilosEstado[evento.asistencia]}`}>{evento.asistencia}</span></td>
                    {['desempeno', 'puntualidad', 'actitud'].map((campo) => (
                      <td key={campo} className={evento[campo] == null ? 'historial-meseros-sin-evaluacion' : 'historial-meseros-nota'}>
                        {evento[campo] ?? 'Sin evaluación'}
                      </td>
                    ))}
                    <td className={evento.evaluacionRegistrada ? undefined : 'historial-meseros-sin-evaluacion'}>
                      {evento.evaluacionRegistrada ? (evento.incidencia ? 'Sí' : 'No') : 'Sin evaluación'}
                    </td>
                    <td>{evento.observacion ? (
                      <button type="button" className="historial-observacion-enlace" onClick={() => setObservacion(evento)}>
                        Ver observación
                      </button>
                    ) : '—'}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </>}
      <dialog className="historial-observacion-modal" ref={dialogo} onCancel={(event) => {
        event.preventDefault()
        cerrarObservacion()
      }}
        aria-labelledby="titulo-observacion-mesero">
        {observacion && <>
          <header>
            <h3 id="titulo-observacion-mesero">Observación del mesero</h3>
            <button type="button" className="historial-observacion-x" aria-label="Cerrar observación"
              onClick={cerrarObservacion}>×</button>
          </header>
          <p className="historial-observacion-evento">
            <strong>{observacion.eventoNombre}</strong>
            <time dateTime={observacion.fecha}>{fechaCorta.format(new Date(observacion.fecha + 'T00:00:00Z'))}</time>
          </p>
          <p className="historial-observacion-texto">{observacion.observacion}</p>
          <footer><button type="button" onClick={cerrarObservacion}>Cerrar</button></footer>
        </>}
      </dialog>
    </section>
  )
}
