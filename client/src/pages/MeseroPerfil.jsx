import { useEffect, useState } from 'react'
import { API_URL, apiFetch } from '../api.js'
import './MeseroPerfil.css'

const rutaPerfil = `${API_URL}/meseros/mi-perfil`
const campos = [
  ['nombre', 'Nombre', 'text', 'given-name'],
  ['apellidos', 'Apellidos', 'text', 'family-name'],
  ['correo', 'Correo', 'email', 'email'],
  ['telefono', 'Teléfono', 'tel', 'tel']
]

async function leerRespuesta(respuesta) {
  const datos = await respuesta.json()
  if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo completar la operación.')
  return datos
}

export default function MeseroPerfil() {
  const [perfil, setPerfil] = useState(null)
  const [edicion, setEdicion] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    const controlador = new AbortController()
    apiFetch(rutaPerfil, { signal: controlador.signal })
      .then(leerRespuesta)
      .then(setPerfil)
      .catch((error) => {
        if (!controlador.signal.aborted) setError(error.message)
      })
    return () => controlador.abort()
  }, [])

  function editar() {
    setGuardado(false)
    setEdicion(Object.fromEntries(campos.map(([campo]) => [campo, perfil[campo] ?? ''])))
  }

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setGuardando(true)
    try {
      const respuesta = await apiFetch(rutaPerfil, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edicion)
      })
      setPerfil(await leerRespuesta(respuesta))
      setEdicion(null)
      setGuardado(true)
    } catch (error) {
      setError(error.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mesero-pagina mesero-mi-perfil">
      <div className="mesero-titulo"><h1>Mi perfil</h1></div>
      {error && <p role="alert">{error}</p>}
      {guardado && <p role="status">Cambios guardados</p>}
      {!perfil && !error && <p role="status">Cargando perfil…</p>}
      {perfil && (
        <>
          <h2>Datos personales</h2>
          {edicion ? (
            <form onSubmit={guardar}>
              <fieldset className="mesero-perfil" disabled={guardando}>
                {campos.map(([campo, etiqueta, tipo, autocompletar]) => (
                  <label key={campo}>
                    <span>{etiqueta}</span>
                    <input type={tipo} value={edicion[campo]} required autoComplete={autocompletar}
                      onChange={(evento) => setEdicion({ ...edicion, [campo]: evento.target.value })} />
                  </label>
                ))}
              </fieldset>
              <div className="mesero-perfil-acciones">
                <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
                <button type="button" disabled={guardando} onClick={() => {
                  setEdicion(null)
                  setError('')
                }}>Cancelar</button>
              </div>
            </form>
          ) : (
            <>
              <div className="mesero-perfil">
                {campos.map(([campo, etiqueta]) => (
                  <div key={campo}><span>{etiqueta}</span><strong>{perfil[campo] || 'Sin registrar'}</strong></div>
                ))}
              </div>
              <div className="mesero-perfil-acciones"><button type="button" onClick={editar}>Editar perfil</button></div>
            </>
          )}
          <h2>Información adicional</h2>
          <div className="mesero-perfil">
            <div><span>Rol de cuenta</span><strong>{perfil.rol}</strong></div>
            <div><span>Sala</span><strong>{perfil.sala ?? 'Sin sala'}</strong></div>
            <div><span>Eventos participados</span><strong>{perfil.eventosParticipados}</strong></div>
            <div><span>Estado</span><strong>{perfil.estado}</strong></div>
            <div><span>Eventos como capitán</span><strong>{perfil.eventosComoCapitan}</strong></div>
          </div>
        </>
      )}
    </div>
  )
}
