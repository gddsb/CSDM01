import jwt, { SignOptions } from 'jsonwebtoken'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

const isProd = process.env.NODE_ENV === 'production'
const envSecret = process.env.JWT_SECRET

// 生产环境必须通过环境变量提供强随机密钥；开发环境若未配置则生成临时密钥
let secret: string
if (envSecret && envSecret.length >= 16 && envSecret !== 'default-secret') {
  secret = envSecret
} else if (isProd) {
  throw new Error('生产环境必须配置长度不少于 16 位的 JWT_SECRET 环境变量')
} else {
  // 开发环境临时密钥（每次重启会使旧 token 失效，仅用于本地开发）
  secret = crypto.randomBytes(32).toString('base64url')
  console.warn('[Security] 未配置 JWT_SECRET，开发环境已生成临时密钥（重启后旧 token 失效）。建议在 server/.env 中配置固定密钥。')
}

const expiresIn: string = process.env.JWT_EXPIRES_IN || '2h'
const refreshExpiresIn: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

// 生成 access token
export function generateToken(user: any): string {
  return jwt.sign(
    { userId: user.user_id, username: user.username, roleId: user.role_id },
    secret,
    { expiresIn } as SignOptions
  )
}

// 生成 refresh token
export function generateRefreshToken(user: any): string {
  return jwt.sign(
    { userId: user.user_id, type: 'refresh' },
    secret,
    { expiresIn: refreshExpiresIn } as SignOptions
  )
}

// 验证 token
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, secret)
  } catch (err) {
    return null
  }
}
