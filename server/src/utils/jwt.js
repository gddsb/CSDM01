import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const secret = process.env.JWT_SECRET || 'default-secret'
const expiresIn = process.env.JWT_EXPIRES_IN || '2h'
const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

// 生成 access token
export function generateToken(user) {
  return jwt.sign(
    { userId: user.user_id, username: user.username, roleId: user.role_id },
    secret,
    { expiresIn }
  )
}

// 生成 refresh token
export function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.user_id, type: 'refresh' },
    secret,
    { expiresIn: refreshExpiresIn }
  )
}

// 验证 token
export function verifyToken(token) {
  try {
    return jwt.verify(token, secret)
  } catch (err) {
    return null
  }
}
