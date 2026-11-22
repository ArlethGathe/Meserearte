# Sesiones de MesereArte

Aplicar `004_sesiones.up.sql` después de 001. Se reutiliza `public.auth_sesiones`. Su clave primaria `token_digest` identifica la sesión, y `usuario_id` la vincula a la cuenta. 004 agrega `ultima_actividad` e inicializa las filas existentes desde `creada_en`. `004_sesiones.verify.sql` muestra metadatos. Al revertir 004 debe desplegarse primero código que deje de depender de la nueva columna.

El login crea un token nuevo de 32 bytes aleatorios codificado como Base64URL. PostgreSQL recibe solo su SHA-256. Cada cuenta puede tener varias sesiones. Logout revoca únicamente la identificada por la cookie actual. Los perfiles HTTP no contienen identificadores de sesión, digest ni credenciales.

| Variable | Predeterminado | Uso |
|---|---|---|
| `SESSION_IDLE_MINUTES` | 30 | Inactividad máxima. |
| `SESSION_ABSOLUTE_HOURS` | 8 | Vida máxima desde la creación. |
| `SESSION_COOKIE_NAME` | `meserearte_session` | Nombre de la cookie. |
| `SESSION_COOKIE_SECURE` | `true` | Solo admite `false` con `NODE_ENV=development` para HTTP local. |
| `SESSION_COOKIE_SAMESITE` | `lax` | Admite `lax` o `strict`. Usar frontend y API del mismo sitio. |
| `SESSION_APP_ORIGIN` | Sin origen añadido | Origen HTTPS exacto del frontend, si requiere CORS. Solo se añade a login, me y logout. |

La cookie usa `HttpOnly`, `Path=/`, un `Max-Age` igual a la duración absoluta y queda limitada al host que la emite. Express emite la cookie después de que PostgreSQL confirma la inserción. Logout la limpia tras revocar. Usar `VITE_API_URL` para apuntar los endpoints de sesión a la API desplegada.

`GET /api/auth/me` valida y devuelve el perfil actual con `Cache-Control: no-store`. El cliente lo usa para recuperar la sesión al cargar, sin renovar actividad. El middleware `sesiones.autenticar({ renovarActividad: true })` queda disponible para peticiones de negocio que representen actividad del usuario. Para notificaciones y cualquier sondeo usar `sesiones.autenticar({ renovarActividad: false })`. La renovación conserva el mismo token y se recorta al vencimiento absoluto. Mientras se integra el middleware en otras rutas, esas rutas no renovarán la sesión.

El rol se consulta en la cuenta en cada validación. Capitán se seguirá resolviendo por evento en la futura autorización de negocio. Queda pendiente aplicar el middleware a las rutas de negocio, la protección CSRF de escrituras autenticadas, revocar sesiones tras restablecer contraseñas y programar la limpieza de sesiones expiradas o revocadas.
