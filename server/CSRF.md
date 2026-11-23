# Protección CSRF

`GET /api/auth/csrf` requiere sesión, responde solo con `csrfToken` y usa `Cache-Control: no-store`. No renueva la sesión. El valor es HMAC-SHA256, con un contexto dedicado, sobre el digest validado de la cookie. La comparación usa tiempo constante. PostgreSQL sigue almacenando el digest de sesión y no almacena tokens CSRF.

Las escrituras de negocio `POST`, `PUT`, `PATCH` y `DELETE` pasan por sesión, comprobación de `X-CSRF-Token`, renovación de actividad, autorización de negocio y operación. Un rechazo CSRF no renueva actividad. El token se acepta solo por header. Las lecturas y los sondeos siguen sin requerir token ni renovar actividad. Logout requiere el header cuando hay sesión válida y, sin ella, limpia la cookie con respuesta idempotente. Login, registros públicos, recuperación y salud conservan su acceso sin token autenticado. Login CSRF es una protección separada.

En producción, configurar `CSRF_SECRET` con 32 bytes obtenidos de un generador criptográfico y codificados en Base64URL sin relleno. Compartir el mismo secreto entre las instancias del entorno. Un valor vacío, mal formado o trivial impide el arranque. En desarrollo o pruebas, si la variable está ausente se genera una clave aleatoria por proceso. Guardarla en el gestor de secretos del entorno, fuera del repo y de los logs.

Rotar la clave invalida los tokens CSRF emitidos mientras conserva las sesiones. El cliente guarda el token en memoria, lo elimina tras logout o 401 y, ante un 403 específico de CSRF, lo vuelve a pedir y reintenta una vez. Coordinar la rotación de todas las instancias para evitar rechazos intermitentes.

Para CORS, usar `SESSION_APP_ORIGIN` como origen HTTPS exacto de la aplicación. En desarrollo se permiten por defecto `http://localhost:5173` y `http://127.0.0.1:5173`. `APP_DEV_ORIGINS` permite sustituir esa lista por orígenes HTTP locales separados por comas y se ignora en producción. El origen del formulario de recuperación conserva acceso a sus dos rutas. Los orígenes ajenos reciben 403. Las herramientas sin `Origin` pueden llamar a la API y siguen sujetas a sesión y CSRF donde corresponda. No se infiere confianza del header `Host`.
