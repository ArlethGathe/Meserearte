import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

const MesereArteContext =
  createContext(null)

import { API_URL, apiFetch } from '../api.js'

export function MesereArteProvider({
  children
}) {

  /* ========================================
     ESTADOS GENERALES
  ======================================== */

  const [
    salas,
    setSalas
  ] = useState([])

  const [
    meseros,
    setMeseros
  ] = useState([])

  const [
    eventos,
    setEventos
  ] = useState([])

  const [
    asignaciones,
    setAsignaciones
  ] = useState([])

  const [
    disponibilidades,
    setDisponibilidades
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
     CARGAR DATOS GENERALES
  ======================================== */

  const cargarDatos =
    useCallback(
      async (
        silencioso = false
      ) => {

        try {

          /*
            Cuando es una sincronización
            automática no mostramos
            "cargando" para evitar que
            la interfaz parpadee.
          */

          if (!silencioso) {
            setCargando(true)
            setError('')
          }

          const [
            respuestaSalas,
            respuestaMeseros,
            respuestaEventos,
            respuestaAsignaciones,
            respuestaDisponibilidades
          ] = await Promise.all([
            apiFetch(
              `${API_URL}/salas`
            ),

            apiFetch(
              `${API_URL}/meseros`
            ),

            apiFetch(
              `${API_URL}/eventos`
            ),

            apiFetch(
              `${API_URL}/asignaciones`
            ),

            apiFetch(
              `${API_URL}/disponibilidades`
            )
          ])

          if (
            !respuestaSalas.ok ||
            !respuestaMeseros.ok ||
            !respuestaEventos.ok ||
            !respuestaAsignaciones.ok ||
            !respuestaDisponibilidades.ok
          ) {
            throw new Error(
              'No fue posible obtener los datos del servidor.'
            )
          }

          const [
            datosSalas,
            datosMeseros,
            datosEventos,
            datosAsignaciones,
            datosDisponibilidades
          ] = await Promise.all([
            respuestaSalas.json(),
            respuestaMeseros.json(),
            respuestaEventos.json(),
            respuestaAsignaciones.json(),
            respuestaDisponibilidades.json()
          ])

          /*
            Importante:
            solamente actualizamos los estados
            DESPUÉS de que todas las consultas
            terminaron correctamente.

            Así una falla temporal no deja
            vacía la aplicación.
          */

          setSalas(
            Array.isArray(
              datosSalas
            )
              ? datosSalas
              : []
          )

          setMeseros(
            Array.isArray(
              datosMeseros
            )
              ? datosMeseros
              : []
          )

          setEventos(
            Array.isArray(
              datosEventos
            )
              ? datosEventos
              : []
          )

          setAsignaciones(
            Array.isArray(
              datosAsignaciones
            )
              ? datosAsignaciones
              : []
          )

          setDisponibilidades(
            Array.isArray(
              datosDisponibilidades
            )
              ? datosDisponibilidades
              : []
          )

          /*
            Si la sincronización fue
            correcta quitamos cualquier
            error anterior.
          */

          setError('')

          return {
            salas:
              datosSalas,

            meseros:
              datosMeseros,

            eventos:
              datosEventos,

            asignaciones:
              datosAsignaciones,

            disponibilidades:
              datosDisponibilidades
          }

        } catch (error) {

          console.error(
            'Error al cargar datos de MesereArte:',
            error
          )

          /*
            En actualizaciones automáticas
            NO borramos la información
            ni bloqueamos la aplicación.
          */

          if (!silencioso) {
            setError(
              'No se pudo conectar con la API de MesereArte.'
            )
          }

          return null

        } finally {

          if (!silencioso) {
            setCargando(false)
          }

        }
      },
      []
    )

  /* ========================================
     SINCRONIZACIÓN AUTOMÁTICA
  ======================================== */

  useEffect(
    () => {

      /*
        Primera carga.
      */

      cargarDatos(false)

      /*
        Sincronización automática.

        Esto permite que un cambio realizado
        por el administrador aparezca en la
        sesión del mesero/capitán.
      */

      const intervalo =
        setInterval(
          () => {
            cargarDatos(true)
          },
          5000
        )

      /*
        También sincronizamos cuando el
        usuario vuelve a esta ventana.
      */

      const sincronizarAlVolver =
        () => {
          cargarDatos(true)
        }

      /*
        Y cuando vuelve a una pestaña
        que estaba en segundo plano.
      */

      const sincronizarVisibilidad =
        () => {

          if (
            document.visibilityState ===
            'visible'
          ) {
            cargarDatos(true)
          }

        }

      window.addEventListener(
        'focus',
        sincronizarAlVolver
      )

      document.addEventListener(
        'visibilitychange',
        sincronizarVisibilidad
      )

      return () => {

        clearInterval(
          intervalo
        )

        window.removeEventListener(
          'focus',
          sincronizarAlVolver
        )

        document.removeEventListener(
          'visibilitychange',
          sincronizarVisibilidad
        )

      }

    },
    [
      cargarDatos
    ]
  )

  /* ========================================
     SALAS
  ======================================== */

  const crearSalaAPI =
    async (
      datos
    ) => {

      const respuesta =
        await apiFetch(
          `${API_URL}/salas`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify(
                datos
              )
          }
        )

      const resultado =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          'No se pudo crear la sala.'
        )
      }

      setSalas(
        (anteriores) => [
          ...anteriores,
          resultado
        ]
      )

      return resultado
    }

  const actualizarSalaAPI =
    async (
      id,
      datos
    ) => {

      const respuesta =
        await apiFetch(
          `${API_URL}/salas/${id}`,
          {
            method:
              'PUT',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify(
                datos
              )
          }
        )

      const resultado =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          'No se pudo actualizar la sala.'
        )
      }

      setSalas(
        (anteriores) =>
          anteriores.map(
            (sala) =>
              sala.id === id
                ? resultado
                : sala
          )
      )

      return resultado
    }

  const eliminarSalaAPI =
    async (
      id
    ) => {

      const respuesta =
        await apiFetch(
          `${API_URL}/salas/${id}`,
          {
            method:
              'DELETE'
          }
        )

      const resultado =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          'No se pudo eliminar la sala.'
        )
      }

      setSalas(
        (anteriores) =>
          anteriores.filter(
            (sala) =>
              sala.id !== id
          )
      )

      return resultado
    }

  /* ========================================
     MESEROS
  ======================================== */

  const actualizarMeseroAPI =
    async (
      id,
      datos
    ) => {

      const respuesta =
        await apiFetch(
          `${API_URL}/meseros/${id}`,
          {
            method:
              'PUT',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify(
                datos
              )
          }
        )

      const resultado =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          'No se pudo actualizar al mesero.'
        )
      }

      setMeseros(
        (anteriores) =>
          anteriores.map(
            (mesero) =>
              mesero.id === id
                ? resultado
                : mesero
          )
      )

      return resultado
    }

  const eliminarMeseroAPI =
    async (
      id
    ) => {

      const respuesta =
        await apiFetch(
          `${API_URL}/meseros/${id}`,
          {
            method:
              'DELETE'
          }
        )

      const resultado =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          'No se pudo eliminar al mesero.'
        )
      }

      setMeseros(
        (anteriores) =>
          anteriores.filter(
            (mesero) =>
              mesero.id !== id
          )
      )

      setAsignaciones(
        (anteriores) =>
          anteriores.filter(
            (asignacion) =>
              asignacion.meseroId !==
              id
          )
      )

      setDisponibilidades(
        (anteriores) =>
          anteriores.filter(
            (disponibilidad) =>
              disponibilidad.meseroId !==
              id
          )
      )

      return resultado
    }

  /* ========================================
     EVENTOS
  ======================================== */

  const crearEventoAPI =
    async (
      datos
    ) => {

      const respuesta =
        await apiFetch(
          `${API_URL}/eventos`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify(
                datos
              )
          }
        )

      const resultado =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          'No se pudo crear el evento.'
        )
      }

      setEventos(
        (anteriores) => [
          ...anteriores,
          resultado
        ]
      )

      return resultado
    }

  const actualizarEventoAPI =
    async (
      id,
      datos
    ) => {

      const respuesta =
        await apiFetch(
          `${API_URL}/eventos/${id}`,
          {
            method:
              'PUT',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify(
                datos
              )
          }
        )

      const resultado =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          'No se pudo actualizar el evento.'
        )
      }

      /*
        La sesión del administrador se
        actualiza inmediatamente.
      */

      setEventos(
        (anteriores) =>
          anteriores.map(
            (evento) =>
              evento.id === id
                ? resultado
                : evento
          )
      )

      return resultado
    }

  const eliminarEventoAPI =
    async (
      id
    ) => {

      const respuesta =
        await apiFetch(
          `${API_URL}/eventos/${id}`,
          {
            method:
              'DELETE'
          }
        )

      const resultado =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          'No se pudo eliminar el evento.'
        )
      }

      setEventos(
        (anteriores) =>
          anteriores.filter(
            (evento) =>
              evento.id !== id
          )
      )

      setAsignaciones(
        (anteriores) =>
          anteriores.filter(
            (asignacion) =>
              asignacion.eventoId !==
              id
          )
      )

      setDisponibilidades(
        (anteriores) =>
          anteriores.filter(
            (disponibilidad) =>
              disponibilidad.eventoId !==
              id
          )
      )

      return resultado
    }

  /* ========================================
     ASIGNACIONES
  ======================================== */

  const guardarAsignacionesAPI =
    async (
      eventoId,
      meseroIds,
      capitanId
    ) => {

      const respuesta =
        await apiFetch(
          `${API_URL}/asignaciones/evento/${eventoId}`,
          {
            method:
              'PUT',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                meseroIds,

                capitanId:
                  capitanId
                    ? Number(
                        capitanId
                      )
                    : null
              })
          }
        )

      const resultado =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          'No se pudieron guardar las asignaciones.'
        )
      }

      setAsignaciones(
        (anteriores) => [
          ...anteriores.filter(
            (asignacion) =>
              asignacion.eventoId !==
              Number(eventoId)
          ),

          ...resultado
        ]
      )

      /*
        El backend también crea o modifica
        disponibilidades.

        Recargamos silenciosamente para
        mantener todo sincronizado.
      */

      await cargarDatos(
        true
      )

      return resultado
    }

  /* ========================================
     DISPONIBILIDAD
  ======================================== */

  const actualizarDisponibilidadAPI =
    async (
      eventoId,
      meseroId,
      estado
    ) => {

      const respuesta =
        await apiFetch(
          `${API_URL}/disponibilidades`,
          {
            method:
              'PUT',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                eventoId,
                meseroId,
                estado
              })
          }
        )

      const resultado =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          'No fue posible actualizar la disponibilidad.'
        )
      }

      setDisponibilidades(
        (anteriores) => {

          const existe =
            anteriores.some(
              (item) =>
                item.eventoId ===
                  resultado.eventoId &&
                item.meseroId ===
                  resultado.meseroId
            )

          if (existe) {

            return anteriores.map(
              (item) =>
                item.eventoId ===
                  resultado.eventoId &&
                item.meseroId ===
                  resultado.meseroId
                  ? {
                      ...item,
                      ...resultado
                    }
                  : item
            )

          }

          return [
            ...anteriores,
            resultado
          ]
        }
      )

      return resultado
    }

  /* ========================================
     REFRESCAR MANUALMENTE
  ======================================== */

  const refrescarDatosAPI =
    async () => {
      return await cargarDatos(
        true
      )
    }

  /* ========================================
     PROVIDER
  ======================================== */

  return (
    <MesereArteContext.Provider
      value={{
        salas,
        setSalas,

        meseros,
        setMeseros,

        eventos,
        setEventos,

        asignaciones,
        setAsignaciones,

        disponibilidades,
        setDisponibilidades,

        cargando,
        error,

        cargarDatos,
        refrescarDatosAPI,

        crearSalaAPI,
        actualizarSalaAPI,
        eliminarSalaAPI,

        actualizarMeseroAPI,
        eliminarMeseroAPI,

        crearEventoAPI,
        actualizarEventoAPI,
        eliminarEventoAPI,

        guardarAsignacionesAPI,

        actualizarDisponibilidadAPI
      }}
    >
      {children}
    </MesereArteContext.Provider>
  )
}

/* ========================================
   HOOK
======================================== */

export function useMesereArte() {

  const contexto =
    useContext(
      MesereArteContext
    )

  if (!contexto) {

    throw new Error(
      'useMesereArte debe utilizarse dentro de MesereArteProvider'
    )

  }

  return contexto
}