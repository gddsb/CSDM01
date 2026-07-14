import { Request, Response } from 'express'
import { Op } from 'sequelize'
import path from 'path'
import fs from 'fs'
import AppVersion from '../models/AppVersion.js'
import { success, fail } from '../utils/response.js'

export const getLatest = async (req: Request, res: Response): Promise<any> => {
  try {
    const { platform = 'all' } = req.query as any
    const latest = await AppVersion.findOne({
      where: {
        is_latest: 1,
        [Op.or]: [
          { platform: 'all' },
          { platform },
        ],
      },
      order: [['created_at', 'DESC']],
    })
    return success(res, latest || null, '查询成功')
  } catch (err) {
    console.error('获取最新版本失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const list = async (req: Request, res: Response): Promise<any> => {
  try {
    const { page = 1, pageSize = 20, keyword } = req.query as any
    const where: any = {}
    if (keyword) {
      where[Op.or] = [
        { version: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
      ]
    }
    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await AppVersion.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
    })
    return success(res, rows, '查询成功', count)
  } catch (err) {
    console.error('查询版本列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const create = async (req: Request, res: Response): Promise<any> => {
  try {
    const { version, platform = 'all', description, download_url, is_force = 0, file_size } = req.body
    if (!version) {
      return fail(res, '版本号不能为空')
    }
    await AppVersion.update({ is_latest: 0 }, { where: { platform: { [Op.or]: ['all', platform] } } })
    const newVersion = await AppVersion.create({
      version,
      platform,
      description,
      download_url,
      is_force,
      is_latest: 1,
      file_size,
      created_by: (req as any).user?.username || 'admin',
    })
    return success(res, newVersion, '发布成功')
  } catch (err) {
    console.error('发布版本失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const update = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params
    const { version, platform, description, download_url, is_force, is_latest, file_size } = req.body
    const record = await AppVersion.findByPk(id)
    if (!record) {
      return fail(res, '版本记录不存在', 404)
    }
    await record.update({
      version, platform, description, download_url, is_force, is_latest, file_size,
    })
    return success(res, record, '更新成功')
  } catch (err) {
    console.error('更新版本失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const remove = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params
    const record = await AppVersion.findByPk(id)
    if (!record) {
      return fail(res, '版本记录不存在', 404)
    }
    // 同步删除关联的 APK 文件
    if (record.download_url && record.download_url.includes('/uploads/apps/')) {
      const fileName = path.basename(record.download_url)
      const filePath = path.resolve(process.cwd(), 'uploads', 'apps', fileName)
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath) } catch (e: any) { console.warn('删除APK文件失败:', e.message) }
      }
    }
    await record.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除版本失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 上传 APK/IPA 安装包，返回可访问的 download_url
export const uploadPackage = async (req: Request, res: Response): Promise<any> => {
  try {
    if (!(req as any).file) {
      return fail(res, '请上传安装包文件')
    }
    const { version, platform = 'android', description, is_force = 0 } = req.body
    if (!version) {
      // 清理已上传的临时文件
      try { fs.unlinkSync((req as any).file.path) } catch (e) {}
      return fail(res, '版本号不能为空')
    }

    // 重命名文件为 {slug}-{version}-{timestamp}.apk
    const ext = path.extname((req as any).file.originalname).toLowerCase() || '.apk'
    const slug = 'dmmes'
    const fileName = `${slug}-${version}-${Date.now()}${ext}`
    const destPath = path.resolve(process.cwd(), 'uploads', 'apps', fileName)
    fs.renameSync((req as any).file.path, destPath)

    const fileSize = fs.statSync(destPath).size
    // 拼接完整下载 URL（基于请求 host）
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http'
    const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${process.env.PORT || 3001}`
    const downloadUrl = `${protocol}://${host}/uploads/apps/${fileName}`

    // 将同平台其他版本置为非最新
    await AppVersion.update({ is_latest: 0 }, { where: { platform: { [Op.or]: ['all', platform] } } })

    const newVersion = await AppVersion.create({
      version,
      platform,
      description,
      download_url: downloadUrl,
      is_force: is_force === '1' || is_force === 1 || is_force === true ? 1 : 0,
      is_latest: 1,
      file_size: formatFileSize(fileSize),
      created_by: (req as any).user?.username || 'admin',
    })

    return success(res, newVersion, 'APK 上传并发布成功')
  } catch (err) {
    console.error('上传安装包失败:', err)
    // 清理临时文件
    if ((req as any).file && (req as any).file.path && fs.existsSync((req as any).file.path)) {
      try { fs.unlinkSync((req as any).file.path) } catch (e) {}
    }
    return fail(res, '服务器错误', 500)
  }
}

// 下载指定版本的 APK（无需鉴权，方便用户直接点击链接下载）
export const downloadPackage = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params
    let record
    if (id === 'latest') {
      record = await AppVersion.findOne({
        where: { is_latest: 1, platform: { [Op.or]: ['all', 'android'] } },
        order: [['created_at', 'DESC']],
      })
    } else {
      record = await AppVersion.findByPk(id)
    }
    if (!record || !record.download_url) {
      return fail(res, '安装包不存在', 404)
    }
    const fileName = path.basename(record.download_url)
    const filePath = path.resolve(process.cwd(), 'uploads', 'apps', fileName)
    if (!fs.existsSync(filePath)) {
      return fail(res, '安装包文件已丢失', 404)
    }
    return res.download(filePath, fileName)
  } catch (err) {
    console.error('下载安装包失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(2)} ${units[i]}`
}

export default { getLatest, list, create, update, remove, uploadPackage, downloadPackage }
