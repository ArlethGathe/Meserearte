# Alcance de las rutas

| Acceso | Rutas |
|---|---|
| Público | `GET /api/health`, `POST /api/auth/login`, `POST /api/auth/registro-admin`, `POST /api/auth/registro-mesero`, `POST /api/auth/restablecimiento/solicitar`, `POST /api/auth/restablecimiento/confirmar`. Logout acepta una solicitud sin cookie para conservar su comportamiento idempotente. |
| Sesión y alcance | `GET /api/auth/me`, `GET /api/salas`, `GET /api/meseros`, `GET /api/eventos`, `GET /api/asignaciones`, `GET /api/disponibilidades`. Los listados se limitan en SQL. Los códigos de sala se entregan al propietario. |
| Administrador | Alta, edición y baja de salas y eventos. Baja de meseros. Actualización de asignaciones por evento. Listados `GET /api/notificaciones`, `GET /api/notificaciones/enviadas`, y envío mediante `POST /api/notificaciones` o `POST /api/notificaciones/enviar`. `GET /api/reportes` devuelve reportes enviados del ámbito propio. |
| Administrador o mesero propio | `PUT /api/meseros/:id`, `GET /api/meseros/:id/historial` y marcado de avisos con `PUT /api/notificaciones/:id/leida` o `PUT /api/notificaciones/:id/marcar-leida`. El mesero puede editar nombre, apellidos y teléfono. La edición de correo de acceso requiere un futuro flujo de verificación. |
| Mesero propio | `PUT /api/disponibilidades` y `GET /api/notificaciones/mesero/:meseroId`. |
| Propietario del evento o capitán vigente | `GET /api/asistencias/evento/:eventoId` y `GET /api/reportes/evento/:eventoId`. El administrador consulta solo reportes enviados. |
| Capitán vigente | `PUT /api/asistencias`, `POST /api/reportes` y `PUT /api/reportes/evento/:eventoId`. El enlace con el evento, la sala y la designación se comprueba en PostgreSQL. Responder `No disponible` retira el permiso. |
| Bloqueado | `POST /api/meseros` exige sesión y responde `405`. |
| Sistema y desarrollo | Demo y migraciones son comandos locales sin rutas HTTP. |

El actor proviene de la sesión. En disponibilidad se rechaza un `meseroId` incompatible y se usa el del actor. En asistencia, `meseroId` representa a la persona evaluada; el capitán se deriva de la sesión. En reportes la URL prevalece sobre el `eventoId` del cuerpo. Crear una sala ignora el `administradorId` del cuerpo. Los IDs de notificaciones representan recursos o destinatarios y se validan contra la sala y las asignaciones.

El middleware valida lecturas, incluidos todos los sondeos, sin renovar actividad. Las escrituras autenticadas pueden renovarla. Las denegaciones por alcance devuelven `403`; el marcado de aviso devuelve `404` si el actor no es su destinatario. Los avisos sin propietario o destinatario determinable quedan fuera del alcance. La interfaz de edición personal de CU15 y CSRF quedan pendientes.
