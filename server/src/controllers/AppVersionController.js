import { Op } from 'sequelize'
import AppVersion from '../models/AppVersion.js'
import { success, fail } from '../utils/response.js'

export const getLatest = async (req, res) => {
  try {
    const { platform = 'all' } = req.query
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

export const list = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword } = req.query
    const where = {}
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

export const create = async (req, res) => {
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
      created_by: req.user?.username || 'admin',
    })
    return success(res, newVersion, '发布成功')
  } catch (err) {
    console.error('发布版本失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export const update = async (req, res) => {
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

export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const record = await AppVersion.findByPk(id)
    if (!record) {
      return fail(res, '版本记录不存在', 404)
    }
    await record.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除版本失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { getLatest, list, create, update, remove }
