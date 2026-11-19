-- Consulta parametrizada para la integración futura con pg.
-- $1 ámbito, $2 digest de 32 bytes, $3 segundos de ventana, $4 límite.
-- Una fila permite el intento. Cero filas indica límite agotado.
WITH ventana AS (
    SELECT date_bin(
        make_interval(secs => $3::integer),
        statement_timestamp(),
        timestamptz '2000-01-01 00:00:00+00'
    ) AS inicio
)
INSERT INTO public.auth_intentos_login AS contador
    (ambito, clave_digest, ventana_inicio, expira_en, intentos)
SELECT $1::text, $2::bytea, inicio, inicio + make_interval(secs => $3::integer), 1
FROM ventana
WHERE $4::integer > 0
ON CONFLICT (ambito, clave_digest, ventana_inicio)
DO UPDATE SET intentos = contador.intentos + 1
WHERE contador.intentos < $4::integer
RETURNING intentos, expira_en;
