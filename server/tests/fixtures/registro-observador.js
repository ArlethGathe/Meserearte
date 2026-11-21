import argon2 from 'argon2'
import pg from 'pg'

for (const [clase, metodo, etiqueta] of [
  [pg.Pool, 'connect', 'conexion'],
  [pg.Client, 'query', 'sql'],
]) {
  const original = clase.prototype[metodo]
  clase.prototype[metodo] = function (...args) {
    process.send?.(args[0] === 'BEGIN' ? 'begin' : etiqueta)
    return original.apply(this, args)
  }
}

const hash = argon2.hash
argon2.hash = async (...args) => {
  process.send?.('hash-inicio')
  try {
    return await hash(...args)
  } finally {
    process.send?.('hash-fin')
  }
}

process.on('message', () => process.send?.('barrera'))
