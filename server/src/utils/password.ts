import crypto from 'crypto'

const ITERATIONS = 10000
const SALT_LENGTH = 16
const KEY_LENGTH = 32
const DIGEST = 'sha256'
const PREFIX = '$pbkdf2$'

export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const derivedKey = crypto.pbkdf2Sync(
    Buffer.from(plainPassword, 'utf8'),
    salt,
    ITERATIONS,
    KEY_LENGTH,
    DIGEST,
  )
  const saltB64 = salt.toString('base64')
  const hashB64 = derivedKey.toString('base64')
  return `${PREFIX}${ITERATIONS}$${saltB64}$${hashB64}`
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  if (typeof storedHash !== 'string' || !storedHash.startsWith(PREFIX)) {
    return false
  }
  const parts = storedHash.slice(PREFIX.length).split('$')
  if (parts.length !== 3) return false

  const iterations = parseInt(parts[0], 10)
  const saltB64 = parts[1]
  const hashB64 = parts[2]

  if (isNaN(iterations) || !saltB64 || !hashB64) return false

  let salt: Buffer
  let storedKey: Buffer
  try {
    salt = Buffer.from(saltB64, 'base64')
    storedKey = Buffer.from(hashB64, 'base64')
  } catch (e) {
    return false
  }

  const derivedKey = crypto.pbkdf2Sync(
    Buffer.from(plainPassword, 'utf8'),
    salt,
    iterations,
    KEY_LENGTH,
    DIGEST,
  )

  return crypto.timingSafeEqual(storedKey, derivedKey)
}
