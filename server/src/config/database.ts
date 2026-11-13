import { Sequelize, Model } from 'sequelize'
import dotenv from 'dotenv'
import type { AnyModelStatic } from '../types/model.js'
import { logger } from "../utils/logger.js"

/**
 * 全局墙时间序列化补丁：把所有 Sequelize model 的 toJSON() 中
 * Date 类型字段统一转换成墙时间字符串 "YYYY-MM-DD HH:mm:ss"。
 *
 * 根因：MySQL DATETIME 列存墙时间原文，不做时区转换。
 *   JS Date.prototype.toJSON() 默认吐 UTC ISO（如 "T04:00:00.000Z"），
 *   导致前端拿到 -8h 偏移。patch 后前后端都以墙时间字符串透传，
 *   彻底消除中间层的时区转换。
 */
function pad2(n: number): string { return String(n).padStart(2, '0') }
function dateToWall(d: Date | unknown): unknown {
  if (!(d instanceof Date)) return d
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}
const _origToJSON = Model.prototype.toJSON
Model.prototype.toJSON = function (this: any): Record<string, any> {
  const obj: Record<string, any> = _origToJSON.call(this) as any
  if (!obj || typeof obj !== 'object') return obj
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v instanceof Date) {
      obj[k] = dateToWall(v)
    } else if (Array.isArray(v)) {
      obj[k] = v.map(item => (item instanceof Date ? dateToWall(item) : item))
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      for (const kk of Object.keys(v)) {
        const vv = v[kk]
        if (vv instanceof Date) v[kk] = dateToWall(vv)
      }
    }
  }
  return obj
}

dotenv.config()

const dialect: string = process.env.DB_DIALECT || 'mysql'

const SLOW_SQL_MS = Number(process.env.SLOW_SQL_MS || 800)

const baseOptions = {
  logging: process.env.DB_LOGGING === 'true'
    ? (sql: string, timing?: number) => {
        const duration = typeof timing === 'number' ? timing : undefined
        if (duration !== undefined && duration >= SLOW_SQL_MS) {
          logger.warn(`[SLOW SQL ${duration}ms] ${sql}`)
        }
      }
    : false,
  define: {
    timestamps: true,
    underscored: true,
  },
  benchmark: true,
}

let sequelizeInstance: Sequelize

if (dialect === 'sqlite') {
  sequelizeInstance = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './data/milk_can_mes.sqlite',
    ...baseOptions,
  })
} else {
  sequelizeInstance = new Sequelize(
    process.env.DB_NAME || 'milk_can_mes',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      dialect: dialect as 'mysql',
      // timezone:'local' 跟随服务器 TZ（Asia/Shanghai CST+0800）
      // DATETIME 列在 MySQL 中存墙时间原文不做时区转换，所以 Sequelize 不该再加一层偏移
      timezone: 'local',
      // 允许多语句执行（migrations/*.sql 和 migrate.ts 中的外键/索引创建需要）
      // 业务代码应继续用 Sequelize ORM 方法，不要拼接原始 SQL
      dialectOptions: { multipleStatements: true },
      ...baseOptions,
    }
  )
}

/**
 * 项目统一使用的 sequelize 实例。
 *
 * define 方法返回类型放宽为 AnyModelStatic，使 sequelize.define(...) 定义的模型
 * 在业务代码中可直接访问业务字段（如 user.user_pwd）而不报 TS2339。
 * 运行时行为与原生 Sequelize#define 完全一致；其余 Sequelize 静态属性（QueryTypes 等）保持原样。
 */
/**
 * 项目统一使用的 sequelize 实例。
 *
 * define 方法返回类型放宽为 AnyModelStatic，使 sequelize.define(...) 定义的模型
 * 在业务代码中可直接访问业务字段（如 user.user_pwd）而不报 TS2339。
 * 运行时行为与原生 Sequelize#define 完全一致；其余实例属性（QueryTypes/query 等）保持原样。
 */
const sequelize = sequelizeInstance as Omit<Sequelize, 'define'> & {
  define: (...args: Parameters<Sequelize['define']>) => AnyModelStatic
}

export default sequelize
