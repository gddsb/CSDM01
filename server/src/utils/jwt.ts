import jwt, { SignOptions } from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const secret: string = process.env.JWT_SECRET || 'default-secret'
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
