import { useState } from 'react'
import './App.css'

import AdminDashboard from './pages/AdminDashboard.jsx'
import MeseroDashboard from './pages/MeseroDashboard.jsx'

import {
  useMesereArte
} from './context/MesereArteContexto.jsx'

const API_URL = 'http://localhost:3001/api'

function App() {
  const {
    cargarDatos
  } = useMesereArte()

  const [vista, setVista] =
    useState('login')

  const [rol, setRol] =
    useState('administrador')

  const [usuarioActual, setUsuarioActual] =
    useState(null)

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

        datos = {
          nombre:
            registro.nombre,

          apellidos:
            registro.apellidos,

          correo:
            registro.correo,

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
        Recargamos los datos porque el
        registro puede haber creado:
        - una sala
        - un usuario
        - un mesero
      */

      await cargarDatos()

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

  const cerrarSesion = () => {
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
      password: '',
      datoSala: ''
    })

    setError('')
    setMensaje('')
  }

  /* ========================================
     DASHBOARD ADMINISTRADOR
  ======================================== */

  if (
    vista === 'admin' &&
    usuarioActual &&
    usuarioActual.rol === 'Administrador'
  ) {
    return (
      <AdminDashboard
        usuario={usuarioActual}
        onLogout={cerrarSesion}
      />
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
      <MeseroDashboard
        usuario={usuarioActual}
        onLogout={cerrarSesion}
      />
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
                  Vista de acceso
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