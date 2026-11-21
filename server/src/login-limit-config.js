export function leerConfiguracionLimiteLogin(env = process.env) {
  const entero = (clave, valorInicial, maximo) => {
    const valor = env[clave] ?? String(valorInicial)
    if (typeof valor !== 'string' || valor.trim() !== valor
      || !/^[1-9][0-9]*$/.test(valor) || Number(valor) > maximo) {
      throw new RangeError(`${clave} debe ser un entero entre 1 y ${maximo}.`)
    }
    return Number(valor)
  }

  const ventanaSegundos = entero('LOGIN_WINDOW_SECONDS', 60, 3600)
  const maxPorIp = entero('LOGIN_MAX_PER_IP', 30, 1000)
  const maxPorIpCorreo = entero('LOGIN_MAX_PER_IP_EMAIL', 5, 1000)
  const maxClaves = entero('LOGIN_MAX_KEYS', 10000, 100000)

  if (maxPorIpCorreo > maxPorIp || maxClaves < 2) {
    throw new RangeError('El límite por IP y correo no puede superar el límite por IP y se necesitan al menos dos claves.')
  }

  return { ventanaMs: ventanaSegundos * 1000, maxPorIp, maxPorIpCorreo, maxClaves }
}
