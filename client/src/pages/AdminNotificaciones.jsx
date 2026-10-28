import {
  useEffect,
  useState
} from 'react'

import './AdminNotificaciones.css'

const API_URL =
  'http://localhost:3001/api'

function AdminNotificaciones({
  usuario
}) {
  const [
    notificaciones,
    setNotificaciones
  ] = useState([])

  const [
    cargando,
    setCargando
  ] = useState(true)

  const [error, setError] =
    useState('')

  const cargarNotificaciones =
    async () => {
      if (!usuario) return

      try {
        setCargando(true)
        setError('')

        const respuesta =
          await fetch(
            `${API_URL}/notificaciones?salaId=${usuario.salaId}&destinatario=Administrador`
          )

        const resultado =
          await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(
            resultado.mensaje ||
            'No se pudieron cargar las notificaciones.'
          )
        }

        setNotificaciones(
          resultado
        )

      } catch (error) {
        setError(
          error.message
        )
      } finally {
        setCargando(false)
      }
    }

  useEffect(() => {
    cargarNotificaciones()

    const intervalo =
      setInterval(
        cargarNotificaciones,
        5000
      )

    return () =>
      clearInterval(
        intervalo
      )
  }, [usuario])

  const marcarComoLeida =
    async (id) => {
      try {
        const respuesta =
          await fetch(
            `${API_URL}/notificaciones/${id}/leida`,
            {
              method: 'PUT'
            }
          )

        const resultado =
          await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(
            resultado.mensaje
          )
        }

        setNotificaciones(
          (anteriores) =>
            anteriores.map(
              (item) =>
                item.id === id
                  ? resultado
                  : item
            )
        )

      } catch (error) {
        setError(
          error.message
        )
      }
    }

  const formatearFecha = (
    fecha
  ) => {
    if (!fecha) return ''

    return new Date(
      fecha
    ).toLocaleString(
      'es-MX',
      {
        dateStyle:
          'short',

        timeStyle:
          'short'
      }
    )
  }

  const noLeidas =
    notificaciones.filter(
      (item) =>
        !item.leida
    ).length

  return (
    <div className="notificaciones-pagina">

      <div className="notificaciones-encabezado">

        <div>

          <h1>
            Notificaciones
          </h1>

          <p>
            Avisos relacionados con
            el personal y los eventos
            de tu sala.
          </p>

        </div>

        <button
          className="actualizar-notificaciones"
          onClick={
            cargarNotificaciones
          }
        >
          Actualizar
        </button>

      </div>

      <div className="notificaciones-resumen">

        <div>

          <span>
            Total
          </span>

          <strong>
            {
              notificaciones.length
            }
          </strong>

        </div>

        <div>

          <span>
            Sin leer
          </span>

          <strong>
            {noLeidas}
          </strong>

        </div>

      </div>

      {error && (

        <div className="notificaciones-error">

          {error}

        </div>

      )}

      {cargando ? (

        <div className="notificaciones-vacio">
          Cargando notificaciones...
        </div>

      ) : notificaciones.length ===
        0 ? (

        <div className="notificaciones-vacio">

          No tienes notificaciones
          pendientes.

        </div>

      ) : (

        <div className="notificaciones-lista">

          {notificaciones.map(
            (notificacion) => (

              <div
                key={
                  notificacion.id
                }
                className={
                  notificacion.leida
                    ? 'notificacion-card leida'
                    : 'notificacion-card nueva'
                }
              >

                <div className="notificacion-superior">

                  <div>

                    <span className="notificacion-tipo">
                      {
                        notificacion.tipo
                      }
                    </span>

                    {!notificacion.leida && (

                      <span className="notificacion-nueva">
                        Nueva
                      </span>

                    )}

                  </div>

                  <span className="notificacion-fecha">

                    {formatearFecha(
                      notificacion.fecha
                    )}

                  </span>

                </div>

                <h2>
                  {
                    notificacion.titulo
                  }
                </h2>

                <p>
                  {
                    notificacion.mensaje
                  }
                </p>

                <div className="notificacion-pie">

                  <span>
                    Generada por:{' '}
                    <strong>
                      {
                        notificacion.emisor
                      }
                    </strong>
                  </span>

                  {!notificacion.leida && (

                    <button
                      onClick={() =>
                        marcarComoLeida(
                          notificacion.id
                        )
                      }
                    >
                      Marcar como leída
                    </button>

                  )}

                </div>

              </div>

            )
          )}

        </div>

      )}

    </div>
  )
}

export default AdminNotificaciones