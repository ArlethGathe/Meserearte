BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE public.auth_restablecimiento (
    usuario_id integer PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    token_digest bytea NOT NULL UNIQUE CHECK (octet_length(token_digest) = 32),
    expira_en timestamptz NOT NULL
);
COMMIT;
