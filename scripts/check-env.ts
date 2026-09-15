#!/usr/bin/env tsx
/**
 * 环境变量校验脚本
 *
 * 用途：CI 流水线 / 部署前的配置健康检查，独立于 Express 运行
 * 用法：
 *   tsx scripts/check-env.ts [--production]
 *   # 或在 server/ 目录下：
 *   NODE_ENV=production npx tsx ../scripts/check-env.ts
 *
 * 退出码：0 = 通过；1 = 有错误
 */

import { config as loadEnv } from 'dotenv'
import path from 'path'
import crypto from 'crypto'

// 优先加载 server/.env（脚本在根目录 scripts/ 下运行）
loadEnv({ path: path.resolve(process.cwd(), 'server', '.env') })
// 兼容：如果脚本在 server/ 目录下直接运行也能加载
loadEnv()

const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--production')

interface CheckResult {
  ok: boolean
  category: string
  message: string
}

const results: CheckResult[] = []

function check(ok: boolean, category: string, message: string) {
  results.push({ ok, category, message })
}

console.log(`\n🔍 环境变量校验（模式: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}）\n`)

// ========== JWT 密钥 ==========
{
  const secret = process.env.JWT_SECRET
  if (!secret) {
    check(!isProd, 'JWT', 'JWT_SECRET 未配置（开发环境会自动生成临时密钥；生产必须显式设置）')
  } else if (secret === 'default-secret') {
    check(false, 'JWT', 'JWT_SECRET 仍是默认值 "default-secret"，请替换为强随机密钥')
  } else if (secret.length < 16) {
    check(false, 'JWT', `JWT_SECRET 长度仅 ${secret.length} 位，要求 ≥16 位`)
  } else {
    check(true, 'JWT', `JWT_SECRET 已配置（${secret.length} 位）`)
  }
}

// ========== 数据库 ==========
{
  const dialect = process.env.DB_DIALECT || 'mysql'
  check(true, 'DB', `DB_DIALECT = ${dialect}`)

  if (isProd && dialect === 'sqlite') {
    check(false, 'DB', '生产环境禁止使用 SQLite，请设置 DB_DIALECT=mysql')
  }

  if (dialect === 'mysql') {
    const missing: string[] = []
    if (!process.env.DB_HOST) missing.push('DB_HOST')
    if (!process.env.DB_USER) missing.push('DB_USER')
    if (!process.env.DB_NAME) missing.push('DB_NAME')
    if (!process.env.DB_PASSWORD && isProd) missing.push('DB_PASSWORD（生产必填）')
    if (missing.length > 0) {
      check(false, 'DB', `MySQL 缺少配置: ${missing.join(', ')}`)
    } else {
      check(true, 'DB', `MySQL host=${process.env.DB_HOST || '(default)'} db=${process.env.DB_NAME || '(default)'}`)
    }
  }
}

// ========== CORS ==========
{
  const cors = process.env.CORS_ORIGIN
  if (isProd && !cors) {
    console.warn('  ⚠️  [CORS] 生产环境未设置 CORS_ORIGIN，将允许所有来源')
  } else if (cors) {
    console.log(`  ✅  [CORS] CORS_ORIGIN = ${cors}`)
  } else {
    console.log('  ℹ️   [CORS] 开发环境：允许所有来源')
  }
}

// ========== 密钥强度提示（弱熵检测） ==========
{
  const secret = process.env.JWT_SECRET
  if (secret && secret.length >= 16) {
    // 简单熵估算：ASCII 可打印字符集
    const uniqueChars = new Set(secret.split('')).size
    const estimatedBits = secret.length * Math.log2(uniqueChars || 1)
    if (estimatedBits < 64) {
      console.warn(`  ⚠️  [Strength] JWT_SECRET 熵约 ${estimatedBits.toFixed(0)} bits，建议 ≥ 128 bits`)
      console.warn('       生成强密钥：node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"')
    } else {
      console.log(`  ✅  [Strength] JWT_SECRET 熵约 ${estimatedBits.toFixed(0)} bits`)
    }
  }
}

// ========== 汇总 ==========
const passed = results.filter(r => r.ok).length
const failed = results.filter(r => !r.ok).length

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
if (failed === 0) {
  console.log(`  ✅  全部通过 (${passed} 项)`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  process.exit(0)
} else {
  console.log(`  ❌  存在问题：${failed} 项失败，${passed} 项通过`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  for (const r of results.filter(r => !r.ok)) {
    console.log(`  ❌  [${r.category}] ${r.message}`)
  }
  console.log(`\n  请参考 server/.env.example 补齐配置\n`)
  process.exit(1)
}
