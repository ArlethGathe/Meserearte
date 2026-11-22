# Restablecimiento de contraseña

Aplicar `003_restablecimiento.up.sql` después de 002 y antes de habilitar el envío. Pueden solicitar un enlace las cuentas activas `migrada` y `requiere_restablecimiento`. La solicitud pública solo usa el correo y responde `202` con el mismo cuerpo para ambos estados, cuentas inexistentes e intentos que superan el cupo.

| Variable | Uso |
|---|---|
| `PASSWORD_RESET_APP_URL` | URL HTTPS del cliente. El enlace lleva el token en un fragmento que el cliente elimina al abrirlo. |
| `PASSWORD_RESET_DELIVERY_URL` | Receptor HTTPS de confianza que envía el correo. |
| `PASSWORD_RESET_DELIVERY_KEY` | Secreto para autenticar al backend ante el receptor. |
| `VITE_API_URL` | URL base del API para el formulario desplegado, incluido el prefijo `/api`. |

El receptor acepta un `POST` JSON con `correo` y `enlace`, autenticado con `Authorization: Bearer`. Debe enviar el enlace al correo recibido, proteger el acceso y excluir esos datos de sus logs. Sin las tres variables del servidor se conserva la respuesta pública genérica y el envío queda deshabilitado. Configurar una parte y omitir otra impide el arranque.

PostgreSQL almacena un digest por usuario durante 30 minutos. Una solicitud nueva sustituye el digest anterior. La confirmación calcula Argon2id fuera de la escritura y consume el token en la misma operación atómica que cambia el hash y deja la cuenta en `migrada`. El límite de solicitudes usa IP y correo normalizado. La confirmación tiene un límite separado por IP. Los contadores y la entrega en segundo plano son locales al proceso.

La reversión elimina la tabla de tokens y caduca todos los enlaces emitidos. Las contraseñas ya restablecidas se conservan. Antes de habilitar el flujo, probar la entrega real y revisar redacción de cuerpos HTTP, trazas del receptor y retención. El código de aplicación no registra tokens o contraseñas.
