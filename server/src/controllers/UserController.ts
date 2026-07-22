import bcrypt from 'bcryptjs'
import { Op } from 'sequelize'
import { User, Role } from '../models/index.js'
import { success, fail, ErrorCode, MAX_PAGE_SIZE } from '../utils/response.js'
import path from 'path'
import fs from 'fs'

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

    const limit = Math.min(Number(pageSize), MAX_PAGE_SIZE)
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
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
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
    if (!user) return fail(res, '用户不存在', ErrorCode.RECORD_NOT_FOUND)
    const data = user.toJSON()
    delete data.password
    return success(res, data, '查询成功')
  } catch (err) {
    console.error('查询用户详情失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
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
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 修改用户
export const update = async (req, res) => {
  try {
    const { id } = req.params
    const user = await User.findOne({ where: { user_id: id } })
    if (!user) return fail(res, '用户不存在', ErrorCode.RECORD_NOT_FOUND)
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
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 删除用户
export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const user = await User.findOne({ where: { user_id: id } })
    if (!user) return fail(res, '用户不存在', ErrorCode.RECORD_NOT_FOUND)
    await user.destroy()
    return success(res, null, '删除成功')
  } catch (err) {
    console.error('删除用户失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 启用/禁用用户
export const toggle = async (req, res) => {
  try {
    const { id } = req.params
    const user = await User.findOne({ where: { user_id: id } })
    if (!user) return fail(res, '用户不存在', ErrorCode.RECORD_NOT_FOUND)
    const newStatus = user.status === '启用' ? '禁用' : '启用'
    await user.update({ status: newStatus })
    return success(res, { user_id: user.user_id, status: newStatus }, newStatus === '启用' ? '已启用' : '已禁用')
  } catch (err) {
    console.error('切换用户状态失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 上传当前用户自定义头像（multipart/form-data，字段名 avatar）
export const uploadMyAvatar = async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
    const file = req.file
    if (!file) return fail(res, '请选择要上传的头像图片')
    // 限制 2MB
    if (file.size > 2 * 1024 * 1024) {
      // 清理临时文件
      try { fs.unlinkSync(file.path) } catch (e) {}
      return fail(res, '头像图片不能超过 2MB')
    }
    // 仅允许图片类型
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      try { fs.unlinkSync(file.path) } catch (e) {}
      return fail(res, '请上传图片格式的文件')
    }
    // 保存到 /uploads/avatars 目录
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'avatars')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    const ext = path.extname(file.originalname || '.png').toLowerCase() || '.png'
    const filename = `avatar_${userId}_${Date.now()}${ext}`
    const targetPath = path.join(uploadsDir, filename)
    fs.renameSync(file.path, targetPath)
    const avatarUrl = `/uploads/avatars/${filename}`
    // 更新用户头像
    const user = await User.findOne({ where: { user_id: userId } })
    if (!user) return fail(res, '用户不存在', ErrorCode.RECORD_NOT_FOUND)
    // 删除旧的自定义头像文件（如果是上传类型）
    if (user.avatar_url && user.avatar_url.startsWith('/uploads/avatars/')) {
      const oldPath = path.resolve(process.cwd(), user.avatar_url.replace(/^\//, ''))
      try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath) } catch (e) {}
    }
    await user.update({ avatar_url: avatarUrl })
    const data = user.toJSON()
    delete data.password
    return success(res, { avatar_url: avatarUrl, user: data }, '头像上传成功')
  } catch (err) {
    console.error('上传头像失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 设置当前用户头像（从预设头像中选择，JSON: { avatar_url })
export const setMyAvatar = async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
    const { avatar_url } = req.body
    if (!avatar_url || typeof avatar_url !== 'string') {
      return fail(res, '头像地址不能为空')
    }
    // 允许的预设头像来源（DiceBear API）和已上传的自定义头像
    const isPreset = avatar_url.startsWith('https://api.dicebear.com/')
    const isUploaded = avatar_url.startsWith('/uploads/avatars/')
    if (!isPreset && !isUploaded) {
      return fail(res, '头像地址不合法')
    }
    const user = await User.findOne({ where: { user_id: userId } })
    if (!user) return fail(res, '用户不存在', ErrorCode.RECORD_NOT_FOUND)
    // 如果旧头像是上传的自定义头像，且新头像不同，则删除旧文件
    if (
      user.avatar_url &&
      user.avatar_url.startsWith('/uploads/avatars/') &&
      user.avatar_url !== avatar_url
    ) {
      const oldPath = path.resolve(process.cwd(), user.avatar_url.replace(/^\//, ''))
      try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath) } catch (e) {}
    }
    await user.update({ avatar_url })
    const data = user.toJSON()
    delete data.password
    return success(res, { avatar_url, user: data }, '头像设置成功')
  } catch (err) {
    console.error('设置头像失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

// 更新当前用户个人信息（手机、邮箱、真实姓名）
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) return fail(res, '未登录', ErrorCode.UNAUTHORIZED)
    const { real_name, phone, email } = req.body
    const user = await User.findOne({ where: { user_id: userId } })
    if (!user) return fail(res, '用户不存在', ErrorCode.RECORD_NOT_FOUND)
    const updateData = {}
    if (real_name !== undefined) updateData.real_name = real_name
    if (phone !== undefined) updateData.phone = phone
    if (email !== undefined) updateData.email = email
    await user.update(updateData)
    const data = user.toJSON()
    delete data.password
    return success(res, data, '个人信息已更新')
  } catch (err) {
    console.error('更新个人信息失败:', err)
    return fail(res, '服务器错误', ErrorCode.SYSTEM_ERROR)
  }
}

export default { list, detail, create, update, remove, toggle, uploadMyAvatar, setMyAvatar, updateMyProfile }
