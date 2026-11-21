# Carga de demostración

El servidor arranca sin crear cuentas. Para preparar una base local desechable, aplicar primero las migraciones 001 y 002. Configurar `NODE_ENV=development`, un host de bucle local y un nombre de base terminado en `_demo` o `_test`. Definir `DEMO_ADMIN_PASSWORD` y `DEMO_MESERO_PASSWORD` con credenciales ficticias elegidas para el ensayo y ejecutar `node src/seed-demo.js` desde `server`. El comando crea dos cuentas Argon2id con correos `example.invalid` y una sala ficticia. Si ya hay usuarios, sale sin escribir.

En el panel de personal, **Invitar mesero** muestra los códigos de las salas activas del administrador. El mesero elige su contraseña en el registro público y el servidor guarda únicamente el hash. `POST /api/meseros` devuelve `405` con la indicación de usar el autorregistro.
