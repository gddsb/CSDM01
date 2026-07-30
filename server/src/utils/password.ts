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
  let iterations = ITERATIONS
  let salt = Buffer.alloc(SALT_LENGTH, 0)
  let storedKey = Buffer.alloc(KEY_LENGTH, 0)
  let validFormat = false

  if (typeof storedHash === 'string' && storedHash.startsWith(PREFIX)) {
    const parts = storedHash.slice(PREFIX.length).split('$')
    if (parts.length === 3) {
      const iters = parseInt(parts[0], 10)
      const saltB64 = parts[1]
      const hashB64 = parts[2]
      if (!isNaN(iters) && saltB64 && hashB64) {
        try {
          const parsedSalt = Buffer.from(saltB64, 'base64')
          const parsedKey = Buffer.from(hashB64, 'base64')
          if (parsedKey.length === KEY_LENGTH) {
            iterations = iters
            salt = parsedSalt
            storedKey = parsedKey
            validFormat = true
          }
        } catch (e) {}
      }
    }
  }

  const derivedKey = crypto.pbkdf2Sync(
    Buffer.from(plainPassword, 'utf8'),
    salt,
    iterations,
    KEY_LENGTH,
    DIGEST,
  )

  if (!validFormat) return false

  if (storedKey.length !== derivedKey.length) return false

  return crypto.timingSafeEqual(storedKey, derivedKey)
}
