import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import argon2 from 'argon2'
import { createPasswordProtector, hashPassword, verifyPassword } from '../src/passwords.js'

const password = 'Credencial ficticia de ensayo 🔐'
let hash

before(async () => {
  hash = await hashPassword(password)
})

test('genera un PHC Argon2id con el coste predeterminado y verifica la contraseña', async () => {
  assert.match(hash, /^\$argon2id\$v=19\$m=32768,t=3,p=1\$/)
  assert.equal(await verifyPassword(password, hash), true)
  assert.equal(await verifyPassword('otra credencial ficticia', hash), false)
})

test('usa sales aleatorias y verifica los dos hashes', async () => {
  const second = await hashPassword(password)
  assert.notEqual(second.split('$')[4], hash.split('$')[4])
  assert.notEqual(second, hash)
  assert.equal(await verifyPassword(password, hash), true)
  assert.equal(await verifyPassword(password, second), true)
})

test('almacena el coste configurado y los verificadores leen el coste del PHC', async () => {
  const configured = createPasswordProtector({ memoryCost: 24576, timeCost: 2, parallelism: 2 })
  const encoded = await configured.hashPassword(password)
  assert.match(encoded, /^\$argon2id\$v=19\$m=24576,t=2,p=2\$/)
  assert.equal(await verifyPassword(password, encoded), true)
  assert.equal(await configured.verifyPassword(password, hash), true)
})

test('acepta un PHC válido de la biblioteca con otra longitud de salida', async () => {
  const encoded = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 32768,
    timeCost: 3,
    parallelism: 1,
    hashLength: 24,
  })
  assert.equal(await verifyPassword(password, encoded), true)
})

test('rechaza entradas vacías, no textuales, demasiado largas o Unicode inválido', async () => {
  for (const invalid of ['', null, 1, 'a'.repeat(4097), 'é'.repeat(2049), '\uD800']) {
    await assert.rejects(hashPassword(invalid), TypeError)
    assert.equal(await verifyPassword(invalid, hash), false)
  }
  const atLimit = 'é'.repeat(2048)
  assert.equal(await verifyPassword(atLimit, await hashPassword(atLimit)), true)
})

test('rechaza costes de configuración fuera de límites o que no sean enteros', () => {
  const invalid = [
    { memoryCost: 19455 }, { memoryCost: 65537 }, { memoryCost: '32768' },
    { timeCost: 1 }, { timeCost: 7 }, { timeCost: 2.5 },
    { parallelism: 0 }, { parallelism: 5 },
  ]
  for (const config of invalid) {
    assert.throws(() => createPasswordProtector(config), RangeError)
  }
})

test('devuelve false para hashes inválidos y evita invocar Argon2 ante costes peligrosos', async (t) => {
  const engine = t.mock.method(argon2, 'verify', () => {
    assert.fail('Se invocó Argon2 para un PHC rechazable')
  })

  for (const invalid of [
    null, 'no es un PHC', hash + '\n', hash.replace('argon2id', 'argon2i'),
    hash.replace('v=19', 'v=16'), hash.replace('m=32768', 'm=65537'),
    hash.replace('m=32768', 'm=19455'), hash.replace('t=3', 't=7'),
    hash.replace('p=1', 'p=5'), hash.replace('p=1', 'p=1,p=4'),
    hash.slice(0, hash.lastIndexOf('$') + 1) + 'A',
    hash.slice(0, -1) + '=',
  ]) {
    assert.equal(await verifyPassword(password, invalid), false)
  }

  assert.equal(engine.mock.callCount(), 0)
})

test('propaga un fallo interno inesperado del motor', async (t) => {
  const failure = new Error('fallo simulado')
  t.mock.method(argon2, 'verify', async () => { throw failure })
  await assert.rejects(verifyPassword(password, hash), error => error === failure)
})
