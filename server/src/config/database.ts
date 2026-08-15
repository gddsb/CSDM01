import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'
import type { AnyModelStatic } from '../types/model.js'

dotenv.config()

const dialect: string = process.env.DB_DIALECT || 'mysql'

const SLOW_SQL_MS = Number(process.env.SLOW_SQL_MS || 800)

const baseOptions = {
  logging: process.env.DB_LOGGING === 'true'
    ? (sql: string, timing?: number) => {
        const duration = typeof timing === 'number' ? timing : undefined
        if (duration !== undefined && duration >= SLOW_SQL_MS) {
          console.warn(`[SLOW SQL ${duration}ms] ${sql}`)
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
      timezone: '+08:00',
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
