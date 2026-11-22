import { useEffect, useState } from 'react'

export default function Restablecimiento({ api, token, volver }) {
  const [valor, setValor] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [completado, setCompletado] = useState(false)

  useEffect(() => {
    if (token && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [token])

  async function enviar(event) {
    event.preventDefault()
    setEnviando(true)
    setMensaje('')
    try {
      const operacion = token ? 'confirmar' : 'solicitar'
      const respuesta = await fetch(api + '/auth/restablecimiento/' + operacion, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { token, password: valor } : { correo: valor }),
      })
      const datos = await respuesta.json()
      setMensaje(datos.mensaje)
      if (respuesta.ok) {
        setValor('')
        setCompletado(true)
      }
    } catch {
      setMensaje('No se pudo completar la solicitud. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="pagina-login">
      <section className="panel-formulario">
        <h1>{token ? 'Elige una contraseña nueva' : 'Restablecer contraseña'}</h1>
        {!completado && (
          <form onSubmit={enviar}>
            <label htmlFor="dato-restablecimiento">{token ? 'Contraseña nueva' : 'Correo electrónico'}</label>
            <input
              id="dato-restablecimiento"
              type={token ? 'password' : 'email'}
              autoComplete={token ? 'new-password' : 'email'}
              value={valor}
              onChange={(event) => setValor(event.target.value)}
              required
            />
            <button type="submit" disabled={enviando} className="boton-registro admin">
              {token ? 'Guardar contraseña' : 'Solicitar enlace'}
            </button>
          </form>
        )}
        {mensaje && <p role="status">{mensaje}</p>}
        <button type="button" className="enlace-registro" onClick={volver}>Volver al inicio de sesión</button>
      </section>
    </main>
  )
}
