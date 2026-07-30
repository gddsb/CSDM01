import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_HEX = process.env.TASK_PARAM_KEY || 'dad52b5719e3202e32a6619e14d0ccec'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const keyBuf = Buffer.from(KEY_HEX, 'hex')
  if (keyBuf.length >= KEY_LENGTH) return keyBuf.slice(0, KEY_LENGTH)
  const padded = Buffer.alloc(KEY_LENGTH)
  keyBuf.copy(padded)
  return padded
}

export function encryptParam(plaintext: string): string {
  if (!plaintext) return ''
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex')
}

export function decryptParam(encrypted: string): string {
  if (!encrypted) return ''
  const parts = encrypted.split(':')
  if (parts.length !== 3) return encrypted
  try {
    const key = getKey()
    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    const enc = Buffer.from(parts[2], 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(enc), decipher.final()])
    return dec.toString('utf8')
  } catch {
    return ''
  }
}

export function encryptParamsObj(obj: Record<string, any>, sensitiveKeys: string[] = ['password', 'loginName']): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined && v !== '' && sensitiveKeys.includes(k) && typeof v === 'string') {
      result[k] = encryptParam(v)
    } else {
      result[k] = v
    }
  }
  return result
}

export function decryptParamsObj(obj: Record<string, any>, sensitiveKeys: string[] = ['password', 'loginName']): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (sensitiveKeys.includes(k) && typeof v === 'string') {
      result[k] = decryptParam(v)
    } else {
      result[k] = v
    }
  }
  return result
}
