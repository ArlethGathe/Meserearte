BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TABLE public.auth_restablecimiento;
COMMIT;
