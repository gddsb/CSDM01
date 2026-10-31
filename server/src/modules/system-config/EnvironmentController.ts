import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { success, fail, ErrorCode } from '../../utils/response'
import logger from '../../utils/logger'

export const getEnvironment = async (req: Request, res: Response) => {
  try {
    const mem = process.memoryUsage()

    // 读取后端 package.json 获取版本
    let backendPkg: any = {}
    try {
      const pkgPath = path.resolve(process.cwd(), 'package.json')
      backendPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    } catch (err: any) {
        logger.warn('[SilentCatch] /* ignore */', err?.message)
    }

    // 读取前端 package.json 获取版本
    let frontendPkg: any = {}
    try {
      const pkgPath = path.resolve(process.cwd(), '..', 'package.json')
      frontendPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    } catch (err: any) {
        logger.warn('[SilentCatch] /* ignore */', err?.message)
    }

    const getDepVersion = (pkg: any, name: string) => {
      if (!pkg) return 'unknown'
      let v = pkg.dependencies?.[name]
      if (!v) v = pkg.devDependencies?.[name]
      return v ? v.replace(/^[\^~]/, '') : 'unknown'
    }

    const platform = os.platform() === 'win32' ? 'Windows' : os.platform() === 'darwin' ? 'macOS' : 'Linux'

    // 进程运行时长
    const uptime = process.uptime()
    const osUptime = os.uptime()

    // 磁盘信息
    let diskTotal = 0, diskFree = 0, diskUsed = 0, diskUsedPercent = 0, diskMount = '/'
    try {
      const stat = fs.statfsSync(process.cwd())
      diskTotal = Number(stat.blocks) * Number(stat.bsize)
      diskFree = Number(stat.bavail) * Number(stat.bsize)
      diskUsed = diskTotal - diskFree
      diskUsedPercent = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 1000) / 10 : 0
    } catch (err: any) {
      logger.warn('[SilentCatch] disk stat error', err?.message)
    }

    // 系统时间 (北京时间 ISO 字符串)
    const now = new Date()
    const serverTime = now.toISOString()

    // 前端服务器信息 - 从环境变量推导
    const frontendPort = Number(process.env.FRONTEND_PORT) || (process.env.NODE_ENV === 'production' ? 80 : 5173)
    const backendPort = Number(process.env.PORT) || 3001

    // 数据库驱动信息
    const dbDialect = process.env.DB_DIALECT === 'mysql' ? 'mysql' : 'sqlite'
    const dbDriverKey = dbDialect === 'mysql' ? 'mysql2' : 'sqlite3'
    const dbDisplayName = dbDialect === 'mysql' ? 'MySQL' : 'SQLite'

    return success(res, {
      // 基础信息 - 与前端 EnvInfo 接口对齐（snake_case）
      node_version: process.version,
      env: process.env.NODE_ENV || 'development',
      sequelize_version: getDepVersion(backendPkg, 'sequelize'),
      pid: process.pid,
      frontend_server: {
        name: '前端服务器',
        status: 'running',
        port: frontendPort,
      },
      backend_server: {
        name: '后端服务器',
        status: 'running',
        port: backendPort,
      },
      uptime: uptime,
      memory_rss: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
      memory_heap_used: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
      memory_heap_total: Math.round(mem.heapTotal / 1024 / 1024 * 10) / 10,
      cpu_count: os.cpus().length,
      os_uptime: osUptime,
      disk_used_percent: diskUsedPercent,
      disk_free: diskFree,
      os_version: `${platform} ${os.release()}`,
      platform: platform,
      os_type: os.type(),
      os_release: os.release(),
      os_hostname: os.hostname(),
      cpu_model: os.cpus()[0]?.model || '',
      disk_total: diskTotal,
      disk_used: diskUsed,
      disk_mount: diskMount,
      cwd: process.cwd(),
      server_time: serverTime,
      tech_stack: {
        frontend: {
          version: getDepVersion(frontendPkg, 'react'),
          items: [
            { category: '框架', key: 'React', version: getDepVersion(frontendPkg, 'react') },
            { category: '语言', key: 'TypeScript', version: getDepVersion(frontendPkg, 'typescript') },
            { category: '构建', key: 'Vite', version: getDepVersion(frontendPkg, 'vite') },
            { category: 'UI', key: 'Ant Design', version: getDepVersion(frontendPkg, 'antd') },
            { category: '移动UI', key: 'Ant Design Mobile', version: getDepVersion(frontendPkg, 'antd-mobile') },
            { category: '移动端容器', key: 'Capacitor', version: getDepVersion(frontendPkg, '@capacitor/core') },
            { category: '路由', key: 'React Router', version: getDepVersion(frontendPkg, 'react-router-dom') },
            { category: 'HTTP', key: 'Axios', version: getDepVersion(frontendPkg, 'axios') },
            { category: '数据获取', key: 'TanStack Query', version: getDepVersion(frontendPkg, '@tanstack/react-query') },
            { category: '日期', key: 'dayjs', version: getDepVersion(frontendPkg, 'dayjs') },
            { category: '图表', key: 'ECharts', version: getDepVersion(frontendPkg, 'echarts') },
            { category: 'Excel', key: 'XLSX', version: getDepVersion(frontendPkg, 'xlsx') },
          ],
        },
        backend: {
          version: getDepVersion(backendPkg, 'express'),
          items: [
            { category: '运行时', key: 'Node.js', version: process.version.replace(/^v/, '') },
            { category: '框架', key: 'Express', version: getDepVersion(backendPkg, 'express') },
            { category: '语言', key: 'TypeScript', version: getDepVersion(backendPkg, 'typescript') },
            { category: 'ORM', key: 'Sequelize', version: getDepVersion(backendPkg, 'sequelize') },
            { category: '数据库', key: dbDisplayName, version: getDepVersion(backendPkg, dbDriverKey) },
            { category: '鉴权', key: 'JWT', version: getDepVersion(backendPkg, 'jsonwebtoken') },
            { category: '加密', key: 'bcryptjs', version: getDepVersion(backendPkg, 'bcryptjs') },
            { category: '文件上传', key: 'Multer', version: getDepVersion(backendPkg, 'multer') },
            { category: '参数校验', key: 'Zod', version: getDepVersion(backendPkg, 'zod') },
            { category: '跨域', key: 'CORS', version: getDepVersion(backendPkg, 'cors') },
            { category: '环境变量', key: 'dotenv', version: getDepVersion(backendPkg, 'dotenv') },
            { category: '数据库迁移', key: 'Umzug', version: getDepVersion(backendPkg, 'umzug') },
          ],
        },
      },
    }, '获取运行环境成功')
  } catch (err: any) {
    logger.error('获取运行环境失败:', err)
    return fail(res, '获取运行环境失败', ErrorCode.SYSTEM_ERROR)
  }
}

export const restartServer = async (req: Request, res: Response) => {
  try {
    logger.info('收到服务器重启指令，5秒后退出进程...')

    // 先返回响应，确保客户端收到确认
    success(res, null, '重启指令已接收，服务将在5秒后重启')

    // 延迟退出，确保响应已发送
    // 注意：生产环境应由 PM2/Docker 等进程管理器自动重启
    setTimeout(() => {
      logger.info('正在退出进程，等待进程管理器重启...')
      process.exit(0)
    }, 5000)
  } catch (err: any) {
    logger.error('重启服务器失败:', err)
    return fail(res, '重启服务器失败', ErrorCode.SYSTEM_ERROR)
  }
}
