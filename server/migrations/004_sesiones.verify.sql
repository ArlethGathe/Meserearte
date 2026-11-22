BEGIN READ ONLY;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'auth_sesiones'
ORDER BY ordinal_position;
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definicion
FROM pg_catalog.pg_constraint
WHERE conrelid = 'public.auth_sesiones'::regclass
ORDER BY conname;
ROLLBACK;
