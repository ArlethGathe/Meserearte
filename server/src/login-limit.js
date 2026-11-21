import { createHmac, randomBytes } from 'node:crypto'
import { performance } from 'node:perf_hooks'

export function crearLimitadorIntentos(config, reloj = () => performance.now()) {
  const { ventanaMs, maxPorIp, maxPorIpCorreo, maxClaves } = config
  const claveProceso = randomBytes(32)
  const contadores = new Map()
  const clave = (...partes) => createHmac('sha256', claveProceso)
    .update(JSON.stringify(partes))
    .digest('hex')

  return {
    reservar(ip, correo) {
      const ahora = reloj()

      // Las entradas conservan el orden de vencimiento con una ventana común.
      for (const [id, contador] of contadores) {
        if (contador.expiraEn > ahora) break
        contadores.delete(id)
      }

      const ids = [clave('ip', ip), clave('ip_correo', ip, correo)]
      const existentes = ids.map((id) => contadores.get(id))
      const topes = [maxPorIp, maxPorIpCorreo]
      let esperaMs = 0
      let nuevas = 0

      for (const [posicion, contador] of existentes.entries()) {
        if (!contador) nuevas++
        else if (contador.intentos >= topes[posicion]) {
          esperaMs = Math.max(esperaMs, contador.expiraEn - ahora)
        }
      }

      let espaciosNecesarios = contadores.size + nuevas - maxClaves
      for (const [id, contador] of contadores) {
        if (espaciosNecesarios <= 0) break
        if (ids.includes(id)) continue
        esperaMs = Math.max(esperaMs, contador.expiraEn - ahora)
        espaciosNecesarios--
      }

      if (esperaMs > 0) {
        return { permitido: false, retryAfter: Math.ceil(esperaMs / 1000) }
      }

      for (const [posicion, id] of ids.entries()) {
        const contador = existentes[posicion]
        if (contador) contador.intentos++
        else contadores.set(id, { intentos: 1, expiraEn: ahora + ventanaMs })
      }
      return { permitido: true }
    },
  }
}

export function limitarIntentos(limitador, normalizarCorreo) {
  return async (req, res, next) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'origen-desconocido'
    const correo = normalizarCorreo(req.body?.correo)
    const resultado = await limitador.reservar(ip, correo)

    if (!resultado.permitido) {
      return res.set('Retry-After', String(resultado.retryAfter)).status(429).json({
        ok: false,
        mensaje: 'Demasiados intentos. Intenta de nuevo más tarde.',
      })
    }

    return next()
  }
}

export { crearLimitadorIntentos as crearLimitadorLogin, limitarIntentos as limitarLogin }
