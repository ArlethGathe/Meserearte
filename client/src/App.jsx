import { useEffect, useState } from 'react'
import './App.css'

import AdminDashboard from './pages/AdminDashboard.jsx'
import MeseroDashboard from './pages/MeseroDashboard.jsx'
import Restablecimiento from './Restablecimiento.jsx'

import { MesereArteProvider } from './context/MesereArteContexto.jsx'
import { API_URL, apiFetch, limpiarCsrf, prepararCsrf } from './api.js'


function App() {
  const [tokenRestablecimiento, setTokenRestablecimiento] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('restablecer')
  )
  const [vista, setVista] =
    useState(tokenRestablecimiento ? 'restablecer' : 'login')

  const [rol, setRol] =
    useState('administrador')

  const [usuarioActual, setUsuarioActual] =
    useState(null)
  const [restaurando, setRestaurando] = useState(!tokenRestablecimiento)

  useEffect(() => {
    const volverAlLogin = () => {
      setUsuarioActual(null)
      setVista('login')
    }
    window.addEventListener('meserearte:sesion-vencida', volverAlLogin)
    return () => window.removeEventListener('meserearte:sesion-vencida', volverAlLogin)
  }, [])


  useEffect(() => {
    if (!restaurando) return
    const controlador = new AbortController()
    async function restaurarSesion() {
      try {
        const respuesta = await fetch(API_URL + '/auth/me', {
          credentials: 'include',
          signal: controlador.signal,
        })
        if (!respuesta.ok) return
        const { usuario } = await respuesta.json()
        if (!(await prepararCsrf())) return
        if (controlador.signal.aborted) return
        setUsuarioActual(usuario)
        setVista(usuario.rol === 'Administrador' ? 'admin' : 'mesero')
      } catch {
        // La pantalla de acceso queda disponible si la sesión no se puede recuperar.
      } finally {
        if (!controlador.signal.aborted) setRestaurando(false)
      }
    }
    void restaurarSesion()
    return () => controlador.abort()
  }, [restaurando])

  const [mensaje, setMensaje] =
    useState('')

  const [error, setError] =
    useState('')

  const [procesando, setProcesando] =
    useState(false)

  /* ========================================
     LOGIN
  ======================================== */

  const [login, setLogin] =
    useState({
      correo: '',
      password: ''
    })

  const manejarLogin = (e) => {
    const {
      name,
      value
    } = e.target

    setLogin({
      ...login,
      [name]: value
    })
  }

  const iniciarSesion = async (e) => {
    e.preventDefault()

    setError('')
    setMensaje('')
    setProcesando(true)

    try {
      const respuesta =
        await fetch(
          `${API_URL}/auth/login`,
          {
            method: 'POST',
            credentials: 'include',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              correo:
                login.correo,

              password:
                login.password,

              rol:
                rol === 'administrador'
                  ? 'Administrador'
                  : 'Mesero'
            })
          }
        )

      const resultado =
        await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje ||
          'No fue posible iniciar sesión.'
        )
      }

      /*
        Guardamos al usuario autenticado.
      */

      limpiarCsrf()
      if (!(await prepararCsrf())) throw new Error('No fue posible preparar la sesión.')
      setUsuarioActual(
        resultado.usuario
      )

      /*
        Limpiamos el formulario.
      */

      setLogin({
        correo: '',
        password: ''
      })

      /*
        Mandamos al dashboard
        correspondiente.
      */

      if (
        resultado.usuario.rol ===
        'Administrador'
      ) {
        setVista('admin')
      } else {
        setVista('mesero')
      }

    } catch (error) {
      setError(
        error.message
      )
    } finally {
      setProcesando(false)
    }
  }

  /* ========================================
     REGISTRO
  ======================================== */

  const [registro, setRegistro] =
    useState({
      nombre: '',
      apellidos: '',
      correo: '',
      telefono: '',
      password: '',
      datoSala: ''
    })

  const manejarRegistro = (e) => {
    const {
      name,
      value
    } = e.target

    setRegistro({
      ...registro,
      [name]: value
    })
  }

  const registrarUsuario = async (e) => {
    e.preventDefault()

    setError('')
    setMensaje('')
    setProcesando(true)

    try {
      let endpoint = ''
      let datos = {}

      /*
        REGISTRO DE ADMINISTRADOR
      */

      if (
        rol === 'administrador'
      ) {
        endpoint =
          `${API_URL}/auth/registro-admin`

        datos = {
          nombre:
            registro.nombre,

          apellidos:
            registro.apellidos,

          correo:
            registro.correo,

          password:
            registro.password,

          nombreSala:
            registro.datoSala
        }
      }

      /*
        REGISTRO DE MESERO
      */

     else {
  endpoint =
    `${API_URL}/auth/registro-mesero`

  const telefonoLimpio =
    registro.telefono.replace(
      /\D/g,
      ''
    )

  if (
    telefonoLimpio.length !==
    10
  ) {
    throw new Error(
      'Ingresa un número de teléfono de 10 dígitos.'
    )
  }

  datos = {
    nombre:
      registro.nombre,

    apellidos:
      registro.apellidos,

    correo:
      registro.correo,

    telefono:
      telefonoLimpio,

    password:
      registro.password,

    codigoSala:
      registro.datoSala
  }
}
      const respuesta =
        await fetch(
          endpoint,
          {
            method: 'POST',

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
          'No fue posible completar el registro.'
        )
      }

      /*
        Mensaje dependiendo del rol.
      */

      if (
        rol === 'administrador'
      ) {
        setMensaje(
          `Cuenta creada correctamente. Tu código de sala es ${resultado.sala.codigo}. Guárdalo para compartirlo con tus meseros.`
        )
      } else {
        setMensaje(
          `Registro correcto. Te uniste a la sala "${resultado.sala.nombre}".`
        )
      }

      /*
        Dejamos preparado el correo
        para iniciar sesión.
      */

      setLogin({
        correo:
          registro.correo,

        password: ''
      })

      /*
        Limpiamos registro.
      */

      setRegistro({
        nombre: '',
        apellidos: '',
        correo: '',
        telefono:'', 
        password: '',
        datoSala: ''
      })

      /*
        Regresamos al login.
      */

      setVista('login')

    } catch (error) {
      setError(
        error.message
      )
    } finally {
      setProcesando(false)
    }
  }

  /* ========================================
     CERRAR SESIÓN
  ======================================== */

  const cerrarSesion = async () => {
    try {
      const respuesta = await apiFetch(API_URL + '/auth/logout', {
        method: 'POST',
      })
      if (!respuesta.ok) throw new Error()
    } catch {
      window.alert('No se pudo cerrar la sesión. Intenta de nuevo.')
      return
    }
    setUsuarioActual(null)

    setVista('login')

    setRol('administrador')

    setLogin({
      correo: '',
      password: ''
    })

    setRegistro({
      nombre: '',
      apellidos: '',
      correo: '',
      telefono:'', 
      password: '',
      datoSala: ''
    })

    setError('')
    setMensaje('')
  }

  /* ========================================
     DASHBOARD ADMINISTRADOR
  ======================================== */

  if (restaurando) return <p role="status">Comprobando sesión…</p>

  if (vista === 'restablecer') {
    return (
      <Restablecimiento
        api={import.meta.env.VITE_API_URL || API_URL}
        token={tokenRestablecimiento}
        volver={() => {
          setTokenRestablecimiento(null)
          setVista('login')
        }}
      />
    )
  }

  if (
    vista === 'admin' &&
    usuarioActual &&
    usuarioActual.rol === 'Administrador'
  ) {
    return (
      <MesereArteProvider key={usuarioActual.id}>
        <AdminDashboard
          usuario={usuarioActual}
          onLogout={cerrarSesion}
        />
      </MesereArteProvider>
    )
  }

  /* ========================================
     DASHBOARD MESERO
  ======================================== */

  if (
    vista === 'mesero' &&
    usuarioActual &&
    usuarioActual.rol === 'Mesero'
  ) {
    return (
      <MesereArteProvider key={usuarioActual.id}>
        <MeseroDashboard
          usuario={usuarioActual}
          onLogout={cerrarSesion}
        />
      </MesereArteProvider>
    )
  }

  /* ========================================
     LOGIN / REGISTRO
  ======================================== */

  return (
    <div className="pagina-login">

      <div className="contenedor-login">

        {/* ===================================
            PANEL IZQUIERDO
        =================================== */}

        <section className="panel-marca">

          <div>

            <div className="logo">
              M
            </div>

            <h1>
              MesereArte
            </h1>

            {vista === 'login' ? (

              <p>
                Página web para la
                organización previa del
                equipo de meseros en
                eventos sociales.
              </p>

            ) : (

              <p>
                El administrador puede
                crear una sala nueva.
                El mesero puede ingresar
                con el código proporcionado.
              </p>

            )}

          </div>

          <div className="mensaje-inferior">

            {vista === 'login' ? (

              <>

                <span>
                  ¡Bienvenido a MesereArte!
                </span>

                <p>
                  Ingresa como administrador
                  o mesero para acceder
                  a la plataforma.
                </p>

              </>

            ) : (

              <>

                <span>
                  Registro de usuario
                </span>

                <button
                  type="button"
                  className="volver-login"
                  onClick={() => {
                    setVista('login')
                    setError('')
                    setMensaje('')
                  }}
                >
                  Volver a inicio de sesión
                </button>

              </>

            )}

          </div>

        </section>

        {/* ===================================
            PANEL DERECHO
        =================================== */}

        <section className="panel-formulario">

          {/* MENSAJE CORRECTO */}

          {mensaje && (

            <div
              style={{
                marginBottom: '18px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#e8f5e9',
                color: '#2e6b36'
              }}
            >
              {mensaje}
            </div>

          )}

          {/* MENSAJE ERROR */}

          {error && (

            <div
              style={{
                marginBottom: '18px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#fdeaea',
                color: '#9f312d'
              }}
            >
              {error}
            </div>

          )}

          {/* =================================
              LOGIN
          ================================= */}

          {vista === 'login' ? (

            <>

              <p className="titulo-pequeno">
                Acceso al sistema
              </p>

              <h2>
                Inicio de sesión
              </h2>

              <p className="subtitulo">
                Selecciona el rol con
                el que deseas ingresar
                a la plataforma.
              </p>

              <div className="selector-rol">

                <button
                  type="button"
                  className={
                    rol === 'administrador'
                      ? 'rol activo'
                      : 'rol'
                  }
                  onClick={() => {
                    setRol(
                      'administrador'
                    )

                    setError('')
                  }}
                >
                  Administrador
                </button>

                <button
                  type="button"
                  className={
                    rol === 'mesero'
                      ? 'rol activo'
                      : 'rol'
                  }
                  onClick={() => {
                    setRol('mesero')
                    setError('')
                  }}
                >
                  Mesero
                </button>

              </div>

              <form
                onSubmit={
                  iniciarSesion
                }
              >

                <label>
                  Correo electrónico
                </label>

                <input
                  type="email"
                  name="correo"
                  value={
                    login.correo
                  }
                  onChange={
                    manejarLogin
                  }
                  placeholder={
                    rol === 'administrador'
                      ? 'admin@meserearte.com'
                      : 'maria@meserearte.com'
                  }
                  required
                />

                <label>
                  Contraseña
                </label>

                <input
                  type="password"
                  name="password"
                  value={
                    login.password
                  }
                  onChange={
                    manejarLogin
                  }
                  placeholder="••••••••"
                  required
                />

                <div className="botones-login">

                  {rol === 'administrador' ? (

                    <button
                      type="submit"
                      className="boton-admin"
                      disabled={
                        procesando
                      }
                    >
                      {procesando
                        ? 'Ingresando...'
                        : 'Entrar como administrador'}
                    </button>

                  ) : (

                    <button
                      type="submit"
                      className="boton-mesero"
                      disabled={
                        procesando
                      }
                    >
                      {procesando
                        ? 'Ingresando...'
                        : 'Entrar como mesero'}
                    </button>

                  )}

                </div>

              </form>

              <p className="registro">

                ¿No tienes cuenta?{' '}

                <button
                  type="button"
                  className="enlace-registro"
                  onClick={() => {
                    setVista('registro')
                    setError('')
                    setMensaje('')
                  }}
                >
                  Regístrate
                </button>

              </p>

              <button
                type="button"
                className="enlace-registro"
                onClick={() => {
                  setError('')
                  setMensaje('')
                  setLogin({ correo: '', password: '' })
                  setVista('restablecer')
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>

            </>

          ) : (

            /* ===============================
               REGISTRO
            =============================== */

            <>

              <p className="titulo-pequeno">
                Crear cuenta
              </p>

              <h2>
                Datos de registro
              </h2>

              <p className="subtitulo">
                Registra tus datos para
                utilizar MesereArte.
              </p>

              <div className="selector-rol">

                <button
                  type="button"
                  className={
                    rol === 'administrador'
                      ? 'rol activo'
                      : 'rol'
                  }
                  onClick={() => {
                    setRol(
                      'administrador'
                    )

                    setRegistro({
                      ...registro,
                      datoSala: ''
                    })

                    setError('')
                  }}
                >
                  Administrador:
                  crear sala
                </button>

                <button
                  type="button"
                  className={
                    rol === 'mesero'
                      ? 'rol activo'
                      : 'rol'
                  }
                  onClick={() => {
                    setRol('mesero')

                    setRegistro({
                      ...registro,
                      datoSala: ''
                    })

                    setError('')
                  }}
                >
                  Mesero:
                  código de sala
                </button>

              </div>

              <form
                onSubmit={
                  registrarUsuario
                }
              >

                <div className="fila-formulario">

                  <div>

                    <label>
                      Nombre
                    </label>

                    <input
                      type="text"
                      name="nombre"
                      value={
                        registro.nombre
                      }
                      onChange={
                        manejarRegistro
                      }
                      placeholder="Arleth"
                      required
                    />

                  </div>

                  <div>

                    <label>
                      Apellidos
                    </label>

                    <input
                      type="text"
                      name="apellidos"
                      value={
                        registro.apellidos
                      }
                      onChange={
                        manejarRegistro
                      }
                      placeholder="Gathe Esquivel"
                      required
                    />

                  </div>

                </div>

                <label>
                  Correo electrónico
                </label>

                <input
                  type="email"
                  name="correo"
                  value={
                    registro.correo
                  }
                  onChange={
                    manejarRegistro
                  }
                  placeholder="nuevo@meserearte.com"
                  required
                />
                {rol === 'mesero' && (
  <>
    <label>
      Número de teléfono
    </label>

    <input
      type="tel"
      name="telefono"
      value={
        registro.telefono
      }
      onChange={(e) => {
        const valor =
          e.target.value
            .replace(
              /\D/g,
              ''
            )
            .slice(
              0,
              10
            )

        setRegistro({
          ...registro,
          telefono:
            valor
        })
      }}
      placeholder="5512345678"
      maxLength="10"
      inputMode="numeric"
      required
    />
  </>
)}

                <label>
                  Contraseña
                </label>

                <input
                  type="password"
                  name="password"
                  value={
                    registro.password
                  }
                  onChange={
                    manejarRegistro
                  }
                  placeholder="••••••••"
                  minLength="6"
                  required
                />

                <div className="fila-formulario">

                  <div>

                    <label>
                      Rol
                    </label>

                    <input
                      type="text"
                      value={
                        rol === 'administrador'
                          ? 'Administrador'
                          : 'Mesero'
                      }
                      readOnly
                    />

                  </div>

                  <div>

                    <label>

                      {rol === 'administrador'
                        ? 'Nombre de nueva sala'
                        : 'Código de sala'}

                    </label>

                    <input
                      type="text"
                      name="datoSala"
                      value={
                        registro.datoSala
                      }
                      onChange={
                        manejarRegistro
                      }
                      placeholder={
                        rol === 'administrador'
                          ? 'Equipo MesereArte'
                          : 'MESA2026'
                      }
                      required
                    />

                  </div>

                </div>

                <button
                  type="submit"
                  disabled={
                    procesando
                  }
                  className={
                    rol === 'administrador'
                      ? 'boton-registro admin'
                      : 'boton-registro mesero'
                  }
                >
                  {procesando
                    ? 'Procesando...'
                    : rol === 'administrador'
                      ? 'Crear sala como administrador'
                      : 'Unirme como mesero'}
                </button>

              </form>

            </>

          )}

        </section>

      </div>

    </div>
  )
}

export default App
