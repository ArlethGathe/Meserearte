import {
  useEffect,
  useState
} from 'react'

import './AdminNotificaciones.css'

import {
  useMesereArte
} from '../context/MesereArteContexto.jsx'

const API_URL =
  'http://localhost:3001/api'

function AdminNotificaciones({
  usuario
}) {
  const {
    salas,
    eventos,
    meseros
  } = useMesereArte()

  const [
    pestaña,
    setPestaña
  ] = useState('alertas')

  const [
    salaId,
    setSalaId
  ] = useState(
    String(
      usuario?.salaId ||
      ''
    )
  )

  const [
    alertas,
    setAlertas
  ] = useState([])

  const [
    historial,
    setHistorial
  ] = useState([])

  const [
    cargando,
    setCargando
  ] = useState(false)

  const [
    enviando,
    setEnviando
  ] = useState(false)

  const [
    mensajeSistema,
    setMensajeSistema
  ] = useState('')

  const [
    error,
    setError
  ] = useState('')

  const [
    formulario,
    setFormulario
  ] = useState({
    tipo:
      'Aviso',

    titulo:
      '',

    mensaje:
      '',

    modoDestinatario:
      'Todos',

    eventoId:
      '',

    meseroId:
      ''
  })

  /* ========================================
     DATOS FILTRADOS
  ======================================== */

  const salaNumero =
    Number(salaId)

  const eventosSala =
    eventos.filter(
      (evento) =>
        evento.salaId ===
        salaNumero
    )

  const meserosSala =
    meseros.filter(
      (mesero) =>
        mesero.salaId ===
          salaNumero &&
        mesero.estado ===
          'Activo'
    )

  /* ========================================
     CARGAR
  ======================================== */

  const cargarDatos =
    async () => {
      if (!salaNumero) {
        return
      }

      try {
        setCargando(true)
        setError('')

        const [
          respuestaAlertas,
          respuestaHistorial
        ] =
          await Promise.all([
            fetch(
              `${API_URL}/notificaciones?salaId=${salaNumero}&destinatario=Administrador`
            ),

            fetch(
              `${API_URL}/notificaciones/enviadas?salaId=${salaNumero}`
            )
          ])

        const datosAlertas =
          await respuestaAlertas.json()

        const datosHistorial =
          await respuestaHistorial.json()

        if (!respuestaAlertas.ok) {
          throw new Error(
            datosAlertas.mensaje ||
            'No se pudieron cargar las alertas.'
          )
        }

        if (!respuestaHistorial.ok) {
          throw new Error(
            datosHistorial.mensaje ||
            'No se pudo cargar el historial.'
          )
        }

        setAlertas(
          datosAlertas
        )

        setHistorial(
          datosHistorial
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
      cargarDatos()

      const intervalo =
        setInterval(
          cargarDatos,
          5000
        )

      return () =>
        clearInterval(
          intervalo
        )
    },
    [salaId]
  )

  /* ========================================
     CAMBIAR FORM
  ======================================== */

  const cambiarCampo =
    (campo, valor) => {
      setFormulario(
        (anterior) => ({
          ...anterior,

          [campo]:
            valor
        })
      )
    }

  const cambiarModo =
    (modo) => {
      setFormulario(
        (anterior) => ({
          ...anterior,

          modoDestinatario:
            modo,

          eventoId:
            '',

          meseroId:
            ''
        })
      )
    }

  /* ========================================
     ENVIAR
  ======================================== */

  const enviarNotificacion =
    async (e) => {
      e.preventDefault()

      setMensajeSistema('')
      setError('')

      if (
        !formulario.titulo.trim() ||
        !formulario.mensaje.trim()
      ) {
        setError(
          'Escribe el título y el mensaje.'
        )

        return
      }

      if (
        formulario
          .modoDestinatario ===
          'Evento' &&
        !formulario.eventoId
      ) {
        setError(
          'Selecciona el evento.'
        )

        return
      }

      if (
        formulario
          .modoDestinatario ===
          'Individual' &&
        !formulario.meseroId
      ) {
        setError(
          'Selecciona el mesero.'
        )

        return
      }

      try {
        setEnviando(true)

        const respuesta =
          await fetch(
            `${API_URL}/notificaciones`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  tipo:
                    formulario.tipo,

                  titulo:
                    formulario.titulo,

                  mensaje:
                    formulario.mensaje,

                  salaId:
                    salaNumero,

                  eventoId:
                    formulario.eventoId ||
                    null,

                  modoDestinatario:
                    formulario
                      .modoDestinatario,

                  meseroId:
                    formulario.meseroId ||
                    null
                })
            }
          )

        const resultado =
          await respuesta.json()

        if (!respuesta.ok) {
          throw new Error(
            resultado.mensaje ||
            'No se pudo enviar la notificación.'
          )
        }

        setMensajeSistema(
          `Notificación enviada correctamente a ${resultado.enviados} destinatario(s).`
        )

        setFormulario({
          tipo:
            'Aviso',

          titulo:
            '',

          mensaje:
            '',

          modoDestinatario:
            'Todos',

          eventoId:
            '',

          meseroId:
            ''
        })

        await cargarDatos()

        setPestaña(
          'historial'
        )

      } catch (error) {
        setError(
          error.message
        )
      } finally {
        setEnviando(false)
      }
    }

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

        setAlertas(
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

  /* ========================================
     FECHA
  ======================================== */

  const formatearFecha =
    (fecha) => {
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

  const obtenerEvento =
    (eventoId) => {
      const evento =
        eventos.find(
          (evento) =>
            evento.id ===
            eventoId
        )

      return evento
        ? evento.nombre
        : 'Sin evento'
    }

  const noLeidas =
    alertas.filter(
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
            Consulta alertas del sistema
            y envía avisos al personal.
          </p>

        </div>

        <button
          type="button"
          className="actualizar-notificaciones"
          onClick={
            cargarDatos
          }
        >
          Actualizar
        </button>

      </div>

      {/* SALA */}

      <section className="notificacion-selector-sala">

        <label>
          Sala
        </label>

        <select
          value={salaId}
          onChange={(e) => {
            setSalaId(
              e.target.value
            )

            setMensajeSistema('')
            setError('')
          }}
        >

          <option value="">
            Selecciona una sala
          </option>

          {salas.map(
            (sala) => (

              <option
                key={sala.id}
                value={sala.id}
              >
                {sala.nombre}
              </option>

            )
          )}

        </select>

      </section>

      {/* MENSAJES */}

      {mensajeSistema && (

        <div className="notificacion-mensaje correcto">

          {mensajeSistema}

        </div>

      )}

      {error && (

        <div className="notificaciones-error">

          {error}

        </div>

      )}

      {/* RESUMEN */}

      <div className="notificaciones-resumen">

        <div>

          <span>
            Alertas recibidas
          </span>

          <strong>
            {alertas.length}
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

        <div>

          <span>
            Avisos enviados
          </span>

          <strong>
            {historial.length}
          </strong>

        </div>

      </div>

      {/* TABS */}

      <div className="notificaciones-tabs">

        <button
          className={
            pestaña ===
            'alertas'
              ? 'activo'
              : ''
          }
          onClick={() =>
            setPestaña(
              'alertas'
            )
          }
        >
          Alertas del sistema
        </button>

        <button
          className={
            pestaña ===
            'enviar'
              ? 'activo'
              : ''
          }
          onClick={() =>
            setPestaña(
              'enviar'
            )
          }
        >
          Enviar aviso
        </button>

        <button
          className={
            pestaña ===
            'historial'
              ? 'activo'
              : ''
          }
          onClick={() =>
            setPestaña(
              'historial'
            )
          }
        >
          Historial enviados
        </button>

      </div>

      {/* ===================================
          ALERTAS
      =================================== */}

      {pestaña ===
        'alertas' && (

        <div className="notificaciones-lista">

          {cargando ? (

            <div className="notificaciones-vacio">
              Cargando alertas...
            </div>

          ) : alertas.length ===
            0 ? (

            <div className="notificaciones-vacio">

              No tienes alertas
              del sistema.

            </div>

          ) : (

            alertas.map(
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
            )

          )}

        </div>

      )}

      {/* ===================================
          ENVIAR
      =================================== */}

      {pestaña ===
        'enviar' && (

        <form
          className="notificacion-formulario"
          onSubmit={
            enviarNotificacion
          }
        >

          <div className="notificacion-form-grid">

            <div>

              <label>
                Tipo de aviso
              </label>

              <select
                value={
                  formulario.tipo
                }
                onChange={(e) =>
                  cambiarCampo(
                    'tipo',
                    e.target.value
                  )
                }
              >

                <option value="Aviso">
                  Aviso
                </option>

                <option value="Recordatorio">
                  Recordatorio
                </option>

                <option value="Cambio de horario">
                  Cambio de horario
                </option>

                <option value="Uniforme">
                  Uniforme
                </option>

                <option value="Información">
                  Información adicional
                </option>

              </select>

            </div>

            <div>

              <label>
                Evento relacionado
              </label>

              <select
                value={
                  formulario.eventoId
                }
                onChange={(e) =>
                  cambiarCampo(
                    'eventoId',
                    e.target.value
                  )
                }
              >

                <option value="">
                  Sin evento específico
                </option>

                {eventosSala.map(
                  (evento) => (

                    <option
                      key={
                        evento.id
                      }
                      value={
                        evento.id
                      }
                    >
                      {
                        evento.nombre
                      }
                    </option>

                  )
                )}

              </select>

            </div>

            <div className="notificacion-campo-completo">

              <label>
                Título
              </label>

              <input
                type="text"
                value={
                  formulario.titulo
                }
                onChange={(e) =>
                  cambiarCampo(
                    'titulo',
                    e.target.value
                  )
                }
                placeholder="Ejemplo: Cambio de horario"
              />

            </div>

            <div className="notificacion-campo-completo">

              <label>
                Mensaje
              </label>

              <textarea
                rows="5"
                value={
                  formulario.mensaje
                }
                onChange={(e) =>
                  cambiarCampo(
                    'mensaje',
                    e.target.value
                  )
                }
                placeholder="Escribe el aviso que recibirá el personal..."
              />

            </div>

          </div>

          <div className="notificacion-destinatarios">

            <h3>
              Destinatarios
            </h3>

            <div className="destinatario-opciones">

              <button
                type="button"
                className={
                  formulario
                    .modoDestinatario ===
                    'Todos'
                      ? 'activo'
                      : ''
                }
                onClick={() =>
                  cambiarModo(
                    'Todos'
                  )
                }
              >
                Toda la sala
              </button>

              <button
                type="button"
                className={
                  formulario
                    .modoDestinatario ===
                    'Evento'
                      ? 'activo'
                      : ''
                }
                onClick={() =>
                  cambiarModo(
                    'Evento'
                  )
                }
              >
                Personal de un evento
              </button>

              <button
                type="button"
                className={
                  formulario
                    .modoDestinatario ===
                    'Individual'
                      ? 'activo'
                      : ''
                }
                onClick={() =>
                  cambiarModo(
                    'Individual'
                  )
                }
              >
                Mesero específico
              </button>

            </div>

            {formulario
              .modoDestinatario ===
              'Evento' && (

              <div className="selector-destinatario">

                <label>
                  Evento
                </label>

                <select
                  value={
                    formulario.eventoId
                  }
                  onChange={(e) =>
                    cambiarCampo(
                      'eventoId',
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Selecciona el evento
                  </option>

                  {eventosSala.map(
                    (evento) => (

                      <option
                        key={
                          evento.id
                        }
                        value={
                          evento.id
                        }
                      >
                        {
                          evento.nombre
                        }
                      </option>

                    )
                  )}

                </select>

              </div>

            )}

            {formulario
              .modoDestinatario ===
              'Individual' && (

              <div className="selector-destinatario">

                <label>
                  Mesero
                </label>

                <select
                  value={
                    formulario.meseroId
                  }
                  onChange={(e) =>
                    cambiarCampo(
                      'meseroId',
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Selecciona el mesero
                  </option>

                  {meserosSala.map(
                    (mesero) => (

                      <option
                        key={
                          mesero.id
                        }
                        value={
                          mesero.id
                        }
                      >
                        {
                          mesero.nombre
                        }{' '}
                        {
                          mesero.apellidos
                        }
                      </option>

                    )
                  )}

                </select>

              </div>

            )}

          </div>

          <div className="notificacion-form-botones">

            <button
              type="submit"
              disabled={
                enviando ||
                !salaNumero
              }
            >
              {enviando
                ? 'Enviando...'
                : 'Enviar notificación'}
            </button>

          </div>

        </form>

      )}

      {/* ===================================
          HISTORIAL
      =================================== */}

      {pestaña ===
        'historial' && (

        <div className="notificaciones-lista">

          {historial.length ===
          0 ? (

            <div className="notificaciones-vacio">

              Todavía no has enviado
              notificaciones.

            </div>

          ) : (

            historial.map(
              (envio) => (

                <div
                  className="notificacion-card leida"
                  key={
                    envio.envioId
                  }
                >

                  <div className="notificacion-superior">

                    <div>

                      <span className="notificacion-tipo">
                        {envio.tipo}
                      </span>

                    </div>

                    <span className="notificacion-fecha">

                      {formatearFecha(
                        envio.fecha
                      )}

                    </span>

                  </div>

                  <h2>
                    {envio.titulo}
                  </h2>

                  <p>
                    {envio.mensaje}
                  </p>

                  {envio.eventoId && (

                    <div className="notificacion-evento-relacionado">

                      Evento:{' '}

                      <strong>
                        {obtenerEvento(
                          envio.eventoId
                        )}
                      </strong>

                    </div>

                  )}

                  <div className="historial-envio-datos">

                    <span>
                      Destinatarios:{' '}

                      <strong>
                        {envio.enviados}
                      </strong>
                    </span>

                    <span>
                      Leídos:{' '}

                      <strong>
                        {envio.leidos}
                      </strong>
                    </span>

                  </div>

                </div>

              )
            )

          )}

        </div>

      )}

    </div>
  )
}

export default AdminNotificaciones