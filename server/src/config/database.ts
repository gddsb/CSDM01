import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'

dotenv.config()

const dialect: string = process.env.DB_DIALECT || 'sqlite'

let sequelize: Sequelize

if (dialect === 'mysql') {
  // MySQL 配置（生产环境）
  sequelize = new Sequelize(
    process.env.DB_NAME || 'milk_can_mes',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      dialect: 'mysql',
      logging: false,
      define: {
        timestamps: true,
        underscored: true,
      },
    }
  )
} else {
  // SQLite 配置（开发环境，无需安装数据库）
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './data/milk_can_mes.sqlite',
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
    },
  })
}

export default sequelize
