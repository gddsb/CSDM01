import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import routes from './routes/index.js'
import sequelize from './config/database.js'
import { initDefaultConfigs } from './controllers/SystemConfigController.js'
import { initDefaultPermissions } from './controllers/RoleController.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// 同步数据库表
async function initDatabase() {
  try {
    // 只创建不存在的表，不修改已有表结构
    await sequelize.sync()
    console.log('✅ 数据库表同步完成')
    // 初始化默认系统配置
    await initDefaultConfigs()
    console.log('✅ 系统配置初始化完成')
    // 初始化默认权限数据
    await initDefaultPermissions()
    console.log('✅ 默认权限初始化完成')
  } catch (err) {
    console.error('❌ 数据库初始化失败:', err.message)
    if (err.errors) {
      err.errors.forEach(e => console.error('  -', e.message, e.path, e.value))
    }
  }
}
initDatabase()

// 中间件
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Milk Can MES API Server is running' })
})

// API 路由
app.use('/api', routes)

// 404 处理
app.use((req, res) => {
  res.status(404).json({ success: false, message: `接口不存在: ${req.method} ${req.path}` })
})

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err)
  res.status(500).json({ success: false, message: '服务器内部错误' })
})

app.listen(PORT, () => {
  console.log(`\n🚀 Milk Can MES API Server`)
  console.log(`   运行地址: http://localhost:${PORT}`)
  console.log(`   API基础路径: http://localhost:${PORT}/api`)
  console.log(`   健康检查: http://localhost:${PORT}/api/health\n`)
})
