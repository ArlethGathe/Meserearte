BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.auth_sesiones
    DROP CONSTRAINT auth_sesiones_actividad_ck,
    DROP COLUMN ultima_actividad;
COMMIT;
