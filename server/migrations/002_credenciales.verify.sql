BEGIN READ ONLY;

SELECT current_database() AS base,
       current_setting('transaction_read_only') AS solo_lectura;

SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'usuarios'
    AND column_name IN ('password', 'password_hash', 'estado_credencial')
ORDER BY ordinal_position;

SELECT conname, convalidated, pg_get_constraintdef(oid) AS definicion
FROM pg_catalog.pg_constraint
WHERE conrelid = 'public.usuarios'::regclass
    AND conname = 'usuarios_credencial_coherente_ck';

ROLLBACK;
