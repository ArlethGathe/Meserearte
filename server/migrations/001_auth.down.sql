BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Evita que una escritura concurrente invalide las comprobaciones.
LOCK TABLE public.usuarios, public.auth_sesiones, public.auth_intentos_login
    IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.usuarios WHERE password_hash IS NOT NULL)
        OR EXISTS (SELECT 1 FROM public.auth_sesiones)
        OR EXISTS (SELECT 1 FROM public.auth_intentos_login)
    THEN
        RAISE EXCEPTION 'Reversión detenida: el esquema de autenticación contiene datos';
    END IF;
END;
$$;

DROP TABLE public.auth_intentos_login;
DROP TABLE public.auth_sesiones;
ALTER TABLE public.usuarios DROP COLUMN password_hash;

COMMIT;
