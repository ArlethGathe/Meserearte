BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.usuarios
    ADD COLUMN estado_credencial text NOT NULL DEFAULT 'pendiente',
    ALTER COLUMN password DROP NOT NULL,
    ADD CONSTRAINT usuarios_credencial_coherente_ck CHECK (
        (estado_credencial = 'pendiente'
            AND password IS NOT NULL AND password_hash IS NULL)
        OR (estado_credencial = 'migrada'
            AND password IS NULL AND password_hash IS NOT NULL
            AND password_hash ~ '^[$]argon2id[$]v=19[$]m=[0-9]+,t=[0-9]+,p=[0-9]+[$][A-Za-z0-9+/]+[$][A-Za-z0-9+/]+$')
        OR (estado_credencial = 'requiere_restablecimiento'
            AND password IS NULL AND password_hash IS NULL)
    );

COMMIT;
