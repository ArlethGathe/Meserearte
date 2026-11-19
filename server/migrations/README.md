# Migración 001 de autenticación

La migración se basa en el esquema observado de `meserearte_db`: `public.usuarios.id` es una PK `integer` y `public.usuarios.password` es `varchar(255) NOT NULL`. El cambio añade `password_hash text NULL` sin valor predeterminado. No modifica las credenciales, las restricciones existentes o las rutas. El servidor actual sigue usando `password`. El cambio a Argon2id y la retirada de la columna legada tendrán su propia migración y despliegue.

## Archivos y orden

| Orden | Archivo | Resultado |
|---|---|---|
| 1 | `001_auth.verify.sql` | Captura la versión y el inventario inicial de columnas, restricciones e índices. Usa una transacción de solo lectura y consulta catálogos. |
| 2 | `001_auth.up.sql` | Añade una columna y dos tablas en una transacción. Un error aborta el conjunto. |
| 3 | `001_auth.verify.sql` | Permite comprobar que los objetos nuevos existen y comparar las restricciones e índices preexistentes con el inventario inicial. |
| Integración posterior | `001_auth.reservar_intento.sql` | Consulta parametrizada de escritura para `pg`. Se ejecuta por intento de login, fuera de las migraciones. |
| Reversión | `001_auth.down.sql` | Retira los objetos de la migración si las tablas nuevas están vacías y no hay hashes almacenados. |

Los scripts requieren PostgreSQL 14 o posterior para el conjunto completo, por el uso de `date_bin`. No requieren extensiones. El cliente `pg` instalado (8.23.1) admite SQL parametrizado, `Buffer` para `bytea` y transacciones en una misma conexión. El rol que aplica la migración necesita permiso para alterar `public.usuarios` y crear objetos en `public`. El rol de aplicación solo necesita los permisos de datos que correspondan. El script de instalación espera hasta cinco segundos para tomar bloqueos. Se debe ejecutar una vez, con un ejecutor que se detenga al primer error.

## Contrato para la futura integración

- **Sesiones.** Generar en Node un token aleatorio de 32 bytes y entregar su representación opaca en la cookie. Guardar solo su digest SHA-256 de 32 bytes, calculado sobre el token original, en `token_digest`. El vínculo `usuario_id` permite revocar por cuenta. Una sesión es válida si la cuenta está activa, `revocada_en IS NULL` y ambas expiraciones son posteriores al instante de comprobación. Renovar actividad con una actualización condicionada a que siga vigente, preservando el vencimiento absoluto con `LEAST`. El logout asigna `revocada_en` y elimina la cookie. Se usa un índice por expiración de inactividad porque esta es menor o igual que la absoluta.
- **Límite de login.** Derivar `clave_digest` con HMAC-SHA-256 usando una clave del servidor y entradas canónicas y sin ambigüedad para IP e IP más correo normalizado. Mantener fija la duración de la ventana por ámbito durante el despliegue. Reservar en orden `ip` y luego `ip_correo` en una transacción corta de la misma conexión. Una fila devuelta reserva un intento. Cero filas indica que el cupo está agotado. Confirmar las reservas efectuadas, incluso si el segundo ámbito bloquea el intento, para contabilizar el tráfico por IP. Ejecutar Argon2id solo después del commit y si las dos reservas tuvieron éxito. Calcular `Retry-After` hasta el límite de la ventana usando la misma referencia temporal del servidor. Las ventanas fijas se reinician en sus límites y permiten ráfagas a ambos lados del corte. La clave primaria serializa los incrementos concurrentes para cada ámbito, digest y ventana.
- **Relaciones.** La FK de sesiones es la única FK nueva y la eliminación futura de un usuario arrastraría exclusivamente sus sesiones en esa tabla. El rol de capitán sigue siendo una asignación por evento. No se guarda en la sesión, de modo que pueda verificarse con los datos vigentes de asignación y disponibilidad.

## Ensayo en una instancia aislada

Preparar una instancia PostgreSQL desechable con la misma versión mayor que el destino, usando un puerto local distinto y sin reutilizar la configuración de la aplicación. Usar una base `meserearte_migraciones_test` creada allí, con un volcado sanitizado **solo de esquema** y filas ficticias. Sustituir los valores de conexión de ejemplo por los de la instancia aislada. Ejecutar desde `server/migrations`.

~~~powershell
$destino = @('-h', '127.0.0.1', '-p', '55432', '-U', 'meserearte_test', '-d', 'meserearte_migraciones_test', '-X', '-v', 'ON_ERROR_STOP=1')
psql @destino -f 001_auth.verify.sql
psql @destino -f 001_auth.up.sql
psql @destino -f 001_auth.verify.sql
~~~

1. Comparar los inventarios antes y después. Verificar que la única columna nueva de una tabla existente es `password_hash text` anulable. Los índices, claves y relaciones anteriores deben seguir presentes.
2. En una conexión de prueba, abrir una transacción y crear un usuario ficticio con datos de prueba. Insertar una sesión con un digest de 32 bytes y probar expiración, revocación y los rechazos de digest inválido, vencimientos inconsistentes y FK inexistente. Revertir la transacción al terminar.
3. Con conexiones `pg` concurrentes, ejecutar `001_auth.reservar_intento.sql` con el mismo ámbito, digest de prueba y ventana. Con cupo 3 y cinco intentos, deben retornar una fila exactamente tres consultas, salvo que el ensayo cruce el límite de ventana. Comprobar también el rechazo al alcanzar el cupo y la reserva en la ventana siguiente.
4. Sobre datos ficticios, comprobar que `down` se detiene si encuentra un hash, una sesión o un contador. Repetir en una copia limpia con los objetos nuevos vacíos. Ejecutar `psql @destino -f 001_auth.down.sql` y luego el archivo de verificación. El inventario debe coincidir con la línea base.

## Reversión y decisión de despliegue

`down` toma bloqueos antes de comprobar si hay datos y nunca usa `CASCADE`. Si encuentra datos de autenticación o una dependencia, se detiene y la transacción revierte. Una vez que la aplicación use el esquema, conservarlo si se necesita revertir código. Volver al backend anterior después de activar Argon2id y sesiones restablecería el acceso sin middleware. Usar una versión de contingencia que preserve esos controles o mantener la API privada en mantenimiento. Cualquier retirada de datos de autenticación requiere un procedimiento separado.
