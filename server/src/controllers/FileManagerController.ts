import fs from 'fs'
import path from 'path'
import { success, fail } from '../utils/response.js'

const UPLOADS_DIR = path.resolve('uploads')

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

// 确保 uploads 目录及 reports 子目录存在
const ensureUploadsDir = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
  const reportsDir = path.join(UPLOADS_DIR, 'reports')
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }
}

// 列出指定目录的文件和子目录
export const listDirectory = async (req, res) => {
  try {
    ensureUploadsDir()

    const { dir = '' } = req.query

    // 安全检查：防止路径遍历
    const targetDir = path.resolve(UPLOADS_DIR, dir || '')
    const relativePath = path.relative(UPLOADS_DIR, targetDir)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return fail(res, '路径不合法', 400)
    }

    if (!fs.existsSync(targetDir)) {
      return fail(res, '目录不存在', 404)
    }

    const stat = fs.statSync(targetDir)
    if (!stat.isDirectory()) {
      return fail(res, '不是目录', 400)
    }

    const items = fs.readdirSync(targetDir)
    const result = []

    for (const item of items) {
      const itemPath = path.join(targetDir, item)
      try {
        const itemStat = fs.statSync(itemPath)
        const itemRelativePath = path.relative(UPLOADS_DIR, itemPath)
        result.push({
          name: item,
          path: itemRelativePath,
          isDirectory: itemStat.isDirectory(),
          size: itemStat.size,
          sizeText: formatSize(itemStat.size),
          modifiedTime: itemStat.mtime,
        })
      } catch (e) {
        // skip inaccessible files
      }
    }

    // 排序：目录在前，文件在后，按名称排序
    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })

    const currentRelativePath = path.relative(UPLOADS_DIR, targetDir)
    const parentPath = currentRelativePath ? path.dirname(currentRelativePath) : ''

    return success(res, {
      currentDir: currentRelativePath || '/',
      parentDir: parentPath === '.' ? '' : parentPath,
      items: result,
      total: result.length,
    }, '查询成功')
  } catch (err) {
    console.error('列出目录失败:', err)
    return fail(res, err.message || '查询失败', 500)
  }
}

// 删除文件或空目录
export const removeItem = async (req, res) => {
  try {
    const { path: itemPath } = req.params
    if (!itemPath) return fail(res, '路径不能为空', 400)

    // 安全检查
    const targetPath = path.resolve(UPLOADS_DIR, itemPath)
    const relativePath = path.relative(UPLOADS_DIR, targetPath)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath) || relativePath === '') {
      return fail(res, '路径不合法', 400)
    }

    if (!fs.existsSync(targetPath)) {
      return fail(res, '文件或目录不存在', 404)
    }

    const stat = fs.statSync(targetPath)
    if (stat.isDirectory()) {
      const items = fs.readdirSync(targetPath)
      if (items.length > 0) {
        return fail(res, '目录不为空，无法删除', 400)
      }
      fs.rmdirSync(targetPath)
    } else {
      fs.unlinkSync(targetPath)
    }

    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除失败:', err)
    return fail(res, err.message || '删除失败', 500)
  }
}

export default { listDirectory, removeItem }
