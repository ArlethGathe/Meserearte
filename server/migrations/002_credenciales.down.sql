BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

LOCK TABLE public.usuarios IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.usuarios
        WHERE estado_credencial IS DISTINCT FROM 'pendiente'
            OR password IS NULL OR password_hash IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Reversión detenida: no todas las cuentas conservan una credencial heredada';
    END IF;
END;
$$;

ALTER TABLE public.usuarios
    ALTER COLUMN password SET NOT NULL,
    DROP CONSTRAINT usuarios_credencial_coherente_ck,
    DROP COLUMN estado_credencial;

COMMIT;
