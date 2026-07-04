import bcrypt from 'bcryptjs'
import { Op } from 'sequelize'
import { User, Role } from '../models/index.js'
import { success, fail } from '../utils/response.js'

// 用户列表（支持 keyword/status/role_id 筛选）
export const list = async (req, res) => {
  try {
    const { keyword, status, role_id, page = 1, pageSize = 20 } = req.query
    const where = {}
    if (keyword) {
      where[Op.or] = [
        { username: { [Op.like]: `%${keyword}%` } },
        { real_name: { [Op.like]: `%${keyword}%` } },
        { employee_no: { [Op.like]: `%${keyword}%` } },
      ]
    }
    if (status !== undefined && status !== '') {
      const statusMap = { '启用': 1, '禁用': 0 }
      where.status = statusMap[status] !== undefined ? statusMap[status] : Number(status)
    }
    if (role_id) where.role_id = Number(role_id)

    const limit = Number(pageSize)
    const offset = (Number(page) - 1) * limit
    const { rows, count } = await User.findAndCountAll({
      where,
      include: [{ model: Role, as: 'role' }],
      limit,
      offset,
      order: [['user_id', 'DESC']],
    })
    const list = rows.map(u => {
      const item = u.toJSON()
      delete item.password
      return item
    })
    return success(res, list, '查询成功', count)
  } catch (err) {
    console.error('查询用户列表失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 用户详情（含角色信息）
export const detail = async (req, res) => {
  try {
    const { id } = req.params
    const user = await User.findOne({
      where: { user_id: id },
      include: [{ model: Role, as: 'role' }],
    })
    if (!user) return fail(res, '用户不存在', 404)
    const data = user.toJSON()
    delete data.password
    return success(res, data, '查询成功')
  } catch (err) {
    console.error('查询用户详情失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 创建用户（密码 bcrypt 加密）
export const create = async (req, res) => {
  try {
    const { username, password, real_name, employee_no, department, role_id, phone, email, status } = req.body
    if (!username || !password || !real_name) {
      return fail(res, '用户名、密码和真实姓名不能为空')
    }
    const exists = await User.findOne({ where: { username } })
    if (exists) return fail(res, '用户名已存在')
    const salt = bcrypt.genSaltSync(10)
    const hashedPassword = bcrypt.hashSync(password, salt)
    const user = await User.create({
      username,
      password: hashedPassword,
      real_name,
      employee_no,
      department,
      role_id,
      phone,
      email,
      status: status !== undefined ? status : 1,
    })
    const data = user.toJSON()
    delete data.password
    return success(res, data, '创建成功')
  } catch (err) {
    console.error('创建用户失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 修改用户
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const user = await User.findOne({ where: { user_id: id } })
    if (!user) return fail(res, '用户不存在', 404)
    const { username, password, real_name, employee_no, department, role_id, phone, email, status } = req.body
    const updateData = {
      real_name,
      employee_no,
      department,
      role_id,
      phone,
      email,
      status,
    }
    // 用户名变更时校验唯一性
    if (username && username !== user.username) {
      const exists = await User.findOne({ where: { username, user_id: { [Op.ne]: id } } })
      if (exists) return fail(res, '用户名已存在')
      updateData.username = username
    }
    // 密码非空才更新
    if (password) {
      const salt = bcrypt.genSaltSync(10)
      updateData.password = bcrypt.hashSync(password, salt)
    }
    await user.update(updateData)
    const data = user.toJSON()
    delete data.password
    return success(res, data, '修改成功')
  } catch (err) {
    console.error('修改用户失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 删除用户
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const user = await User.findOne({ where: { user_id: id } })
    if (!user) return fail(res, '用户不存在', 404)
    await user.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除用户失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 启用/禁用用户
export const toggle = async (req, res) => {
  try {
    const { id } = req.params
    const user = await User.findOne({ where: { user_id: id } })
    if (!user) return fail(res, '用户不存在', 404)
    const newStatus = user.status === '启用' ? '禁用' : '启用'
    await user.update({ status: newStatus })
    return success(res, { user_id: user.user_id, status: newStatus }, newStatus === '启用' ? '已启用' : '已禁用')
  } catch (err) {
    console.error('切换用户状态失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { list, detail, create, update, remove, toggle }
