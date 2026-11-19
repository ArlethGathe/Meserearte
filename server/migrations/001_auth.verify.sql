BEGIN READ ONLY;

SELECT current_database() AS base,
       current_setting('server_version') AS version,
       current_setting('transaction_read_only') AS solo_lectura;

-- Solo definición de columnas. Sirve antes de aplicar y después de revertir.
SELECT c.relname AS tabla, a.attname AS columna,
       format_type(a.atttypid, a.atttypmod) AS tipo,
       a.attnotnull AS obligatorio
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND a.attnum > 0 AND NOT a.attisdropped
  AND (c.relname IN ('auth_sesiones', 'auth_intentos_login')
       OR (c.relname = 'usuarios' AND a.attname IN ('password', 'password_hash')))
ORDER BY c.relname, a.attnum;

-- Inventario comparable de claves, restricciones e índices del esquema.
SELECT t.relname AS tabla, c.conname AS restriccion,
       c.contype AS tipo, c.convalidated AS validada,
       pg_get_constraintdef(c.oid) AS definicion
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
ORDER BY t.relname, c.conname;

SELECT t.relname AS tabla, i.relname AS indice, x.indisvalid AS valido,
       pg_get_indexdef(i.oid) AS definicion
FROM pg_catalog.pg_index x
JOIN pg_catalog.pg_class i ON i.oid = x.indexrelid
JOIN pg_catalog.pg_class t ON t.oid = x.indrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
ORDER BY t.relname, i.relname;

ROLLBACK;
