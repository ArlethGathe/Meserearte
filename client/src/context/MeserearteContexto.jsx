import {
  createContext,
  useContext,
  useEffect,
  useState
} from 'react'

const MesereArteContext = createContext(null)

const API_URL = 'http://localhost:3001/api'

export function MesereArteProvider({ children }) {
  const [salas, setSalas] = useState([])
  const [meseros, setMeseros] = useState([])
  const [eventos, setEventos] = useState([])
  const [asignaciones, setAsignaciones] = useState([])

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargarDatos = async () => {
    try {
      setCargando(true)
      setError('')

      const [
        respuestaSalas,
        respuestaMeseros,
        respuestaEventos,
        respuestaAsignaciones
      ] = await Promise.all([
        fetch(`${API_URL}/salas`),
        fetch(`${API_URL}/meseros`),
        fetch(`${API_URL}/eventos`),
        fetch(`${API_URL}/asignaciones`)
      ])

      if (
        !respuestaSalas.ok ||
        !respuestaMeseros.ok ||
        !respuestaEventos.ok ||
        !respuestaAsignaciones.ok
      ) {
        throw new Error(
          'No fue posible obtener los datos del servidor.'
        )
      }

      const [
        datosSalas,
        datosMeseros,
        datosEventos,
        datosAsignaciones
      ] = await Promise.all([
        respuestaSalas.json(),
        respuestaMeseros.json(),
        respuestaEventos.json(),
        respuestaAsignaciones.json()
      ])

      setSalas(datosSalas)
      setMeseros(datosMeseros)
      setEventos(datosEventos)
      setAsignaciones(datosAsignaciones)
    } catch (error) {
      console.error(error)

      setError(
        'No se pudo conectar con la API de MesereArte.'
      )
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  /*
    ============================
    SALAS
    ============================
  */

  const crearSalaAPI = async (datos) => {
    const respuesta = await fetch(
      `${API_URL}/salas`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(datos)
      }
    )

    const resultado = await respuesta.json()

    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje ||
        'No se pudo crear la sala.'
      )
    }

    setSalas((anteriores) => [
      ...anteriores,
      resultado
    ])

    return resultado
  }

  const actualizarSalaAPI = async (
    id,
    datos
  ) => {
    const respuesta = await fetch(
      `${API_URL}/salas/${id}`,
      {
        method: 'PUT',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(datos)
      }
    )

    const resultado = await respuesta.json()

    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje ||
        'No se pudo actualizar la sala.'
      )
    }

    setSalas((anteriores) =>
      anteriores.map((sala) =>
        sala.id === id
          ? resultado
          : sala
      )
    )

    return resultado
  }

  const eliminarSalaAPI = async (id) => {
    const respuesta = await fetch(
      `${API_URL}/salas/${id}`,
      {
        method: 'DELETE'
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

    setSalas((anteriores) =>
      anteriores.filter(
        (sala) => sala.id !== id
      )
    )
  }

  /*
    ============================
    MESEROS
    ============================
  */

  const crearMeseroAPI = async (datos) => {
    const respuesta = await fetch(
      `${API_URL}/meseros`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(datos)
      }
    )

    const resultado = await respuesta.json()

    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje ||
        'No se pudo registrar al mesero.'
      )
    }

    setMeseros((anteriores) => [
      ...anteriores,
      resultado
    ])

    return resultado
  }

  const actualizarMeseroAPI = async (
    id,
    datos
  ) => {
    const respuesta = await fetch(
      `${API_URL}/meseros/${id}`,
      {
        method: 'PUT',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(datos)
      }
    )

    const resultado = await respuesta.json()

    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje ||
        'No se pudo actualizar al mesero.'
      )
    }

    setMeseros((anteriores) =>
      anteriores.map((mesero) =>
        mesero.id === id
          ? resultado
          : mesero
      )
    )

    return resultado
  }

  const eliminarMeseroAPI = async (id) => {
    const respuesta = await fetch(
      `${API_URL}/meseros/${id}`,
      {
        method: 'DELETE'
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

    setMeseros((anteriores) =>
      anteriores.filter(
        (mesero) => mesero.id !== id
      )
    )

    setAsignaciones((anteriores) =>
      anteriores.filter(
        (asignacion) =>
          asignacion.meseroId !== id
      )
    )
  }

  /*
    ============================
    EVENTOS
    ============================
  */

  const crearEventoAPI = async (datos) => {
    const respuesta = await fetch(
      `${API_URL}/eventos`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(datos)
      }
    )

    const resultado = await respuesta.json()

    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje ||
        'No se pudo crear el evento.'
      )
    }

    setEventos((anteriores) => [
      ...anteriores,
      resultado
    ])

    return resultado
  }

  const actualizarEventoAPI = async (
    id,
    datos
  ) => {
    const respuesta = await fetch(
      `${API_URL}/eventos/${id}`,
      {
        method: 'PUT',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(datos)
      }
    )

    const resultado = await respuesta.json()

    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje ||
        'No se pudo actualizar el evento.'
      )
    }

    setEventos((anteriores) =>
      anteriores.map((evento) =>
        evento.id === id
          ? resultado
          : evento
      )
    )

    return resultado
  }

  const eliminarEventoAPI = async (id) => {
    const respuesta = await fetch(
      `${API_URL}/eventos/${id}`,
      {
        method: 'DELETE'
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

    setEventos((anteriores) =>
      anteriores.filter(
        (evento) => evento.id !== id
      )
    )

    setAsignaciones((anteriores) =>
      anteriores.filter(
        (asignacion) =>
          asignacion.eventoId !== id
      )
    )
  }

  /*
    ============================
    ASIGNACIONES
    ============================
  */

  const guardarAsignacionesAPI = async (
    eventoId,
    meseroIds,
    capitanId
  ) => {
    const respuesta = await fetch(
      `${API_URL}/asignaciones/evento/${eventoId}`,
      {
        method: 'PUT',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          meseroIds,
          capitanId:
            capitanId
              ? Number(capitanId)
              : null
        })
      }
    )

    const resultado = await respuesta.json()

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

    return resultado
  }

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

        cargando,
        error,

        cargarDatos,

        crearSalaAPI,
        actualizarSalaAPI,
        eliminarSalaAPI,

        crearMeseroAPI,
        actualizarMeseroAPI,
        eliminarMeseroAPI,

        crearEventoAPI,
        actualizarEventoAPI,
        eliminarEventoAPI,

        guardarAsignacionesAPI
      }}
    >
      {children}
    </MesereArteContext.Provider>
  )
}

export function useMesereArte() {
  const contexto =
    useContext(MesereArteContext)

  if (!contexto) {
    throw new Error(
      'useMesereArte debe utilizarse dentro de MesereArteProvider'
    )
  }

  return contexto
}