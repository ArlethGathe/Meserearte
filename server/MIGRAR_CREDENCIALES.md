# Ensayo de migración de credenciales heredadas

El comando de mantenimiento de esta etapa se conecta explícitamente a PostgreSQL en `127.0.0.1:55439`, con el rol `meserearte_test` y una base cuyo nombre sigue `meserearte_<nombre>_test`. Usa una instancia desechable con 001 y 002 aplicadas y autenticación local de pruebas. El comando no carga `.env`. Antes de procesar el plan, valida el destino reportado por PostgreSQL. Esta versión está habilitada solo para el entorno aislado.

El plan es un JSON ordenado que solo admite un ID único y una acción por fila. La decisión de migrar o requerir restablecimiento es explícita y externa al comando.

```json
[
  { "id": 101, "accion": "migrar" },
  { "id": 102, "accion": "restablecer" }
]
```

Desde `server`, la simulación usa una conexión de solo lectura. Devuelve totales e IDs con sus resultados y consulta solo la presencia de una credencial, sin recuperar sus valores.

```powershell
node src/migrar-credenciales-cli.js --db meserearte_migrar_test --plan plan-ficticio.json
```

Para ensayar escrituras, confirmar el nombre exacto y pasar `--apply`.

```powershell
$env:MESEREARTE_CREDENTIALS_APPLY = 'meserearte_migrar_test'
node src/migrar-credenciales-cli.js --db meserearte_migrar_test --plan plan-ficticio.json --apply
Remove-Item Env:MESEREARTE_CREDENTIALS_APPLY
```

El comando procesa en orden y ejecuta un solo hash a la vez. Lee el valor legado solo para una cuenta coherente, pendiente y marcada para migrar. El hash se calcula fuera de una transacción. Una escritura atómica condicionada por el estado, las columnas y la versión de la fila establece el destino y pone el valor legado en NULL. Un cambio concurrente se informa como conflicto. El restablecimiento elimina el valor legado y deja el hash en NULL. El informe nunca incluye valores de credenciales.

Las cuentas que ya están en un estado final coherente se ignoran. Los conflictos, inconsistencias e IDs inexistentes se informan sin modificar esas filas. Un fallo operativo detiene el lote. Las escrituras previas siguen confirmadas. Para reanudar, revisar el informe y repetir el mismo plan después de resolver el fallo. El código de salida es 1 si hubo alguna incidencia. Ante un cierre abrupto puede faltar el informe final. Repetir el plan sigue siendo seguro.

Para repetir la prueba de integración, preparar una base vacía llamada `meserearte_migrar_test` a partir del esquema anterior a 001. Ejecutar `node --test tests/migrar-credenciales.test.js` desde `server` con `MESEREARTE_ENSAYO_MIGRAR=1`. La prueba aplica las dos migraciones y carga sus propias cuentas ficticias.
