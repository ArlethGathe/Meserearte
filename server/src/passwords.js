import argon2 from 'argon2'

const defaults = Object.freeze({
  memoryCost: 32 * 1024,
  timeCost: 3,
  parallelism: 1,
})

const limits = {
  memoryCost: [19 * 1024, 64 * 1024],
  timeCost: [2, 6],
  parallelism: [1, 4],
}

const phcPattern = /^\$argon2id\$v=19\$m=([1-9][0-9]{0,4}),t=([1-9]),p=([1-9])\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/

function withinLimits(name, value) {
  const [min, max] = limits[name]
  return Number.isInteger(value) && value >= min && value <= max
}

function validPassword(password) {
  return typeof password === 'string'
    && password.length > 0
    && password.length <= 4096
    // Con el modo Unicode, un par válido no coincide con el rango de sustitutos.
    && !/[\uD800-\uDFFF]/u.test(password)
    && Buffer.byteLength(password, 'utf8') <= 4096
}

function validBase64(value, minBytes) {
  const decoded = Buffer.from(value, 'base64')
  return decoded.length >= minBytes && decoded.length <= 64
    && decoded.toString('base64').replace(/=+$/, '') === value
}

export function createPasswordProtector({
  memoryCost = defaults.memoryCost,
  timeCost = defaults.timeCost,
  parallelism = defaults.parallelism,
} = {}) {
  const cost = { memoryCost, timeCost, parallelism }

  for (const [name, value] of Object.entries(cost)) {
    if (!withinLimits(name, value)) {
      const [min, max] = limits[name]
      throw new RangeError(`${name} debe ser un entero entre ${min} y ${max}.`)
    }
  }

  async function hashPassword(password) {
    if (!validPassword(password)) {
      throw new TypeError('La contraseña debe ser texto Unicode válido de 1 a 4096 bytes UTF-8.')
    }

    return argon2.hash(password, {
      ...cost,
      type: argon2.argon2id,
      version: 0x13,
      hashLength: 32,
    })
  }

  async function verifyPassword(password, hash) {
    if (!validPassword(password) || typeof hash !== 'string' || hash.length > 256) {
      return false
    }

    const match = phcPattern.exec(hash)

    // Revisar el coste almacenado antes de invocar la operación nativa.
    if (!match || match[0] !== hash
      || !withinLimits('memoryCost', Number(match[1]))
      || !withinLimits('timeCost', Number(match[2]))
      || !withinLimits('parallelism', Number(match[3]))
      || !validBase64(match[4], 8)
      || !validBase64(match[5], 16)) {
      return false
    }

    // Los fallos operativos del motor se propagan al llamador.
    return argon2.verify(hash, password)
  }

  return { hashPassword, verifyPassword }
}

export const { hashPassword, verifyPassword } = createPasswordProtector()
