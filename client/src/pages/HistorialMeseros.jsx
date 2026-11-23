import { useEffect, useState } from 'react'
import { API_URL, apiFetch } from '../api.js'

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

export default function HistorialMeseros({ meseros }) {
  const [busqueda, setBusqueda] = useState('')
  const [meseroId, setMeseroId] = useState('')
  const [resultado, setResultado] = useState(null)
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
              {nombreCompleto(mesero)}{mesero.correo ? ' · ' + mesero.correo : ''}
            </option>)}
          </select>
        </label>
      </div>

      {!opciones.length && <p className="reportes-vacio">No hay meseros que coincidan con la búsqueda.</p>}
      {meseroId && !actual && <p className="reportes-vacio" role="status">Cargando historial…</p>}
      {actual?.error && <p className="reportes-error" role="alert">{actual.error}</p>}

      {datos && <>
        <h2>{nombreCompleto(datos.mesero)}</h2>
        <div className="reportes-resumen">
          {indicadores.map(([campo, etiqueta]) => <div key={campo}>
            <span>{etiqueta}</span>
            <strong>{datos.resumen[campo] ?? 'Sin evaluación'}</strong>
          </div>)}
        </div>
        {datos.historial.length === 0 ? (
          <p className="reportes-vacio">Este mesero aún no tiene eventos asignados.</p>
        ) : (
          <div className="tabla-reportes-responsive">
            <table className="tabla-historial-reportes">
              <caption>Participación por evento</caption>
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
                  <td>{evento.rol}</td>
                  <td>{evento.asistencia}</td>
                  <td>{evento.desempeno ?? 'Sin evaluación'}</td>
                  <td>{evento.puntualidad ?? 'Sin evaluación'}</td>
                  <td>{evento.actitud ?? 'Sin evaluación'}</td>
                  <td>{evento.evaluacionRegistrada ? (evento.incidencia ? 'Sí' : 'No') : 'Sin evaluación'}</td>
                  <td>{evento.observacion ? <details><summary>Ver observación</summary>{evento.observacion}</details> : '—'}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </>}
    </section>
  )
}
