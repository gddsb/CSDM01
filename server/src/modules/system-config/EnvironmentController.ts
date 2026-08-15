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

    // 系统启动时间
    const uptime = process.uptime()

    // CPU 使用率 - 使用500ms采样计算
    let cpuUsagePercent = 0
    try {
      const cpus1 = os.cpus()
      await new Promise(resolve => setTimeout(resolve, 500))
      const cpus2 = os.cpus()
      let totalIdle = 0, totalTick = 0
      for (let i = 0; i < cpus2.length; i++) {
        const c1 = cpus1[i].times, c2 = cpus2[i].times
        const idle = c2.idle - c1.idle
        const total = (c2.user - c1.user) + (c2.nice - c1.nice) + (c2.sys - c1.sys) +
                      (c2.idle - c1.idle) + (c2.irq - c1.irq)
        totalTick += total
        totalIdle += idle
      }
      if (totalTick > 0) {
        cpuUsagePercent = Math.round(((totalTick - totalIdle) / totalTick) * 100 * 10) / 10
      }
    } catch (err: any) {
      logger.warn('[SilentCatch] /* ignore */', err?.message)
    }

    return success(res, {
      // 基础信息
      nodeVersion: process.version,
      platform: platform,
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: uptime,
      // 资源信息
      memoryUsage: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
      },
      memoryTotal: os.totalmem(),
      memoryFree: os.freemem(),
      cpuUsage: cpuUsagePercent,
      cpuModel: os.cpus()[0]?.model || 'N/A',
      cpuCores: os.cpus().length,
      // 技术栈
      techStack: {
        backend: {
          runtime: 'Node.js',
          framework: 'Express',
          version: getDepVersion(backendPkg, 'express'),
          orm: 'Sequelize',
          ormVersion: getDepVersion(backendPkg, 'sequelize'),
          database: process.env.DB_DIALECT === 'mysql' ? 'MySQL' : 'SQLite',
        },
        frontend: {
          framework: 'React',
          version: getDepVersion(frontendPkg, 'react'),
          buildTool: 'Vite',
          buildToolVersion: getDepVersion(frontendPkg, 'vite'),
          language: 'TypeScript',
          tsVersion: getDepVersion(frontendPkg, 'typescript'),
          ui: 'Ant Design',
          uiVersion: getDepVersion(frontendPkg, 'antd'),
        },
      },
      // 配置信息
      config: {
        port: process.env.PORT || 3001,
        environment: process.env.NODE_ENV || 'development',
        timezone: process.env.TZ || 'Asia/Shanghai',
        logLevel: process.env.LOG_LEVEL || 'info',
        uploadPath: process.env.UPLOAD_PATH || 'uploads',
        jwtExpire: process.env.JWT_EXPIRE || '7d',
      }
    }, '获取运行环境成功')
  } catch (err: any) {
    logger.error('获取运行环境失败:', err)
    return fail(res, '获取运行环境失败', ErrorCode.SYSTEM_ERROR)
  }
}

export const restartServer = async (req: Request, res: Response) => {
  try {
    logger.info('收到服务器重启指令，5秒后退出进程...')

    return success(res, null, '重启指令已接收，服务将在5秒后重启')

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
