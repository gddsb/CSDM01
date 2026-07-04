import bcrypt from 'bcryptjs'
import { User, Role, OperationLog } from '../models/index.js'
import { success, fail } from '../utils/response.js'
import { generateToken } from '../utils/jwt.js'

// 登录
export const login = async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return fail(res, '用户名和密码不能为空')
    }
    const user = await User.findOne({
      where: { username },
      include: [{ model: Role, as: 'role' }],
    })
    const forwarded = req.headers['x-forwarded-for']
    const ip = (forwarded && forwarded.split(',')[0].trim()) || req.ip || req.socket?.remoteAddress || ''

    if (!user) {
      OperationLog.create({
        user_id: null,
        username: username || '未知',
        module: '系统登录',
        operation: '登录失败（用户不存在）',
        method: 'POST',
        params: '',
        ip,
        status: 0,
      }).catch(() => {})
      return fail(res, '用户名不存在', 404)
    }
    const valid = bcrypt.compareSync(password, user.password)
    if (!valid) {
      OperationLog.create({
        user_id: user.user_id,
        username: user.username,
        module: '系统登录',
        operation: '登录失败（密码错误）',
        method: 'POST',
        params: '',
        ip,
        status: 0,
      }).catch(() => {})
      return fail(res, '密码错误')
    }
    if (user.status !== '启用') {
      OperationLog.create({
        user_id: user.user_id,
        username: user.username,
        module: '系统登录',
        operation: '登录失败（账号已禁用）',
        method: 'POST',
        params: '',
        ip,
        status: 0,
      }).catch(() => {})
      return fail(res, '账号已禁用')
    }
    // 更新最后登录时间
    await user.update({ last_login_time: new Date() })
    // 生成 token
    const token = generateToken(user)
    const userWithRole = user.toJSON()
    delete userWithRole.password

    // 记录登录成功日志
    OperationLog.create({
      user_id: user.user_id,
      username: user.username,
      module: '系统登录',
      operation: '登录成功',
      method: 'POST',
      params: '',
      ip,
      status: 1,
    }).catch(() => {})

    return success(res, { user: userWithRole, token }, '登录成功')
  } catch (err) {
    console.error('登录失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 获取当前登录用户信息
export const profile = async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) return fail(res, '未登录', 401)
    const user = await User.findOne({
      where: { user_id: userId },
      include: [{ model: Role, as: 'role' }],
    })
    if (!user) return fail(res, '用户不存在', 404)
    const userData = user.toJSON()
    delete userData.password
    return success(res, userData, '获取用户信息成功')
  } catch (err) {
    console.error('获取用户信息失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

// 登出（前端清除 token 即可）
export const logout = async (req, res) => {
  try {
    return success(res, null, '登出成功')
  } catch (err) {
    console.error('登出失败:', err)
    return fail(res, '服务器错误', 500)
  }
}

export default { login, profile, logout }
