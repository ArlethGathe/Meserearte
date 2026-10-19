import { useState } from 'react'
import './App.css'
import AdminDashboard from './pages/AdminDashboard'

function App() {
  const [vista, setVista] = useState('login')
  const [rol, setRol] = useState('administrador')

  if (vista === 'admin') {
  return (
    <AdminDashboard
      onLogout={() => setVista('login')}
    />
  )
}

  return (
    <div className="pagina-login">
      <div className="contenedor-login">

        <section className="panel-marca">

          <div>
            <div className="logo">M</div>

            <h1>MesereArte</h1>

            {vista === 'login' ? (
              <p>
                Página web para la organización previa del equipo
                de meseros en eventos sociales.
              </p>
            ) : (
              <p>
                El administrador puede crear una sala nueva.
                El mesero puede ingresar con el código proporcionado.
              </p>
            )}
          </div>

          <div className="mensaje-inferior">

            {vista === 'login' ? (
              <>
                <span>Vista de acceso</span>
                <p>
                  Ingresa como administrador o mesero para acceder
                  a la plataforma.
                </p>
              </>
            ) : (
              <>
                <span>Registro de usuario</span>

                <button
                  className="volver-login"
                  onClick={() => setVista('login')}
                >
                  Volver a inicio de sesión
                </button>
              </>
            )}

          </div>

        </section>

        <section className="panel-formulario">

          {vista === 'login' ? (
            <>
              <p className="titulo-pequeno">
                Acceso al sistema
              </p>

              <h2>Inicio de sesión</h2>

              <p className="subtitulo">
                Selecciona el rol con el que deseas visualizar la plataforma.
              </p>

              <div className="selector-rol">

                <button
                  className={
                    rol === 'administrador'
                      ? 'rol activo'
                      : 'rol'
                  }
                  onClick={() => setRol('administrador')}
                >
                  Administrador
                </button>

                <button
                  className={
                    rol === 'mesero'
                      ? 'rol activo'
                      : 'rol'
                  }
                  onClick={() => setRol('mesero')}
                >
                  Mesero
                </button>

              </div>

              <form>

                <label>Correo electrónico</label>

                <input
                  type="email"
                  placeholder={
                    rol === 'administrador'
                      ? 'admin@meserearte.com'
                      : 'mesero@meserearte.com'
                  }
                />

                <label>Contraseña</label>

                <input
                  type="password"
                  placeholder="••••••••"
                />

                <div className="botones-login">

                  <button
                    type="button"
                    className="boton-admin"
                    onClick={() => setVista('admin')}
                  >
                    Entrar como administrador
                  </button>

                  <button
                    type="button"
                    className="boton-mesero"
                    onClick={() => setRol('mesero')}
                  >
                    Entrar como mesero
                  </button>

                </div>

              </form>

              <p className="registro">
                ¿No tienes cuenta?{' '}

                <button
                  className="enlace-registro"
                  onClick={() => setVista('registro')}
                >
                  Regístrate
                </button>
              </p>
            </>
          ) : (
            <>
              <p className="titulo-pequeno">
                Crear cuenta
              </p>

              <h2>Datos de registro</h2>

              <p className="subtitulo">
                Vista para capturar nombre, contraseña y datos de sala.
              </p>

              <div className="selector-rol">

                <button
                  className={
                    rol === 'administrador'
                      ? 'rol activo'
                      : 'rol'
                  }
                  onClick={() => setRol('administrador')}
                >
                  Administrador: crear sala
                </button>

                <button
                  className={
                    rol === 'mesero'
                      ? 'rol activo'
                      : 'rol'
                  }
                  onClick={() => setRol('mesero')}
                >
                  Mesero: código de sala
                </button>

              </div>

              <form>

                <div className="fila-formulario">

                  <div>
                    <label>Nombre</label>
                    <input
                      type="text"
                      placeholder="Arleth"
                    />
                  </div>

                  <div>
                    <label>Apellidos</label>
                    <input
                      type="text"
                      placeholder="Gathe Esquivel"
                    />
                  </div>

                </div>

                <label>Correo electrónico</label>

                <input
                  type="email"
                  placeholder="nuevo@meserearte.com"
                />

                <label>Contraseña</label>

                <input
                  type="password"
                  placeholder="••••••••"
                />

                <div className="fila-formulario">

                  <div>
                    <label>Rol</label>

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
                      placeholder={
                        rol === 'administrador'
                          ? 'Equipo MesereArte'
                          : 'MESA2026'
                      }
                    />
                  </div>

                </div>

                <button
                  type="button"
                  className={
                    rol === 'administrador'
                      ? 'boton-registro admin'
                      : 'boton-registro mesero'
                  }
                >
                  {rol === 'administrador'
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