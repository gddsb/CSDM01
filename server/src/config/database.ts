import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'

dotenv.config()

const dialect: string = process.env.DB_DIALECT || 'mysql'

let sequelize: Sequelize

if (dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './data/milk_can_mes.sqlite',
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
    },
  })
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'milk_can_mes',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      dialect: (dialect as any) || 'mysql',
      timezone: '+08:00',
      logging: false,
      define: {
        timestamps: true,
        underscored: true,
      },
    }
  )
}

export default sequelize
