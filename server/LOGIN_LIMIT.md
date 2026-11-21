# Límite de intentos de inicio de sesión

El middleware de `POST /api/auth/login` reserva cupo para la IP y para el par IP + correo normalizado antes de invocar el manejador. Cuenta todos los intentos admitidos, incluido un inicio válido, para que las solicitudes simultáneas tampoco excedan el cupo. Un rechazo devuelve `429` genérico y `Retry-After` en segundos, redondeado hacia arriba. Los rechazos no amplían la ventana. Cada ventana empieza con la primera reserva de su clave.

| Variable de entorno | Predeterminado | Rango |
|---|---:|---:|
| `LOGIN_WINDOW_SECONDS` | 60 | 1–3600 |
| `LOGIN_MAX_PER_IP` | 30 | 1–1000 |
| `LOGIN_MAX_PER_IP_EMAIL` | 5 | 1–1000, sin superar el cupo por IP |
| `LOGIN_MAX_KEYS` | 10000 | 2–100000 |

El almacén local conserva digests HMAC con una clave aleatoria del proceso y metadatos de los contadores. Al alcanzar el tope de memoria, las reservas que necesiten espacio adicional esperan a que venzan entradas. Los contadores se pierden al reiniciar. El middleware consume una interfaz `reservar(ip, correo)` que admite una implementación asíncrona. Antes de desplegar varias instancias, usar un almacén compartido con reservas atómicas y probar la configuración del proxy. Actualmente Express usa la dirección de la conexión porque `trust proxy` está desactivado. Detrás de un proxy, sus clientes compartirían el cupo hasta configurar correctamente esa confianza.

Las pruebas unitarias y HTTP con consultas simuladas se ejecutan desde `server` con `node --test tests/passwords.test.js tests/login.test.js tests/login-limit.test.js`. Para el ensayo real, restaurar solo el esquema anterior a 001 en una instancia desechable en `127.0.0.1:55439`, con el usuario de ensayo `meserearte_test` y una base vacía `meserearte_login_test`. Ejecutar `node --test tests/login-postgres.test.js` con `MESEREARTE_ENSAYO_LOGIN=1`. La prueba aplica 001 y 002 a esa copia y crea sus propias cuentas ficticias. Usar una copia vacía para cada ejecución.
## Registro público

`POST /api/auth/registro-admin` y `POST /api/auth/registro-mesero` comparten un almacén HMAC independiente del login. Se reserva cupo después de analizar el JSON y antes de validar los campos, consultar PostgreSQL o calcular Argon2id. Los intentos con campos inválidos también consumen cupo.

| Variable | Predeterminado |
|---|---:|
| `REGISTER_WINDOW_SECONDS` | 600 segundos |
| `REGISTER_MAX_PER_IP` | 30 |
| `REGISTER_MAX_PER_IP_EMAIL` | 5 |
| `REGISTER_MAX_KEYS` | 10000 |

Los límites de configuración son los mismos que para login. Tras reservar cupo, el registro comprueba correo y, para mesero, código de sala con consultas breves. Genera el PHC antes de reservar la conexión transaccional. El autorregistro vuelve a comprobar la sala y mantiene un bloqueo compartido durante el alta. La unicidad del correo se exige también en el INSERT.
