import './AdminPerfil.css'

function AdminPerfil({
  usuario
}) {
  return (
    <div className="admin-perfil-pagina">

      <div className="admin-perfil-encabezado">

        <p className="admin-perfil-etiqueta">
          CUENTA DE ADMINISTRADOR
        </p>

        <h1>
          Mi perfil
        </h1>

        <p>
          Consulta la información asociada
          a tu cuenta de MesereArte.
        </p>

      </div>

      <section className="admin-perfil-card">

        <div className="admin-perfil-avatar">

          <div className="admin-avatar-circulo">
            {usuario?.nombre
              ?.charAt(0)
              ?.toUpperCase() || 'A'}
          </div>

          <div>

            <h2>
              {usuario?.nombre}{' '}
              {usuario?.apellidos}
            </h2>

            <p>
              Administrador de MesereArte
            </p>

          </div>

        </div>

        <div className="admin-perfil-datos">

          <div className="admin-perfil-campo">

            <span>
              Nombre
            </span>

            <strong>
              {usuario?.nombre ||
                'Sin registrar'}
            </strong>

          </div>

          <div className="admin-perfil-campo">

            <span>
              Apellidos
            </span>

            <strong>
              {usuario?.apellidos ||
                'Sin registrar'}
            </strong>

          </div>

          <div className="admin-perfil-campo admin-perfil-completo">

            <span>
              Correo electrónico
            </span>

            <strong>
              {usuario?.correo ||
                'Sin registrar'}
            </strong>

          </div>

          <div className="admin-perfil-campo">

            <span>
              Rol de cuenta
            </span>

            <strong>
              {usuario?.rol ||
                'Administrador'}
            </strong>

          </div>

          <div className="admin-perfil-campo">

            <span>
              Estado
            </span>

            <span
              className={
                usuario?.estado ===
                'Activo'
                  ? 'admin-perfil-estado activo'
                  : 'admin-perfil-estado inactivo'
              }
            >
              {usuario?.estado ||
                'Activo'}
            </span>

          </div>

        </div>

      </section>

      <section className="admin-perfil-seguridad">

        <div>

          <h2>
            Seguridad de la cuenta
          </h2>

          <p>
            Las opciones para actualizar
            datos personales y cambiar
            contraseña se integrarán
            posteriormente con el sistema
            de seguridad de MesereArte.
          </p>

        </div>

        <span>
          Próximamente
        </span>

      </section>

    </div>
  )
}

export default AdminPerfil