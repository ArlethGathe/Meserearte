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

  /* ========================================
     MESERO ACTUAL
  ======================================== */

  const meseroActual =
    meseros.find(
      (mesero) =>
        mesero.correo
          ?.toLowerCase() ===
        usuario.correo
          ?.toLowerCase()
    )

  /* ========================================
     CARGAR NOTIFICACIONES
  ======================================== */

  const cargarNotificaciones =
    async () => {
      if (!meseroActual?.id) {
        setNotificaciones([])
        setCargando(false)
        return
      }

      try {
        setError('')

        const respuesta =
          await fetch(
            `${API_URL}/notificaciones/mesero/${meseroActual.id}`
          )

        const datos =
          await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(
            datos.mensaje ||
            'No fue posible consultar las notificaciones.'
          )
        }

        /*
          Protección adicional:
          si por algún error existieran
          dos registros del mismo envío
          para el mismo mesero,
          solamente mostramos uno.
        */

        const claves =
          new Set()

        const unicas =
          datos.filter(
            (item) => {
              const clave =
                item.envioId
                  ? `envio-${item.envioId}`
                  : `notificacion-${item.id}`

              if (
                claves.has(
                  clave
                )
              ) {
                return false
              }

              claves.add(
                clave
              )

              return true
            }
          )

        setNotificaciones(
          unicas
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
      setCargando(true)

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
     MARCAR COMO LEÍDA
  ======================================== */

  const marcarComoLeida =
    async (id) => {
      try {
        setError('')

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
            resultado.mensaje ||
            'No fue posible marcar la notificación como leída.'
          )
        }

        setNotificaciones(
          (anteriores) =>
            anteriores.map(
              (item) =>
                item.id === id
                  ? {
                      ...item,
                      leida: true
                    }
                  : item
            )
        )

      } catch (error) {
        setError(
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
          onClick={
            cargarNotificaciones
          }
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