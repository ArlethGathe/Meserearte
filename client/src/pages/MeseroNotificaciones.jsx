import {
  useEffect,
  useState
} from 'react'

import './MeseroNotificaciones.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

const API_URL =
  'http://localhost:3001/api'

function MeseroNotificaciones({
  usuario
}) {
  const {
    meseros,
    eventos
  } = useMesereArte()

  const [
    notificaciones,
    setNotificaciones
  ] = useState([])

  const [
    cargando,
    setCargando
  ] = useState(true)

  const [
    error,
    setError
  ] = useState('')

  const meseroActual =
    meseros.find(
      (mesero) =>
        mesero.correo
          .toLowerCase() ===
        usuario.correo
          .toLowerCase()
    )

  /* ========================================
     CARGAR
  ======================================== */

  const cargarNotificaciones =
    async () => {
      if (!meseroActual) {
        return
      }

      try {
        setCargando(true)
        setError('')

        const respuesta =
          await fetch(
            `${API_URL}/notificaciones?destinatario=Mesero&meseroId=${meseroActual.id}`
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

  useEffect(
    () => {
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
    },
    [meseroActual?.id]
  )

  /* ========================================
     LEÍDA
  ======================================== */

  const marcarComoLeida =
    async (id) => {
      try {
        const respuesta =
          await fetch(
            `${API_URL}/notificaciones/${id}/leida`,
            {
              method:
                'PUT'
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

  const formatearFecha =
    (fecha) => {
      if (!fecha) {
        return ''
      }

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

  const obtenerEvento =
    (eventoId) => {
      if (!eventoId) {
        return null
      }

      return eventos.find(
        (evento) =>
          evento.id ===
          eventoId
      )
    }

  const noLeidas =
    notificaciones.filter(
      (notificacion) =>
        !notificacion.leida
    ).length

  return (
    <div className="mesero-notificaciones">

      <div className="mesero-notificaciones-header">

        <div>

          <h1>
            Notificaciones
          </h1>

          <p>
            Consulta los avisos enviados
            por el administrador.
          </p>

        </div>

        <button
          type="button"
          onClick={
            cargarNotificaciones
          }
        >
          Actualizar
        </button>

      </div>

      <div className="mesero-notificaciones-resumen">

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

        <div className="mesero-notificacion-error">

          {error}

        </div>

      )}

      {cargando ? (

        <div className="mesero-notificacion-vacio">

          Cargando notificaciones...

        </div>

      ) : notificaciones.length ===
        0 ? (

        <div className="mesero-notificacion-vacio">

          No tienes notificaciones
          nuevas.

        </div>

      ) : (

        <div className="mesero-notificacion-lista">

          {notificaciones.map(
            (notificacion) => {
              const evento =
                obtenerEvento(
                  notificacion.eventoId
                )

              return (

                <article
                  key={
                    notificacion.id
                  }
                  className={
                    notificacion.leida
                      ? 'mesero-notificacion-card leida'
                      : 'mesero-notificacion-card nueva'
                  }
                >

                  <div className="mesero-notificacion-superior">

                    <div>

                      <span className="mesero-notificacion-tipo">
                        {
                          notificacion.tipo
                        }
                      </span>

                      {!notificacion.leida && (

                        <span className="mesero-notificacion-nueva">
                          Nueva
                        </span>

                      )}

                    </div>

                    <span className="mesero-notificacion-fecha">

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

                  {evento && (

                    <div className="mesero-notificacion-evento">

                      <span>
                        Evento relacionado
                      </span>

                      <strong>
                        {
                          evento.nombre
                        }
                      </strong>

                    </div>

                  )}

                  <div className="mesero-notificacion-pie">

                    <span>
                      Enviado por:{' '}

                      <strong>
                        {
                          notificacion.emisor
                        }
                      </strong>
                    </span>

                    {!notificacion.leida && (

                      <button
                        type="button"
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

                </article>

              )
            }
          )}

        </div>

      )}

    </div>
  )
}

export default MeseroNotificaciones