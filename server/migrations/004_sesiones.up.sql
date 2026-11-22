BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.auth_sesiones ADD COLUMN ultima_actividad timestamptz;
UPDATE public.auth_sesiones SET ultima_actividad = creada_en;
ALTER TABLE public.auth_sesiones
    ALTER COLUMN ultima_actividad SET NOT NULL,
    ADD CONSTRAINT auth_sesiones_actividad_ck CHECK (
        creada_en <= ultima_actividad AND ultima_actividad < expira_inactividad_en
    );
COMMIT;
