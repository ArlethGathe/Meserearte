import { useEffect, useRef, useState } from 'react'
import { API_URL, apiFetch } from '../api.js'
import './CapitanNotificaciones.css'

async function leerRespuesta(respuesta) {
  const datos = await respuesta.json()
  if (!respuesta.ok) throw new Error(datos.mensaje || 'No fue posible gestionar el aviso.')
  return datos
}

export default function CapitanNotificaciones({ eventoId }) {
  const ruta = `${API_URL}/notificaciones/eventos/${eventoId}`
  const dialogo = useRef(null)
  const borrador = useRef(null)
  const [personal, setPersonal] = useState(null)
  const [seleccion, setSeleccion] = useState([])
  const [titulo, setTitulo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controlador = new AbortController()
    apiFetch(ruta + '/destinatarios', { signal: controlador.signal })
      .then(leerRespuesta)
      .then((filas) => {
        if (!controlador.signal.aborted) setPersonal(filas)
      })
      .catch((error) => {
        if (!controlador.signal.aborted) setError(error.message)
      })
    return () => controlador.abort()
  }, [ruta])

  const todos = Boolean(personal?.length && seleccion.length === personal.length)

  function confirmar(evento) {
    evento.preventDefault()
    setConfirmado(false)
    if (!seleccion.length || !titulo.trim() || !mensaje.trim()) {
      setError('Selecciona al menos un destinatario y escribe el título y el mensaje.')
      return
    }
    setError('')
    borrador.current = { destinatarioIds: seleccion, titulo, mensaje }
    dialogo.current.showModal()
  }

  async function enviar() {
    const datos = borrador.current
    if (!datos) return
    borrador.current = null
    dialogo.current.close()
    setEnviando(true)
    try {
      const respuesta = await apiFetch(ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      })
      if (respuesta.status === 403) setPersonal(null)
      await leerRespuesta(respuesta)
      setSeleccion([])
      setTitulo('')
      setMensaje('')
      setConfirmado(true)
    } catch (error) {
      setError(error.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="capitan-evento-card capitan-avisos">
      <h2>Notificaciones del evento</h2>
      {error && <p role="alert">{error}</p>}
      {confirmado && <p role="status">Notificación enviada correctamente</p>}
      {!personal && !error && <p role="status">Consultando destinatarios…</p>}
      {personal?.length === 0 && <p>No hay meseros asignados a este evento.</p>}
      {personal?.length > 0 && (
        <form onSubmit={confirmar}>
          <fieldset disabled={enviando}>
            <legend>Destinatarios</legend>
            <label>
              <input type="checkbox" checked={todos}
                onChange={(evento) => setSeleccion(evento.target.checked ? personal.map(({ id }) => id) : [])} />
              Seleccionar todos
            </label>
            {personal.map(({ id, nombre, apellidos }) => (
              <label key={id}>
                <input type="checkbox" checked={seleccion.includes(id)}
                  onChange={(evento) => {
                    const marcado = evento.target.checked
                    setSeleccion((previos) => marcado ? [...previos, id] : previos.filter((previo) => previo !== id))
                  }} />
                {nombre} {apellidos}
              </label>
            ))}
          </fieldset>
          <label>Título
            <input type="text" value={titulo} maxLength={200} required disabled={enviando}
              onChange={(evento) => setTitulo(evento.target.value)} />
          </label>
          <label>Mensaje
            <textarea value={mensaje} required disabled={enviando} rows={4}
              onChange={(evento) => setMensaje(evento.target.value)} />
          </label>
          <button type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar notificación'}</button>
        </form>
      )}
      <dialog ref={dialogo} aria-labelledby="capitan-aviso-confirmacion">
        <h3 id="capitan-aviso-confirmacion">
          ¿Enviar esta notificación a {seleccion.length} {seleccion.length === 1 ? 'mesero' : 'meseros'}?
        </h3>
        <div className="capitan-aviso-acciones">
          <button type="button" onClick={() => dialogo.current.close()}>Cancelar</button>
          <button type="button" onClick={enviar}>Enviar</button>
        </div>
      </dialog>
    </section>
  )
}
