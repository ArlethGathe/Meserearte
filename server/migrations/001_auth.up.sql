BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- La columna legada y sus restricciones se conservan en esta etapa.
ALTER TABLE public.usuarios ADD COLUMN password_hash text;

CREATE TABLE public.auth_sesiones (
    token_digest bytea PRIMARY KEY,
    usuario_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    creada_en timestamptz NOT NULL DEFAULT statement_timestamp(),
    expira_inactividad_en timestamptz NOT NULL,
    expira_absoluta_en timestamptz NOT NULL,
    revocada_en timestamptz,
    CONSTRAINT auth_sesiones_digest_ck CHECK (octet_length(token_digest) = 32),
    CONSTRAINT auth_sesiones_vigencia_ck CHECK (
        creada_en < expira_inactividad_en
        AND expira_inactividad_en <= expira_absoluta_en
    ),
    CONSTRAINT auth_sesiones_revocacion_ck CHECK (revocada_en >= creada_en)
);

CREATE INDEX auth_sesiones_usuario_idx ON public.auth_sesiones (usuario_id);
CREATE INDEX auth_sesiones_expiracion_idx ON public.auth_sesiones (expira_inactividad_en);

CREATE TABLE public.auth_intentos_login (
    ambito text NOT NULL,
    clave_digest bytea NOT NULL,
    ventana_inicio timestamptz NOT NULL,
    expira_en timestamptz NOT NULL,
    intentos integer NOT NULL,
    PRIMARY KEY (ambito, clave_digest, ventana_inicio),
    CONSTRAINT auth_intentos_ambito_ck CHECK (ambito IN ('ip', 'ip_correo')),
    CONSTRAINT auth_intentos_digest_ck CHECK (octet_length(clave_digest) = 32),
    CONSTRAINT auth_intentos_ventana_ck CHECK (ventana_inicio < expira_en),
    CONSTRAINT auth_intentos_total_ck CHECK (intentos > 0)
);

CREATE INDEX auth_intentos_expiracion_idx ON public.auth_intentos_login (expira_en);

COMMIT;
