import { useState } from 'react'

import './MeseroNotificaciones.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

import { API_URL, apiFetch } from '../api.js'

function MeseroNotificaciones({
  notificaciones,
  cargando,
  errorConsulta,
  cargarNotificaciones,
  onLeida
}) {
  const { eventos } = useMesereArte()
  const [errorLectura, setErrorLectura] = useState('')
  const error = errorLectura || errorConsulta

  /* ========================================
     MARCAR COMO LEÍDA
  ======================================== */

  const marcarComoLeida =
    async (id) => {
      try {
        setErrorLectura('')

        const respuesta =
          await apiFetch(
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
            resultado.mensaje ||
            'No fue posible marcar la notificación como leída.'
          )
        }

        onLeida(id)

      } catch (error) {
        setErrorLectura(
          error.message
        )
      }
    }

  /* ========================================
     UTILIDADES
  ======================================== */

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
          Number(eventoId)
      )
    }

  const noLeidas =
    notificaciones.filter(
      (item) =>
        !item.leida
    ).length

  /* ========================================
     COMPONENTE
  ======================================== */

  return (
    <div className="mesero-notificaciones notificaciones-pagina">

      <div className="mesero-notificaciones-header notificaciones-encabezado">

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
          className="actualizar-notificaciones"
          onClick={() => {
            setErrorLectura('')
            cargarNotificaciones()
          }}
        >
          Actualizar
        </button>

      </div>

      {error && (

        <div className="notificaciones-error">

          {error}

        </div>

      )}

      <div className="mesero-notificaciones-resumen notificaciones-resumen">

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
            {
              noLeidas
            }
          </strong>

        </div>

      </div>

      <div className="mesero-notificaciones-lista notificaciones-lista">

        {cargando ? (

          <div className="notificaciones-vacio">

            Cargando notificaciones...

          </div>

        ) : notificaciones.length ===
          0 ? (

          <div className="notificaciones-vacio">

            No tienes notificaciones.

          </div>

        ) : (

          notificaciones.map(
            (notificacion) => {
              const evento =
                obtenerEvento(
                  notificacion
                    .eventoId
                )

              return (

                <div
                  key={
                    notificacion.id
                  }
                  className={
                    `mesero-notificacion-card notificacion-card ${
                      notificacion.leida
                        ? 'leida'
                        : 'nueva'
                    }`
                  }
                >

                  <div className="notificacion-superior">

                    <div>

                      <span className="notificacion-tipo">

                        {
                          notificacion.tipo ||
                          'Aviso'
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

                  {evento && (

                    <div className="notificacion-evento-relacionado">

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

                  <div className="notificacion-pie">

                    <span>
                      Enviado por:{' '}

                      <strong>
                        {
                          notificacion.emisor ||
                          'Administrador'
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

                </div>

              )
            }
          )

        )}

      </div>

    </div>
  )
}

export default MeseroNotificaciones
